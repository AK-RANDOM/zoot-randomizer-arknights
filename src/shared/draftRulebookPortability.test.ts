import { describe, expect, it } from 'vitest'
import { deserializeDraftRulebookWithReport } from './draftRulebookPortability'
import { DRAFT_RULEBOOK_SCHEMA_VERSION, STANDARD_DRAFT_RULEBOOK } from './draftRulebook'

describe('Draft Rulebook portability', () => {
  it('migrates schema v1 documents sequentially to the current schema', () => {
    const legacy = structuredClone(STANDARD_DRAFT_RULEBOOK) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    const report = deserializeDraftRulebookWithReport(JSON.stringify(legacy))
    expect(report.rulebook?.schemaVersion).toBe(DRAFT_RULEBOOK_SCHEMA_VERSION)
    expect(report.migrated).toBe(true)
    expect(report.sourceSchemaVersion).toBe(1)
    expect(report.issues).toEqual([])
  })

  it('migrates schema v3 documents by adding no behavioral defaults', () => {
    const legacy = structuredClone(STANDARD_DRAFT_RULEBOOK) as unknown as Record<string, unknown>
    legacy.schemaVersion = 3
    const report = deserializeDraftRulebookWithReport(JSON.stringify(legacy))
    expect(report.rulebook?.schemaVersion).toBe(4)
    expect(report.rulebook?.generalRules.pricingProfileId).toBeUndefined()
    expect(report.issues).toEqual([])
  })
})
