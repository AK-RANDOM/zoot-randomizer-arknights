import { describe, expect, it } from 'vitest'
import type { Operator, OperatorClass } from './operator'
import { buildSubclassFilterGroups, buildSubclassFilterOptions } from './operatorFilterCatalog'
import { createDraftRulebookSelectorCatalog } from './rulebook/selectors'
import type { OperatorDataset } from './operator'

function operator(
  id: string,
  branch: string,
  name: string,
  cn: string | null,
  global: string | null = cn,
  operatorClass: OperatorClass = 'Guard',
): Operator {
  return {
    id,
    name: id,
    class: operatorClass,
    rarity: 6,
    subclass: { id: branch, name },
    availableOn: { cn: true, global: global !== null },
    release: { cn: { date: cn, yearGroup: null }, global: { date: global, yearGroup: null } },
    faction: { main: null, affiliations: [] },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

describe('subclass display order', () => {
  it('sorts by the earliest CN operator release and alphabetizes launch and same-day ties', () => {
    const operators = [
      operator('later_lord', 'lord', 'Lord', '2026-01-01'),
      operator('newer', 'hammer', 'Earthshaker', '2024-04-11', '2024-04-01'),
      operator('launch_z', 'lord', 'Lord', '2019-05-01', '2020-03-01'),
      operator('reaper', 'reaper', 'Reaper', '2021-08-03'),
      operator('launch_a', 'artsfghter', 'Arts Fighter', '2019-05-01', '2020-01-16'),
      operator('sword', 'sword', 'Swordmaster', '2019-07-09', '2020-01-16'),
      operator('liberator', 'librator', 'Liberator', '2021-08-03'),
      operator('unknown', 'future', 'A future branch', null),
    ]
    const originalOrder = operators.map(({ id }) => id)
    expect(buildSubclassFilterOptions(operators).map(({ name }) => name)).toEqual([
      'Arts Fighter',
      'Lord',
      'Swordmaster',
      'Liberator',
      'Reaper',
      'Earthshaker',
      'A future branch',
    ])
    expect(operators.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('keeps original debut dates when the first operator is excluded from the eligible pool', () => {
    const earliest = operator('original', 'lord', 'Lord', '2019-05-01')
    const laterMember = operator('later', 'lord', 'Lord', '2026-01-01')
    const postLaunch = operator('other', 'sword', 'Swordmaster', '2019-07-09')
    const unrelated = operator('unavailable_branch', 'reaper', 'Reaper', '2021-08-03')
    const groups = buildSubclassFilterGroups({ operators: [postLaunch, laterMember] }, [
      laterMember,
      postLaunch,
      earliest,
      unrelated,
    ])
    expect(
      groups.find((group) => group.operatorClass === 'Guard')?.subclasses.map(({ id }) => id),
    ).toEqual(['lord', 'sword'])
    expect(groups.find((group) => group.operatorClass === 'Sniper')?.subclasses).toEqual([])
  })

  it('uses original CN chronology even when Global released the branches in a different order', () => {
    const operators = [
      operator('first_cn', 'first_cn', 'Zulu', '2020-01-01', '2022-01-01'),
      operator('first_global', 'first_global', 'Alpha', '2021-01-01', '2021-01-01'),
    ]
    expect(buildSubclassFilterOptions(operators).map(({ id }) => id)).toEqual([
      'first_cn',
      'first_global',
    ])
    const dataset = { operators, factionLabels: {} } as OperatorDataset
    expect(createDraftRulebookSelectorCatalog(dataset).subclasses.map(({ id }) => id)).toEqual([
      'first_cn',
      'first_global',
    ])
  })
})
