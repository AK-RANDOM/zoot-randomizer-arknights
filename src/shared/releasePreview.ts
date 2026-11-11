import type { ReleaseConstraint } from './constraints'
import type { Operator, OperatorDataset } from './operator'
import { SERVER_LAUNCH_DATES } from './releaseMetadata'
import type { GarrisonEvent } from './garrisonEventCatalog'
import { garrisonEventHelperOperator } from './garrisonEventHelper'

export interface ReleaseBoundPreview {
  date: string
  representatives: Operator[]
}

export interface ReleaseDateOption extends ReleaseBoundPreview {
  name: string
  representative: Operator | null
  startDate: string
  endDate: string
}

/** Actual events outrank gameplay modes, which outrank login campaigns. */
export function releaseEventDisplayPriority(event: {
  id?: string
  category?: string
  name: string
}): number {
  // A fallback remains generic even when its source record has a login-like ID.
  if (/^\d{4}-\d{2}-\d{2} Operator Release$/i.test(event.name.trim())) return 3
  if (
    event.category === 'login' ||
    /^Login Event:/i.test(event.name) ||
    /(?:sign|login|checkin)/i.test(event.id ?? '')
  )
    return 2
  if (
    event.category === 'crisis' ||
    event.category === 'roguelike' ||
    /^(?:CCB?#|IS#|RA#|Integrated Strategies|Contingency Contract|Reclamation Algorithm)/.test(
      event.name,
    ) ||
    /^dis_perm_/.test(event.id ?? '')
  )
    return 1
  return 0
}

