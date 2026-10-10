import type { Operator } from '../../shared/operator'
import OperatorCard, { type OperatorCardInteractionDetails } from './OperatorCard'
import type {
  DraftEconomyValuePresentation,
  DraftOperatorPresentation,
} from './draftPresentation'

interface DraftOperatorCardProps {
  operator: Operator
  presentation: DraftOperatorPresentation
  interactionDetails?: OperatorCardInteractionDetails
  currentUpkeep?: DraftEconomyValuePresentation | null
  showHold?: boolean
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

function upkeepLabel(upkeep: DraftEconomyValuePresentation): string {
  if (upkeep.tone === 'rebate') return `${upkeep.amount} point Hold upkeep rebate`
  if (upkeep.tone === 'neutral') return 'No Hold upkeep this round'
  return `${upkeep.amount} point Hold upkeep this round`
}

export default function DraftOperatorCard({
  operator,
  presentation,
  interactionDetails,
  currentUpkeep = null,
  showHold = true,
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
        presentation.price || currentUpkeep ? (
          <span className="draft-operator-economy-cluster">
            {currentUpkeep && (
              <span
                className={`draft-hold-upkeep draft-hold-upkeep--${currentUpkeep.tone}`}
                aria-label={upkeepLabel(currentUpkeep)}
                title={upkeepLabel(currentUpkeep)}
              >
                <span aria-hidden="true">↻</span>
                {currentUpkeep.amount}
              </span>
            )}
            {presentation.price && (
              <span
                className={`draft-operator-price draft-operator-price--${presentation.price.tone}`}
                aria-label={priceAriaLabel ?? undefined}
                title={priceAriaLabel ?? undefined}
              >
                {presentation.price.amount}
              </span>
            )}
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
          {showHold && presentation.hold && onHold && (
            <button
              type="button"
              className={`draft-operator-action draft-operator-action--hold draft-operator-action--hold-${presentation.hold.economy.tone}`}
              disabled={!presentation.hold.available}
              title={presentation.hold.blockReasonLabel ?? undefined}
              onClick={onHold}
            >
              Hold ({presentation.hold.economy.amount})
            </button>
          )}
        </div>
      }
    />
  )
}
