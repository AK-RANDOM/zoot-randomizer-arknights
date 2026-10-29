import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import type { ImportedArknightsAccount } from './arknightsAccount'
import type { Operator } from './operator'
import {
  applyAccountFilter,
  applyManualOperatorExclusions,
  applyRaceExclusions,
  buildFinalOperatorPool,
  createDefaultOperatorPreferences,
  normalizeOperatorPreferences,
  reconcileOperatorPreferences,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
} from './operatorPool'
import { filterHigherLevelEligibleOperators } from './randomizer'
import { RACE_UNAVAILABLE_ID } from './raceMetadata'

function operator(id: string, date: string, extras: Partial<Operator> = {}): Operator {
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
      version: 7,
      metadataRegion: 'global',
      gameLocale: 'en',
      poolPresentation: 'imageGrid',
      accountFilterMode: 'ignore',
      accountProgressionMin: { elite: 0, level: 1 },
      accountProgressionMax: { elite: 2, level: 90 },
      showAccountProgression: false,
      excludedOperatorIds: [],
      operatorAppearances: {},
      appearanceRandomSeed: 1,
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
      version: 7,
      metadataRegion: 'cn',
      gameLocale: 'en',
      poolPresentation: 'detailedList',
      accountFilterMode: 'ignore',
      accountProgressionMin: { elite: 0, level: 1 },
      accountProgressionMax: { elite: 2, level: 90 },
      showAccountProgression: false,
      excludedOperatorIds: ['char_a', 'char_b'],
      operatorAppearances: {},
      appearanceRandomSeed: 1,
    })
  })

  it('persists a supported game localization independently from metadata region', () => {
    expect(
      normalizeOperatorPreferences({
        version: 5,
        metadataRegion: 'global',
        gameLocale: 'jp',
        poolPresentation: 'compactCard',
        ownedOperatorsOnly: true,
        excludedOperatorIds: [],
      }),
    ).toMatchObject({
      version: 7,
      metadataRegion: 'global',
      gameLocale: 'jp',
      poolPresentation: 'compactCard',
      accountFilterMode: 'owned',
    })
  })

  it('clamps saved progression bounds to valid generic elite-stage levels', () => {
    expect(
      normalizeOperatorPreferences({
        version: 6,
        accountProgressionMin: { elite: 0, level: 90 },
        accountProgressionMax: { elite: 1, level: 90 },
      }),
    ).toMatchObject({
      version: 7,
      accountProgressionMin: { elite: 0, level: 50 },
      accountProgressionMax: { elite: 1, level: 80 },
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
    expect(applyManualOperatorExclusions(roster, ['char_old']).map(({ id }) => id)).toEqual([
      'char_tragodia',
      'char_new',
    ])
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

  it('applies account ownership and progression inside the Global Filter before Curate exclusions', () => {
    const constraints = createDefaultConstraints()
    const snapshot: ImportedArknightsAccount = {
      schemaVersion: 1,
      server: 'en',
      operators: [
        { operatorId: 'char_old', elite: 0, level: 60 },
        { operatorId: 'char_tragodia', elite: 2, level: 30 },
      ],
      ownedSkinIds: [],
      fetchedAt: '2026-10-17T00:00:00.000Z',
    }

    expect(
      applyAccountFilter(
        roster,
        snapshot,
        'owned',
        { elite: 0, level: 1 },
        { elite: 2, level: 90 },
      ).map(({ id }) => id),
    ).toEqual(['char_old', 'char_tragodia'])

    expect(
      applyAccountFilter(
        roster,
        snapshot,
        'progression',
        { elite: 1, level: 1 },
        { elite: 2, level: 90 },
      ).map(({ id }) => id),
    ).toEqual(['char_tragodia'])

    expect(
      buildFinalOperatorPool(roster, constraints, ['char_tragodia'], {
        snapshot,
        mode: 'owned',
        minimum: { elite: 0, level: 1 },
        maximum: { elite: 2, level: 90 },
      }).map(({ id }) => id),
    ).toEqual(['char_old'])
  })

  it('leaves the pool unchanged when account filtering has no saved account snapshot', () => {
    const constraints = createDefaultConstraints()
    expect(
      buildFinalOperatorPool(roster, constraints, [], {
        snapshot: null,
        mode: 'owned',
        minimum: { elite: 0, level: 1 },
        maximum: { elite: 2, level: 90 },
      }).map(({ id }) => id),
    ).toEqual(['char_old', 'char_tragodia', 'char_new'])
  })

  it('applies stable Race exclusions to the same final pool used by Standard and Draft', () => {
    const raceRoster = [
      operator('char_oni', '2024-01-01', { raceIds: ['race:cn:%E9%AC%BC'] }),
      operator('char_sankta', '2024-01-01', { raceIds: ['race:cn:%E8%90%A8%E7%A7%91%E5%A1%94'] }),
      operator('char_legacy', '2024-01-01'),
    ]
    const excludedRaceIds = ['race:cn:%E9%AC%BC', RACE_UNAVAILABLE_ID]
    const constraints = createDefaultConstraints()
    constraints.race = { excludedIds: excludedRaceIds }

    expect(applyRaceExclusions(raceRoster, excludedRaceIds).map(({ id }) => id)).toEqual([
      'char_sankta',
    ])
    expect(buildFinalOperatorPool(raceRoster, constraints, []).map(({ id }) => id)).toEqual([
      'char_sankta',
    ])
  })

  it('treats pre-M6 constraints with no Race field as no Race exclusions', () => {
    const raceRoster = [
      operator('char_oni', '2024-01-01', { raceIds: ['race:cn:%E9%AC%BC'] }),
      operator('char_legacy', '2024-01-01'),
    ]
    const constraints = createDefaultConstraints()
    delete constraints.race

    expect(buildFinalOperatorPool(raceRoster, constraints, []).map(({ id }) => id)).toEqual([
      'char_oni',
      'char_legacy',
    ])
  })

  it('persists explicit account appearance mode while migrating older preference versions', () => {
    expect(
      normalizeOperatorPreferences({
        version: 4,
        metadataRegion: 'global',
        gameLocale: 'en',
        poolPresentation: 'imageGrid',
        ownedOperatorsOnly: true,
        excludedOperatorIds: [],
        operatorAppearances: { char_old: 'account' },
        appearanceRandomSeed: 1,
      }),
    ).toMatchObject({
      version: 7,
      accountFilterMode: 'owned',
      operatorAppearances: { char_old: 'account' },
    })
  })

  it('toggles one operator without rewriting unrelated exclusions', () => {
    expect(setOperatorExcluded(['char_a'], 'char_b', true)).toEqual(['char_a', 'char_b'])
    expect(setOperatorExcluded(['char_a', 'char_b'], 'char_a', false)).toEqual(['char_b'])
  })

  it('bulk add/remove acts only on the displayed IDs', () => {
    const initial = ['char_hidden', 'char_a']
    const removedDisplayed = setDisplayedOperatorsExcluded(initial, ['char_a', 'char_b'], true)
    expect(removedDisplayed).toEqual(['char_hidden', 'char_a', 'char_b'])

    const addedDisplayed = setDisplayedOperatorsExcluded(
      removedDisplayed,
      ['char_a', 'char_b'],
      false,
    )
    expect(addedDisplayed).toEqual(['char_hidden'])
  })
})
