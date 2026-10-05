import type { Operator } from '../operator'
import { evaluateDraftActionWithConfiguration } from './actions'
import { maxAttainableDraftCapacity } from './capacity'
import { resolveDraftEngineConfiguration, validateDraftConfiguration } from './config'
import {
  getDraftActionPointDeltaWithConfiguration,
  isDraftHoldUpkeepDue,
} from './economy'
import { generateDraftOffer } from './offers'
import { assertDraftPoolIdentity, createDraftPoolKey } from './pool'
import type {
  DraftAction,
  DraftActionType,
  DraftActionUsageMap,
  DraftCompletionReason,
  DraftEngineOptions,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'

function emptyUsage(): DraftActionUsageMap {
  return {
    pick: { total: 0, round: 0, lastUsedRound: null },
    forfeit: { total: 0, round: 0, lastUsedRound: null },
    hold: { total: 0, round: 0, lastUsedRound: null },
    'release-hold': { total: 0, round: 0, lastUsedRound: null },
    reroll: { total: 0, round: 0, lastUsedRound: null },
    'slot-expansion': { total: 0, round: 0, lastUsedRound: null },
  }
}

function resetRoundUsage(usage: DraftActionUsageMap): DraftActionUsageMap {
  return Object.fromEntries(
    Object.entries(usage).map(([action, value]) => [action, { ...value, round: 0 }]),
  ) as DraftActionUsageMap
}

function recordAction(state: DraftState, action: DraftActionType): DraftActionUsageMap {
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

function completeState(state: DraftState, reason: DraftCompletionReason): DraftState {
  return {
    ...state,
    currentOfferIds: [],
    status: 'complete',
    completionReason: reason,
  }
}

function appendDiscarded(current: readonly string[], additions: readonly string[]): string[] {
  return [...new Set([...current, ...additions])]
}

function beginNextRound(
  state: DraftState,
  pool: readonly Operator[],
  options: DraftEngineOptions,
  configuration: ResolvedDraftConfiguration,
): DraftState {
  if (state.draftedOperatorIds.length >= state.targetSize) {
    return completeState(
      { ...state, completedRounds: state.completedRounds + 1 },
      'squad-size-reached',
    )
  }

  if (
    configuration.capacityRules.enabled &&
    state.draftedOperatorIds.length >=
      maxAttainableDraftCapacity(state, configuration.capacityRules)
  ) {
    return completeState(
      { ...state, completedRounds: state.completedRounds + 1 },
      'capacity-exhausted',
    )
  }

  const nextBase: DraftState = {
    ...state,
    roundNumber: state.roundNumber + 1,
    completedRounds: state.completedRounds + 1,
    actionUsage: resetRoundUsage(state.actionUsage),
    currentOfferIds: [],
  }
  const offer = generateDraftOffer(pool, nextBase, options, configuration)
  if (!offer) {
    return completeState(
      { ...nextBase, roundNumber: state.roundNumber },
      'pool-exhausted',
    )
  }
  return {
    ...nextBase,
    currentOfferIds: offer.ids,
    pullsSinceSixStar: offer.pullsSinceSixStar,
    status: 'active',
    completionReason: null,
  }
}

export function startDraft(
  pool: readonly Operator[],
  targetSize: number,
  options: DraftEngineOptions = {},
): DraftState {
  const configuration = resolveDraftEngineConfiguration(options)
  validateDraftConfiguration(configuration)

  const capacity = configuration.capacityRules
  const economy = configuration.economyRules
  const activeCapacity = capacity.enabled
    ? Math.min(targetSize, capacity.startingActiveSlots)
    : targetSize
  const overflowCapacity = capacity.enabled
    ? Math.max(0, Math.min(capacity.overflowSlots, targetSize - activeCapacity))
    : 0

  const base: DraftState = {
    targetSize,
    poolKey: createDraftPoolKey(pool, targetSize),
    draftedOperatorIds: [],
    currentOfferIds: [],
    discardedOperatorIds: [],
    heldOperatorId: null,
    holdUpkeepCharges: 0,
    roundNumber: 1,
    completedRounds: 0,
    capacityExpansionCount: 0,
    activeCapacity,
    overflowCapacity,
    forfeitedCapacityCount: 0,
    capacityRulesEnabled: capacity.enabled,
    points: economy.enabled ? economy.startingPoints : 0,
    economyRulesEnabled: economy.enabled,
    pullsSinceSixStar: 0,
    actionUsage: emptyUsage(),
    status: 'active',
    completionReason: null,
  }

  const offer = generateDraftOffer(pool, base, options, configuration)
  return offer
    ? { ...base, currentOfferIds: offer.ids, pullsSinceSixStar: offer.pullsSinceSixStar }
    : completeState(base, 'pool-exhausted')
}

export function applyDraftAction(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  options: DraftEngineOptions = {},
): DraftState {
  assertDraftPoolIdentity(state, pool)
  const configuration = resolveDraftEngineConfiguration(options)
  validateDraftConfiguration(configuration)

  const availability = evaluateDraftActionWithConfiguration(
    state,
    pool,
    action,
    configuration,
  )
  if (!availability.available) {
    throw new Error(`Draft action ${action.type} is unavailable: ${availability.reason}.`)
  }

  const actionUsage = recordAction(state, action.type)
  const upkeepDue = isDraftHoldUpkeepDue(state, action, configuration)
  const points =
    state.points + getDraftActionPointDeltaWithConfiguration(pool, action, configuration, state)
  const { actionRules, capacityRules } = configuration

  switch (action.type) {
    case 'pick': {
      if (state.draftedOperatorIds.includes(action.operatorId)) {
        throw new Error(`Operator ${action.operatorId} has already been drafted.`)
      }
      const fromHold = state.heldOperatorId === action.operatorId
      return beginNextRound(
        {
          ...state,
          draftedOperatorIds: [...state.draftedOperatorIds, action.operatorId],
          heldOperatorId: fromHold ? null : state.heldOperatorId,
          holdUpkeepCharges: fromHold
            ? 0
            : state.holdUpkeepCharges + (upkeepDue ? 1 : 0),
          points,
          actionUsage,
        },
        pool,
        options,
        configuration,
      )
    }
    case 'hold': {
      const discarded = actionRules.hold.discardUnheldOffer
        ? appendDiscarded(
            state.discardedOperatorIds,
            state.currentOfferIds.filter((id) => id !== action.operatorId),
          )
        : state.discardedOperatorIds
      return beginNextRound(
        {
          ...state,
          heldOperatorId: action.operatorId,
          holdUpkeepCharges: 0,
          discardedOperatorIds: discarded,
          points,
          actionUsage,
        },
        pool,
        options,
        configuration,
      )
    }
    case 'release-hold':
      return { ...state, heldOperatorId: null, holdUpkeepCharges: 0, points, actionUsage }
    case 'forfeit': {
      const discarded = actionRules.forfeit.discardOffer
        ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds)
        : state.discardedOperatorIds
      return beginNextRound(
        {
          ...state,
          discardedOperatorIds: discarded,
          holdUpkeepCharges: state.holdUpkeepCharges + (upkeepDue ? 1 : 0),
          forfeitedCapacityCount: capacityRules.enabled
            ? state.forfeitedCapacityCount + 1
            : state.forfeitedCapacityCount,
          points,
          actionUsage,
        },
        pool,
        options,
        configuration,
      )
    }
    case 'reroll': {
      const discarded = actionRules.reroll.discardOffer
        ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds)
        : state.discardedOperatorIds
      const next: DraftState = {
        ...state,
        discardedOperatorIds: discarded,
        points,
        actionUsage,
        currentOfferIds: [],
      }
      const offer = generateDraftOffer(pool, next, options, configuration)
      return offer
        ? {
            ...next,
            currentOfferIds: offer.ids,
            pullsSinceSixStar: offer.pullsSinceSixStar,
          }
        : completeState(next, 'pool-exhausted')
    }
    case 'slot-expansion':
      return {
        ...state,
        activeCapacity: capacityRules.enabled
          ? state.activeCapacity + 1
          : state.activeCapacity,
        capacityExpansionCount: state.capacityExpansionCount + 1,
        points,
        actionUsage,
      }
  }
}

export function pickDraftOperator(
  state: DraftState,
  pool: readonly Operator[],
  operatorId: string,
  options: DraftEngineOptions = {},
): DraftState {
  return applyDraftAction(state, pool, { type: 'pick', operatorId }, options)
}
