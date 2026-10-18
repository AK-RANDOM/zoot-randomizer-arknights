import { describe, expect, it } from 'vitest'
import {
  GARRISON_STAGE_CAPACITY,
  clearGarrisonOperatorConflicts,
  cloneGarrison,
  createGarrison,
  getGarrisonConflictOperatorIds,
  getGarrisonOperatorConflicts,
  getGarrisonParticipation,
  reorderGarrisonStages,
  garrisonHasOperatorConflicts,
  normalizeGarrisonStageOperatorIds,
  type Garrison,
} from './garrison'

function sampleGarrison(): Garrison {
  return {
    id: 'garrison:test',
    name: 'Test',
    duplicateOperatorsAllowed: true,
    stages: [
      { id: 'stage:a', name: 'Stage A', operatorIds: ['char_a', 'char_b'] },
      { id: 'stage:b', name: 'Stage B', operatorIds: ['char_a', 'char_c'] },
      { id: 'stage:c', name: 'Stage C', operatorIds: ['char_a', 'char_b'] },
    ],
  }
}

describe('Garrison model', () => {
  it('normalizes a stage to at most 13 unique non-empty operator IDs', () => {
    const ids = [
      '',
      ' char_a ',
      'char_a',
      ...Array.from({ length: 20 }, (_, index) => `char_${index}`),
    ]
    const normalized = normalizeGarrisonStageOperatorIds(ids)
    expect(normalized).toHaveLength(GARRISON_STAGE_CAPACITY)
    expect(normalized[0]).toBe('char_a')
    expect(new Set(normalized).size).toBe(normalized.length)
  })

  it('derives participation counts by stage instead of raw occurrence', () => {
    expect(getGarrisonParticipation(sampleGarrison())).toEqual([
      { operatorId: 'char_a', stageCount: 3 },
      { operatorId: 'char_b', stageCount: 2 },
      { operatorId: 'char_c', stageCount: 1 },
    ])
  })

  it('orders participants by usage, then stage order, then slot order', () => {
    const doc = sampleGarrison()
    doc.stages = [
      { id: 'early', name: 'First', operatorIds: ['first-single', 'second-tie', 'first-tie'] },
      { id: 'middle', name: 'Second', operatorIds: ['first-tie', 'second-tie', 'other'] },
      { id: 'late', name: 'Third', operatorIds: ['most', 'most-tail', 'most-tail-2'] },
      { id: 'last', name: 'Last', operatorIds: ['most', 'second-tie', 'first-tie'] },
      { id: 'end', name: 'End', operatorIds: ['most', 'most-tail'] },
    ]
    expect(getGarrisonParticipation(doc)).toEqual([
      { operatorId: 'second-tie', stageCount: 3 },
      { operatorId: 'first-tie', stageCount: 3 },
      { operatorId: 'most', stageCount: 3 },
      { operatorId: 'most-tail', stageCount: 2 },
      { operatorId: 'first-single', stageCount: 1 },
      { operatorId: 'other', stageCount: 1 },
      { operatorId: 'most-tail-2', stageCount: 1 },
    ])
  })

  it('identifies every conflicting operator together with all affected stages', () => {
    expect(getGarrisonOperatorConflicts(sampleGarrison())).toEqual([
      {
        operatorId: 'char_a',
        stageIds: ['stage:a', 'stage:b', 'stage:c'],
        stageNames: ['Stage A', 'Stage B', 'Stage C'],
      },
      {
        operatorId: 'char_b',
        stageIds: ['stage:a', 'stage:c'],
        stageNames: ['Stage A', 'Stage C'],
      },
    ])
    expect(getGarrisonConflictOperatorIds(sampleGarrison())).toEqual(['char_a', 'char_b'])
    expect(garrisonHasOperatorConflicts(sampleGarrison())).toBe(true)
  })

  it('only removes later duplicate assignments after explicit conflict resolution', () => {
    const original = sampleGarrison()
    const resolved = clearGarrisonOperatorConflicts(original)
    expect(resolved.stages.map((stage) => stage.operatorIds)).toEqual([
      ['char_a', 'char_b'],
      ['char_c'],
      [],
    ])
    expect(garrisonHasOperatorConflicts(resolved)).toBe(false)
    expect(original.stages[1]?.operatorIds).toEqual(['char_a', 'char_c'])
  })

  it('clones documents without sharing mutable stage arrays', () => {
    const original = createGarrison('Clone')
    original.stages.push({ id: 'stage:a', name: 'Stage A', operatorIds: ['char_a'] })
    const cloned = cloneGarrison(original)
    cloned.stages[0]?.operatorIds.push('char_b')
    expect(original.stages[0]?.operatorIds).toEqual(['char_a'])
  })
})

describe('Garrison stage drag ordering', () => {
  it('moves a row upward or downward without changing assignments or IDs', () => {
    const original = sampleGarrison()
    const moved = reorderGarrisonStages(original, 'stage:a', 'stage:c', 'after')
    expect(moved.stages.map(({ id }) => id)).toEqual(['stage:b', 'stage:c', 'stage:a'])
    expect(moved.stages[2].operatorIds).toEqual(['char_a', 'char_b'])
    expect(original.stages.map(({ id }) => id)).toEqual(['stage:a', 'stage:b', 'stage:c'])
    const back = reorderGarrisonStages(moved, 'stage:a', 'stage:b', 'before')
    expect(back).toEqual(original)
  })

  it('ignores invalid and same-row drops', () => {
    const original = sampleGarrison()
    expect(reorderGarrisonStages(original, 'stage:a', 'stage:a', 'before')).toEqual(original)
    expect(reorderGarrisonStages(original, 'missing', 'stage:b', 'after')).toEqual(original)
    expect(reorderGarrisonStages(original, 'stage:a', 'missing', 'after')).toEqual(original)
  })

  it('changes participation first-seen order as rows are moved', () => {
    const original = sampleGarrison()
    const moved = reorderGarrisonStages(original, 'stage:c', 'stage:a', 'before')
    expect(moved.stages[0].name).toBe('Stage C')
    expect(getGarrisonParticipation(moved)).toEqual(getGarrisonParticipation(original))
  })
})
