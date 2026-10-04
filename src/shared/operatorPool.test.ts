import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import type { Operator } from './operator'
import {
  applyManualOperatorExclusions,
  buildFinalOperatorPool,
  createDefaultOperatorPreferences,
  normalizeOperatorPreferences,
  reconcileOperatorPreferences,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
} from './operatorPool'
import { filterHigherLevelEligibleOperators } from './randomizer'

function operator(
  id: string,
  date: string,
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
      cn: { date, yearGroup: 5 },
      global: { date, yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
    ...extras,
  }
}

const roster = [
  operator('char_old', '2024-01-01'),
  operator('char_tragodia', '2025-07-01'),
  operator('char_new', '2026-01-01'),
]

describe('Iteration 6 Pool persistence model', () => {
  it('defaults to Global metadata, image grid, and no explicit exclusions', () => {
    expect(createDefaultOperatorPreferences()).toEqual({
      version: 2,
      metadataRegion: 'global',
      gameLocale: 'en',
      poolPresentation: 'imageGrid',
      excludedOperatorIds: [],
    })
  })

  it('normalizes a versioned persisted envelope and deduplicates exclusions', () => {
    expect(
      normalizeOperatorPreferences({
        version: 1,
        metadataRegion: 'cn',
        poolPresentation: 'detailedList',
        excludedOperatorIds: ['char_a', 'char_a', '', 7, ' char_b '],
      }),
    ).toEqual({
      version: 2,
      metadataRegion: 'cn',
      gameLocale: 'en',
      poolPresentation: 'detailedList',
      excludedOperatorIds: ['char_a', 'char_b'],
    })
  })

  it('persists a supported game localization independently from metadata region', () => {
    expect(
      normalizeOperatorPreferences({
        version: 2,
        metadataRegion: 'global',
        gameLocale: 'jp',
        poolPresentation: 'compactCard',
        excludedOperatorIds: [],
      }),
    ).toMatchObject({
      version: 2,
      metadataRegion: 'global',
      gameLocale: 'jp',
      poolPresentation: 'compactCard',
    })
  })

  it('falls back safely for unknown preference versions', () => {
    expect(
      normalizeOperatorPreferences({
        version: 99,
        metadataRegion: 'cn',
        poolPresentation: 'detailedList',
        excludedOperatorIds: ['char_a'],
      }),
    ).toEqual(createDefaultOperatorPreferences())
  })

  it('keeps existing exclusions, prunes removed IDs, and enables new operators by default', () => {
    const preferences = {
      ...createDefaultOperatorPreferences(),
      excludedOperatorIds: ['char_old', 'char_removed'],
    }

    expect(reconcileOperatorPreferences(preferences, roster).excludedOperatorIds).toEqual([
      'char_old',
    ])
    expect(
      applyManualOperatorExclusions(roster, ['char_old']).map(({ id }) => id),
    ).toEqual(['char_tragodia', 'char_new'])
  })

  it('preserves a manual exclusion while higher-level filters temporarily hide that operator', () => {
    const constraints = createDefaultConstraints()
    const excluded = ['char_tragodia']

    expect(buildFinalOperatorPool(roster, constraints, excluded).map(({ id }) => id)).toEqual([
      'char_old',
      'char_new',
    ])

    constraints.release.maxDate = '2024-12-31'
    expect(filterHigherLevelEligibleOperators(roster, constraints).map(({ id }) => id)).toEqual([
      'char_old',
    ])
    expect(buildFinalOperatorPool(roster, constraints, excluded).map(({ id }) => id)).toEqual([
      'char_old',
    ])

    constraints.release.maxDate = ''
    expect(filterHigherLevelEligibleOperators(roster, constraints).map(({ id }) => id)).toEqual([
      'char_old',
      'char_tragodia',
      'char_new',
    ])
    expect(buildFinalOperatorPool(roster, constraints, excluded).map(({ id }) => id)).toEqual([
      'char_old',
      'char_new',
    ])
  })

  it('toggles one operator without rewriting unrelated exclusions', () => {
    expect(setOperatorExcluded(['char_a'], 'char_b', true)).toEqual(['char_a', 'char_b'])
    expect(setOperatorExcluded(['char_a', 'char_b'], 'char_a', false)).toEqual(['char_b'])
  })

  it('bulk add/remove acts only on the displayed IDs', () => {
    const initial = ['char_hidden', 'char_a']
    const removedDisplayed = setDisplayedOperatorsExcluded(
      initial,
      ['char_a', 'char_b'],
      true,
    )
    expect(removedDisplayed).toEqual(['char_hidden', 'char_a', 'char_b'])

    const addedDisplayed = setDisplayedOperatorsExcluded(
      removedDisplayed,
      ['char_a', 'char_b'],
      false,
    )
    expect(addedDisplayed).toEqual(['char_hidden'])
  })
})
