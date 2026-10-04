import type { Operator } from './operator'

export const DRAFT_OFFER_SIZE = 3 as const

export type DraftRandomSource = () => number

/**
 * Candidate generation is intentionally replaceable so later pull-distribution
 * rules can change offer composition without changing the draft lifecycle.
 */
export type DraftCandidateGenerator = (
  candidates: readonly Operator[],
  count: number,
  random: DraftRandomSource,
) => readonly Operator[]

export type DraftStatus = 'active' | 'complete'
export type DraftCompletionReason = 'squad-size-reached' | 'pool-exhausted'

export interface DraftState {
  targetSize: number
  /** Stable identity of the eligible pool + target size for this draft session. */
  poolKey: string
  draftedOperatorIds: string[]
  currentOfferIds: string[]
  status: DraftStatus
  completionReason: DraftCompletionReason | null
}

export interface DraftEngineOptions {
  candidateGenerator?: DraftCandidateGenerator
  random?: DraftRandomSource
}

function uniqueOperatorsById(operators: readonly Operator[]): Operator[] {
  const seen = new Set<string>()
  const unique: Operator[] = []

  for (const operator of operators) {
    if (seen.has(operator.id)) continue
    seen.add(operator.id)
    unique.push(operator)
  }

  return unique
}

function availableOperators(
  pool: readonly Operator[],
  draftedOperatorIds: readonly string[],
): Operator[] {
  const drafted = new Set(draftedOperatorIds)
  return uniqueOperatorsById(pool).filter((operator) => !drafted.has(operator.id))
}

function validateTargetSize(targetSize: number): void {
  if (!Number.isInteger(targetSize) || targetSize < 1) {
    throw new Error('Draft target size must be a positive integer.')
  }
}

/**
 * Stable identity for a Draft session. Pool order does not matter, duplicate IDs
 * are ignored, and changing either the eligible IDs or target size changes the key.
 */
export function createDraftPoolKey(
  pool: readonly Operator[],
  targetSize: number,
): string {
  validateTargetSize(targetSize)
  const ids = uniqueOperatorsById(pool)
    .map((operator) => operator.id)
    .sort()
  return JSON.stringify([targetSize, ...ids])
}

function validateGeneratedOffer(
  offer: readonly Operator[],
  candidates: readonly Operator[],
): void {
  if (offer.length !== DRAFT_OFFER_SIZE) {
    throw new Error(`Draft candidate generator must return exactly ${DRAFT_OFFER_SIZE} operators.`)
  }

  const candidateIds = new Set(candidates.map((operator) => operator.id))
  const seen = new Set<string>()

  for (const operator of offer) {
    if (!candidateIds.has(operator.id)) {
      throw new Error(`Draft candidate generator returned ineligible operator ${operator.id}.`)
    }
    if (seen.has(operator.id)) {
      throw new Error(`Draft candidate generator returned duplicate operator ${operator.id}.`)
    }
    seen.add(operator.id)
  }
}

function randomOffset(random: DraftRandomSource, range: number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  }
  return Math.floor(value * range)
}

/**
 * Equal Opportunity candidate selection: every remaining operator has the
 * same chance to occupy each offer slot. Sampling is without replacement.
 */
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
    const swapIndex = index + randomOffset(random, shuffled.length - index)
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled.slice(0, count)
}

function advanceDraft(
  pool: readonly Operator[],
  targetSize: number,
  poolKey: string,
  draftedOperatorIds: string[],
  options: DraftEngineOptions,
): DraftState {
  if (draftedOperatorIds.length >= targetSize) {
    return {
      targetSize,
      poolKey,
      draftedOperatorIds,
      currentOfferIds: [],
      status: 'complete',
      completionReason: 'squad-size-reached',
    }
  }

  const candidates = availableOperators(pool, draftedOperatorIds)
  if (candidates.length < DRAFT_OFFER_SIZE) {
    return {
      targetSize,
      poolKey,
      draftedOperatorIds,
      currentOfferIds: [],
      status: 'complete',
      completionReason: 'pool-exhausted',
    }
  }

  const candidateGenerator = options.candidateGenerator ?? generateEqualOpportunityCandidates
  const random = options.random ?? Math.random
  const offer = candidateGenerator(candidates, DRAFT_OFFER_SIZE, random)
  validateGeneratedOffer(offer, candidates)

  return {
    targetSize,
    poolKey,
    draftedOperatorIds,
    currentOfferIds: offer.map((operator) => operator.id),
    status: 'active',
    completionReason: null,
  }
}

export function startDraft(
  pool: readonly Operator[],
  targetSize: number,
  options: DraftEngineOptions = {},
): DraftState {
  const poolKey = createDraftPoolKey(pool, targetSize)
  return advanceDraft(pool, targetSize, poolKey, [], options)
}

export function pickDraftOperator(
  state: DraftState,
  pool: readonly Operator[],
  operatorId: string,
  options: DraftEngineOptions = {},
): DraftState {
  if (state.status !== 'active') {
    throw new Error('Cannot pick an operator from a completed draft.')
  }

  if (createDraftPoolKey(pool, state.targetSize) !== state.poolKey) {
    throw new Error('Draft pool or target size changed after this draft started.')
  }

  if (!state.currentOfferIds.includes(operatorId)) {
    throw new Error(`Operator ${operatorId} is not in the current draft offer.`)
  }

  if (state.draftedOperatorIds.includes(operatorId)) {
    throw new Error(`Operator ${operatorId} has already been drafted.`)
  }

  return advanceDraft(
    pool,
    state.targetSize,
    state.poolKey,
    [...state.draftedOperatorIds, operatorId],
    options,
  )
}
