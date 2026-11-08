import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GameLocale, ReleaseServer } from '../shared/operator'
import type { GarrisonEvent } from '../shared/garrisonEventCatalog'
import { loadGarrisonEvents } from '../shared/loadGarrisonEvents'
import { gameDataExcelUrl } from '../shared/operatorData'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000
const CATALOG_VERSION = 14
const pending = new Map<string, Promise<GarrisonEvent[]>>()
let refreshRevision = 0
const refreshedRevisions = new Map<string, number>()

/** Refresh each region/localization on its next use after a manual data check. */
export function invalidateGarrisonEventCatalog(): void {
  refreshRevision += 1
}

const catalogKey = (region: ReleaseServer, locale: GameLocale): string => `${region}-${locale}`
const cacheFile = (region: ReleaseServer, locale: GameLocale): string =>
  join(app.getPath('userData'), `garrison-event-catalog-${catalogKey(region, locale)}.json`)

interface CatalogCache {
  version: number
  fetchedAt: number
  events: GarrisonEvent[]
}

async function loadCache(region: ReleaseServer, locale: GameLocale): Promise<CatalogCache | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(cacheFile(region, locale), 'utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    const cache = parsed as CatalogCache
    return cache.version === CATALOG_VERSION &&
      Number.isFinite(cache.fetchedAt) &&
      Array.isArray(cache.events) &&
      cache.events.length > 0
      ? cache
      : null
  } catch {
    return null
  }
}

async function fetchGameTable(locale: GameLocale, file: string): Promise<Record<string, unknown>> {
  const response = await fetch(gameDataExcelUrl(locale, file), {
    headers: { 'User-Agent': 'arknights-randomizer' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`Event data download failed: ${locale}/${file} (${response.status})`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

async function fetchCatalog(region: ReleaseServer, locale: GameLocale): Promise<GarrisonEvent[]> {
  const { events, localized } = await loadGarrisonEvents(region, locale, fetchGameTable)
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(
    cacheFile(region, locale),
    JSON.stringify({
      version: CATALOG_VERSION,
      fetchedAt: localized ? Date.now() : 0,
      events,
    }),
    'utf8',
  )
  return events
}

export async function getGarrisonEventCatalog(
  region: ReleaseServer,
  locale: GameLocale,
): Promise<GarrisonEvent[]> {
  const key = catalogKey(region, locale)
  const revision = refreshRevision
  const requestKey = `${key}-${revision}`
  const existing = pending.get(requestKey)
  if (existing) return existing

  const task = (async () => {
    const cache = await loadCache(region, locale)
    const refreshRequested = revision > (refreshedRevisions.get(key) ?? 0)
    if (!refreshRequested && cache && Date.now() - cache.fetchedAt < MAX_AGE_MS) return cache.events
    try {
      const events = await fetchCatalog(region, locale)
      refreshedRevisions.set(key, revision)
      return events
    } catch {
      if (cache) return cache.events
      throw new Error(
        `Event catalog unavailable for ${region.toUpperCase()} metadata. Connect to the internet and reopen Garrison to load it.`,
      )
    }
  })().finally(() => {
    pending.delete(requestKey)
  })
  pending.set(requestKey, task)
  return task
}
