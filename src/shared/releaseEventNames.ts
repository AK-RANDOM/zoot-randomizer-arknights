type NamedRecord = { name?: string; topicName?: string }
type Table = Record<string, unknown>
import type { OperatorDataset, ReleaseServer } from './operator'

export interface GameplayReleaseCandidate {
  id: string
  time: number
  category: string
}

export function gameplayReleaseCandidates(
  rogue: Table,
  crisis: Table,
  crisisV2: Table,
  sandbox: Table,
): GameplayReleaseCandidate[] {
  const result: GameplayReleaseCandidate[] = []
  const add = (id: string, time: unknown, category: string): void => {
    if (typeof time === 'number' && Number.isFinite(time)) result.push({ id, time, category })
  }
  for (const [id, item] of Object.entries(
    (rogue.topics ?? {}) as Record<string, { startTime?: number }>,
  ))
    add(`dis_${id}`, item.startTime, 'roguelike')
  for (const item of (crisis.seasonInfo ?? []) as { seasonId?: string; startTs?: number }[]) {
    const n = /^rune_season_(\d+)_/.exec(item.seasonId ?? '')?.[1]
    if (n) add(`dis_rune_${n}`, item.startTs, 'crisis')
  }
  for (const [id, item] of Object.entries(
    (crisisV2.seasonInfoDataMap ?? {}) as Record<string, { startTs?: number }>,
  ))
    add(id, item.startTs, 'crisis')
  for (const [id, item] of Object.entries(
    (sandbox.basicInfo ?? {}) as Record<string, { topicStartTime?: number }>,
  ))
    add(`dis_perm_${id}`, item.topicStartTime, 'other')
  return result
}

/** Discover new story, mode, April Fools, and explicit login rewards from official tables. */
export function appendUnregisteredActivityReleases(
  dataset: OperatorDataset,
  tables: Partial<Record<ReleaseServer, Table>>,
  names: Partial<Record<ReleaseServer, Record<string, string>>>,
): void {
  const events = [...(dataset.releaseEvents ?? [])]
  const rewardIds = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return []
    const record = value as Record<string, unknown>
    return [
      ...(record.type === 'CHAR' && typeof record.id === 'string' ? [record.id] : []),
      ...Object.values(record).flatMap(rewardIds),
    ]
  }
  for (const server of ['cn', 'global'] as const) {
    const table = tables[server] ?? {}
    const activities = Object.entries(
      (table.basicInfo ?? {}) as Record<
        string,
        { name?: string; startTime?: number; endTime?: number; hasStage?: boolean }
      >,
    )
    const dateFor = (time: number): string =>
      new Date((time + (server === 'cn' ? 8 * 3600 : 0)) * 1000).toISOString().slice(0, 10)
    const modes = (table.gameplayReleaseCandidates ?? []) as GameplayReleaseCandidate[]
    const uncovered = dataset.operators.filter(
      (operator) =>
        operator.availableOn[server] &&
        operator.release[server].date &&
        !events.some((event) => event.server === server && event.operatorIds.includes(operator.id)),
    )
    for (const operator of uncovered) {
      const date = operator.release[server].date!
      const login = activities
        .filter(([id, activity]) => {
          if (!/(?:sign|login|checkin)/i.test(id) || typeof activity.startTime !== 'number')
            return false
          if (
            date < dateFor(activity.startTime) ||
            (typeof activity.endTime === 'number' && date > dateFor(activity.endTime))
          )
            return false
          const configurations = Object.values(
            (table.activity ?? {}) as Record<string, Record<string, unknown>>,
          ).flatMap((entries) => (entries[id] ? [entries[id]] : []))
          return configurations.flatMap(rewardIds).includes(operator.id)
        })
        .map(([id]) => ({ id, category: 'login' }))
      const dated = activities
        .filter(
          ([id, activity]) =>
            typeof activity.startTime === 'number' &&
            Number.isFinite(activity.startTime) &&
            dateFor(activity.startTime) === date &&
            ((activity.hasStage && /(?:side|mini)$/.test(id)) || /^act\d+fun$/.test(id)),
        )
        .map(([id]) => ({
          id,
          category: /fun$/.test(id) ? 'april' : /mini$/.test(id) ? 'mini_event' : 'side_story',
        }))
      const gameplay = modes.filter((mode) => dateFor(mode.time) === date)
      const candidates = dated.length ? dated : gameplay.length ? gameplay : login
      if (candidates.length !== 1) continue
      const { id, category } = candidates[0]
      const sourceName =
        names.global?.[id] ??
        names[server]?.[id] ??
        activities.find(([key]) => key === id)?.[1].name
      const name =
        category === 'april'
          ? `${date.slice(0, 4)} April Fools`
          : category === 'login' && sourceName
            ? `Login Event: ${sourceName}`
            : sourceName
      if (!name) continue
      const existing = events.find(
        (event) => event.id === id && event.server === server && event.date === date,
      )
      if (existing) existing.operatorIds.push(operator.id)
      else events.push({ id, category, server, date, name, operatorIds: [operator.id] })
    }
  }
  dataset.releaseEvents = events
}

/** Stable source IDs link release metadata to official event/mode names. */
export function releaseEventNameMap(
  activities: Table,
  rogue: Table = {},
  crisis: Table = {},
  crisisV2: Table = {},
  sandbox: Table = {},
  zones: Table = {},
): Record<string, string> {
  const names: Record<string, string> = {}
  const add = (id: string, name: string | undefined): void => {
    if (name?.trim()) names[id] = name.trim()
  }
  for (const [id, item] of Object.entries(
    (activities.basicInfo ?? {}) as Record<string, NamedRecord>,
  ))
    add(id, item.name)
  for (const [id, item] of Object.entries((rogue.topics ?? {}) as Record<string, NamedRecord>)) {
    const number = /^rogue_(\d+)$/.exec(id)?.[1]
    if (number) add(`dis_${id}`, item.name ? `IS#${Number(number) + 1}: ${item.name}` : undefined)
  }
  for (const item of (crisis.seasonInfo ?? []) as (NamedRecord & { seasonId?: string })[]) {
    const season = /^rune_season_(\d+)_/.exec(item.seasonId ?? '')?.[1]
    if (season) add(`dis_rune_${season}`, item.name ? `CC#${season}: ${item.name}` : undefined)
  }
  for (const [id, item] of Object.entries(
    (crisisV2.seasonInfoDataMap ?? {}) as Record<string, NamedRecord>,
  )) {
    const number = /^crisis_v2_season_(\d+)_/.exec(id)?.[1]
    if (number) add(id, item.name ? `CCB#${number}: ${item.name}` : undefined)
  }
  for (const [id, item] of Object.entries(
    (sandbox.basicInfo ?? {}) as Record<string, NamedRecord>,
  )) {
    const number = /^sandbox_(\d+)$/.exec(id)?.[1]
    if (number)
      add(
        `dis_perm_${id}`,
        item.topicName ? `RA#${Number(number) + 1}: ${item.topicName}` : undefined,
      )
  }
  for (const [id, item] of Object.entries(
    (zones.zones ?? {}) as Record<string, { zoneNameSecond?: string }>,
  )) {
    const chapter = /^main_(\d+)$/.exec(id)?.[1]
    if (!chapter || !item.zoneNameSecond?.trim()) continue
    const name = `Chapter ${chapter} - ${item.zoneNameSecond.trim()}`
    add(`dis_main_${chapter}`, name)
    if (Number(chapter) >= 14) add(`act${Number(chapter) - 13}mainss`, name)
  }
  return names
}
