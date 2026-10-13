import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  evaluateDraftActionPreflight,
  type DraftAction,
  type DraftState,
  type ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftDecisionPlane from './DraftDecisionPlane'
import DraftConfirmationDialog from './DraftConfirmationDialog'
import OperatorCard from './OperatorCard'
import DraftSquadGrid from './DraftSquadGrid'
import { resolveDraftStatusPresentation } from './draftPresentation'
import { buildDraftHistoryRounds, draftHistoryActionLabel } from './draftHistoryPresentation'
import { draftConfirmationCopy, type DraftConfirmationIntent } from './draftConfirmation'
import { useDraftActionConfirmationPreference } from './draftConfirmationPreferences'

function DraftHistoryOperatorIcon({ operator }: { operator: Operator }): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop
      .getOperatorImage(operator.id)
      .then((url) => {
        if (active) setImageUrl(url)
      })
      .catch(() => {
        if (active) setImageUrl(null)
      })
    return () => {
      active = false
    }
  }, [operator.id])

  return (
    <span
      className="release-representative draft-history__operator-icon"
      data-rarity={operator.rarity}
      title={`${operator.name} — ${operator.rarity}★`}
      aria-label={`${operator.name}, ${operator.rarity} star`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span aria-hidden="true">{operator.name.slice(0, 1)}</span>
      )}
    </span>
  )
}

