import type { Operator } from '../operator'
import { resolveDraftEngineConfiguration } from './config'
import { draftOperatorById } from './pool'
import type {
  DraftAction,
  DraftEngineOptions,
  DraftOperatorCostResolver,
  DraftState,
  ResolvedDraftConfiguration,
} from './types'

export function getDraftOperatorCost(
  operator: Operator,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules'> = {},
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

export function getDraftOperatorCostForState(
  operator: Operator,
  state: DraftState,
  pool: readonly Operator[],
  configuration: ResolvedDraftConfiguration,
  resolver?: DraftOperatorCostResolver,
): number {
  const baseline = getDraftOperatorCostWithConfiguration(operator, configuration)
  return resolver ? resolver(operator, state, pool, baseline, configuration) : baseline
}

export function getDraftActionPointDeltaWithConfiguration(
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
  state?: DraftState,
  resolver?: DraftOperatorCostResolver,
): number {
  const economy = configuration.economyRules
  if (!economy.enabled) return 0

  switch (action.type) {
    case 'pick': {
      const operator = draftOperatorById(pool, action.operatorId)
      const cost = state
        ? getDraftOperatorCostForState(operator, state, pool, configuration, resolver)
        : getDraftOperatorCostWithConfiguration(operator, configuration)
      return -cost
    }
    case 'forfeit':
      return economy.forfeitRebate
    case 'reroll':
      return -economy.rerollCost
    case 'hold':
      return -economy.holdCost
    case 'slot-expansion':
      return -economy.slotExpansionCost
    case 'release-hold':
      return 0
  }
}

export function getDraftActionPointDelta(
  pool: readonly Operator[],
  action: DraftAction,
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'operatorCostResolver'> = {},
  state?: DraftState,
): number {
  return getDraftActionPointDeltaWithConfiguration(
    pool,
    action,
    resolveDraftEngineConfiguration(options),
    state,
    options.operatorCostResolver,
  )
}
