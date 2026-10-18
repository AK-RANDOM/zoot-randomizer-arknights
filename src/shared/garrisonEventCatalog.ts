/** Event-stage quick-add catalog derived from region-specific game-data tables. */
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
 * An activity can keep `isReplicate: true` after a rerun; it is NOT a
 * rerun-only flag. Use record identity and the event's own rerun label.
 * Legacy reruns (e.g. act14d7) have no `_re` suffix at all.
 */
function isRerunActivity(activityId: string, activity: GameActivity): boolean {
  return (
    /^act\d+(?:r\d+)?sre$/i.test(activityId) ||
    /(?:^|[_-])(?:re|rerun|replicate)(?:[_-]\d+)?$/i.test(activityId) ||
    hasRerunSuffix(activity.name ?? '')
  )
}

function hasRerunSuffix(name: string): boolean {
  return /(?:\(\s*(?:re[ -]?run|replicate|复刻|復刻)\s*\)|(?:[\s·・:–—-]+)(?:re[ -]?run|replicate|复刻|復刻))\s*$/i.test(
    name.trim(),
  )
}

/** Rerun entries share their ORIGINAL event's title, not a new dropdown item. */
function originalEventName(name: string): string {
  const trimmed = cleanedEventName(name)
  return cleanedEventName(
    trimmed.replace(
      /(?:\(\s*(?:re[ -]?run|replicate|复刻|復刻)\s*\)|(?:[\s·・:–—-]+)(?:re[ -]?run|replicate|复刻|復刻))\s*$/i,
      '',
    ),
  )
}

/**
 * Old Side Stories have ids like `act15d0` and displayType `TYPE_ACT9D0`.
 * New events use `act45side` with `TYPE_ACT9D0` or `TYPE_ACT45SIDE`.
 * Do not whitelist only a modern id/displayType spelling: that silently
 * removes earlier Side Stories from the list.
 */
function isSideEvent(activityId: string, activity: GameActivity, zone: GameZone): boolean {
  if (zone.type && zone.type !== 'ACTIVITY') return false
  const displayType = activity.displayType?.trim().toUpperCase() ?? ''
  // Vignettes are MINISTORY/BRANCHLINE; actXXmini is their record family.
  if (
    displayType === 'MINISTORY' ||
    displayType === 'BRANCHLINE' ||
    /(?:mini|vignette)/i.test(activityId)
  )
    return false
  return (
    /^act\d+side$/i.test(activityId) ||
    displayType === 'SIDESTORY' ||
    /^TYPE_ACT\d+(?:D\d+|SIDE)$/i.test(displayType)
  )
}

/**
 * Expose the dominant numbered operation prefix for catalog diagnostics.
 * The actual rerun deduplication uses canonical IDs, map-zone identity,
 * names, and shared stage codes; a prefix on its own is not sufficient.
 */
