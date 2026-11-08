import { describe, expect, it } from 'vitest'
import { createDefaultConstraints, validateConstraintShape } from './constraints'
import type { Operator, StandardAcquisitionGroup } from './operator'
import {
  filterEligibleOperators,
  filterHigherLevelEligibleOperators,
  generateSquad,
} from './randomizer'

function operator(id: string, extras: Partial<Operator> = {}): Operator {
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

function enableOnlyStandardGroup(group: StandardAcquisitionGroup) {
  return { kernel: false, postKernel: false, lowRarity: false, [group]: true }
}

describe('Iteration 6 higher-level operator eligibility', () => {
  it('filters gender across stored metadata, legacy operators and unknown entries', () => {
    const constraints = createDefaultConstraints()
    const male = operator('char_4009_irene', { gender: 'male' })
    const female = operator('char_4048_doroth')
    const unknown = operator('unknown-gender')
    const roster = [male, female, unknown]

    expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual(roster)
    constraints.gender = { excludedIds: ['male', 'other'] }
    expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual([female])
    constraints.gender = { excludedIds: ['male', 'female', 'other'] }
    expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual([])
  })

  it('keeps the legacy eligibility export delegated to the canonical higher-level stage', () => {
    const constraints = createDefaultConstraints()
    const operators = [operator('a'), operator('b')]

    expect(filterEligibleOperators(operators, constraints)).toEqual(
      filterHigherLevelEligibleOperators(operators, constraints),
    )
  })

  it('uses the selected region for availability when filtering the Kernel roster', () => {
    const cnOnly = operator('char_377_gdglow', {
      availableOn: { cn: true, global: false },
    })
    const dorothy = operator('char_4048_doroth', {
      release: {
        cn: { date: null, yearGroup: null },
        global: { date: null, yearGroup: null },
      },
    })
    const constraints = createDefaultConstraints()
    constraints.acquisition.standard = enableOnlyStandardGroup('kernel')
    expect(filterHigherLevelEligibleOperators([cnOnly, dorothy], constraints)).toEqual([dorothy])

    constraints.release.server = 'cn'
    expect(filterHigherLevelEligibleOperators([cnOnly, dorothy], constraints)).toEqual([
      cnOnly,
      dorothy,
    ])
  })

  it('partitions Standard operators by actual Kernel membership and rarity', () => {
    const dorothy = operator('char_4048_doroth')
    const greyy = operator('char_1027_greyy2', { rarity: 5 })
    const pozyomka = operator('char_4055_bgsnow', {
      release: {
        cn: { date: '2022-08-11', yearGroup: 4 },
        global: { date: '2023-01-13', yearGroup: 4 },
      },
    })
    const cantabile = operator('char_497_ctable', { rarity: 5, release: pozyomka.release })
    const earlyFourStar = operator('early-four', { rarity: 4 })
    const lateThreeStar = operator('late-three', { rarity: 3, release: pozyomka.release })
    const roster = [dorothy, greyy, pozyomka, cantabile, earlyFourStar, lateThreeStar]

    for (const server of ['global', 'cn'] as const) {
      const constraints = createDefaultConstraints()
      constraints.release.server = server
      expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual(roster)

      constraints.acquisition.standard = enableOnlyStandardGroup('kernel')
      expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual([dorothy, greyy])

      constraints.acquisition.standard = enableOnlyStandardGroup('postKernel')
      expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual([pozyomka, cantabile])

      constraints.acquisition.standard = enableOnlyStandardGroup('lowRarity')
      expect(filterHigherLevelEligibleOperators(roster, constraints)).toEqual([
        earlyFourStar,
        lateThreeStar,
      ])
    }
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
        nationId: 'columbia',
        groupId: 'rhodes',
        primary: ['columbia', 'rhodes'],
        main: 'rhodes',
        affiliations: ['columbia', 'rhodes', 'kazimierz'],
      },
    })

    const mainOnly = createDefaultConstraints()
    mainOnly.faction.excludedIds = ['rhodes']
    mainOnly.faction.matchMode = 'main'
    expect(filterHigherLevelEligibleOperators([multiFaction], mainOnly)).toEqual([])

    const anyAffiliation = createDefaultConstraints()
    anyAffiliation.faction.excludedIds = ['rhodes']
    anyAffiliation.faction.matchMode = 'any'
    expect(
      filterHigherLevelEligibleOperators([multiFaction], anyAffiliation).map(({ id }) => id),
    ).toEqual(['multi'])

    anyAffiliation.faction.excludedIds = ['columbia', 'rhodes', 'kazimierz']
    expect(filterHigherLevelEligibleOperators([multiFaction], anyAffiliation)).toEqual([])
  })

  it('applies the Standard group toggles only to Standard operators', () => {
    const constraints = createDefaultConstraints()
    constraints.release.server = 'global'
    constraints.acquisition.standard = enableOnlyStandardGroup('kernel')

    const eligible = filterHigherLevelEligibleOperators(
      [
        operator('char_4048_doroth'),
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
            cn: { date: '2023-03-15', yearGroup: 4 },
            global: { date: '2023-03-15', yearGroup: 4 },
          },
        }),
      ],
      constraints,
    )

    expect(eligible.map(({ id }) => id)).toEqual(['char_4048_doroth', 'limited', 'welfare', 'collab'])
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
