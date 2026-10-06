import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import { localizeOperatorDataset } from './gameLocalization'
import type { GameStringCatalog, Operator, OperatorClass, OperatorDataset } from './operator'
import { buildRaceFilterGroups } from './operatorFilterCatalog'
import { buildFinalOperatorPool, buildGlobalFilterOperatorPool } from './operatorPool'

const COMMON_RACE = 'race:cn:common'
const RARE_RACE = 'race:cn:rare'
const ONE_OFF_RACE = 'race:cn:one-off'
const UNTRANSLATED_RACE = 'race:cn:untranslated'

function operator(id: string, raceId: string): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    raceIds: [raceId],
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
  }
}

function filterDataset(): OperatorDataset {
  return {
    schemaVersion: 6,
    generatedAt: null,
    sources: {
      gamedataCnCommit: null,
      gamedataEnCommit: null,
      resourcesCommit: null,
      releaseMetadataCommit: null,
    },
    factionLabels: { rhodes: 'Rhodes Island' },
    raceLabels: {
      [COMMON_RACE]: 'Common',
      [RARE_RACE]: 'Rare',
      [ONE_OFF_RACE]: 'One-off',
      [UNTRANSLATED_RACE]: 'Untranslated',
    },
    operators: [
      ...Array.from({ length: 5 }, (_, index) => operator(`common_${index}`, COMMON_RACE)),
      ...Array.from({ length: 3 }, (_, index) => operator(`rare_${index}`, RARE_RACE)),
      operator('one_off', ONE_OFF_RACE),
      operator('untranslated', UNTRANSLATED_RACE),
    ],
  }
}

const classLabels = {} as Record<OperatorClass, string>

function catalog(raceLabels: Record<string, string> = {}): GameStringCatalog {
  return {
    operatorNames: {},
    classLabels,
    subclassLabels: {},
    factionLabels: {},
    raceLabels,
  }
}

function localizationDataset(): OperatorDataset {
  return {
    schemaVersion: 6,
    generatedAt: null,
    sources: {
      gamedataCnCommit: null,
      gamedataEnCommit: null,
      resourcesCommit: null,
      releaseMetadataCommit: null,
    },
    classLabels,
    factionLabels: { rhodes: 'Rhodes Island' },
    raceLabels: {
      [COMMON_RACE]: 'Oni',
      [UNTRANSLATED_RACE]: '新种族',
    },
    localizations: {
      en: catalog({ [COMMON_RACE]: 'Oni' }),
      jp: catalog(),
      kr: catalog(),
      tw: catalog(),
      cn: catalog({ [COMMON_RACE]: '鬼', [UNTRANSLATED_RACE]: '新种族' }),
    },
    operators: [operator('translated', COMMON_RACE), operator('untranslated', UNTRANSLATED_RACE)],
  }
}

describe('#57 milestone 1 Global Pool foundation', () => {
  it('applies Race exclusions in the canonical Global Filter before Curate exclusions', () => {
    const constraints = createDefaultConstraints()
    constraints.race = { excludedIds: [COMMON_RACE] }
    const roster = [operator('common', COMMON_RACE), operator('rare', RARE_RACE)]

    expect(buildGlobalFilterOperatorPool(roster, constraints).map(({ id }) => id)).toEqual(['rare'])
    expect(buildFinalOperatorPool(roster, constraints, ['rare']).map(({ id }) => id)).toEqual([])
  })

  it('groups Race choices from the loaded dataset using the Milestone 1 thresholds', () => {
    const groups = buildRaceFilterGroups(filterDataset())

    expect(
      groups.map(({ key, races }) => [
        key,
        races.map(({ id, operatorCount }) => [id, operatorCount]),
      ]),
    ).toEqual([
      ['common', [[COMMON_RACE, 5]]],
      ['rare', [[RARE_RACE, 3]]],
      ['oneOff', [[ONE_OFF_RACE, 1]]],
    ])
  })

  it('omits unresolved Race labels from the filter UI instead of showing Untranslated', () => {
    const raceIds = buildRaceFilterGroups(filterDataset()).flatMap(({ races }) =>
      races.map(({ id }) => id),
    )

    expect(raceIds).not.toContain(UNTRANSLATED_RACE)
  })

  it('does not fall through to a CN Race string when English Race text is unavailable', () => {
    const source = localizationDataset()
    const localized = localizeOperatorDataset(source, 'en')

    expect(localized.raceLabels?.[COMMON_RACE]).toBe('Oni')
    expect(localized.raceLabels?.[UNTRANSLATED_RACE]).toBe('Untranslated')
    expect(localized.operators.map(({ raceIds }) => raceIds)).toEqual(
      source.operators.map(({ raceIds }) => raceIds),
    )
  })
})
