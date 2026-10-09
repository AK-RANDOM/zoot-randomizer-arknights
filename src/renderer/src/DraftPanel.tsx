import { useEffect, useMemo, useState } from 'react'
import {
  type DraftAction,
  type DraftConfigurationInput,
  type DraftState,
  type ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { resolveDraftRulebookExecution } from '../../shared/draftRulebookExecution'
import OperatorCard from './OperatorCard'
import DraftOperatorCard from './DraftOperatorCard'
import {
  buildLiveRulebookOperatorInteractionDetails,
  buildRulebookOperatorInteractionDetails,
} from './draftInteractionPresentation'
import { draftCompletionMessage } from './draftSessionMessages'
import {
  resolveDraftActionPresentation,
  resolveDraftOperatorPresentation,
  resolveDraftStatusPresentation,
  type DraftActionPresentation,
} from './draftPresentation'
import { loadDraftRulebookEntries } from './draftRulebookStorage'
import { loadSelectedDraftRulebookId, saveSelectedDraftRulebookId } from './rendererPersistence'
import useDraftSession, { DRAFT_SESSION_RESET_EVENT } from './useDraftSession'

interface DraftPanelProps {
  dataset: OperatorDataset | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
}

interface DraftSessionViewProps {
  state: DraftState | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  distributionLabel: string
  rulebook: DraftRulebook
  poolSourceLabel: string
  dataset?: OperatorDataset
  configuration?: ResolvedDraftConfiguration
  validationErrors?: readonly string[]
  statusMessage?: string | null
  statusError?: string | null
  onStart: () => void
  onPick: (operatorId: string) => void
  onAction?: (action: DraftAction) => void
}

function pointDeltaLabel(delta: number): string {
  if (delta === 0) return 'Free'
  return delta > 0 ? `+${delta} pts` : `${Math.abs(delta)} pts`
}

function DraftSessionView({
  state,
  operators,
  targetSize,
  ready,
  distributionLabel,
  rulebook,
  poolSourceLabel,
  dataset,
  configuration,
  validationErrors = [],
  statusMessage,
  statusError,
  onStart,
  onPick,
  onAction,
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
  const heldOperator = state?.heldOperatorId
    ? (operatorById.get(state.heldOperatorId) ?? null)
    : null
  const rosterSlots = Array.from(
    { length: targetSize },
    (_, index) => draftedOperators[index] ?? null,
  )
  const canStart = ready && validationErrors.length === 0 && operators.length >= 3
  const advanced = state !== null && configuration !== undefined && onAction !== undefined
  const status = resolveDraftStatusPresentation(state, targetSize)

  const actionPresentation = (action: DraftAction): DraftActionPresentation | null => {
    if (!state || !configuration) return null
    return resolveDraftActionPresentation(state, operators, action, configuration)
  }

  const reroll = advanced ? actionPresentation({ type: 'reroll' }) : null
  const forfeit = advanced ? actionPresentation({ type: 'forfeit' }) : null
  const slotExpansion = advanced ? actionPresentation({ type: 'slot-expansion' }) : null
  const releaseHold = advanced ? actionPresentation({ type: 'release-hold' }) : null
  const heldPick =
    advanced && heldOperator
      ? actionPresentation({ type: 'pick', operatorId: heldOperator.id })
      : null

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="draft-status-shell">
        <div className="draft-status-main">
          <div className="draft-status-rulebook">
            <span>Draft Rulebook</span>
            <strong id="draft-heading">{rulebook.identifier.name}</strong>
          </div>
          <div className="draft-status-item">
            <span>Round</span>
            <strong>{status.roundNumber ?? '—'}</strong>
          </div>
          <div className="draft-status-item">
            <span>Selected</span>
            <strong>
              {status.selectedCount} / {status.targetSize}
            </strong>
          </div>
          {status.points !== null && (
            <div className="draft-status-item">
              <span>Points</span>
              <strong>{status.points}</strong>
            </div>
          )}
          <div className="draft-status-item">
            <span>Capacity</span>
            <strong>{status.capacity.label}</strong>
          </div>
        </div>
        <button
          className="randomize-button draft-status-new"
          type="button"
          disabled={!canStart}
          onClick={onStart}
        >
          {state ? 'New Draft' : 'Start Draft'}
        </button>
      </div>
      <div className="draft-status-context" aria-label="Draft Rulebook context">
        <span>Revision {rulebook.identifier.revision}</span>
        <span>{poolSourceLabel}</span>
        <span>{distributionLabel}</span>
        <span>{operators.length} eligible operators</span>
      </div>
      {rulebook.identifier.description && (
        <p className="draft-rulebook-description">{rulebook.identifier.description}</p>
      )}

      {validationErrors.length > 0 && (
        <div className="validation-box" role="alert">
          <strong>This Draft Rulebook cannot be executed.</strong>
          <ul>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {statusError && (
        <div className="validation-box" role="alert">
          <strong>{statusError}</strong>
        </div>
      )}
      {statusMessage && !statusError && <p className="draft-session-note">{statusMessage}</p>}
      {state && (
        <p className="draft-session-note">
          This Draft is tied to its starting pool, target size, and Draft Rulebook. Changing any of
          them resets the session.
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
                  ? 'The selected Draft Rulebook controls the effective pool, economy, actions, and pull distribution.'
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
          {advanced && configuration?.actionRules.reroll.enabled && (
            <div className="draft-action-bar" aria-label="Draft actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!reroll?.available}
                title={reroll?.blockReasonLabel ?? undefined}
                onClick={() => onAction?.({ type: 'reroll' })}
              >
                Reroll · {pointDeltaLabel(reroll?.economy.pointDelta ?? 0)}
              </button>
              {configuration.actionRules.forfeit.enabled && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!forfeit?.available}
                  title={forfeit?.blockReasonLabel ?? undefined}
                  onClick={() => onAction?.({ type: 'forfeit' })}
                >
                  Forfeit · {pointDeltaLabel(forfeit?.economy.pointDelta ?? 0)}
                </button>
              )}
              {configuration.actionRules.slotExpansion.enabled && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!slotExpansion?.available}
                  title={slotExpansion?.blockReasonLabel ?? undefined}
                  onClick={() => onAction?.({ type: 'slot-expansion' })}
                >
                  Expand slot · {pointDeltaLabel(slotExpansion?.economy.pointDelta ?? 0)}
                </button>
              )}
            </div>
          )}
          {advanced &&
            configuration &&
            !configuration.actionRules.reroll.enabled &&
            (configuration.actionRules.forfeit.enabled ||
              configuration.actionRules.slotExpansion.enabled) && (
              <div className="draft-action-bar" aria-label="Draft actions">
                {configuration.actionRules.forfeit.enabled && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!forfeit?.available}
                    title={forfeit?.blockReasonLabel ?? undefined}
                    onClick={() => onAction?.({ type: 'forfeit' })}
                  >
                    Forfeit · {pointDeltaLabel(forfeit?.economy.pointDelta ?? 0)}
                  </button>
                )}
                {configuration.actionRules.slotExpansion.enabled && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!slotExpansion?.available}
                    title={slotExpansion?.blockReasonLabel ?? undefined}
                    onClick={() => onAction?.({ type: 'slot-expansion' })}
                  >
                    Expand slot · {pointDeltaLabel(slotExpansion?.economy.pointDelta ?? 0)}
                  </button>
                )}
              </div>
            )}

          {advanced &&
            configuration &&
            (heldOperator || configuration.actionRules.hold.enabled) && (
              <div className="draft-hold-panel">
                <div>
                  <span>Hold slot</span>
                  <strong>{heldOperator?.name ?? 'Empty'}</strong>
                </div>
                {heldOperator && (
                  <div className="draft-hold-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!heldPick?.available}
                      title={heldPick?.blockReasonLabel ?? undefined}
                      onClick={() => onAction?.({ type: 'pick', operatorId: heldOperator.id })}
                    >
                      Draft held · {pointDeltaLabel(heldPick?.economy.pointDelta ?? 0)}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!releaseHold?.available}
                      title={releaseHold?.blockReasonLabel ?? undefined}
                      onClick={() => onAction?.({ type: 'release-hold' })}
                    >
                      Release hold
                    </button>
                  </div>
                )}
              </div>
            )}

          <div className="draft-round-heading">
            <div>
              <span>Current offer</span>
              <strong>Choose one round-resolution action</strong>
            </div>
            <span>Round {state.roundNumber}</span>
          </div>
          <div className="draft-offer-grid">
            {offeredOperators.map((operator) => {
              const presentation = configuration
                ? resolveDraftOperatorPresentation(state, operators, operator, configuration)
                : null
              const interactionDetails =
                dataset && configuration
                  ? buildLiveRulebookOperatorInteractionDetails(
                      rulebook,
                      operator,
                      dataset,
                      operators,
                      state,
                      configuration,
                    )
                  : undefined

              if (!presentation) {
                return (
                  <article className="draft-candidate-card" key={operator.id}>
                    <OperatorCard operator={operator} interactionDetails={interactionDetails} />
                    <button
                      type="button"
                      className="draft-candidate__action"
                      onClick={() => onPick(operator.id)}
                    >
                      Draft {operator.name}
                    </button>
                  </article>
                )
              }

              const holdAction = presentation.hold?.action

              return (
                <article
                  className="draft-candidate-card draft-candidate-card--compact"
                  key={operator.id}
                >
                  <DraftOperatorCard
                    operator={operator}
                    presentation={presentation}
                    interactionDetails={interactionDetails}
                    onPick={() => onPick(operator.id)}
                    onHold={holdAction ? () => onAction?.(holdAction) : undefined}
                  />
                </article>
              )
            })}
          </div>
        </>
      )}

      <div className="draft-roster-heading">
        <div>
          <strong>Drafted roster</strong>
          <span>
            Selected operators remain owned for the rest of this draft and cannot reappear.
          </span>
        </div>
      </div>
      <div className="draft-roster-grid">
        {rosterSlots.map((operator, index) => (
          <div className="draft-roster-slot" key={index}>
            {operator ? (
              <OperatorCard
                operator={operator}
                interactionDetails={
                  dataset
                    ? buildRulebookOperatorInteractionDetails(
                        rulebook,
                        operator,
                        dataset,
                        operators,
                      )
                    : undefined
                }
              />
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
  dataset,
  globalPool,
  targetSize,
  ready,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset | null
  globalPool: readonly Operator[]
  targetSize: number
  ready: boolean
}): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const execution = useMemo(
    () => (dataset ? resolveDraftRulebookExecution(rulebook, dataset.operators, globalPool) : null),
    [dataset, globalPool, rulebook],
  )
  const configuration = execution?.configuration ?? undefined
  const session = useDraftSession({
    pool: execution?.pool ?? [],
    targetSize,
    ready: ready && dataset !== null && execution?.valid === true,
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
      ready={ready && dataset !== null}
      distributionLabel={session.distributionLabel}
      rulebook={rulebook}
      poolSourceLabel={execution?.poolSourceLabel ?? 'Resolving…'}
      dataset={dataset ?? undefined}
      configuration={execution?.configuration ?? undefined}
      validationErrors={execution?.validation.errors ?? []}
      statusMessage={message}
      statusError={error}
      onStart={session.start}
      onPick={session.pick}
      onAction={session.act}
    />
  )
}

export default function DraftPanel({
  dataset,
  operators,
  targetSize,
  ready,
}: DraftPanelProps): React.JSX.Element {
  const customEntries = useMemo(() => loadDraftRulebookEntries(), [])
  const customRulebooks = useMemo(
    () => customEntries.map((entry) => entry.document),
    [customEntries],
  )
  const importedEntries = useMemo(
    () => customEntries.filter((entry) => entry.origin === 'imported'),
    [customEntries],
  )
  const localEntries = useMemo(
    () => customEntries.filter((entry) => entry.origin === 'local'),
    [customEntries],
  )
  const rulebooks = useMemo(() => [STANDARD_DRAFT_RULEBOOK, ...customRulebooks], [customRulebooks])
  const [selectedId, setSelectedId] = useState(() => loadSelectedDraftRulebookId())
  const selected =
    rulebooks.find((rulebook) => rulebook.identifier.id === selectedId) ?? STANDARD_DRAFT_RULEBOOK

  useEffect(() => {
    if (selected.identifier.id !== selectedId) {
      setSelectedId(selected.identifier.id)
      saveSelectedDraftRulebookId(selected.identifier.id)
    }
  }, [selected.identifier.id, selectedId])

  const selectRulebook = (rulebookId: string): void => {
    if (rulebookId === selected.identifier.id) return
    setSelectedId(rulebookId)
    saveSelectedDraftRulebookId(rulebookId)
    window.dispatchEvent(new Event(DRAFT_SESSION_RESET_EVENT))
  }

  return (
    <>
      <div className="preset-toolbar">
        <label className="preset-select">
          <span>Draft Rulebook</span>
          <select
            value={selected.identifier.id}
            onChange={(event) => selectRulebook(event.target.value)}
          >
            <optgroup label="Built-in">
              <option value={STANDARD_DRAFT_RULEBOOK_ID}>
                {STANDARD_DRAFT_RULEBOOK.identifier.name}
              </option>
            </optgroup>
            {importedEntries.length > 0 && (
              <optgroup label="Imported">
                {importedEntries.map((entry) => (
                  <option key={entry.document.identifier.id} value={entry.document.identifier.id}>
                    {entry.document.identifier.name}
                  </option>
                ))}
              </optgroup>
            )}
            {localEntries.length > 0 && (
              <optgroup label="Local">
                {localEntries.map((entry) => (
                  <option key={entry.document.identifier.id} value={entry.document.identifier.id}>
                    {entry.document.identifier.name}
                  </option>
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
      <ConfiguredRulebookDraft
        key={selected.identifier.id}
        rulebook={selected}
        dataset={dataset}
        globalPool={operators}
        targetSize={targetSize}
        ready={ready}
      />
    </>
  )
}
