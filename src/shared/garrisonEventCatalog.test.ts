import { describe, expect, it } from 'vitest'
import {
  appendEventStages,
  availableGarrisonEventStageTypes,
  buildGarrisonEventCatalog,
  classifyGarrisonEventStage,
  classifyMainStoryStage,
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

  it('classifies side-story EX and S while sending other non-tutorial stages to Standard', () => {
    expect(classifyGarrisonEventStage('GA-1')).toBe('standard')
    expect(classifyGarrisonEventStage('OF-EX6')).toBe('ex')
    expect(classifyGarrisonEventStage('GT-EX-2')).toBe('ex')
    expect(classifyGarrisonEventStage('DH-S-1')).toBe('s')
    expect(classifyGarrisonEventStage('S3-1')).toBe('standard')
    expect(classifyGarrisonEventStage('TR-15')).toBeNull()
    expect(classifyGarrisonEventStage('SN-TR-1')).toBeNull()
    expect(classifyGarrisonEventStage('GA-TR-1')).toBeNull()
    for (const code of ['GA-ST-1', 'OF-MO-1', 'GT-HX-1', 'GA-EX-CM-1']) {
      expect(classifyGarrisonEventStage(code)).toBe('standard')
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

  it('includes crossover Side Stories even when their activity display type differs', () => {
    const events = buildGarrisonEventCatalog(
      {
        basicInfo: {
          act45side: { name: 'Somniloquium Serenum', displayType: 'ACTIVITY', startTime: 200 },
          act45side_re: {
            name: 'Somniloquium Serenum Rerun',
            displayType: 'ACTIVITY',
            startTime: 400,
            isReplicate: true,
          },
        },
      },
      {
        zones: {
          act45side_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
          act45side_zone2: { type: 'ACTIVITY', zoneIndex: 1 },
          act45side_re_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
        },
      },
      {
        stages: {
          first: stage('SS-1', 'act45side_zone1'),
          ex: stage('SS-EX-1', 'act45side_zone2'),
          rerun: stage('SS-2', 'act45side_re_zone1'),
        },
      },
    )
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Somniloquium Serenum')
    expect(events[0].stages.standard).toEqual(['SS-1'])
    expect(events[0].stages.ex).toEqual(['SS-EX-1'])
    expect(events[0].releaseTime).toBe(200)
  })

  it('excludes rerun-only events, including those marked through their title', () => {
    const events = buildGarrisonEventCatalog(
      {
        basicInfo: {
          act50side: { name: 'Some Event Rerun', startTime: 500, displayType: 'SIDESTORY' },
          act51side: { name: 'Original Event', startTime: 100, displayType: 'SIDESTORY' },
          act51side_re: {
            name: 'Original Event',
            startTime: 800,
            displayType: 'SIDESTORY',
            isReplicate: true,
          },
        },
      },
      {
        zones: {
          act50side_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
          act51side_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
          act51side_re_zone1: { type: 'ACTIVITY', zoneIndex: 0 },
        },
      },
      {
        stages: {
          rerunOnly: stage('RR-1', 'act50side_zone1'),
          original: stage('OE-1', 'act51side_zone1'),
          replicate: stage('OE-2', 'act51side_re_zone1'),
        },
      },
    )
    expect(events.map((event) => event.name)).toEqual(['Original Event'])
    expect(events[0].stages.standard).toEqual(['OE-1'])
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

  it('imports only episode-matching Chapter 3 stages and excludes tutorials and side-event codes', () => {
    const stages: Record<
      string,
      { code: string; zoneId: string; stageType: string; difficulty: string }
    > = {}
    for (let i = 1; i <= 8; i += 1) {
      stages[`main${i}`] = {
        code: `3-${i}`,
        zoneId: 'main_3',
        stageType: 'MAIN',
        difficulty: 'NORMAL',
      }
      stages[`sub${i}`] = {
        code: `S3-${i}`,
        zoneId: 'main_3',
        stageType: 'SUB',
        difficulty: 'NORMAL',
      }
    }
    for (const code of ['TR-15', 'AF-2', 'SA-2', 'S2-8', '4-1', 'TR-21']) {
      stages[`other${code}`] = { code, zoneId: 'main_3', stageType: 'MAIN', difficulty: 'NORMAL' }
    }
    const catalog = buildGarrisonEventCatalog(
      { basicInfo: {} },
      { zones: { main_3: { type: 'MAINLINE', zoneNameSecond: 'Stinging Shock' } } },
      { stages },
    )
    expect(catalog).toHaveLength(1)
    expect(catalog[0].name).toBe('Chapter 3 - Stinging Shock')
    expect(catalog[0].stages.standard).toEqual([
      ...Array.from({ length: 8 }, (_, i) => `3-${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `S3-${i + 1}`),
    ])
    expect(catalog[0].stages.s).toEqual([])
    expect(catalog[0].stages.ex).toEqual([])
  })

  it('limits main story to the selected chapter and excludes tutorial codes', () => {
    expect(classifyMainStoryStage('3-8', 3)).toBe('standard')
    expect(classifyMainStoryStage('S3-7', 3)).toBe('standard')
    expect(classifyMainStoryStage('S3-8', 3)).toBe('standard')
    expect(classifyMainStoryStage('AF-2', 3)).toBeNull()
    expect(classifyMainStoryStage('SA-2', 3)).toBeNull()
    expect(classifyMainStoryStage('S2-1', 3)).toBeNull()
    expect(classifyMainStoryStage('TR-15', 3)).toBeNull()
  })

  it('offers Main Story Standard/H only and Side Story Standard/EX/S only when populated', () => {
    const catalog = buildGarrisonEventCatalog(
      { basicInfo: { act8side: { name: 'Event Eight', displayType: 'SIDESTORY' } } },
      {
        zones: {
          main_5: { type: 'MAINLINE', zoneNameSecond: 'Necessary Solutions' },
          act8side_zone1: { type: 'ACTIVITY' },
        },
      },
      {
        stages: {
          main: { code: '5-1', zoneId: 'main_5', stageType: 'MAIN', difficulty: 'NORMAL' },
          sub: { code: 'S5-1', zoneId: 'main_5', stageType: 'SUB', difficulty: 'NORMAL' },
          hard: { code: 'H5-1', zoneId: 'main_5', stageType: 'MAIN', difficulty: 'NORMAL' },
          tutorial: { code: 'TR-11', zoneId: 'main_5', stageType: 'MAIN', difficulty: 'NORMAL' },
          side: {
            code: 'EF-1',
            zoneId: 'act8side_zone1',
            stageType: 'ACTIVITY',
            difficulty: 'NORMAL',
          },
          ex: {
            code: 'EF-EX-1',
            zoneId: 'act8side_zone1',
            stageType: 'ACTIVITY',
            difficulty: 'NORMAL',
          },
          special: {
            code: 'EF-MO-1',
            zoneId: 'act8side_zone1',
            stageType: 'ACTIVITY',
            difficulty: 'NORMAL',
          },
          tutorial2: {
            code: 'EF-TR-1',
            zoneId: 'act8side_zone1',
            stageType: 'ACTIVITY',
            difficulty: 'NORMAL',
          },
        },
      },
    )
    const main = catalog.find((event) => event.group === 'main')!
    const side = catalog.find((event) => event.group === 'side')!
    expect(availableGarrisonEventStageTypes(main)).toEqual(['standard', 'h'])
    expect(main.stages.standard).toEqual(['5-1', 'S5-1'])
    expect(main.stages.h).toEqual(['H5-1'])
    expect(availableGarrisonEventStageTypes(side)).toEqual(['standard', 'ex'])
    expect(side.stages.standard).toEqual(['EF-1', 'EF-MO-1'])
    expect(side.stages.ex).toEqual(['EF-EX-1'])
    expect(side.stages.s).toEqual([])
  })

  it('hides the category dropdown options for any stage types missing from an event', () => {
    const bare = {
      id: 'main:3',
      name: 'Chapter 3 - Stinging Shock',
      group: 'main' as const,
      releaseTime: null,
      stages: { standard: ['3-1', 'S3-1'], h: [], ex: [], s: [] },
    }
    expect(availableGarrisonEventStageTypes(bare)).toEqual(['standard'])
    expect(
      availableGarrisonEventStageTypes({
        ...bare,
        group: 'side',
        stages: { standard: [], h: [], ex: ['EF-EX-1'], s: ['EF-S-1'] },
      }),
    ).toEqual(['ex', 's'])
  })

  it('adds only missing stages and never creates guessed stage numbers', () => {
    const event = {
      id: 'act13side',
      name: 'Example Side Story',
      group: 'side' as const,
      releaseTime: 100,
      stages: { standard: ['GA-1', 'GA-2', 'GA-3'], h: [], ex: [], s: ['GA-S-1'] },
    }
    expect(appendEventStages([{ name: 'ga-2' }, { name: 'Elsewhere' }], event, 'standard')).toEqual(
      ['GA-1', 'GA-3'],
    )
    expect(appendEventStages([], event, 'ex')).toEqual([])
    expect(appendEventStages([{ name: 'GA-S-1' }], event, 's')).toEqual([])
  })
})
