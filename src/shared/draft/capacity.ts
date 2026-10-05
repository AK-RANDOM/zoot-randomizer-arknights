import type { DraftCapacityRules, DraftState } from './types'

export function currentDraftOwnershipCapacity(state: DraftState): number {
  return state.capacityRulesEnabled
    ? Math.max(
        0,
        Math.min(
          state.targetSize,
          state.activeCapacity + state.overflowCapacity - state.forfeitedCapacityCount,
        ),
      )
    : state.targetSize
}

export function maxAttainableDraftCapacity(
  state: DraftState,
  rules: DraftCapacityRules,
): number {
  return rules.enabled
    ? Math.max(
        0,
        Math.min(
          state.targetSize,
          rules.maxActiveSlots + state.overflowCapacity - state.forfeitedCapacityCount,
        ),
      )
    : state.targetSize
}
