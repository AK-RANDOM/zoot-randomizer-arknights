import type { OperatorRarity } from '../../shared/operator'

export const NEUTRAL_SLOT_CONSTRAINT_GRADIENT = 'linear-gradient(135deg, #66666e, #66666e)'

export function slotConstraintGradient(rarities: readonly OperatorRarity[], angle = 135): string {
  if (rarities.length === 0) return NEUTRAL_SLOT_CONSTRAINT_GRADIENT
  const sorted = [...new Set(rarities)].sort((left, right) => right - left)
  const colors = sorted.map((rarity) => `var(--rarity-${rarity})`)
  return colors.length === 1
    ? `linear-gradient(${angle}deg, ${colors[0]}, ${colors[0]})`
    : `linear-gradient(${angle}deg, ${colors.join(', ')})`
}
