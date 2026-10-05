import { useEffect, useMemo, useState } from 'react'
import type { DraftConfigurationInput, DraftState } from '../../shared/draft'
import { localizeOperatorDataset } from '../../shared/gameLocalization'
import type { Operator } from '../../shared/operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { resolveDraftRulebookExecution } from '../../shared/draftRulebookExecution'
import OperatorCard from './OperatorCard'
import { draftCompletionMessage } from './draftSessionMessages'
import { loadDraftRulebookLibrary } from './draftRulebookStorage'
import { loadOperatorPreferences } from './operatorPreferencesStorage'
import useDraftSession, { DRAFT_SESSION_RESET_EVENT } from './useDraftSession'

const SELECTED_RULEBOOK_KEY = 'arknights-randomizer:selected-draft-rulebook:v1'

interface DraftPanelProps {
  state: DraftState | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  distributionLabel: string
  onStart: () => void
  onPick: (operatorId: string) => void
}

interface DraftSessionViewProps {
  state: DraftState | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  distributionLabel: string
  rulebook: DraftRulebook
  poolSourceLabel: string
  validationErrors?: readonly string[]
  statusMessage?: string | null
  statusError?: string | null
  onStart: () => void
  onPick: (operatorId: string) => void
}

function loadSelectedRulebookId(): string {
  try {
    return window.localStorage.getItem(SELECTED_RULEBOOK_KEY) ?? STANDARD_DRAFT_RULEBOOK_ID
  } catch {
    return STANDARD_DRAFT_RULEBOOK_ID
  }
}

function persistSelectedRulebookId(rulebookId: string): void {
  try {
    window.localStorage.setItem(SELECTED_RULEBOOK_KEY, rulebookId)
  } catch {
    // Selection persistence is optional; the current session still works.
  }
}

