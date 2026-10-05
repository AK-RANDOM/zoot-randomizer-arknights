import { describe, expect, it } from 'vitest'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import {
  createLocalDraftRulebook,
  parseDraftRulebookLibrary,
  parseImportedDraftRulebookIds,
  prepareImportedDraftRulebook,
  serializeDraftRulebookLibrary,
  serializeImportedDraftRulebookIds,
} from './draftRulebookStorage'

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

describe('Draft Rulebook library storage', () => {
  it('round-trips valid local Rulebooks', () => {
    const local = createLocalDraftRulebook(STANDARD_DRAFT_RULEBOOK, 'Local Rules')
    local.identifier.revision = '2'

    const serialized = serializeDraftRulebookLibrary([local])
    const parsed = parseDraftRulebookLibrary(serialized)

    expect(parsed).toEqual([local])
  })

  it('never persists the built-in Standard Rulebook as a custom record', () => {
    const serialized = serializeDraftRulebookLibrary([STANDARD_DRAFT_RULEBOOK])
    expect(parseDraftRulebookLibrary(serialized)).toEqual([])
  })

  it('drops invalid documents and duplicate stable IDs while loading', () => {
    const first = createLocalDraftRulebook(STANDARD_DRAFT_RULEBOOK, 'First')
    const duplicate = cloneStandard()
    duplicate.identifier = { ...first.identifier, name: 'Duplicate' }
    const invalid = cloneStandard() as unknown as { schemaVersion: number }
    invalid.schemaVersion = 999

    const serialized = JSON.stringify({
      version: 1,
      rulebooks: [first, duplicate, invalid],
    })

    const parsed = parseDraftRulebookLibrary(serialized)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.identifier.name).toBe('First')
  })

  it('ignores malformed or unsupported storage envelopes', () => {
    expect(parseDraftRulebookLibrary('{oops')).toEqual([])
    expect(parseDraftRulebookLibrary(JSON.stringify({ version: 2, rulebooks: [] }))).toEqual([])
    expect(parseDraftRulebookLibrary(JSON.stringify({ version: 1, rulebooks: 'nope' }))).toEqual([])
  })

  it('creates independent local copies with new stable IDs and timestamps', () => {
    const copy = createLocalDraftRulebook(STANDARD_DRAFT_RULEBOOK, 'My Draft')

    expect(copy.identifier.id).not.toBe(STANDARD_DRAFT_RULEBOOK_ID)
    expect(copy.identifier.id.startsWith('local:')).toBe(true)
    expect(copy.identifier.name).toBe('My Draft')
    expect(Number.isNaN(Date.parse(copy.identifier.createdAt))).toBe(false)
    expect(copy.generalRules).toEqual(STANDARD_DRAFT_RULEBOOK.generalRules)

    copy.generalRules.offerSize = 99
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.offerSize).toBe(3)
  })

  it('preserves imported stable identity and name when neither collides', () => {
    const imported = cloneStandard()
    imported.identifier.id = 'community:rules'
    imported.identifier.name = 'Community Rules'

    const prepared = prepareImportedDraftRulebook(imported, [])

    expect(prepared.identityChanged).toBe(false)
    expect(prepared.nameChanged).toBe(false)
    expect(prepared.rulebook.identifier.id).toBe('community:rules')
    expect(prepared.rulebook.identifier.name).toBe('Community Rules')
  })

  it('never overwrites a colliding imported stable ID', () => {
    const existing = cloneStandard()
    existing.identifier.id = 'community:rules'
    existing.identifier.name = 'Community Rules'
    const imported = cloneStandard()
    imported.identifier.id = 'community:rules'
    imported.identifier.name = 'Community Rules'

    const prepared = prepareImportedDraftRulebook(imported, [existing])

    expect(prepared.identityChanged).toBe(true)
    expect(prepared.nameChanged).toBe(true)
    expect(prepared.rulebook.identifier.id).toMatch(/^local:/)
    expect(prepared.rulebook.identifier.name).toBe('Community Rules (Imported)')
  })

  it('preserves a non-colliding imported ID while uniquing a name-only collision', () => {
    const existing = cloneStandard()
    existing.identifier.id = 'community:first'
    existing.identifier.name = 'Shared Name'
    const imported = cloneStandard()
    imported.identifier.id = 'community:second'
    imported.identifier.name = 'Shared Name'

    const prepared = prepareImportedDraftRulebook(imported, [existing])

    expect(prepared.identityChanged).toBe(false)
    expect(prepared.rulebook.identifier.id).toBe('community:second')
    expect(prepared.rulebook.identifier.name).toBe('Shared Name (Imported)')
  })

  it('round-trips imported-origin IDs defensively', () => {
    const serialized = serializeImportedDraftRulebookIds(new Set(['b', 'a']))
    expect(serialized).toBe('["a","b"]')
    expect([...parseImportedDraftRulebookIds(serialized)]).toEqual(['a', 'b'])
    expect([...parseImportedDraftRulebookIds('not-json')]).toEqual([])
  })
})
