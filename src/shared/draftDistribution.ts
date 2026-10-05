import type { Operator } from './operator'

export type DraftProbabilityBucketId = string

export interface DraftRateUpRule {
  share: number
  featuredOperatorIds: string[]
}

export interface DraftProbabilityBucket {
  id: DraftProbabilityBucketId
  weight: number
  rarities: number[]
  rateUp?: DraftRateUpRule
}

export type DraftPullDistribution =
  | { type: 'equal' }
  | { type: 'arknights'; rateUps?: Record<DraftProbabilityBucketId, DraftRateUpRule> }
  | { type: 'custom'; buckets: DraftProbabilityBucket[] }

export interface DraftPullState {
  pullsSinceSixStar: number
}

export interface DraftPullResult {
  operator: Operator
  state: DraftPullState
}

export const ARKNIGHTS_BUCKET_RATES: Record<string, number> = {
  '3': 40,
  '4': 50,
  '5': 8,
  '6': 2,
}

export function arknightsBucketForRarity(rarity: number): string {
  if (rarity === 1 || rarity === 5) return '5'
  if (rarity === 2 || rarity === 4) return '4'
  if (rarity === 3) return '3'
  if (rarity === 6) return '6'
  throw new Error(`Unsupported Draft rarity ${rarity}.`)
}

function randomIndex(random: () => number, length: number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  return Math.floor(value * length)
}

function weightedIndex(weights: readonly number[], random: () => number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (!(total > 0))
    throw new Error('Draft probability distribution has no positive eligible weight.')
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  let cursor = value * total
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index]
    if (cursor < 0) return index
  }
  return weights.length - 1
}

function chooseWithinBucket(
  candidates: readonly Operator[],
  rateUp: DraftRateUpRule | undefined,
  random: () => number,
): Operator {
  if (!rateUp || rateUp.share <= 0)
    return candidates[randomIndex(random, candidates.length)]

  if (rateUp.share > 1)
    throw new Error('Draft rate-up share must be between 0 and 1.')

  const featuredIds = new Set(rateUp.featuredOperatorIds)
  const featured = candidates.filter(operator => featuredIds.has(operator.id))
  const ordinary = candidates.filter(operator => !featuredIds.has(operator.id))
  if (featured.length === 0 || ordinary.length === 0)
    return candidates[randomIndex(random, candidates.length)]

  const sideRoll = random()
  if (!Number.isFinite(sideRoll) || sideRoll < 0 || sideRoll >= 1)
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  const side = sideRoll < rateUp.share ? featured : ordinary
  return side[randomIndex(random, side.length)]
}

function validateCustomBuckets(buckets: readonly DraftProbabilityBucket[]): void {
  const rarityMembership = new Map<number, string>()
  let hasPositive = false
  for (const bucket of buckets) {
    if (bucket.weight < 0 || !Number.isFinite(bucket.weight))
      throw new Error(`Draft bucket ${bucket.id} has an invalid weight.`)
    if (bucket.weight > 0 && bucket.rarities.length > 0) hasPositive = true
    for (const rarity of bucket.rarities) {
      const existing = rarityMembership.get(rarity)
      if (existing)
        throw new Error(`Draft rarity ${rarity} belongs to multiple buckets: ${existing}, ${bucket.id}.`)
      rarityMembership.set(rarity, bucket.id)
    }
  }
  for (const rarity of [1, 2, 3, 4, 5, 6]) {
    if (!rarityMembership.has(rarity))
      throw new Error(`Draft rarity ${rarity} must belong to exactly one custom bucket.`)
  }
  if (!hasPositive)
    throw new Error('Draft custom distribution requires at least one non-empty positive-weight bucket.')
}

function arknightsBuckets(
  candidates: readonly Operator[],
  state: DraftPullState,
  rateUps: Record<string, DraftRateUpRule> = {},
): Array<{ id: string; weight: number; candidates: Operator[]; rateUp?: DraftRateUpRule }> {
  const sixRate = Math.min(100, 2 + Math.max(0, state.pullsSinceSixStar - 49) * 2)
  const remainingScale = (100 - sixRate) / 98
  return ['3', '4', '5', '6'].map(id => ({
    id,
    weight: id === '6' ? sixRate : ARKNIGHTS_BUCKET_RATES[id] * remainingScale,
    candidates: candidates.filter(operator => arknightsBucketForRarity(operator.rarity) === id),
    rateUp: rateUps[id],
  }))
}

export function pullDraftCandidate(
  candidates: readonly Operator[],
  distribution: DraftPullDistribution,
  state: DraftPullState,
  random: () => number,
): DraftPullResult {
  if (candidates.length === 0)
    throw new Error('Cannot pull a Draft candidate from an empty pool.')

  let operator: Operator
  if (distribution.type === 'equal') {
    operator = candidates[randomIndex(random, candidates.length)]
  } else {
    const buckets = distribution.type === 'arknights'
      ? arknightsBuckets(candidates, state, distribution.rateUps)
      : (() => {
          validateCustomBuckets(distribution.buckets)
          return distribution.buckets.map(bucket => ({
            ...bucket,
            candidates: candidates.filter(operator => bucket.rarities.includes(operator.rarity)),
          }))
        })()

    const eligibleBuckets = buckets.filter(bucket => bucket.weight > 0 && bucket.candidates.length > 0)
    const selected = eligibleBuckets[weightedIndex(eligibleBuckets.map(bucket => bucket.weight), random)]
    operator = chooseWithinBucket(selected.candidates, selected.rateUp, random)
  }

  return {
    operator,
    state: { pullsSinceSixStar: operator.rarity === 6 ? 0 : state.pullsSinceSixStar + 1 },
  }
}

export function generateDraftDistributionCandidates(
  candidates: readonly Operator[],
  count: number,
  distribution: DraftPullDistribution,
  state: DraftPullState,
  random: () => number,
): { operators: Operator[]; state: DraftPullState } {
  if (candidates.length < count)
    throw new Error(`Cannot generate ${count} candidates from a pool of ${candidates.length}.`)
  const remaining = [...candidates]
  const operators: Operator[] = []
  let nextState = state
  for (let index = 0; index < count; index += 1) {
    const pulled = pullDraftCandidate(remaining, distribution, nextState, random)
    operators.push(pulled.operator)
    nextState = pulled.state
    remaining.splice(remaining.findIndex(operator => operator.id === pulled.operator.id), 1)
  }
  return { operators, state: nextState }
}
