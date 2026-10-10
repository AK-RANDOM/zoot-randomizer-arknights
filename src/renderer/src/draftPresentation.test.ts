import { describe, expect, it } from 'vitest'
import type { Operator } from '../../shared/operator'
import {
  resolveDraftEngineConfiguration,
  startDraft,
  type DraftEngineOptions,
} from '../../shared/draft'
import {
  draftEconomyValue,
  resolveDraftHoldPresentation,
  resolveDraftOperatorPresentation,
  resolveDraftSquadPresentation,
  resolveDraftStatusPresentation,
} from './draftPresentation'

function operator(id: string, rarity: Operator['rarity']): Operator {
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
  operator('one', 1),
  operator('two', 2),
  operator('three', 3),
  operator('four', 4),
  operator('five', 5),
  operator('six', 6),
  operator('seven', 4),
  operator('eight', 4),
  operator('nine', 4),
  operator('ten', 4),
  operator('eleven', 4),
  operator('twelve', 4),
]

describe('Draft renderer presentation seam', () => {
  it('maps signed point changes to absolute semantic economy values', () => {
    expect(draftEconomyValue(7)).toEqual({ pointDelta: 7, amount: 7, tone: 'rebate' })
    expect(draftEconomyValue(0)).toEqual({ pointDelta: 0, amount: 0, tone: 'neutral' })
    expect(draftEconomyValue(-12)).toEqual({ pointDelta: -12, amount: 12, tone: 'cost' })
  })

  it('keeps resolved operator price separate from Hold upkeep included in Pick delta', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      actionRules: { hold: { enabled: true } },
      economyRules: {
        enabled: true,
        startingPoints: 100,
        rarityCosts: { 1: 0, 2: 0, 3: 0, 4: 10, 5: 20, 6: 30 },
        holdUpkeep: { mode: 'static', cost: 3 },
      },
    }
    const configuration = resolveDraftEngineConfiguration(options)
    let state = startDraft(pool, 6, options)
    const heldId = state.currentOfferIds[0]
    state = {
      ...state,
      heldOperatorId: heldId,
      currentOfferIds: ['four', 'five', 'six'],
    }

    const presentation = resolveDraftOperatorPresentation(
      state,
      pool,
      pool.find((item) => item.id === 'four')!,
      configuration,
    )

    expect(presentation.resolvedCost).toBe(10)
    expect(presentation.price).toEqual({ pointDelta: -10, amount: 10, tone: 'cost' })
    expect(presentation.pick.economy.pointDelta).toBe(-13)
    expect(resolveDraftHoldPresentation(state, configuration)).toEqual({
      operatorId: heldId,
      currentUpkeep: { pointDelta: -3, amount: 3, tone: 'cost' },
    })
  })

  it('derives overflow-aware capacity without requiring the renderer to recreate capacity rules', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      capacityRules: {
        enabled: true,
        startingActiveSlots: 6,
        overflowSlots: 1,
        maxActiveSlots: 12,
      },
    }
    const state = startDraft(pool, 7, options)

    expect(resolveDraftStatusPresentation(state, 7).capacity).toEqual({
      effectivePermanent: 6,
      overflow: 1,
      ownership: 7,
      maximum: 7,
      label: '6+1 / 7',
    })
  })

  it('maps Draft capacity into the currently active permanent-slot geometry', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      capacityRules: {
        enabled: true,
        startingActiveSlots: 6,
        overflowSlots: 1,
        maxActiveSlots: 9,
      },
    }
    const state = startDraft(pool, 9, options)
    const presentation = resolveDraftSquadPresentation(state)

    expect(presentation.permanentCapacity).toBe(6)
    expect(presentation.maximum).toBe(9)
    expect(presentation.overflowVisible).toBe(true)
    expect(presentation.overflowOperatorId).toBeNull()
    expect(presentation.slots).toHaveLength(6)
    expect(presentation.slots.map((slot) => slot.state)).toEqual([
      'valid',
      'valid',
      'valid',
      'valid',
      'valid',
      'valid',
    ])
  })

  it('moves an occupied Overflow operator into normal ordering after expansion', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      capacityRules: {
        enabled: true,
        startingActiveSlots: 6,
        overflowSlots: 1,
        maxActiveSlots: 9,
      },
    }
    const base = startDraft(pool, 9, options)
    const draftedOperatorIds = pool.slice(0, 7).map((item) => item.id)
    const overflowed = { ...base, draftedOperatorIds }

    expect(resolveDraftSquadPresentation(overflowed).overflowOperatorId).toBe('seven')

    const expanded = { ...overflowed, activeCapacity: 7 }
    const presentation = resolveDraftSquadPresentation(expanded)
    expect(presentation.slots[6]).toMatchObject({
      slotNumber: 7,
      state: 'valid',
      operatorId: 'seven',
    })
    expect(presentation.overflowOperatorId).toBeNull()
    expect(presentation.overflowVisible).toBe(true)
  })

  it('removes Overflow at maximum permanent capacity and reports a plain capacity label', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      capacityRules: {
        enabled: true,
        startingActiveSlots: 6,
        overflowSlots: 1,
        maxActiveSlots: 9,
      },
    }
    const state = { ...startDraft(pool, 9, options), activeCapacity: 9 }

    expect(resolveDraftSquadPresentation(state).overflowVisible).toBe(false)
    expect(resolveDraftStatusPresentation(state, 9).capacity.label).toBe('9 / 9')
  })

  it('treats forfeited capacity as no longer permanent while leaving the configured maximum visible', () => {
    const options: DraftEngineOptions = {
      random: () => 0,
      capacityRules: {
        enabled: true,
        startingActiveSlots: 8,
        overflowSlots: 1,
        maxActiveSlots: 12,
      },
    }
    const state = { ...startDraft(pool, 12, options), forfeitedCapacityCount: 2 }
    const presentation = resolveDraftSquadPresentation(state)

    expect(presentation.permanentCapacity).toBe(6)
    expect(presentation.maximum).toBe(12)
    expect(resolveDraftStatusPresentation(state, 12).capacity.label).toBe('6+1 / 12')
  })
})
