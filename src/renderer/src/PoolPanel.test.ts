import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from '../../shared/constraints'
import type { Operator, OperatorClass, OperatorRarity } from '../../shared/operator'
import {
  collapseAllPoolGroups,
  comparePoolGroups,
  comparePoolOperators,
  expandAllPoolGroups,
} from './PoolPanel'

function operator(
  id: string,
  name: string,
  rarity: OperatorRarity,
  operatorClass: OperatorClass,
  globalDate: string | null,
  globalYearGroup = 1,
): Operator {
  return {
    id,
    name,
    rarity,
    class: operatorClass,
    subclass: { id: 'test', name: 'Test' },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: globalDate, yearGroup: globalYearGroup },
      global: { date: globalDate, yearGroup: globalYearGroup },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

describe('Pool view regressions', () => {
  const constraints = createDefaultConstraints()

  it('supports Default, Alphabetical, and Release Date operator sorting', () => {
    const operators = [
      operator('caster-six', 'Zulu', 6, 'Caster', '2023-03-01'),
      operator('vanguard-six', 'Bravo', 6, 'Vanguard', '2023-02-01'),
      operator('guard-five', 'Alpha', 5, 'Guard', '2023-01-01'),
    ]

    expect([...operators].sort((left, right) => comparePoolOperators(left, right, 'default', constraints)).map(({ id }) => id)).toEqual([
      'vanguard-six',
      'caster-six',
      'guard-five',
    ])

    expect([...operators].sort((left, right) => comparePoolOperators(left, right, 'alphabetical', constraints)).map(({ name }) => name)).toEqual([
      'Alpha',
      'Bravo',
      'Zulu',
    ])

    expect([...operators].sort((left, right) => comparePoolOperators(left, right, 'releaseDate', constraints)).map(({ id }) => id)).toEqual([
      'guard-five',
      'vanguard-six',
      'caster-six',
    ])
  })

  it('orders grouped views in both ascending and descending directions', () => {
    const fourStar = operator('four', 'Four', 4, 'Guard', '2021-01-01', 2)
    const sixStar = operator('six', 'Six', 6, 'Guard', '2023-01-01', 4)
    const groups = [
      ['6★', [sixStar]],
      ['4★', [fourStar]],
    ] as const

    expect([...groups].sort((left, right) => comparePoolGroups(left, right, 'rarity', constraints, 'asc')).map(([label]) => label)).toEqual([
      '4★',
      '6★',
    ])

    expect([...groups].sort((left, right) => comparePoolGroups(left, right, 'rarity', constraints, 'desc')).map(([label]) => label)).toEqual([
      '6★',
      '4★',
    ])
  })

  it('collapses every current group and expands back to none collapsed', () => {
    const alpha = operator('alpha', 'Alpha', 6, 'Guard', '2023-01-01')
    const beta = operator('beta', 'Beta', 5, 'Caster', '2022-01-01')
    const groups = [
      ['Guard', [alpha]],
      ['Caster', [beta]],
    ] as const

    expect([...collapseAllPoolGroups(groups)]).toEqual(['Guard', 'Caster'])
    expect(expandAllPoolGroups().size).toBe(0)
  })
})
