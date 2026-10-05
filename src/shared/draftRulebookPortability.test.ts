import { describe, expect, it } from 'vitest'
import type { Operator, OperatorDataset } from './operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from './draftRulebook'
import {
  analyzeDraftRulebookImport,
  draftRulebookExportFileName,
  inspectDraftRulebookCompatibility,
  migrateDraftRulebookDocument,
} from './draftRulebookPortability'

function operator(id: string): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'sub_guard', name: 'Guard' },
    faction: {
      nationId: 'nation_test',
      groupId: null,
      teamId: 'team_test',
      primary: ['nation_test', 'team_test'],
      main: 'team_test',
      affiliations: ['nation_test', 'team_test'],
    },
    raceIds: ['race:test'],
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: null, yearGroup: null },
      global: { date: null, yearGroup: null },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }
}

const knownOperator = operator('char_known')
const dataset: OperatorDataset = {
  schemaVersion: 6,
  generatedAt: null,
  sources: {
    gamedataCnCommit: null,
    gamedataEnCommit: null,
    resourcesCommit: null,
    releaseMetadataCommit: null,
  },
  factionLabels: {
    nation_test: 'Test Nation',
    team_test: 'Test Team',
  },
  raceLabels: { 'race:test': 'Test Race' },
  operators: [knownOperator],
}

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

describe('Draft Rulebook portability', () => {
  it('accepts a current-schema Rulebook and preserves stable identity', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.id = 'community:test'
    rulebook.identifier.name = 'Community Test'

    const result = analyzeDraftRulebookImport(serializeDraftRulebook(rulebook), dataset)

    expect(result.compatible).toBe(true)
    expect(result.migrated).toBe(false)
    expect(result.sourceSchemaVersion).toBe(2)
    expect(result.rulebook?.identifier.id).toBe('community:test')
    expect(result.errors).toEqual([])
  })

  it('migrates schema v1 Rulebooks to v2 without opting into Hold upkeep', () => {
    const v1 = JSON.parse(serializeDraftRulebook(cloneStandard())) as Record<string, unknown>
    v1.schemaVersion = 1

    const result = analyzeDraftRulebookImport(JSON.stringify(v1), dataset)

    expect(result.compatible).toBe(true)
    expect(result.migrated).toBe(true)
    expect(result.sourceSchemaVersion).toBe(1)
    expect(result.rulebook?.schemaVersion).toBe(2)
    expect(result.rulebook?.generalRules.economyRules?.holdUpkeep).toBeUndefined()
  })

  it('rejects malformed JSON before schema validation', () => {
    const result = analyzeDraftRulebookImport('{ definitely not json', dataset)

    expect(result.compatible).toBe(false)
    expect(result.rulebook).toBeNull()
    expect(result.issues[0]).toMatchObject({ code: 'invalid-json', severity: 'error' })
  })

  it('reports a newer schema as incompatible instead of flattening it into validation noise', () => {
    const newer = JSON.parse(serializeDraftRulebook(cloneStandard())) as Record<string, unknown>
    newer.schemaVersion = 99

    const result = analyzeDraftRulebookImport(JSON.stringify(newer), dataset)

    expect(result.compatible).toBe(false)
    expect(result.rulebook).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'newer-schema-version' }))
  })

  it('fails clearly for invalid pre-v1 schema numbers rather than guessing a migration', () => {
    const older = JSON.parse(serializeDraftRulebook(cloneStandard())) as Record<string, unknown>
    older.schemaVersion = 0

    const result = migrateDraftRulebookDocument(older)

    expect(result.migrated).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'invalid-schema-version' }))
  })

  it('preserves unresolved operator and selector references as compatibility warnings', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.id = 'community:future-data'
    rulebook.pool = {
      source: 'rulebook-pool',
      eligibility: {
        allOf: [{ type: 'factions', factionIds: ['team_future'] }],
        anyOf: [],
        noneOf: [],
      },
    }
    rulebook.overrides.operatorCosts.char_future = 40
    rulebook.interactions = [{
      id: 'future-pair',
      type: 'anchor',
      source: { type: 'operators', operatorIds: ['char_known'] },
      target: { type: 'operators', operatorIds: ['char_future'] },
      modifier: 5,
    }]

    const serialized = serializeDraftRulebook(rulebook)
    const result = analyzeDraftRulebookImport(serialized, dataset)

    expect(result.compatible).toBe(true)
    expect(result.rulebook).not.toBeNull()
    expect(result.warnings.some((warning) => warning.includes('team_future'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('char_future'))).toBe(true)
    expect(serializeDraftRulebook(result.rulebook as DraftRulebook)).toContain('char_future')
  })

  it('rejects unsupported Arknights preset bucket IDs that the runtime would otherwise ignore', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.pullDistribution = {
      type: 'arknights',
      rateUps: {
        future_bucket: { share: 0.5, featuredOperatorIds: [knownOperator.id] },
      },
    }

    const result = analyzeDraftRulebookImport(serializeDraftRulebook(rulebook), dataset)

    expect(result.compatible).toBe(false)
    expect(result.rulebook).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'unsupported-arknights-bucket' }))
  })

  it('exposes compatibility inspection separately for editor/tooling use', () => {
    const rulebook = cloneStandard()
    rulebook.overrides.operatorCosts.char_future = 10

    const issues = inspectDraftRulebookCompatibility(rulebook, dataset)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'unresolved-reference' })
  })

  it('generates a stable filesystem-safe JSON export name', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.name = 'My Competitive Rules!'
    rulebook.identifier.revision = '2026.10 / final'

    expect(draftRulebookExportFileName(rulebook)).toBe(
      'my-competitive-rules-rev-2026-10-final.draft-rulebook.json',
    )
  })
})
