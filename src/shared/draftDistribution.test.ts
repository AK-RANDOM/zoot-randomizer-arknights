import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  arknightsBucketForRarity,
  generateDraftDistributionCandidates,
  pullDraftCandidate,
  type DraftPullDistribution,
} from './draftDistribution'
import { applyDraftAction, startDraft, type DraftEngineOptions } from './draft'

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

function sequence(values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? values[values.length - 1] ?? 0
}

describe('Draft pull distributions', () => {
  it('uses the locked Arknights rarity-to-bucket mapping', () => {
    expect([1, 2, 3, 4, 5, 6].map(arknightsBucketForRarity)).toEqual(['5', '4', '3', '4', '5', '6'])
  })

  it('advances pity per generated candidate and resets on a generated 6-star', () => {
    const candidates = [operator('three', 3), operator('four', 4), operator('five', 5), operator('six', 6)]
    const beforePity = pullDraftCandidate(candidates, { type: 'arknights' }, { pullsSinceSixStar: 49 }, sequence([0.97, 0]))
    expect(beforePity.operator.rarity).toBe(4)
    expect(beforePity.state.pullsSinceSixStar).toBe(50)

    const pityPull = pullDraftCandidate(candidates, { type: 'arknights' }, { pullsSinceSixStar: 50 }, sequence([0.97, 0]))
    expect(pityPull.operator.rarity).toBe(6)
    expect(pityPull.state.pullsSinceSixStar).toBe(0)
  })

  it('redistributes custom weight away from empty eligible buckets', () => {
    const distribution: DraftPullDistribution = {
      type: 'custom',
      buckets: [
        { id: 'low', weight: 1, rarities: [1, 2, 3, 4, 5] },
        { id: 'six', weight: 100, rarities: [6] },
      ],
    }
    const pulled = pullDraftCandidate([operator('four', 4)], distribution, { pullsSinceSixStar: 0 }, () => 0.99)
    expect(pulled.operator.id).toBe('four')
  })

  it('applies rate-up as a second-stage choice inside a bucket', () => {
    const distribution: DraftPullDistribution = {
      type: 'custom',
      buckets: [
        { id: 'all', weight: 1, rarities: [1, 2, 3, 4, 5, 6], rateUp: { share: 0.5, featuredOperatorIds: ['featured'] } },
      ],
    }
    const pulled = pullDraftCandidate(
      [operator('featured', 6), operator('ordinary', 6)],
      distribution,
      { pullsSinceSixStar: 0 },
      sequence([0, 0.4, 0]),
    )
    expect(pulled.operator.id).toBe('featured')
  })

  it('never duplicates candidates inside one offer', () => {
    const candidates = Array.from({ length: 6 }, (_, index) => operator(`op${index}`, 4))
    const generated = generateDraftDistributionCandidates(candidates, 3, { type: 'arknights' }, { pullsSinceSixStar: 0 }, () => 0)
    expect(new Set(generated.operators.map(operator => operator.id)).size).toBe(3)
    expect(generated.state.pullsSinceSixStar).toBe(3)
  })

  it('counts rerolled displayed candidates as pulls', () => {
    const pool = Array.from({ length: 9 }, (_, index) => operator(`op${index}`, 4))
    const options: DraftEngineOptions = {
      random: () => 0,
      pullDistribution: { type: 'arknights' },
      actionRules: { reroll: { enabled: true, discardOffer: false } },
    }
    let state = startDraft(pool, 6, options)
    expect(state.pullsSinceSixStar).toBe(3)
    state = applyDraftAction(state, pool, { type: 'reroll' }, options)
    expect(state.pullsSinceSixStar).toBe(6)
  })
})
