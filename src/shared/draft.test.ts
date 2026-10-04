import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  DRAFT_OFFER_SIZE,
  createDraftPoolKey,
  generateEqualOpportunityCandidates,
  pickDraftOperator,
  startDraft,
  type DraftCandidateGenerator,
  type DraftState,
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

function finishDraft(
  initialState: DraftState,
  pool: readonly Operator[],
  targetSize: number,
): DraftState {
  let state = initialState
  while (state.status === 'active') {
    state = pickDraftOperator(state, pool, state.currentOfferIds[0], { random: () => 0 })
  }
  expect(state.targetSize).toBe(targetSize)
  return state
}

describe('Draft milestone 1 engine', () => {
  it('starts with exactly three distinct eligible candidates', () => {
    const pool = roster(6)
    const state = startDraft(pool, 4, { random: () => 0 })

    expect(state.status).toBe('active')
    expect(state.currentOfferIds).toEqual(['char_1', 'char_2', 'char_3'])
    expect(new Set(state.currentOfferIds).size).toBe(DRAFT_OFFER_SIZE)
    expect(state.draftedOperatorIds).toEqual([])
  })

  it('adds only the selected operator and allows unchosen candidates to return', () => {
    const pool = roster(6)
    const initial = startDraft(pool, 4, { random: () => 0 })
    const next = pickDraftOperator(initial, pool, 'char_2', { random: () => 0 })

    expect(next.draftedOperatorIds).toEqual(['char_2'])
    expect(next.currentOfferIds).toEqual(['char_1', 'char_3', 'char_4'])
    expect(next.currentOfferIds).not.toContain('char_2')
  })

  it('reaches the configured squad size when enough operators remain for every offer', () => {
    const pool = roster(6)
    const completed = finishDraft(startDraft(pool, 4, { random: () => 0 }), pool, 4)

    expect(completed.status).toBe('complete')
    expect(completed.completionReason).toBe('squad-size-reached')
    expect(completed.draftedOperatorIds).toHaveLength(4)
    expect(new Set(completed.draftedOperatorIds).size).toBe(4)
    expect(completed.currentOfferIds).toEqual([])
  })

  it('ends cleanly when fewer than three undrafted operators remain', () => {
    const pool = roster(6)
    const completed = finishDraft(startDraft(pool, 5, { random: () => 0 }), pool, 5)

    expect(completed.status).toBe('complete')
    expect(completed.completionReason).toBe('pool-exhausted')
    expect(completed.draftedOperatorIds).toHaveLength(4)
    expect(completed.currentOfferIds).toEqual([])
  })

  it('does not create a partial offer from an initially undersized pool', () => {
    const state = startDraft(roster(2), 1, { random: () => 0 })

    expect(state).toEqual({
      targetSize: 1,
      poolKey: createDraftPoolKey(roster(2), 1),
      draftedOperatorIds: [],
      currentOfferIds: [],
      status: 'complete',
      completionReason: 'pool-exhausted',
    })
  })

  it('passes only remaining undrafted operators to a replaceable candidate generator', () => {
    const pool = roster(6)
    const observedCandidateIds: string[][] = []
    const generator: DraftCandidateGenerator = (candidates, count) => {
      observedCandidateIds.push(candidates.map(({ id }) => id))
      return candidates.slice(-count)
    }

    const initial = startDraft(pool, 4, { candidateGenerator: generator })
    expect(initial.currentOfferIds).toEqual(['char_4', 'char_5', 'char_6'])

    const next = pickDraftOperator(initial, pool, 'char_5', { candidateGenerator: generator })
    expect(next.draftedOperatorIds).toEqual(['char_5'])
    expect(observedCandidateIds).toEqual([
      ['char_1', 'char_2', 'char_3', 'char_4', 'char_5', 'char_6'],
      ['char_1', 'char_2', 'char_3', 'char_4', 'char_6'],
    ])
  })

  it('rejects invalid candidate-generator output', () => {
    const pool = roster(6)
    const duplicateGenerator: DraftCandidateGenerator = (candidates) => [
      candidates[0],
      candidates[0],
      candidates[1],
    ]

    expect(() => startDraft(pool, 4, { candidateGenerator: duplicateGenerator })).toThrow(
      'duplicate operator char_1',
    )
  })

  it('rejects picks outside the current offer and invalid random sources', () => {
    const pool = roster(6)
    const state = startDraft(pool, 4, { random: () => 0 })

    expect(() => pickDraftOperator(state, pool, 'char_6', { random: () => 0 })).toThrow(
      'not in the current draft offer',
    )
    expect(() => generateEqualOpportunityCandidates(pool, 3, () => 1)).toThrow(
      'range [0, 1)',
    )
  })

  it('keeps every active offer valid across a full multi-round draft', () => {
    const pool = roster(9)
    const poolIds = new Set(pool.map(({ id }) => id))
    let state = startDraft(pool, 6, { random: () => 0.37 })

    while (state.status === 'active') {
      expect(state.currentOfferIds).toHaveLength(DRAFT_OFFER_SIZE)
      expect(new Set(state.currentOfferIds).size).toBe(DRAFT_OFFER_SIZE)
      expect(state.currentOfferIds.every((id) => poolIds.has(id))).toBe(true)
      expect(
        state.currentOfferIds.some((id) => state.draftedOperatorIds.includes(id)),
      ).toBe(false)

      state = pickDraftOperator(state, pool, state.currentOfferIds[1], {
        random: () => 0.37,
      })
    }

    expect(state.completionReason).toBe('squad-size-reached')
    expect(state.draftedOperatorIds).toHaveLength(6)
    expect(new Set(state.draftedOperatorIds).size).toBe(6)
  })

  it('uses a stable pool key and rejects continuation after the pool changes', () => {
    const pool = roster(6)
    const reversed = [...pool].reverse()
    const state = startDraft(pool, 4, { random: () => 0 })

    expect(createDraftPoolKey(pool, 4)).toBe(createDraftPoolKey(reversed, 4))
    expect(state.poolKey).toBe(createDraftPoolKey(pool, 4))

    const changedPool = pool.slice(0, 5)
    expect(() =>
      pickDraftOperator(state, changedPool, state.currentOfferIds[0], { random: () => 0 }),
    ).toThrow('Draft pool or target size changed')
  })
})
