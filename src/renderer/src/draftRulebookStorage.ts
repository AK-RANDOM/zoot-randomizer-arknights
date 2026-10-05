import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'

export const DRAFT_RULEBOOK_LIBRARY_KEY = 'arknights-randomizer:draft-rulebooks:v1'
const DRAFT_RULEBOOK_LIBRARY_VERSION = 1 as const

interface DraftRulebookLibraryEnvelope {
  version: typeof DRAFT_RULEBOOK_LIBRARY_VERSION
  rulebooks: DraftRulebook[]
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
