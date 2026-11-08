import type { Operator } from '../operator'
import { arknightsBucketForRarity, pullDraftCandidate, type DraftPullState } from '../draftDistribution'
import { availableDraftOperators } from './pool'
import type {
  DraftEngineOptions,
  DraftRandomSource,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'

function randomOffset(random: DraftRandomSource, range: number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  }
  return Math.floor(value * range)
}

export function generateEqualOpportunityCandidates(
  candidates: readonly Operator[],
  count: number,
  random: DraftRandomSource = Math.random,
): Operator[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Candidate count must be a non-negative integer.')
  }
  if (candidates.length < count) {
    throw new Error(`Cannot generate ${count} candidates from a pool of ${candidates.length}.`)
  }

  const shuffled = [...candidates]
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = index + randomOffset(random, shuffled.length - index)
    ;[shuffled[index], shuffled[selectedIndex]] = [shuffled[selectedIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}

function validateGeneratedOffer(
  offer: readonly Operator[],
  candidates: readonly Operator[],
  offerSize: number,
): void {
  if (offer.length !== offerSize) {
    throw new Error(`Draft candidate generator must return exactly ${offerSize} operators.`)
  }
  const eligibleIds = new Set(candidates.map((operator) => operator.id))
  const seen = new Set<string>()
  for (const operator of offer) {
    if (!eligibleIds.has(operator.id)) {
      throw new Error(`Draft candidate generator returned ineligible operator ${operator.id}.`)
    }
    if (seen.has(operator.id)) {
      throw new Error(`Draft candidate generator returned duplicate operator ${operator.id}.`)
    }
    seen.add(operator.id)
  }
}

export interface GeneratedDraftOffer {
  ids: string[]
  discardPileOperatorIds: string[]
  pullsSinceSixStar: number
  generatedCandidateCount: number
  actualFiveStarGeneratedInFirstTen: boolean
}

export function generateDraftOffer(
  pool: readonly Operator[],
  state: DraftState,
  options: DraftEngineOptions,
  configuration: ResolvedDraftConfiguration,
): GeneratedDraftOffer | null {
  const eligible = availableDraftOperators(pool, state)
  const offerSize = configuration.offerSize
  if (eligible.length < offerSize) return null

  const random = options.random ?? Math.random
  const distribution = configuration.pullDistribution
  const discardPile = new Set(state.discardPileOperatorIds)
  const remaining = eligible.filter((operator) => !discardPile.has(operator.id))
  const discarded = eligible.filter((operator) => discardPile.has(operator.id))
  const bucketFor = (operator: Operator): string | undefined => {
    if (options.candidateGenerator || distribution.type === 'equal') return 'equal'
    if (distribution.type === 'arknights') return arknightsBucketForRarity(operator.rarity)
    return distribution.buckets.find((bucket) => bucket.rarities.includes(operator.rarity))?.id
  }
  const refillEmptyBuckets = (): void => {
    if (discardPile.size === 0) return
    const stocked = new Set(remaining.map(bucketFor))
    for (const operator of discarded) {
      if (discardPile.has(operator.id) && !stocked.has(bucketFor(operator))) {
        remaining.push(operator)
        discardPile.delete(operator.id)
      }
    }
  }

  let offer: Operator[]
  let pullState: DraftPullState = state
  refillEmptyBuckets()
  if (options.candidateGenerator) {
    // Replacement generators need enough candidates for the full offer in one call.
    if (remaining.length < offerSize) {
      remaining.push(...discarded)
      discardPile.clear()
    }
    offer = [...options.candidateGenerator(remaining, offerSize, random)]
    validateGeneratedOffer(offer, remaining, offerSize)
    if (remaining.length === offerSize) discardPile.clear()
  } else if (distribution.type === 'equal') {
    const freshCount = Math.min(offerSize, remaining.length)
    offer = generateEqualOpportunityCandidates(remaining, freshCount, random)
    if (freshCount === remaining.length) {
      remaining.length = 0
      refillEmptyBuckets()
      offer.push(...generateEqualOpportunityCandidates(remaining, offerSize - freshCount, random))
    }
  } else {
    offer = []
    for (let index = 0; index < offerSize; index += 1) {
      const pulled = pullDraftCandidate(remaining, distribution, pullState, random)
      offer.push(pulled.operator)
      pullState = pulled.state
      remaining.splice(remaining.indexOf(pulled.operator), 1)
      refillEmptyBuckets()
    }
  }

  validateGeneratedOffer(offer, eligible, offerSize)
  return {
    ids: offer.map((operator) => operator.id),
    discardPileOperatorIds: [...discardPile],
    pullsSinceSixStar: pullState.pullsSinceSixStar,
    generatedCandidateCount: pullState.generatedCandidateCount ?? state.generatedCandidateCount,
    actualFiveStarGeneratedInFirstTen:
      pullState.actualFiveStarGeneratedInFirstTen ?? state.actualFiveStarGeneratedInFirstTen,
  }
}
