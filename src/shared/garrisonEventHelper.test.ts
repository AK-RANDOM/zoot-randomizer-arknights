import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import type { GarrisonEvent } from './garrisonEventCatalog'
import { garrisonEventHelperOperator, GARRISON_CHAPTER_HELPER_IDS } from './garrisonEventHelper'

const example = (
  id: string,
  name: string,
  rarity: 5 | 6,
  cn: string | null,
  global: string | null,
  limited = false,
): Operator =>
  ({
    id,
    name,
    rarity,
    availableOn: { cn: cn !== null, global: global !== null },
    release: {
      cn: { date: cn, yearGroup: null },
      global: { date: global, yearGroup: null },
    },
    acquisition: { family: limited ? 'limited' : 'standard', group: limited ? 'collab' : null },
  }) as Operator

const event = (
  id: string,
  date: string | null,
  group: 'side' | 'main' = 'side',
): GarrisonEvent => ({
  id,
  name: 'Localized title must not affect representative',
  group,
  releaseTime: date === null ? null : Date.parse(`${date}T16:00:00Z`) / 1_000,
  stages: { standard: ['EX-1'], h: [], ex: [], s: [] },
})

const operators = [
  example('char_002_amiya', 'Amiya (Caster)', 5, '2019-05-01', '2020-01-16'),
  example('char_1001_amiya2', 'Amiya (Guard)', 5, '2020-11-01', '2021-04-30'),
  example('char_017_huang', 'Blaze', 6, '2019-12-24', '2020-06-30'),
  example('char_113_cqbw', 'W', 6, '2020-05-01', '2020-12-30', true),
  example('char_4048_doroth', 'Dorothy', 6, '2022-07-05', '2023-03-14'),
  example('char_456_ash', 'Ash', 6, '2021-03-09', '2021-08-18', true),
  example('char_standard_same_day', 'Standard', 6, '2024-05-01', '2024-11-01'),
  example('char_limited_same_day', 'Limited', 6, '2024-05-01', '2024-11-01', true),
]

describe('Garrison event helper icon selection', () => {
  it('uses caster Amiya for Chapters 1–4 (and prologue), regardless of other releases', () => {
    for (let chapter = 0; chapter <= 4; chapter += 1) {
      expect(
        garrisonEventHelperOperator(event(`main:${chapter}`, null, 'main'), operators, 'cn')?.id,
      ).toBe('char_002_amiya')
    }
    expect(GARRISON_CHAPTER_HELPER_IDS[4]).toBe('char_002_amiya')
  })

  it('uses named chapter representatives for chapters with no stage-level activity start time', () => {
    expect(garrisonEventHelperOperator(event('main:6', null, 'main'), operators, 'cn')?.name).toBe(
      'Blaze',
    )
    expect(
      garrisonEventHelperOperator(event('main:7', null, 'main'), operators, 'global')?.name,
    ).toBe('W')
  })

  it('uses the selected Metadata Region to associate each original Side Story with its debut 6★', () => {
    expect(
      garrisonEventHelperOperator(event('act19side', '2022-07-05'), operators, 'cn')?.name,
    ).toBe('Dorothy')
    expect(
      garrisonEventHelperOperator(event('act19side', '2023-03-14'), operators, 'global')?.name,
    ).toBe('Dorothy')
    expect(garrisonEventHelperOperator(event('act17d0', '2021-03-09'), operators, 'cn')?.name).toBe(
      'Ash',
    )
    expect(
      garrisonEventHelperOperator(event('act17d0', '2021-08-18'), operators, 'global')?.name,
    ).toBe('Ash')
  })

  it('prefers limited operators over simultaneous standard 6★ debuts', () => {
    expect(
      garrisonEventHelperOperator(event('act100side', '2024-05-01'), operators, 'cn')?.id,
    ).toBe('char_limited_same_day')
  })

  it('allows a one-day timestamp offset without choosing unrelated future releases', () => {
    expect(
      garrisonEventHelperOperator(event('act19side', '2022-07-04'), operators, 'cn')?.name,
    ).toBe('Dorothy')
    expect(
      garrisonEventHelperOperator(event('act19side', '2022-07-01'), operators, 'cn'),
    ).toBeNull()
    expect(garrisonEventHelperOperator(event('act19side', null), operators, 'cn')).toBeNull()
    expect(garrisonEventHelperOperator(null, operators, 'cn')).toBeNull()
  })

  it('never uses an unreleased operator from the other region', () => {
    expect(
      garrisonEventHelperOperator(event('act19side', '2022-07-05'), operators, 'global'),
    ).toBeNull()
  })
})
