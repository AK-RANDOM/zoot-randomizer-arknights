import type { ReleaseServer } from './operator'

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
  | 'main_story'
  | 'side_story'
  | 'mini_event'
  | 'crisis'
  | 'roguelike'
  | 'server_open'
  | 'other'

export const SERVER_LAUNCH_DATES: Record<ReleaseServer, string> = {
  cn: '2019-05-01',
  global: '2020-01-16',
}

export const ANNIVERSARY_BOUNDARIES: Record<ReleaseServer, readonly string[]> = {
  cn: [
    '2020-05-01',
    '2021-05-01',
    '2022-05-01',
    '2023-05-01',
    '2024-05-01',
    '2025-05-01',
    '2026-04-30',
  ],
  global: [
    '2020-12-30',
    '2022-01-14',
    '2023-01-13',
    '2024-01-16',
    '2025-01-16',
    '2026-01-16',
  ],
}

const MAIN_STORY_DATE_OVERRIDES: Record<string, { cn: string; global: string }> = {
  dis_main_5: { cn: '2019-07-09', global: '2020-02-26' },
  dis_main_6: { cn: '2019-12-24', global: '2020-06-30' },
  dis_main_7: { cn: '2020-05-01', global: '2020-12-30' },
  dis_main_8: { cn: '2020-11-01', global: '2021-04-30' },
  dis_main_9: { cn: '2021-09-17', global: '2022-03-17' },
  dis_main_10: { cn: '2022-04-14', global: '2022-10-19' },
  dis_main_11: { cn: '2022-10-11', global: '2023-04-27' },
  dis_main_12: { cn: '2023-04-06', global: '2023-10-24' },
  dis_main_13: { cn: '2023-10-08', global: '2024-04-30' },
}

export const AMIYA_FORM_RELEASES: Record<string, { cn: string; global: string }> = {
  char_002_amiya: {
    cn: SERVER_LAUNCH_DATES.cn,
    global: SERVER_LAUNCH_DATES.global,
  },
  char_1001_amiya2: MAIN_STORY_DATE_OVERRIDES.dis_main_8,
  char_1037_amiya3: { cn: '2024-05-01', global: '2024-10-31' },
}

/**
 * Audited exceptions/fallbacks for dates that are missing or ambiguous in the
 * generated upstream metadata. Ordinary dates continue to come from the
 * generated release/event sources; these values follow the wiki.gg release
 * list and, for permanent-mode welfare operators, the launch of their mode.
 */
export const RELEASE_DATE_OVERRIDES: Record<
  string,
  Partial<Record<ReleaseServer, string | null>>
> = {
  char_456_ash: { cn: '2021-03-09', global: '2021-08-18' },
  char_222_bpipe: { global: '2020-09-10' },
  char_188_helage: { global: '2020-04-15' },
  char_378_asbest: { global: '2020-11-11' },
  char_274_astesi: { global: '2020-04-15' },
  char_344_beewax: { global: '2020-11-26' },
  char_252_bibeak: { global: '2020-09-10' },
  char_275_breeze: { global: '2020-05-13' },
  char_356_broca: { global: '2020-07-15' },
  char_349_chiave: { global: '2020-11-26' },
  char_4043_erato: { global: '2022-12-08' },
  char_261_sddrag: { global: '2020-07-15' },
  char_336_folivo: { global: '2021-02-04' },
  char_379_sesa: { global: '2020-09-10' },
  char_343_tknogi: { global: '2020-11-11' },
  char_402_tuye: { global: '2021-07-13' },
  char_260_durnar: { global: '2020-05-13' },
  char_355_ethan: { global: '2020-05-13' },
  char_151_myrtle: { global: '2020-04-15' },
  char_337_utage: { global: '2020-09-10' },

  // Permanent-mode welfare operators inherit the mode's first release date.
  char_4025_aprot2: { cn: '2022-01-05', global: '2022-07-14' }, // Shalem — IS2
  char_4066_highmo: { cn: '2022-09-27', global: '2023-05-23' }, // Highmore — IS3
  char_4102_threye: { cn: '2023-07-13', global: '2024-03-05' }, // Valarqvin — IS4
  char_4151_tinman: { cn: '2024-07-16', global: '2025-02-14' }, // Tin Man — IS5
  char_4195_radian: { cn: '2025-07-15', global: '2025-12-18' }, // Raidian — IS6
  char_4230_mcnist: { cn: '2026-07-17', global: null }, // Mechanist — IS7, Global TBA
  char_4023_rfalcn: { cn: '2024-02-03', global: '2024-08-07' }, // Kestrel — RA

  // April Fools operator; explicit release dates by server.
  char_159_peacok: { cn: '2020-04-01', global: '2021-04-01' },
}

