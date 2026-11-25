import type { CSSProperties } from 'react'
import type { OperatorRarity } from '../../shared/operator'
import type { SlotConstraint } from '../../shared/constraints'
import './RandomOperatorCard.css'
import { slotConstraintGradient } from './SlotConstraintFrame'
import useOverflowScroll from './useOverflowScroll'

function constrainedCardStyle(rarities: readonly OperatorRarity[]): CSSProperties {
  return { '--slot-rarity-strip': slotConstraintGradient(rarities, 90) } as CSSProperties
}

function RandomOperatorCardContent(): React.JSX.Element {
  const { viewportRef, textRef } = useOverflowScroll<HTMLDivElement>('Random Operator')
  return (
    <>
      <div className="random-operator-card__art" aria-hidden="true" />
      <div className="operator-card__caption random-operator-card__caption">
        <div ref={viewportRef} className="operator-card__name-viewport">
          <strong>
            <span ref={textRef} className="operator-card__name-text">
              Random Operator
            </span>
          </strong>
        </div>
      </div>
    </>
  )
}

export default function RandomOperatorCard({
  slot,
  constraint,
  constrained,
  onModify,
  onReset,
}: {
  slot: number
  constraint: SlotConstraint
  constrained: boolean
  onModify: () => void
  onReset: () => void
}): React.JSX.Element {
  if (!constrained) {
    return (
      <button
        type="button"
        className="slot-config-card random-operator-card"
        aria-label={`Configure squad slot ${slot}`}
        onClick={onModify}
      >
        <span className="slot-config-number">{slot}</span>
        <RandomOperatorCardContent />
      </button>
    )
  }

  return (
    <div
      className="slot-config-card is-constrained standard-slot-action-card random-operator-card"
      style={constrainedCardStyle(constraint.rarities)}
      aria-label={`Squad slot ${slot} constraint`}
    >
      <span className="slot-config-number">{slot}</span>
      <RandomOperatorCardContent />
      <div className="standard-slot-actions-overlay" aria-label={`Actions for squad slot ${slot}`}>
        <div className="draft-operator-actions">
          <button
            type="button"
            className="draft-operator-action draft-operator-action--pick"
            onClick={onModify}
          >
            Modify
          </button>
          <button
            type="button"
            className="draft-operator-action draft-operator-action--hold-cost"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
