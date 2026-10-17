import type { RandomizerConstraints } from './constraints'
import type { ImportedArknightsAccount } from './arknightsAccount'
import { importedAccountOperatorState } from './arknightsAccountReconciliation'
import type { GameLocale, Operator, ReleaseServer } from './operator'
import { isGameLocale } from './gameLocalization'
import { filterHigherLevelEligibleOperators } from './randomizer'
import { operatorRaceIds } from './raceMetadata'

export const OPERATOR_PREFERENCES_VERSION = 7 as const

export const poolPresentationModes = [
  'imageGrid',
  'compactCard',
  'simpleList',
  'detailedList',
] as const

export type PoolPresentationMode = (typeof poolPresentationModes)[number]

export type OperatorAppearanceChoice = 'e1' | 'e2' | 'random' | 'account' | `skin:${string}`

export type AccountOperatorFilterMode = 'ignore' | 'owned' | 'progression'

export interface AccountProgressionBound {
  elite: 0 | 1 | 2
  level: number
}

export interface OperatorPreferences {
  version: typeof OPERATOR_PREFERENCES_VERSION
  metadataRegion: ReleaseServer
  gameLocale: GameLocale
  poolPresentation: PoolPresentationMode
  /** Account-aware Global Filter mode. */
  accountFilterMode: AccountOperatorFilterMode
  accountProgressionMin: AccountProgressionBound
  accountProgressionMax: AccountProgressionBound
  /** Whether synced E/L progression is shown on operator cards. */
  showAccountProgression: boolean
  /** Explicit exclusions only. Any ID not listed is enabled by default. */
  excludedOperatorIds: string[]
  /** Per-operator presentation choice. Missing IDs fall back to the legacy/default promotion choice. */
  operatorAppearances: Record<string, OperatorAppearanceChoice>
  /** Stable seed used when an operator appearance is set to random. */
  appearanceRandomSeed: number
}

