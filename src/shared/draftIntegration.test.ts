import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import { pickDraftOperator, startDraft, type DraftState } from './draft'
import type { Operator } from './operator'
import { buildFinalOperatorPool } from './operatorPool'

function operator(id: string, date = '2024-01-01'): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date, yearGroup: 5 },
      global: { date, yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

function finishDraft(state: DraftState, pool: readonly Operator[]): DraftState {
  let current = state
  while (current.status === 'active') {
    current = pickDraftOperator(current, pool, current.currentOfferIds[0], { random: () => 0 })
  }
  return current
}

describe('Draft milestone 1 pool integration', () => {
  it('uses the final operator pool after eligibility filters and manual exclusions', () => {
    const constraints = createDefaultConstraints()
    constraints.release.maxDate = '2024-12-31'
    const roster = [
      operator('char_a'),
      operator('char_b'),
      operator('char_c'),
      operator('char_d'),
      operator('char_future', '2026-01-01'),
    ]

    const pool = buildFinalOperatorPool(roster, constraints, ['char_b'])
    const state = startDraft(pool, 2, { random: () => 0 })

    expect(pool.map(({ id }) => id)).toEqual(['char_a', 'char_c', 'char_d'])
    expect(state.currentOfferIds).toEqual(['char_a', 'char_c', 'char_d'])
    expect(state.currentOfferIds).not.toContain('char_b')
    expect(state.currentOfferIds).not.toContain('char_future')
  })

  it('uses the configured squad size as the draft target', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 4
    const pool = Array.from({ length: 8 }, (_, index) => operator(`char_${index + 1}`))

    const completed = finishDraft(
      startDraft(pool, constraints.squadSize, { random: () => 0 }),
      pool,
    )

    expect(completed.completionReason).toBe('squad-size-reached')
    expect(completed.targetSize).toBe(4)
    expect(completed.draftedOperatorIds).toHaveLength(4)
  })
})
