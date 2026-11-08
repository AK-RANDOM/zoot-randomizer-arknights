import type { GameLocale, ReleaseServer } from './operator'
import {
  buildGarrisonEventCatalog,
  localizeGarrisonEventNames,
  withGarrisonEventBannerMetadata,
  type GarrisonEvent,
} from './garrisonEventCatalog'

export async function loadGarrisonEvents(
  region: ReleaseServer,
  locale: GameLocale,
  fetchGameTable: (locale: GameLocale, file: string) => Promise<Record<string, unknown>>,
): Promise<{ events: GarrisonEvent[]; localized: boolean }> {
  const sourceLocale = region === 'cn' ? 'cn' : 'en'
  // The metadata region determines which events and stages are available.
  const [activities, zones, stages, gacha] = await Promise.all([
    fetchGameTable(sourceLocale, 'activity_table.json'),
    fetchGameTable(sourceLocale, 'zone_table.json'),
    fetchGameTable(sourceLocale, 'stage_table.json'),
    fetchGameTable(sourceLocale, 'gacha_table.json'),
  ])
  const sourceEvents = withGarrisonEventBannerMetadata(
    buildGarrisonEventCatalog(activities, zones, stages),
    gacha,
  )
  if (!sourceEvents.length) throw new Error('No event stages were found in the downloaded data.')
  if (locale === sourceLocale) return { events: sourceEvents, localized: true }

  try {
    const [localizedActivities, localizedZones] = await Promise.all([
      fetchGameTable(locale, 'activity_table.json'),
      fetchGameTable(locale, 'zone_table.json'),
    ])
    const events = localizeGarrisonEventNames(sourceEvents, localizedActivities, localizedZones)
    return { events, localized: true }
  } catch {
    return { events: sourceEvents, localized: false }
  }
}
