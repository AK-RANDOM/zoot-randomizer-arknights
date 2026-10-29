import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GameLocale, ReleaseServer } from '../shared/operator'
import {
  buildGarrisonEventCatalog,
  localizeGarrisonEventNames,
  type GarrisonEvent,
} from '../shared/garrisonEventCatalog'

const BASE_URL = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000
const CATALOG_VERSION = 12
const pending = new Map<string, Promise<GarrisonEvent[]>>()

const gameDataLocale = (region: ReleaseServer): GameLocale => (region === 'cn' ? 'cn' : 'en')
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
  const response = await fetch(`${BASE_URL}/${locale}/gamedata/excel/${file}`, {
    headers: { 'User-Agent': 'arknights-randomizer' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`Event data download failed: ${locale}/${file} (${response.status})`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

async function fetchCatalog(region: ReleaseServer, locale: GameLocale): Promise<GarrisonEvent[]> {
  const sourceLocale = gameDataLocale(region)
  // Metadata Region owns which events/stages exist and their release order.
  const [activities, zones, stages] = await Promise.all([
    fetchGameTable(sourceLocale, 'activity_table.json'),
    fetchGameTable(sourceLocale, 'zone_table.json'),
    fetchGameTable(sourceLocale, 'stage_table.json'),
  ])
  const sourceEvents = buildGarrisonEventCatalog(activities, zones, stages)
  if (!sourceEvents.length) throw new Error('No event stages were found in the downloaded data.')

  // App Localization owns labels ONLY. Missing localized records (for
  // example unreleased CN events in EN metadata) retain source-region names.
  let events = sourceEvents
  let localized = locale === sourceLocale
  if (locale !== sourceLocale) {
    try {
      const [localizedActivities, localizedZones] = await Promise.all([
        fetchGameTable(locale, 'activity_table.json'),
        fetchGameTable(locale, 'zone_table.json'),
      ])
      events = localizeGarrisonEventNames(sourceEvents, localizedActivities, localizedZones)
      localized = true
    } catch {
      // A localization download failure must not hide otherwise valid events.
    }
  }
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
  const existing = pending.get(key)
  if (existing) return existing

  const task = (async () => {
    const cache = await loadCache(region, locale)
    if (cache && Date.now() - cache.fetchedAt < MAX_AGE_MS) return cache.events
    try {
      return await fetchCatalog(region, locale)
    } catch {
      if (cache) return cache.events
      throw new Error(
        `Event catalog unavailable for ${region.toUpperCase()} metadata. Connect to the internet and reopen Garrison to load it.`,
      )
    }
  })().finally(() => {
    pending.delete(key)
  })
  pending.set(key, task)
  return task
}
