import { describe, expect, it } from 'vitest'
import { normalizeCharacterTables, validateOperatorDataset } from './operatorData'
import { createDefaultConstraints } from './constraints'
import { buildGlobalFilterOperatorPool } from './operatorPool'
import { operatorDatasetNeedsPipelineRefresh } from './operatorDataPipeline'
import { OPERATOR_DATA_PIPELINE_VERSION } from './operator'

describe('operator availability without a confirmed release date', () => {
  it('retains obtainable operators, reports unknown dates and retries date refresh', () => {
    const record = {
      name: 'New operator',
      rarity: 'TIER_6',
      profession: 'WARRIOR',
      subProfessionId: 'lord',
      isNotObtainable: false,
    }
    const dataset = normalizeCharacterTables(
      {
        char_new: record,
        char_unobtainable: { ...record, isNotObtainable: true },
      },
      {},
      {
        gamedataCnCommit: 'cn',
        gamedataEnCommit: 'en',
        resourcesCommit: 'resources',
        releaseMetadataCommit: 'release',
      },
      '2026-11-02T00:00:00Z',
    )
    dataset.dataPipelineVersion = OPERATOR_DATA_PIPELINE_VERSION
    const validation = validateOperatorDataset(dataset, { minimumOperators: 1 })
    expect(validation.valid, validation.errors.join('\n')).toBe(true)
    expect(validation.warnings).toContain('Operator char_new has no confirmed CN release date.')
    expect(dataset.operators.map((operator) => operator.id)).toEqual(['char_new'])
    expect(dataset.operators[0]).toMatchObject({
      availableOn: { cn: true, global: false },
      release: { cn: { date: null, yearGroup: null } },
    })
    expect(operatorDatasetNeedsPipelineRefresh(dataset)).toBe(true)
    const constraints = createDefaultConstraints()
    constraints.release.server = 'cn'
    expect(buildGlobalFilterOperatorPool(dataset.operators, constraints)).toHaveLength(1)
    constraints.release.maxDate = '2026-11-01'
    expect(buildGlobalFilterOperatorPool(dataset.operators, constraints)).toHaveLength(0)
  })
})
