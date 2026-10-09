import { useMemo } from 'react'
import type {
  DraftAction,
  DraftState,
  ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftDecisionPlane from './DraftDecisionPlane'
import OperatorCard from './OperatorCard'
import DraftSquadGrid from './DraftSquadGrid'
import { resolveDraftStatusPresentation } from './draftPresentation'
import { draftCompletionMessage } from './draftSessionMessages'

export interface DraftSessionViewProps {
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

export default function DraftSessionView({
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
  const canStart = ready && validationErrors.length === 0 && operators.length >= 3
  const status = resolveDraftStatusPresentation(state, targetSize)

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
      ) : configuration && onAction ? (
        <DraftDecisionPlane
          state={state}
          operators={operators}
          rulebook={rulebook}
          configuration={configuration}
          dataset={dataset}
          onPick={onPick}
          onAction={onAction}
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
                  onClick={() => onPick(operator.id)}
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
          onAction={onAction}
        />
      )}
    </section>
  )
}
