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
  serializeDraftRulebookLibrary,
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
    const invalid = cloneStandard() as unknown as DraftRulebook & { schemaVersion: number }
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
})
