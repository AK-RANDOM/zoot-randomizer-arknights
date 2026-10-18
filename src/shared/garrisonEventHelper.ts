import type { Operator, ReleaseServer } from './operator'
import type { GarrisonEvent } from './garrisonEventCatalog'

/**
 * Main Theme chapters have no reliable activity startTime once their stages
 * move to main_N zones. Tie their representative to the episode instead of
 * trying to infer one from nearby operator releases.
 *
 * Chapters 0–4 predate a featured new 6★ operator; Caster Amiya is the
 * explicitly requested fallback, rather than another Amiya class form.
 */
export const GARRISON_CHAPTER_HELPER_IDS: Readonly<Record<number, string>> = {
  0: 'char_002_amiya',
  1: 'char_002_amiya',
  2: 'char_002_amiya',
  3: 'char_002_amiya',
  4: 'char_002_amiya',
  5: 'char_010_chen',
  6: 'char_017_huang',
  7: 'char_113_cqbw',
  8: 'char_391_rosmon',
  9: 'char_479_sleach',
  10: 'char_4039_horn',
  11: 'char_4072_ironmn',
  12: 'char_4087_ines',
  13: 'char_4088_hodrer',
  14: 'char_1035_wisdel',
  15: 'char_4179_monstr',
  16: 'char_4204_mantra',
  17: 'char_1052_kalts2',
}

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
        a.distance - b.distance ||
        Number(b.operator.acquisition.family === 'limited') -
          Number(a.operator.acquisition.family === 'limited') ||
        a.operator.id.localeCompare(b.operator.id),
    )
  return candidates[0]?.operator ?? null
}
