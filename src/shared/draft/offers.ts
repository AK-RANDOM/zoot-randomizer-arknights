import type { Operator } from '../operator'
import { generateDraftDistributionCandidates } from '../draftDistribution'
import { availableDraftOperators } from './pool'
import type {
  DraftEngineOptions,
  DraftRandomSource,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'
import { DRAFT_OFFER_SIZE } from './types'

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
): void {
  if (offer.length !== DRAFT_OFFER_SIZE) {
    throw new Error(
      `Draft candidate generator must return exactly ${DRAFT_OFFER_SIZE} operators.`,
    )
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

export function generateDraftOffer(
  pool: readonly Operator[],
  state: DraftState,
  options: DraftEngineOptions,
  configuration: ResolvedDraftConfiguration,
): { ids: string[]; pullsSinceSixStar: number } | null {
  const candidates = availableDraftOperators(pool, state)
  if (candidates.length < DRAFT_OFFER_SIZE) return null

  const random = options.random ?? Math.random
  if (options.candidateGenerator) {
    const offer = options.candidateGenerator(candidates, DRAFT_OFFER_SIZE, random)
    validateGeneratedOffer(offer, candidates)
    return {
      ids: offer.map((operator) => operator.id),
      pullsSinceSixStar: state.pullsSinceSixStar,
    }
  }

  if (configuration.pullDistribution.type === 'equal') {
    const offer = generateEqualOpportunityCandidates(candidates, DRAFT_OFFER_SIZE, random)
    validateGeneratedOffer(offer, candidates)
    return {
      ids: offer.map((operator) => operator.id),
      pullsSinceSixStar: state.pullsSinceSixStar,
    }
  }

  const generated = generateDraftDistributionCandidates(
    candidates,
    DRAFT_OFFER_SIZE,
    configuration.pullDistribution,
    { pullsSinceSixStar: state.pullsSinceSixStar },
    random,
  )
  validateGeneratedOffer(generated.operators, candidates)
  return {
    ids: generated.operators.map((operator) => operator.id),
    pullsSinceSixStar: generated.state.pullsSinceSixStar,
  }
}
