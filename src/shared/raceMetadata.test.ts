import { describe, expect, it } from 'vitest'
import type { GameLocale, OperatorDataset } from './operator'
import {
  RACE_UNAVAILABLE_ID,
  applyRaceMetadata,
  operatorRaceIds,
  raceIdFromSourceValue,
  raceValueFromHandbookRecord,
  raceValuesFromHandbook,
  type RawHandbookInfoRecord,
} from './raceMetadata'

function handbook(text: string): RawHandbookInfoRecord {
  return { storyTextAudio: [{ stories: [{ storyText: text }] }] }
}

function dataset(): OperatorDataset {
  return {
    schemaVersion: 6,
    generatedAt: null,
    sources: {
      gamedataCnCommit: null,
      gamedataEnCommit: null,
      resourcesCommit: null,
      releaseMetadataCommit: null,
    },
    factionLabels: {},
    operators: [
      {
        id: 'char_noir',
        name: 'Noir Corne',
        rarity: 2,
        class: 'Defender',
        subclass: { id: 'protector', name: 'Protector' },
        faction: { main: 'rhodes', affiliations: ['rhodes'] },
        availableOn: { cn: true, global: true },
        release: {
          cn: { date: null, yearGroup: null },
          global: { date: null, yearGroup: null },
        },
        acquisition: { family: 'standard', group: null },
        collaboration: null,
        alterGroup: null,
        mandatoryExclusivityGroup: null,
        imageFile: 'operators/char_noir.png',
      },
      {
        id: 'char_missing',
        name: 'Missing',
        rarity: 3,
        class: 'Guard',
        subclass: { id: 'fighter', name: 'Fighter' },
        faction: { main: 'rhodes', affiliations: ['rhodes'] },
        availableOn: { cn: true, global: true },
        release: {
          cn: { date: null, yearGroup: null },
          global: { date: null, yearGroup: null },
        },
        acquisition: { family: 'standard', group: null },
        collaboration: null,
        alterGroup: null,
        mandatoryExclusivityGroup: null,
        imageFile: 'operators/char_missing.png',
      },
    ],
  }
}

const localizedExamples: Array<[GameLocale, string, string]> = [
  ['en', '[Code Name] Noir Corne\n[Race] Oni\n[Place of Birth] Higashi', 'Oni'],
  ['jp', '【コードネーム】ノイルホーン\n【種族】鬼\n【出身】極東', '鬼'],
  ['kr', '[코드네임] 느와르 코르네\n[종족] 오니\n[출신] 극동', '오니'],
  ['tw', '【代號】黑角\n【種族】鬼\n【出身地】東國', '鬼'],
  ['cn', '【代号】黑角\n【种族】鬼\n【出身地】东国', '鬼'],
]

const representativeEnglishExamples: Array<[string, string, string | null]> = [
  ['Noir Corne', '[Code Name] Noir Corne\n[Race] Oni', 'Oni'],
  ['Exusiai', '[Code Name] Exusiai\n[Race] Sankta', 'Sankta'],
  ['Tachanka', '[Code Name] Tachanka\n[Race] Unknown', 'Unknown'],
  [
    'Conviction',
    '[Code Name] Conviction\n[Race] Unknown (Suspected Liberi)',
    'Unknown (Suspected Liberi)',
  ],
  [
    'Lancet-2',
    '[Model] Lancet-2\n[Gender Assignment] Female\n[Manufacturer] Raythean',
    null,
  ],
  ['Laios', '[Code Name] Laios\n[Race] Tall-man (Self-declared)', 'Tall-man (Self-declared)'],
]

describe('M6 race metadata', () => {
  it.each(localizedExamples)('extracts source Race from %s Basic Info', (locale, text, expected) => {
    expect(raceValueFromHandbookRecord(handbook(text), locale)).toBe(expected)
  })

  it.each(representativeEnglishExamples)(
    'handles representative source shape for %s',
    (_name, text, expected) => {
      expect(raceValueFromHandbookRecord(handbook(text), 'en')).toBe(expected)
    },
  )

  it('strips trailing sentence punctuation generally while preserving internal punctuation', () => {
    expect(raceValueFromHandbookRecord(handbook('[Race] Lung.'), 'en')).toBe('Lung')
    expect(raceValueFromHandbookRecord(handbook('[Race] Sankta!?'), 'en')).toBe('Sankta')
    expect(raceValueFromHandbookRecord(handbook('【种族】龙。'), 'cn')).toBe('龙')
    expect(
      raceValueFromHandbookRecord(handbook('[Race] Unknown (Suspected Liberi).'), 'en'),
    ).toBe('Unknown (Suspected Liberi)')
    expect(raceValueFromHandbookRecord(handbook('[Race] Tall-man (Self-declared)'), 'en')).toBe(
      'Tall-man (Self-declared)',
    )
  })

  it('applies the same trailing-punctuation normalization across operators', () => {
    const values = raceValuesFromHandbook(
      {
        handbookDict: {
          char_010_chen: handbook("[Code Name] Ch'en\n[Race] Lung."),
          char_other: handbook('[Code Name] Other\n[Race] Lung.'),
        },
      },
      'en',
    )

    expect(values.char_010_chen).toBe('Lung')
    expect(values.char_other).toBe('Lung')
  })

  it('keeps disclosed source values distinct from genuinely missing metadata', () => {
    expect(raceValueFromHandbookRecord(handbook('[Race] Undisclosed'), 'en')).toBe('Undisclosed')
    expect(raceValueFromHandbookRecord(handbook('[Gender] Female'), 'en')).toBeNull()
    expect(raceIdFromSourceValue('Undisclosed', 'en')).not.toBe(RACE_UNAVAILABLE_ID)
  })

  it('uses a canonical source value for stable identity while localizing labels independently', () => {
    const result = applyRaceMetadata(dataset(), {
      cn: { handbookDict: { char_noir: handbook('【种族】鬼') } },
      en: { handbookDict: { char_noir: handbook('[Race] Oni') } },
      jp: { handbookDict: { char_noir: handbook('【種族】鬼') } },
      kr: { handbookDict: { char_noir: handbook('[종족] 오니') } },
      tw: { handbookDict: { char_noir: handbook('【種族】鬼') } },
    })

    const raceId = raceIdFromSourceValue('鬼', 'cn')
    expect(result.operators[0].raceIds).toEqual([raceId])
    expect(result.operators[1].raceIds).toEqual([RACE_UNAVAILABLE_ID])
    expect(result.raceLabels?.[raceId]).toBe('Oni')
    expect(result.localizations?.en.raceLabels?.[raceId]).toBe('Oni')
    expect(result.localizations?.kr.raceLabels?.[raceId]).toBe('오니')
  })

  it('keeps pre-M6 schema-v6 operators backward compatible', () => {
    expect(operatorRaceIds({})).toEqual([RACE_UNAVAILABLE_ID])
  })
})
