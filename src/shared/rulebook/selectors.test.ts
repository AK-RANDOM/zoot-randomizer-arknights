import { describe, expect, it } from 'vitest'
import type { OperatorDataset } from '../operator'
import {
  createDefaultDraftRulebookSelector,
  createDraftRulebookDatasetReferences,
  createDraftRulebookSelectorCatalog,
  inspectDraftRulebookSelectorReferences,
  matchesDraftRulebookSelector,
} from './selectors'

const dataset: OperatorDataset = {
  schemaVersion: 6,
  generatedAt: null,
  sources: {
    gamedataCnCommit: null,
    gamedataEnCommit: null,
    resourcesCommit: null,
    releaseMetadataCommit: null,
  },
  classLabels: { Guard: 'Guard' },
  factionLabels: { team_test: 'Test Team' },
  raceLabels: { 'race:test': 'Test Race' },
  operators: [{
    id: 'char_test',
    name: 'Test',
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'sub_test', name: 'Test subclass' },
    faction: {
      nationId: null,
      groupId: null,
      teamId: 'team_test',
      primary: ['team_test'],
      main: 'team_test',
      affiliations: ['team_test'],
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
    imageFile: 'char_test.png',
  }],
}

describe('canonical Draft Rulebook selector semantics', () => {
  it('drives editor catalog/defaults and runtime matching from the same dataset semantics', () => {
    const catalog = createDraftRulebookSelectorCatalog(dataset)
    expect(catalog.operators.map(({ id }) => id)).toEqual(['char_test'])
    expect(catalog.subclasses.map(({ id }) => id)).toEqual(['sub_test'])
    expect(catalog.factions.map(({ id }) => id)).toEqual(['team_test'])
    expect(catalog.races.map(({ id }) => id)).toEqual(['race:test'])

    const selector = createDefaultDraftRulebookSelector('operators', dataset)
    expect(selector).toEqual({ type: 'operators', operatorIds: ['char_test'] })
    expect(matchesDraftRulebookSelector(dataset.operators[0], selector)).toBe(true)
  })

  it('uses the same selector reference knowledge for portability checks', () => {
    const references = createDraftRulebookDatasetReferences(dataset)
    expect(inspectDraftRulebookSelectorReferences(
      { type: 'factions', factionIds: ['team_test', 'team_future'] },
      references,
    )).toEqual([
      expect.objectContaining({ id: 'team_test', resolved: true }),
      expect.objectContaining({ id: 'team_future', resolved: false }),
    ])
  })
})