export function buildReleaseDateOptions(
  dataset: OperatorDataset,
  release: ReleaseConstraint,
  side: 'min' | 'max',
  events: readonly GarrisonEvent[] = [],
): ReleaseDateOption[] {
  const year = side === 'min' ? release.minYear : release.maxYear
  const operators = dataset.operators.filter(
    (operator) =>
      operator.availableOn[release.server] &&
      (year === null || operator.release[release.server].yearGroup === year),
  )
  const dates = [
    ...new Set(operators.flatMap((operator) => operator.release[release.server].date ?? [])),
  ].sort()
  const records = (dataset.releaseEvents ?? []).filter((event) => event.server === release.server)
  const parents = new Map(dates.map((date) => [date, date]))
  const root = (date: string): string => {
    let current = date
    while (parents.get(current) !== current) current = parents.get(current)!
    return current
  }
  const storyIds = new Set(
    records
      .filter((event) => ['side_story', 'mini_event', 'main_story'].includes(event.category ?? ''))
      .map((event) => event.id)
      .filter(Boolean),
  )
  for (const id of storyIds) {
    const members = new Set(
      records.filter((event) => event.id === id).flatMap((event) => event.operatorIds),
    )
    const groupDates = [
      ...new Set(
        operators
          .filter((operator) => members.has(operator.id))
          .flatMap((operator) => operator.release[release.server].date ?? []),
      ),
    ]
    for (const date of groupDates.slice(1)) parents.set(root(date), root(groupDates[0]))
  }
  const groups = new Map<string, string[]>()
  for (const date of dates) {
    const key = root(date)
    groups.set(key, [...(groups.get(key) ?? []), date])
  }
  const helpers = events.map((event) => ({
    event,
    operator: garrisonEventHelperOperator(event, dataset.operators, release.server),
  }))
  return [...groups.values()]
    .map((groupDates) => {
      const startDate = groupDates[0]
      const endDate = groupDates[groupDates.length - 1]
      const date = side === 'min' ? startDate : endDate
      const members = operators.filter((operator) =>
        groupDates.includes(operator.release[release.server].date ?? ''),
      )
      const memberIds = new Set(members.map(({ id }) => id))
      const matched = records.filter(
        (event) =>
          groupDates.includes(event.date) && event.operatorIds.some((id) => memberIds.has(id)),
      )
      const featured = helpers.find(
        ({ operator }) => operator?.rarity === 6 && memberIds.has(operator.id),
      )
      const flameIds = ['char_188_helage', 'char_340_shwaz']
      const flameOrder = dataset.operators
        .filter(
          (operator) =>
            flameIds.includes(operator.id) &&
            operator.availableOn[release.server] &&
            operator.release[release.server].date,
        )
        .sort((a, b) =>
          a.release[release.server].date!.localeCompare(b.release[release.server].date!),
        )
      const displayName = (event: (typeof matched)[number]): string => {
        const ids = new Set(event.operatorIds.filter((id) => memberIds.has(id)))
        if (ids.has('char_349_chiave') || ids.has('char_344_beewax'))
          return "Grani and the Knights' Treasure Rerun"
        // Operator-specific story overrides must not replace a separate overlapping mode.
        if (releaseEventDisplayPriority(event) === 1) return event.name
        if (ids.has('char_4019_ncdeer')) return 'Login Event: Display of Auspices'
        if (releaseEventDisplayPriority(event) === 2 && !ids.has('char_385_finlpp'))
          return event.name
        if (ids.has('char_385_finlpp')) return 'Login Event: Coexistence'
        if (ids.has('char_293_thorns')) return 'Heart of Surging Flame Rerun'
        const flame = flameOrder.find((operator) => ids.has(operator.id))
        if (flame && flameOrder.length === 2)
          return `Heart of Surging Flame Part ${flameOrder.findIndex((operator) => operator.id === flame.id) + 1}`
        if (ids.has('char_159_peacok') || ids.has('char_4091_ulika'))
          return `${event.date.slice(0, 4)} April Fools`
        const chapter = /^dis_main_(\d+)$/.exec(event.id ?? '')?.[1]
        const localized = events.find(
          (item) => item.id === event.id || (chapter && item.id === `main:${chapter}`),
        )
        if (localized) return localized.name
        if (event.category === 'main_story' && featured?.event.group === 'main')
          return featured.event.name
        return event.name
      }
      const ordered = matched
        .map((event) => ({ ...event, name: displayName(event) }))
        .sort((a, b) => releaseEventDisplayPriority(a) - releaseEventDisplayPriority(b))
      const named = ordered.filter((event) => releaseEventDisplayPriority(event) < 3)
      const names = [...new Set((named.length ? named : ordered).map((event) => event.name))]
      const eventPriority = (operator: Operator): number =>
        Math.min(
          3,
          ...ordered
            .filter((event) => event.operatorIds.includes(operator.id))
            .map(releaseEventDisplayPriority),
        )
      const compareMembers = (a: Operator, b: Operator): number =>
        eventPriority(a) - eventPriority(b) || sortRepresentatives(a, b)
      const sixes = members.filter((operator) => operator.rarity === 6).sort(compareMembers)
      const preferredFeatured =
        featured?.operator && eventPriority(featured.operator) === eventPriority(sixes[0])
          ? featured.operator
          : undefined
      const six =
        date === SERVER_LAUNCH_DATES[release.server]
          ? (members.find(({ id }) => id === 'char_172_svrash') ??
            members.filter((operator) => operator.rarity === 6).sort(sortRepresentatives)[0])
          : (preferredFeatured ?? sixes[0])
      const fallback = (rarity: number): Operator | undefined =>
        members.filter((operator) => operator.rarity === rarity).sort(compareMembers)[0]
      const dropdownRepresentative =
        six ?? fallback(5) ?? fallback(4) ?? [...members].sort(compareMembers)[0] ?? null
      const representatives =
        date === SERVER_LAUNCH_DATES[release.server]
          ? launchRepresentatives(members)
          : buildBoundaryRepresentatives(members, eventPriority)
      const april = members.some(({ id }) => id === 'char_159_peacok' || id === 'char_4091_ulika')
      const shopOnly =
        members.length > 0 &&
        members.every(
          (operator) =>
            operator.acquisition.group === 'redCert' || operator.id === 'char_260_durnar',
        )
      const override =
        memberIds.has('char_349_chiave') || memberIds.has('char_344_beewax')
          ? "Grani and the Knights' Treasure Rerun"
          : memberIds.has('char_385_finlpp')
            ? 'Login Event: Coexistence'
            : memberIds.has('char_4019_ncdeer')
              ? 'Login Event: Display of Auspices'
              : memberIds.has('char_293_thorns')
                ? 'Heart of Surging Flame Rerun'
                : (() => {
                    const flame = flameOrder.find((operator) => memberIds.has(operator.id))
                    return flame && flameOrder.length === 2
                      ? `Heart of Surging Flame Part ${flameOrder.findIndex((operator) => operator.id === flame.id) + 1}`
                      : null
                  })()
      const name =
        date === SERVER_LAUNCH_DATES[release.server]
          ? 'Launch'
          : shopOnly
            ? [...new Set([...named.map((event) => event.name), `${date} Shop Update`])].join(' / ')
            : names.join(' / ') ||
              override ||
              (april
                ? `${date.slice(0, 4)} April Fools`
                : featured?.event.limitedOperatorIds?.includes(featured.operator!.id)
                  ? featured.event.name
                  : `${date} Operator Release`)
      return {
        date,
        startDate,
        endDate,
        name,
        representative: dropdownRepresentative,
        representatives,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Locked launch representatives, keyed by canonical operator IDs so localization
// never changes identity or ordering.
const launchRepresentativeIds = [
  'char_172_svrash', // SilverAsh
  'char_180_amgoat', // Eyjafjalla
  'char_002_amiya', // Amiya (Caster)
  'char_143_ghost', // Specter
  'char_128_plosis', // Ptilopsis
  'char_237_gravel', // Gravel
  'char_124_kroos', // Kroos
]

function launchRepresentatives(operators: readonly Operator[]): Operator[] {
  return launchRepresentativeIds
    .map((id) => operators.find((operator) => operator.id === id))
    .filter((operator): operator is Operator => Boolean(operator))
}

/** Fill seven slots by rarity, then event tier and the existing acquisition order. */
export function buildBoundaryRepresentatives(
  operators: readonly Operator[],
  eventPriority: (operator: Operator) => number = () => 3,
): Operator[] {
  return [...operators]
    .sort(
      (a, b) =>
        b.rarity - a.rarity || eventPriority(a) - eventPriority(b) || sortRepresentatives(a, b),
    )
    .slice(0, 7)
}

function acquisitionPriority(operator: Operator): number {
  if (operator.acquisition.family === 'limited') return 0
  if (operator.acquisition.family === 'standard') return 1
  return 2
}

function sortRepresentatives(left: Operator, right: Operator): number {
  const sourceDifference = acquisitionPriority(left) - acquisitionPriority(right)
  if (sourceDifference !== 0) return sourceDifference
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

function releaseConstraintMatches(operator: Operator, release: ReleaseConstraint): boolean {
  const item = operator.release[release.server]
  if (!operator.availableOn[release.server] || !item.date || item.yearGroup === null) return false
  if (release.minYear !== null && item.yearGroup < release.minYear) return false
  if (release.maxYear !== null && item.yearGroup > release.maxYear) return false
  if (release.minDate && item.date < release.minDate) return false
  if (release.maxDate && item.date > release.maxDate) return false
  return true
}

export function getReleaseBoundPreview(
  operators: readonly Operator[],
  release: ReleaseConstraint,
  bound: 'min' | 'max',
): ReleaseBoundPreview | null {
  const eligible = operators.filter((operator) => releaseConstraintMatches(operator, release))
  const dates = eligible
    .map((operator) => operator.release[release.server].date)
    .filter((date): date is string => Boolean(date))

  if (dates.length === 0) return null

  const date =
    bound === 'min'
      ? dates.reduce((a, b) => (a < b ? a : b))
      : dates.reduce((a, b) => (a > b ? a : b))
  const sameDate = eligible.filter((operator) => operator.release[release.server].date === date)

  return {
    date,
    representatives:
      date === SERVER_LAUNCH_DATES[release.server]
        ? launchRepresentatives(sameDate)
        : buildBoundaryRepresentatives(sameDate),
  }
}
