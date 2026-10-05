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

type DraftActionEconomyState = Pick<DraftState, 'draftedOperatorIds'> &
  Partial<Pick<DraftState, 'heldOperatorId' | 'holdUpkeepCharges'>>
type DraftHoldEconomyState = Partial<Pick<DraftState, 'heldOperatorId' | 'holdUpkeepCharges'>>

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

export function draftActionCarriesHoldForward(
  state: DraftHoldEconomyState,
  action: DraftAction,
): boolean {
  if (!state.heldOperatorId) return false
  if (action.type === 'forfeit') return true
  return action.type === 'pick' && action.operatorId !== state.heldOperatorId
}

export function getDraftHoldUpkeepCostWithConfiguration(
  state: DraftHoldEconomyState,
  configuration: ResolvedDraftConfiguration,
): number {
  const economy = configuration.economyRules
  if (!economy.enabled || !state.heldOperatorId) return 0

  const upkeep = economy.holdUpkeep
  if (upkeep.mode === 'none') return 0
  if (upkeep.mode === 'static') return upkeep.cost
  return upkeep.baseCost + (state.holdUpkeepCharges ?? 0) * upkeep.escalation
}

export function getDraftHoldUpkeepCost(
  state: DraftHoldEconomyState,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules'> = {},
): number {
  return getDraftHoldUpkeepCostWithConfiguration(
    state,
    resolveDraftEngineConfiguration(options),
  )
}

export function getDraftActionPointDeltaWithConfiguration(
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
  state?: DraftActionEconomyState,
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

  if (state && draftActionCarriesHoldForward(state, action)) {
    delta -= getDraftHoldUpkeepCostWithConfiguration(state, configuration)
  }
  return delta
}

export function getDraftActionPointDelta(
  pool: readonly Operator[],
  action: DraftAction,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'interactions'> = {},
  state?: DraftActionEconomyState,
): number {
  return getDraftActionPointDeltaWithConfiguration(
    pool,
    action,
    resolveDraftEngineConfiguration(options),
    state,
  )
}
