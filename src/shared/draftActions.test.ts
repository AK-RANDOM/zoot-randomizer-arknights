import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  applyDraftAction,
  currentDraftOwnershipCapacity,
  getDraftActionAvailability,
  startDraft,
  type DraftEngineOptions,
} from './draft'

function operator(id: string): Operator {
  return {
    id,
    name: id,
    rarity: 6,
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

function roster(size: number): Operator[] {
  return Array.from({ length: size }, (_, index) => operator(`char_${index + 1}`))
}

const advancedOptions: DraftEngineOptions = {
  random: () => 0,
  capacityRules: { enabled: true, startingActiveSlots: 6, overflowSlots: 1, maxActiveSlots: 12 },
  actionRules: {
    hold: { enabled: true },
    forfeit: { enabled: true, discardOffer: true },
    reroll: { enabled: true, perRoundLimit: 2, discardOffer: true },
    slotExpansion: { enabled: true, perRoundLimit: 1 },
  },
}

describe('Draft advanced execution mechanics', () => {
  it('keeps advanced actions disabled and legacy capacity unchanged by default', () => {
    const state = startDraft(roster(15), 12, { random: () => 0 })
    expect(currentDraftOwnershipCapacity(state)).toBe(12)
    expect(getDraftActionAvailability(state, { type: 'reroll' }).reason).toBe('action-disabled')
    expect(getDraftActionAvailability(state, { type: 'forfeit' }).reason).toBe('action-disabled')
    expect(getDraftActionAvailability(state, { type: 'slot-expansion' }).reason).toBe(
      'action-disabled',
    )
  })

  it('uses 6 active + 1 overflow as the initial advanced ownership capacity', () => {
    const state = startDraft(roster(18), 12, advancedOptions)
    expect(state.activeCapacity).toBe(6)
    expect(state.overflowCapacity).toBe(1)
    expect(currentDraftOwnershipCapacity(state)).toBe(7)
  })

  it('rerolls without resolving the round and applies discard semantics', () => {
    const pool = roster(15)
    const initial = startDraft(pool, 12, advancedOptions)
    const rerolled = applyDraftAction(initial, pool, { type: 'reroll' }, advancedOptions)
    expect(rerolled.currentOfferIds).toEqual(['char_4', 'char_5', 'char_6'])
    expect(rerolled.discardedOperatorIds).toEqual(['char_1', 'char_2', 'char_3'])
    expect(rerolled.roundNumber).toBe(1)
    expect(rerolled.completedRounds).toBe(0)
  })

  it('expands active capacity once per round without resolving the round', () => {
    const pool = roster(18)
    const initial = startDraft(pool, 12, advancedOptions)
    const expanded = applyDraftAction(initial, pool, { type: 'slot-expansion' }, advancedOptions)
    expect(expanded.currentOfferIds).toEqual(initial.currentOfferIds)
    expect(expanded.activeCapacity).toBe(7)
    expect(currentDraftOwnershipCapacity(expanded)).toBe(8)
    expect(
      getDraftActionAvailability(expanded, { type: 'slot-expansion' }, advancedOptions).reason,
    ).toBe('per-round-limit')
  })

  it('holds one operator, can release it without ending the round, and returns it to the pool', () => {
    const pool = roster(18)
    const initial = startDraft(pool, 12, advancedOptions)
    let state = applyDraftAction(
      initial,
      pool,
      { type: 'hold', operatorId: 'char_2' },
      advancedOptions,
    )
    expect(state.heldOperatorId).toBe('char_2')
    expect(state.roundNumber).toBe(2)
    expect(
      getDraftActionAvailability(
        state,
        { type: 'hold', operatorId: state.currentOfferIds[0] },
        advancedOptions,
      ).reason,
    ).toBe('hold-slot-occupied')
    const round = state.roundNumber
    state = applyDraftAction(state, pool, { type: 'release-hold' }, advancedOptions)
    expect(state.heldOperatorId).toBeNull()
    expect(state.roundNumber).toBe(round)
    expect(state.discardedOperatorIds).not.toContain('char_2')
  })

  it('commits a held operator through Pick as the round-consuming resolution', () => {
    const pool = roster(18)
    let state = startDraft(pool, 12, advancedOptions)
    state = applyDraftAction(
      state,
      pool,
      { type: 'hold', operatorId: state.currentOfferIds[1] },
      advancedOptions,
    )
    const held = state.heldOperatorId!
    const beforeRound = state.roundNumber
    state = applyDraftAction(state, pool, { type: 'pick', operatorId: held }, advancedOptions)
    expect(state.draftedOperatorIds).toContain(held)
    expect(state.heldOperatorId).toBeNull()
    expect(state.roundNumber).toBe(beforeRound + 1)
  })

  it('forfeit consumes a round and permanently reduces usable capacity', () => {
    const pool = roster(18)
    const initial = startDraft(pool, 12, advancedOptions)
    const forfeited = applyDraftAction(initial, pool, { type: 'forfeit' }, advancedOptions)
    expect(forfeited.forfeitedCapacityCount).toBe(1)
    expect(currentDraftOwnershipCapacity(forfeited)).toBe(6)
    expect(forfeited.discardedOperatorIds).toEqual(initial.currentOfferIds)
    expect(forfeited.roundNumber).toBe(2)
  })

  it('blocks picks at current capacity until expansion and cannot forfeit occupied capacity', () => {
    const pool = roster(24)
    let state = startDraft(pool, 12, advancedOptions)
    for (let i = 0; i < 7; i += 1) {
      state = applyDraftAction(
        state,
        pool,
        { type: 'pick', operatorId: state.currentOfferIds[0] },
        advancedOptions,
      )
    }
    expect(currentDraftOwnershipCapacity(state)).toBe(7)
    expect(state.status).toBe('active')
    expect(state.currentOfferIds).toHaveLength(3)
    expect(
      getDraftActionAvailability(
        state,
        { type: 'pick', operatorId: state.currentOfferIds[0] },
        advancedOptions,
      ).reason,
    ).toBe('capacity-full')
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, advancedOptions).reason).toBe(
      'capacity-forfeit-unavailable',
    )
    expect(
      getDraftActionAvailability(state, { type: 'slot-expansion' }, advancedOptions).available,
    ).toBe(true)
    state = applyDraftAction(state, pool, { type: 'slot-expansion' }, advancedOptions)
    expect(
      getDraftActionAvailability(
        state,
        { type: 'pick', operatorId: state.currentOfferIds[0] },
        advancedOptions,
      ).available,
    ).toBe(true)
  })

  it('resets per-round counters after a round-ending action while preserving totals', () => {
    const pool = roster(18)
    let state = startDraft(pool, 12, advancedOptions)
    state = applyDraftAction(state, pool, { type: 'reroll' }, advancedOptions)
    state = applyDraftAction(state, pool, { type: 'forfeit' }, advancedOptions)
    expect(state.actionUsage.reroll).toMatchObject({ total: 1, round: 0, lastUsedRound: 1 })
    expect(state.actionUsage.forfeit).toMatchObject({ total: 1, round: 0, lastUsedRound: 1 })
  })

  it('enforces cooldown and per-draft limits deterministically', () => {
    const pool = roster(18)
    const options: DraftEngineOptions = {
      random: () => 0,
      actionRules: {
        reroll: { enabled: true, perRoundLimit: null, perDraftLimit: 1 },
        forfeit: { enabled: true, cooldownRounds: 1 },
      },
    }
    let state = startDraft(pool, 8, options)
    state = applyDraftAction(state, pool, { type: 'reroll' }, options)
    expect(getDraftActionAvailability(state, { type: 'reroll' }, options).reason).toBe(
      'per-draft-limit',
    )
    state = applyDraftAction(state, pool, { type: 'forfeit' }, options)
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, options).reason).toBe('cooldown')
    state = applyDraftAction(
      state,
      pool,
      { type: 'pick', operatorId: state.currentOfferIds[0] },
      options,
    )
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, options).available).toBe(true)
  })
})
