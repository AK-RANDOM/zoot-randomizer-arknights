import { useEffect, useState } from 'react'
import type {
  ArknightsAccountServer,
  ImportedArknightsAccount,
} from '../../shared/arknightsAccount'
import { resolveArknightsSkinIdentity } from '../../shared/arknightsAccountReconciliation'
import type { OperatorDataset } from '../../shared/operator'
import { notifyImportedArknightsAccountChanged } from './arknightsAccountState'
import './ArknightsAccountPanel.css'

const SERVER_LABELS: Record<ArknightsAccountServer, string> = {
  en: 'EN / Global',
  jp: 'JP',
  kr: 'KR',
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function resolveAvatarImage(
  snapshot: ImportedArknightsAccount,
  dataset: OperatorDataset | null,
): Promise<string | null> {
  const avatar = snapshot.avatar
  if (!avatar?.id) return null

  if (avatar.id.startsWith('avatar_')) {
    return window.desktop.getArknightsProfileAvatar(avatar.id)
  }
  if (avatar.type !== 'ASSISTANT' || !dataset) return null

  const nativeSkin = resolveArknightsSkinIdentity(dataset, avatar.id)
  if (nativeSkin) {
    const operator = dataset.operators.find((candidate) => candidate.id === nativeSkin.operatorId)
    const defaultArt = operator?.defaultArts?.find((art) => art.id === nativeSkin.skinId)
    if (defaultArt?.avatarId) return window.desktop.getOperatorAvatarAsset(defaultArt.avatarId)
    const skin = operator?.skins?.find((candidate) => candidate.id === nativeSkin.skinId)
    if (skin?.avatarId) return window.desktop.getOperatorAvatarAsset(skin.avatarId)
    return nativeSkin.appearance === 'default'
      ? window.desktop.getOperatorImage(nativeSkin.operatorId)
      : window.desktop.getOperatorSkinAvatar(nativeSkin.operatorId, nativeSkin.skinId)
  }

  if (/^char_[a-z0-9_]+$/i.test(avatar.id)) {
    return window.desktop.getOperatorImage(avatar.id)
  }
  return null
}

export default function ArknightsAccountPanel({
  dataset,
}: {
  dataset: OperatorDataset | null
}): React.JSX.Element {
  const [server, setServer] = useState<ArknightsAccountServer>('en')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [snapshot, setSnapshot] = useState<ImportedArknightsAccount | null>(null)
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [status, setStatus] = useState('Checking for saved account data…')
  const [busy, setBusy] = useState<'code' | 'sync' | 'clear' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshOpen, setRefreshOpen] = useState(false)

  useEffect(() => {
    let active = true
    void window.desktop
      .getImportedArknightsAccount()
      .then((next) => {
        if (!active) return
        setSnapshot(next)
        if (next) {
          setServer(next.server)
          setStatus('Loaded the last sanitized account snapshot from local storage.')
        } else {
          setStatus('No imported account data is saved yet.')
        }
      })
      .catch((nextError) => {
        if (!active) return
        setError(formatError(nextError))
        setStatus('Saved account data could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setAvatarImageUrl(null)
    if (snapshot) {
      void resolveAvatarImage(snapshot, dataset)
        .then((image) => {
          if (active) setAvatarImageUrl(image)
        })
        .catch(() => {
          if (active) setAvatarImageUrl(null)
        })
    }
    return () => {
      active = false
    }
  }, [dataset, snapshot])

  const requestCode = async (): Promise<void> => {
    setBusy('code')
    setError(null)
    try {
      await window.desktop.requestArknightsLoginCode(server, email)
      setStatus('Verification code requested. Check your email, then enter the 6-digit code below.')
    } catch (nextError) {
      setError(formatError(nextError))
      setStatus('Verification code request failed.')
    } finally {
      setBusy(null)
    }
  }

  const syncAccount = async (): Promise<void> => {
    const refreshing = snapshot !== null
    setBusy('sync')
    setError(null)
    try {
      const result = await window.desktop.syncArknightsAccount(server, email, code)
      setSnapshot(result.snapshot)
      notifyImportedArknightsAccountChanged(result.snapshot)
      setServer(result.snapshot.server)
      setWarnings(result.warnings)
      setCode('')
      setRefreshOpen(false)
      setStatus(
        refreshing
          ? 'Account snapshot refreshed. Only sanitized account data was retained.'
          : 'Account imported. Only sanitized account data was retained.',
      )
    } catch (nextError) {
      setError(formatError(nextError))
      setStatus(
        snapshot
          ? 'Refresh failed. The last valid saved snapshot remains available.'
          : 'Account import failed. No account snapshot was saved.',
      )
    } finally {
      setBusy(null)
    }
  }

  const clearSnapshot = async (): Promise<void> => {
    setBusy('clear')
    setError(null)
    try {
      await window.desktop.clearImportedArknightsAccount()
      setSnapshot(null)
      notifyImportedArknightsAccountChanged(null)
      setWarnings([])
      setEmail('')
      setCode('')
      setRefreshOpen(false)
      setStatus('Imported account data cleared. Login credentials were never saved.')
    } catch (nextError) {
      setError(formatError(nextError))
    } finally {
      setBusy(null)
    }
  }

  const authOpen = snapshot === null || refreshOpen

  return (
    <div className="arknights-account" aria-label="Arknights account">
      {snapshot && (
        <div className="arknights-account__compact">
          <div className="arknights-account__account-info">
            {avatarImageUrl && (
              <img
                className="arknights-account__avatar"
                src={avatarImageUrl}
                alt="Profile avatar"
                draggable={false}
              />
            )}
            <div className="arknights-account__account-copy">
              <strong>{SERVER_LABELS[snapshot.server]} Server</strong>
              <span>
                {snapshot.accountName ?? 'Imported account'} (UID: {snapshot.uid ?? '—'})
              </span>
              <small>Last Sync: {new Date(snapshot.fetchedAt).toLocaleString()}</small>
            </div>
          </div>

          <div className="arknights-account__operator-info">
            <span>
              <small>Operator Owned</small>
              <strong>{snapshot.operators.length}</strong>
            </span>
            <span>
              <small>Outfit Owned</small>
              <strong>{snapshot.ownedSkinIds.length}</strong>
            </span>
          </div>

          <button
            type="button"
            className="danger-button arknights-account__compact-action"
            disabled={busy !== null}
            onClick={() => void clearSnapshot()}
          >
            {busy === 'clear' ? 'Unlinking…' : 'Unlink'}
          </button>

          <button
            type="button"
            className="primary-button arknights-account__compact-action"
            disabled={busy !== null}
            onClick={() => setRefreshOpen(true)}
          >
            Sync
          </button>
        </div>
      )}

      {authOpen && (
        <div className="arknights-account__auth">
          <div className="arknights-account__auth-heading">
            <strong>{snapshot ? 'Refresh imported account' : 'Import account'}</strong>
            {snapshot && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy !== null}
                onClick={() => setRefreshOpen(false)}
              >
                Cancel
              </button>
            )}
          </div>
          <p>
            Unofficial read-only integration. Signing in may disconnect an active Arknights game
            session. Email, verification codes, and reusable authentication secrets are not saved.
          </p>
          <div className="arknights-account__fields">
            <label className="field">
              <span>Server</span>
              <select
                value={server}
                disabled={busy !== null}
                onChange={(event) => setServer(event.target.value as ArknightsAccountServer)}
              >
                {(Object.entries(SERVER_LABELS) as Array<[ArknightsAccountServer, string]>).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              <span>YoStar email</span>
              <input
                type="email"
                value={email}
                autoComplete="email"
                disabled={busy !== null}
                placeholder="doctor@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={busy !== null || email.trim().length === 0}
              onClick={() => void requestCode()}
            >
              {busy === 'code' ? 'Sending…' : 'Send code'}
            </button>
            <label className="field">
              <span>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                maxLength={6}
                disabled={busy !== null}
                placeholder="123456"
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={busy !== null || email.trim().length === 0 || code.length !== 6}
              onClick={() => void syncAccount()}
            >
              {busy === 'sync' ? 'Syncing…' : snapshot ? 'Refresh account' : 'Sync account'}
            </button>
          </div>
        </div>
      )}

      <div className="arknights-account__status" aria-live="polite">
        <span>{status}</span>
        {error && <strong className="status-error">{error}</strong>}
      </div>

      {warnings.length > 0 && (
        <div className="arknights-account__warnings">
          <strong>Sync warnings</strong>
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
    </div>
  )
}
