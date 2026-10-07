import type { CSSProperties } from 'react'
import type { OperatorRarity } from '../../shared/operator'

export const NEUTRAL_SLOT_CONSTRAINT_GRADIENT =
  'linear-gradient(135deg, #66666e, #66666e)'

export function slotConstraintGradient(rarities: readonly OperatorRarity[]): string {
  if (rarities.length === 0) return NEUTRAL_SLOT_CONSTRAINT_GRADIENT
  const sorted = [...new Set(rarities)].sort((left, right) => right - left)
  const colors = sorted.map((rarity) => `var(--rarity-${rarity})`)
  return colors.length === 1
    ? `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`
    : `linear-gradient(135deg, ${colors.join(', ')})`
}

export function slotConstraintGradientStyle(
  rarities: readonly OperatorRarity[],
): CSSProperties {
  return {
    '--slot-constraint-gradient': slotConstraintGradient(rarities),
  } as CSSProperties
}

export function slotConstraintFrameStyle(
  rarities: readonly OperatorRarity[],
  innerBackground = '#17140e',
): CSSProperties {
  const gradient = slotConstraintGradient(rarities)
  return {
    '--slot-constraint-gradient': gradient,
    border: '3px solid transparent',
    background: `linear-gradient(${innerBackground}, ${innerBackground}) padding-box, ${gradient} border-box`,
  } as CSSProperties
}
