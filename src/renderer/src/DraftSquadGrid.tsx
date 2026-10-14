import { useMemo } from 'react'
import type { DraftAction, DraftState, ResolvedDraftConfiguration } from '../../shared/draft'
import type { Operator } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import { FactionIcon } from './FilterAssetIcon'
import { useOperatorAppearanceImage } from './operatorAppearance'
import {
  resolveDraftActionPresentation,
  resolveDraftSquadPresentation,
  type DraftActionPresentation,
} from './draftPresentation'
import './DraftSquadGrid.css'

const openSlotIconUrl = new URL('./assets/draft/open-slot-icon.png', import.meta.url).href
const overflowSlotIconUrl = new URL('./assets/draft/overflow-slot-icon.png', import.meta.url).href
const lockedSlotIconUrl = new URL('./assets/draft/locked-slot-icon.png', import.meta.url).href

interface DraftSquadGridProps {
  state: DraftState
  operators: readonly Operator[]
  configuration: ResolvedDraftConfiguration
  onAction: (action: DraftAction) => void
}

function DraftEmptySlotFrame({
  slotNumber,
  variant,
}: {
  slotNumber: number
  variant: 'valid' | 'expandable' | 'invalid'
}): React.JSX.Element {
  const title = variant === 'valid' ? 'Open' : variant === 'expandable' ? 'Locked' : 'Unavailable'
  const iconUrl = variant === 'valid' ? openSlotIconUrl : lockedSlotIconUrl

  return (
    <div className={`draft-squad-slot__frame draft-squad-slot__frame--${variant}`}>
      <span className="draft-squad-slot__number">{slotNumber}</span>
      <img
        className="draft-squad-slot__icon"
        src={iconUrl}
        alt=""
        aria-hidden="true"
        onError={(event) => {
          if (variant === 'valid' && event.currentTarget.src !== overflowSlotIconUrl) {
            event.currentTarget.src = overflowSlotIconUrl
          }
        }}
      />
      <strong>{title}</strong>
    </div>
  )
}

function EmptyOverflowFrame(): React.JSX.Element {
  return (
    <div className="draft-squad-overflow__empty">
      <img
        className="draft-squad-overflow__icon"
        src={overflowSlotIconUrl}
        alt=""
        aria-hidden="true"
      />
      <strong>Overflow</strong>
    </div>
  )
}

function DraftRosterAvatar({
  operator,
  overflow = false,
}: {
  operator: Operator
  overflow?: boolean
}): React.JSX.Element {
  const { imageUrl } = useOperatorAppearanceImage(operator)

  return (
    <div
      className={`draft-squad-avatar${overflow ? ' draft-squad-avatar--overflow' : ''}`}
      data-rarity={operator.rarity}
      title={operator.name}
      aria-label={overflow ? `${operator.name} in Overflow` : operator.name}
    >
      {operator.faction.main && (
        <FactionIcon id={operator.faction.main} className="draft-squad-avatar__faction-logo" />
      )}
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span className="draft-squad-avatar__fallback" aria-hidden="true">
          {operator.name.slice(0, 1)}
        </span>
      )}
      <span className="draft-squad-avatar__identity">
        <ClassIcon operatorClass={operator.class} className="draft-squad-avatar__class-icon" />
        <span className="draft-squad-avatar__name">{operator.name}</span>
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
      aria-label={`Expand capacity, ${economyLabel}`}
      onClick={onExpand}
    >
      <span
        className={`draft-operator-price draft-operator-price--${presentation.economy.tone} draft-squad-expand__price`}
        aria-label={economyLabel}
        title={economyLabel}
      >
        {presentation.economy.amount}
      </span>
      <span className="draft-squad-expand__icon" aria-hidden="true">
        +
      </span>
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
  const finalized = state.status === 'complete'

  return (
    <section className="draft-selected-squad" aria-labelledby="draft-selected-squad-heading">
      <div className="draft-roster-heading">
        <div>
          <strong id="draft-selected-squad-heading">
            {finalized ? 'Finalized Draft' : 'Current Draft'}
          </strong>
          {!finalized && (
            <span className="draft-roster-heading__capacity">
              {squad.permanentCapacity} permanent / {squad.maximum} max
            </span>
          )}
        </div>
      </div>

      <div
        className={`draft-squad-layout${showContextualColumn ? ' draft-squad-layout--with-capacity' : ''}`}
      >
        <div className="draft-squad-grid" aria-label="Selected squad slots">
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
                  <DraftEmptySlotFrame slotNumber={slot.slotNumber} variant={slot.state} />
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
                {overflowOperator ? (
                  <>
                    <span className="draft-squad-capacity-label">Overflow</span>
                    <DraftRosterAvatar operator={overflowOperator} overflow />
                  </>
                ) : (
                  <EmptyOverflowFrame />
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
