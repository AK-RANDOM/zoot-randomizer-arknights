import type { Operator } from '../../shared/operator'
import type { Garrison } from '../../shared/garrison'

export interface GarrisonDispatchRequest {
  mode: 'standard' | 'draft'
  stageName: string
  excludedOperatorIds: readonly string[]
  onConfirm: (operatorIds: readonly string[]) => boolean
}

export interface GarrisonDispatchControls {
  stageName: string
  onConfirm: (operatorIds: readonly string[]) => void
  onCancel: () => void
}

/** The stage being replaced does not reserve its own operators. */
export function garrisonDispatchExclusions(garrison: Garrison, stageId: string): string[] {
  if (garrison.duplicateOperatorsAllowed) return []
  return [
    ...new Set(
      garrison.stages.filter((stage) => stage.id !== stageId).flatMap((stage) => stage.operatorIds),
    ),
  ]
}

export function garrisonDispatchPool(
  pool: readonly Operator[],
  excludedOperatorIds: readonly string[],
): Operator[] {
  const excluded = new Set(excludedOperatorIds)
  return pool.filter((operator) => !excluded.has(operator.id))
}
