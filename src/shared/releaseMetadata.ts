import {
  MONSTER_HUNTER_GLOBAL_RELEASE,
  SERVER_LAUNCH_DATES,
  ANNIVERSARY_BOUNDARIES,
  MAIN_STORY_DATE_OVERRIDES,
  AMIYA_FORM_RELEASES,
  RELEASE_DATE_OVERRIDES,
} from './dataCorrections.ts'
export {
  MONSTER_HUNTER_GLOBAL_RELEASE,
  SERVER_LAUNCH_DATES,
  ANNIVERSARY_BOUNDARIES,
  AMIYA_FORM_RELEASES,
  RELEASE_DATE_OVERRIDES,
  COLLABORATION_BY_OPERATOR_ID,
} from './dataCorrections.ts'
import type { ReleaseServer } from './operator'
import { CN_RELEASE_DATE_ALIASES, RELEASE_PRESENTATION_DATE_ALIASES } from './dataCorrections.ts'
import { limitedOperatorIdsInPool, type RawGachaTable } from './acquisitionMetadata.ts'

export const CN_RELEASE_DATES_API = 'https://prts.wiki/api.php'

export const RELEASE_METADATA_UPSTREAM = {
  repository: 'nadering/arknights-toolbox',
  infoPath: 'src/data/operator/generated/operator-release-info-map.generated.ts',
  candidatePath: 'src/data/operator/generated/operator-cn-release-candidates.generated.ts',
  eventPath: 'src/data/operator/generated/operator-release-events.generated.ts',
  infoUrl:
    'https://raw.githubusercontent.com/nadering/arknights-toolbox/main/src/data/operator/generated/operator-release-info-map.generated.ts',
  candidateUrl:
    'https://raw.githubusercontent.com/nadering/arknights-toolbox/main/src/data/operator/generated/operator-cn-release-candidates.generated.ts',
  eventUrl:
    'https://raw.githubusercontent.com/nadering/arknights-toolbox/main/src/data/operator/generated/operator-release-events.generated.ts',
} as const

export type OperatorReleaseCategory =
  'main_story' | 'side_story' | 'mini_event' | 'crisis' | 'roguelike' | 'server_open' | 'other'

interface ReleaseInfoEntry {
  eventId?: unknown
  category?: unknown
}

interface ReleaseCandidateActivity {
  id?: unknown
  cnStartTime?: unknown
  globalStartTime?: unknown
  isRerun?: unknown
}

interface ReleaseCandidate {
  addedActivityList?: ReleaseCandidateActivity[]
}

interface ReleaseEvent {
  category?: string
  name?: unknown
  id?: unknown
  server?: unknown
  startDate?: unknown
  operatorIds?: unknown
}

export function buildReleaseEventNames(
  source: string,
  operators: readonly import('./operator').Operator[],
  activityNames: Partial<Record<import('./operator').ReleaseServer, Record<string, string>>> = {},
): NonNullable<import('./operator').OperatorDataset['releaseEvents']> {
  const events = generatedLiteral(
    source,
    'generatedOperatorReleaseEventList',
    '[',
    ']',
  ) as ReleaseEvent[]
  const byId = new Map(operators.map((operator) => [operator.id, operator]))
  return events.flatMap((event) => {
    if (typeof event.id !== 'string' || !Array.isArray(event.operatorIds)) return []
    return (['cn', 'global'] as const).flatMap((server) => {
      const byDate = new Map<string, string[]>()
      for (const id of event.operatorIds as unknown[]) {
        const operator = typeof id === 'string' ? byId.get(id) : undefined
        const date = operator?.release[server].date
        if (!operator?.availableOn[server] || !date) continue
        byDate.set(date, [...(byDate.get(date) ?? []), operator.id])
      }
      const publishedName =
        server === 'global' && event.id === MONSTER_HUNTER_GLOBAL_RELEASE.id
          ? MONSTER_HUNTER_GLOBAL_RELEASE.name
          : undefined
      const name =
        activityNames.global?.[event.id as string] ??
        activityNames[server]?.[event.id as string] ??
        publishedName
      return [...byDate].flatMap(([date, operatorIds]) => {
        const label =
          /(?:sign|login|checkin)/i.test(event.id as string) && name ? `Login Event: ${name}` : name
        const record = {
          id: event.id as string,
          category: event.category,
          server,
          date,
          name: label ?? `${date} Operator Release`,
          operatorIds,
        }
        const rerunIds: string[] =
          event.id === 'dis_rune_2'
            ? operatorIds.filter((id) => id === 'char_349_chiave' || id === 'char_344_beewax')
            : []
        if (!rerunIds.length) return [record]
        const remaining = operatorIds.filter((id) => !rerunIds.includes(id))
        return [
          ...(remaining.length ? [{ ...record, operatorIds: remaining }] : []),
          {
            ...record,
            id: 'act13d2',
            category: 'side_story',
            name: "Grani and the Knights' Treasure Rerun",
            operatorIds: rerunIds,
          },
        ]
      })
    })
  })
}

