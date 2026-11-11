import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'

export interface PreparedImportedDraftRulebook {
  rulebook: DraftRulebook
  identityChanged: boolean
  nameChanged: boolean
}

function cloneRulebook(rulebook: DraftRulebook): DraftRulebook {
  return JSON.parse(JSON.stringify(rulebook)) as DraftRulebook
}

function localRulebookId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
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
  name = source.identifier.id === STANDARD_DRAFT_RULEBOOK_ID
    ? 'New Draft Rulebook'
    : `${source.identifier.name} Copy`,
): DraftRulebook {
  const next = deserializeDraftRulebook(serializeDraftRulebook(source))
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
  const existingNames = new Set(
    existingRulebooks.map((rulebook) => normalizedName(rulebook.identifier.name)),
  )
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
