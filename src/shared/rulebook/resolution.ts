import {
  resolveDraftConfiguration,
  validateDraftConfiguration,
} from '../draft'
import type {
  DraftRulebook,
  ResolvedDraftRulebook,
} from './types'
import { assertValidDraftRulebook } from './validation'

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function resolveDraftRulebook(rulebook: DraftRulebook): ResolvedDraftRulebook {
  assertValidDraftRulebook(rulebook)
  const configuration = resolveDraftConfiguration({
    offerSize: rulebook.generalRules.offerSize,
    maxRounds: rulebook.generalRules.maxRounds,
    actionRules: rulebook.generalRules.actionRules,
    capacityRules: rulebook.generalRules.capacityRules,
    economyRules: {
      ...rulebook.generalRules.economyRules,
      operatorCostOverrides: { ...rulebook.overrides.operatorCosts },
    },
    pullDistribution: rulebook.generalRules.pullDistribution,
  })
  validateDraftConfiguration(configuration)
  return {
    id: rulebook.identifier.id,
    name: rulebook.identifier.name,
    revision: rulebook.identifier.revision,
    offerSize: rulebook.generalRules.offerSize,
    configuration,
    pool: cloneJson(rulebook.pool),
    interactions: cloneJson(rulebook.interactions),
  }
}
