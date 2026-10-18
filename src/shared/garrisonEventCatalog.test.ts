import { describe, expect, it } from 'vitest'
import {
  appendEventStages,
  buildGarrisonEventCatalog,
  classifyGarrisonEventStage,
} from './garrisonEventCatalog'

describe('Garrison event stage catalog', () => {
  const activities = {
    basicInfo: {
      act13side: { name: 'Example Side Story', displayType: 'SIDESTORY' },
      act13side_rerun: {
        name: 'Example Side Story (Rerun)',
        isReplicate: true,
        displayType: 'SIDESTORY',
      },
      act4mini: { name: 'Example Vignette', displayType: 'BRANCHLINE' },
      actmisc: { name: 'Game Mode', displayType: 'ACTIVITY' },
    },
  }
  const zones = {
    zones: {
      act13side_zone1: { zoneIndex: 0 },
      act13side_zone2: { zoneIndex: 1 },
      act13side_zone3: { zoneIndex: 2 },
      act13side_rerun_zone1: { zoneIndex: 0 },
      act4mini_zone1: { zoneIndex: 0 },
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
      },
    })
    expect(catalog.map((event) => event.name)).toEqual(['Example Side Story', 'Example Vignette'])
    expect(catalog[0].stages.standard).toEqual(['EX-10', 'GA-1', 'GA-2', 'GA-10'])
    expect(catalog[0].stages.ex).toEqual(['GA-EX-1', 'GA-EX-2'])
    expect(catalog[0].stages.s).toEqual(['GA-S-1'])
    expect(catalog[1].stages.standard).toEqual(['SV-1'])
  })

  it('adds only missing stages and never creates guessed stage numbers', () => {
    const event = {
      id: 'act13side',
      name: 'Example Side Story',
      stages: { standard: ['GA-1', 'GA-2', 'GA-3'], ex: [], s: ['GA-S-1'] },
    }
    expect(appendEventStages([{ name: 'ga-2' }, { name: 'Elsewhere' }], event, 'standard')).toEqual(
      ['GA-1', 'GA-3'],
    )
    expect(appendEventStages([], event, 'ex')).toEqual([])
    expect(appendEventStages([{ name: 'GA-S-1' }], event, 's')).toEqual([])
  })
})
