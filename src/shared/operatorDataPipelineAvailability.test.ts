import { describe, expect, it } from 'vitest'
import type { OperatorDataset } from './operator'
import { alignAvailabilityWithReleaseMetadata } from './operatorDataPipeline'

function datasetWithOperators(operators: OperatorDataset['operators']): OperatorDataset {
  return { operators } as unknown as OperatorDataset
}

describe('operator data pipeline release availability', () => {
  it('drops announced entries without any dated release and clears undated server availability', () => {
    const dataset = datasetWithOperators([
      {
        id: 'char_released',
        availableOn: { cn: true, global: true },
        release: {
          cn: { date: '2026-10-01', yearGroup: 8 },
          global: { date: null, yearGroup: null },
        },
      },
      {
        id: 'char_announced',
        availableOn: { cn: true, global: false },
        release: {
          cn: { date: null, yearGroup: null },
          global: { date: null, yearGroup: null },
        },
      },
    ] as OperatorDataset['operators'])

    const aligned = alignAvailabilityWithReleaseMetadata(dataset)

    expect(aligned.operators).toHaveLength(1)
    expect(aligned.operators[0]).toMatchObject({
      id: 'char_released',
      availableOn: { cn: true, global: false },
      release: {
        cn: { date: '2026-10-01', yearGroup: 8 },
        global: { date: null, yearGroup: null },
      },
    })
  })
})