export function createDefaultOperatorPreferences(): OperatorPreferences {
  return {
    version: OPERATOR_PREFERENCES_VERSION,
    metadataRegion: 'global',
    gameLocale: 'en',
    poolPresentation: 'imageGrid',
    accountFilterMode: 'ignore',
    accountProgressionMin: { elite: 0, level: 1 },
    accountProgressionMax: { elite: 2, level: 90 },
    showAccountProgression: false,
    excludedOperatorIds: [],
    operatorAppearances: {},
    appearanceRandomSeed: 1,
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

function isAccountOperatorFilterMode(value: unknown): value is AccountOperatorFilterMode {
  return value === 'ignore' || value === 'owned' || value === 'progression'
}

export function accountProgressionMaxLevel(elite: 0 | 1 | 2): number {
  return elite === 0 ? 50 : elite === 1 ? 80 : 90
}

function normalizeAccountProgressionBound(
  value: unknown,
  fallback: AccountProgressionBound,
): AccountProgressionBound {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const candidate = value as { elite?: unknown; level?: unknown }
  const elite =
    candidate.elite === 0 || candidate.elite === 1 || candidate.elite === 2
      ? candidate.elite
      : fallback.elite
  const level =
    typeof candidate.level === 'number' && Number.isFinite(candidate.level)
      ? Math.min(accountProgressionMaxLevel(elite), Math.max(1, Math.trunc(candidate.level)))
      : fallback.level
  return { elite, level }
}

export function accountProgressionRank(bound: AccountProgressionBound): number {
  return bound.elite * 100 + bound.level
}

function normalizeAppearanceMap(value: unknown): Record<string, OperatorAppearanceChoice> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, OperatorAppearanceChoice> = {}
  for (const [operatorId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!operatorId || typeof raw !== 'string') continue
    if (
      raw === 'e1' ||
      raw === 'e2' ||
      raw === 'random' ||
      raw === 'account' ||
      raw.startsWith('skin:')
    ) {
      result[operatorId] = raw as OperatorAppearanceChoice
    }
  }
  return result
}

function isPoolPresentationMode(value: unknown): value is PoolPresentationMode {
  return typeof value === 'string' && (poolPresentationModes as readonly string[]).includes(value)
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
    ownedOperatorsOnly?: unknown
  }
  if (
    candidate.version !== 1 &&
    candidate.version !== 2 &&
    candidate.version !== 3 &&
    candidate.version !== 4 &&
    candidate.version !== 5 &&
    candidate.version !== 6 &&
    candidate.version !== OPERATOR_PREFERENCES_VERSION
  ) {
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
    accountFilterMode: isAccountOperatorFilterMode(candidate.accountFilterMode)
      ? candidate.accountFilterMode
      : candidate.ownedOperatorsOnly === true
        ? 'owned'
        : defaults.accountFilterMode,
    accountProgressionMin: normalizeAccountProgressionBound(
      candidate.accountProgressionMin,
      defaults.accountProgressionMin,
    ),
    accountProgressionMax: normalizeAccountProgressionBound(
      candidate.accountProgressionMax,
      defaults.accountProgressionMax,
    ),
    showAccountProgression:
      typeof candidate.showAccountProgression === 'boolean'
        ? candidate.showAccountProgression
        : defaults.showAccountProgression,
    excludedOperatorIds: normalizeIds(candidate.excludedOperatorIds),
    operatorAppearances: normalizeAppearanceMap(candidate.operatorAppearances),
    appearanceRandomSeed:
      typeof candidate.appearanceRandomSeed === 'number' &&
      Number.isFinite(candidate.appearanceRandomSeed)
        ? Math.trunc(candidate.appearanceRandomSeed)
        : defaults.appearanceRandomSeed,
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
  const operatorAppearances = Object.fromEntries(
    Object.entries(preferences.operatorAppearances).filter(([id, choice]) => {
      if (!existingIds.has(id)) return false
      if (!choice.startsWith('skin:')) return true
      const operator = operators.find((item) => item.id === id)
      const skinId = choice.slice(5)
      return operator?.skins?.some((skin) => skin.id === skinId) ?? false
    }),
  )
  return {
    ...preferences,
    excludedOperatorIds: preferences.excludedOperatorIds.filter((id) => existingIds.has(id)),
    operatorAppearances,
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

export function applyAccountFilter(
  operators: readonly Operator[],
  snapshot: ImportedArknightsAccount | null | undefined,
  mode: AccountOperatorFilterMode,
  minimum: AccountProgressionBound,
  maximum: AccountProgressionBound,
): Operator[] {
  if (!snapshot || mode === 'ignore') return [...operators]

  const minimumRank = accountProgressionRank(minimum)
  const maximumRank = accountProgressionRank(maximum)
  const lower = Math.min(minimumRank, maximumRank)
  const upper = Math.max(minimumRank, maximumRank)

  return operators.filter((operator) => {
    const state = importedAccountOperatorState(snapshot, operator.id)
    if (!state) return false
    if (mode === 'owned') return true
    const rank = accountProgressionRank({ elite: state.elite, level: state.level })
    return rank >= lower && rank <= upper
  })
}

export function applyRaceExclusions(
  operators: readonly Operator[],
  excludedRaceIds: readonly string[],
): Operator[] {
  const excluded = new Set(normalizeIds(excludedRaceIds))
  if (excluded.size === 0) return [...operators]
  return operators.filter((operator) =>
    operatorRaceIds(operator).some((raceId) => !excluded.has(raceId)),
  )
}

/**
 * Canonical Global Filter composition. Every consumer that needs the eligible
 * universe before individual Curate exclusions should use this function so
 * Race cannot diverge from the rest of the higher-level eligibility filters.
 */
export function buildGlobalFilterOperatorPool(
  operators: Operator[],
  constraints: RandomizerConstraints,
  account?: {
    snapshot: ImportedArknightsAccount | null | undefined
    mode: AccountOperatorFilterMode
    minimum: AccountProgressionBound
    maximum: AccountProgressionBound
  },
): Operator[] {
  const filtered = applyRaceExclusions(
    filterHigherLevelEligibleOperators(operators, constraints),
    constraints.race?.excludedIds ?? [],
  )
  return account
    ? applyAccountFilter(filtered, account.snapshot, account.mode, account.minimum, account.maximum)
    : filtered
}

/**
 * Canonical Iteration 6 composition:
 * dataset -> Global Filter -> manual Curate exclusions -> final solver pool.
 * Standard generation, Global Pool and Draft all consume this final pool.
 */
export function buildFinalOperatorPool(
  operators: Operator[],
  constraints: RandomizerConstraints,
  excludedOperatorIds: readonly string[],
  account?: {
    snapshot: ImportedArknightsAccount | null | undefined
    mode: AccountOperatorFilterMode
    minimum: AccountProgressionBound
    maximum: AccountProgressionBound
  },
): Operator[] {
  return applyManualOperatorExclusions(
    buildGlobalFilterOperatorPool(operators, constraints, account),
    excludedOperatorIds,
  )
}
