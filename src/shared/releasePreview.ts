import type { ReleaseConstraint } from './constraints'
import type { Operator } from './operator'
import { SERVER_LAUNCH_DATES } from './releaseMetadata'

export interface ReleaseBoundPreview {
  date: string
  sixStar: Operator[]
  fiveStar: Operator[]
}

const launchRepresentativeNames = [
  'SilverAsh',
  'Eyjafjalla',
  'Specter',
  'Ptilopsis',
  'Lappland',
]

function acquisitionPriority(operator: Operator): number {
  if (operator.acquisition.family === 'limited') return 0
  if (operator.acquisition.family === 'standard') return 1
  return 2
}

function sortRepresentatives(left: Operator, right: Operator): number {
  const sourceDifference = acquisitionPriority(left) - acquisitionPriority(right)
  if (sourceDifference !== 0) return sourceDifference
  return left.name.localeCompare(right.name)
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

  const date = bound === 'min' ? dates.reduce((a, b) => (a < b ? a : b)) : dates.reduce((a, b) => (a > b ? a : b))
  const sameDate = eligible.filter((operator) => operator.release[release.server].date === date)

  if (date === SERVER_LAUNCH_DATES[release.server]) {
    const fixed = launchRepresentativeNames
      .map((name) => sameDate.find((operator) => operator.name === name))
      .filter((operator): operator is Operator => Boolean(operator))
    return {
      date,
      sixStar: fixed.filter((operator) => operator.rarity === 6).slice(0, 2),
      fiveStar: fixed.filter((operator) => operator.rarity === 5).slice(0, 3),
    }
  }

  return {
    date,
    sixStar: sameDate.filter((operator) => operator.rarity === 6).sort(sortRepresentatives).slice(0, 2),
    fiveStar: sameDate.filter((operator) => operator.rarity === 5).sort(sortRepresentatives).slice(0, 3),
  }
}
