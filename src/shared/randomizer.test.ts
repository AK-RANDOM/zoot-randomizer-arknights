import { describe, expect, it } from 'vitest'
import { classifyAcquisition } from './acquisitionMetadata'
import {
  DEFAULT_CONSTRAINTS,
  setNumericConstraintBound,
  type RandomizerConstraints,
} from './constraints'
import type { Operator } from './operator'
import { operatorClasses, operatorRarities } from './operator'
import { BUILT_IN_SQUAD_PRESETS, applySquadConfiguration } from './presets'
import {
  filterEligibleOperators,
  canSlotResolveTo,
  createSquadRerollPlanner,
  rollSquadReroll,
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
      global: global ? { date: '2024-07-01', yearGroup: 4 } : { date: null, yearGroup: null },
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
  return {
    eventStory: false,
    redCert: false,
    cc: false,
    isRa: false,
    recruitment: false,
    creditShop: false,
  }
}

const disabledStandard = { postKernel: false, kernel: false, lowRarity: false }

function disabledLimited(): RandomizerConstraints['acquisition']['limited'] {
  return {
    anniversary: false,
    halfAnniversary: false,
    cny: false,
    summer: false,
    collab: false,
  }
}

describe('shared reroll planning', () => {
  it('draws a valid randomized squad from the reported 35-operator Chain pool', () => {
    const preset = BUILT_IN_SQUAD_PRESETS.find(({ id }) => id === 'builtin:dev-recommended')!
    const constraints = applySquadConfiguration(DEFAULT_CONSTRAINTS, preset.configuration)
    const squad = [
      operator('Phantom', 6, 'Specialist'), operator('Ceylon', 5, 'Medic'),
      operator('Specter', 5, 'Guard'), operator('Blue Poison', 5, 'Sniper'),
      operator('Hung', 5, 'Defender'), operator('Glaucus', 5, 'Supporter'),
      operator('Dobermann', 4, 'Guard'), operator('Perfumer', 4, 'Medic'),
      operator('Haze', 4, 'Caster'), operator('Shirayuki', 4, 'Sniper'),
      operator('Lava', 3, 'Caster'), operator('Fang', 3, 'Vanguard'),
    ]
    const byRarity: [Operator['rarity'], Operator['class'][]][] = [
      [6, ['Guard', 'Guard', 'Guard', 'Defender', 'Defender', 'Defender', 'Sniper', 'Sniper', 'Sniper', 'Caster', 'Caster', 'Medic', 'Medic', 'Supporter', 'Specialist']],
      [5, ['Guard', 'Guard', 'Guard', 'Guard', 'Guard', 'Guard', 'Sniper', 'Sniper', 'Caster', 'Caster', 'Caster', 'Supporter', 'Supporter']],
      [4, ['Medic']],
      [3, ['Guard', 'Defender', 'Sniper', 'Medic']],
      [2, ['Vanguard', 'Sniper']],
    ]
    const available = byRarity.flatMap(([rarity, classes]) =>
      classes.map((operatorClass, index) => operator(`draw-${rarity}-${index}`, rarity, operatorClass)),
    )
    const kept = [6, 8, 9]
    const targets = squad.flatMap((_, index) => kept.includes(index) ? [] : [index])
    const plan = createSquadRerollPlanner(constraints, squad, [...squad, ...available], []).plan(targets)
    if (!plan) throw new Error('Expected a feasible nine-slot reroll')

    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 25; seed += 1) {
      let state = seed
      const random = () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0
        return state / 2 ** 32
      }
      const result = rollSquadReroll(plan, random)
      expect(kept.map((index) => result[index])).toEqual(kept.map((index) => squad[index]))
      expect(result[7].id).toBe('draw-4-0')
      expect(result.slice(10).map(({ id }) => id).sort()).toEqual(['draw-2-0', 'draw-3-1'])
      outcomes.add(result.map(({ id }) => id).join(','))
    }
    expect(outcomes.size).toBeGreaterThan(1)
  })

  it('finds a valid batch when the same 5-star slot cannot reroll individually', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 3,
      class: { Vanguard: { min: 1, max: 12 } },
      slots: DEFAULT_CONSTRAINTS.slots.map((slot, index) => {
        if (index === 0) return { ...slot, rarities: [6] }
        if (index === 1) return { ...slot, rarities: [5] }
        return index === 2 ? { ...slot, operatorId: 'kept' } : slot
      }),
    }
    const kept = operator('kept', 4, 'Defender')
    const squad = [operator('nian', 6, 'Defender'), operator('reed', 5, 'Vanguard'), kept]
    const exhausted = operator('siege', 6, 'Vanguard')
    const available = [operator('bagpipe', 6, 'Vanguard'), operator('broca', 5, 'Guard')]
    const planner = createSquadRerollPlanner(
      constraints,
      squad,
      [...squad, ...available, exhausted],
      [exhausted],
    )

    expect(planner.available).toEqual(available)
    expect(planner.plan([1])).toBeNull()
    expect(planner.plan([2])).toBeNull()
    const batch = planner.plan([0, 1])
    expect(batch).not.toBeNull()
    if (!batch) throw new Error('Expected a feasible batch')
    expect(rollSquadReroll(batch, seededRandom())).toEqual([...available, kept])
    expect(planner.plan([1, 0])).toBe(batch)
  })

  it('allows fresh random draws from the same checked plan', () => {
    const constraints = { ...DEFAULT_CONSTRAINTS, squadSize: 1 }
    const current = operator('current', 5, 'Guard')
    const first = operator('first', 5, 'Guard')
    const second = operator('second', 5, 'Guard')
    const planner = createSquadRerollPlanner(constraints, [current], [current, first, second], [])
    const plan = planner.plan([0])
    if (!plan) throw new Error('Expected a feasible reroll')

    expect(rollSquadReroll(plan, () => 0)).toEqual([second])
    expect(rollSquadReroll(plan, () => 0.99)).toEqual([first])
  })
})

