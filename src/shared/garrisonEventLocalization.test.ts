import { describe, expect, it } from 'vitest'
import {
  buildGarrisonEventCatalog,
  localizeGarrisonEventNames,
  type GarrisonEvent,
} from './garrisonEventCatalog'

const event = (
  id: string,
  name: string,
  group: 'side' | 'main',
  releaseTime: number,
): GarrisonEvent => ({
  id, name, group, releaseTime,
  stages: { standard: [`${id}-1`], h: [], ex: [], s: [] },
})

describe('Garrison event labels follow App Localization independently of Metadata Region', () => {
  it('changes Side Story and chapter names without changing IDs, stages, order, or release dates', () => {
    const source = [
      event('main:3', 'Chapter 3 - Stinging Shock', 'main', 10),
      event('act45side', 'Somniloquium Serenum', 'side', 50),
      event('act51side', 'CN exclusive event', 'side', 100),
    ]
    const localized = localizeGarrisonEventNames(
      source,
      { basicInfo: { act45side: { name: '春日巡游' } } },
      { zones: { main_3: { type: 'MAINLINE', zoneNameSecond: '惊蛰' } } },
    )
    expect(localized.map((entry) => entry.name)).toEqual([
      'Chapter 3 - 惊蛰', '春日巡游', 'CN exclusive event',
    ])
    expect(localized.map((entry) => entry.id)).toEqual(source.map((entry) => entry.id))
    expect(localized.map((entry) => entry.releaseTime)).toEqual([10, 50, 100])
    expect(localized.map((entry) => entry.stages)).toEqual(source.map((entry) => entry.stages))
    expect(source[1].name).toBe('Somniloquium Serenum')
  })

  it('uses localized mainline-activity zone titles for late chapters, retaining CN-only labels if absent', () => {
    const source = [event('main:16', 'Chapter 16 - 反常光谱', 'main', 16)]
    const known = localizeGarrisonEventNames(
      source, {}, { zones: { act3mainss_zone1: {
        type: 'MAINLINE_ACTIVITY', zoneNameThird: 'EPISODE 16',
        zoneNameSecond: 'Abnormal Spectrum',
      } } },
    )
    expect(known[0].name).toBe('Chapter 16 - Abnormal Spectrum')
    expect(localizeGarrisonEventNames(source, {}, { zones: {} })[0].name).toBe(
      'Chapter 16 - 反常光谱',
    )
  })

  it('takes the event set and chronology from the chosen region, never from label translation', () => {
    const stages = (id: string) => ({
      code: `${id.toUpperCase()}-1`,
      zoneId: `${id}_zone1`,
      stageType: 'ACTIVITY',
      difficulty: 'NORMAL',
    })
    const en = buildGarrisonEventCatalog(
      { basicInfo: { act1side: {
        name: 'Existing English Event', displayType: 'SIDESTORY', startTime: 500,
      } } },
      { zones: { act1side_zone1: { type: 'ACTIVITY' } } },
      { stages: { a: stages('act1side') } },
    )
    const cn = buildGarrisonEventCatalog(
      { basicInfo: {
        act1side: { name: '已存在活动', displayType: 'SIDESTORY', startTime: 100 },
        act51side: { name: 'CN 先行活动', displayType: 'SIDESTORY', startTime: 50 },
      } },
      { zones: {
        act1side_zone1: { type: 'ACTIVITY' },
        act51side_zone1: { type: 'ACTIVITY' },
      } },
      { stages: { a: stages('act1side'), b: stages('act51side') } },
    )
    expect(en.map((entry) => entry.id)).toEqual(['act1side'])
    expect(cn.map((entry) => entry.id)).toEqual(['act51side', 'act1side'])
    const localized = localizeGarrisonEventNames(cn, {
      basicInfo: { act1side: { name: 'Existing English Event' } },
    }, { zones: {} })
    expect(localized.map((entry) => entry.name)).toEqual([
      'CN 先行活动', 'Existing English Event',
    ])
    expect(localized.map((entry) => entry.releaseTime)).toEqual([50, 100])
  })
})
