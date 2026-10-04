import { describe, expect, it } from 'vitest'
import {
  classifyAcquisition,
  isModeOnlyOperator,
  limitedOperatorIds,
} from './acquisitionMetadata'

describe('acquisition metadata', () => {
  it('treats collab gacha as Limited / Collab', () => {
    expect(
      classifyAcquisition({
        id: 'char_collab_gacha',
        obtainApproach: 'Headhunting',
        releaseCategory: 'side_story',
        cnReleaseDate: '2024-03-01',
        collaboration: 'Example Collab',
        limitedIds: new Set(),
      }),
    ).toEqual({ family: 'limited', group: 'collab' })
  })

  it('treats collab welfare as Event / Story welfare', () => {
    expect(
      classifyAcquisition({
        id: 'char_collab_welfare',
        obtainApproach: 'Event Reward',
        releaseCategory: 'side_story',
        cnReleaseDate: '2024-03-01',
        collaboration: 'Example Collab',
        limitedIds: new Set(),
      }),
    ).toEqual({ family: 'welfare', group: 'eventStory' })
  })

  it('does not classify a gacha operator as welfare just because its release event is CC/IS', () => {
    const base = {
      id: 'char_banner_operator',
      obtainApproach: 'Headhunting',
      cnReleaseDate: '2020-03-17',
      collaboration: null,
      limitedIds: new Set<string>(),
    }

    expect(classifyAcquisition({ ...base, releaseCategory: 'crisis' })).toEqual({
      family: 'standard',
      group: null,
    })
    expect(classifyAcquisition({ ...base, releaseCategory: 'roguelike' })).toEqual({
      family: 'standard',
      group: null,
    })
  })

  it('preserves historical normal Limited operators after their live banner metadata rotates out', () => {
    const classify = (id: string, date: string) =>
      classifyAcquisition({
        id,
        obtainApproach: 'Headhunting',
        releaseCategory: 'side_story',
        cnReleaseDate: date,
        collaboration: null,
        limitedIds: new Set(),
      })

    expect(classify('char_113_cqbw', '2020-05-01')).toEqual({
      family: 'limited',
      group: 'anniversary',
    })
    expect(classify('char_1038_whitw2', '2024-11-01')).toEqual({
      family: 'limited',
      group: 'halfAnniversary',
    })
    expect(classify('char_2026_yu', '2025-01-22')).toEqual({
      family: 'limited',
      group: 'cny',
    })
    expect(classify('char_1044_hsgma2', '2025-08-01')).toEqual({
      family: 'limited',
      group: 'summer',
    })
  })

  it('uses live limited metadata as a fallback for newly-added normal limited operators', () => {
    const limitedIds = new Set(['cny', 'anniv', 'summer', 'half'])
    const classify = (id: string, date: string) =>
      classifyAcquisition({
        id,
        obtainApproach: 'Headhunting',
        releaseCategory: 'side_story',
        cnReleaseDate: date,
        collaboration: null,
        limitedIds,
      })

    expect(classify('cny', '2024-02-01')).toEqual({ family: 'limited', group: 'cny' })
    expect(classify('anniv', '2024-05-01')).toEqual({
      family: 'limited',
      group: 'anniversary',
    })
    expect(classify('summer', '2024-08-01')).toEqual({
      family: 'limited',
      group: 'summer',
    })
    expect(classify('half', '2024-11-01')).toEqual({
      family: 'limited',
      group: 'halfAnniversary',
    })
  })

  it('classifies welfare subgroups', () => {
    const base = {
      collaboration: null,
      limitedIds: new Set<string>(),
      cnReleaseDate: '2024-01-01',
    }

    expect(
      classifyAcquisition({
        ...base,
        id: 'char_cc',
        obtainApproach: 'Event Reward',
        releaseCategory: 'crisis',
      }),
    ).toEqual({ family: 'welfare', group: 'cc' })

    expect(
      classifyAcquisition({
        ...base,
        id: 'char_red',
        obtainApproach: 'Purchase Certificate Store',
        releaseCategory: 'other',
      }),
    ).toEqual({ family: 'welfare', group: 'redCert' })

    expect(
      classifyAcquisition({
        ...base,
        id: 'char_4025_aprot2',
        obtainApproach: '',
        releaseCategory: 'roguelike',
      }),
    ).toEqual({ family: 'welfare', group: 'isRa' })
  })

  it('extracts normal limited IDs from gacha metadata', () => {
    expect(
      limitedOperatorIds({
        gachaPoolClient: {
          pool: { limitParam: { limitedCharId: ['char_a', 'char_b'] } },
        },
      }),
    ).toEqual(new Set(['char_a', 'char_b']))
  })

  it('excludes temporary IS and Stronghold Protocol variants, not normal Raidian/Mechanist', () => {
    expect(isModeOnlyOperator('char_508_aguard')).toBe(true)
    expect(isModeOnlyOperator('char_610_acfend')).toBe(true)
    expect(isModeOnlyOperator('char_614_acsupo')).toBe(true)
    expect(isModeOnlyOperator('char_4195_radian')).toBe(false)
    expect(isModeOnlyOperator('char_4230_mcnist')).toBe(false)
  })
})