describe('constraints', () => {
  it('rejects competing class minimums that only one slot can satisfy', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      class: { Medic: { min: 1, max: 12 }, Caster: { min: 1, max: 12 } },
      slots: DEFAULT_CONSTRAINTS.slots.map((slot, index) => ({
        ...slot,
        rarities: index === 0 ? [6] : [5],
      })),
    }
    const replacements = [
      operator('medic', 6, 'Medic'),
      operator('caster', 6, 'Caster'),
      ...Array.from({ length: 40 }, (_, index) => operator(`guard-${index}`, 5, 'Guard')),
    ]

    const result = measureConstraintSearch(replacements, constraints, undefined, 'dynamic', 'deficit')
    expect(result.solved).toBe(false)
    expect(result.stats).toMatchObject({ visits: 0, backtracks: 0, exhausted: false })
    expect(validateConstraints(constraints, [...replacements, operator('medic-5', 5, 'Medic')]).valid).toBe(true)
  })

  it('rejects a four-Medic squad before search when only three distinct Medics fit', () => {
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      class: { Medic: { min: 4, max: 12 } },
      slots: DEFAULT_CONSTRAINTS.slots.map((slot, index) =>
        index === 0 ? { ...slot, operatorId: 'medic-0' } : slot,
      ),
    }
    const medics = Array.from({ length: 4 }, (_, index) => operator(`medic-${index}`, 5, 'Medic'))
    const others = Array.from({ length: 40 }, (_, index) => operator(`guard-${index}`, 5, 'Guard'))
    const exhaustedPool = [...medics.slice(0, 3), ...others]

    const result = measureConstraintSearch(exhaustedPool, constraints, undefined, 'dynamic', 'deficit')
    expect(result.solved).toBe(false)
    expect(result.stats).toMatchObject({ visits: 0, backtracks: 0, exhausted: false })
    expect(validateConstraints(constraints, exhaustedPool).valid).toBe(false)
    expect(validateConstraints(constraints, [...medics, ...others]).valid).toBe(true)
  })

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

  it('lets 4★ and below bypass both release bounds while respecting other filters', () => {
    const items = [
      operator('four', 4, 'Guard'),
      operator('one', 1, 'Guard'),
      operator('five', 5, 'Guard'),
      operator('cn_only', 4, 'Guard', false),
      operator('excluded_subclass', 4, 'Guard', true, {
        subclass: { id: 'excluded', name: 'Excluded' },
      }),
    ]
    const constraints: RandomizerConstraints = {
      ...DEFAULT_CONSTRAINTS,
      subclass: { excludedIds: ['excluded'] },
      release: {
        server: 'global',
        minYear: 5,
        maxYear: 6,
        minDate: '2025-01-01',
        maxDate: '2026-01-01',
      },
    }

    expect(filterEligibleOperators(items, constraints)).toEqual([])
    constraints.release.ignoreBoundsForLowRarity = true
    expect(filterEligibleOperators(items, constraints).map(({ id }) => id)).toEqual(['four', 'one'])
  })

  it('filters Recruitment welfare separately from Standard and other Welfare operators', () => {
    const recruitment = operator('char_4227_gallus', 1, 'Caster', true, {
      acquisition: classifyAcquisition({
        id: 'char_4227_gallus',
        obtainApproach: 'Login Reward',
        releaseCategory: 'side_story',
        cnReleaseDate: '2026-04-30',
        collaboration: null,
        limitedIds: new Set(),
      }),
    })
    const standard = operator('char_standard', 5, 'Guard')
    const story = operator('char_story', 5, 'Guard', true, {
      acquisition: { family: 'welfare', group: 'eventStory' },
    })
    const items = [recruitment, standard, story]

    expect(
      filterEligibleOperators(items, {
        ...DEFAULT_CONSTRAINTS,
        acquisition: {
          standard: disabledStandard,
          limited: disabledLimited(),
          welfare: { ...disabledWelfare(), recruitment: true },
        },
      }),
    ).toEqual([recruitment])
    expect(
      filterEligibleOperators(items, {
        ...DEFAULT_CONSTRAINTS,
        acquisition: {
          ...DEFAULT_CONSTRAINTS.acquisition,
          welfare: { ...DEFAULT_CONSTRAINTS.acquisition.welfare, recruitment: false },
        },
      }),
    ).toEqual([standard, story])
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
        standard: disabledStandard,
        welfare: disabledWelfare(),
      },
    })
    expect(limitedOnly.map((item) => item.id)).toEqual(['char_limited', 'char_collab_gacha'])

    const nonCollabLimitedOnly = filterEligibleOperators(items, {
      ...DEFAULT_CONSTRAINTS,
      acquisition: {
        ...DEFAULT_CONSTRAINTS.acquisition,
        standard: disabledStandard,
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
        standard: disabledStandard,
        welfare: { ...disabledWelfare(), eventStory: true },
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

  it('keeps reset preset slots feasible while probing rarity and class choices', () => {
    const items = operatorRarities.flatMap((rarity) =>
      operatorClasses.flatMap((operatorClass) =>
        Array.from(
          { length: rarity === 3 && ['Guard', 'Specialist'].includes(operatorClass) ? 0 : 4 },
          (_, index) => operator(`${rarity}-${operatorClass}-${index}`, rarity, operatorClass),
        ),
      ),
    )
    items.push(
      ...(['Caster', 'Guard', 'Medic'] as const).map((operatorClass) =>
        operator(`amiya-${operatorClass}`, 5, operatorClass, true, {
          mandatoryExclusivityGroup: 'amiya-forms',
        }),
      ),
    )
    for (let slotIndex = 0; slotIndex < 12; slotIndex += 1) {
      const constraints = applySquadConfiguration(
        DEFAULT_CONSTRAINTS,
        BUILT_IN_SQUAD_PRESETS[1].configuration,
      )
      const draft = { rarities: [], classes: [] }
      constraints.slots[slotIndex] = draft
      expect(validateConstraints(constraints, items).valid).toBe(true)
      for (const operatorClass of operatorClasses) {
        expect(canSlotResolveTo(items, constraints, slotIndex, draft, { operatorClass })).toBe(
          operatorClass !== 'Supporter' &&
            !(slotIndex >= 9 && ['Guard', 'Specialist'].includes(operatorClass)),
        )
      }
      for (const rarity of operatorRarities) {
        expect(canSlotResolveTo(items, constraints, slotIndex, draft, { rarity })).toBe(
          rarity === BUILT_IN_SQUAD_PRESETS[1].configuration.slots[slotIndex].rarities[0],
        )
      }
    }
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
