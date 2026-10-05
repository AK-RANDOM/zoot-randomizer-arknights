import { useMemo } from 'react'
import type { DraftState } from '../../shared/draft'
import type { Operator } from '../../shared/operator'
import OperatorCard from './OperatorCard'
import { draftCompletionMessage } from './draftSessionMessages'

interface DraftPanelProps {
  state: DraftState | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  distributionLabel: string
  onStart: () => void
  onPick: (operatorId: string) => void
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

  return (
    <section className="panel draft-panel" aria-labelledby="draft-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GET SQUAD • DRAFTS</p>
          <h2 id="draft-heading">Pick 1 of 3</h2>
        </div>
        <div className="section-actions">
          <button
            className="randomize-button"
            type="button"
            disabled={!ready || operators.length < 3}
            onClick={onStart}
          >
            {state ? 'New Draft' : 'Start Draft'}
          </button>
        </div>
      </div>

      <div className="draft-summary">
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

      {state && (
        <p className="draft-session-note">
          This Draft is tied to its starting pool and target size. Changing either resets the
          session.
        </p>
      )}

      {!state ? (
        <div className="draft-empty-state">
          <strong>
            {!ready
              ? 'Loading operator data…'
              : operators.length >= 3
                ? 'Ready to draft'
                : 'Not enough eligible operators'}
          </strong>
          <p>
            {!ready
              ? 'Draft will be available after the operator dataset finishes loading.'
              : operators.length >= 3
                ? [
                    'Drafts use the current eligible Global Pool and the configured squad size.',
                    'Each round offers exactly three distinct operators; pick one to keep permanently.',
                  ].join(' ')
                : [
                    'A Draft offer requires three distinct eligible operators.',
                    'Adjust the current pool or eligibility filters before starting.',
                  ].join(' ')}
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
