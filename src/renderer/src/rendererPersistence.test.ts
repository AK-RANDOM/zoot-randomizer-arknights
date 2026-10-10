import { describe, expect, it } from 'vitest'
import { STANDARD_DRAFT_RULEBOOK } from '../../shared/draftRulebook'
import {
  RENDERER_PERSISTENCE_KEY,
  loadRendererPersistence,
  migrateLegacyRendererPersistence,
  normalizeRendererPersistence,
  type RendererPersistenceState,
  type StorageLike,
} from './rendererPersistence'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function cloneStandard() {
  return JSON.parse(JSON.stringify(STANDARD_DRAFT_RULEBOOK)) as typeof STANDARD_DRAFT_RULEBOOK
}

describe('renderer persistence', () => {
  it('migrates fragmented legacy state into one versioned root', () => {
    const storage = new MemoryStorage()
    const imported = cloneStandard()
    imported.identifier.id = 'community:test'
    imported.identifier.name = 'Imported Test'
    storage.setItem('arknights-randomizer:selected-draft-rulebook:v1', imported.identifier.id)
    storage.setItem('arknights-randomizer:dismiss-bound-reset-warning', '1')
    storage.setItem('arknights-randomizer:operator-artwork:v1', 'e1')
    storage.setItem(
      'arknights-randomizer:race-filter:v1',
      JSON.stringify({ version: 1, excludedIds: ['race_a'] }),
    )
    storage.setItem(
      'arknights-randomizer:draft-rulebooks:v1',
      JSON.stringify({ version: 1, rulebooks: [imported] }),
    )
    storage.setItem(
      'arknights-randomizer:draft-rulebooks:imported:v1',
      JSON.stringify([imported.identifier.id]),
    )

    const migrated = migrateLegacyRendererPersistence(storage)
    expect(migrated.version).toBe(1)
    expect(migrated.selectedDraftRulebookId).toBe(imported.identifier.id)
    expect(migrated.dismissedWarnings).toContain('arknights-randomizer:dismiss-bound-reset-warning')
    expect(migrated.operatorArtwork).toBe('e1')
    expect(migrated.raceExcludedIds).toEqual(['race_a'])
    expect(migrated.rulebookLibrary).toHaveLength(1)
    expect(migrated.rulebookLibrary[0]?.origin).toBe('imported')
  })

  it('persists the migrated root on first load', () => {
    const storage = new MemoryStorage()
    const loaded = loadRendererPersistence(storage)
    expect(JSON.parse(storage.getItem(RENDERER_PERSISTENCE_KEY) ?? '{}')).toEqual(loaded)
  })

  it('defaults Draft action confirmations on and preserves an explicit permanent suppression', () => {
    const storage = new MemoryStorage()
    expect(loadRendererPersistence(storage).confirmDraftActions).toBe(true)

    const normalized = normalizeRendererPersistence({
      ...loadRendererPersistence(storage),
      confirmDraftActions: false,
    })
    expect(normalized.confirmDraftActions).toBe(false)
  })

  it('migrates persisted schema v1 Rulebooks to the current schema', () => {
    const v1 = JSON.parse(JSON.stringify(STANDARD_DRAFT_RULEBOOK)) as Record<string, unknown>
    v1.schemaVersion = 1
    const identifier = v1.identifier as Record<string, unknown>
    identifier.id = 'local:v1'

    const normalized = normalizeRendererPersistence({
      ...loadRendererPersistence(new MemoryStorage()),
      rulebookLibrary: [
        {
          document: v1,
          origin: 'local',
          editor: { lastEditedAt: null },
        },
      ],
    })

    expect(normalized.rulebookLibrary).toHaveLength(1)
    expect(normalized.rulebookLibrary[0]?.document.schemaVersion).toBe(4)
    expect(normalized.rulebookLibrary[0]?.document.identifier.id).toBe('local:v1')
  })

  it('persists valid custom Draft pricing profiles and rejects invalid entries', () => {
    const normalized = normalizeRendererPersistence({
      ...loadRendererPersistence(new MemoryStorage()),
      pricingProfiles: [
        {
          schemaVersion: 1,
          id: 'local:pricing:test',
          name: 'Test Pricing',
          description: 'Custom pricing',
          createdAt: '2026-10-10T00:00:00.000Z',
          revision: '1',
          operatorCosts: { char_a: 7, char_b: 45 },
        },
        {
          schemaVersion: 1,
          id: 'local:pricing:invalid',
          name: 'Invalid',
          description: '',
          createdAt: '2026-10-10T00:00:00.000Z',
          revision: '1',
          operatorCosts: { char_bad: Number.NaN },
        },
      ],
    })

    expect(normalized.pricingProfiles).toHaveLength(1)
    expect(normalized.pricingProfiles[0]?.id).toBe('local:pricing:test')
    expect(normalized.pricingProfiles[0]?.operatorCosts.char_b).toBe(45)
  })

  it('keeps temporarily invalid Rulebook editor documents', () => {
    const invalid = cloneStandard()
    invalid.identifier.id = 'local:editing'
    invalid.identifier.name = ''
    const candidate: RendererPersistenceState = {
      ...loadRendererPersistence(new MemoryStorage()),
      rulebookLibrary: [
        {
          document: invalid,
          origin: 'local',
          editor: { lastEditedAt: '2026-10-05T00:00:00.000Z' },
        },
      ],
    }

    const normalized = normalizeRendererPersistence(candidate)
    expect(normalized.rulebookLibrary).toHaveLength(1)
    expect(normalized.rulebookLibrary[0]?.document.identifier.id).toBe('local:editing')
    expect(normalized.rulebookLibrary[0]?.document.identifier.name).toBe('')
  })

  it('rejects structurally corrupted Rulebook storage without conflating it with editor validity', () => {
    const corrupted = cloneStandard() as unknown as Record<string, unknown>
    corrupted.pool = { source: 'rulebook-pool' }
    const normalized = normalizeRendererPersistence({
      ...loadRendererPersistence(new MemoryStorage()),
      rulebookLibrary: [
        {
          document: corrupted,
          origin: 'local',
          editor: { lastEditedAt: null },
        },
      ],
    })
    expect(normalized.rulebookLibrary).toEqual([])
  })

  it('keeps Rulebook origin attached to the document record', () => {
    const local = cloneStandard()
    local.identifier.id = 'local:test'
    const imported = cloneStandard()
    imported.identifier.id = 'community:test'
    const normalized = normalizeRendererPersistence({
      ...loadRendererPersistence(new MemoryStorage()),
      rulebookLibrary: [
        { document: local, origin: 'local', editor: { lastEditedAt: null } },
        { document: imported, origin: 'imported', editor: { lastEditedAt: null } },
      ],
    })

    expect(
      normalized.rulebookLibrary.map(({ document, origin }) => [document.identifier.id, origin]),
    ).toEqual([
      ['local:test', 'local'],
      ['community:test', 'imported'],
    ])
  })
})
