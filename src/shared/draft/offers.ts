import type { Operator } from '../operator'
import { generateDraftDistributionCandidates } from '../draftDistribution'
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
  const candidates = availableDraftOperators(pool, state)
  const offerSize = configuration.offerSize
  if (candidates.length < offerSize) return null

  const random = options.random ?? Math.random
  if (options.candidateGenerator) {
    const offer = options.candidateGenerator(candidates, offerSize, random)
    validateGeneratedOffer(offer, candidates, offerSize)
    return {
      ids: offer.map((operator) => operator.id),
      pullsSinceSixStar: state.pullsSinceSixStar,
      generatedCandidateCount: state.generatedCandidateCount,
      actualFiveStarGeneratedInFirstTen: state.actualFiveStarGeneratedInFirstTen,
    }
  }

  if (configuration.pullDistribution.type === 'equal') {
    const offer = generateEqualOpportunityCandidates(candidates, offerSize, random)
    validateGeneratedOffer(offer, candidates, offerSize)
    return {
      ids: offer.map((operator) => operator.id),
      pullsSinceSixStar: state.pullsSinceSixStar,
      generatedCandidateCount: state.generatedCandidateCount,
      actualFiveStarGeneratedInFirstTen: state.actualFiveStarGeneratedInFirstTen,
    }
  }

  const generated = generateDraftDistributionCandidates(
    candidates,
    offerSize,
    configuration.pullDistribution,
    {
      pullsSinceSixStar: state.pullsSinceSixStar,
      generatedCandidateCount: state.generatedCandidateCount,
      actualFiveStarGeneratedInFirstTen: state.actualFiveStarGeneratedInFirstTen,
    },
    random,
  )
  validateGeneratedOffer(generated.operators, candidates, offerSize)
  return {
    ids: generated.operators.map((operator) => operator.id),
    pullsSinceSixStar: generated.state.pullsSinceSixStar,
    generatedCandidateCount: generated.state.generatedCandidateCount ?? state.generatedCandidateCount,
    actualFiveStarGeneratedInFirstTen:
      generated.state.actualFiveStarGeneratedInFirstTen ?? state.actualFiveStarGeneratedInFirstTen,
  }
}
