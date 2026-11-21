import {
  GARRISON_CHAPTER_HELPER_IDS,
  GARRISON_EXPLICIT_EVENT_HELPER_IDS,
} from './dataCorrections.ts'
export {
  GARRISON_CHAPTER_HELPER_IDS,
  GARRISON_EXPLICIT_EVENT_HELPER_IDS,
} from './dataCorrections.ts'
import type { Operator, ReleaseServer } from './operator'
import type { GarrisonEvent } from './garrisonEventCatalog'

const ONE_DAY_MS = 86_400_000

/** A game-data activity timestamp and operator release date can differ by a day across timezones. */
function dateDistanceInDays(releaseTime: number, date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const dateMs = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(dateMs) || !Number.isFinite(releaseTime)) return null
  return Math.abs(Math.floor((releaseTime * 1000) / ONE_DAY_MS) - dateMs / ONE_DAY_MS)
}

/**
 * Resolve a portrait by source-region *original* event date, not its localized
 * name, and never by the operator pool's current filters or appearance options.
 * For simultaneous new 6★ releases, the limited one is representative.
 * When no release reasonably matches an event, return null instead of
 * displaying an unrelated operator.
 */
export function garrisonEventHelperOperator(
  event: GarrisonEvent | null | undefined,
  operators: readonly Operator[],
  region: ReleaseServer,
): Operator | null {
  if (!event) return null

  if (event.group === 'main') {
    const match = /^main:(\d+)$/.exec(event.id)
    const chapter = match ? Number(match[1]) : NaN
    const id = GARRISON_CHAPTER_HELPER_IDS[chapter]
    if (id) return operators.find((operator) => operator.id === id) ?? null
  }

  // Canonical event identity wins over inferred date proximity. This also
  // covers CN event metadata where the timestamp differs from Ash's debut.
  const explicitId = GARRISON_EXPLICIT_EVENT_HELPER_IDS[event.id.toLowerCase()]
  if (explicitId) {
    return (
      operators.find(
        (operator) =>
          operator.id === explicitId && operator.rarity === 6 && operator.availableOn[region],
      ) ?? null
    )
  }

  // Live limited banners identify their headline operator even when a dataset
  // still has a preload date or an outdated acquisition classification.
  if (event.limitedOperatorIds?.length) {
    for (const id of event.limitedOperatorIds) {
      const operator = operators.find(
        (candidate) =>
          candidate.id === id && candidate.rarity === 6 && candidate.availableOn[region],
      )
      if (operator) return operator
    }
    return null
  }

  if (event.releaseTime === null) return null
  const candidates = operators
    .filter((operator) => operator.rarity === 6 && operator.availableOn[region])
    .map((operator) => ({
      operator,
      distance: dateDistanceInDays(event.releaseTime!, operator.release[region].date ?? ''),
    }))
    .filter(
      (item): item is { operator: Operator; distance: number } =>
        item.distance !== null && item.distance <= 1,
    )
    .sort(
      (a, b) =>
        Number(b.operator.acquisition.family === 'limited') -
          Number(a.operator.acquisition.family === 'limited') ||
        a.distance - b.distance ||
        a.operator.id.localeCompare(b.operator.id),
    )
  return candidates[0]?.operator ?? null
}
