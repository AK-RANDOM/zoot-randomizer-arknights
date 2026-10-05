import { describe, expect, it } from 'vitest'
import { GAME_LOCALE_FALLBACKS, localizeOperatorDataset } from './gameLocalization'
import type {
  GameStringCatalog,
  Operator,
  OperatorClass,
  OperatorDataset,
} from './operator'

const englishClassLabels: Record<OperatorClass, string> = {
  Vanguard: 'Vanguard',
  Guard: 'Guard',
  Defender: 'Defender',
  Sniper: 'Sniper',
  Caster: 'Caster',
  Medic: 'Medic',
  Supporter: 'Supporter',
  Specialist: 'Specialist',
}

const oniRaceId = 'race:cn:%E9%AC%BC'

function operator(id: string, name: string, raceIds?: string[]): Operator {
  return {
    id,
    name,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    raceIds,
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2020-01-01', yearGroup: 1 },
      global: { date: '2020-01-01', yearGroup: 1 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

function catalog(overrides: Partial<GameStringCatalog> = {}): GameStringCatalog {
  return {
    operatorNames: {},
    classLabels: { ...englishClassLabels },
    subclassLabels: {},
    factionLabels: {},
    raceLabels: {},
    ...overrides,
  }
}

function dataset(): OperatorDataset {
  return {
    schemaVersion: 6,
    generatedAt: '2026-10-04T00:00:00.000Z',
    sources: {
      gamedataCnCommit: 'cn',
      gamedataEnCommit: 'en',
      gamedataJpCommit: 'jp',
      gamedataKrCommit: 'kr',
      gamedataTwCommit: 'tw',
      resourcesCommit: 'resources',
      releaseMetadataCommit: 'release',
    },
    classLabels: { ...englishClassLabels },
    factionLabels: { rhodes: 'Rhodes Island' },
    raceLabels: { [oniRaceId]: 'Oni' },
    localizations: {
      en: catalog({
        operatorNames: { char_a: 'Alpha', char_b: 'Beta' },
        subclassLabels: { lord: 'Lord' },
        factionLabels: { rhodes: 'Rhodes Island' },
        raceLabels: { [oniRaceId]: 'Oni' },
      }),
      jp: catalog({
        operatorNames: { char_a: 'ゼータ', char_b: 'アルファ' },
        classLabels: { ...englishClassLabels, Guard: '前衛' },
        factionLabels: { rhodes: 'ロドス・アイランド' },
        raceLabels: { [oniRaceId]: '鬼' },
      }),
      kr: catalog(),
      tw: catalog({ operatorNames: { char_b: '貝塔' } }),
      cn: catalog({
        operatorNames: { char_a: '阿尔法', char_b: '贝塔' },
        classLabels: { ...englishClassLabels, Guard: '近卫' },
        factionLabels: { rhodes: '罗德岛' },
        raceLabels: { [oniRaceId]: '鬼' },
      }),
    },
    operators: [operator('char_a', 'Alpha', [oniRaceId]), operator('char_b', 'Beta')],
  }
}

describe('game localization', () => {
  it('uses deterministic locale fallback chains', () => {
    expect(GAME_LOCALE_FALLBACKS.tw).toEqual(['tw', 'en', 'cn'])
    expect(GAME_LOCALE_FALLBACKS.jp).toEqual(['jp', 'en', 'cn'])
    expect(GAME_LOCALE_FALLBACKS.kr).toEqual(['kr', 'en', 'cn'])
    expect(GAME_LOCALE_FALLBACKS.cn).toEqual(['cn', 'en'])
  })

  it('preserves the existing default English presentation and canonical data', () => {
    const source = dataset()
    const localized = localizeOperatorDataset(source, 'en')

    expect(localized.operators).toEqual(source.operators)
    expect(localized.classLabels).toEqual(source.classLabels)
    expect(localized.factionLabels).toEqual(source.factionLabels)
    expect(localized.raceLabels).toEqual(source.raceLabels)
    expect(localized.sources).toEqual(source.sources)
    expect(localized.generatedAt).toBe(source.generatedAt)
  })

  it('falls back missing TW strings to English before CN', () => {
    const localized = localizeOperatorDataset(dataset(), 'tw')
    expect(localized.operators.map(({ name }) => name)).toEqual(['Alpha', '貝塔'])
    expect(localized.factionLabels.rhodes).toBe('Rhodes Island')
    expect(localized.raceLabels?.[oniRaceId]).toBe('Oni')
    expect(localized.operators[0].subclass.name).toBe('Lord')
  })

  it('changes presentation without changing canonical operator ordering or identity', () => {
    const source = dataset()
    const localized = localizeOperatorDataset(source, 'jp')

    expect(localized.operators.map(({ id }) => id)).toEqual(['char_a', 'char_b'])
    expect(localized.operators.map(({ name }) => name)).toEqual(['ゼータ', 'アルファ'])
    expect(localized.operators.map(({ availableOn }) => availableOn)).toEqual(
      source.operators.map(({ availableOn }) => availableOn),
    )
    expect(localized.classLabels?.Guard).toBe('前衛')
    expect(localized.factionLabels.rhodes).toBe('ロドス・アイランド')
  })

  it('changes Race presentation without changing Race filter identity', () => {
    const source = dataset()
    const english = localizeOperatorDataset(source, 'en')
    const japanese = localizeOperatorDataset(source, 'jp')

    expect(english.raceLabels?.[oniRaceId]).toBe('Oni')
    expect(japanese.raceLabels?.[oniRaceId]).toBe('鬼')
    expect(japanese.operators.map(({ raceIds }) => raceIds)).toEqual(
      english.operators.map(({ raceIds }) => raceIds),
    )
    expect(japanese.operators[0].raceIds).toEqual([oniRaceId])
  })
})
