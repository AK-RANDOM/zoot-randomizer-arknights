/** Event-stage quick-add catalog derived from the English game-data tables. */
export type GarrisonEventStageType = 'standard' | 'h' | 'ex' | 's'
export type GarrisonEventGroup = 'main' | 'side'

export interface GarrisonEvent {
  id: string
  name: string
  group: GarrisonEventGroup
  /** First release timestamp, from activity data (when available). */
  releaseTime: number | null
  stages: Record<GarrisonEventStageType, string[]>
}

const STAGE_TYPES: readonly GarrisonEventStageType[] = ['standard', 'h', 'ex', 's']
const MAIN_TYPES: readonly GarrisonEventStageType[] = ['standard', 'h']
const SIDE_TYPES: readonly GarrisonEventStageType[] = ['standard', 'ex', 's']

/** Stage categories are specific to story type, and empty ones are omitted. */
export function availableGarrisonEventStageTypes(event: GarrisonEvent): GarrisonEventStageType[] {
  return (event.group === 'main' ? MAIN_TYPES : SIDE_TYPES).filter(
    (type) => event.stages[type]?.length > 0,
  )
}

export function classifyGarrisonEventStage(code: string): GarrisonEventStageType | null {
  // Tutorial labels occur both standalone (TR-15) and inside event codes (SN-TR-1).
  if (/(?:^|-)TR(?:-|\d|$)/i.test(code)) return null
  if (!code.trim()) return null
  if (/^[a-z0-9]+-EX-?\d+$/i.test(code)) return 'ex'
  if (/^[a-z0-9]+-S-?\d+$/i.test(code)) return 's'
  // Any other non-tutorial operation for this event belongs in Standard.
  return 'standard'
}

/**
 * Zone assignments alone aren't enough for a Main Story event: side-event
 * operations can also be assigned to a main_# zone. Only accept operation
 * codes belonging to that episode. Main Story S# operations are Standard,
 * while H# operations have their own H category.
 */
export function classifyMainStoryStage(
  code: string,
  episode: number,
): GarrisonEventStageType | null {
  if (/(?:^|-)TR(?:-|\d|$)/i.test(code)) return null
  if (new RegExp(`^H${episode}-\\d+$`, 'i').test(code)) return 'h'
  if (new RegExp(`^(?:S)?${episode}-\\d+$`, 'i').test(code)) return 'standard'
  // Episode 8's core operations use three story-route prefixes.
  if (episode === 8 && /^(?:R8|M8|JT8)-\d+$/i.test(code)) return 'standard'
  return null
}

interface GameActivity {
  name?: string
  displayType?: string
  startTime?: number
  isReplicate?: boolean
}
interface GameZone {
  type?: string
  zoneIndex?: number
  zoneNameSecond?: string | null
  zoneNameThird?: string | null
}
interface GameStage {
  code?: string
  zoneId?: string
  stageType?: string
  difficulty?: string
  isStoryOnly?: boolean
  isHardPredefined?: boolean
}

const cleanedEventName = (name: string): string =>
  name
    .trim()
    .replace(/\s*[-–—]+\s*$/, '')
    .trim()

/**
 * Exclude the rerun *record*, never the original event. In game data,
 * isReplicate can be set on an original event after it receives a rerun;
 * filtering that flag drops the original event as well.
 */
function isRerunActivity(activityId: string): boolean {
  return /(?:^|[_-])(?:re|rerun|replicate)(?:[_-]\d+)?$/i.test(activityId)
}

/** Some collaboration Side Stories use a different displayType in activity_table. */
function isSideEvent(activityId: string, activity: GameActivity, zone: GameZone): boolean {
  return (
    // Vignettes (mini events) and other Branchline activities are not
    // accessible via this Side Story stage picker.
    (/^act\d+side$/.test(activityId) && zone.type === 'ACTIVITY') ||
    (activity.displayType === 'SIDESTORY' && !/mini|sre|rerun|_re$/i.test(activityId))
  )
}

const validReleaseTime = (time: number | undefined): number | null =>
  typeof time === 'number' && Number.isFinite(time) && time > 0 ? time : null

/** Get the episode number from the mainline zone, including event/retro releases. */
function mainlineEpisode(zoneId: string, zone: GameZone): number | null {
  if (zone.type === 'MAINLINE') {
    const match = /^main_(\d+)$/.exec(zoneId)
    return match ? Number(match[1]) : null
  }
  if (zone.type === 'MAINLINE_ACTIVITY' || zone.type === 'MAINLINE_RETRO') {
    const match = /\bEPISODE\s*(\d+)\b/i.exec(zone.zoneNameThird ?? '')
    return match ? Number(match[1]) : null
  }
  return null
}

