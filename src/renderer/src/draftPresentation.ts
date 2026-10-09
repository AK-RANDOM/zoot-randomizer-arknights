import {
  currentDraftOwnershipCapacity,
  evaluateDraftAction,
  getDraftActionPointDelta,
  getDraftHoldUpkeepCostWithConfiguration,
  getDraftOperatorCostForStateWithConfiguration,
  type DraftAction,
  type DraftActionBlockReason,
  type DraftState,
  type ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator } from '../../shared/operator'

export type DraftEconomyTone = 'rebate' | 'neutral' | 'cost'

export interface DraftEconomyValuePresentation {
  /** Signed domain value. Negative is a cost, positive is a rebate to the player. */
  pointDelta: number
  /** Absolute display value used by the compact Draft UI. */
  amount: number
  tone: DraftEconomyTone
}

export interface DraftActionPresentation {
  action: DraftAction
  available: boolean
  blockReason: DraftActionBlockReason | null
  blockReasonLabel: string | null
  economy: DraftEconomyValuePresentation
}

export interface DraftOperatorPresentation {
  operatorId: string
  resolvedCost: number | null
  price: DraftEconomyValuePresentation | null
  pick: DraftActionPresentation
  hold: DraftActionPresentation | null
}

export interface DraftHoldPresentation {
  operatorId: string
  currentUpkeep: DraftEconomyValuePresentation
}

export interface DraftCapacityPresentation {
  effectivePermanent: number
  overflow: number
  ownership: number
  maximum: number
  label: string
}

export interface DraftStatusPresentation {
  roundNumber: number | null
  selectedCount: number
  targetSize: number
  points: number | null
  capacity: DraftCapacityPresentation
}

const actionReasonLabels: Record<DraftActionBlockReason, string> = {
  'draft-complete': 'Draft is complete.',
  'action-disabled': 'This action is disabled by the Draft Rulebook.',
  'invalid-offer-selection': 'This operator is not available for that action.',
  'hold-slot-occupied': 'The Hold slot is already occupied.',
  'hold-slot-empty': 'The Hold slot is empty.',
  'per-round-limit': 'The per-round action limit has been reached.',
  'per-draft-limit': 'The per-draft action limit has been reached.',
  cooldown: 'This action is still on cooldown.',
  'capacity-full': 'Owned capacity is full.',
  'capacity-maxed': 'Active capacity is already at its maximum.',
  'capacity-forfeit-unavailable': 'No unused capacity remains to forfeit.',
  'insufficient-points': 'Not enough points.',
}

export function draftEconomyValue(pointDelta: number): DraftEconomyValuePresentation {
  return {
    pointDelta,
    amount: Math.abs(pointDelta),
    tone: pointDelta > 0 ? 'rebate' : pointDelta < 0 ? 'cost' : 'neutral',
  }
}

export function resolveDraftActionPresentation(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): DraftActionPresentation {
  const availability = evaluateDraftAction(state, pool, action, { configuration })
  const pointDelta = getDraftActionPointDelta(pool, action, { configuration }, state)

  return {
    action,
    available: availability.available,
    blockReason: availability.reason,
    blockReasonLabel: availability.reason ? actionReasonLabels[availability.reason] : null,
    economy: draftEconomyValue(pointDelta),
  }
}

export function resolveDraftOperatorPresentation(
  state: DraftState,
  pool: readonly Operator[],
  operator: Operator,
  configuration: ResolvedDraftConfiguration,
): DraftOperatorPresentation {
  const resolvedCost = state.economyRulesEnabled
    ? getDraftOperatorCostForStateWithConfiguration(operator, state, configuration)
    : null
  const pick = resolveDraftActionPresentation(
    state,
    pool,
    { type: 'pick', operatorId: operator.id },
    configuration,
  )
  const hold = configuration.actionRules.hold.enabled
    ? resolveDraftActionPresentation(
        state,
        pool,
        { type: 'hold', operatorId: operator.id },
        configuration,
      )
    : null

  // Operator price is intentionally independent from the total Pick action delta.
  // A Pick can also carry an existing Hold forward and pay upkeep; that upkeep belongs
  // to the action/session presentation rather than being folded into this card price.
  return {
    operatorId: operator.id,
    resolvedCost,
    price: resolvedCost === null ? null : draftEconomyValue(-resolvedCost),
    pick,
    hold,
  }
}

export function resolveDraftHoldPresentation(
  state: DraftState,
  configuration: ResolvedDraftConfiguration,
): DraftHoldPresentation | null {
  if (!state.heldOperatorId) return null
  const upkeepCost = getDraftHoldUpkeepCostWithConfiguration(state, configuration)
  return {
    operatorId: state.heldOperatorId,
    currentUpkeep: draftEconomyValue(-upkeepCost),
  }
}

export function resolveDraftStatusPresentation(
  state: DraftState | null,
  targetSize: number,
): DraftStatusPresentation {
  if (!state) {
    return {
      roundNumber: null,
      selectedCount: 0,
      targetSize,
      points: null,
      capacity: {
        effectivePermanent: targetSize,
        overflow: 0,
        ownership: targetSize,
        maximum: targetSize,
        label: `${targetSize} / ${targetSize}`,
      },
    }
  }

  const ownership = currentDraftOwnershipCapacity(state)
  const configuredOverflow = state.capacityRulesEnabled ? Math.max(0, state.overflowCapacity) : 0
  const overflow = Math.min(configuredOverflow, ownership)
  const effectivePermanent = Math.max(0, ownership - overflow)
  const capacityCore =
    overflow > 0 ? `${effectivePermanent}+${overflow}` : String(effectivePermanent)

  return {
    roundNumber: state.roundNumber,
    selectedCount: state.draftedOperatorIds.length,
    targetSize: state.targetSize,
    points: state.economyRulesEnabled ? state.points : null,
    capacity: {
      effectivePermanent,
      overflow,
      ownership,
      maximum: state.targetSize,
      label: `${capacityCore} / ${state.targetSize}`,
    },
  }
}
