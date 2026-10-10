import type { Operator } from '../operator'
import { currentDraftOwnershipCapacity, maxAttainableDraftCapacity } from './capacity'
import { resolveDraftEngineConfiguration } from './config'
import { draftActionCarriesHoldForward, getDraftActionPointDeltaWithConfiguration } from './economy'
import type {
  DraftAction,
  DraftActionAvailability,
  DraftActionPreflight,
  DraftActionUsageMap,
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
    const delta = getDraftActionPointDeltaWithConfiguration(pool, action, configuration, state)
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

export function getDraftActionAvailability(
  state: DraftState,
  action: DraftAction,
  options: Pick<
    DraftEngineOptions,
    'configuration' | 'offerSize' | 'maxRounds' | 'actionRules' | 'capacityRules' | 'economyRules' | 'pullDistribution' | 'interactions'
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

function resetProjectedRoundUsage(usage: DraftActionUsageMap): DraftActionUsageMap {
  return Object.fromEntries(
    Object.entries(usage).map(([action, value]) => [action, { ...value, round: 0 }]),
  ) as DraftActionUsageMap
}

function recordProjectedAction(state: DraftState, action: DraftActionType): DraftActionUsageMap {
  const usage = state.actionUsage[action]
  return {
    ...state.actionUsage,
    [action]: {
      total: usage.total + 1,
      round: usage.round + 1,
      lastUsedRound: state.roundNumber,
    },
  }
}

function projectedStateAfterAction(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): DraftState {
  const points =
    state.points + getDraftActionPointDeltaWithConfiguration(pool, action, configuration, state)
  const recordedUsage = recordProjectedAction(state, action.type)
  const carriesHoldForward = draftActionCarriesHoldForward(state, action)
  const holdUpkeepCharges = state.holdUpkeepCharges + (carriesHoldForward ? 1 : 0)
  const advanceRound = (next: DraftState): DraftState => ({
    ...next,
    roundNumber: state.roundNumber + 1,
    completedRounds: state.completedRounds + 1,
    currentOfferIds: [],
    actionUsage: resetProjectedRoundUsage(recordedUsage),
  })

  switch (action.type) {
    case 'pick': {
      const fromHold = state.heldOperatorId === action.operatorId
      return advanceRound({
        ...state,
        draftedOperatorIds: [...state.draftedOperatorIds, action.operatorId],
        heldOperatorId: fromHold ? null : state.heldOperatorId,
        holdUpkeepCharges: fromHold ? 0 : holdUpkeepCharges,
        points,
        actionUsage: recordedUsage,
      })
    }
    case 'hold':
      return advanceRound({
        ...state,
        heldOperatorId: action.operatorId,
        holdUpkeepCharges: 0,
        points,
        actionUsage: recordedUsage,
      })
    case 'forfeit':
      return advanceRound({
        ...state,
        forfeitedCapacityCount: configuration.capacityRules.enabled
          ? state.forfeitedCapacityCount + 1
          : state.forfeitedCapacityCount,
        holdUpkeepCharges,
        points,
        actionUsage: recordedUsage,
      })
    case 'release-hold':
      return { ...state, heldOperatorId: null, holdUpkeepCharges: 0, points, actionUsage: recordedUsage }
    case 'reroll':
      return { ...state, currentOfferIds: [], points, actionUsage: recordedUsage }
    case 'slot-expansion':
      return {
        ...state,
        activeCapacity: configuration.capacityRules.enabled ? state.activeCapacity + 1 : state.activeCapacity,
        capacityExpansionCount: state.capacityExpansionCount + 1,
        points,
        actionUsage: recordedUsage,
      }
  }
}

function hasAvailableCandidateAction(
  state: DraftState,
  pool: readonly Operator[],
  configuration: ResolvedDraftConfiguration,
  type: 'pick' | 'hold',
): boolean {
  const candidateIds =
    type === 'pick' && state.heldOperatorId
      ? [...state.currentOfferIds, state.heldOperatorId]
      : state.currentOfferIds
  return candidateIds.some(
    (operatorId) =>
      evaluateDraftActionWithConfiguration(state, pool, { type, operatorId }, configuration).available,
  )
}

export function hasDraftValidContinuationWithConfiguration(
  state: DraftState,
  pool: readonly Operator[],
  configuration: ResolvedDraftConfiguration,
): boolean {
  if (state.status !== 'active') return false
  if (hasAvailableCandidateAction(state, pool, configuration, 'pick')) return true
  if (evaluateDraftActionWithConfiguration(state, pool, { type: 'forfeit' }, configuration).available) return true
  if (evaluateDraftActionWithConfiguration(state, pool, { type: 'slot-expansion' }, configuration).available) return true

  const ownershipFull =
    configuration.capacityRules.enabled &&
    state.draftedOperatorIds.length >= currentDraftOwnershipCapacity(state)
  if (ownershipFull) return false
  if (hasAvailableCandidateAction(state, pool, configuration, 'hold')) return true
  if (evaluateDraftActionWithConfiguration(state, pool, { type: 'reroll' }, configuration).available) return true
  if (evaluateDraftActionWithConfiguration(state, pool, { type: 'release-hold' }, configuration).available) return true
  return false
}

export function hasDraftValidContinuation(
  state: DraftState,
  pool: readonly Operator[],
  options: DraftEngineOptions = {},
): boolean {
  return hasDraftValidContinuationWithConfiguration(
    state,
    pool,
    resolveDraftEngineConfiguration(options),
  )
}

function isGuaranteedNoValidMoveAfterAction(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): boolean {
  const projected = projectedStateAfterAction(state, pool, action, configuration)
  if (projected.draftedOperatorIds.length >= projected.targetSize) return false
  if (
    configuration.maxRounds !== null &&
    (action.type === 'pick' || action.type === 'hold' || action.type === 'forfeit') &&
    state.roundNumber >= configuration.maxRounds
  ) return false
  if (
    configuration.capacityRules.enabled &&
    projected.draftedOperatorIds.length >= maxAttainableDraftCapacity(projected, configuration.capacityRules)
  ) return false

  const roundEnding = action.type === 'pick' || action.type === 'hold' || action.type === 'forfeit'
  if (!roundEnding && action.type !== 'reroll') {
    return !hasDraftValidContinuationWithConfiguration(projected, pool, configuration)
  }

  const ownershipFull =
    configuration.capacityRules.enabled &&
    projected.draftedOperatorIds.length >= currentDraftOwnershipCapacity(projected)
  if (!ownershipFull) return false

  const canForfeit = evaluateDraftActionWithConfiguration(
    projected,
    pool,
    { type: 'forfeit' },
    configuration,
  ).available
  const canExpand = evaluateDraftActionWithConfiguration(
    projected,
    pool,
    { type: 'slot-expansion' },
    configuration,
  ).available
  return !canForfeit && !canExpand
}

export function evaluateDraftActionPreflightWithConfiguration(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): DraftActionPreflight {
  const availability = evaluateDraftActionWithConfiguration(state, pool, action, configuration)
  if (!availability.available) {
    return { ...availability, terminalAfterAction: false, terminalReason: null }
  }
  const terminalAfterAction = isGuaranteedNoValidMoveAfterAction(state, pool, action, configuration)
  return {
    ...availability,
    terminalAfterAction,
    terminalReason: terminalAfterAction ? 'no-valid-move' : null,
  }
}

export function evaluateDraftActionPreflight(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  options: DraftEngineOptions = {},
): DraftActionPreflight {
  return evaluateDraftActionPreflightWithConfiguration(
    state,
    pool,
    action,
    resolveDraftEngineConfiguration(options),
  )
}
