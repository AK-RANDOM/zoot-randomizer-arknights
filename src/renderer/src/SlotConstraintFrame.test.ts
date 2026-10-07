import { describe, expect, it } from 'vitest'
import {
  NEUTRAL_SLOT_CONSTRAINT_GRADIENT,
  slotConstraintFrameStyle,
  slotConstraintGradient,
} from './SlotConstraintFrame'

describe('slot constraint frame presentation', () => {
  it('uses a neutral gray frame when there is no rarity lock', () => {
    expect(slotConstraintGradient([])).toBe(NEUTRAL_SLOT_CONSTRAINT_GRADIENT)
    expect(slotConstraintFrameStyle([])).toMatchObject({ border: '3px solid transparent' })
  })

  it('uses a solid rarity frame for one selected rarity', () => {
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
