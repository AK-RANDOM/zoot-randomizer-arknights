import { describe, expect, it } from 'vitest'
import { createDefaultConstraints, validateConstraintShape } from './constraints'
import type { Operator } from './operator'
import {
  filterEligibleOperators,
  filterHigherLevelEligibleOperators,
  generateSquad,
} from './randomizer'

function operator(
  id: string,
  extras: Partial<Operator> = {},
): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2022-01-01', yearGroup: 3 },
      global: { date: '2022-01-01', yearGroup: 3 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
    ...extras,
  }
}

describe('Iteration 6 higher-level operator eligibility', () => {
  it('keeps the legacy eligibility export delegated to the canonical higher-level stage', () => {
    const constraints = createDefaultConstraints()
    const operators = [operator('a'), operator('b')]

    expect(filterEligibleOperators(operators, constraints)).toEqual(
      filterHigherLevelEligibleOperators(operators, constraints),
    )
  })

  it('uses the selected region for availability, release metadata, and Kernel classification', () => {
    const cnAhead = operator('cn-ahead', {
      availableOn: { cn: true, global: false },
      release: {
        cn: { date: '2022-07-05', yearGroup: 4 },
        global: { date: null, yearGroup: null },
      },
    })
    const globalBoundary = operator('global-boundary', {
      release: {
        cn: { date: '2022-07-06', yearGroup: 4 },
        global: { date: '2022-06-30', yearGroup: 3 },
      },
    })

    const global = createDefaultConstraints()
    global.release.server = 'global'
    global.era = 'kernel'
    expect(filterHigherLevelEligibleOperators([cnAhead, globalBoundary], global).map(({ id }) => id)).toEqual([
      'global-boundary',
    ])

    const cn = createDefaultConstraints()
    cn.release.server = 'cn'
    cn.era = 'kernel'
    expect(filterHigherLevelEligibleOperators([cnAhead, globalBoundary], cn).map(({ id }) => id)).toEqual([
      'cn-ahead',
    ])
  })

  it('filters subclasses by stable IDs while leaving new/unmentioned IDs enabled', () => {
    const constraints = createDefaultConstraints()
    constraints.subclass.excludedIds = ['lord']

    const eligible = filterHigherLevelEligibleOperators(
      [
        operator('lord', { subclass: { id: 'lord', name: 'Lord' } }),
        operator('fighter', { subclass: { id: 'fighter', name: 'Fighter' } }),
        operator('future', { subclass: { id: 'future_branch', name: 'Future Branch' } }),
      ],
      constraints,
    )

    expect(eligible.map(({ id }) => id)).toEqual(['fighter', 'future'])
  })

  it('supports canonical main-faction matching and any-affiliation matching', () => {
    const multiFaction = operator('multi', {
      faction: {
        main: 'rhodes',
        affiliations: ['rhodes', 'kazimierz'],
      },
    })

    const mainOnly = createDefaultConstraints()
    mainOnly.faction.excludedIds = ['rhodes']
    mainOnly.faction.matchMode = 'main'
    expect(filterHigherLevelEligibleOperators([multiFaction], mainOnly)).toEqual([])

    const anyAffiliation = createDefaultConstraints()
    anyAffiliation.faction.excludedIds = ['rhodes']
    anyAffiliation.faction.matchMode = 'any'
    expect(filterHigherLevelEligibleOperators([multiFaction], anyAffiliation).map(({ id }) => id)).toEqual([
      'multi',
    ])

    anyAffiliation.faction.excludedIds = ['rhodes', 'kazimierz']
    expect(filterHigherLevelEligibleOperators([multiFaction], anyAffiliation)).toEqual([])
  })

  it('treats Kernel era as a release-date classification for every acquisition family', () => {
    const constraints = createDefaultConstraints()
    constraints.release.server = 'global'
    constraints.era = 'kernel'

    const eligible = filterHigherLevelEligibleOperators(
      [
        operator('standard'),
        operator('limited', {
          acquisition: { family: 'limited', group: 'anniversary' },
        }),
        operator('welfare', {
          acquisition: { family: 'welfare', group: 'eventStory' },
        }),
        operator('collab', {
          acquisition: { family: 'limited', group: 'collab' },
          collaboration: 'Test Collab',
        }),
        operator('post-kernel', {
          release: {
            cn: { date: '2023-01-01', yearGroup: 4 },
            global: { date: '2023-01-01', yearGroup: 4 },
          },
        }),
      ],
      constraints,
    )

    expect(eligible.map(({ id }) => id)).toEqual([
      'standard',
      'limited',
      'welfare',
      'collab',
    ])
  })

  it('feeds the same higher-level eligibility into generation and feasibility', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 1
    constraints.subclass.excludedIds = ['lord']

    const lord = operator('lord')
    const fighter = operator('fighter', {
      subclass: { id: 'fighter', name: 'Fighter' },
    })

    expect(generateSquad([lord, fighter], constraints, () => 0).map(({ id }) => id)).toEqual([
      'fighter',
    ])
  })

  it('validates sparse filter state rather than silently accepting malformed IDs or modes', () => {
    const duplicateSubclass = createDefaultConstraints()
    duplicateSubclass.subclass.excludedIds = ['lord', 'lord']
    expect(validateConstraintShape(duplicateSubclass)).toContain(
      'Subclass exclusions must contain unique non-empty IDs.',
    )

    const duplicateFaction = createDefaultConstraints()
    duplicateFaction.faction.excludedIds = ['rhodes', 'rhodes']
    expect(validateConstraintShape(duplicateFaction)).toContain(
      'Faction exclusions must contain unique non-empty IDs.',
    )
  })
})
