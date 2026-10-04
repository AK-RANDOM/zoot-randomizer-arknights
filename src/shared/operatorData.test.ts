import { describe, expect, it } from 'vitest'
import {
  CLASS_ICON_FILES,
  classLabelsFromMainText,
  factionLabelsFromHandbook,
  factionLabelsFromHandbooks,
  normalizeCharacterTables,
  normalizeFaction,
  normalizeRarity,
  validateOperatorDataset,
} from './operatorData'
import { OPERATOR_DATASET_SCHEMA_VERSION, operatorClasses } from './operator'
import { localizeOperatorDataset } from './gameLocalization'
import {
  KERNEL_CUTOFF_BY_SERVER,
  SUBCLASS_LABELS,
  operatorEraForRelease,
} from './operatorMetadata'
import { releaseYearGroup } from './releaseMetadata'

const sources = {
  gamedataCnCommit: 'cn',
  gamedataEnCommit: 'en',
  gamedataJpCommit: 'jp',
  gamedataKrCommit: 'kr',
  gamedataTwCommit: 'tw',
  resourcesCommit: 'assets',
  releaseMetadataCommit: 'release',
}

const handbookTeams = {
  rhodes: { powerId: 'rhodes', powerName: 'Rhodes Island' },
  laterano: { powerId: 'laterano', powerName: 'Laterano' },
  penguin: { powerId: 'penguin', powerName: 'Penguin Logistics' },
  columbia: { powerId: 'columbia', powerName: 'Columbia' },
}

