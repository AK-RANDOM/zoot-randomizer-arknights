import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  analyzeDraftPricingCsv,
  applyDraftPricingCsv,
  serializeDraftPricingCsv,
  SHARED_BALANCE_PRICING_PROFILE,
} from './draftPricingProfile'

const operators = [
  { id: 'char_a', name: 'A', rarity: 5 },
  { id: 'char_b', name: 'B', rarity: 6 },
] as Operator[]

describe('Draft pricing CSV', () => {
  it('parses valid rows and ignores optional extra columns', () => {
    const analysis = analyzeDraftPricingCsv(
      'operator_id,base_cost,note\nchar_a,7,baseline\nchar_b,45,"premium, tier"\n',
      operators,
    )
    expect(analysis.valid).toBe(true)
    expect(analysis.rows).toEqual([
      { row: 2, operatorId: 'char_a', baseCost: 7 },
      { row: 3, operatorId: 'char_b', baseCost: 45 },
    ])
  })

  it('reports unknown, duplicate and invalid rows without applying them', () => {
    const analysis = analyzeDraftPricingCsv(
      'operator_id,base_cost\nchar_a,7\nmissing,8\nchar_a,9\nchar_b,nope\n',
      operators,
    )
    expect(analysis.valid).toBe(false)
    expect(analysis.updatedCount).toBe(1)
    expect(analysis.unknownCount).toBe(1)
    expect(analysis.duplicateCount).toBe(1)
    expect(analysis.invalidCount).toBe(1)
    expect(() => applyDraftPricingCsv({}, analysis, 'merge')).toThrow()
  })

  it('supports merge and replace imports', () => {
    const analysis = analyzeDraftPricingCsv('operator_id,base_cost\nchar_b,45\n', operators)
    expect(applyDraftPricingCsv({ char_a: 7 }, analysis, 'merge')).toEqual({
      char_a: 7,
      char_b: 45,
    })
    expect(applyDraftPricingCsv({ char_a: 7 }, analysis, 'replace')).toEqual({ char_b: 45 })
  })

  it('exports stable two-column CSV', () => {
    expect(
      serializeDraftPricingCsv({
        ...SHARED_BALANCE_PRICING_PROFILE,
        operatorCosts: { char_b: 45, char_a: 7 },
      }),
    ).toBe('operator_id,base_cost\nchar_a,7\nchar_b,45\n')
  })
})
