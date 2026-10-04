import type { ReleaseConstraint } from './constraints'
import type { Operator, ReleaseServer } from './operator'
import { ANNIVERSARY_BOUNDARIES, SERVER_LAUNCH_DATES } from './releaseMetadata'

export type ReleaseBoundSide = 'min' | 'max'

export interface ReleaseGroupBounds {
  start: string
  end: string
}

function shiftIsoDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function releaseGroupStartDate(server: ReleaseServer, yearGroup: number): string | null {
  if (!Number.isInteger(yearGroup) || yearGroup < 0) return null
  if (yearGroup === 0) return SERVER_LAUNCH_DATES[server]
  if (yearGroup === 1) return shiftIsoDate(SERVER_LAUNCH_DATES[server], 1)
  return ANNIVERSARY_BOUNDARIES[server][yearGroup - 2] ?? null
}

function latestKnownDateInGroup(
  operators: readonly Operator[],
  server: ReleaseServer,
  yearGroup: number,
): string | null {
  let latest: string | null = null
  for (const operator of operators) {
    const release = operator.release[server]
    if (release.yearGroup !== yearGroup || !release.date) continue
    if (!latest || release.date > latest) latest = release.date
  }
  return latest
}

export function getReleaseGroupBounds(
  operators: readonly Operator[],
  server: ReleaseServer,
  yearGroup: number,
): ReleaseGroupBounds | null {
  const start = releaseGroupStartDate(server, yearGroup)
  if (!start) return null

  const nextStart = releaseGroupStartDate(server, yearGroup + 1)
  const end = nextStart
    ? shiftIsoDate(nextStart, -1)
    : (latestKnownDateInGroup(operators, server, yearGroup) ?? start)

  return { start, end }
}

export function releaseGroupLabel(yearGroup: number): string {
  return yearGroup === 0 ? 'Launch' : `Year ${yearGroup}`
}

export function releaseGroupSelectValue(
  yearGroup: number | null,
  date: string,
): string {
  if (yearGroup !== null) return String(yearGroup)
  return date ? 'custom' : ''
}

export function applyReleaseGroupSelection(
  current: ReleaseConstraint,
  side: ReleaseBoundSide,
  yearGroup: number | null,
  operators: readonly Operator[],
): ReleaseConstraint {
  if (yearGroup === null) {
    return side === 'min'
      ? { ...current, minYear: null, minDate: '' }
      : { ...current, maxYear: null, maxDate: '' }
  }

  const bounds = getReleaseGroupBounds(operators, current.server, yearGroup)
  if (!bounds) return current

  return side === 'min'
    ? { ...current, minYear: yearGroup, minDate: bounds.start }
    : { ...current, maxYear: yearGroup, maxDate: bounds.end }
}

export function applyCustomReleaseDate(
  current: ReleaseConstraint,
  side: ReleaseBoundSide,
  date: string,
): ReleaseConstraint {
  return side === 'min'
    ? { ...current, minYear: null, minDate: date }
    : { ...current, maxYear: null, maxDate: date }
}

export function remapReleaseConstraintServer(
  current: ReleaseConstraint,
  server: ReleaseServer,
  operators: readonly Operator[],
): ReleaseConstraint {
  let next: ReleaseConstraint = { ...current, server }

  if (current.minYear !== null) {
    const bounds = getReleaseGroupBounds(operators, server, current.minYear)
    if (bounds) next = { ...next, minDate: bounds.start }
  }

  if (current.maxYear !== null) {
    const bounds = getReleaseGroupBounds(operators, server, current.maxYear)
    if (bounds) next = { ...next, maxDate: bounds.end }
  }

  return next
}

export function releaseRangeIsValid(release: ReleaseConstraint): boolean {
  if (!release.minDate || !release.maxDate) return true
  return release.minDate <= release.maxDate
}
