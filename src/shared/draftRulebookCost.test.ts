import { describe, expect, it } from 'vitest'
import { getDraftOperatorCostWithConfiguration } from './draft'
import type { Operator } from './operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  deserializeDraftRulebook,
  resolveDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from './draftRulebook'
import {
  getDraftRulebookOperatorBaselineCost,
  getDraftRulebookOperatorCostBreakdown,
  resolveDraftRulebookOperatorCosts,
} from './draftRulebookCost'

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

function operator(id: string, rarity: Operator['rarity']): Operator {
  return {
    id,
    name: id,
    rarity,
    class: 'Guard',
    subclass: { id: 'sub_fighter', name: 'Fighter' },
    faction: { main: null, affiliations: [], primary: [] },
    raceIds: ['race:cn:test'],
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

describe('Draft Rulebook static cost model', () => {
  it('uses the active rarity baseline when an operator has no override', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 6: 30 },
    }
    const op = operator('char_default', 6)

    expect(getDraftRulebookOperatorCostBreakdown(rulebook, op)).toEqual({
      operatorId: 'char_default',
      rarityCost: 30,
      overrideCost: null,
      overrideDelta: 0,
      baselineCost: 30,
      minimumCost: 30,
      maximumCost: 30,
    })
  })

  it('derives the user-facing override delta from an absolute portable baseline', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 6: 30 },
    }
    rulebook.overrides.operatorCosts = { char_ulpianus: 36 }
    const op = operator('char_ulpianus', 6)

    const cost = getDraftRulebookOperatorCostBreakdown(rulebook, op)
    expect(cost.rarityCost).toBe(30)
    expect(cost.overrideCost).toBe(36)
    expect(cost.overrideDelta).toBe(6)
    expect(cost.baselineCost).toBe(36)
    expect(cost.minimumCost).toBe(36)
    expect(cost.maximumCost).toBe(36)
  })

  it('keeps the Rulebook baseline identical to the Draft engine static operator cost', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 5: 12 },
    }
    rulebook.overrides.operatorCosts = { char_test: 18 }
    const op = operator('char_test', 5)
    const configuration = resolveDraftRulebook(rulebook).configuration

    expect(getDraftRulebookOperatorBaselineCost(rulebook, op)).toBe(18)
    expect(getDraftOperatorCostWithConfiguration(op, configuration)).toBe(18)
  })

  it('supports negative/rebate baselines without special casing', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 2: -6 },
    }
    const op = operator('char_two_star', 2)

    expect(getDraftRulebookOperatorBaselineCost(rulebook, op)).toBe(-6)
  })

  it('resolves a pool-wide cost map and reports overrides not present in the dataset', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 5: 12, 6: 30 },
    }
    rulebook.overrides.operatorCosts = {
      char_known: 35,
      char_future: 70,
    }

    const result = resolveDraftRulebookOperatorCosts(rulebook, [
      operator('char_known', 6),
      operator('char_other', 5),
    ])

    expect(result.byOperatorId.char_known?.baselineCost).toBe(35)
    expect(result.byOperatorId.char_other?.baselineCost).toBe(12)
    expect(result.unresolvedOverrideOperatorIds).toEqual(['char_future'])
  })
})