export interface OperatorReleaseDates {
  cn: string | null
  global: string | null
}

class GeneratedDataLiteralParser {
  private index = 0

  constructor(private readonly source: string) {}

  parse(): unknown {
    const value = this.parseValue()
    this.skipTrivia()
    if (this.index !== this.source.length) this.fail()
    return value
  }

  private parseValue(): unknown {
    this.skipTrivia()
    const character = this.source[this.index]

    if (character === '{') return this.parseObject()
    if (character === '[') return this.parseArray()
    if (character === '"') return this.parseString()
    if (character === '-' || (character >= '0' && character <= '9')) return this.parseNumber()
    if (this.consumeKeyword('true')) return true
    if (this.consumeKeyword('false')) return false
    if (this.consumeKeyword('null')) return null
    this.fail()
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{')
    const entries: Array<[string, unknown]> = []
    this.skipTrivia()
    if (this.consume('}')) return Object.fromEntries(entries)

    while (true) {
      this.skipTrivia()
      const key = this.source[this.index] === '"' ? this.parseString() : this.parseIdentifier()
      this.skipTrivia()
      this.expect(':')
      entries.push([key, this.parseValue()])
      this.skipTrivia()
      if (this.consume('}')) break
      this.expect(',')
      this.skipTrivia()
      if (this.consume('}')) break
    }

    return Object.fromEntries(entries)
  }

  private parseArray(): unknown[] {
    this.expect('[')
    const values: unknown[] = []
    this.skipTrivia()
    if (this.consume(']')) return values

    while (true) {
      values.push(this.parseValue())
      this.skipTrivia()
      if (this.consume(']')) break
      this.expect(',')
      this.skipTrivia()
      if (this.consume(']')) break
    }

    return values
  }

  private parseString(): string {
    const start = this.index
    this.expect('"')
    let escaped = false

    while (this.index < this.source.length) {
      const character = this.source[this.index]
      this.index += 1
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        return JSON.parse(this.source.slice(start, this.index)) as string
      }
    }

    this.fail()
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index))
    if (!match) this.fail()
    this.index += match[0].length
    return Number(match[0])
  }

  private parseIdentifier(): string {
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.source.slice(this.index))
    if (!match) this.fail()
    this.index += match[0].length
    return match[0]
  }

  private consumeKeyword(keyword: string): boolean {
    if (!this.source.startsWith(keyword, this.index)) return false
    const next = this.source[this.index + keyword.length]
    if (next && /[A-Za-z0-9_$]/.test(next)) return false
    this.index += keyword.length
    return true
  }

  private skipTrivia(): void {
    while (this.index < this.source.length) {
      if (/\s/.test(this.source[this.index])) {
        this.index += 1
        continue
      }
      if (this.source.startsWith('//', this.index)) {
        const newline = this.source.indexOf('\n', this.index + 2)
        this.index = newline < 0 ? this.source.length : newline + 1
        continue
      }
      if (this.source.startsWith('/*', this.index)) {
        const close = this.source.indexOf('*/', this.index + 2)
        if (close < 0) this.fail()
        this.index = close + 2
        continue
      }
      break
    }
  }

  private expect(character: string): void {
    this.skipTrivia()
    if (!this.consume(character)) this.fail()
  }

  private consume(character: string): boolean {
    if (this.source[this.index] !== character) return false
    this.index += 1
    return true
  }

  private fail(): never {
    throw new Error(`Unsupported generated release metadata syntax at offset ${this.index}.`)
  }
}

function parseGeneratedDataLiteral(source: string): unknown {
  try {
    return JSON.parse(source)
  } catch {
    return new GeneratedDataLiteralParser(source).parse()
  }
}