function DraftSessionView({
  state,
  operators,
  targetSize,
  ready,
  distributionLabel,
  rulebook,
  poolSourceLabel,
  validationErrors = [],
  statusMessage,
  statusError,
  onStart,
  onPick,
}: DraftSessionViewProps): React.JSX.Element {
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )

  const offeredOperators = state
    ? state.currentOfferIds
        .map((id) => operatorById.get(id))
        .filter((operator): operator is Operator => operator !== undefined)
    : []
  const draftedOperators = state
    ? state.draftedOperatorIds
        .map((id) => operatorById.get(id))
        .filter((operator): operator is Operator => operator !== undefined)
    : []
  const rosterSlots = Array.from({ length: targetSize }, (_, index) => draftedOperators[index] ?? null)
  const canStart = ready && validationErrors.length === 0 && operators.length >= 3

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GET SQUAD • DRAFTS</p>
          <h2 id="draft-heading">{rulebook.identifier.name}</h2>
          {rulebook.identifier.description && (
            <p className="filter-note">{rulebook.identifier.description}</p>
          )}
        </div>
        <div className="section-actions">
          <button
            className="randomize-button"
            type="button"
            disabled={!canStart}
            onClick={onStart}
          >
            {state ? 'New Draft' : 'Start Draft'}
          </button>
        </div>
      </div>

      <div className="draft-summary">
        <div>
          <span>Rulebook revision</span>
          <strong>{rulebook.identifier.revision}</strong>
        </div>
        <div>
          <span>Pool source</span>
          <strong>{poolSourceLabel}</strong>
        </div>
        <div>
          <span>Draft target</span>
          <strong>{targetSize}</strong>
        </div>
        <div>
          <span>Eligible pool</span>
          <strong>{operators.length}</strong>
        </div>
        <div>
          <span>Progress</span>
          <strong>
            {state
              ? `${state.draftedOperatorIds.length} / ${state.targetSize}`
              : `0 / ${targetSize}`}
          </strong>
        </div>
        <div>
          <span>Distribution</span>
          <strong>{distributionLabel}</strong>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-box" role="alert">
          <strong>This Draft Rulebook cannot be executed.</strong>
          <ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      {statusError && <div className="validation-box" role="alert"><strong>{statusError}</strong></div>}
      {statusMessage && !statusError && <p className="draft-session-note">{statusMessage}</p>}

      {state && (
        <p className="draft-session-note">
          This Draft is tied to its starting pool, target size, and Draft Rulebook. Changing any
          of them resets the session.
        </p>
      )}

      {!state ? (
        <div className="draft-empty-state">
          <strong>
            {!ready
              ? 'Loading Draft Rulebook data…'
              : validationErrors.length > 0
                ? 'Rulebook needs attention'
                : operators.length >= 3
                  ? 'Ready to draft'
                  : 'Not enough eligible operators'}
          </strong>
          <p>
            {!ready
              ? 'Draft will be available after the operator dataset finishes loading.'
              : validationErrors.length > 0
                ? 'Fix the Rulebook in Setup → Draft Rulebooks before starting this draft.'
                : operators.length >= 3
                  ? 'The selected Draft Rulebook now controls the effective pool and Draft configuration.'
                  : 'A Draft offer requires three distinct eligible operators. Adjust the Rulebook or Global Pool before starting.'}
          </p>
        </div>
      ) : state.status === 'complete' ? (
        <div className="draft-complete" role="status">
          <strong>{draftCompletionMessage(state)}</strong>
          <span>Start a new draft to generate a fresh first offer.</span>
        </div>
      ) : (
        <>
          <div className="draft-round-heading">
            <div>
              <span>Current offer</span>
              <strong>Choose exactly one operator</strong>
            </div>
            <span>Round {state.draftedOperatorIds.length + 1}</span>
          </div>

          <div className="draft-offer-grid">
            {offeredOperators.map((operator) => (
              <button
                key={operator.id}
                type="button"
                className="draft-candidate"
                aria-label={`Draft ${operator.name}`}
                onClick={() => onPick(operator.id)}
              >
                <OperatorCard operator={operator} />
                <span className="draft-candidate__action">Draft {operator.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="draft-roster-heading">
        <div>
          <strong>Drafted roster</strong>
          <span>Selected operators remain owned for the rest of this draft and cannot reappear.</span>
        </div>
      </div>

      <div className="draft-roster-grid">
        {rosterSlots.map((operator, index) => (
          <div className="draft-roster-slot" key={index}>
            {operator ? (
              <OperatorCard operator={operator} />
            ) : (
              <div className="empty-slot">
                <span>SLOT {index + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function ConfiguredRulebookDraft({
  rulebook,
  globalPool,
  targetSize,
  ready,
}: {
  rulebook: DraftRulebook
  globalPool: readonly Operator[]
  targetSize: number
  ready: boolean
}): React.JSX.Element {
  const [datasetOperators, setDatasetOperators] = useState<Operator[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDatasetOperators(null)
    setLoadError(null)
    const preferences = loadOperatorPreferences()
    void window.desktop.getOperatorDataset()
      .then((dataset) => {
        if (!active) return
        setDatasetOperators(localizeOperatorDataset(dataset, preferences.gameLocale).operators)
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => { active = false }
  }, [rulebook.identifier.id, rulebook.identifier.revision])

  const execution = useMemo(
    () => datasetOperators
      ? resolveDraftRulebookExecution(rulebook, datasetOperators, globalPool)
      : null,
    [datasetOperators, globalPool, rulebook],
  )

  const configuration = execution?.configuration ?? undefined
  const session = useDraftSession({
    pool: execution?.pool ?? [],
    targetSize,
    ready: ready && datasetOperators !== null && execution?.valid === true,
    configuration: configuration as DraftConfigurationInput | undefined,
    sessionKey: execution?.identityKey ?? `${rulebook.identifier.id}:loading`,
    onMessage: setMessage,
    onError: setError,
  })

  return (
    <DraftSessionView
      state={session.state}
      operators={execution?.pool ?? []}
      targetSize={targetSize}
      ready={ready && datasetOperators !== null && !loadError}
      distributionLabel={session.distributionLabel}
      rulebook={rulebook}
      poolSourceLabel={execution?.poolSourceLabel ?? 'Resolving…'}
      validationErrors={execution?.validation.errors ?? (loadError ? [loadError] : [])}
      statusMessage={message}
      statusError={error}
      onStart={session.start}
      onPick={session.pick}
    />
  )
}

export default function DraftPanel({
  state,
  operators,
  targetSize,
  ready,
  distributionLabel,
  onStart,
  onPick,
}: DraftPanelProps): React.JSX.Element {
  const customRulebooks = useMemo(() => loadDraftRulebookLibrary(), [])
  const rulebooks = useMemo(
    () => [STANDARD_DRAFT_RULEBOOK, ...customRulebooks],
    [customRulebooks],
  )
  const [selectedId, setSelectedId] = useState(() => loadSelectedRulebookId())
  const selected = rulebooks.find((rulebook) => rulebook.identifier.id === selectedId)
    ?? STANDARD_DRAFT_RULEBOOK

  useEffect(() => {
    if (selected.identifier.id !== selectedId) {
      setSelectedId(selected.identifier.id)
      persistSelectedRulebookId(selected.identifier.id)
    }
  }, [selected.identifier.id, selectedId])

  const selectRulebook = (rulebookId: string): void => {
    if (rulebookId === selected.identifier.id) return
    setSelectedId(rulebookId)
    persistSelectedRulebookId(rulebookId)
    window.dispatchEvent(new Event(DRAFT_SESSION_RESET_EVENT))
  }

  const selector = (
    <div className="preset-toolbar">
      <label className="preset-select">
        <span>Draft Rulebook</span>
        <select value={selected.identifier.id} onChange={(event) => selectRulebook(event.target.value)}>
          <optgroup label="Built-in">
            <option value={STANDARD_DRAFT_RULEBOOK_ID}>{STANDARD_DRAFT_RULEBOOK.identifier.name}</option>
          </optgroup>
          {customRulebooks.length > 0 && (
            <optgroup label="Local">
              {customRulebooks.map((rulebook) => (
                <option key={rulebook.identifier.id} value={rulebook.identifier.id}>{rulebook.identifier.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="rulebook-library-summary">
        <strong>{selected.identifier.name}</strong>
        <span>Revision {selected.identifier.revision}</span>
      </div>
    </div>
  )

  if (selected.identifier.id !== STANDARD_DRAFT_RULEBOOK_ID) {
    return (
      <>
        {selector}
        <ConfiguredRulebookDraft
          key={selected.identifier.id}
          rulebook={selected}
          globalPool={operators}
          targetSize={targetSize}
          ready={ready}
        />
      </>
    )
  }

  return (
    <>
      {selector}
      <DraftSessionView
        state={state}
        operators={operators}
        targetSize={targetSize}
        ready={ready}
        distributionLabel={distributionLabel}
        rulebook={STANDARD_DRAFT_RULEBOOK}
        poolSourceLabel="Inherit Global Pool"
        onStart={onStart}
        onPick={onPick}
      />
    </>
  )
}
