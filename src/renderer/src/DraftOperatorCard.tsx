import type { Operator } from '../../shared/operator'
import OperatorCard, { type OperatorCardInteractionDetails } from './OperatorCard'
import type { DraftOperatorPresentation } from './draftPresentation'

interface DraftOperatorCardProps {
  operator: Operator
  presentation: DraftOperatorPresentation
  interactionDetails?: OperatorCardInteractionDetails
  onPick: () => void
  onHold?: () => void
}

function priceLabel(presentation: DraftOperatorPresentation): string | null {
  if (!presentation.price) return null
  switch (presentation.price.tone) {
    case 'rebate':
      return `${presentation.price.amount} point rebate`
    case 'neutral':
      return '0 point cost'
    case 'cost':
      return `${presentation.price.amount} point cost`
  }
}

export default function DraftOperatorCard({
  operator,
  presentation,
  interactionDetails,
  onPick,
  onHold,
}: DraftOperatorCardProps): React.JSX.Element {
  const priceAriaLabel = priceLabel(presentation)

  return (
    <OperatorCard
      operator={operator}
      interactionDetails={interactionDetails}
      variant="draft-compact"
      topRightAdornment={
        presentation.price ? (
          <span
            className={`draft-operator-price draft-operator-price--${presentation.price.tone}`}
            aria-label={priceAriaLabel ?? undefined}
            title={priceAriaLabel ?? undefined}
          >
            {presentation.price.amount}
          </span>
        ) : undefined
      }
      overlay={
        <div className="draft-operator-actions" aria-label={`Draft actions for ${operator.name}`}>
          <button
            type="button"
            className="draft-operator-action draft-operator-action--pick"
            disabled={!presentation.pick.available}
            title={presentation.pick.blockReasonLabel ?? undefined}
            onClick={onPick}
          >
            Pick
          </button>
          {presentation.hold && onHold && (
            <button
              type="button"
              className="draft-operator-action draft-operator-action--hold"
              disabled={!presentation.hold.available}
              title={presentation.hold.blockReasonLabel ?? undefined}
              onClick={onHold}
            >
              Hold
            </button>
          )}
        </div>
      }
    />
  )
}
