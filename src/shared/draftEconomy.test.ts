import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  applyDraftAction,
  currentDraftOwnershipCapacity,
  getDraftActionAvailability,
  getDraftActionPointDelta,
  getDraftOperatorCost,
  startDraft,
  type DraftEngineOptions,
} from './draft'

function operator(id: string, rarity: Operator['rarity']): Operator {
  return {
    id, name: id, rarity, class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: { cn: { date: '2024-01-01', yearGroup: 5 }, global: { date: '2024-01-01', yearGroup: 5 } },
    acquisition: { family: 'standard', group: null },
    collaboration: null, alterGroup: null, mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

const pool = [
  operator('one', 1), operator('two', 2), operator('three', 3),
  operator('four', 4), operator('five', 5), operator('six', 6),
  operator('extra1', 4), operator('extra2', 4), operator('extra3', 4),
]

const options: DraftEngineOptions = {
  random: () => 0,
  capacityRules: { enabled: true, startingActiveSlots: 6, overflowSlots: 1, maxActiveSlots: 12 },
  actionRules: {
    forfeit: { enabled: true },
    reroll: { enabled: true, discardOffer: false },
    hold: { enabled: true },
    slotExpansion: { enabled: true },
  },
  economyRules: { enabled: true, startingPoints: 20 },
}

describe('Draft point economy', () => {
  it('uses locked rarity baselines and operator overrides', () => {
    expect(pool.slice(0, 6).map(operator => getDraftOperatorCost(operator, options))).toEqual([-8, -6, -4, 0, 12, 32])
    expect(getDraftOperatorCost(pool[5], { economyRules: { operatorCostOverrides: { six: 25 } } })).toBe(25)
  })

  it('charges positive-cost picks and lets negative costs generate budget', () => {
    let state = startDraft(pool, 6, options)
    expect(state.points).toBe(20)
    state = applyDraftAction(state, pool, { type: 'pick', operatorId: 'one' }, options)
    expect(state.points).toBe(28)

    const costlyPool = [pool[4], pool[0], pool[1], ...pool.slice(5)]
    state = startDraft(costlyPool, 6, options)
    state = applyDraftAction(state, costlyPool, { type: 'pick', operatorId: 'five' }, options)
    expect(state.points).toBe(8)
  })

  it('reports and enforces an unaffordable offered pick without hiding it', () => {
    const costlyPool = [pool[5], pool[0], pool[1], ...pool.slice(6)]
    const zeroBudget = { ...options, economyRules: { enabled: true, startingPoints: 0 } }
    const state = startDraft(costlyPool, 6, zeroBudget)
    expect(state.currentOfferIds).toContain('six')
    expect(getDraftActionPointDelta(costlyPool, { type: 'pick', operatorId: 'six' }, zeroBudget)).toBe(-32)
    expect(
      getDraftActionAvailability(
        state,
        { type: 'pick', operatorId: 'six' },
        zeroBudget,
        costlyPool,
      ).reason,
    ).toBe('insufficient-points')
    expect(() => applyDraftAction(state, costlyPool, { type: 'pick', operatorId: 'six' }, zeroBudget)).toThrow('insufficient-points')
  })

  it('applies configurable action prices and Forfeit rebate', () => {
    const priced: DraftEngineOptions = {
      ...options,
      economyRules: { enabled: true, startingPoints: 10, forfeitRebate: 4, rerollCost: 3, holdCost: 2, slotExpansionCost: 2 },
    }
    // Keep the target above the six starting active slots so slot expansion is
    // actually available and this test exercises its configured price.
    let state = startDraft(pool, 8, priced)
    state = applyDraftAction(state, pool, { type: 'reroll' }, priced)
    expect(state.points).toBe(7)
    state = applyDraftAction(state, pool, { type: 'slot-expansion' }, priced)
    expect(state.points).toBe(5)
    state = applyDraftAction(state, pool, { type: 'forfeit' }, priced)
    expect(state.points).toBe(9)
  })

  it('charges static Hold upkeep only after the following round is completed', () => {
    const upkeep: DraftEngineOptions = {
      ...options,
      actionRules: {
        ...options.actionRules,
        hold: { enabled: true, upkeepMode: 'static', upkeepBaseCost: 2 },
        forfeit: { enabled: true },
      },
      economyRules: { enabled: true, startingPoints: 5, holdCost: 1, forfeitRebate: 0 },
    }
    let state = startDraft(pool, 8, upkeep)
    state = applyDraftAction(state, pool, { type: 'hold', operatorId: state.currentOfferIds[0] }, upkeep)
    expect(state.points).toBe(4)
    expect(state.holdUpkeepCharges).toBe(0)

    state = applyDraftAction(state, pool, { type: 'forfeit' }, upkeep)
    expect(state.points).toBe(2)
    expect(state.holdUpkeepCharges).toBe(1)

    state = applyDraftAction(state, pool, { type: 'release-hold' }, upkeep)
    expect(state.points).toBe(2)
    expect(state.holdUpkeepCharges).toBe(0)
  })

  it('escalates Hold upkeep and blocks a round-ending action that cannot pay it', () => {
    const upkeep: DraftEngineOptions = {
      ...options,
      actionRules: {
        ...options.actionRules,
        hold: { enabled: true, upkeepMode: 'escalating', upkeepBaseCost: 2, upkeepEscalation: 3 },
        forfeit: { enabled: true },
      },
      economyRules: { enabled: true, startingPoints: 10, holdCost: 0, forfeitRebate: 0 },
    }
    let state = startDraft(pool, 8, upkeep)
    state = applyDraftAction(state, pool, { type: 'hold', operatorId: state.currentOfferIds[0] }, upkeep)
    state = applyDraftAction(state, pool, { type: 'forfeit' }, upkeep)
    expect(state.points).toBe(8)
    expect(state.holdUpkeepCharges).toBe(1)

    state = applyDraftAction(state, pool, { type: 'forfeit' }, upkeep)
    expect(state.points).toBe(3)
    expect(state.holdUpkeepCharges).toBe(2)
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, upkeep, pool).reason).toBe('insufficient-points')
  })

  it('lets the player draft the held operator before the first upkeep charge', () => {
    const upkeep: DraftEngineOptions = {
      ...options,
      actionRules: {
        ...options.actionRules,
        hold: { enabled: true, upkeepMode: 'static', upkeepBaseCost: 9 },
      },
      economyRules: { enabled: true, startingPoints: 1, holdCost: 0 },
    }
    let state = startDraft(pool, 8, upkeep)
    const held = state.currentOfferIds[0]
    state = applyDraftAction(state, pool, { type: 'hold', operatorId: held }, upkeep)
    expect(getDraftActionAvailability(state, { type: 'pick', operatorId: held }, upkeep, pool).available).toBe(true)
    state = applyDraftAction(state, pool, { type: 'pick', operatorId: held }, upkeep)
    expect(state.heldOperatorId).toBeNull()
    expect(state.holdUpkeepCharges).toBe(0)
  })

  it('does not opt into 6+1 capacity merely because slot expansion is enabled', () => {
    const legacyCompatible: DraftEngineOptions = {
      random: () => 0,
      actionRules: { slotExpansion: { enabled: true } },
    }
    const state = startDraft(pool, 6, legacyCompatible)
    expect(state.capacityRulesEnabled).toBe(false)
    expect(currentDraftOwnershipCapacity(state)).toBe(6)
  })

  it('keeps Standard Draft point-neutral when economy is disabled', () => {
    let state = startDraft(pool, 4, { random: () => 0 })
    state = applyDraftAction(state, pool, { type: 'pick', operatorId: state.currentOfferIds[0] }, { random: () => 0 })
    expect(state.economyRulesEnabled).toBe(false)
    expect(state.points).toBe(0)
  })
})
