import { describe, expect, it } from 'vitest'
import { buildGarrisonEventCatalog, localizeGarrisonEventNames } from './garrisonEventCatalog'

type Side = {
  id: string
  name: string
  time: number
  zones: string[]
  codes: string[]
  replicate?: boolean
}

const makeCatalog = (
  runs: Side[],
  extraActivities: Record<string, { name: string; startTime?: number; displayType?: string }> = {},
  extraZones: Record<string, string[]> = {},
) => {
  const activityTable: {
    basicInfo: Record<
      string,
      { name: string; startTime?: number; displayType?: string; isReplicate?: boolean }
    >
  } = { basicInfo: { ...extraActivities } }
  const zoneTable: {
    zones: Record<string, { type: string; zoneIndex: number; zoneNameSecond: string }>
  } = { zones: {} }
  const stageTable: {
    stages: Record<string, { code: string; zoneId: string; difficulty: string; stageType: string }>
  } = { stages: {} }
  for (const [i, run] of runs.entries()) {
    activityTable.basicInfo[run.id] = {
      name: run.name,
      startTime: run.time,
      displayType: 'SIDESTORY',
      isReplicate: run.replicate,
    }
    run.zones.forEach((name, zoneIndex) => {
      zoneTable.zones[`${run.id}_zone${zoneIndex + 1}`] = {
        type: 'ACTIVITY',
        zoneIndex,
        zoneNameSecond: name,
      }
    })
    for (const [n, code] of run.codes.entries()) {
      stageTable.stages[`${i}:${n}`] = {
        code,
        zoneId: `${run.id}_zone1`,
        stageType: 'ACTIVITY',
        difficulty: 'NORMAL',
      }
    }
  }
  for (const [id, names] of Object.entries(extraZones)) {
    names.forEach((zoneNameSecond, zoneIndex) => {
      zoneTable.zones[`${id}_zone${zoneIndex + 1}`] = {
        type: 'ACTIVITY',
        zoneIndex,
        zoneNameSecond,
      }
    })
  }
  return buildGarrisonEventCatalog(activityTable, zoneTable, stageTable)
}

describe('real game-data-style original/rerun event identities', () => {
  it('recognizes actNNside/actNNsre original and rerun even when their map codes and names differ', () => {
    // Dorothy IDs/map zones are sourced from EN game data; the other named
    // cases use synthetic IDs/zones to exercise the same structural failure.
    const eventPairs: Array<{ id: string; name: string; map: string[]; prefix: string }> = [
      {
        id: '19',
        name: "Dorothy's Vision",
        map: ['Test Site', 'Rhine Headquarters'],
        prefix: 'DV',
      },
      {
        id: '60',
        name: 'What the Firelight Casts',
        map: ['Event Zone A', 'Event Zone B'],
        prefix: 'FC',
      },
      {
        id: '61',
        name: 'Operation Originium Dust',
        map: ['Event Area 1', 'Event Area 2'],
        prefix: 'OD',
      },
      {
        id: '62',
        name: 'Hortus de Escapismo',
        map: ['Event Area X', 'Event Area Y'],
        prefix: 'HE',
      },
    ]
    const runs = eventPairs.flatMap((pair, i) => [
      {
        id: `act${pair.id}side`,
        name: pair.name,
        time: 100 + i * 10,
        zones: pair.map,
        codes: [`${pair.prefix}-1`, `${pair.prefix}-2`, `${pair.prefix}-3`],
        replicate: true,
      },
      {
        id: `act${pair.id}sre`,
        name: `${pair.name} Reprised`,
        time: 900 + i * 10,
        zones: pair.map,
        codes: [`${pair.prefix}-EX-8`, `${pair.prefix}-ST-2`],
        replicate: true,
      },
    ])
    const result = makeCatalog(runs)
    expect(result).toHaveLength(eventPairs.length)
    expect(result.map((item) => item.name)).toEqual(eventPairs.map((pair) => pair.name))
    expect(result.map((item) => item.id)).toEqual(eventPairs.map((pair) => `act${pair.id}side`))
    expect(result.map((item) => item.releaseTime)).toEqual([100, 110, 120, 130])
    expect(result.every((item) => item.stages.ex.length === 0)).toBe(true)
  })

  it('merges legacy event reruns without an sre suffix using identical real zone-name sets', () => {
    // Zone IDs from EN game data: act5d0 / act14d7 share this 2-zone map.
    const result = makeCatalog([
      {
        id: 'act5d0',
        name: 'Original Event',
        time: 100,
        zones: ['Downtown', 'Eastern Suburbs'],
        codes: ['CB-1', 'CB-2'],
      },
      {
        id: 'act14d7',
        name: 'Renamed Rerun',
        time: 300,
        zones: ['Downtown', 'Eastern Suburbs'],
        codes: ['CB-EX-3'],
      },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('act5d0')
    expect(result[0].stages.standard).toEqual(['CB-1', 'CB-2'])
  })

  it('recognizes legacy original metadata when only rerun stages exist and localizes by original id', () => {
    const source = makeCatalog(
      [
        {
          id: 'act14d7',
          name: 'Crossover Rerun Name',
          time: 300,
          zones: ['Downtown', 'Eastern Suburbs'],
          codes: ['CB-EX-3'],
        },
      ],
      {
        act5d0: { name: 'Original Crossover', startTime: 100, displayType: 'TYPE_ACT9D0' },
      },
      { act5d0: ['Downtown', 'Eastern Suburbs'] },
    )
    expect(source).toHaveLength(1)
    expect(source[0].id).toBe('act5d0')
    expect(source[0].name).toBe('Original Crossover')
    expect(source[0].releaseTime).toBe(100)

    const fallback = makeCatalog(
      [
        {
          id: 'act19sre',
          name: 'Dorothy Revival',
          time: 500,
          zones: ['Test Site', 'Rhine Headquarters'],
          codes: ['DV-1'],
        },
      ],
      { act19side: { name: "Dorothy's Vision", startTime: 200, displayType: 'SIDESTORY' } },
    )
    const localized = localizeGarrisonEventNames(
      fallback,
      {
        basicInfo: { act19side: { name: '绿野幻梦' }, act19sre: { name: '绿野幻梦·复刻' } },
      },
      { zones: {} },
    )
    expect(localized[0].id).toBe('act19side')
    expect(localized[0].name).toBe('绿野幻梦')
    expect(localized[0].releaseTime).toBe(200)
  })

  it('does not conflate independent one-zone stories sharing an ordinary map name', () => {
    const result = makeCatalog([
      { id: 'act60side', name: 'A New Story', time: 200, zones: ['Main Stage'], codes: ['AN-1'] },
      {
        id: 'act61side',
        name: 'An Unrelated Story',
        time: 210,
        zones: ['Main Stage'],
        codes: ['UN-1'],
      },
    ])
    expect(result).toHaveLength(2)
  })

  it('retains the original label when only the rerun has playable stages', () => {
    const result = makeCatalog(
      [
        {
          id: 'act19sre',
          name: "Dorothy's Vision Revival",
          time: 200,
          zones: ['Test Site', 'Rhine Headquarters'],
          codes: ['DV-1', 'DV-2'],
        },
      ],
      { act19side: { name: "Dorothy's Vision", startTime: 100, displayType: 'SIDESTORY' } },
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Dorothy's Vision")
    expect(result[0].id).toBe('act19side')
    expect(result[0].releaseTime).toBe(100)
  })
})