export const COLLABORATION_BY_OPERATOR_ID: Record<string, string> = {
  char_456_ash: 'Rainbow Six Siege',
  char_457_blitz: 'Rainbow Six Siege',
  char_458_rfrost: 'Rainbow Six Siege',
  char_459_tachak: 'Rainbow Six Siege',
  char_4123_ela: 'Rainbow Six Siege',
  char_4124_iana: 'Rainbow Six Siege',
  char_4125_rdoc: 'Rainbow Six Siege',
  char_4126_fuze: 'Rainbow Six Siege',
  char_4019_ncdeer: 'A Deer of Nine Colors',
  char_4067_lolxh: 'The Legend of Luo Xiaohei',
  char_4077_palico: 'Monster Hunter',
  char_1029_yato2: 'Monster Hunter',
  char_1030_noirc2: 'Monster Hunter',
  char_4215_buddy: 'Monster Hunter',
  char_1049_catap2: 'Monster Hunter',
  char_1048_orchd2: 'Monster Hunter',
  char_4141_marcil: 'Delicious in Dungeon',
  char_4142_laios: 'Delicious in Dungeon',
  char_4143_sensi: 'Delicious in Dungeon',
  char_4144_chilc: 'Delicious in Dungeon',
  char_4182_oblvns: 'BanG Dream! Ave Mujica',
  char_4183_mortis: 'BanG Dream! Ave Mujica',
  char_4184_dolris: 'BanG Dream! Ave Mujica',
  char_4185_amoris: 'BanG Dream! Ave Mujica',
  char_4186_tmoris: 'BanG Dream! Ave Mujica',
  char_4217_makoto: 'Persona 3 Reload',
  char_4218_aigis: 'Persona 3 Reload',
  char_4219_yukari: 'Persona 3 Reload',
  char_4220_kormr: 'Persona 3 Reload',
}

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
  commitDate?: unknown
  addedOperatorList?: Array<{ charId?: unknown }>
  addedActivityList?: ReleaseCandidateActivity[]
}

interface ReleaseEvent {
  id?: unknown
  server?: unknown
  startDate?: unknown
}

export interface OperatorReleaseDates {
  cn: string | null
  global: string | null
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

    if (depth === 0) return JSON.parse(source.slice(start, index + 1))
  }

  throw new Error('Release metadata payload is malformed.')
}

function releaseInfoMap(infoSource: string): Record<string, ReleaseInfoEntry> {
  return generatedLiteral(
    infoSource,
    'operatorReleaseInfoByCharId',
    '{',
    '}',
  ) as Record<string, ReleaseInfoEntry>
}

function dateFromTimestamp(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString().slice(0, 10)
}

function dateFromCommit(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match?.[1] ?? null
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

export function buildReleaseDateMap(
  infoSource: string,
  candidateSource: string,
  eventSource: string,
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
  const cnFallbacks = new Map<string, string>()

  for (const candidate of candidates) {
    const commitDate = dateFromCommit(candidate.commitDate)
    for (const operator of candidate.addedOperatorList ?? []) {
      if (typeof operator.charId !== 'string' || !commitDate) continue
      const current = cnFallbacks.get(operator.charId)
      if (!current || commitDate < current) cnFallbacks.set(operator.charId, commitDate)
    }

    for (const activity of candidate.addedActivityList ?? []) {
      if (typeof activity.id !== 'string' || activity.isRerun === true) continue
      const cn = dateFromTimestamp(activity.cnStartTime)
      const global = dateFromTimestamp(activity.globalStartTime)
      const current = activityDates.get(activity.id)
      activityDates.set(activity.id, {
        cn: current?.cn ?? cn,
        global: current?.global ?? global,
      })
    }
  }

  const result: Record<string, OperatorReleaseDates> = {}

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
        override?.cn ??
        activity?.cn ??
        eventDate?.cn ??
        cnFallbacks.get(operatorId) ??
        null,
      global: override?.global ?? activity?.global ?? eventDate?.global ?? null,
    }
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

  return result
}