function generatedLiteral(source: string, marker: string, open: string, close: string): unknown {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error(`Release metadata marker not found: ${marker}`)
  const assignmentIndex = source.indexOf('=', markerIndex)
  const start = source.indexOf(open, assignmentIndex)
  if (assignmentIndex < 0 || start < 0) {
    throw new Error('Release metadata payload is malformed.')
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const character = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      continue
    }
    if (character === open) depth += 1
    if (character === close) depth -= 1

    if (depth === 0) return parseGeneratedDataLiteral(source.slice(start, index + 1))
  }

  throw new Error('Release metadata payload is malformed.')
}

function releaseInfoMap(infoSource: string): Record<string, ReleaseInfoEntry> {
  return generatedLiteral(infoSource, 'operatorReleaseInfoByCharId', '{', '}') as Record<
    string,
    ReleaseInfoEntry
  >
}

function dateFromTimestamp(value: unknown, utcOffsetHours = 0): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000 + utcOffsetHours * 3_600_000).toISOString().slice(0, 10)
}

export function releaseYearGroup(date: string | null, server: ReleaseServer): number | null {
  if (!date) return null
  const launch = SERVER_LAUNCH_DATES[server]
  if (date < launch) return null
  if (date === launch) return 0

  let group = 1
  for (const boundary of ANNIVERSARY_BOUNDARIES[server]) {
    if (date >= boundary) group += 1
    else break
  }
  return group
}

export function buildReleaseCategoryMap(
  infoSource: string,
): Record<string, OperatorReleaseCategory | null> {
  const info = releaseInfoMap(infoSource)
  const valid = new Set<OperatorReleaseCategory>([
    'main_story',
    'side_story',
    'mini_event',
    'crisis',
    'roguelike',
    'server_open',
    'other',
  ])

  return Object.fromEntries(
    Object.entries(info).map(([operatorId, entry]) => {
      const category =
        typeof entry.category === 'string' && valid.has(entry.category as OperatorReleaseCategory)
          ? (entry.category as OperatorReleaseCategory)
          : null
      return [operatorId, category]
    }),
  )
}

export interface PublishedCnReleaseRow {
  name?: unknown
  releaseDate?: unknown
}

/** Published CN availability dates are server-local dates, never asset/commit timestamps. */
export function publishedCnReleaseDates(
  rows: readonly PublishedCnReleaseRow[],
  characters: Record<string, { name?: unknown }>,
): Record<string, string> {
  const byName = new Map<string, string>()
  for (const row of rows) {
    if (typeof row.name !== 'string' || typeof row.releaseDate !== 'string') continue
    const date = /^(\d{4}-\d{2}-\d{2})(?: |$)/.exec(row.releaseDate)?.[1]
    if (!date) continue
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue
    const name = row.name.normalize('NFKC').trim()
    const previous = byName.get(name)
    if (!previous || date < previous) byName.set(name, date)
  }
  return Object.fromEntries(
    Object.entries(characters).flatMap(([id, character]) => {
      const date =
        typeof character.name === 'string'
          ? byName.get(character.name.normalize('NFKC').trim())
          : undefined
      return date ? [[id, date]] : []
    }),
  )
}

