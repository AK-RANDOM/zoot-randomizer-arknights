import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildGarrisonEventCatalog, type GarrisonEvent } from '../shared/garrisonEventCatalog'

const BASE_URL =
  'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel'
const FILES = ['activity_table.json', 'zone_table.json', 'stage_table.json'] as const
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000
const CATALOG_VERSION = 9
const cacheFile = (): string => join(app.getPath('userData'), 'garrison-event-catalog.json')
let pending: Promise<GarrisonEvent[]> | null = null

interface CatalogCache {
  version: number
  fetchedAt: number
  events: GarrisonEvent[]
}

async function loadCache(): Promise<CatalogCache | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(cacheFile(), 'utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    const cache = parsed as CatalogCache
    return cache.version === CATALOG_VERSION &&
      Number.isFinite(cache.fetchedAt) &&
      Array.isArray(cache.events) &&
      cache.events.length
      ? cache
      : null
  } catch {
    return null
  }
}

async function fetchCatalog(): Promise<GarrisonEvent[]> {
  const tables = await Promise.all(
    FILES.map(async (file) => {
      const response = await fetch(`${BASE_URL}/${file}`, {
        headers: { 'User-Agent': 'arknights-randomizer' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`Event data download failed: ${file} (${response.status})`)
      return response.json() as Promise<Record<string, unknown>>
    }),
  )
  const events = buildGarrisonEventCatalog(tables[0], tables[1], tables[2])
  if (!events.length) throw new Error('No event stages were found in the downloaded data.')
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(
    cacheFile(),
    JSON.stringify({ version: CATALOG_VERSION, fetchedAt: Date.now(), events }),
    'utf8',
  )
  return events
}

export async function getGarrisonEventCatalog(): Promise<GarrisonEvent[]> {
  if (pending) return pending
  pending = (async () => {
    const cache = await loadCache()
    if (cache && Date.now() - cache.fetchedAt < MAX_AGE_MS) return cache.events
    try {
      return await fetchCatalog()
    } catch {
      if (cache) return cache.events
      throw new Error(
        'Event catalog unavailable. Connect to the internet and reopen Garrison to load it.',
      )
    }
  })().finally(() => {
    pending = null
  })
  return pending
}