export function garrisonSideStoryStageFamily(event: GarrisonEvent): string | null {
  const counts = new Map<string, number>()
  for (const code of event.stages.standard) {
    const match = /^([A-Z][A-Z0-9]{0,7})-\d+$/i.exec(code.trim())
    if (!match) continue
    const family = match[1].toUpperCase()
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }
  const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return winner && winner[1] >= 2 ? winner[0] : null
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
  const sideByActivity = new Map<string, GarrisonEvent>()
  // Some earliest events survive in the activity metadata even when their
  // original battle zones have been moved to the permanent archive. Recover
  // the *original* release timestamp instead of the subsequent rerun date.
  const originalReleaseByName = new Map<string, number>()
  for (const [activityId, activity] of Object.entries(activities)) {
    const time = validReleaseTime(activity.startTime)
    if (time === null || !activity.name?.trim()) continue
    if (!isSideEvent(activityId, activity, {})) continue
    const key = originalEventName(activity.name).toLocaleLowerCase('en')
    const old = originalReleaseByName.get(key)
    if (old === undefined || time < old) originalReleaseByName.set(key, time)
  }

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
    // Keep source activity identity until the original-vs-rerun deduplication.
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
      !isSideEvent(activityId, activity, zone)
    ) {
      continue
    }

    const group: GarrisonEventGroup = isMain ? 'main' : 'side'
    const name = isMain
      ? `Chapter ${episode} - ${cleanedEventName(zone.zoneNameSecond ?? '')}`
      : originalEventName(activity?.name ?? '')
    if (!name || (isMain && !zone.zoneNameSecond?.trim())) continue
    const key = isMain ? `main:${episode}` : activityId
    const target = isMain ? byKey : sideByActivity
    let event = target.get(key)
    const releaseTime = validReleaseTime(activity?.startTime)
    if (!event) {
      event = {
        id: isMain ? `main:${episode}` : activityId,
        name,
        group,
        releaseTime,
        stages: { standard: [], h: [], ex: [], s: [] },
      }
      target.set(key, event)
    } else if (releaseTime !== null) {
      event.releaseTime =
        event.releaseTime === null ? releaseTime : Math.min(event.releaseTime, releaseTime)
    }
    if (!event.stages[type].includes(code)) event.stages[type].push(code)
  }

  // The activity table contains *records for runs*, not a canonical list of
  // stories. `act19side` and `act19sre`, for example, are the original and
  // rerun of Dorothy's Vision. Their stage lists need not have identical
  // layouts, so matching stage-code families alone is insufficient.
  //
  // Use three grounded identities (in precedence order):
  // 1. Explicit `actNNsre` -> `actNNside` original/rerun relationship.
  // 2. Actual activity-zone chapter names, matched by the full ordered set.
  // 3. Normalized event title or at least two identical operation codes.
  // A standalone `actNNsre` remains usable if the original has no playable
  // stages in the current data, instead of silently removing the Side Story.
  const normalizeIdentity = (value: string): string =>
    value.toLocaleLowerCase('en').replace(/[\p{P}\p{S}\s]+/gu, '')
  // Original act17d0 has "Task Records"; rerun act1r6sre uses "Task Record".
  // Compare full multi-zone identities after safe English singular/plural
  // normalization; never merge by one generic chapter name alone.
  const normalizeZoneIdentity = (value: string): string => {
    const normalized = value
      .toLocaleLowerCase('en')
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ')
    return normalizeIdentity(normalized.replace(/\b([a-z]{4,})s\b$/u, '$1'))
  }
  const zoneIdentityByActivity = new Map<string, string>()
  const zoneNamesByActivity = new Map<string, string[]>()
  for (const [zoneId, zone] of Object.entries(zones)) {
    if (zone.type !== 'ACTIVITY') continue
    const activityId = /^(act[0-9a-z]+)_zone\d+/i.exec(zoneId)?.[1]
    const name = zone.zoneNameSecond?.trim()
    if (!activityId || !name) continue
    const names = zoneNamesByActivity.get(activityId) ?? []
    const normalized = normalizeZoneIdentity(name)
    if (normalized && !names.includes(normalized)) names.push(normalized)
    zoneNamesByActivity.set(activityId, names)
  }
  for (const [activityId, names] of zoneNamesByActivity) {
    // Require more than one zone: unrelated events often reuse a generic
    // single-zone title such as "Test Site" or "Main Stage".
    if (names.length >= 2) zoneIdentityByActivity.set(activityId, [...names].sort().join('|'))
  }

  const candidates = [...sideByActivity.values()]
  const parents = candidates.map((_, index) => index)
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]]
      index = parents[index]
    }
    return index
  }
  const unite = (left: number, right: number): void => {
    const a = find(left)
    const b = find(right)
    if (a !== b) parents[b] = a
  }
  const byActivityId = new Map(candidates.map((event, i) => [event.id, i]))
  const byName = new Map<string, number>()
  const byZoneIdentity = new Map<string, number>()
  const byStageCode = new Map<string, number[]>()
  for (const [index, candidate] of candidates.entries()) {
    // Rerun record IDs do not have to be included in the name-matching
    // metadata. Some have localized titles without a rerun suffix.
    const rerunPair = /^act(\d+)sre$/i.exec(candidate.id)
    if (rerunPair) {
      const original = byActivityId.get(`act${rerunPair[1]}side`)
      if (original !== undefined) unite(index, original)
    }
    const nameKey = normalizeIdentity(candidate.name)
    const sameName = byName.get(nameKey)
    if (nameKey && sameName !== undefined) unite(index, sameName)
    else if (nameKey) byName.set(nameKey, index)

    const zoneIdentity = zoneIdentityByActivity.get(candidate.id)
    if (zoneIdentity) {
      const sameZone = byZoneIdentity.get(zoneIdentity)
      if (sameZone !== undefined) unite(index, sameZone)
      else byZoneIdentity.set(zoneIdentity, index)
    }
    // Two equal operation codes provide independent corroboration when the
    // event's zone labels change between versions/localizations.
    for (const code of new Set(STAGE_TYPES.flatMap((type) => candidate.stages[type]))) {
      if (/^(?:EX|S|TR)-\d+$/i.test(code)) continue
      const holders = byStageCode.get(code) ?? []
      holders.push(index)
      byStageCode.set(code, holders)
    }
  }
  const sharedCodes = new Map<string, number>()
  for (const owners of byStageCode.values()) {
    for (let a = 0; a < owners.length; a++) {
      for (let b = a + 1; b < owners.length; b++) {
        const pair = `${owners[a]}:${owners[b]}`
        sharedCodes.set(pair, (sharedCodes.get(pair) ?? 0) + 1)
      }
    }
  }
  for (const [pair, count] of sharedCodes) {
    if (count < 2) continue
    const [left, right] = pair.split(':').map(Number)
    unite(left, right)
  }

  const grouped = new Map<number, GarrisonEvent[]>()
  for (const [index, candidate] of candidates.entries()) {
    const root = find(index)
    const group = grouped.get(root) ?? []
    group.push(candidate)
    grouped.set(root, group)
  }
  const canonicalSides = new Map<string, GarrisonEvent>()
  for (const group of grouped.values()) {
    // Prefer the original activity's stage data, not the rerun's reordered
    // stage list. For older `actNNdM` records, earlier release comes first.
    group.sort(
      (left, right) =>
        Number(isRerunActivity(left.id, activities[left.id]!)) -
          Number(isRerunActivity(right.id, activities[right.id]!)) ||
        (left.releaseTime ?? Infinity) - (right.releaseTime ?? Infinity) ||
        left.id.localeCompare(right.id, 'en'),
    )
    const chosen = group[0]
    let earliest = Math.min(
      ...group.flatMap((event) => [
        event.releaseTime ?? Infinity,
        originalReleaseByName.get(event.name.toLocaleLowerCase('en')) ?? Infinity,
      ]),
    )
    // Some old originals retain activity metadata and a map-zone record but
    // no longer have normal stages in stage_table. Keep their original
    // identity and date while borrowing the only available stage list.
    // This also prevents App Localization from restoring the rerun label.
    const rerunPair = /^act(\d+)sre$/i.exec(chosen.id)
    const directOriginalId = rerunPair ? `act${rerunPair[1]}side` : null
    const zoneIdentity = zoneIdentityByActivity.get(chosen.id)
    const originalOptions = [
      ...(directOriginalId ? [directOriginalId] : []),
      ...(zoneIdentity
        ? [...zoneIdentityByActivity.entries()]
            .filter(([, identity]) => identity === zoneIdentity)
            .map(([id]) => id)
        : []),
    ]
    const originalSource = [...new Set(originalOptions)]
      .filter((id) => {
        const activity = activities[id]
        return (
          activity &&
          isSideEvent(id, activity, {}) &&
          !isRerunActivity(id, activity) &&
          validReleaseTime(activity.startTime) !== null
        )
      })
      .sort((left, right) => activities[left]!.startTime! - activities[right]!.startTime!)[0]
    if (originalSource) {
      const original = activities[originalSource]!
      const originalTime = validReleaseTime(original.startTime)
      if (originalTime !== null && originalTime <= earliest) {
        chosen.id = originalSource
        if (original.name?.trim()) chosen.name = originalEventName(original.name)
        earliest = originalTime
      }
    }
    chosen.releaseTime = Number.isFinite(earliest) ? earliest : null
    canonicalSides.set(chosen.id, chosen)
  }

  return [...byKey.values(), ...canonicalSides.values()]
    .filter((event) => STAGE_TYPES.some((type) => event.stages[type].length > 0))
    .sort((left, right) => {
      if (left.group !== right.group) return left.group === 'main' ? -1 : 1
      if (left.group === 'main') {
        return Number(left.id.split(':')[1]) - Number(right.id.split(':')[1])
      }
      return (
        (left.releaseTime ?? Number.POSITIVE_INFINITY) -
          (right.releaseTime ?? Number.POSITIVE_INFINITY) ||
        left.name.localeCompare(right.name, 'en')
      )
    })
}

