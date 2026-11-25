import { describe, expect, it } from 'vitest'
import { NEUTRAL_SLOT_CONSTRAINT_GRADIENT, slotConstraintGradient } from './SlotConstraintFrame'

describe('slot constraint strip presentation', () => {
  it('uses a neutral gray strip when there is no rarity lock', () => {
    expect(slotConstraintGradient([])).toBe(NEUTRAL_SLOT_CONSTRAINT_GRADIENT)
  })

  it('uses a solid rarity strip for one selected rarity', () => {
    expect(slotConstraintGradient([5])).toBe(
      'linear-gradient(135deg, var(--rarity-5), var(--rarity-5))',
    )
  })

  it('orders a multi-rarity gradient from highest rarity to lowest rarity', () => {
    expect(slotConstraintGradient([2, 6, 4])).toBe(
      'linear-gradient(135deg, var(--rarity-6), var(--rarity-4), var(--rarity-2))',
    )
  })
})
