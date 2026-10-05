import type { Operator } from '../operator'
import { currentDraftOwnershipCapacity } from './capacity'
import { resolveDraftEngineConfiguration } from './config'
import { getDraftActionPointDeltaWithConfiguration } from './economy'
import type {
  DraftAction,
  DraftActionAvailability,
  DraftActionType,
  DraftEngineOptions,
  DraftLimitedActionRules,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'

function actionRule(
  action: DraftActionType,
  configuration: ResolvedDraftConfiguration,
): DraftLimitedActionRules | null {
  switch (action) {
    case 'pick':
    case 'release-hold':
      return null
    case 'hold':
      return configuration.actionRules.hold
    case 'forfeit':
      return configuration.actionRules.forfeit
    case 'reroll':
      return configuration.actionRules.reroll
    case 'slot-expansion':
      return configuration.actionRules.slotExpansion
  }
}

export function evaluateDraftActionWithConfiguration(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): DraftActionAvailability {
  if (state.status !== 'active') {
    return { available: false, reason: 'draft-complete' }
  }

  const selectingCurrent =
    (action.type === 'pick' || action.type === 'hold') &&
    state.currentOfferIds.includes(action.operatorId)
  const selectingHeld = action.type === 'pick' && state.heldOperatorId === action.operatorId
  if ((action.type === 'pick' || action.type === 'hold') && !selectingCurrent && !selectingHeld) {
    return { available: false, reason: 'invalid-offer-selection' }
  }
  if (action.type === 'hold' && state.heldOperatorId !== null) {
    return { available: false, reason: 'hold-slot-occupied' }
  }
  if (action.type === 'release-hold' && state.heldOperatorId === null) {
    return { available: false, reason: 'hold-slot-empty' }
  }

  const capacity = configuration.capacityRules
  if (
    action.type === 'pick' &&
    capacity.enabled &&
    state.draftedOperatorIds.length >= currentDraftOwnershipCapacity(state)
  ) {
    return { available: false, reason: 'capacity-full' }
  }
  if (
    action.type === 'forfeit' &&
    capacity.enabled &&
    currentDraftOwnershipCapacity(state) <= state.draftedOperatorIds.length
  ) {
    return { available: false, reason: 'capacity-forfeit-unavailable' }
  }
  if (
    action.type === 'slot-expansion' &&
    capacity.enabled &&
    state.activeCapacity >= Math.min(state.targetSize, capacity.maxActiveSlots)
  ) {
    return { available: false, reason: 'capacity-maxed' }
  }

  if (state.economyRulesEnabled) {
    const delta = getDraftActionPointDeltaWithConfiguration(pool, action, configuration)
    if (delta < 0 && state.points + delta < 0) {
      return { available: false, reason: 'insufficient-points' }
    }
  }

  const rule = actionRule(action.type, configuration)
  if (!rule) return { available: true, reason: null }
  if (!rule.enabled) return { available: false, reason: 'action-disabled' }

  const usage = state.actionUsage[action.type]
  if (rule.perRoundLimit !== null && usage.round >= rule.perRoundLimit) {
    return { available: false, reason: 'per-round-limit' }
  }
  if (rule.perDraftLimit !== null && usage.total >= rule.perDraftLimit) {
    return { available: false, reason: 'per-draft-limit' }
  }
  if (
    usage.lastUsedRound !== null &&
    state.roundNumber - usage.lastUsedRound <= rule.cooldownRounds
  ) {
    return { available: false, reason: 'cooldown' }
  }
  return { available: true, reason: null }
}

/** Canonical pool-aware preflight used by both UI callers and execution. */
export function evaluateDraftAction(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  options: DraftEngineOptions = {},
): DraftActionAvailability {
  return evaluateDraftActionWithConfiguration(
    state,
    pool,
    action,
    resolveDraftEngineConfiguration(options),
  )
}

/**
 * Compatibility wrapper for the pre-M2 call shape. Economy-enabled callers should
 * supply `pool`, or use `evaluateDraftAction` directly.
 */
export function getDraftActionAvailability(
  state: DraftState,
  action: DraftAction,
  options: Pick<
    DraftEngineOptions,
    'configuration' | 'actionRules' | 'capacityRules' | 'economyRules' | 'pullDistribution'
  > = {},
  pool?: readonly Operator[],
): DraftActionAvailability {
  const configuration = resolveDraftEngineConfiguration(options)
  if (state.economyRulesEnabled && action.type === 'pick' && !pool) {
    throw new Error(
      'Draft action availability requires the eligible pool for economy-enabled picks.',
    )
  }
  return evaluateDraftActionWithConfiguration(state, pool ?? [], action, configuration)
}
