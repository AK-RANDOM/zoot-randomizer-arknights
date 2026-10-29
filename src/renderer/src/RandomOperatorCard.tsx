import type { CSSProperties } from 'react'
import type { OperatorRarity } from '../../shared/operator'
import type { SlotConstraint } from '../../shared/constraints'
import './RandomOperatorCard.css'

function raritySetSummary(rarities: readonly OperatorRarity[]): string {
  return [...rarities]
    .sort((left, right) => left - right)
    .map((rarity) => `${rarity}★`)
    .join(' / ')
}

function rarityGradient(rarities: readonly OperatorRarity[]): string | null {
  if (rarities.length === 0) return null
  const sorted = [...new Set(rarities)].sort((left, right) => right - left)
  const colors = sorted.map((rarity) => `var(--rarity-${rarity})`)
  return colors.length === 1
    ? `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`
    : `linear-gradient(135deg, ${colors.join(', ')})`
}

function constrainedCardStyle(rarities: readonly OperatorRarity[]): CSSProperties | undefined {
  const gradient = rarityGradient(rarities)
  if (!gradient) return undefined
  return {
    '--slot-constraint-gradient': gradient,
    border: '3px solid transparent',
    background: `linear-gradient(#111113, #111113) padding-box, ${gradient} border-box`,
  } as CSSProperties
}

export function buildOverlappedRarityStars(rarities: readonly OperatorRarity[]): OperatorRarity[] {
  const sorted = [...new Set(rarities)].sort((left, right) => left - right)
  const maximum = sorted.at(-1)
  if (!maximum) return []

  return Array.from({ length: maximum }, (_, index) => {
    const position = index + 1
    return sorted.find((rarity) => rarity >= position) ?? maximum
  })
}

function RandomOperatorCardContent({
  rarities,
}: {
  rarities: readonly OperatorRarity[]
}): React.JSX.Element {
  const stars = buildOverlappedRarityStars(rarities)
  return (
    <>
      <div className="random-operator-card__art" aria-hidden="true" />
      <div className="operator-card__caption random-operator-card__caption">
        {stars.length > 0 && (
          <span
            className="operator-card__rarity random-operator-card__rarity"
            aria-label={`Allowed rarities: ${raritySetSummary(rarities)}`}
          >
            {stars.map((rarity, index) => (
              <span
                key={`${index}:${rarity}`}
                className="random-operator-card__star"
                style={{ color: `var(--rarity-${rarity})` }}
              >
                ★
              </span>
            ))}
          </span>
        )}
        <div className="operator-card__name-viewport">
          <strong>
            <span className="operator-card__name-text">Random Operator</span>
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
        <RandomOperatorCardContent rarities={constraint.rarities} />
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
      <RandomOperatorCardContent rarities={constraint.rarities} />
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