/**
 * Keep catalog generation independent of Electron and network access so it can
 * be tested with game-data fixtures. Do not synthesize missing stage numbers.
 * Group Main Story in chapter/release order and Side Story by original event start.
 */
export function buildGarrisonEventCatalog(
  activityTable: { basicInfo?: Record<string, GameActivity> },
  zoneTable: { zones?: Record<string, GameZone> },
  stageTable: { stages?: Record<string, GameStage> },
): GarrisonEvent[] {
  const activities = activityTable.basicInfo ?? {}
  const zones = zoneTable.zones ?? {}
  const byKey = new Map<string, GarrisonEvent>()

  // Within each event, keep game-defined zone order, then numeric operation code.
  const stages = Object.values(stageTable.stages ?? {}).sort((left, right) => {
    const az = left.zoneId ?? ''
    const bz = right.zoneId ?? ''
    const ai = zones[az]?.zoneIndex ?? 0
    const bi = zones[bz]?.zoneIndex ?? 0
    return ai - bi || (left.code ?? '').localeCompare(right.code ?? '', 'en', { numeric: true })
  })

  for (const stage of stages) {
    if (stage.difficulty !== 'NORMAL' || stage.isStoryOnly || stage.isHardPredefined) continue
    const code = stage.code?.trim() ?? ''
    const zoneId = stage.zoneId ?? ''
    const zone = zones[zoneId]
    if (!zone) continue

    const episode = mainlineEpisode(zoneId, zone)
    const isMain = episode !== null
    const type = isMain ? classifyMainStoryStage(code, episode) : classifyGarrisonEventStage(code)
    if (!type) continue
    // Do not collapse actXXside_rerun_zone1 into actXXside: it is a separate
    // activity record that must be excluded, not appended to the original.
    const activityId = zoneId.replace(/_zone\d+.*$/, '')
    const activity = activities[activityId]
    if (isMain) {
      // Main-story chapters can be served from normal mainline or from
      // limited-time/retro mainline zones. Merge them by episode number.
      // Some S# sub-operations use SUB rather than MAIN stageType.
      if (!['MAIN', 'SUB', 'ACTIVITY'].includes(stage.stageType ?? '')) continue
    } else if (
      stage.stageType !== 'ACTIVITY' ||
      !activity ||
      isRerunActivity(activityId) ||
      !isSideEvent(activityId, activity, zone)
    ) {
      continue
    }

    const group: GarrisonEventGroup = isMain ? 'main' : 'side'
    const name = isMain
      ? `Chapter ${episode} - ${cleanedEventName(zone.zoneNameSecond ?? '')}`
      : cleanedEventName(activity?.name ?? '')
    if (!name || (isMain && !zone.zoneNameSecond?.trim())) continue
    const key = isMain ? `main:${episode}` : `side:${name.toLocaleLowerCase('en')}`
    let event = byKey.get(key)
    const releaseTime = validReleaseTime(activity?.startTime)
    if (!event) {
      event = {
        id: isMain ? `main:${episode}` : activityId,
        name,
        group,
        releaseTime,
        stages: { standard: [], h: [], ex: [], s: [] },
      }
      byKey.set(key, event)
    } else if (releaseTime !== null) {
      // If the source contains multiple original zones, keep the first release date.
      event.releaseTime =
        event.releaseTime === null ? releaseTime : Math.min(event.releaseTime, releaseTime)
    }
    if (!event.stages[type].includes(code)) event.stages[type].push(code)
  }

  return [...byKey.values()]
    .filter((event) => STAGE_TYPES.some((type) => event.stages[type].length > 0))
    .sort((left, right) => {
      if (left.group !== right.group) return left.group === 'main' ? -1 : 1
      if (left.group === 'main') {
        // Episodes are released sequentially. This also handles chapters that
        // have no activity_table release timestamp.
        return Number(left.id.split(':')[1]) - Number(right.id.split(':')[1])
      }
      return (
        (left.releaseTime ?? Number.POSITIVE_INFINITY) -
          (right.releaseTime ?? Number.POSITIVE_INFINITY) ||
        left.name.localeCompare(right.name, 'en')
      )
    })
}

export function appendEventStages(
  existing: readonly { name: string }[],
  event: GarrisonEvent,
  type: GarrisonEventStageType,
): string[] {
  const names = new Set(existing.map((stage) => stage.name.trim().toLowerCase()))
  return event.stages[type].filter((name) => {
    const key = name.trim().toLowerCase()
    if (names.has(key)) return false
    names.add(key)
    return true
  })
}
