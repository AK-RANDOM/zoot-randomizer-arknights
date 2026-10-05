import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  STANDARD_DRAFT_CONFIGURATION,
  applyDraftAction,
  draftPullDistributionLabel,
  evaluateDraftAction,
  getDraftActionAvailability,
  resolveDraftEngineConfiguration,
  startDraft,
  type DraftEngineOptions,
} from './draft'

function operator(id: string, rarity: Operator['rarity'] = 4): Operator {
  return {
    id,
    name: id,
    rarity,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2024-01-01', yearGroup: 5 },
      global: { date: '2024-01-01', yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

const pool = [
  operator('six', 6),
  operator('one', 1),
  operator('four', 4),
  operator('five', 5),
  operator('extra1'),
  operator('extra2'),
  operator('extra3'),
  operator('extra4'),
  operator('extra5'),
]

describe('Draft resolved configuration foundation', () => {
  it('represents Standard Draft as explicit plain pick-1-of-3 configuration', () => {
    expect(STANDARD_DRAFT_CONFIGURATION.actionRules.hold.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.actionRules.forfeit.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.actionRules.reroll.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.actionRules.slotExpansion.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.capacityRules.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.economyRules.enabled).toBe(false)
    expect(STANDARD_DRAFT_CONFIGURATION.pullDistribution).toEqual({ type: 'equal' })
    expect(draftPullDistributionLabel(STANDARD_DRAFT_CONFIGURATION.pullDistribution)).toBe(
      'Equal Opportunity',
    )

    const implicit = startDraft(pool, 4, { random: () => 0 })
    const explicit = startDraft(pool, 4, {
      random: () => 0,
      configuration: STANDARD_DRAFT_CONFIGURATION,
    })
    expect(explicit).toEqual(implicit)
  })

  it('merges nested configuration with legacy top-level overrides during migration', () => {
    const resolved = resolveDraftEngineConfiguration({
      configuration: {
        economyRules: { enabled: true, startingPoints: 10, rarityCosts: { 6: 20 } },
        pullDistribution: { type: 'arknights' },
      },
      economyRules: {
        startingPoints: 15,
        operatorCostOverrides: { six: 7 },
      },
    })

    expect(resolved.economyRules.startingPoints).toBe(15)
    expect(resolved.economyRules.rarityCosts[6]).toBe(20)
    expect(resolved.economyRules.operatorCostOverrides.six).toBe(7)
    expect(resolved.pullDistribution.type).toBe('arknights')
  })

  it('uses one pool-aware legality result for preflight and execution', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      configuration: { economyRules: { enabled: true, startingPoints: 0 } },
    }
    const state = startDraft(pool, 4, options)
    const action = { type: 'pick', operatorId: 'six' } as const

    expect(evaluateDraftAction(state, pool, action, options)).toEqual({
      available: false,
      reason: 'insufficient-points',
    })
    expect(() => applyDraftAction(state, pool, action, options)).toThrow('insufficient-points')
    expect(() => getDraftActionAvailability(state, action, options)).toThrow(
      'requires the eligible pool',
    )
  })
})
