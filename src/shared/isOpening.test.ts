import { describe, expect, it } from 'vitest'
import {
  generateISOpening,
  isOpeningHopeCost,
  IS_OPENING_THEMES,
  IS_VOUCHER_CLASSES,
  randomizeISOpening,
  isOpeningDifficultyLevels,
  isOpeningDifficultyLabel,
  isOpeningSelectionCosts,
  isOpeningThemesForRegion,
  IS_OPENING_STRATEGIES,
  isOpeningConflicts,
} from './isOpening'
import {
  isISTemporaryOperator,
  isOpeningPool,
  matchesISVoucher,
  IS_TEMPORARY_OPERATORS,
} from './isOpeningTemporaryOperators'
import type { Operator, OperatorClass } from './operator'

type TestOperator = Operator & { mandatoryExclusivityGroup: string | null }

function operator(
  id: string,
  operatorClass: OperatorClass,
  rarity: Operator['rarity'] = 3,
  extras: Partial<TestOperator> = {},
): TestOperator {
  return {
    id,
    name: id,
    class: operatorClass,
    rarity,
    subclass: { id: 'test', name: 'Test' },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: '',
    ...extras,
  }
}

const squad = IS_OPENING_THEMES[0].squads.find((s) => s.name === 'Tactical Assault Squad')!
const base = {
  squad,
  voucherSetId: 'recruit_group_3',
  prioritizeSixStars: true,
  alterExclusivity: true,
  random: () => 0.99,
}
const pool = [
  operator('guard3', 'Guard'),
  operator('guard6', 'Guard', 6),
  operator('supporter', 'Supporter'),
  operator('medic', 'Medic'),
]

