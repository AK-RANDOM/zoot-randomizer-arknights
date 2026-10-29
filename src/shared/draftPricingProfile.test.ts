import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  analyzeDraftPricingCsv,
  applyDraftPricingCsv,
  serializeDraftPricingCsv,
  SHARED_BALANCE_PRICING_PROFILE,
  SHARED_BALANCE_SIX_STAR_COSTS,
} from './draftPricingProfile'

const operators = [
  { id: 'char_a', name: 'A', rarity: 5 },
  { id: 'char_b', name: 'B', rarity: 6 },
] as Operator[]

describe('Bundled Draft #58 pricing', () => {
  it('includes the current 137 specified 6★ operators with the locked tier populations', () => {
    expect(Object.keys(SHARED_BALANCE_SIX_STAR_COSTS)).toHaveLength(137)
    expect(SHARED_BALANCE_PRICING_PROFILE.operatorCosts).toEqual(SHARED_BALANCE_SIX_STAR_COSTS)
    expect(
      Object.values(SHARED_BALANCE_PRICING_PROFILE.operatorCosts).reduce<Record<number, number>>(
        (totals, cost) => ({ ...totals, [cost]: (totals[cost] ?? 0) + 1 }),
        {},
      ),
    ).toEqual({
      '-14': 15,
      '-16': 15,
      '-18': 15,
      '-21': 15,
      '-24': 15,
      '-27': 15,
      '-30': 15,
      '-40': 6,
      '-45': 6,
      '-50': 6,
      '-55': 6,
      '-60': 8,
    })
  })

  it('uses stable operator IDs for representative premium and normal costs', () => {
    expect(SHARED_BALANCE_SIX_STAR_COSTS.char_2027_wang).toBe(-60)
    expect(SHARED_BALANCE_SIX_STAR_COSTS.char_2025_shu).toBe(-50)
    expect(SHARED_BALANCE_SIX_STAR_COSTS.char_4064_mlynar).toBe(-40)
    expect(SHARED_BALANCE_SIX_STAR_COSTS.char_222_bpipe).toBe(-30)
    expect(SHARED_BALANCE_SIX_STAR_COSTS.char_225_haak).toBe(-14)
  })
})

describe('Draft pricing CSV', () => {
  it('parses valid rows and ignores optional extra columns', () => {
    const analysis = analyzeDraftPricingCsv(
      'operator_id,base_cost,note\nchar_a,-7,baseline\nchar_b,-45,"premium, tier"\n',
      operators,
    )
    expect(analysis.valid).toBe(true)
    expect(analysis.rows).toEqual([
      { row: 2, operatorId: 'char_a', baseCost: -7 },
      { row: 3, operatorId: 'char_b', baseCost: -45 },
    ])
  })

  it('reports unknown, duplicate and invalid rows without applying them', () => {
    const analysis = analyzeDraftPricingCsv(
      'operator_id,base_cost\nchar_a,-7\nmissing,8\nchar_a,9\nchar_b,nope\n',
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
    const analysis = analyzeDraftPricingCsv('operator_id,base_cost\nchar_b,-45\n', operators)
    expect(applyDraftPricingCsv({ char_a: -7 }, analysis, 'merge')).toEqual({
      char_a: -7,
      char_b: -45,
    })
    expect(applyDraftPricingCsv({ char_a: -7 }, analysis, 'replace')).toEqual({ char_b: -45 })
  })

  it('exports stable two-column CSV', () => {
    expect(
      serializeDraftPricingCsv({
        ...SHARED_BALANCE_PRICING_PROFILE,
        operatorCosts: { char_b: -45, char_a: -7 },
      }),
    ).toBe('operator_id,base_cost\nchar_a,-7\nchar_b,-45\n')
  })
})
