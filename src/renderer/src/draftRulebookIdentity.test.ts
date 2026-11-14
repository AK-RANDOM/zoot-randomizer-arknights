import { describe, expect, it } from 'vitest'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { createLocalDraftRulebook, prepareImportedDraftRulebook } from './draftRulebookIdentity'

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

describe('Draft Rulebook identity', () => {
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
})
