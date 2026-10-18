/** Event-stage quick-add catalog derived from the English game-data tables. */
export type GarrisonEventStageType = 'standard' | 'ex' | 's'

export interface GarrisonEvent {
  id: string
  name: string
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
  isReplicate?: boolean
}
interface GameZone {
  zoneIndex?: number
}
interface GameStage {
  code?: string
  zoneId?: string
  stageType?: string
  difficulty?: string
  isStoryOnly?: boolean
  isHardPredefined?: boolean
}

/**
 * Keep catalog generation independent of Electron and network access so it can
 * be tested with game-data fixtures. Do not synthesize missing stage numbers.
 */
export function buildGarrisonEventCatalog(
  activityTable: { basicInfo?: Record<string, GameActivity> },
  zoneTable: { zones?: Record<string, GameZone> },
  stageTable: { stages?: Record<string, GameStage> },
): GarrisonEvent[] {
  const activities = activityTable.basicInfo ?? {}
  const zones = zoneTable.zones ?? {}
  const byName = new Map<string, GarrisonEvent>()

  // Sort by game-defined zone order first, then by the numeric operation code.
  const stages = Object.values(stageTable.stages ?? {}).sort((left, right) => {
    const az = left.zoneId ?? ''
    const bz = right.zoneId ?? ''
    const ai = zones[az]?.zoneIndex ?? 0
    const bi = zones[bz]?.zoneIndex ?? 0
    return ai - bi || (left.code ?? '').localeCompare(right.code ?? '', 'en', { numeric: true })
  })

  for (const stage of stages) {
    if (stage.stageType !== 'ACTIVITY' || stage.difficulty !== 'NORMAL') continue
    if (stage.isStoryOnly || stage.isHardPredefined) continue
    const code = stage.code?.trim() ?? ''
    const type = classifyGarrisonEventStage(code)
    if (!type) continue
    const activityId = stage.zoneId?.split('_')[0] ?? ''
    const activity = activities[activityId]
    if (!activity || !['SIDESTORY', 'BRANCHLINE'].includes(activity.displayType ?? '')) continue
    // Reruns use separate activity IDs, but the same stages should appear only once.
    const name = (
      activity.isReplicate
        ? activity.name?.replace(/\s*(?:\((?:re)?run\)|（复刻）|\s+rerun)\s*$/i, '')
        : activity.name
    )?.trim()
    if (!name) continue
    const key = name.toLocaleLowerCase('en')
    let event = byName.get(key)
    if (!event) {
      event = { id: activityId, name, stages: { standard: [], ex: [], s: [] } }
      byName.set(key, event)
    }
    if (!event.stages[type].includes(code)) event.stages[type].push(code)
  }

  // If the activity contained no stages of the three supported types, it won't
  // be shown; events can legitimately lack EX or S operations.
  return [...byName.values()]
    .filter((event) => STAGE_TYPES.some((type) => event.stages[type].length > 0))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
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
