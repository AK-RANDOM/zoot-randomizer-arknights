import { describe, expect, it } from 'vitest'
import {
  appendEventStages,
  buildGarrisonEventCatalog,
  classifyGarrisonEventStage,
} from './garrisonEventCatalog'

describe('Garrison event stage catalog', () => {
  const activities = {
    basicInfo: {
      act13side: { name: 'Example Side Story - ', startTime: 100, displayType: 'SIDESTORY' },
      act13side_rerun: {
        name: 'Example Side Story (Rerun) -',
        startTime: 400,
        isReplicate: true,
        displayType: 'SIDESTORY',
      },
      act4mini: { name: 'Example Vignette —', startTime: 250, displayType: 'BRANCHLINE' },
      actmisc: { name: 'Game Mode', displayType: 'ACTIVITY' },
      act8side: { name: 'A Newer Side Story', startTime: 180, displayType: 'SIDESTORY' },
      act0side: { name: 'An Earlier Side Story', startTime: 30, displayType: 'SIDESTORY' },
    },
  }
  const zones = {
    zones: {
      act13side_zone1: { zoneIndex: 0 },
      act13side_zone2: { zoneIndex: 1 },
      act13side_zone3: { zoneIndex: 2 },
      act13side_rerun_zone1: { zoneIndex: 0 },
      act4mini_zone1: { zoneIndex: 0 },
      act8side_zone1: { zoneIndex: 0 },
      act0side_zone1: { zoneIndex: 0 },
    },
  }
  const stage = (code: string, zoneId: string, extra: Record<string, unknown> = {}) => ({
    code,
    zoneId,
    stageType: 'ACTIVITY',
    difficulty: 'NORMAL',
    ...extra,
  })

  it('distinguishes Standard, EX and S from story, tutorial and special operations', () => {
    expect(classifyGarrisonEventStage('GA-1')).toBe('standard')
    expect(classifyGarrisonEventStage('OF-EX6')).toBe('ex')
    expect(classifyGarrisonEventStage('GT-EX-2')).toBe('ex')
    expect(classifyGarrisonEventStage('DH-S-1')).toBe('s')
    for (const code of ['GA-ST-1', 'GA-TR-1', 'OF-MO-1', 'GT-HX-1', 'GA-EX-CM-1']) {
      expect(classifyGarrisonEventStage(code)).toBeNull()
    }
  })

  it('groups by real activity name, preserves numeric stage order and filters story/challenge stages', () => {
    const catalog = buildGarrisonEventCatalog(activities, zones, {
      stages: {
        a: stage('EX-10', 'act13side_zone1'), // would look standard: valid synthetic code
        b: stage('GA-10', 'act13side_zone1'),
        c: stage('GA-2', 'act13side_zone1'),
        d: stage('GA-1', 'act13side_zone1'),
        e: stage('GA-EX-2', 'act13side_zone2'),
        f: stage('GA-EX-1', 'act13side_zone2'),
        g: stage('GA-S-1', 'act13side_zone3'),
        h: stage('GA-ST-1', 'act13side_zone1', { isStoryOnly: true }),
        i: stage('GA-EX-1', 'act13side_rerun_zone1'),
        j: stage('GA-1', 'act13side_zone1', { difficulty: 'FOUR_STAR' }),
        k: stage('GA-1', 'actmisc_zone1'),
        l: stage('GA-3', 'act13side_zone1', { isHardPredefined: true }),
        m: stage('SV-1', 'act4mini_zone1'),
        n: stage('ZX-1', 'act8side_zone1'),
        o: stage('OL-1', 'act0side_zone1'),
      },
    })
    expect(catalog.map((event) => event.name)).toEqual([
      'An Earlier Side Story',
      'Example Side Story',
      'A Newer Side Story',
      'Example Vignette',
    ])
    expect(catalog.map((event) => event.group)).toEqual(['side', 'side', 'side', 'side'])
    expect(catalog[1].releaseTime).toBe(100)
    expect(catalog[1].stages.standard).toEqual(['EX-10', 'GA-1', 'GA-2', 'GA-10'])
    expect(catalog[1].stages.ex).toEqual(['GA-EX-1', 'GA-EX-2'])
    expect(catalog[1].stages.s).toEqual(['GA-S-1'])
    expect(catalog[3].stages.standard).toEqual(['SV-1'])
  })

  it('groups Main Story chapters by episode with chapter titles in release order', () => {
    const activity = {
      basicInfo: {
        act2mainss: { name: 'Mainline launch', startTime: 500, displayType: 'ACTIVITY' },
        act0side: { name: 'Side Story', startTime: 1, displayType: 'SIDESTORY' },
      },
    }
    const zone = {
      zones: {
        main_2: { type: 'MAINLINE', zoneNameSecond: 'Separated Hearts', zoneIndex: 0 },
        main_0: { type: 'MAINLINE', zoneNameSecond: 'Evil Time Part 1', zoneIndex: 0 },
        main_1: { type: 'MAINLINE', zoneNameSecond: 'Evil Time Part 2', zoneIndex: 0 },
        act2mainss_zone1: {
          type: 'MAINLINE_ACTIVITY',
          zoneNameThird: 'EPISODE 15',
          zoneNameSecond: 'Dissociative Recombination',
          zoneIndex: 0,
        },
        permanent_main_1_zone1: {
          type: 'MAINLINE_RETRO',
          zoneNameThird: 'EPISODE 15',
          zoneNameSecond: 'Dissociative Recombination',
          zoneIndex: 0,
        },
        act0side_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
      },
    }
    const catalog = buildGarrisonEventCatalog(activity, zone, {
      stages: {
        chapter2: { code: '2-1', zoneId: 'main_2', stageType: 'MAIN', difficulty: 'NORMAL' },
        chapter0: { code: '0-1', zoneId: 'main_0', stageType: 'MAIN', difficulty: 'NORMAL' },
        chapter1: { code: '1-1', zoneId: 'main_1', stageType: 'MAIN', difficulty: 'NORMAL' },
        chapter15: {
          code: '15-1',
          zoneId: 'act2mainss_zone1',
          stageType: 'ACTIVITY',
          difficulty: 'NORMAL',
        },
        chapter15retro: {
          code: '15-1',
          zoneId: 'permanent_main_1_zone1',
          stageType: 'ACTIVITY',
          difficulty: 'NORMAL',
        },
        side: {
          code: 'SS-1',
          zoneId: 'act0side_zone1',
          stageType: 'ACTIVITY',
          difficulty: 'NORMAL',
        },
      },
    })
    expect(catalog.map(({ name }) => name)).toEqual([
      'Chapter 0 - Evil Time Part 1',
      'Chapter 1 - Evil Time Part 2',
      'Chapter 2 - Separated Hearts',
      'Chapter 15 - Dissociative Recombination',
      'Side Story',
    ])
    expect(catalog.map(({ group }) => group)).toEqual(['main', 'main', 'main', 'main', 'side'])
    expect(catalog[3].stages.standard).toEqual(['15-1'])
    expect(catalog[3].releaseTime).toBe(500)
  })

  it('adds only missing stages and never creates guessed stage numbers', () => {
    const event = {
      id: 'act13side',
      name: 'Example Side Story',
      group: 'side' as const,
      releaseTime: 100,
      stages: { standard: ['GA-1', 'GA-2', 'GA-3'], ex: [], s: ['GA-S-1'] },
    }
    expect(appendEventStages([{ name: 'ga-2' }, { name: 'Elsewhere' }], event, 'standard')).toEqual(
      ['GA-1', 'GA-3'],
    )
    expect(appendEventStages([], event, 'ex')).toEqual([])
    expect(appendEventStages([{ name: 'GA-S-1' }], event, 's')).toEqual([])
  })
})
