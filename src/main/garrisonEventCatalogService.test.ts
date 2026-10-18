import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/test-garrison-data' } }))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(async () => { throw new Error('No existing cache') }),
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}))

import { getGarrisonEventCatalog } from './garrisonEventCatalogService'

const zones = (names: Record<string, string>) => ({
  zones: Object.fromEntries(
    Object.keys(names).map((id) => [`${id}_zone1`, { type: 'ACTIVITY', zoneIndex: 0 }]),
  ),
})
const stages = (ids: string[]) => ({
  stages: Object.fromEntries(ids.map((id, i) => [String(i), {
    code: `XX${i + 1}-1`, zoneId: `${id}_zone1`,
    stageType: 'ACTIVITY', difficulty: 'NORMAL',
  }])),
})
const cnActivities = { basicInfo: {
  act1side: { name: '中国原始活动', displayType: 'SIDESTORY', startTime: 100 },
  act2side: { name: 'CN限定活动', displayType: 'SIDESTORY', startTime: 50 },
} }
const enActivities = { basicInfo: {
  act1side: { name: 'English Original', displayType: 'SIDESTORY', startTime: 400 },
} }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Garrison event service: Metadata Region and App Localization', () => {
  function stubGameData(): string[] {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: string) => {
      urls.push(request)
      const match = /\/(en|cn)\/gamedata\/excel\/(activity_table|zone_table|stage_table)\.json$/.exec(request)
      if (!match) throw new Error(`Unexpected game-data URL: ${request}`)
      const [, locale, table] = match
      let value: unknown
      if (table === 'activity_table') value = locale === 'cn' ? cnActivities : enActivities
      if (table === 'zone_table') value = zones(locale === 'cn'
        ? { act1side: '中文', act2side: '中文限定' }
        : { act1side: 'English Original' })
      if (table === 'stage_table') value = stages(locale === 'cn'
        ? ['act1side', 'act2side'] : ['act1side'])
      return { ok: true, json: async () => value }
    }))
    return urls
  }

  it('CN metadata provides CN-only events in CN release order even with English labels', async () => {
    const urls = stubGameData()
    const events = await getGarrisonEventCatalog('cn', 'en')
    expect(events.map((event) => event.id)).toEqual(['act2side', 'act1side'])
    expect(events.map((event) => event.name)).toEqual(['CN限定活动', 'English Original'])
    expect(events.map((event) => event.releaseTime)).toEqual([50, 100])
    expect(urls).toContainEqual(expect.stringContaining('/cn/gamedata/excel/stage_table.json'))
    expect(urls).not.toContainEqual(expect.stringContaining('/en/gamedata/excel/stage_table.json'))
    expect(urls).toContainEqual(expect.stringContaining('/en/gamedata/excel/activity_table.json'))
  })

  it('Global metadata keeps Global events while Chinese App Localization changes their labels', async () => {
    const urls = stubGameData()
    const events = await getGarrisonEventCatalog('global', 'cn')
    expect(events.map((event) => event.id)).toEqual(['act1side'])
    expect(events[0].name).toBe('中国原始活动')
    expect(events[0].releaseTime).toBe(400)
    expect(urls).toContainEqual(expect.stringContaining('/en/gamedata/excel/stage_table.json'))
    expect(urls).not.toContainEqual(expect.stringContaining('/cn/gamedata/excel/stage_table.json'))
  })
})
