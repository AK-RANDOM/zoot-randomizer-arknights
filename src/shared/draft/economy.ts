import type { Operator } from '../operator'
import { resolveDraftEngineConfiguration } from './config'
import { draftOperatorById } from './pool'
import type {
  DraftAction,
  DraftEngineOptions,
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

export function getDraftActionPointDeltaWithConfiguration(
  pool: readonly Operator[],
  action: DraftAction,
  configuration: ResolvedDraftConfiguration,
): number {
  const economy = configuration.economyRules
  if (!economy.enabled) return 0

  switch (action.type) {
    case 'pick':
      return -getDraftOperatorCostWithConfiguration(
        draftOperatorById(pool, action.operatorId),
        configuration,
      )
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
  options: Pick<DraftEngineOptions, 'configuration' | 'economyRules'> = {},
): number {
  return getDraftActionPointDeltaWithConfiguration(
    pool,
    action,
    resolveDraftEngineConfiguration(options),
  )
}
