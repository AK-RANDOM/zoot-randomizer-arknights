import type { Operator } from '../operator'
import { resolveDraftEngineConfiguration } from './config'
import { getDraftInteractionCostModifierWithConfiguration } from './interactions'
import { draftOperatorById } from './pool'
import type {
  DraftAction,
  DraftEngineOptions,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'

export function getDraftOperatorCost(
  operator: Operator,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'interactions'> = {},
): number {
  const economy = resolveDraftEngineConfiguration(options).economyRules
  return economy.operatorCostOverrides[operator.id] ?? economy.rarityCosts[operator.rarity] ?? 0
}

export function getDraftOperatorCostWithConfiguration(
  operator: Operator,
  configuration: ResolvedDraftConfiguration,
): number {
  const economy = configuration.economyRules
  return economy.operatorCostOverrides[operator.id] ?? economy.rarityCosts[operator.rarity] ?? 0
}

export function getDraftOperatorCostForStateWithConfiguration(
  operator: Operator,
  state: Pick<DraftState, 'draftedOperatorIds'>,
  configuration: ResolvedDraftConfiguration,
): number {
  return (
    getDraftOperatorCostWithConfiguration(operator, configuration) +
    getDraftInteractionCostModifierWithConfiguration(state, operator.id, configuration)
  )
}

export function getDraftOperatorCostForState(
  operator: Operator,
  state: Pick<DraftState, 'draftedOperatorIds'>,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'interactions'> = {},
): number {
  return getDraftOperatorCostForStateWithConfiguration(
    operator,
    state,
    resolveDraftEngineConfiguration(options),
  )
}

export function getDraftHoldUpkeepCostWithConfiguration(
  state: Pick<DraftState, 'heldOperatorId' | 'holdUpkeepCharges'>,
  configuration: ResolvedDraftConfiguration,
): number {
  if (state.heldOperatorId === null) return 0
  const hold = configuration.actionRules.hold
  if (hold.upkeepMode === 'none') return 0
  if (hold.upkeepMode === 'static') return hold.upkeepBaseCost
  return hold.upkeepBaseCost + state.holdUpkeepCharges * hold.upkeepEscalation
}

export function isDraftHoldUpkeepDue(
  state: Pick<DraftState, 'heldOperatorId' | 'holdUpkeepCharges'>,
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): boolean {
  if (!configuration.economyRules.enabled || configuration.actionRules.hold.upkeepMode === 'none') {
    return false
  }
  if (state.heldOperatorId === null) return false
  if (action.type === 'forfeit') return true
  return action.type === 'pick' && action.operatorId !== state.heldOperatorId
}

export function getDraftActionPointDeltaWithConfiguration(
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
  state?: Pick<DraftState, 'draftedOperatorIds' | 'heldOperatorId' | 'holdUpkeepCharges'>,
): number {
  const economy = configuration.economyRules
  if (!economy.enabled) return 0

  let delta: number
  switch (action.type) {
    case 'pick': {
      const operator = draftOperatorById(pool, action.operatorId)
      delta = -(
        state
          ? getDraftOperatorCostForStateWithConfiguration(operator, state, configuration)
          : getDraftOperatorCostWithConfiguration(operator, configuration)
      )
      break
    }
    case 'forfeit':
      delta = economy.forfeitRebate
      break
    case 'reroll':
      delta = -economy.rerollCost
      break
    case 'hold':
      delta = -economy.holdCost
      break
    case 'slot-expansion':
      delta = -economy.slotExpansionCost
      break
    case 'release-hold':
      delta = 0
      break
  }

  if (state && isDraftHoldUpkeepDue(state, action, configuration)) {
    delta -= getDraftHoldUpkeepCostWithConfiguration(state, configuration)
  }
  return delta
}

export function getDraftActionPointDelta(
  pool: readonly Operator[],
  action: DraftAction,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'interactions' | 'actionRules'> = {},
  state?: Pick<DraftState, 'draftedOperatorIds' | 'heldOperatorId' | 'holdUpkeepCharges'>,
): number {
  return getDraftActionPointDeltaWithConfiguration(
    pool,
    action,
    resolveDraftEngineConfiguration(options),
    state,
  )
}
