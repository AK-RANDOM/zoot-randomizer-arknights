import type { GameLocale, ReleaseServer } from '../shared/operator'
import type { GarrisonEvent } from '../shared/garrisonEventCatalog'
import { getOperatorDataClient } from './operatorDataService'

/** Catalogs belong to the active package; no separate network/cache revision exists. */
export async function getGarrisonEventCatalog(
  region: ReleaseServer,
  locale: GameLocale,
): Promise<GarrisonEvent[]> {
  return getOperatorDataClient().getCatalog(region, locale)
}
