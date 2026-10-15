import { useEffect, useMemo, useState } from 'react'
import type {
  ArknightsAccountServer,
  ImportedArknightsAccount,
  ImportedOperatorProgress,
} from '../../shared/arknightsAccount'
import './AccountSyncTestPanel.css'

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

export default function AccountSyncTestPanel(): React.JSX.Element {
  const [server, setServer] = useState<ArknightsAccountServer>('en')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [snapshot, setSnapshot] = useState<ImportedArknightsAccount | null>(null)
  const [operatorNames, setOperatorNames] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [warnings, setWarnings] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('No account sync has been run in this session.')
  const [busy, setBusy] = useState<'code' | 'sync' | 'clear' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.desktop.getOperatorDataset().then((dataset) => {
      if (active)
        setOperatorNames(new Map(dataset.operators.map((operator) => [operator.id, operator.name])))
    })
    void window.desktop.getImportedArknightsAccount().then((next) => {
      if (!active || !next) return
      setSnapshot(next)
      setServer(next.server)
      setStatus('Loaded the last sanitized account snapshot from local storage.')
    })
    return () => {
      active = false
    }
  }, [])

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
    } finally {
      setBusy(null)
    }
  }

  const syncAccount = async (): Promise<void> => {
    setBusy('sync')
    setError(null)
    try {
      const result = await window.desktop.syncArknightsAccount(server, email, code)
      setSnapshot(result.snapshot)
      setWarnings(result.warnings)
      setCode('')
      setStatus('Live account sync completed. Only the sanitized snapshot was retained.')
    } catch (nextError) {
      setError(formatError(nextError))
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
      setWarnings([])
      setStatus('Saved account snapshot cleared.')
    } catch (nextError) {
      setError(formatError(nextError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="account-sync-test" aria-labelledby="account-sync-test-heading">
      <div className="account-sync-test__heading">
        <div>
          <span className="account-sync-test__badge">M1 TEST SURFACE</span>
          <strong id="account-sync-test-heading">Arknights account sync</strong>
          <p>
            Unofficial read-only integration. Signing in may disconnect an active Arknights game
            session. Your email and verification code are used for this sync and are not stored in
            the account snapshot.
          </p>
        </div>
      </div>

      <div className="account-sync-test__fields">
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

        <label className="field account-sync-test__email">
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
          className="secondary-button account-sync-test__action"
          disabled={busy !== null || email.trim().length === 0}
          onClick={() => void requestCode()}
        >
          {busy === 'code' ? 'Sending…' : 'Send code'}
        </button>

        <label className="field account-sync-test__code">
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
          className="primary-button account-sync-test__action"
          disabled={busy !== null || email.trim().length === 0 || code.length !== 6}
          onClick={() => void syncAccount()}
        >
          {busy === 'sync' ? 'Syncing…' : 'Sync account'}
        </button>
      </div>

      <div className="account-sync-test__status" aria-live="polite">
        <span>{status}</span>
        {error && <strong className="status-error">{error}</strong>}
      </div>

      {snapshot && (
        <div className="account-sync-test__result">
          <div className="account-sync-test__summary">
            <span>
              <strong>{snapshot.accountName ?? '—'}</strong>
              <small>Account</small>
            </span>
            <span>
              <strong>{snapshot.uid ?? '—'}</strong>
              <small>UID</small>
            </span>
            <span>
              <strong>{SERVER_LABELS[snapshot.server]}</strong>
              <small>Server</small>
            </span>
            <span>
              <strong>{snapshot.operators.length}</strong>
              <small>Owned operators</small>
            </span>
            <span>
              <strong>{snapshot.ownedSkinIds.length}</strong>
              <small>Owned skins</small>
            </span>
            <span>
              <strong>{new Date(snapshot.fetchedAt).toLocaleString()}</strong>
              <small>Last sync</small>
            </span>
          </div>

          {warnings.length > 0 && (
            <div className="account-sync-test__warnings">
              {warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}

          <label className="field account-sync-test__search">
            <span>Verify operator progression</span>
            <input
              type="search"
              value={query}
              placeholder="Search operator name, char ID, or form ID"
              onChange={(event) => setQuery(event.target.value)}
            />
            <small>
              Showing {visibleOperators.length} result{visibleOperators.length === 1 ? '' : 's'}.
              Check Elite, level, equipped skin, and Amiya form state against your account.
            </small>
          </label>

          <div className="account-sync-test__operator-list">
            {visibleOperators.map((progress) => {
              const forms = formSummary(progress)
              return (
                <div key={progress.operatorId} className="account-sync-test__operator-row">
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

          <button
            type="button"
            className="secondary-button"
            disabled={busy !== null}
            onClick={() => void clearSnapshot()}
          >
            {busy === 'clear' ? 'Clearing…' : 'Clear saved snapshot'}
          </button>
        </div>
      )}
    </div>
  )
}
