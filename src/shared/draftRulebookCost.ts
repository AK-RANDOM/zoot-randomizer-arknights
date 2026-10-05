import type { Operator } from './operator'
import {
  resolveDraftRulebook,
  type DraftRulebook,
} from './draftRulebook'

export interface DraftRulebookOperatorCostBreakdown {
  operatorId: string
  rarityCost: number
  overrideCost: number | null
  overrideDelta: number
  baselineCost: number
  minimumCost: number
  maximumCost: number
}

export interface DraftRulebookOperatorCostResolution {
  byOperatorId: Record<string, DraftRulebookOperatorCostBreakdown>
  unresolvedOverrideOperatorIds: string[]
}

/**
 * Rulebook `overrides.operatorCosts` stores an absolute static baseline cost.
 * The user-facing override delta is derived from the active rarity cost so the
 * editor can present the locked design as e.g. "Default 30 / Override +6 / Baseline 36"
 * without duplicating both absolute and relative values in the portable file.
 *
 * Interaction modifiers are intentionally not evaluated yet. Until that layer
 * lands, the legal cost range is exactly the static baseline.
 */
export function getDraftRulebookOperatorCostBreakdown(
  rulebook: DraftRulebook,
  operator: Operator,
): DraftRulebookOperatorCostBreakdown {
  const resolved = resolveDraftRulebook(rulebook)
  const economy = resolved.configuration.economyRules
  const rarityCost = economy.rarityCosts[operator.rarity] ?? 0
  const overrideCost = Object.prototype.hasOwnProperty.call(
    rulebook.overrides.operatorCosts,
    operator.id,
  )
    ? rulebook.overrides.operatorCosts[operator.id] ?? null
    : null
  const baselineCost = overrideCost ?? rarityCost

  return {
    operatorId: operator.id,
    rarityCost,
    overrideCost,
    overrideDelta: overrideCost === null ? 0 : overrideCost - rarityCost,
    baselineCost,
    minimumCost: baselineCost,
    maximumCost: baselineCost,
  }
}

export function getDraftRulebookOperatorBaselineCost(
  rulebook: DraftRulebook,
  operator: Operator,
): number {
  return getDraftRulebookOperatorCostBreakdown(rulebook, operator).baselineCost
}

export function resolveDraftRulebookOperatorCosts(
  rulebook: DraftRulebook,
  operators: readonly Operator[],
): DraftRulebookOperatorCostResolution {
  const byOperatorId: Record<string, DraftRulebookOperatorCostBreakdown> = {}
  const operatorIds = new Set<string>()

  for (const operator of operators) {
    operatorIds.add(operator.id)
    byOperatorId[operator.id] = getDraftRulebookOperatorCostBreakdown(rulebook, operator)
  }

  const unresolvedOverrideOperatorIds = Object.keys(rulebook.overrides.operatorCosts)
    .filter((operatorId) => !operatorIds.has(operatorId))
    .sort((left, right) => left.localeCompare(right))

  return { byOperatorId, unresolvedOverrideOperatorIds }
}
