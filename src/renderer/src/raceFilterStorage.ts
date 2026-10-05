import { loadRaceExclusions, saveRaceExclusions } from './rendererPersistence'

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

export function normalizePersistedRaceFilter(value: unknown): { version: 1; excludedIds: string[] } {
  if (!value || typeof value !== 'object') return { version: 1, excludedIds: [] }
  const candidate = value as { version?: unknown; excludedIds?: unknown }
  return candidate.version === 1
    ? { version: 1, excludedIds: normalizeIds(candidate.excludedIds) }
    : { version: 1, excludedIds: [] }
}

export function loadRaceFilterExclusions(): string[] {
  return loadRaceExclusions()
}

export function saveRaceFilterExclusions(excludedIds: readonly string[]): void {
  saveRaceExclusions(normalizeIds(excludedIds))
}
