const RACE_FILTER_STORAGE_KEY = 'arknights-randomizer:race-filter:v1'
const RACE_FILTER_VERSION = 1 as const

interface PersistedRaceFilter {
  version: typeof RACE_FILTER_VERSION
  excludedIds: string[]
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

export function normalizePersistedRaceFilter(value: unknown): PersistedRaceFilter {
  if (!value || typeof value !== 'object') {
    return { version: RACE_FILTER_VERSION, excludedIds: [] }
  }
  const candidate = value as { version?: unknown; excludedIds?: unknown }
  if (candidate.version !== RACE_FILTER_VERSION) {
    return { version: RACE_FILTER_VERSION, excludedIds: [] }
  }
  return {
    version: RACE_FILTER_VERSION,
    excludedIds: normalizeIds(candidate.excludedIds),
  }
}

export function loadRaceFilterExclusions(): string[] {
  try {
    const raw = window.localStorage.getItem(RACE_FILTER_STORAGE_KEY)
    if (!raw) return []
    return normalizePersistedRaceFilter(JSON.parse(raw)).excludedIds
  } catch {
    return []
  }
}

export function saveRaceFilterExclusions(excludedIds: readonly string[]): void {
  try {
    const value: PersistedRaceFilter = {
      version: RACE_FILTER_VERSION,
      excludedIds: normalizeIds(excludedIds),
    }
    window.localStorage.setItem(RACE_FILTER_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Persistence failure must never block filtering in the current session.
  }
}
