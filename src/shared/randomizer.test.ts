import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONSTRAINTS,
  setNumericConstraintBound,
  type RandomizerConstraints,
} from './constraints'
import type { Operator } from './operator'
import {
  filterEligibleOperators,
  generateSquad,
  measureConstraintSearch,
  validateConstraints,
} from './randomizer'

function operator(
  id: string,
  rarity: Operator['rarity'],
  operatorClass: Operator['class'],
  global = true,
  extras: Partial<Operator> = {},
): Operator {
  return {
    id,
    name: id,
    rarity,
    class: operatorClass,
    subclass: { id: 'pioneer', name: 'Pioneer' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global },
    release: {
      cn: { date: '2024-01-01', yearGroup: 5 },
      global: global
        ? { date: '2024-07-01', yearGroup: 4 }
        : { date: null, yearGroup: null },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
    ...extras,
  }
}

const pool: Operator[] = [
  operator('char_a', 6, 'Guard'),
  operator('char_b', 6, 'Caster'),
  operator('char_c', 5, 'Guard'),
  operator('char_d', 5, 'Medic'),
  operator('char_e', 4, 'Vanguard'),
  operator('char_f', 4, 'Defender'),
  operator('char_g', 3, 'Sniper'),
  operator('char_h', 3, 'Supporter'),
  operator('char_i', 2, 'Specialist'),
  operator('char_j', 1, 'Guard'),
  operator('char_k', 6, 'Guard', false),
  operator('char_l', 5, 'Caster', false),
]

function seededRandom(): () => number {
  let state = 123456789
  return () => {
    state = (1103515245 * state + 12345) % 2147483648
    return state / 2147483648
  }
}

function disabledWelfare(): RandomizerConstraints['acquisition']['welfare'] {
  return { eventStory: false, redCert: false, cc: false, isRa: false }
}

function disabledLimited(): RandomizerConstraints['acquisition']['limited'] {
  return {
    anniversary: false,
    halfAnniversary: false,
    cny: false,
    summer: false,
    collab: false,
  }
}

describe('constraints', () => {
  it('accepts the default squad-size shape', () => {
    expect(validateConstraints(DEFAULT_CONSTRAINTS).valid).toBe(true)
  })

  it('rejects squad sizes outside 1 to 12', () => {
    expect(validateConstraints({ ...DEFAULT_CONSTRAINTS, squadSize: 13 }).valid).toBe(false)
  })

  it('keeps min and max synchronized when one crosses the other', () => {
    expect(setNumericConstraintBound({ min: 0, max: 3 }, 'min', 5)).toEqual({ min: 5, max: 5 })
    expect(setNumericConstraintBound({ min: 4, max: 8 }, 'max', 2)).toEqual({ min: 2, max: 2 })
  })

  it('rejects a minimum above its maximum', () => {
    const result = validateConstraints({
      ...DEFAULT_CONSTRAINTS,
      rarity: { 6: { min: 3, max: 2 } },
    })
    expect(result.valid).toBe(false)
  })

  it('uses the selected release calendar as the server pool', () => {
    const globalEligible = filterEligibleOperators(pool, {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 2,
      release: { ...DEFAULT_CONSTRAINTS.release, server: 'global' },
    })
    expect(globalEligible.some((item) => item.id === 'char_k')).toBe(false)

    const cnEligible = filterEligibleOperators(pool, {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 2,
      release: { ...DEFAULT_CONSTRAINTS.release, server: 'cn' },
    })
    expect(cnEligible.some((item) => item.id === 'char_k')).toBe(true)
  })

  it('filters by release year group and strict date', () => {
    const items = [
      operator('char_year_1', 6, 'Guard', true, {
        release: {
          cn: { date: '2020-04-01', yearGroup: 1 },
          global: { date: '2020-08-01', yearGroup: 1 },
        },
      }),
      operator('char_year_2', 6, 'Guard', true, {
        release: {
          cn: { date: '2020-05-01', yearGroup: 2 },
          global: { date: '2020-12-30', yearGroup: 2 },
        },
      }),
    ]

    const eligible = filterEligibleOperators(items, {
      ...DEFAULT_CONSTRAINTS,
      release: {
        server: 'cn',
        minYear: 2,
        maxYear: 2,
        minDate: '2020-05-01',
        maxDate: '2020-05-01',
      },
    })

    expect(eligible.map((item) => item.id)).toEqual(['char_year_2'])
  })

  it('treats acquisition and collaboration as independent overlapping dimensions', () => {
    const items = [
      operator('char_standard', 6, 'Guard'),
      operator('char_limited', 6, 'Guard', true, {
        acquisition: { family: 'limited', group: 'anniversary' },
      }),
      operator('char_collab_gacha', 6, 'Guard', true, {
        acquisition: { family: 'limited', group: 'collab' },
        collaboration: 'Monster Hunter',
      }),
      operator('char_welfare', 5, 'Guard', true, {
        acquisition: { family: 'welfare', group: 'eventStory' },
      }),
      operator('char_collab_welfare', 5, 'Guard', true, {
        acquisition: { family: 'welfare', group: 'eventStory' },
        collaboration: 'Monster Hunter',
      }),
    ]

    const limitedOnly = filterEligibleOperators(items, {
      ...DEFAULT_CONSTRAINTS,
      acquisition: {
        ...DEFAULT_CONSTRAINTS.acquisition,
        standard: false,
        welfare: disabledWelfare(),
      },
    })
    expect(limitedOnly.map((item) => item.id)).toEqual([
      'char_limited',
      'char_collab_gacha',
    ])

    const nonCollabLimitedOnly = filterEligibleOperators(items, {
      ...DEFAULT_CONSTRAINTS,
      acquisition: {
        ...DEFAULT_CONSTRAINTS.acquisition,
        standard: false,
        welfare: disabledWelfare(),
      },
      collaboration: {
        includeNonCollab: true,
        sources: { 'Monster Hunter': false },
      },
    })
    expect(nonCollabLimitedOnly.map((item) => item.id)).toEqual(['char_limited'])

    const collabWelfareOnly = filterEligibleOperators(items, {
      ...DEFAULT_CONSTRAINTS,
      acquisition: {
        limited: disabledLimited(),
        standard: false,
        welfare: { eventStory: true, redCert: false, cc: false, isRa: false },
      },
      collaboration: {
        includeNonCollab: false,
        sources: { 'Monster Hunter': true },
      },
    })
    expect(collabWelfareOnly.map((item) => item.id)).toEqual(['char_collab_welfare'])
  })

  it('enforces alter exclusivity when requested', () => {
    const items = [
      operator('char_original', 6, 'Guard', true, { alterGroup: 'alter:foo' }),
      operator('char_alter', 6, 'Caster', true, { alterGroup: 'alter:foo' }),
      operator('char_other', 6, 'Sniper'),
    ]
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 2,
      alterExclusivity: true,
    }
    const generated = generateSquad(items, constraints, seededRandom())
    expect(generated).toHaveLength(2)
    expect(generated.filter((item) => item.alterGroup === 'alter:foo')).toHaveLength(1)
  })

  it('always enforces mandatory Amiya-form exclusivity', () => {
    const items = [
      operator('char_002_amiya', 5, 'Caster', true, {
        mandatoryExclusivityGroup: 'amiya-forms',
      }),
      operator('char_1001_amiya2', 5, 'Guard', true, {
        mandatoryExclusivityGroup: 'amiya-forms',
      }),
      operator('char_other', 5, 'Sniper'),
    ]
    const generated = generateSquad(
      items,
      { ...DEFAULT_CONSTRAINTS, squadSize: 2, alterExclusivity: false },
      seededRandom(),
    )
    expect(generated).toHaveLength(2)
    expect(
      generated.filter((item) => item.mandatoryExclusivityGroup === 'amiya-forms'),
    ).toHaveLength(1)
  })

  it('satisfies overlapping class and rarity minimums', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 4,
      rarity: { 6: { min: 1, max: 2 }, 4: { min: 1, max: 2 } },
      class: { Guard: { min: 1, max: 2 }, Medic: { min: 1, max: 2 } },
    }

    const squad = generateSquad(pool, constraints, seededRandom())
    expect(squad).toHaveLength(4)
    expect(squad.filter((item) => item.rarity === 6).length).toBeGreaterThanOrEqual(1)
    expect(squad.filter((item) => item.rarity === 4).length).toBeGreaterThanOrEqual(1)
    expect(squad.filter((item) => item.class === 'Guard').length).toBeGreaterThanOrEqual(1)
    expect(squad.filter((item) => item.class === 'Medic').length).toBeGreaterThanOrEqual(1)
  })

  it('rejects impossible minimums after eligibility filtering', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 2,
      release: { ...DEFAULT_CONSTRAINTS.release, server: 'global' },
      class: { Caster: { min: 2, max: 2 } },
    }
    expect(validateConstraints(constraints, pool).valid).toBe(false)
  })

  it('supports aggregate rarity bounds', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 4,
      rarityGroups: { lte3: { min: 2, max: 2 } },
    }
    const squad = generateSquad(pool, constraints, seededRandom())
    expect(squad.filter((item) => item.rarity <= 3)).toHaveLength(2)
  })

  it('supports multi-select slot allowed sets using OR within and AND between', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 2,
      slots: [
        { rarities: [4, 6], classes: ['Caster', 'Sniper'] },
        { rarities: [], classes: ['Medic'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(2),
      ],
    }
    const squad = generateSquad(pool, constraints, seededRandom())
    expect(squad[0] && [4, 6].includes(squad[0].rarity)).toBe(true)
    expect(squad[0] && ['Caster', 'Sniper'].includes(squad[0].class)).toBe(true)
    expect(squad[1]?.class).toBe('Medic')
  })

  it('reports deterministic solver work without changing generation behavior', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 4,
      slots: [
        { rarities: [6], classes: ['Guard', 'Caster'] },
        { rarities: [5], classes: ['Guard', 'Medic'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(2),
      ],
    }

    const first = measureConstraintSearch(pool, constraints, seededRandom())
    const second = measureConstraintSearch(pool, constraints, seededRandom())

    expect(first.solved).toBe(true)
    expect(first.stats.visits).toBeGreaterThan(0)
    expect(first.stats.exhausted).toBe(false)
    expect(first.stats.prunedBranches).toBeGreaterThanOrEqual(0)
    expect(second.stats.visits).toBe(first.stats.visits)
    expect(second.stats.backtracks).toBe(first.stats.backtracks)
  })

  it('uses current viability to detect an exclusivity-blocked remaining slot', () => {
    const items = [
      operator('char_guard_a', 6, 'Guard', true, {
        mandatoryExclusivityGroup: 'guard-lock',
      }),
      operator('char_guard_b', 5, 'Guard', true, {
        mandatoryExclusivityGroup: 'guard-lock',
      }),
      operator('char_caster', 6, 'Caster'),
      operator('char_medic', 5, 'Medic'),
    ]
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 3,
      slots: [
        { rarities: [], classes: ['Guard'] },
        { rarities: [], classes: ['Guard'] },
        { rarities: [], classes: ['Caster', 'Medic'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(3),
      ],
    }

    const measured = measureConstraintSearch(items, constraints, seededRandom())
    expect(measured.solved).toBe(false)
    expect(measured.stats.exhausted).toBe(false)
    expect(measured.stats.visits).toBeLessThan(20)
  })

  it('fails cleanly instead of returning a partial squad', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 3,
      slots: [
        { rarities: [6], classes: ['Guard'] },
        { rarities: [6], classes: ['Guard'] },
        { rarities: [6], classes: ['Guard'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(3),
      ],
    }
    expect(() => generateSquad(pool, constraints, seededRandom())).toThrow()
  })
})