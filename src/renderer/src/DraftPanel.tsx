import { useEffect, useMemo, useState } from 'react'
import {
  currentDraftOwnershipCapacity,
  evaluateDraftAction,
  getDraftActionPointDelta,
  type DraftAction,
  type DraftActionBlockReason,
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
import {
  buildLiveDraftInteractionBreakdown,
  buildLiveRulebookOperatorInteractionDetails,
  buildRulebookOperatorInteractionDetails,
} from './draftInteractionPresentation'
import { draftCompletionMessage } from './draftSessionMessages'
import { loadDraftRulebookLibrary } from './draftRulebookStorage'
import useDraftSession, { DRAFT_SESSION_RESET_EVENT } from './useDraftSession'

const SELECTED_RULEBOOK_KEY = 'arknights-randomizer:selected-draft-rulebook:v1'

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

const actionReasonLabels: Record<DraftActionBlockReason, string> = {
  'draft-complete': 'Draft is complete.',
  'action-disabled': 'This action is disabled by the Draft Rulebook.',
  'invalid-offer-selection': 'This operator is not available for that action.',
  'hold-slot-occupied': 'The Hold slot is already occupied.',
  'hold-slot-empty': 'The Hold slot is empty.',
  'per-round-limit': 'The per-round action limit has been reached.',
  'per-draft-limit': 'The per-draft action limit has been reached.',
  cooldown: 'This action is still on cooldown.',
  'capacity-full': 'Owned capacity is full.',
  'capacity-maxed': 'Active capacity is already at its maximum.',
  'capacity-forfeit-unavailable': 'No unused capacity remains to forfeit.',
  'insufficient-points': 'Not enough points.',
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

function pointDeltaLabel(delta: number): string {
  if (delta === 0) return 'Free'
  return delta > 0 ? `+${delta} pts` : `${Math.abs(delta)} pts`
}

function signedModifier(value: number): string {
  return value > 0 ? `+${value}` : String(value)
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
  const heldOperator = state?.heldOperatorId ? operatorById.get(state.heldOperatorId) ?? null : null
  const rosterSlots = Array.from({ length: targetSize }, (_, index) => draftedOperators[index] ?? null)
  const canStart = ready && validationErrors.length === 0 && operators.length >= 3
  const advanced = state !== null && configuration !== undefined && onAction !== undefined

  const availability = (action: DraftAction): { available: boolean; title?: string } => {
    if (!state || !configuration) return { available: false }
    const result = evaluateDraftAction(state, operators, action, { configuration })
    return {
      available: result.available,
      title: result.reason ? actionReasonLabels[result.reason] : undefined,
    }
  }

  const actionDelta = (action: DraftAction): number => {
    if (!configuration) return 0
    return getDraftActionPointDelta(
      operators,
      action,
      { configuration },
      state ?? undefined,
    )
  }

  const reroll = advanced ? availability({ type: 'reroll' }) : { available: false }
  const forfeit = advanced ? availability({ type: 'forfeit' }) : { available: false }
  const slotExpansion = advanced ? availability({ type: 'slot-expansion' }) : { available: false }
  const releaseHold = advanced ? availability({ type: 'release-hold' }) : { available: false }
  const heldPick = advanced && heldOperator
    ? availability({ type: 'pick', operatorId: heldOperator.id })
    : { available: false }

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GET SQUAD • DRAFTS</p>
          <h2 id="draft-heading">{rulebook.identifier.name}</h2>
          {rulebook.identifier.description && <p className="filter-note">{rulebook.identifier.description}</p>}
        </div>
        <div className="section-actions">
          <button className="randomize-button" type="button" disabled={!canStart} onClick={onStart}>{state ? 'New Draft' : 'Start Draft'}</button>
        </div>
      </div>

      <div className="draft-summary">
        <div><span>Rulebook revision</span><strong>{rulebook.identifier.revision}</strong></div>
        <div><span>Pool source</span><strong>{poolSourceLabel}</strong></div>
        <div><span>Draft target</span><strong>{targetSize}</strong></div>
        <div><span>Eligible pool</span><strong>{operators.length}</strong></div>
        <div><span>Progress</span><strong>{state ? `${state.draftedOperatorIds.length} / ${state.targetSize}` : `0 / ${targetSize}`}</strong></div>
        <div><span>Distribution</span><strong>{distributionLabel}</strong></div>
        {state?.economyRulesEnabled && <div><span>Points</span><strong>{state.points}</strong></div>}
        {state?.capacityRulesEnabled && <div><span>Owned capacity</span><strong>{currentDraftOwnershipCapacity(state)}</strong></div>}
        {state?.capacityRulesEnabled && <div><span>Active + overflow</span><strong>{state.activeCapacity} + {state.overflowCapacity}</strong></div>}
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-box" role="alert">
          <strong>This Draft Rulebook cannot be executed.</strong>
          <ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
      {statusError && <div className="validation-box" role="alert"><strong>{statusError}</strong></div>}
      {statusMessage && !statusError && <p className="draft-session-note">{statusMessage}</p>}
      {state && <p className="draft-session-note">This Draft is tied to its starting pool, target size, and Draft Rulebook. Changing any of them resets the session.</p>}

      {!state ? (
        <div className="draft-empty-state">
          <strong>{!ready ? 'Loading Draft Rulebook data…' : validationErrors.length > 0 ? 'Rulebook needs attention' : operators.length >= 3 ? 'Ready to draft' : 'Not enough eligible operators'}</strong>
          <p>{!ready ? 'Draft will be available after the operator dataset finishes loading.' : validationErrors.length > 0 ? 'Fix the Rulebook in Setup → Draft Rulebooks before starting this draft.' : operators.length >= 3 ? 'The selected Draft Rulebook controls the effective pool, economy, actions, and pull distribution.' : 'A Draft offer requires three distinct eligible operators. Adjust the Rulebook or Global Pool before starting.'}</p>
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
              <button type="button" className="secondary-button" disabled={!reroll.available} title={reroll.title} onClick={() => onAction?.({ type: 'reroll' })}>Reroll · {pointDeltaLabel(actionDelta({ type: 'reroll' }))}</button>
              {configuration.actionRules.forfeit.enabled && <button type="button" className="secondary-button" disabled={!forfeit.available} title={forfeit.title} onClick={() => onAction?.({ type: 'forfeit' })}>Forfeit · {pointDeltaLabel(actionDelta({ type: 'forfeit' }))}</button>}
              {configuration.actionRules.slotExpansion.enabled && <button type="button" className="secondary-button" disabled={!slotExpansion.available} title={slotExpansion.title} onClick={() => onAction?.({ type: 'slot-expansion' })}>Expand slot · {pointDeltaLabel(actionDelta({ type: 'slot-expansion' }))}</button>}
            </div>
          )}
          {advanced && configuration && !configuration.actionRules.reroll.enabled && (configuration.actionRules.forfeit.enabled || configuration.actionRules.slotExpansion.enabled) && (
            <div className="draft-action-bar" aria-label="Draft actions">
              {configuration.actionRules.forfeit.enabled && <button type="button" className="secondary-button" disabled={!forfeit.available} title={forfeit.title} onClick={() => onAction?.({ type: 'forfeit' })}>Forfeit · {pointDeltaLabel(actionDelta({ type: 'forfeit' }))}</button>}
              {configuration.actionRules.slotExpansion.enabled && <button type="button" className="secondary-button" disabled={!slotExpansion.available} title={slotExpansion.title} onClick={() => onAction?.({ type: 'slot-expansion' })}>Expand slot · {pointDeltaLabel(actionDelta({ type: 'slot-expansion' }))}</button>}
            </div>
          )}

          {advanced && configuration && (heldOperator || configuration.actionRules.hold.enabled) && (
            <div className="draft-hold-panel">
              <div><span>Hold slot</span><strong>{heldOperator?.name ?? 'Empty'}</strong></div>
              {heldOperator && (
                <div className="draft-hold-actions">
                  <button type="button" className="secondary-button" disabled={!heldPick.available} title={heldPick.title} onClick={() => onAction?.({ type: 'pick', operatorId: heldOperator.id })}>Draft held · {pointDeltaLabel(actionDelta({ type: 'pick', operatorId: heldOperator.id }))}</button>
                  <button type="button" className="secondary-button" disabled={!releaseHold.available} title={releaseHold.title} onClick={() => onAction?.({ type: 'release-hold' })}>Release hold</button>
                </div>
              )}
            </div>
          )}

          <div className="draft-round-heading">
            <div><span>Current offer</span><strong>Choose one round-resolution action</strong></div>
            <span>Round {state.roundNumber}</span>
          </div>
          <div className="draft-offer-grid">
            {offeredOperators.map((operator) => {
              const pickAction: DraftAction = { type: 'pick', operatorId: operator.id }
              const pickAvailability = advanced ? availability(pickAction) : { available: true }
              const holdAction: DraftAction = { type: 'hold', operatorId: operator.id }
              const holdAvailability = advanced ? availability(holdAction) : { available: false }
              const interactionDetails = dataset && configuration
                ? buildLiveRulebookOperatorInteractionDetails(
                    rulebook,
                    operator,
                    dataset,
                    operators,
                    state,
                    configuration,
                  )
                : undefined
              const interactionBreakdown = dataset && configuration
                ? buildLiveDraftInteractionBreakdown(
                    rulebook,
                    operator,
                    dataset,
                    state,
                    configuration,
                  )
                : undefined

              return (
                <article className="draft-candidate-card" key={operator.id}>
                  <OperatorCard operator={operator} interactionDetails={interactionDetails} />
                  {interactionBreakdown && (
                    <div className="draft-interaction-breakdown">
                      <span>Baseline <strong>{interactionBreakdown.baselineCost}</strong></span>
                      {interactionBreakdown.contributions.map((contribution) => (
                        <span key={contribution.id}>{contribution.label} <strong>{signedModifier(contribution.modifier)}</strong></span>
                      ))}
                      <span>Final <strong>{interactionBreakdown.finalCost}</strong></span>
                    </div>
                  )}
                  <div className="draft-candidate-actions">
                    <button type="button" className="draft-candidate__action" disabled={!pickAvailability.available} title={pickAvailability.title} onClick={() => onPick(operator.id)}>Draft {operator.name}{state.economyRulesEnabled && configuration ? ` · ${pointDeltaLabel(actionDelta(pickAction))}` : ''}</button>
                    {advanced && configuration?.actionRules.hold.enabled && <button type="button" className="secondary-button" disabled={!holdAvailability.available} title={holdAvailability.title} onClick={() => onAction?.(holdAction)}>Hold · {pointDeltaLabel(actionDelta(holdAction))}</button>}
                  </div>
                </article>
              )
            })}
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
              <OperatorCard
                operator={operator}
                interactionDetails={dataset
                  ? buildRulebookOperatorInteractionDetails(rulebook, operator, dataset, operators)
                  : undefined}
              />
            ) : (
              <div className="empty-slot"><span>SLOT {index + 1}</span></div>
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
    () => dataset
      ? resolveDraftRulebookExecution(rulebook, dataset.operators, globalPool)
      : null,
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
  const customRulebooks = useMemo(() => loadDraftRulebookLibrary(), [])
  const rulebooks = useMemo(
    () => [STANDARD_DRAFT_RULEBOOK, ...customRulebooks],
    [customRulebooks],
  )
  const [selectedId, setSelectedId] = useState(() => loadSelectedRulebookId())
  const selected = rulebooks.find((rulebook) => rulebook.identifier.id === selectedId) ?? STANDARD_DRAFT_RULEBOOK

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

  return (
    <>
      {selector}
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
