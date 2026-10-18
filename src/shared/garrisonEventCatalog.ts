/** Event-stage quick-add catalog derived from the English game-data tables. */
export type GarrisonEventStageType = 'standard' | 'ex' | 's'
export type GarrisonEventGroup = 'main' | 'side'

export interface GarrisonEvent {
  id: string
  name: string
  group: GarrisonEventGroup
  /** First release timestamp, from activity data (when available). */
  releaseTime: number | null
  stages: Record<GarrisonEventStageType, string[]>
}

const STAGE_TYPES: readonly GarrisonEventStageType[] = ['standard', 'ex', 's']

export function classifyGarrisonEventStage(code: string): GarrisonEventStageType | null {
  if (/^[a-z0-9]+-EX-?\d+$/i.test(code)) return 'ex'
  if (/^[a-z0-9]+-S-?\d+$/i.test(code)) return 's'
  if (/^[a-z0-9]+-\d+$/i.test(code)) return 'standard'
  return null // No tutorial, story-only, challenge, MO, or special stages.
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
    const type = classifyGarrisonEventStage(code)
    if (!type) continue
    const zoneId = stage.zoneId ?? ''
    const zone = zones[zoneId]
    if (!zone) continue

    const episode = mainlineEpisode(zoneId, zone)
    const isMain = episode !== null
    const activityId = zoneId.split('_')[0]
    const activity = activities[activityId]
    if (isMain) {
      // Main-story chapters can be served from normal mainline or from
      // limited-time/retro mainline zones. Merge them by episode number.
      if (!['MAIN', 'ACTIVITY'].includes(stage.stageType ?? '')) continue
    } else if (
      stage.stageType !== 'ACTIVITY' ||
      !activity ||
      !['SIDESTORY', 'BRANCHLINE'].includes(activity.displayType ?? '')
    ) {
      continue
    }

    const group: GarrisonEventGroup = isMain ? 'main' : 'side'
    const name = isMain
      ? `Chapter ${episode} - ${cleanedEventName(zone.zoneNameSecond ?? '')}`
      : cleanedEventName(
          activity?.isReplicate
            ? cleanedEventName(activity.name ?? '').replace(
                /\s*(?:\((?:re)?run\)|（复刻）|\s+rerun)\s*$/i,
                '',
              )
            : (activity?.name ?? ''),
        )
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
        stages: { standard: [], ex: [], s: [] },
      }
      byKey.set(key, event)
    } else if (releaseTime !== null) {
      // When a side story has reruns, retain its original/earliest release date.
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
