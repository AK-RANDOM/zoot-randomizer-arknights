import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  applyDraftAction,
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
  actionRules: {
    hold: { enabled: true },
    forfeit: { enabled: true, discardOffer: true },
    reroll: { enabled: true, perRoundLimit: 2, discardOffer: true },
    slotExpansion: { enabled: true, perRoundLimit: 1 },
  },
}

describe('Draft milestone 2 action framework', () => {
  it('keeps advanced actions disabled by default', () => {
    const state = startDraft(roster(9), 6, { random: () => 0 })

    expect(getDraftActionAvailability(state, { type: 'reroll' })).toEqual({
      available: false,
      reason: 'action-disabled',
    })
    expect(getDraftActionAvailability(state, { type: 'forfeit' })).toEqual({
      available: false,
      reason: 'action-disabled',
    })
    expect(getDraftActionAvailability(state, { type: 'slot-expansion' })).toEqual({
      available: false,
      reason: 'action-disabled',
    })
  })

  it('rerolls without resolving the round and applies discard semantics', () => {
    const pool = roster(12)
    const initial = startDraft(pool, 6, advancedOptions)
    const rerolled = applyDraftAction(initial, pool, { type: 'reroll' }, advancedOptions)

    expect(initial.currentOfferIds).toEqual(['char_1', 'char_2', 'char_3'])
    expect(rerolled.currentOfferIds).toEqual(['char_4', 'char_5', 'char_6'])
    expect(rerolled.discardedOperatorIds).toEqual(['char_1', 'char_2', 'char_3'])
    expect(rerolled.roundNumber).toBe(1)
    expect(rerolled.completedRounds).toBe(0)
    expect(rerolled.actionUsage.reroll).toMatchObject({ total: 1, round: 1, lastUsedRound: 1 })
  })

  it('allows slot expansion once per round without resolving the round', () => {
    const pool = roster(12)
    const initial = startDraft(pool, 6, advancedOptions)
    const expanded = applyDraftAction(initial, pool, { type: 'slot-expansion' }, advancedOptions)

    expect(expanded.currentOfferIds).toEqual(initial.currentOfferIds)
    expect(expanded.roundNumber).toBe(1)
    expect(expanded.completedRounds).toBe(0)
    expect(expanded.capacityExpansionCount).toBe(1)
    expect(getDraftActionAvailability(expanded, { type: 'slot-expansion' }, advancedOptions)).toEqual({
      available: false,
      reason: 'per-round-limit',
    })
  })

  it('Hold resolves a round into exactly one separate Hold slot', () => {
    const pool = roster(12)
    const initial = startDraft(pool, 6, advancedOptions)
    const held = applyDraftAction(
      initial,
      pool,
      { type: 'hold', operatorId: initial.currentOfferIds[1] },
      advancedOptions,
    )

    expect(held.heldOperatorId).toBe('char_2')
    expect(held.draftedOperatorIds).toEqual([])
    expect(held.roundNumber).toBe(2)
    expect(held.completedRounds).toBe(1)
    expect(held.currentOfferIds).not.toContain('char_2')
    expect(
      getDraftActionAvailability(
        held,
        { type: 'hold', operatorId: held.currentOfferIds[0] },
        advancedOptions,
      ),
    ).toEqual({ available: false, reason: 'hold-slot-occupied' })
  })

  it('Forfeit resolves a round and can permanently discard the current offer', () => {
    const pool = roster(12)
    const initial = startDraft(pool, 6, advancedOptions)
    const forfeited = applyDraftAction(initial, pool, { type: 'forfeit' }, advancedOptions)

    expect(forfeited.draftedOperatorIds).toEqual([])
    expect(forfeited.discardedOperatorIds).toEqual(initial.currentOfferIds)
    expect(forfeited.roundNumber).toBe(2)
    expect(forfeited.completedRounds).toBe(1)
    expect(forfeited.currentOfferIds.some((id) => initial.currentOfferIds.includes(id))).toBe(false)
  })

  it('resets per-round counters after a round-ending action while preserving totals', () => {
    const pool = roster(15)
    let state = startDraft(pool, 6, advancedOptions)
    state = applyDraftAction(state, pool, { type: 'reroll' }, advancedOptions)
    state = applyDraftAction(state, pool, { type: 'forfeit' }, advancedOptions)

    expect(state.actionUsage.reroll).toMatchObject({ total: 1, round: 0, lastUsedRound: 1 })
    expect(state.actionUsage.forfeit).toMatchObject({ total: 1, round: 0, lastUsedRound: 1 })
    expect(state.roundNumber).toBe(2)
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
    expect(getDraftActionAvailability(state, { type: 'reroll' }, options).reason).toBe('per-draft-limit')

    state = applyDraftAction(state, pool, { type: 'forfeit' }, options)
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, options).reason).toBe('cooldown')
    state = applyDraftAction(
      state,
      pool,
      { type: 'pick', operatorId: state.currentOfferIds[0] },
      options,
    )
    expect(getDraftActionAvailability(state, { type: 'forfeit' }, options)).toEqual({
      available: true,
      reason: null,
    })
  })

  it('rejects invalid Hold selections through the shared availability API', () => {
    const state = startDraft(roster(9), 6, advancedOptions)

    expect(
      getDraftActionAvailability(state, { type: 'hold', operatorId: 'char_9' }, advancedOptions),
    ).toEqual({ available: false, reason: 'invalid-offer-selection' })
  })
})
