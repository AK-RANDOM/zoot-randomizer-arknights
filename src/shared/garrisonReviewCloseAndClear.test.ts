import { describe, expect, it } from 'vitest'
import {
  buildGarrisonEventCatalog,
  garrisonSideStoryStageFamily,
  type GarrisonEvent,
} from './garrisonEventCatalog'
import {
  clearAllGarrisonSquads,
  clearGarrisonStageSquad,
  cloneGarrison,
  createGarrison,
  createGarrisonStage,
} from './garrison'

describe('Garrison review: clear squads without deleting stages', () => {
  const populated = () => {
    const garrison = createGarrison('Review')
    garrison.stages = [
      { ...createGarrisonStage('3-1', 'first'), operatorIds: ['alice', 'bob'] },
      { ...createGarrisonStage('3-2', 'second'), operatorIds: [] },
      { ...createGarrisonStage('3-3', 'third'), operatorIds: ['charlie'] },
    ]
    return garrison
  }

  it('clears one stage while retaining every stage and other assignments', () => {
    const original = populated()
    const cleared = clearGarrisonStageSquad(original, 'first')
    expect(cleared.stages.map((stage) => [stage.id, stage.name])).toEqual(
      original.stages.map((stage) => [stage.id, stage.name]),
    )
    expect(cleared.stages.map((stage) => stage.operatorIds)).toEqual([[], [], ['charlie']])
    expect(original.stages[0].operatorIds).toEqual(['alice', 'bob'])
    expect(clearGarrisonStageSquad(original, 'missing')).toEqual(cloneGarrison(original))
  })

  it('clears all stage squads in one immutable edit while preserving table order', () => {
    const original = populated()
    const cleared = clearAllGarrisonSquads(original)
    expect(cleared.stages).toHaveLength(3)
    expect(cleared.stages.map((stage) => stage.name)).toEqual(['3-1', '3-2', '3-3'])
    expect(cleared.stages.every((stage) => stage.operatorIds.length === 0)).toBe(true)
    expect(original.stages[2].operatorIds).toEqual(['charlie'])
  })
})

describe('Garrison Side Story deduplication by operation family', () => {
  const series = [
    { name: "Dorothy's Vision", rerun: "Dorothy's Vision Revival", code: 'DV' },
    { name: 'What the Firelight Casts', rerun: 'What the Firelight Cast', code: 'FC' },
    { name: 'Operation Originium Dust', rerun: 'Originium Dust Returns', code: 'OD' },
    { name: 'Hortus de Escapismo', rerun: 'Hortus de Escapismo Encore', code: 'HE' },
  ]

  it('keeps every original, drops only the duplicate rerun record even if its title and id differ', () => {
    const activities: Record<string, { name: string; startTime: number; displayType: string }> = {}
    const zones: Record<string, { type: string; zoneIndex: number }> = {}
    const stages: Record<string, {
      code: string
      zoneId: string
      stageType: string
      difficulty: string
    }> = {}
    let id = 0
    for (const [i, item] of series.entries()) {
      const original = `act${i + 1}side`
      const rerun = `act${i + 30}d7`
      activities[original] = {
        name: item.name,
        startTime: 100 + i * 10,
        displayType: 'SIDESTORY',
      }
      // Deliberately no "Rerun" suffix; these were the leaked dropdown entries.
      activities[rerun] = {
        name: item.rerun,
        startTime: 500 + i * 10,
        displayType: 'TYPE_ACT15D0',
      }
      zones[`${original}_zone1`] = { type: 'ACTIVITY', zoneIndex: 0 }
      zones[`${rerun}_zone1`] = { type: 'ACTIVITY', zoneIndex: 0 }
      for (const n of [1, 2, 3]) {
        stages[String(id++)] = {
          code: `${item.code}-${n}`,
          zoneId: `${original}_zone1`,
          stageType: 'ACTIVITY',
          difficulty: 'NORMAL',
        }
      }
      for (const code of [`${item.code}-1`, `${item.code}-2`, `${item.code}-EX-8`]) {
        stages[String(id++)] = {
          code,
          zoneId: `${rerun}_zone1`,
          stageType: 'ACTIVITY',
          difficulty: 'NORMAL',
        }
      }
    }
    activities.act99mini = { name: 'Vignette', startTime: 1, displayType: 'BRANCHLINE' }
    zones.act99mini_zone1 = { type: 'ACTIVITY', zoneIndex: 0 }
    stages[String(id)] = {
      code: 'SV-1', zoneId: 'act99mini_zone1', stageType: 'ACTIVITY', difficulty: 'NORMAL',
    }

    const events = buildGarrisonEventCatalog(
      { basicInfo: activities },
      { zones },
      { stages },
    )
    expect(events).toHaveLength(series.length)
    expect(events.map((event) => event.name)).toEqual(series.map((item) => item.name))
    expect(events.map((event) => event.releaseTime)).toEqual([100, 110, 120, 130])
    for (const [i, event] of events.entries()) {
      expect(event.stages.standard).toEqual([1, 2, 3].map((n) => `${series[i].code}-${n}`))
      expect(event.stages.ex).toEqual([])
    }
  })

  it('requires at least two numbered maps before inferring family identity', () => {
    const event: GarrisonEvent = {
      id: 'side:example', name: 'Example', group: 'side', releaseTime: 1,
      stages: { standard: ['DV-1', 'FC-1', 'DV-ST-1'], h: [], ex: [], s: [] },
    }
    expect(garrisonSideStoryStageFamily(event)).toBeNull()
    event.stages.standard.push('DV-2')
    expect(garrisonSideStoryStageFamily(event)).toBe('DV')
  })
})
