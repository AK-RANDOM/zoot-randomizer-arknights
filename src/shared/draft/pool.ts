import type { Operator } from '../operator'
import type { DraftState } from './types'

export function validateDraftTargetSize(targetSize: number): void {
  if (!Number.isInteger(targetSize) || targetSize < 1) {
    throw new Error('Draft target size must be a positive integer.')
  }
}

export function uniqueDraftOperatorsById(operators: readonly Operator[]): Operator[] {
  const seen = new Set<string>()
  return operators.filter((operator) => {
    if (seen.has(operator.id)) return false
    seen.add(operator.id)
    return true
  })
}

export function availableDraftOperators(
  pool: readonly Operator[],
  state: Pick<DraftState, 'draftedOperatorIds' | 'discardedOperatorIds' | 'heldOperatorId'>,
): Operator[] {
  const unavailable = new Set([...state.draftedOperatorIds, ...state.discardedOperatorIds])
  if (state.heldOperatorId) unavailable.add(state.heldOperatorId)
  return uniqueDraftOperatorsById(pool).filter((operator) => !unavailable.has(operator.id))
}

export function createDraftPoolKey(pool: readonly Operator[], targetSize: number): string {
  validateDraftTargetSize(targetSize)
  return JSON.stringify([
    targetSize,
    ...uniqueDraftOperatorsById(pool)
      .map((operator) => operator.id)
      .sort(),
  ])
}

export function assertDraftPoolIdentity(state: DraftState, pool: readonly Operator[]): void {
  if (createDraftPoolKey(pool, state.targetSize) !== state.poolKey) {
    throw new Error('Draft pool or target size changed after this draft started.')
  }
}

export function draftOperatorById(pool: readonly Operator[], operatorId: string): Operator {
  const operator = pool.find((candidate) => candidate.id === operatorId)
  if (!operator) {
    throw new Error(`Draft operator ${operatorId} is not in the eligible pool.`)
  }
  return operator
}
