import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from '../../shared/constraints'
import { singleRerollReason } from './chainRerollReason'

describe('single reroll reason', () => {
  it('names the 5-star Vanguard requirement when Vanguards of other rarities remain', () => {
    const constraints = createDefaultConstraints()
    constraints.class.Vanguard = { min: 1, max: 12 }
    const otherMembers = [{ class: 'Defender', rarity: 6 }] as const
    const remainingPool = [
      { class: 'Vanguard', rarity: 6 },
      { class: 'Vanguard', rarity: 3 },
      { class: 'Guard', rarity: 5 },
    ] as const

    const slotCandidates = remainingPool.filter(({ rarity }) => rarity === 5)
    expect(singleRerollReason(slotCandidates, otherMembers, constraints, [5])).toBe(
      'No 5★ Vanguard left',
    )

    constraints.rarity[5] = { min: 1, max: 1 }
    expect(singleRerollReason(remainingPool, otherMembers, constraints, [])).toBe(
      'No 5★ Vanguard left',
    )
  })

  it('does not claim a rarity or class is missing when a candidate meets both', () => {
    const constraints = createDefaultConstraints()
    constraints.class.Vanguard = { min: 1, max: 12 }
    expect(singleRerollReason([{ class: 'Vanguard', rarity: 5 }], [], constraints, [5])).toBe(
      'No replacement fits squad rules',
    )
  })
})