function DraftHistoryTable({
  state,
  operatorById,
}: {
  state: DraftState
  operatorById: ReadonlyMap<string, Operator>
}): React.JSX.Element {
  const rounds = buildDraftHistoryRounds(state.history)

  return (
    <section className="draft-history" aria-labelledby="draft-history-heading">
      <div className="draft-history__heading">
        <div>
          <span className="eyebrow">Completed Run</span>
          <strong id="draft-history-heading">Draft History</strong>
        </div>
        <span>{rounds.length} rounds</span>
      </div>
      <div className="draft-history__table-shell">
        <table className="draft-history__table">
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Offers</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={3} className="draft-history__empty">
                  No draft events were recorded.
                </td>
              </tr>
            ) : (
              rounds.map((round) => (
                <tr key={round.roundNumber}>
                  <th scope="row">{round.roundNumber}</th>
                  <td>
                    <div className="draft-history__stack">
                      {round.offers.map((offer, offerIndex) => (
                        <div
                          className="draft-history__entry"
                          key={`${round.roundNumber}-offer-${offerIndex}`}
                        >
                          <strong>
                            Offer {offerIndex + 1}
                            {offer.source === 'reroll' ? ' · Reroll' : ''}
                          </strong>
                          <div className="draft-history__operator-list">
                            {offer.operatorIds.map((operatorId) => {
                              const operator = operatorById.get(operatorId)
                              return operator ? (
                                <DraftHistoryOperatorIcon key={operatorId} operator={operator} />
                              ) : (
                                <span className="draft-history__missing-operator" key={operatorId}>
                                  {operatorId}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="draft-history__stack">
                      {round.actions.length === 0 ? (
                        <span className="draft-history__muted">
                          Finalized without a round action
                        </span>
                      ) : (
                        round.actions.map((action, actionIndex) => {
                          const operator = action.operatorId
                            ? (operatorById.get(action.operatorId) ?? null)
                            : null
                          return (
                            <div
                              className="draft-history__entry draft-history__entry--action"
                              key={`${round.roundNumber}-action-${actionIndex}`}
                            >
                              <strong>{draftHistoryActionLabel(action.action)}</strong>
                              {operator ? (
                                <DraftHistoryOperatorIcon operator={operator} />
                              ) : (
                                action.operatorId && (
                                  <span className="draft-history__missing-operator">
                                    {action.operatorId}
                                  </span>
                                )
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

interface PendingDraftConfirmation {
  intent: DraftConfirmationIntent
  execute: () => void
  mandatory: boolean
}

export interface DraftSessionViewProps {
  state: DraftState | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  rulebook: DraftRulebook
  dataset?: OperatorDataset
  configuration?: ResolvedDraftConfiguration
  validationErrors?: readonly string[]
  statusError?: string | null
  onStart: () => void
  onPick: (operatorId: string) => void
  onAction?: (action: DraftAction) => void
  onFinalize?: () => void
  rulebookControl?: ReactNode
}
export default function DraftSessionView({
  state,
  operators,
  targetSize,
  ready,
  rulebook,
  dataset,
  configuration,
  validationErrors = [],
  statusError,
  onStart,
  onPick,
  onAction,
  onFinalize,
  rulebookControl,
}: DraftSessionViewProps): React.JSX.Element {
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )
  const canStart =
    ready && validationErrors.length === 0 && operators.length >= rulebook.generalRules.offerSize
  const status = resolveDraftStatusPresentation(state, targetSize)
  const draftOngoing = state?.status === 'active'
  const confirmationsEnabled = useDraftActionConfirmationPreference()
  const [sessionConfirmationsSuppressed, setSessionConfirmationsSuppressed] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingDraftConfirmation | null>(
    null,
  )
  const [suppressPendingSession, setSuppressPendingSession] = useState(false)

  const requestAction = (action: DraftAction, execute: () => void): void => {
    const preflight =
      state && configuration
        ? evaluateDraftActionPreflight(state, operators, action, { configuration })
        : null
    const mandatory = preflight?.terminalAfterAction === true
    if (!mandatory && (!confirmationsEnabled || sessionConfirmationsSuppressed)) {
      execute()
      return
    }
    const operatorName =
      action.type === 'pick' || action.type === 'hold'
        ? operatorById.get(action.operatorId)?.name
        : undefined
    setSuppressPendingSession(false)
    setPendingConfirmation({
      intent: { type: 'draft-action', action, operatorName, terminalAfterAction: mandatory },
      execute,
      mandatory,
    })
  }

  const requestPick = (operatorId: string): void => {
    requestAction({ type: 'pick', operatorId }, () => onPick(operatorId))
  }

  const requestEngineAction = (action: DraftAction): void => {
    if (!onAction) return
    requestAction(action, () => onAction(action))
  }

  const requestStart = (): void => {
    if (!state) {
      setSessionConfirmationsSuppressed(false)
      onStart()
      return
    }
    if (!confirmationsEnabled || sessionConfirmationsSuppressed) {
      setSessionConfirmationsSuppressed(false)
      onStart()
      return
    }
    setSuppressPendingSession(false)
    setPendingConfirmation({ intent: { type: 'new-draft' }, execute: onStart, mandatory: false })
  }

  const requestFinalize = (): void => {
    if (!onFinalize || !draftOngoing) return
    if (!confirmationsEnabled || sessionConfirmationsSuppressed) {
      onFinalize()
      return
    }
    setSuppressPendingSession(false)
    setPendingConfirmation({
      intent: { type: 'finalize-draft' },
      execute: onFinalize,
      mandatory: false,
    })
  }

  const cancelPendingConfirmation = (): void => {
    setPendingConfirmation(null)
    setSuppressPendingSession(false)
  }

  const confirmPendingAction = (): void => {
    if (!pendingConfirmation) return
    const { intent, execute, mandatory } = pendingConfirmation
    setPendingConfirmation(null)
    if (!mandatory && intent.type === 'new-draft') {
      setSessionConfirmationsSuppressed(suppressPendingSession)
    } else if (!mandatory && suppressPendingSession) {
      setSessionConfirmationsSuppressed(true)
    }
    setSuppressPendingSession(false)
    execute()
  }

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="draft-status-shell">
        <div className="draft-status-main">
          <div className="draft-status-rulebook">
            <span id="draft-heading">Draft Rulebook</span>
            {rulebookControl ?? <strong>{rulebook.identifier.name}</strong>}
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
          disabled={draftOngoing ? !onFinalize : !canStart}
          onClick={draftOngoing ? requestFinalize : requestStart}
        >
          {draftOngoing ? 'Finalize' : 'Start Draft'}
        </button>
      </div>
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
      {!state ? (
        <div className="draft-empty-state">
          <strong>
            {!ready
              ? 'Loading Draft Rulebook data…'
              : validationErrors.length > 0
                ? 'Rulebook needs attention'
                : operators.length >= rulebook.generalRules.offerSize
                  ? 'Ready to draft'
                  : 'Not enough eligible operators'}
          </strong>
          <p>
            {!ready
              ? 'Draft will be available after the operator dataset finishes loading.'
              : validationErrors.length > 0
                ? 'Fix the Rulebook in Setup → Draft Rulebooks before starting this draft.'
                : operators.length >= rulebook.generalRules.offerSize
                  ? 'The selected Draft Rulebook controls the effective pool, economy, actions, and pull distribution.'
                  : `A Draft offer requires ${rulebook.generalRules.offerSize} distinct eligible operators. Adjust the Rulebook or Global Pool before starting.`}
          </p>
        </div>
      ) : state.status === 'complete' ? null : configuration && onAction ? (
        <DraftDecisionPlane
          state={state}
          operators={operators}
          rulebook={rulebook}
          configuration={configuration}
          dataset={dataset}
          onPick={requestPick}
          onAction={requestEngineAction}
        />
      ) : (
        <div className="draft-offer-grid">
          {state.currentOfferIds.map((operatorId) => {
            const operator = operatorById.get(operatorId)
            if (!operator) return null
            return (
              <article className="draft-candidate-card" key={operator.id}>
                <OperatorCard operator={operator} />
                <button
                  type="button"
                  className="draft-candidate__action"
                  onClick={() => requestPick(operator.id)}
                >
                  Draft {operator.name}
                </button>
              </article>
            )
          })}
        </div>
      )}
      {state && configuration && onAction && (
        <DraftSquadGrid
          state={state}
          operators={operators}
          configuration={configuration}
          onAction={requestEngineAction}
        />
      )}
      {state?.status === 'complete' && (
        <DraftHistoryTable state={state} operatorById={operatorById} />
      )}
      {pendingConfirmation && (
        <DraftConfirmationDialog
          copy={draftConfirmationCopy(pendingConfirmation.intent)}
          suppressSession={suppressPendingSession}
          onSuppressSessionChange={setSuppressPendingSession}
          allowSuppression={!pendingConfirmation.mandatory}
          onCancel={cancelPendingConfirmation}
          onConfirm={confirmPendingAction}
        />
      )}
    </section>
  )
}
