import type { RandomizerConstraints } from './constraints'
import type { GameLocale, Operator, ReleaseServer } from './operator'
import { isGameLocale } from './gameLocalization'
import { filterHigherLevelEligibleOperators } from './randomizer'

export const OPERATOR_PREFERENCES_VERSION = 2 as const

export const poolPresentationModes = [
  'imageGrid',
  'compactCard',
  'simpleList',
  'detailedList',
] as const

export type PoolPresentationMode = (typeof poolPresentationModes)[number]

export interface OperatorPreferences {
  version: typeof OPERATOR_PREFERENCES_VERSION
  metadataRegion: ReleaseServer
  gameLocale: GameLocale
  poolPresentation: PoolPresentationMode
  /** Explicit exclusions only. Any ID not listed is enabled by default. */
  excludedOperatorIds: string[]
}

export function createDefaultOperatorPreferences(): OperatorPreferences {
  return {
    version: OPERATOR_PREFERENCES_VERSION,
    metadataRegion: 'global',
    gameLocale: 'en',
    poolPresentation: 'imageGrid',
    excludedOperatorIds: [],
  }
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

function isPoolPresentationMode(value: unknown): value is PoolPresentationMode {
  return (
    typeof value === 'string' &&
    (poolPresentationModes as readonly string[]).includes(value)
  )
}

/**
 * Parses one persisted preference envelope. Unknown versions intentionally
 * fall back to defaults so a future incompatible format cannot corrupt the
 * current session.
 */
export function normalizeOperatorPreferences(value: unknown): OperatorPreferences {
  const defaults = createDefaultOperatorPreferences()
  if (!value || typeof value !== 'object') return defaults

  const candidate = value as Partial<Record<keyof OperatorPreferences, unknown>> & {
    version?: unknown
  }
  if (candidate.version !== 1 && candidate.version !== OPERATOR_PREFERENCES_VERSION) {
    return defaults
  }

  return {
    version: OPERATOR_PREFERENCES_VERSION,
    metadataRegion:
      candidate.metadataRegion === 'cn' || candidate.metadataRegion === 'global'
        ? candidate.metadataRegion
        : defaults.metadataRegion,
    gameLocale: isGameLocale(candidate.gameLocale) ? candidate.gameLocale : defaults.gameLocale,
    poolPresentation: isPoolPresentationMode(candidate.poolPresentation)
      ? candidate.poolPresentation
      : defaults.poolPresentation,
    excludedOperatorIds: normalizeIds(candidate.excludedOperatorIds),
  }
}

/**
 * Prunes exclusions for operators that no longer exist. Newly introduced
 * operators are absent from the exclusion list and therefore enabled.
 */
export function reconcileOperatorPreferences(
  preferences: OperatorPreferences,
  operators: readonly Operator[],
): OperatorPreferences {
  const existingIds = new Set(operators.map((operator) => operator.id))
  return {
    ...preferences,
    excludedOperatorIds: preferences.excludedOperatorIds.filter((id) => existingIds.has(id)),
  }
}

export function setOperatorExcluded(
  excludedOperatorIds: readonly string[],
  operatorId: string,
  excluded: boolean,
): string[] {
  const normalized = normalizeIds(excludedOperatorIds)
  const set = new Set(normalized)

  if (excluded) {
    if (!set.has(operatorId)) normalized.push(operatorId)
    return normalized
  }

  return normalized.filter((id) => id !== operatorId)
}

/**
 * Applies Add/Remove displayed semantics without touching exclusions for any
 * operator outside the displayed set.
 */
export function setDisplayedOperatorsExcluded(
  excludedOperatorIds: readonly string[],
  displayedOperatorIds: readonly string[],
  excluded: boolean,
): string[] {
  const displayed = new Set(normalizeIds(displayedOperatorIds))
  if (displayed.size === 0) return normalizeIds(excludedOperatorIds)

  if (!excluded) {
    return normalizeIds(excludedOperatorIds).filter((id) => !displayed.has(id))
  }

  const next = normalizeIds(excludedOperatorIds)
  const existing = new Set(next)
  for (const id of displayed) {
    if (!existing.has(id)) {
      existing.add(id)
      next.push(id)
    }
  }
  return next
}

export function applyManualOperatorExclusions(
  operators: readonly Operator[],
  excludedOperatorIds: readonly string[],
): Operator[] {
  const excluded = new Set(normalizeIds(excludedOperatorIds))
  if (excluded.size === 0) return [...operators]
  return operators.filter((operator) => !excluded.has(operator.id))
}

/**
 * Canonical Iteration 6 composition:
 * dataset -> higher-level filters -> manual exclusions -> final solver pool.
 */
export function buildFinalOperatorPool(
  operators: Operator[],
  constraints: RandomizerConstraints,
  excludedOperatorIds: readonly string[],
): Operator[] {
  return applyManualOperatorExclusions(
    filterHigherLevelEligibleOperators(operators, constraints),
    excludedOperatorIds,
  )
}