describe('IS opening selection', () => {
  const is5 = IS_OPENING_THEMES.find((theme) => theme.number === 5)!
  const leader5 = is5.squads.find((squad) => squad.name === 'Leader Squad')!
  const tactical5 = is5.squads.find((squad) => squad.name === 'Tactical Assault Squad')!
  const strategyOptions = {
    ...base,
    squad: tactical5,
    prioritizeSixStars: false,
    startingHope: 6,
    difficultyLevel: 13,
  }

  it('samples complete valid triples uniformly for True Random', () => {
    const operators = [
      operator('v6', 'Vanguard', 6),
      operator('v5', 'Vanguard', 5),
      operator('s5a', 'Sniper', 5),
      operator('s5b', 'Sniper', 5),
      operator('s4', 'Sniper', 4),
    ]
    const reserve = IS_TEMPORARY_OPERATORS.find((op) => op.id === 'char_504_rguard')!
    const expected = new Map<string, number>()
    const candidates = isOpeningPool(operators)
    for (const a of candidates.filter((op) => matchesISVoucher(op, 'Vanguard')))
      for (const b of candidates.filter((op) => matchesISVoucher(op, 'Sniper'))) {
        if (isOpeningConflicts(a, [b, reserve], true) || isOpeningConflicts(b, [reserve], true))
          continue
        if (
          isOpeningSelectionCosts([a, b, reserve], is5, leader5, 'recruit_group_1', 13).reduce(
            (a, b) => a + b,
            0,
          ) > 6
        )
          continue
        expected.set(`${a.id}/${b.id}`, 0)
      }
    let seed = 1821
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      return (seed >>> 0) / 4294967296
    }
    for (let roll = 0; roll < 4000; roll++) {
      const result = generateISOpening({
        ...strategyOptions,
        squad: leader5,
        operators,
        voucherSetId: 'recruit_group_1',
        strategy: 'true-random',
        fixedOperatorIds: [null, null, reserve.id],
        random,
      })
      const key = result.operators
        .slice(0, 2)
        .map((op) => op.id)
        .join('/')
      expect(expected.has(key)).toBe(true)
      expected.set(key, expected.get(key)! + 1)
    }
    const mean = 4000 / expected.size
    for (const observed of expected.values())
      expect(Math.abs(observed - mean)).toBeLessThan(mean * 0.25)
  })

  it('locks a random feasible five/six-star before Greedy optimizes the remainder', () => {
    const operators = [
      operator('g5', 'Guard', 5),
      operator('g6', 'Guard', 6),
      operator('s5', 'Supporter', 5),
      operator('m5', 'Medic', 5),
    ]
    const greedy = generateISOpening({
      ...strategyOptions,
      operators,
      strategy: 'greedy',
      random: () => 0,
    })
    expect(greedy.firstPickIndex).toBe(0)
    expect(greedy.operators[0].rarity).toBeGreaterThanOrEqual(5)
    expect(greedy.totalHopeCost).toBe(4)
    const exhausted = generateISOpening({
      ...strategyOptions,
      operators,
      strategy: 'exhaust-hope',
      random: () => 0,
    })
    expect(exhausted.totalHopeCost).toBe(6)
    expect(exhausted.firstPickIndex).toBeNull()
  })

  it('Prioritize Squad 6★ finds a feasible matching six-star and falls back when none exists', () => {
    const operators = [
      operator('g6', 'Guard', 6),
      operator('s5', 'Supporter', 5),
      operator('m5', 'Medic', 5),
    ]
    const selected = generateISOpening({ ...strategyOptions, operators, strategy: 'squad-six' })
    expect(selected.operators[0].id).toBe('g6')
    expect(selected.totalHopeCost).toBe(4)
    expect(
      generateISOpening({ ...strategyOptions, operators: [], strategy: 'squad-six' }).operators,
    ).toHaveLength(3)
  })

  it.each(['greedy', 'exhaust-hope'] as const)(
    '%s backtracks jointly over free fillers without changing paid or kept choices',
    (strategy) => {
      const operators = [
        operator('paid', 'Guard', 6),
        operator('s4', 'Supporter', 4, { alterGroup: 'same' }),
        operator('m4', 'Medic', 4, { alterGroup: 'same' }),
        operator('s3', 'Supporter', 3),
        operator('m3', 'Medic', 3),
      ]
      const result = generateISOpening({
        ...strategyOptions,
        squad: leader5,
        operators,
        strategy,
        fixedOperatorIds: ['paid', null, null],
      })
      expect(result.operators[0].id).toBe('paid')
      expect(result.totalHopeCost).toBe(6)
      expect(result.operators.slice(1).every((op) => !isISTemporaryOperator(op))).toBe(true)
      expect(result.operators.slice(1).reduce((sum, op) => sum + op.rarity, 0)).toBe(7)
      expect(result.hopeCosts).toEqual([6, 0, 0])
    },
  )

  it('uses Reserves only as a free-slot fallback and respects an explicitly kept Reserve', () => {
    const paid = operator('paid', 'Guard', 6),
      regular = operator('regular', 'Supporter', 1),
      medic = operator('medic', 'Medic', 4)
    const result = generateISOpening({
      ...strategyOptions,
      squad: leader5,
      operators: [paid, regular, medic],
      strategy: 'exhaust-hope',
      fixedOperatorIds: [paid.id, null, null],
    })
    expect(result.operators[1].id).toBe(regular.id)
    const reserve = IS_TEMPORARY_OPERATORS.find((op) => op.class === 'Medic')!
    const kept = generateISOpening({
      ...strategyOptions,
      squad: leader5,
      operators: [paid, regular, medic],
      strategy: 'exhaust-hope',
      fixedOperatorIds: [paid.id, null, reserve.id],
    })
    expect(kept.operators[2].id).toBe(reserve.id)
    const fallback = generateISOpening({
      ...strategyOptions,
      squad: leader5,
      operators: [paid],
      strategy: 'exhaust-hope',
      fixedOperatorIds: [paid.id, null, null],
    })
    expect(fallback.operators.slice(1).every(isISTemporaryOperator)).toBe(true)
  })

  it('Exhaust Hope applies the difficulty surcharge before maximizing effective spend', () => {
    const operators = [
      operator('g6', 'Guard', 6),
      operator('g4', 'Guard', 4),
      operator('s5', 'Supporter', 5),
      operator('m5', 'Medic', 5),
    ]
    const result = generateISOpening({
      ...strategyOptions,
      operators,
      strategy: 'exhaust-hope',
      difficultyLevel: 15,
    })
    expect(result.totalHopeCost).toBe(6)
    expect(result.operators.map((op) => op.id).sort()).toEqual(['g4', 'm5', 's5'])
  })

  it('Randomize All forwards the strategy while preserving a kept Random Squad and its voucher classes', () => {
    const operators = [
      operator('a', 'Guard', 5),
      operator('b', 'Guard', 5),
      operator('c', 'Guard', 5),
    ]
    const next = randomizeISOpening({
      operators,
      themeId: is5.id,
      strategy: 'exhaust-hope',
      startingHope: 6,
      difficultyLevel: 15,
      alterExclusivity: true,
      keptSquadId: leader5.id,
      keptVoucherSetId: 'recruit_group_random',
      voucherClasses: ['Guard', 'Guard', 'Guard'],
      fixedOperatorIds: ['a', null, null],
    })
    expect(next.squadId).toBe(leader5.id)
    expect(next.voucherSetId).toBe('recruit_group_random')
    expect(next.result.classes).toEqual(['Guard', 'Guard', 'Guard'])
    expect(next.result.operators[0].id).toBe('a')
    expect(next.result.totalHopeCost).toBe(6)
  })

  it.each(IS_OPENING_STRATEGIES)(
    '$name respects repeated Random Squad vouchers, a single temporary offer, and Keeps',
    ({ id: strategy }) => {
      const operators = [
        operator('a', 'Guard', 5),
        operator('b', 'Guard', 5),
        operator('c', 'Guard', 6),
        operator('d', 'Guard', 4),
      ]
      const result = generateISOpening({
        ...strategyOptions,
        squad: leader5,
        operators,
        strategy,
        voucherSetId: 'recruit_group_random',
        voucherClasses: ['Guard', 'Guard', 'Guard'],
        fixedOperatorIds: ['a', null, null],
      })
      expect(result.operators[0].id).toBe('a')
      expect(result.totalHopeCost).toBeLessThanOrEqual(6)
      expect(result.hopeCosts).toEqual(
        isOpeningSelectionCosts(result.operators, is5, leader5, 'recruit_group_random', 13),
      )
      expect(result.operators.filter((op) => op.id === 'a')).toHaveLength(1)
      expect(result.classes).toEqual(['Guard', 'Guard', 'Guard'])
    },
  )

  it('uses fully upgraded squad descriptions and their additional starting Hope', () => {
    const is5 = IS_OPENING_THEMES.find((theme) => theme.number === 5)!
    const blueprint = is5.squads.find((squad) => squad.name === 'Blueprint Squad')!
    const collection = is5.squads.find((squad) => squad.name === 'Collection Squad')!
    expect(blueprint.effectId).toBe('rogue_4_band_25')
    expect(blueprint.description).toContain('starting Hope +1')
    expect(blueprint.hopeBonus).toBe(1)
    expect(collection.effectId).toBe('rogue_4_band_29')
    expect(collection.hopeBonus).toBe(1)
    const result = generateISOpening({ ...base, squad: blueprint, operators: [], startingHope: 6 })
    expect(result.availableHope).toBe(7)
    const is6 = IS_OPENING_THEMES.find((theme) => theme.number === 6)!
    expect(is6.squads.find((squad) => squad.name === 'Special Squad')?.description).toContain(
      'Raidian',
    )
    const is7 = IS_OPENING_THEMES.find((theme) => theme.number === 7)!
    expect(is7.squads.find((squad) => squad.name === 'Special Squad')?.description).toContain(
      'Mechanist',
    )
    expect(is7.squads.find((squad) => squad.name === 'Leader Squad')?.description).toContain(
      'Shield',
    )
  })

  it('applies the selected IS2 Mantle to manual costs and the complete opening budget', () => {
    const theme = IS_OPENING_THEMES[0]
    const leader = theme.squads.find((value) => value.name === 'Leader Squad')!
    const options = {
      ...base,
      squad: leader,
      operators: pool,
      prioritizeSixStars: false,
      difficultyLevel: 13,
      fixedOperatorIds: ['guard6', 'supporter', 'medic'],
    }
    expect(isOpeningDifficultyLabel(theme.id, 4)).toContain('Gaul Mantle, 4–6★ +1 Hope')
    expect(isOpeningDifficultyLabel(theme.id, 13)).toContain('Gaul Mantle (Reforged), 4–6★ +2 Hope')
    expect(
      isOpeningSelectionCosts([pool[1], null, null], theme, leader, 'recruit_group_3', 13),
    ).toEqual([8, 0, 0])
    expect(() => generateISOpening({ ...options, startingHope: 6 })).toThrow('No opening')
    expect(generateISOpening({ ...options, startingHope: 8 }).totalHopeCost).toBe(8)
  })

  it('shows IS6 in both regions and IS7 only for CN metadata, with the specified representatives', () => {
    expect(isOpeningThemesForRegion('global').map((theme) => theme.number)).toEqual([2, 3, 4, 5, 6])
    expect(isOpeningThemesForRegion('cn').map((theme) => theme.number)).toEqual([2, 3, 4, 5, 6, 7])
    expect(IS_OPENING_THEMES.map((theme) => theme.representativeId)).toEqual([
      'char_250_phatom',
      'char_437_mizuki',
      'char_2012_typhon',
      'char_4146_nymph',
      'char_1043_leizi2',
      'char_4229_aphris',
    ])
  })

  it('uses IS6 opening difficulty surcharges and the one-Hope tactical discount', () => {
    const theme = IS_OPENING_THEMES.find((theme) => theme.number === 6)!
    const leader = theme.squads.find((squad) => squad.name === 'Leader Squad')!
    const tactical = theme.squads.find((squad) => squad.name === 'Tactical Assault Squad')!
    const costs = (squad: typeof leader, level: number) =>
      ([4, 5, 6] as const).map((rarity) =>
        isOpeningHopeCost(operator(`guard${rarity}`, 'Guard', rarity), theme, squad, level),
      )
    expect(costs(leader, 0)).toEqual([0, 2, 6])
    expect(costs(leader, 8)).toEqual([0, 3, 6])
    expect(costs(leader, 15)).toEqual([0, 3, 7])
    expect(costs(tactical, 15)).toEqual([0, 2, 6])
  })

  it('does not apply IS7 non-initial surcharges to opening recruitment and limits branch discounts', () => {
    const theme = IS_OPENING_THEMES.find((theme) => theme.number === 7)!
    const leader = theme.squads.find((squad) => squad.name === 'Leader Squad')!
    const studies = theme.squads.find((squad) => squad.subclasses?.includes('primcaster'))!
    const caster = operator('caster', 'Caster', 6)
    expect(isOpeningHopeCost(caster, theme, leader, 0)).toBe(6)
    expect(isOpeningHopeCost(caster, theme, leader, 15)).toBe(6)
    expect(isOpeningHopeCost(caster, theme, studies, 15)).toBe(6)
    expect(
      isOpeningHopeCost(
        { ...caster, subclass: { id: 'primcaster', name: 'Primal Caster' } },
        theme,
        studies,
        15,
      ),
    ).toBe(4)
  })

  it.each(['recruit_group_4', 'recruit_group_5'])(
    'rolls the additional IS6/IS7 voucher set %s',
    (voucherSetId) => {
      for (const theme of IS_OPENING_THEMES.filter((theme) => theme.number >= 6)) {
        const result = generateISOpening({
          ...base,
          squad: theme.squads[0],
          operators: [],
          voucherSetId,
        })
        expect(result.classes).toEqual(IS_VOUCHER_CLASSES[voucherSetId])
        expect(
          result.operators.every((op, index) => matchesISVoucher(op, result.classes[index])),
        ).toBe(true)
        expect(result.totalHopeCost).toBe(0)
      }
    },
  )

  it('lists only opening Hope-cost breakpoints', () => {
    expect(IS_OPENING_THEMES.map((theme) => isOpeningDifficultyLevels(theme.id))).toEqual([
      [0, 4, 13],
      [0, 4],
      [0, 6],
      [0, 13, 15],
      [0, 8, 15],
      [0],
    ])
  })

  it('injects only opening-eligible Reserve recruits without changing the regular pool', () => {
    const regular = [...pool]
    for (const theme of IS_OPENING_THEMES) {
      const injected = isOpeningPool(regular)
      expect(injected.filter(isISTemporaryOperator)).toHaveLength(5)
      expect(injected.filter(isISTemporaryOperator).every((op) => op.rarity === 3)).toBe(true)
      expect(new Set(isOpeningPool(injected).map((op) => op.id)).size).toBe(injected.length)
      expect(injected.some((op) => op.id === 'char_513_apionr')).toBe(false)
      for (const op of injected.filter(isISTemporaryOperator))
        expect(isOpeningHopeCost(op, theme, theme.squads[0], 15)).toBe(0)
    }
    expect(regular).toEqual(pool)
    expect(regular.some(isISTemporaryOperator)).toBe(false)
  })

  it.each([
    'char_508_aguard',
    'char_511_asnipe',
    'char_509_acast',
    'char_510_amedic',
    'char_513_apionr',
  ])(
    'excludes the five-star IS-only recruit %s from opening pools even when supplied explicitly',
    (id) => {
      const elite = operator(id, 'Guard', 5)
      expect(isOpeningPool([elite]).some((op) => op.id === id)).toBe(false)
      for (const theme of IS_OPENING_THEMES) {
        expect(() =>
          generateISOpening({
            ...base,
            squad: theme.squads[0],
            operators: [elite],
            fixedOperatorIds: [id],
          }),
        ).toThrow('No opening matches')
      }
    },
  )

  it('supports the reserve recruits on their actual voucher classes and repeated reserves', () => {
    for (const voucher of ['Vanguard', 'Guard', 'Specialist', 'Supporter'] as const) {
      const result = generateISOpening({
        ...base,
        operators: [],
        voucherSetId: 'recruit_group_random',
        voucherClasses: [voucher, voucher, voucher],
        startingHope: 0,
      })
      expect(result.operators.every((op) => matchesISVoucher(op, voucher))).toBe(true)
      expect(result.totalHopeCost).toBe(0)
    }
  })

  it('retains all kept choices during Randomize All and respects the total cost', () => {
    const next = randomizeISOpening({
      themeId: 'rogue_1',
      operators: pool,
      startingHope: 6,
      difficultyLevel: 0,
      prioritizeSixStars: true,
      alterExclusivity: true,
      keptSquadId: squad.id,
      keptVoucherSetId: 'recruit_group_3',
      fixedOperatorIds: ['guard6', null, 'medic'],
    })
    expect(next.squadId).toBe(squad.id)
    expect(next.voucherSetId).toBe('recruit_group_3')
    expect(next.result.operators[0].id).toBe('guard6')
    expect(next.result.operators[2].id).toBe('medic')
    expect(next.result.totalHopeCost).toBeLessThanOrEqual(6)
    expect(() =>
      generateISOpening({
        ...base,
        operators: pool,
        startingHope: 4,
        fixedOperatorIds: ['guard6'],
      }),
    ).toThrow('within 4 Hope')
  })

  it('rerolls one slot while preserving the other operators', () => {
    const result = generateISOpening({
      ...base,
      operators: pool,
      fixedOperatorIds: [null, 'supporter', 'medic'],
      excludedOperatorIdsBySlot: ['guard3'],
    })
    expect(result.operators[0].id).not.toBe('guard3')
    expect(result.operators.slice(1).map((op) => op.id)).toEqual(['supporter', 'medic'])
  })

  it('prices partial manual selections including temporary recruits and a single random-set offer', () => {
    const theme = IS_OPENING_THEMES[3]
    const squad = theme.squads.find((s) => s.name === 'Leader Squad')!
    const a = operator('a', 'Guard', 5)
    const b = operator('b', 'Medic', 5)
    expect(
      isOpeningSelectionCosts([a, null, null], theme, squad, 'recruit_group_random', 15),
    ).toEqual([0, 0, 0])
    expect(
      isOpeningSelectionCosts(
        [a, b, IS_TEMPORARY_OPERATORS[0]],
        theme,
        squad,
        'recruit_group_random',
        15,
      ),
    ).toEqual([0, 3, 0])
    expect(isOpeningSelectionCosts([a, b, null], theme, squad, 'recruit_group_3', 15)).toEqual([
      3, 3, 0,
    ])
  })

  it('assigns the single temporary offer consistently when squad discounts differ by class', () => {
    const theme = IS_OPENING_THEMES[1]
    const tactical = theme.squads.find((s) => s.name === 'Tactical Assault Squad')!
    const operators = [
      operator('g4', 'Guard', 4),
      operator('m4', 'Medic', 4),
      operator('s3', 'Sniper'),
    ]
    const result = generateISOpening({
      ...base,
      squad: tactical,
      operators,
      voucherSetId: 'recruit_group_random',
      voucherClasses: ['Guard', 'Medic', 'Sniper'],
      fixedOperatorIds: operators.map((op) => op.id),
      startingHope: 0,
    })
    expect(result.hopeCosts).toEqual([0, 0, 0])
    expect(result.temporaryOperatorIndex).toBe(1)
    expect(isOpeningSelectionCosts(operators, theme, tactical, 'recruit_group_random', 0)).toEqual(
      result.hopeCosts,
    )
  })

  it('matches every operator to its voucher and prioritizes an associated six star', () => {
    const result = generateISOpening({ ...base, operators: pool })
    expect(result.classes).toEqual(IS_VOUCHER_CLASSES.recruit_group_3)
    expect(result.operators.map((op) => op.class)).toEqual(result.classes)
    expect(result.operators[0].id).toBe('guard6')
  })

  it('does not prioritize six stars when unchecked', () => {
    expect(
      generateISOpening({ ...base, operators: pool, prioritizeSixStars: false }).operators[0].id,
    ).toBe('guard3')
  })

  it('falls back when the preferred six star is filtered out', () => {
    expect(
      generateISOpening({ ...base, operators: pool.filter((op) => op.rarity !== 6) }).operators[0]
        .id,
    ).toBe('guard3')
  })

  it('falls back when these vouchers do not include squad classes', () => {
    const operators = [
      operator('def', 'Defender'),
      operator('cast', 'Caster'),
      operator('snipe', 'Sniper'),
    ]
    expect(
      generateISOpening({ ...base, operators, voucherSetId: 'recruit_group_2' }).operators,
    ).toHaveLength(3)
  })

  it('avoids duplicates and mandatory conflicts even with random vouchers', () => {
    const operators = [
      operator('a', 'Guard', 6, { mandatoryExclusivityGroup: 'form' }),
      operator('b', 'Medic', 4, { mandatoryExclusivityGroup: 'form' }),
      operator('c', 'Guard'),
      operator('d', 'Medic'),
    ]
    const result = generateISOpening({
      ...base,
      operators,
      voucherSetId: 'recruit_group_random',
      voucherClasses: ['Guard', 'Medic', 'Medic'],
    })
    expect(new Set(result.operators.map((op) => op.id)).size).toBe(3)
    expect(result.operators.filter((op) => op.mandatoryExclusivityGroup === 'form')).toHaveLength(1)
  })

  it('backtracks away from an exclusive six star and honors the alter option', () => {
    const operators = pool.map((op) => ({
      ...op,
      alterGroup: op.id === 'guard6' || op.id === 'medic' ? 'alter' : null,
    }))
    const fixedOperatorIds = [null, 'supporter', 'medic']
    expect(generateISOpening({ ...base, operators, fixedOperatorIds }).operators[0].id).toBe(
      'guard3',
    )
    expect(
      generateISOpening({ ...base, operators, fixedOperatorIds, alterExclusivity: false })
        .operators[0].id,
    ).toBe('guard6')
  })

  it('keeps IS recruits available even when Setup excludes every regular operator', () => {
    const result = generateISOpening({ ...base, operators: [], startingHope: 0 })
    expect(result.operators.every(isISTemporaryOperator)).toBe(true)
    expect(result.totalHopeCost).toBe(0)
    expect(() =>
      generateISOpening({ ...base, operators: [], fixedOperatorIds: ['missing'] }),
    ).toThrow('No opening matches')
  })

  it('allows one class across three random vouchers without repeating an operator', () => {
    const operators = [operator('a', 'Guard'), operator('b', 'Guard'), operator('c', 'Guard', 4)]
    expect(
      new Set(
        generateISOpening({
          ...base,
          operators,
          voucherSetId: 'recruit_group_random',
          voucherClasses: ['Guard', 'Guard', 'Guard'],
        }).operators.map((op) => op.id),
      ).size,
    ).toBe(3)
  })

  it.each([
    ['rogue_1', [0, 0, 0, 2, 3, 6]],
    ['rogue_2', [0, 0, 0, 2, 3, 6]],
    ['rogue_3', [0, 0, 0, 2, 3, 6]],
    ['rogue_4', [0, 0, 0, 0, 2, 6]],
  ])('uses the recruitment costs for %s', (themeId, costs) => {
    const theme = IS_OPENING_THEMES.find((t) => t.id === themeId)!
    const neutralSquad = theme.squads.find((s) => s.name === 'Leader Squad')!
    expect(
      ([1, 2, 3, 4, 5, 6] as const).map((rarity) =>
        isOpeningHopeCost(operator(`rarity${rarity}`, 'Guard', rarity), theme, neutralSquad),
      ),
    ).toEqual(costs)
  })

  it('applies class discounts only in the matching themes and classes, never below zero', () => {
    for (const theme of IS_OPENING_THEMES) {
      const tactical = theme.squads.find((s) => s.name === 'Tactical Assault Squad')!
      expect(isOpeningHopeCost(operator('guard', 'Guard', 6), theme, tactical)).toBe(
        theme.number === 2 ? 6 : theme.number === 6 ? 5 : 4,
      )
      expect(isOpeningHopeCost(operator('medic', 'Medic', 6), theme, tactical)).toBe(6)
      expect(isOpeningHopeCost(operator('guard3', 'Guard'), theme, tactical)).toBe(0)
    }
    const theme = IS_OPENING_THEMES[1]
    const people = theme.squads.find((s) => s.name === 'People-Oriented Squad')!
    expect(isOpeningHopeCost(operator('sniper', 'Sniper', 6), theme, people)).toBe(5)
    expect(isOpeningHopeCost(operator('sniper3', 'Sniper'), theme, people)).toBe(0)
  })

  it('uses squad Hope bonuses in the available budget', () => {
    const theme = IS_OPENING_THEMES[0]
    const support = theme.squads.find((s) => s.name === 'Support Squad')!
    const operators = [
      operator('guard6', 'Guard', 6),
      operator('supporter4', 'Supporter', 4),
      operator('medic3', 'Medic'),
    ]
    const result = generateISOpening({ ...base, squad: support, operators })
    expect(result.availableHope).toBe(8)
    expect(result.hopeCosts).toEqual([6, 2, 0])
    expect(result.totalHopeCost).toBe(8)
    expect(() =>
      generateISOpening({ ...base, operators, fixedOperatorIds: operators.map((op) => op.id) }),
    ).toThrow('within 6 Hope')
  })

  it('falls back from a prioritized six star when it exceeds the Hope budget', () => {
    const result = generateISOpening({ ...base, operators: pool, startingHope: 4 })
    expect(result.operators[0].id).toBe('guard3')
    expect(result.totalHopeCost).toBeLessThanOrEqual(4)
  })

  it('allows three five stars in IS5 while the same opening exceeds IS4 Hope', () => {
    const operators = [
      operator('guard5', 'Guard', 5),
      operator('supporter5', 'Supporter', 5),
      operator('medic5', 'Medic', 5),
    ]
    const theme = IS_OPENING_THEMES[3]
    const result = generateISOpening({
      ...base,
      squad: theme.squads.find((s) => s.name === 'Leader Squad')!,
      operators,
    })
    expect(result.hopeCosts).toEqual([2, 2, 2])
    expect(result.totalHopeCost).toBe(6)
    expect(() =>
      generateISOpening({
        ...base,
        squad: IS_OPENING_THEMES[2].squads.find((s) => s.name === 'Leader Squad')!,
        operators,
        fixedOperatorIds: operators.map((op) => op.id),
      }),
    ).toThrow('within 6 Hope')
  })

  it.each([4, 6, 8])('keeps all generated openings within %i starting Hope', (startingHope) => {
    let state = 391
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
    const operators = (['Guard', 'Supporter', 'Medic'] as const).flatMap((c) =>
      ([3, 4, 5, 6] as const).map((r) => operator(`${c}${r}`, c, r)),
    )
    for (const theme of IS_OPENING_THEMES)
      for (const squad of theme.squads) {
        const result = generateISOpening({ ...base, squad, operators, startingHope, random })
        expect(result.totalHopeCost).toBe(result.hopeCosts.reduce((sum, cost) => sum + cost, 0))
        expect(result.totalHopeCost).toBeLessThanOrEqual(startingHope + squad.hopeBonus)
      }
  })

  it.each([
    ['rogue_1', 4],
    ['rogue_4', 5],
  ] as const)('accounts for the free temporary recruit in %s', (themeId, temporaryRarity) => {
    const theme = IS_OPENING_THEMES.find((t) => t.id === themeId)!
    const operators = [
      operator('a', 'Guard'),
      operator('b', 'Guard'),
      operator('temporary', 'Guard', temporaryRarity),
    ]
    const result = generateISOpening({
      ...base,
      squad: theme.squads[0],
      operators,
      voucherSetId: 'recruit_group_random',
      voucherClasses: ['Guard', 'Guard', 'Guard'],
      startingHope: 0,
    })
    expect(result.operators[result.temporaryOperatorIndex!].rarity).toBe(temporaryRarity)
    expect(result.hopeCosts[result.temporaryOperatorIndex!]).toBe(0)
    expect(result.totalHopeCost).toBe(0)
  })

  it('rejects invalid Hope values', () => {
    for (const startingHope of [-1, NaN, Infinity, 5.5]) {
      expect(() => generateISOpening({ ...base, operators: pool, startingHope })).toThrow(
        'Starting Hope',
      )
    }
  })

  it.each([
    ['rogue_1', 0, [0, 2, 3, 6]],
    ['rogue_1', 4, [0, 3, 4, 7]],
    ['rogue_1', 13, [0, 4, 5, 8]],
    ['rogue_2', 3, [0, 2, 3, 6]],
    ['rogue_2', 4, [1, 3, 4, 7]],
    ['rogue_2', 18, [1, 3, 4, 7]],
    ['rogue_3', 5, [0, 2, 3, 6]],
    ['rogue_3', 6, [0, 3, 4, 7]],
    ['rogue_4', 12, [0, 0, 2, 6]],
    ['rogue_4', 13, [0, 0, 3, 6]],
    ['rogue_4', 14, [0, 0, 3, 6]],
    ['rogue_4', 15, [0, 0, 3, 7]],
    ['rogue_4', 18, [0, 0, 3, 7]],
  ] as const)('uses opening costs at %s difficulty %i', (themeId, level, costs) => {
    const theme = IS_OPENING_THEMES.find((value) => value.id === themeId)!
    const squad = theme.squads.find((value) => value.name === 'Leader Squad')!
    expect(
      ([3, 4, 5, 6] as const).map((rarity) =>
        isOpeningHopeCost(operator(`guard${rarity}`, 'Guard', rarity), theme, squad, level),
      ),
    ).toEqual(costs)
  })

  it('combines difficulty surcharges with squad discounts and the total budget', () => {
    const theme = IS_OPENING_THEMES[1]
    const squad = theme.squads.find((value) => value.name === 'Tactical Assault Squad')!
    const fixedOperatorIds = [null, 'supporter', 'medic']
    const result = generateISOpening({
      ...base,
      squad,
      operators: pool,
      difficultyLevel: 4,
      fixedOperatorIds,
    })
    expect(result.operators[0].id).toBe('guard3')
    expect(result.hopeCosts).toEqual([1, 1, 1])
    const higherHope = generateISOpening({
      ...base,
      squad,
      operators: pool,
      difficultyLevel: 4,
      startingHope: 8,
      fixedOperatorIds,
    })
    expect(higherHope.operators[0].id).toBe('guard6')
    expect(higherHope.hopeCosts).toEqual([5, 1, 1])
    expect(higherHope.totalHopeCost).toBe(7)
  })

  it('rejects an IS5 opening that stops being affordable at Facing Souls 13', () => {
    const theme = IS_OPENING_THEMES[3]
    const squad = theme.squads.find((value) => value.name === 'Leader Squad')!
    const operators = [
      operator('guard5', 'Guard', 5),
      operator('supporter5', 'Supporter', 5),
      operator('medic5', 'Medic', 5),
    ]
    expect(
      generateISOpening({ ...base, squad, operators, difficultyLevel: 12 }).totalHopeCost,
    ).toBe(6)
    expect(() =>
      generateISOpening({
        ...base,
        squad,
        operators,
        difficultyLevel: 13,
        fixedOperatorIds: operators.map((op) => op.id),
      }),
    ).toThrow('within 6 Hope')
  })

  it('requires all three explicit voucher classes for As Your Heart Desires', () => {
    for (const voucherClasses of [undefined, [], ['Guard'], ['Guard', 'Medic']] as (
      OperatorClass[] | undefined
    )[]) {
      expect(() =>
        generateISOpening({
          ...base,
          operators: pool,
          voucherSetId: 'recruit_group_random',
          voucherClasses,
        }),
      ).toThrow('Choose all three voucher classes')
    }
  })

  it('honors the chosen voucher class order including the free temporary recruit', () => {
    const operators = [
      operator('medic', 'Medic'),
      operator('guard', 'Guard', 6),
      operator('sniper', 'Sniper', 4),
    ]
    const result = generateISOpening({
      ...base,
      operators,
      voucherSetId: 'recruit_group_random',
      voucherClasses: ['Medic', 'Guard', 'Sniper'],
    })
    expect(result.classes).toEqual(['Medic', 'Guard', 'Sniper'])
    expect(result.operators.map((value) => value.class)).toEqual(result.classes)
    expect(result.hopeCosts).toEqual([0, 6, 0])
  })

  it('Randomize All excludes manual voucher sets and finds feasible choices under filters', () => {
    let state = 100
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
    for (const theme of IS_OPENING_THEMES)
      for (let iteration = 0; iteration < 12; iteration++) {
        const next = randomizeISOpening({
          themeId: theme.id,
          operators: pool,
          startingHope: 6,
          difficultyLevel: 0,
          prioritizeSixStars: true,
          alterExclusivity: true,
          random,
        })
        expect(next.voucherSetId).not.toBe('recruit_group_random')
        expect(next.result.classes).toEqual(IS_VOUCHER_CLASSES[next.voucherSetId])
        expect(next.result.totalHopeCost).toBeLessThanOrEqual(next.result.availableHope)
        expect(next.result.temporaryOperatorIndex).toBeNull()
      }
  })

  it('finds the temporary slot compatible with the player’s chosen voucher classes', () => {
    const operators = [
      operator('guard', 'Guard'),
      operator('medic4', 'Medic', 4),
      operator('sniper', 'Sniper'),
    ]
    const result = generateISOpening({
      ...base,
      operators,
      voucherSetId: 'recruit_group_random',
      voucherClasses: ['Guard', 'Medic', 'Sniper'],
      startingHope: 0,
    })
    expect(result.temporaryOperatorIndex).toBe(1)
    expect(result.hopeCosts).toEqual([0, 0, 0])
  })

  it('rejects difficulty levels outside the selected theme range', () => {
    for (const difficultyLevel of [-1, 16, 1.5, NaN]) {
      expect(() => generateISOpening({ ...base, operators: pool, difficultyLevel })).toThrow(
        'Difficulty Level',
      )
    }
  })
})
