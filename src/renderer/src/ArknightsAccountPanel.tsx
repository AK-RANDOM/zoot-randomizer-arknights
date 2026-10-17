import { useEffect, useMemo, useState } from 'react'
import type {
  ArknightsAccountServer,
  ImportedArknightsAccount,
  ImportedOperatorProgress,
} from '../../shared/arknightsAccount'
import {
  reconcileArknightsAccount,
  resolveArknightsSkinIdentity,
} from '../../shared/arknightsAccountReconciliation'
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

function operatorLabel(
  progress: ImportedOperatorProgress,
  operatorNames: ReadonlyMap<string, string>,
): string {
  return operatorNames.get(progress.operatorId) ?? progress.operatorId
}

function formSummary(progress: ImportedOperatorProgress): string | null {
  if (!progress.forms || progress.forms.length === 0) return null
  return progress.forms
    .map((form) => {
      const active = form.formId === progress.activeFormId ? ' • active' : ''
      return `${form.formId}: E${form.elite} Lv${form.level} · ${form.equippedSkinId ?? 'no skin ID'}${active}`
    })
    .join('\n')
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

function IdentityCounts({
  title,
  owned,
  recognized,
  unknown,
}: {
  title: string
  owned: number
  recognized: number
  unknown: number
}): React.JSX.Element {
  return (
    <div className="arknights-account__count-card">
      <strong>{title}</strong>
      <dl>
        <div>
          <dt>Owned</dt>
          <dd>{owned}</dd>
        </div>
        <div>
          <dt>Recognized</dt>
          <dd>{recognized}</dd>
        </div>
        <div>
          <dt>Unknown</dt>
          <dd>{unknown}</dd>
        </div>
      </dl>
    </div>
  )
}

function UnknownIds({
  label,
  ids,
}: {
  label: string
  ids: readonly string[]
}): React.JSX.Element | null {
  if (ids.length === 0) return null
  return (
    <div className="arknights-account__unknown-group">
      <strong>{label}</strong>
      <code>{ids.join('\n')}</code>
    </div>
  )
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
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Checking for saved account data…')
  const [busy, setBusy] = useState<'code' | 'sync' | 'clear' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const operatorNames = useMemo(
    () => new Map(dataset?.operators.map((operator) => [operator.id, operator.name]) ?? []),
    [dataset],
  )

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

  const reconciliation = useMemo(
    () => (snapshot && dataset ? reconcileArknightsAccount(snapshot, dataset) : null),
    [dataset, snapshot],
  )
  const hasUnknownData =
    reconciliation !== null &&
    (reconciliation.operators.unknown > 0 ||
      reconciliation.skins.unknown > 0 ||
      reconciliation.equippedSkins.unknown > 0)

  const visibleOperators = useMemo(() => {
    if (!snapshot) return []
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const sorted = [...snapshot.operators].sort((left, right) =>
      operatorLabel(left, operatorNames).localeCompare(operatorLabel(right, operatorNames)),
    )
    if (!normalizedQuery) return sorted.slice(0, 20)
    return sorted
      .filter((progress) => {
        const name = operatorLabel(progress, operatorNames).toLocaleLowerCase()
        return (
          name.includes(normalizedQuery) ||
          progress.operatorId.toLocaleLowerCase().includes(normalizedQuery) ||
          progress.forms?.some((form) =>
            form.formId.toLocaleLowerCase().includes(normalizedQuery),
          ) === true
        )
      })
      .slice(0, 50)
  }, [operatorNames, query, snapshot])

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
      setQuery('')
      setEmail('')
      setCode('')
      setStatus('Imported account data cleared. Login credentials were never saved.')
    } catch (nextError) {
      setError(formatError(nextError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="arknights-account" aria-labelledby="arknights-account-heading">
      <div className="arknights-account__heading">
        <span className="arknights-account__eyebrow">ARKNIGHTS ACCOUNT</span>
        <strong id="arknights-account-heading">Account import and sync</strong>
        <p>
          Unofficial read-only integration. Signing in may disconnect an active Arknights game
          session. Email, verification codes, and reusable authentication secrets are not saved.
        </p>
      </div>

      <div className="arknights-account__auth">
        <strong>{snapshot ? 'Refresh imported account' : 'Import account'}</strong>
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

      <div className="arknights-account__status" aria-live="polite">
        <span>{status}</span>
        {error && <strong className="status-error">{error}</strong>}
      </div>

      {snapshot && (
        <div className="arknights-account__result">
          <div className="arknights-account__identity">
            <div className="arknights-account__profile">
              {avatarImageUrl && (
                <img
                  className="arknights-account__avatar"
                  src={avatarImageUrl}
                  alt="Profile avatar"
                  draggable={false}
                />
              )}
              <span>
                <strong>{snapshot.accountName ?? 'Imported account'}</strong>
                <small>UID {snapshot.uid ?? '—'}</small>
              </span>
            </div>
            <span>
              <strong>{SERVER_LABELS[snapshot.server]}</strong>
              <small>Server</small>
            </span>
            <span>
              <strong>{new Date(snapshot.fetchedAt).toLocaleString()}</strong>
              <small>Last synced</small>
            </span>
          </div>

          {reconciliation ? (
            <>
              <div className="arknights-account__counts">
                <IdentityCounts title="Operators" {...reconciliation.operators} />
                <IdentityCounts title="Skins" {...reconciliation.skins} />
                <div className="arknights-account__count-card">
                  <strong>Equipped skins</strong>
                  <dl>
                    <div>
                      <dt>Equipped</dt>
                      <dd>{reconciliation.equippedSkins.equipped}</dd>
                    </div>
                    <div>
                      <dt>Recognized</dt>
                      <dd>{reconciliation.equippedSkins.recognized}</dd>
                    </div>
                    <div>
                      <dt>Unknown</dt>
                      <dd>{reconciliation.equippedSkins.unknown}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div
                className={`arknights-account__reconciliation${hasUnknownData ? ' is-warning' : ' is-ok'}`}
              >
                <strong>Dataset reconciliation</strong>
                {hasUnknownData ? (
                  <>
                    <p>
                      Some account IDs are not present in the installed Zoot data. Update operator
                      data from Setup → Global Pool, then return here to re-check newer operators or
                      skins.
                    </p>
                    <details>
                      <summary>Show unknown native IDs</summary>
                      <div className="arknights-account__unknown-list">
                        <UnknownIds label="Operators" ids={reconciliation.unknownOperatorIds} />
                        <UnknownIds label="Owned skins" ids={reconciliation.unknownSkinIds} />
                        <UnknownIds
                          label="Equipped skins"
                          ids={reconciliation.unknownEquippedSkinIds}
                        />
                      </div>
                    </details>
                  </>
                ) : (
                  <p>
                    All imported operator and skin IDs are recognized by the installed Zoot data.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p>Waiting for the installed operator dataset before checking imported IDs.</p>
          )}

          {warnings.length > 0 && (
            <div className="arknights-account__warnings">
              <strong>Sync warnings</strong>
              {warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}

          <details className="arknights-account__inspector">
            <summary>Inspect imported operator progression</summary>
            <div className="arknights-account__inspector-body">
              <label className="field">
                <span>Search imported operators</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Operator name, char ID, or Amiya form ID"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="arknights-account__operator-list">
                {visibleOperators.map((progress) => {
                  const forms = formSummary(progress)
                  const recognized = operatorNames.has(progress.operatorId)
                  return (
                    <div
                      key={progress.operatorId}
                      className={`arknights-account__operator-row${recognized ? '' : ' is-unknown'}`}
                    >
                      <span>
                        <strong>{operatorLabel(progress, operatorNames)}</strong>
                        <small>{progress.operatorId}</small>
                      </span>
                      <span>
                        E{progress.elite} Lv{progress.level}
                      </span>
                      <span>
                        {progress.equippedSkinId ?? 'No equipped skin ID'}
                        {forms && <small style={{ whiteSpace: 'pre-line' }}>{forms}</small>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </details>

          <div className="arknights-account__clear">
            <div>
              <strong>Remove imported account data</strong>
              <small>
                Deletes the sanitized local snapshot. This does not change anything on your
                Arknights account.
              </small>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => void clearSnapshot()}
            >
              {busy === 'clear' ? 'Clearing…' : 'Clear imported account data'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
