import { describe, expect, it } from 'vitest'
import { buildGarrisonEventCatalog, localizeGarrisonEventNames } from './garrisonEventCatalog'

/** Actual EN activity-zone IDs and titles from ArknightsAssets zone_table.json. */
const ORIGINAL = 'act17d0'
const RERUN = 'act1r6sre'

function fixture(originalStages: boolean) {
  const activities = {
    basicInfo: {
      [ORIGINAL]: {
        name: 'Operation Originium Dust',
        startTime: 100,
        displayType: 'TYPE_ACT17D0',
        isReplicate: true,
      },
      [RERUN]: {
        name: 'Operation Originium Dust Rerun',
        startTime: 900,
        displayType: 'TYPE_ACT17D0',
        isReplicate: true,
      },
      act42side: { name: 'Unrelated Side Story', startTime: 200, displayType: 'SIDESTORY' },
    },
  }
  const zones = {
    zones: {
      act17d0_zone1: { type: 'ACTIVITY', zoneIndex: 0, zoneNameSecond: 'Task Records' },
      act17d0_zone2: { type: 'ACTIVITY', zoneIndex: 1, zoneNameSecond: 'Para Bellum' },
      act1r6sre_zone1: { type: 'ACTIVITY', zoneIndex: 0, zoneNameSecond: 'Task Record' },
      act1r6sre_zone2: { type: 'ACTIVITY', zoneIndex: 1, zoneNameSecond: 'Para Bellum' },
      act42side_zone1: { type: 'ACTIVITY', zoneIndex: 0, zoneNameSecond: 'Generic Test Map' },
      act42side_zone2: { type: 'ACTIVITY', zoneIndex: 1, zoneNameSecond: 'Different Map' },
    },
  }
  const stage = (code: string, zoneId: string) => ({
    code,
    zoneId,
    stageType: 'ACTIVITY',
    difficulty: 'NORMAL',
  })
  const stages = {
    stages: {
      ...(originalStages
        ? {
            original1: stage('OD-1', 'act17d0_zone1'),
            original2: stage('OD-2', 'act17d0_zone1'),
          }
        : {}),
      rerun1: stage('OD-R-1', 'act1r6sre_zone1'),
      rerun2: stage('OD-R-2', 'act1r6sre_zone2'),
      other1: stage('SK-1', 'act42side_zone1'),
    },
  }
  return buildGarrisonEventCatalog(activities, zones, stages)
}

describe('Operation Originium Dust original and special rerun IDs', () => {
  it('keeps the original act17d0 only once despite Task Record(s) zone variation', () => {
    const events = fixture(true)
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.id)).toEqual([ORIGINAL, 'act42side'])
    expect(events[0].name).toBe('Operation Originium Dust')
    expect(events[0].releaseTime).toBe(100)
    expect(events[0].stages.standard).toEqual(['OD-1', 'OD-2'])
  })

  it('uses original identity/date when the rerun is the only source of playable stages', () => {
    const events = fixture(false)
    expect(events).toHaveLength(2)
    expect(events[0].id).toBe(ORIGINAL)
    expect(events[0].name).toBe('Operation Originium Dust')
    expect(events[0].releaseTime).toBe(100)
    expect(events[0].stages.standard).toEqual(['OD-R-1', 'OD-R-2'])
  })

  it('keeps event-name localization tied to the original activity', () => {
    const localized = localizeGarrisonEventNames(
      fixture(false),
      {
        basicInfo: {
          [ORIGINAL]: { name: '源石尘行动' },
          [RERUN]: { name: '源石尘行动·复刻' },
        },
      },
      { zones: {} },
    )
    expect(localized[0].name).toBe('源石尘行动')
    expect(localized).toHaveLength(2)
  })
})