describe('operator data normalization', () => {
  it('maps an offline class icon for every operator class', () => {
    expect(Object.keys(CLASS_ICON_FILES).sort()).toEqual([...operatorClasses].sort())
    expect(Object.values(CLASS_ICON_FILES).every((filename) => filename.endsWith('.svg'))).toBe(true)
  })

  it('reads localized class labels from game text keys', () => {
    expect(
      classLabelsFromMainText({
        '&&f2jpay62qnj6aw1c': '先鋒',
        '&&xov9ihvv9n8frbnt': '前衛',
      }),
    ).toMatchObject({
      Vanguard: '先鋒',
      Guard: '前衛',
      Medic: 'Medic',
    })
  })

  it('normalizes zero-based and tier rarity formats', () => {
    expect(normalizeRarity(0)).toBe(1)
    expect(normalizeRarity(5)).toBe(6)
    expect(normalizeRarity('TIER_6')).toBe(6)
  })

  it('maintains an English label for every current playable subclass ID', () => {
    expect(Object.keys(SUBCLASS_LABELS)).toHaveLength(72)
    expect(SUBCLASS_LABELS.fastshot).toBe('Marksman')
    expect(SUBCLASS_LABELS.counsellor).toBe('Strategist')
    expect(SUBCLASS_LABELS.skywalker).toBe('Skyranger')
    expect(SUBCLASS_LABELS.soulcaster).toBe('Shaper Caster')
  })

  it('uses launch-only Year 0 and increments at anniversary boundaries', () => {
    expect(releaseYearGroup('2019-05-01', 'cn')).toBe(0)
    expect(releaseYearGroup('2019-05-02', 'cn')).toBe(1)
    expect(releaseYearGroup('2020-04-30', 'cn')).toBe(1)
    expect(releaseYearGroup('2020-05-01', 'cn')).toBe(2)
    expect(releaseYearGroup('2024-05-01', 'cn')).toBe(6)

    expect(releaseYearGroup('2020-01-16', 'global')).toBe(0)
    expect(releaseYearGroup('2020-01-17', 'global')).toBe(1)
    expect(releaseYearGroup('2020-12-30', 'global')).toBe(2)
  })

  it('classifies Kernel era inclusively at each region cutoff', () => {
    expect(KERNEL_CUTOFF_BY_SERVER.global).toBe('2022-06-30')
    expect(operatorEraForRelease('2022-06-30', 'global')).toBe('kernel')
    expect(operatorEraForRelease('2022-07-01', 'global')).toBe('postKernel')

    expect(KERNEL_CUTOFF_BY_SERVER.cn).toBe('2022-07-05')
    expect(operatorEraForRelease('2022-07-05', 'cn')).toBe('kernel')
    expect(operatorEraForRelease('2022-07-06', 'cn')).toBe('postKernel')
    expect(operatorEraForRelease(null, 'cn')).toBeNull()
  })

  it('normalizes canonical main faction separately from all affiliations', () => {
    expect(
      normalizeFaction({
        nationId: 'laterano',
        groupId: 'penguin',
        teamId: null,
        mainPower: { nationId: 'laterano', groupId: 'penguin', teamId: null },
      }),
    ).toEqual({
      main: 'penguin',
      affiliations: ['laterano', 'penguin'],
    })

    expect(factionLabelsFromHandbook(handbookTeams)).toMatchObject({
      laterano: 'Laterano',
      penguin: 'Penguin Logistics',
    })
  })

  it('uses CN powerCode as the English fallback and lets EN localized names override it', () => {
    const cn = {
      sees: { powerId: 'sees', powerName: '特别课外活动部', powerCode: 'S.E.E.S.' },
      rhodes: { powerId: 'rhodes', powerName: '罗德岛', powerCode: 'Rhodes Island' },
    }
    const en = {
      rhodes: {
        powerId: 'rhodes',
        powerName: 'Rhodes Island',
        powerCode: 'Rhodes Island',
      },
    }

    expect(factionLabelsFromHandbooks(cn, en)).toEqual({
      sees: 'S.E.E.S.',
      rhodes: 'Rhodes Island',
    })
  })

  it('uses EN names, marks CN-only availability, and records releases/taxonomy', () => {
    const dataset = normalizeCharacterTables(
      {
        char_global: {
          name: '全局',
          appellation: 'Global CN Appellation',
          rarity: 5,
          profession: 'WARRIOR',
          subProfessionId: 'lord',
          nationId: 'laterano',
          groupId: 'penguin',
          mainPower: { nationId: 'laterano', groupId: 'penguin' },
          isNotObtainable: false,
        },
        char_cnonly: {
          name: '仅国服',
          appellation: 'CN Only',
          rarity: 4,
          profession: 'CASTER',
          subProfessionId: 'corecaster',
          nationId: 'columbia',
          mainPower: { nationId: 'columbia' },
          isNotObtainable: false,
        },
        char_temp: {
          name: 'Temporary',
          rarity: 5,
          profession: 'WARRIOR',
          subProfessionId: 'lord',
          isNotObtainable: true,
        },
      },
      {
        char_global: {
          name: 'Global Name',
          rarity: 5,
          profession: 'WARRIOR',
          subProfessionId: 'lord',
          nationId: 'laterano',
          groupId: 'penguin',
          mainPower: { nationId: 'laterano', groupId: 'penguin' },
          isNotObtainable: false,
        },
      },
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        enHandbookTeams: handbookTeams,
        releaseDates: {
          char_global: { cn: '2020-05-01', global: '2020-12-30' },
          char_cnonly: { cn: '2024-05-01', global: null },
        },
      },
    )

    expect(dataset.schemaVersion).toBe(OPERATOR_DATASET_SCHEMA_VERSION)
    expect(dataset.factionLabels.penguin).toBe('Penguin Logistics')
    expect(dataset.operators).toHaveLength(2)
    expect(dataset.operators.find((item) => item.id === 'char_global')).toMatchObject({
      name: 'Global Name',
      rarity: 6,
      class: 'Guard',
      subclass: { id: 'lord', name: 'Lord' },
      faction: { main: 'penguin', affiliations: ['laterano', 'penguin'] },
      availableOn: { cn: true, global: true },
      release: {
        cn: { date: '2020-05-01', yearGroup: 2 },
        global: { date: '2020-12-30', yearGroup: 2 },
      },
    })
    expect(dataset.operators.find((item) => item.id === 'char_cnonly')).toMatchObject({
      name: 'CN Only',
      rarity: 5,
      class: 'Caster',
      subclass: { id: 'corecaster', name: 'Core Caster' },
      faction: { main: 'columbia', affiliations: ['columbia'] },
      availableOn: { cn: true, global: false },
      release: {
        cn: { date: '2024-05-01', yearGroup: 6 },
        global: { date: null, yearGroup: null },
      },
    })
  })

  it('localizes game strings with JP and TW-to-EN fallback without changing identity', () => {
    const dataset = normalizeCharacterTables(
      {
        char_global: {
          name: '全局',
          rarity: 5,
          profession: 'WARRIOR',
          subProfessionId: 'lord',
          nationId: 'rhodes',
          mainPower: { nationId: 'rhodes' },
          isNotObtainable: false,
        },
      },
      {
        char_global: {
          name: 'Global Name',
          rarity: 5,
          profession: 'WARRIOR',
          subProfessionId: 'lord',
          nationId: 'rhodes',
          mainPower: { nationId: 'rhodes' },
          isNotObtainable: false,
        },
      },
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        localizedCharacterTables: {
          jp: { char_global: { name: 'グローバル' } },
          tw: {},
        },
        localizedClassLabels: {
          jp: { Guard: '前衛' },
        },
        localizedFactionLabels: {
          en: { rhodes: 'Rhodes Island' },
          jp: { rhodes: 'ロドス・アイランド' },
          tw: {},
        },
      },
    )

    const jp = localizeOperatorDataset(dataset, 'jp')
    const tw = localizeOperatorDataset(dataset, 'tw')

    expect(jp.operators[0]).toMatchObject({
      id: 'char_global',
      name: 'グローバル',
      class: 'Guard',
      subclass: { id: 'lord', name: 'Lord' },
      faction: { main: 'rhodes' },
    })
    expect(jp.classLabels?.Guard).toBe('前衛')
    expect(jp.factionLabels.rhodes).toBe('ロドス・アイランド')
    expect(tw.operators[0].name).toBe('Global Name')
  })

  it('adds Amiya class-change forms and makes them always exclusive', () => {
    const base = {
      name: 'Amiya',
      rarity: 'TIER_5',
      isNotObtainable: false,
      nationId: 'rhodes',
      mainPower: { nationId: 'rhodes' },
    }
    const dataset = normalizeCharacterTables(
      {
        char_002_amiya: { ...base, profession: 'CASTER', subProfessionId: 'corecaster' },
      },
      {
        char_002_amiya: { ...base, profession: 'CASTER', subProfessionId: 'corecaster' },
      },
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        enPatch: {
          patchChars: {
            char_1001_amiya2: {
              ...base,
              profession: 'WARRIOR',
              subProfessionId: 'artsfghter',
            },
            char_1037_amiya3: {
              ...base,
              profession: 'MEDIC',
              subProfessionId: 'incantationmedic',
            },
          },
        },
        cnPatch: {
          patchChars: {
            char_1001_amiya2: {
              ...base,
              profession: 'WARRIOR',
              subProfessionId: 'artsfghter',
            },
            char_1037_amiya3: {
              ...base,
              profession: 'MEDIC',
              subProfessionId: 'incantationmedic',
            },
          },
        },
        enHandbookTeams: handbookTeams,
        releaseDates: {
          char_002_amiya: { cn: '2019-05-01', global: '2020-01-16' },
          char_1001_amiya2: { cn: '2020-11-01', global: '2021-04-30' },
          char_1037_amiya3: { cn: '2024-05-01', global: '2024-10-31' },
        },
      },
    )

    expect(dataset.operators.map((item) => item.name).sort()).toEqual([
      'Amiya (Caster)',
      'Amiya (Guard)',
      'Amiya (Medic)',
    ])
    expect(
      dataset.operators.every(
        (item) => item.mandatoryExclusivityGroup === 'amiya-forms',
      ),
    ).toBe(true)
  })

  it('derives multi-version alter families from game metadata', () => {
    const records = {
      char_base: {
        name: 'Base',
        rarity: 5,
        profession: 'WARRIOR',
        subProfessionId: 'lord',
        isNotObtainable: false,
      },
      char_alter: {
        name: 'Alter',
        rarity: 5,
        profession: 'SNIPER',
        subProfessionId: 'fastshot',
        isNotObtainable: false,
      },
      char_alter2: {
        name: 'Alter 2',
        rarity: 5,
        profession: 'CASTER',
        subProfessionId: 'corecaster',
        isNotObtainable: false,
      },
    }
    const dataset = normalizeCharacterTables(
      records,
      records,
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        charMeta: {
          spCharGroups: {
            char_base: ['char_base', 'char_alter', 'char_alter2'],
          },
        },
      },
    )

    expect(new Set(dataset.operators.map((item) => item.alterGroup))).toEqual(
      new Set(['alter:char_base']),
    )
  })

  it('validates a generated localized dataset', () => {
    const dataset = normalizeCharacterTables(
      {
        char_test: {
          name: '测试',
          appellation: 'Test',
          rarity: 0,
          profession: 'PIONEER',
          subProfessionId: 'pioneer',
          nationId: 'rhodes',
          mainPower: { nationId: 'rhodes' },
          isNotObtainable: false,
        },
      },
      {},
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        enHandbookTeams: handbookTeams,
        releaseDates: {
          char_test: { cn: '2024-01-01', global: null },
        },
      },
    )

    const validation = validateOperatorDataset(dataset, {
      minimumOperators: 1,
      maximumOperators: 10,
      requireSourceCommits: true,
    })

    expect(validation.valid).toBe(true)
  })

  it('fails validation for an unmapped subclass instead of silently shipping it', () => {
    const dataset = normalizeCharacterTables(
      {
        char_test: {
          name: '测试',
          rarity: 0,
          profession: 'PIONEER',
          subProfessionId: 'future_branch',
          isNotObtainable: false,
        },
      },
      {},
      sources,
      '2026-10-02T00:00:00.000Z',
      {
        releaseDates: { char_test: { cn: '2024-01-01', global: null } },
      },
    )

    const validation = validateOperatorDataset(dataset, {
      minimumOperators: 1,
      maximumOperators: 10,
    })
    expect(validation.valid).toBe(false)
    expect(validation.errors.some((error) => error.includes('unknown subclass'))).toBe(true)
  })
})