export function buildReleaseDateMap(
  infoSource: string,
  candidateSource: string,
  eventSource: string,
  cnGacha?: RawGachaTable,
  publishedCnDates: Readonly<Record<string, string>> = {},
): Record<string, OperatorReleaseDates> {
  const info = releaseInfoMap(infoSource)
  const candidates = generatedLiteral(
    candidateSource,
    'cnOperatorReleaseCandidateList',
    '[',
    ']',
  ) as ReleaseCandidate[]
  const events = generatedLiteral(
    eventSource,
    'generatedOperatorReleaseEventList',
    '[',
    ']',
  ) as ReleaseEvent[]

  const eventDates = new Map<string, { cn: string | null; global: string | null }>()
  for (const event of events) {
    if (typeof event.id !== 'string' || typeof event.startDate !== 'string') continue
    const current = eventDates.get(event.id) ?? { cn: null, global: null }
    eventDates.set(event.id, {
      cn: event.server === 'future' ? event.startDate : current.cn,
      global: event.server === 'global' ? event.startDate : current.global,
    })
  }

  const activityDates = new Map<string, { cn: string | null; global: string | null }>()

  for (const candidate of candidates) {
    for (const activity of candidate.addedActivityList ?? []) {
      if (typeof activity.id !== 'string' || activity.isRerun === true) continue
      const cn = dateFromTimestamp(activity.cnStartTime, 8)
      const global = dateFromTimestamp(activity.globalStartTime)
      const current = activityDates.get(activity.id)
      activityDates.set(activity.id, {
        cn: current?.cn ?? cn,
        global: current?.global ?? global,
      })
    }
  }

  const result: Record<string, OperatorReleaseDates> = {}
  const limitedBannerDates = new Map<string, string>()
  for (const pool of Object.values(cnGacha?.gachaPoolClient ?? {})) {
    // CN banners use the server's UTC+8 calendar, including early-morning launches.
    const date = dateFromTimestamp(pool.openTime, 8)
    if (!date) continue
    for (const id of limitedOperatorIdsInPool(pool)) {
      const current = limitedBannerDates.get(id)
      if (!current || date < current) limitedBannerDates.set(id, date)
    }
  }

  for (const [operatorId, releaseInfo] of Object.entries(info)) {
    const eventId = typeof releaseInfo.eventId === 'string' ? releaseInfo.eventId : null

    if (eventId === 'server_open') {
      result[operatorId] = { ...SERVER_LAUNCH_DATES }
      continue
    }

    const override = eventId ? MAIN_STORY_DATE_OVERRIDES[eventId] : undefined
    const activity = eventId ? activityDates.get(eventId) : undefined
    const eventDate = eventId ? eventDates.get(eventId) : undefined
    result[operatorId] = {
      cn:
        override?.cn ?? eventDate?.cn ?? activity?.cn ?? limitedBannerDates.get(operatorId) ?? null,
      global: override?.global ?? eventDate?.global ?? activity?.global ?? null,
    }
  }

  // One actual event release date applies to every mapped member, including
  // operators absent from the separately generated per-operator info map.
  for (const event of events) {
    if (typeof event.id !== 'string' || !Array.isArray(event.operatorIds)) continue
    const eventDate = eventDates.get(event.id)
    const activity = activityDates.get(event.id)
    const override = MAIN_STORY_DATE_OVERRIDES[event.id]
    for (const id of event.operatorIds) {
      if (typeof id !== 'string') continue
      const current = result[id] ?? { cn: null, global: null }
      result[id] = {
        cn: override?.cn ?? eventDate?.cn ?? activity?.cn ?? current.cn,
        global: override?.global ?? eventDate?.global ?? activity?.global ?? current.global,
      }
    }
  }

  for (const [operatorId, date] of limitedBannerDates) {
    const current = result[operatorId] ?? { cn: null, global: null }
    if (!current.cn) result[operatorId] = { ...current, cn: date }
  }

  for (const [operatorId, date] of Object.entries(publishedCnDates)) {
    const current = result[operatorId] ?? { cn: null, global: null }
    // Keep the application's launch-day convention for launch operators.
    if (info[operatorId]?.eventId !== 'server_open') result[operatorId] = { ...current, cn: date }
  }

  for (const [operatorId, dates] of Object.entries(AMIYA_FORM_RELEASES)) {
    result[operatorId] = { ...dates }
  }

  for (const [operatorId, override] of Object.entries(RELEASE_DATE_OVERRIDES)) {
    const current = result[operatorId] ?? { cn: null, global: null }
    result[operatorId] = {
      cn: Object.prototype.hasOwnProperty.call(override, 'cn') ? (override.cn ?? null) : current.cn,
      global: Object.prototype.hasOwnProperty.call(override, 'global')
        ? (override.global ?? null)
        : current.global,
    }
  }

  for (const [operatorId, referenceId] of Object.entries(CN_RELEASE_DATE_ALIASES)) {
    if (result[operatorId] && result[referenceId]?.cn) {
      result[operatorId] = { ...result[operatorId], cn: result[referenceId].cn }
    }
  }
  // User-defined presentation dates follow the named operator on each server,
  // after published dates and all other date overrides have been resolved.
  for (const [operatorId, referenceId] of Object.entries(RELEASE_PRESENTATION_DATE_ALIASES)) {
    if (result[operatorId] && result[referenceId]) result[operatorId] = { ...result[referenceId] }
  }
  return result
}
