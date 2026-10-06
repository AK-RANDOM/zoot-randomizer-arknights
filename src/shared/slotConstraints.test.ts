import { describe, expect, it } from 'vitest'
import {
  createDefaultConstraints,
  createEmptySlotConstraints,
  type RandomizerConstraints,
  type SlotConstraint,
} from './constraints'
import type { Operator } from './operator'
import {
  canSlotResolveTo,
  constraintsWithSlotDraft,
  generateSquad,
  reservedMandatoryGroupsFromSlotConstraints,
  validateConstraints,
} from './randomizer'

function operator(
  id: string,
  rarity: Operator['rarity'],
  operatorClass: Operator['class'],
  extras: Partial<Operator> = {},
): Operator {
  return {
    id,
    name: id,
    rarity,
    class: operatorClass,
    subclass: { id: 'pioneer', name: 'Pioneer' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2024-01-01', yearGroup: 5 },
      global: { date: '2024-01-01', yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
    ...extras,
  }
}

function constraints(
  squadSize: number,
  configuredSlots: Record<number, SlotConstraint> = {},
): RandomizerConstraints {
  const next = createDefaultConstraints()
  next.squadSize = squadSize
  next.slots = createEmptySlotConstraints()
  for (const [rawIndex, slot] of Object.entries(configuredSlots)) {
    next.slots[Number(rawIndex)] = slot
  }
  return next
}

function seededRandom(): () => number {
  let state = 123456789
  return () => {
    state = (1103515245 * state + 12345) % 2147483648
    return state / 2147483648
  }
}

const pool: Operator[] = [
  operator('guard6', 6, 'Guard'),
  operator('caster6', 6, 'Caster'),
  operator('sniper6', 6, 'Sniper'),
  operator('guard5', 5, 'Guard'),
  operator('caster5', 5, 'Caster'),
  operator('sniper5', 5, 'Sniper'),
  operator('guard4', 4, 'Guard'),
  operator('caster4', 4, 'Caster'),
  operator('sniper4', 4, 'Sniper'),
  operator('guard3', 3, 'Guard'),
  operator('caster3', 3, 'Caster'),
  operator('sniper2', 2, 'Sniper'),
  operator('specialist1', 1, 'Specialist'),
]

describe('per-slot allowed sets', () => {
  it('treats OR within each dimension and AND between rarity and class', () => {
    const current = constraints(2, {
      0: { rarities: [4, 6], classes: ['Caster', 'Sniper'] },
      1: { rarities: [5], classes: ['Guard'] },
    })

    const squad = generateSquad(pool, current, seededRandom())
    expect([4, 6]).toContain(squad[0].rarity)
    expect(['Caster', 'Sniper']).toContain(squad[0].class)
    expect(squad[1].rarity).toBe(5)
    expect(squad[1].class).toBe('Guard')
  })

  it('does not falsely consume a class maximum for an OR slot', () => {
    const current = constraints(2, {
      0: { rarities: [], classes: ['Guard', 'Caster'] },
      1: { rarities: [], classes: ['Guard'] },
    })
    current.class.Guard = { min: 0, max: 1 }

    const result = validateConstraints(current, pool)
    expect(result.valid).toBe(true)

    const squad = generateSquad(pool, current, seededRandom())
    expect(squad[1].class).toBe('Guard')
    expect(squad.filter((item) => item.class === 'Guard')).toHaveLength(1)
  })

  it('disables a probed option only when that value cannot participate in a full squad', () => {
    const current = constraints(3, {
      0: { rarities: [6], classes: ['Guard'] },
      1: { rarities: [6], classes: [] },
    })
    current.rarity[6] = { min: 0, max: 2 }
    current.class.Guard = { min: 0, max: 1 }

    const draft: SlotConstraint = { rarities: [], classes: [] }
    expect(canSlotResolveTo(pool, current, 2, draft, { rarity: 6 })).toBe(false)
    expect(canSlotResolveTo(pool, current, 2, draft, { operatorClass: 'Guard' })).toBe(false)
    expect(canSlotResolveTo(pool, current, 2, draft, { rarity: 5 })).toBe(true)
    expect(canSlotResolveTo(pool, current, 2, draft, { operatorClass: 'Caster' })).toBe(true)
  })

  it('keeps slot order instead of shuffling constrained assignments after solving', () => {
    const current = constraints(3, {
      0: { rarities: [1], classes: ['Specialist'] },
      1: { rarities: [6], classes: ['Sniper'] },
      2: { rarities: [3], classes: ['Caster'] },
    })

    const squad = generateSquad(pool, current, seededRandom())
    expect(squad.map((item) => item.id)).toEqual(['specialist1', 'sniper6', 'caster3'])
  })

  it('supports aggregate rarity bounds alongside exact rarity bounds', () => {
    const current = constraints(4)
    current.rarity[6] = { min: 1, max: 1 }
    current.rarity[5] = { min: 1, max: 1 }
    current.rarityGroups.lte3 = { min: 2, max: 2 }

    const squad = generateSquad(pool, current, seededRandom())
    expect(squad.filter((item) => item.rarity === 6)).toHaveLength(1)
    expect(squad.filter((item) => item.rarity === 5)).toHaveLength(1)
    expect(squad.filter((item) => item.rarity <= 3)).toHaveLength(2)
  })

  it('can validate a draft slot atomically without mutating persisted slots', () => {
    const current = constraints(2)
    const draft: SlotConstraint = { rarities: [4, 6], classes: ['Caster'] }
    const next = constraintsWithSlotDraft(current, 0, draft)

    expect(current.slots[0]).toEqual({ rarities: [], classes: [] })
    expect(next.slots[0]).toEqual(draft)
    expect(validateConstraints(next, pool).valid).toBe(true)
  })

  it('locks a slot to one specific stable operator ID', () => {
    const current = constraints(2, {
      0: { rarities: [], classes: [], operatorId: 'caster5' },
    })

    const result = validateConstraints(current, pool)
    expect(result.valid).toBe(true)

    const squad = generateSquad(pool, current, seededRandom())
    expect(squad[0].id).toBe('caster5')
  })

  it('reserves a mandatory-exclusive identity while allowing any eligible form', () => {
    const forms = [
      operator('amiya-caster', 5, 'Caster', { mandatoryExclusivityGroup: 'amiya-forms' }),
      operator('amiya-guard', 5, 'Guard', { mandatoryExclusivityGroup: 'amiya-forms' }),
      operator('amiya-medic', 5, 'Medic', { mandatoryExclusivityGroup: 'amiya-forms' }),
      ...pool,
    ]
    const current = constraints(2, {
      0: { rarities: [5], classes: [], mandatoryExclusivityGroup: 'amiya-forms' },
    })

    const squad = generateSquad(forms, current, seededRandom())
    expect(squad[0].mandatoryExclusivityGroup).toBe('amiya-forms')
    expect(['amiya-caster', 'amiya-guard', 'amiya-medic']).toContain(squad[0].id)
  })

  it('rejects conflicting exact/random reservations for the same mandatory-exclusive identity', () => {
    const forms = [
      operator('amiya-caster', 5, 'Caster', { mandatoryExclusivityGroup: 'amiya-forms' }),
      operator('amiya-guard', 5, 'Guard', { mandatoryExclusivityGroup: 'amiya-forms' }),
      ...pool,
    ]
    const current = constraints(2, {
      0: { rarities: [], classes: [], mandatoryExclusivityGroup: 'amiya-forms' },
      1: { rarities: [], classes: [], operatorId: 'amiya-guard' },
    })

    const result = validateConstraints(current, forms)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('No squad of 2 operators can satisfy')
  })

  it('reports mandatory-exclusive identities already reserved by other slots', () => {
    const forms = [
      operator('amiya-caster', 5, 'Caster', { mandatoryExclusivityGroup: 'amiya-forms' }),
      operator('amiya-guard', 5, 'Guard', { mandatoryExclusivityGroup: 'amiya-forms' }),
      ...pool,
    ]
    const current = constraints(3, {
      0: { rarities: [], classes: [], operatorId: 'amiya-caster' },
      1: { rarities: [], classes: [], mandatoryExclusivityGroup: 'other-forms' },
    })

    expect([...reservedMandatoryGroupsFromSlotConstraints(forms, current, 2)].sort()).toEqual([
      'amiya-forms',
      'other-forms',
    ])
    expect([...reservedMandatoryGroupsFromSlotConstraints(forms, current, 0)]).toEqual([
      'other-forms',
    ])
  })

  it('rejects a hole-producing impossible slot configuration instead of returning partial output', () => {
    const current = constraints(2, {
      0: { rarities: [6], classes: ['Guard'] },
      1: { rarities: [1], classes: ['Medic'] },
    })

    const result = validateConstraints(current, pool)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('Slot 2 has no eligible operators')
    expect(() => generateSquad(pool, current, seededRandom())).toThrow()
  })
})
