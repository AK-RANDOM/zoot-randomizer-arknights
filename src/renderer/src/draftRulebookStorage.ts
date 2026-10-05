import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'

export const DRAFT_RULEBOOK_LIBRARY_KEY = 'arknights-randomizer:draft-rulebooks:v1'
export const DRAFT_RULEBOOK_IMPORTED_IDS_KEY = 'arknights-randomizer:draft-rulebooks:imported:v1'
const DRAFT_RULEBOOK_LIBRARY_VERSION = 1 as const

interface DraftRulebookLibraryEnvelope {
  version: typeof DRAFT_RULEBOOK_LIBRARY_VERSION
  rulebooks: DraftRulebook[]
}

export interface PreparedImportedDraftRulebook {
  rulebook: DraftRulebook
  identityChanged: boolean
  nameChanged: boolean
}

function cloneRulebook(rulebook: DraftRulebook): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(rulebook))
}

function localRulebookId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `local:${random}`
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function importedName(baseName: string, existingNames: Set<string>): string {
  const first = `${baseName} (Imported)`
  if (!existingNames.has(normalizedName(first))) return first
  let suffix = 2
  while (existingNames.has(normalizedName(`${baseName} (Imported ${suffix})`))) suffix += 1
  return `${baseName} (Imported ${suffix})`
}

export function createLocalDraftRulebook(
  source: DraftRulebook = STANDARD_DRAFT_RULEBOOK,
  name = source.identifier.id === STANDARD_DRAFT_RULEBOOK_ID ? 'New Draft Rulebook' : `${source.identifier.name} Copy`,
): DraftRulebook {
  const next = cloneRulebook(source)
  next.identifier = {
    ...next.identifier,
    id: localRulebookId(),
    name,
    createdAt: new Date().toISOString(),
  }
  return next
}

/**
 * Imported Rulebooks preserve their stable identity whenever that identity is
 * unused locally. Collisions never overwrite an existing or built-in Rulebook:
 * the import is re-keyed to a local ID and receives a unique Imported suffix.
 * A name-only collision keeps the stable ID but is renamed for library clarity.
 */
export function prepareImportedDraftRulebook(
  source: DraftRulebook,
  existingRulebooks: readonly DraftRulebook[],
): PreparedImportedDraftRulebook {
  const next = cloneRulebook(source)
  const existingIds = new Set(existingRulebooks.map((rulebook) => rulebook.identifier.id))
  existingIds.add(STANDARD_DRAFT_RULEBOOK_ID)
  const existingNames = new Set(existingRulebooks.map((rulebook) => normalizedName(rulebook.identifier.name)))
  existingNames.add(normalizedName(STANDARD_DRAFT_RULEBOOK.identifier.name))

  const identityChanged = existingIds.has(next.identifier.id)
  const nameConflict = existingNames.has(normalizedName(next.identifier.name))
  if (identityChanged) next.identifier.id = localRulebookId()
  if (identityChanged || nameConflict) {
    next.identifier.name = importedName(next.identifier.name, existingNames)
  }

  return {
    rulebook: next,
    identityChanged,
    nameChanged: next.identifier.name !== source.identifier.name,
  }
}

export function parseDraftRulebookLibrary(serialized: string | null): DraftRulebook[] {
  if (!serialized) return []
  try {
    const parsed = JSON.parse(serialized) as unknown
    if (!parsed || typeof parsed !== 'object') return []
    const envelope = parsed as Partial<DraftRulebookLibraryEnvelope>
    if (envelope.version !== DRAFT_RULEBOOK_LIBRARY_VERSION || !Array.isArray(envelope.rulebooks)) {
      return []
    }

    const seen = new Set<string>()
    const result: DraftRulebook[] = []
    for (const candidate of envelope.rulebooks) {
      const validation = validateDraftRulebook(candidate)
      if (!validation.valid) continue
      if (candidate.identifier.id === STANDARD_DRAFT_RULEBOOK_ID) continue
      if (seen.has(candidate.identifier.id)) continue
      seen.add(candidate.identifier.id)
      result.push(cloneRulebook(candidate))
    }
    return result
  } catch {
    return []
  }
}

export function serializeDraftRulebookLibrary(rulebooks: readonly DraftRulebook[]): string {
  const validCustom = rulebooks.filter(
    (rulebook) =>
      rulebook.identifier.id !== STANDARD_DRAFT_RULEBOOK_ID &&
      validateDraftRulebook(rulebook).valid,
  )
  const envelope: DraftRulebookLibraryEnvelope = {
    version: DRAFT_RULEBOOK_LIBRARY_VERSION,
    rulebooks: validCustom.map(cloneRulebook),
  }
  return JSON.stringify(envelope)
}

export function parseImportedDraftRulebookIds(serialized: string | null): Set<string> {
  if (!serialized) return new Set()
  try {
    const parsed = JSON.parse(serialized) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0))
  } catch {
    return new Set()
  }
}

export function serializeImportedDraftRulebookIds(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort((left, right) => left.localeCompare(right)))
}

export function loadDraftRulebookLibrary(): DraftRulebook[] {
  try {
    return parseDraftRulebookLibrary(window.localStorage.getItem(DRAFT_RULEBOOK_LIBRARY_KEY))
  } catch {
    return []
  }
}

export function saveDraftRulebookLibrary(rulebooks: readonly DraftRulebook[]): void {
  try {
    window.localStorage.setItem(
      DRAFT_RULEBOOK_LIBRARY_KEY,
      serializeDraftRulebookLibrary(rulebooks),
    )
  } catch {
    // Keep the current session usable when storage is unavailable.
  }
}

export function loadImportedDraftRulebookIds(): Set<string> {
  try {
    return parseImportedDraftRulebookIds(window.localStorage.getItem(DRAFT_RULEBOOK_IMPORTED_IDS_KEY))
  } catch {
    return new Set()
  }
}

export function saveImportedDraftRulebookIds(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(
      DRAFT_RULEBOOK_IMPORTED_IDS_KEY,
      serializeImportedDraftRulebookIds(ids),
    )
  } catch {
    // Origin metadata is presentation-only; storage failure must not break the library.
  }
}
