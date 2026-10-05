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

export function getDraftActionPointDeltaWithConfiguration(
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
  state?: Pick<DraftState, 'draftedOperatorIds'>,
): number {
  const economy = configuration.economyRules
  if (!economy.enabled) return 0

  switch (action.type) {
    case 'pick': {
      const operator = draftOperatorById(pool, action.operatorId)
      return -(
        state
          ? getDraftOperatorCostForStateWithConfiguration(operator, state, configuration)
          : getDraftOperatorCostWithConfiguration(operator, configuration)
      )
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
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules' | 'interactions'> = {},
  state?: Pick<DraftState, 'draftedOperatorIds'>,
): number {
  return getDraftActionPointDeltaWithConfiguration(
    pool,
    action,
    resolveDraftEngineConfiguration(options),
    state,
  )
}
