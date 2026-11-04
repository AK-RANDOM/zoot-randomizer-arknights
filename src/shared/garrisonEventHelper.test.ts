import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import type { GarrisonEvent } from './garrisonEventCatalog'
import { garrisonEventHelperOperator, GARRISON_CHAPTER_HELPER_IDS } from './garrisonEventHelper'
import { withGarrisonEventBannerMetadata, localizeGarrisonEventNames } from './garrisonEventCatalog'

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
  it('uses a limited banner identity despite preload dates and stale Standard classification', () => {
    const talulah = example('char_4247_oxi', 'Talulah', 6, '2026-10-29', null)
    const standard = example('char_4244_tocka', 'Tocka', 6, '2026-11-01', null)
    const source = event('act55side', '2026-11-01')
    const [enriched] = withGarrisonEventBannerMetadata([source], {
      gachaPoolClient: {
        limited: { openTime: source.releaseTime!, limitParam: { limitedCharId: talulah.id } },
        unrelated: {
          openTime: source.releaseTime! - 86400 * 10,
          limitParam: { limitedCharId: standard.id },
        },
      },
    })
    const [localized] = localizeGarrisonEventNames(
      [enriched],
      {
        basicInfo: { act55side: { name: 'A different label' } },
      },
      {},
    )
    expect(localized.limitedOperatorIds).toEqual([talulah.id])
    expect(garrisonEventHelperOperator(localized, [standard, talulah], 'cn')?.id).toBe(talulah.id)
    expect(garrisonEventHelperOperator(localized, [standard, talulah], 'global')).toBeNull()
    expect(garrisonEventHelperOperator(localized, [standard], 'cn')).toBeNull()
  })

  it('prefers a limited 6★ at a one-day offset over a standard 6★ on the exact date', () => {
    const limited = example('char_limited', 'Limited', 6, '2026-11-01', null, true)
    const standard = example('char_standard', 'Standard', 6, '2026-11-02', null)
    expect(
      garrisonEventHelperOperator(event('act55side', '2026-11-02'), [standard, limited], 'cn')?.id,
    ).toBe(limited.id)
  })

  it('does not link a distant limited banner to an unrelated event', () => {
    const source = event('act55side', '2026-11-01')
    const [enriched] = withGarrisonEventBannerMetadata([source], {
      gachaPoolClient: {
        distant: {
          openTime: source.releaseTime! - 86400 * 3,
          limitParam: { limitedCharId: 'char_4247_oxi' },
        },
      },
    })
    expect(enriched.limitedOperatorIds).toBeUndefined()
  })

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

  it('always associates Operation Originium Dust with Ash in both regions, including unusual or missing CN dates', () => {
    const originalWithCNDateMismatch = event('act17d0', '2021-02-03')
    const rerunWithRerunDate = event('act1r6sre', '2024-03-21')
    const originalWithoutTimestamp = event('act17d0', null)

    for (const region of ['cn', 'global'] as const) {
      expect(garrisonEventHelperOperator(originalWithCNDateMismatch, operators, region)?.id).toBe(
        'char_456_ash',
      )
      expect(garrisonEventHelperOperator(rerunWithRerunDate, operators, region)?.id).toBe(
        'char_456_ash',
      )
      expect(garrisonEventHelperOperator(originalWithoutTimestamp, operators, region)?.id).toBe(
        'char_456_ash',
      )
    }
  })

  it('does not choose Ash for unrelated activities or when Ash is unavailable in the selected region', () => {
    expect(garrisonEventHelperOperator(event('act17d1', '2021-02-03'), operators, 'cn')).toBeNull()
    const withoutAsh = operators.filter((operator) => operator.id !== 'char_456_ash')
    expect(garrisonEventHelperOperator(event('act17d0', '2021-02-03'), withoutAsh, 'cn')).toBeNull()
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