/**
 * Localize event labels independently from the metadata region used for the
 * event list, stage codes and original release order.
 *
 * A CN-only event may not exist in the requested locale. In that case its
 * source-region name is kept rather than dropping the event or inventing a
 * translation. Localized tables are intentionally used for labels only.
 */
export function localizeGarrisonEventNames(
  events: readonly GarrisonEvent[],
  activityTable: { basicInfo?: Record<string, GameActivity> },
  zoneTable: { zones?: Record<string, GameZone> },
): GarrisonEvent[] {
  const activities = activityTable.basicInfo ?? {}
  const zones = zoneTable.zones ?? {}
  const mainNames = new Map<number, string>()

  for (const [zoneId, zone] of Object.entries(zones)) {
    const episode = mainlineEpisode(zoneId, zone)
    const name = zone.zoneNameSecond?.trim()
    if (episode === null || !name) continue
    // The normal chapter-zone name has priority over limited/retro copies.
    if (!mainNames.has(episode) || zoneId === `main_${episode}`) {
      mainNames.set(episode, cleanedEventName(name))
    }
  }

  return events.map((event) => {
    let label: string | undefined
    if (event.group === 'main') {
      const episode = Number(event.id.replace(/^main:/, ''))
      const title = mainNames.get(episode)
      if (title) label = `Chapter ${episode} - ${title}`
    } else {
      const title = activities[event.id]?.name
      if (title?.trim()) label = originalEventName(title)
    }
    return label ? { ...event, name: label } : { ...event }
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
