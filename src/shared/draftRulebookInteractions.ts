import type { Operator } from './operator'
import type { DraftOperatorCostResolver, DraftState, ResolvedDraftConfiguration } from './draft'
import {
  matchesDraftRulebookSelector,
} from './draftRulebookPool'
import type {
  DraftRulebook,
  DraftRulebookInteraction,
} from './draftRulebook'

export interface DraftInteractionTaxEntry {
  interactionId: string
  type: DraftRulebookInteraction['type']
  totalTax: number
}

export interface DraftInteractionCandidateEntry extends DraftInteractionTaxEntry {
  previousTax: number
  modifier: number
}

export interface DraftInteractionCostBreakdown {
  baselineCost: number
  interactionModifier: number
  finalCost: number
  entries: DraftInteractionCandidateEntry[]
}

function uniqueOperators(operators: readonly Operator[]): Operator[] {
  const seen = new Set<string>()
  return operators.filter((operator) => {
    if (seen.has(operator.id)) return false
    seen.add(operator.id)
    return true
  })
}

function anchorTax(interaction: Extract<DraftRulebookInteraction, { type: 'anchor' }>, roster: readonly Operator[]): number {
  const targets = roster.filter((operator) => matchesDraftRulebookSelector(operator, interaction.target))
  let activeTargets = 0
  for (const target of targets) {
    if (roster.some((source) => source.id !== target.id && matchesDraftRulebookSelector(source, interaction.source))) {
      activeTargets += 1
    }
  }
  return activeTargets * interaction.modifier
}

function progressiveTax(interaction: Extract<DraftRulebookInteraction, { type: 'progressive' }>, roster: readonly Operator[]): number {
  const count = roster.filter((operator) => matchesDraftRulebookSelector(operator, interaction.group)).length
  return interaction.steps.reduce(
    (total, step) => total + (count >= step.memberCount ? step.modifier : 0),
    0,
  )
}

function thresholdTax(interaction: Extract<DraftRulebookInteraction, { type: 'threshold' }>, roster: readonly Operator[]): number {
  const count = roster.filter((operator) => matchesDraftRulebookSelector(operator, interaction.group)).length
  if (count < interaction.threshold) return 0
  if (interaction.anchor && !roster.some((operator) => matchesDraftRulebookSelector(operator, interaction.anchor!))) return 0
  return interaction.modifier
}

export function getDraftInteractionTax(
  interaction: DraftRulebookInteraction,
  roster: readonly Operator[],
): number {
  const uniqueRoster = uniqueOperators(roster)
  switch (interaction.type) {
    case 'anchor': return anchorTax(interaction, uniqueRoster)
    case 'progressive': return progressiveTax(interaction, uniqueRoster)
    case 'threshold': return thresholdTax(interaction, uniqueRoster)
  }
}

export function getDraftRulebookInteractionTax(
  rulebook: Pick<DraftRulebook, 'interactions'>,
  roster: readonly Operator[],
): number {
  return rulebook.interactions.reduce(
    (total, interaction) => total + getDraftInteractionTax(interaction, roster),
    0,
  )
}

export function getDraftRulebookInteractionTaxEntries(
  rulebook: Pick<DraftRulebook, 'interactions'>,
  roster: readonly Operator[],
): DraftInteractionTaxEntry[] {
  return rulebook.interactions.map((interaction) => ({
    interactionId: interaction.id,
    type: interaction.type,
    totalTax: getDraftInteractionTax(interaction, roster),
  }))
}

export function getDraftRulebookCandidateInteractionModifier(
  rulebook: Pick<DraftRulebook, 'interactions'>,
  candidate: Operator,
  ownedOperators: readonly Operator[],
): number {
  const before = uniqueOperators(ownedOperators)
  const after = uniqueOperators([...before, candidate])
  return getDraftRulebookInteractionTax(rulebook, after) - getDraftRulebookInteractionTax(rulebook, before)
}

export function getDraftRulebookCandidateCostBreakdown(
  rulebook: Pick<DraftRulebook, 'interactions'>,
  candidate: Operator,
  ownedOperators: readonly Operator[],
  baselineCost: number,
): DraftInteractionCostBreakdown {
  const before = uniqueOperators(ownedOperators)
  const after = uniqueOperators([...before, candidate])
  const entries = rulebook.interactions.map((interaction) => {
    const previousTax = getDraftInteractionTax(interaction, before)
    const totalTax = getDraftInteractionTax(interaction, after)
    return {
      interactionId: interaction.id,
      type: interaction.type,
      previousTax,
      totalTax,
      modifier: totalTax - previousTax,
    }
  }).filter((entry) => entry.modifier !== 0)
  const interactionModifier = entries.reduce((sum, entry) => sum + entry.modifier, 0)
  return {
    baselineCost,
    interactionModifier,
    finalCost: baselineCost + interactionModifier,
    entries,
  }
}

function ownedOperatorsFromState(state: DraftState, pool: readonly Operator[]): Operator[] {
  const byId = new Map(pool.map((operator) => [operator.id, operator] as const))
  return state.draftedOperatorIds
    .map((operatorId) => byId.get(operatorId))
    .filter((operator): operator is Operator => operator !== undefined)
}

export function createDraftRulebookOperatorCostResolver(
  rulebook: Pick<DraftRulebook, 'interactions'>,
): DraftOperatorCostResolver {
  return (
    operator: Operator,
    state: DraftState,
    pool: readonly Operator[],
    baselineCost: number,
    _configuration: ResolvedDraftConfiguration,
  ): number => {
    const owned = ownedOperatorsFromState(state, pool)
    return getDraftRulebookCandidateCostBreakdown(rulebook, operator, owned, baselineCost).finalCost
  }
}
