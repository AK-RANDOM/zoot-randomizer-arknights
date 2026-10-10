import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { DraftAction, DraftState, ResolvedDraftConfiguration } from '../../shared/draft'
import type { Operator } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import {
  resolveDraftActionPresentation,
  resolveDraftSquadPresentation,
  type DraftActionPresentation,
} from './draftPresentation'
import './DraftSquadGrid.css'

interface DraftSquadGridProps {
  state: DraftState
  operators: readonly Operator[]
  configuration: ResolvedDraftConfiguration
  onAction: (action: DraftAction) => void
}

function DraftRosterAvatar({
  operator,
  overflow = false,
}: {
  operator: Operator
  overflow?: boolean
}): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop
      .getOperatorImage(operator.id)
      .then((avatarUrl) => {
        if (active) setImageUrl(avatarUrl)
      })
      .catch(() => {
        if (active) setImageUrl(null)
      })
    return () => {
      active = false
    }
  }, [operator.id])

  return (
    <div
      className={`draft-squad-avatar${overflow ? ' draft-squad-avatar--overflow' : ''}`}
      data-rarity={operator.rarity}
      title={operator.name}
      aria-label={overflow ? `${operator.name} in Overflow` : operator.name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span className="draft-squad-avatar__fallback" aria-hidden="true">
          {operator.name.slice(0, 1)}
        </span>
      )}
      <span className="draft-squad-avatar__identity">
        <ClassIcon operatorClass={operator.class} />
        <strong>{operator.name}</strong>
      </span>
      <span className="draft-squad-avatar__rarity" aria-label={`${operator.rarity} star`}>
        {'★'.repeat(operator.rarity)}
      </span>
    </div>
  )
}

function ExpandControl({
  presentation,
  onExpand,
}: {
  presentation: DraftActionPresentation
  onExpand: () => void
}): React.JSX.Element {
  const economyLabel =
    presentation.economy.pointDelta === 0
      ? 'Free'
      : presentation.economy.pointDelta > 0
        ? `+${presentation.economy.amount} pts`
        : `${presentation.economy.amount} pts`

  return (
    <button
      type="button"
      className="draft-squad-expand"
      disabled={!presentation.available}
      title={presentation.blockReasonLabel ?? undefined}
      onClick={onExpand}
    >
      <span className="draft-squad-expand__icon" aria-hidden="true">
        +
      </span>
      <strong>Expand</strong>
      <span>{economyLabel}</span>
    </button>
  )
}

export default function DraftSquadGrid({
  state,
  operators,
  configuration,
  onAction,
}: DraftSquadGridProps): React.JSX.Element {
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )
  const squad = resolveDraftSquadPresentation(state)
  const overflowOperator = squad.overflowOperatorId
    ? (operatorById.get(squad.overflowOperatorId) ?? null)
    : null
  const canShowExpand =
    state.capacityRulesEnabled &&
    squad.permanentCapacity < squad.maximum &&
    configuration.actionRules.slotExpansion.enabled
  const expand = canShowExpand
    ? resolveDraftActionPresentation(state, operators, { type: 'slot-expansion' }, configuration)
    : null
  const showContextualColumn = squad.overflowVisible || expand !== null

  return (
    <section className="draft-selected-squad" aria-labelledby="draft-selected-squad-heading">
      <div className="draft-roster-heading">
        <div>
          <strong id="draft-selected-squad-heading">Selected Squad</strong>
        </div>
        <span>
          {squad.permanentCapacity} permanent / {squad.maximum} max
        </span>
      </div>

      <div
        className={`draft-squad-layout${showContextualColumn ? ' draft-squad-layout--with-capacity' : ''}`}
      >
        <div
          className="draft-squad-grid"
          aria-label="Selected squad slots"
          style={
            {
              '--draft-squad-columns': Math.max(1, Math.min(6, Math.ceil(squad.slots.length / 2))),
            } as CSSProperties
          }
        >
          {squad.slots.map((slot) => {
            const operator = slot.operatorId ? (operatorById.get(slot.operatorId) ?? null) : null
            return (
              <div
                className={`draft-squad-slot draft-squad-slot--${slot.state}`}
                key={slot.slotNumber}
                aria-label={`Squad slot ${slot.slotNumber}: ${
                  operator
                    ? operator.name
                    : slot.state === 'valid'
                      ? 'open'
                      : slot.state === 'expandable'
                        ? 'expandable'
                        : 'unavailable'
                }`}
              >
                {operator ? (
                  <DraftRosterAvatar operator={operator} />
                ) : (
                  <div className={`draft-squad-slot__frame draft-squad-slot__frame--${slot.state}`}>
                    <span className="draft-squad-slot__number">{slot.slotNumber}</span>
                    <strong>
                      {slot.state === 'valid'
                        ? 'Open'
                        : slot.state === 'expandable'
                          ? 'Locked'
                          : 'Unavailable'}
                    </strong>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {showContextualColumn && (
          <div className="draft-squad-capacity-column" aria-label="Overflow and capacity controls">
            {squad.overflowVisible && (
              <div
                className={`draft-squad-overflow${overflowOperator ? ' is-occupied' : ''}`}
                aria-label={
                  overflowOperator ? `Overflow: ${overflowOperator.name}` : 'Overflow: empty'
                }
              >
                <span className="draft-squad-capacity-label">Overflow</span>
                {overflowOperator ? (
                  <DraftRosterAvatar operator={overflowOperator} overflow />
                ) : (
                  <div className="draft-squad-overflow__empty">
                    <strong>Empty</strong>
                    <span>Temporary slot</span>
                  </div>
                )}
              </div>
            )}

            {expand && (
              <ExpandControl presentation={expand} onExpand={() => onAction(expand.action)} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
