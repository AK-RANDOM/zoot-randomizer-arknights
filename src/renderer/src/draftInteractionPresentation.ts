import {
  getDraftInteractionCostContributionsWithConfiguration,
  getDraftOperatorCostForStateWithConfiguration,
  type DraftState,
  type ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import type {
  DraftRulebook,
  DraftRulebookInteraction,
  DraftRulebookSelector,
} from '../../shared/draftRulebook'
import { getDraftRulebookOperatorCostBreakdown } from '../../shared/draftRulebookCost'
import { matchesDraftRulebookSelector } from '../../shared/draftRulebookPool'
import type {
  OperatorCardInteractionDetails,
  OperatorCardInteractionLine,
} from './OperatorCard'

export interface DraftLiveInteractionLine {
  id: string
  label: string
  modifier: number
}

export interface DraftLiveInteractionBreakdown {
  baselineCost: number
  finalCost: number
  contributions: DraftLiveInteractionLine[]
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function compactValues(values: readonly string[], maximum = 3): string {
  if (values.length === 0) return 'Unresolved selector'
  if (values.length <= maximum) return values.join(', ')
  return `${values.slice(0, maximum).join(', ')} +${values.length - maximum}`
}

function operatorNames(ids: readonly string[], dataset: OperatorDataset): string[] {
  const byId = new Map(dataset.operators.map((operator) => [operator.id, operator.name] as const))
  return ids.map((id) => byId.get(id) ?? id)
}

function subclassLabel(id: string, dataset: OperatorDataset): string {
  return dataset.operators.find((operator) => operator.subclass.id === id)?.subclass.name ?? id
}

export function describeDraftRulebookSelector(
  selector: DraftRulebookSelector,
  dataset: OperatorDataset,
): string {
  switch (selector.type) {
    case 'operators':
      return compactValues(operatorNames(selector.operatorIds, dataset))
    case 'rarities':
      return compactValues(selector.rarities.map((rarity) => `${rarity}★`))
    case 'classes':
      return compactValues(selector.classes.map(
        (operatorClass) => dataset.classLabels?.[operatorClass] ?? operatorClass,
      ))
    case 'subclasses':
      return compactValues(selector.subclassIds.map((id) => subclassLabel(id, dataset)))
    case 'factions':
      return compactValues(selector.factionIds.map((id) => dataset.factionLabels[id] ?? id))
    case 'races':
      return compactValues(selector.raceIds.map((id) => dataset.raceLabels?.[id] ?? id))
  }
}

export function describeDraftRulebookInteraction(
  interaction: DraftRulebookInteraction,
  dataset: OperatorDataset,
): string {
  switch (interaction.type) {
    case 'anchor':
      return `${describeDraftRulebookSelector(interaction.source, dataset)} → ${describeDraftRulebookSelector(interaction.target, dataset)}`
    case 'progressive':
      return `Progressive • ${describeDraftRulebookSelector(interaction.group, dataset)}`
    case 'threshold': {
      const group = describeDraftRulebookSelector(interaction.group, dataset)
      const anchor = interaction.anchor
        ? ` + ${describeDraftRulebookSelector(interaction.anchor, dataset)}`
        : ''
      return `Threshold ${interaction.threshold} • ${group}${anchor}`
    }
  }
}

function interactionModifierLabel(interaction: DraftRulebookInteraction): string {
  switch (interaction.type) {
    case 'anchor':
      return `${signed(interaction.modifier)} / connection`
    case 'progressive':
      return interaction.steps
        .map((step) => `${step.memberCount}: ${signed(step.modifier)}`)
        .join(' · ')
    case 'threshold':
      return `${signed(interaction.modifier)} at threshold`
  }
}

export function draftRulebookInteractionAffectsOperator(
  interaction: DraftRulebookInteraction,
  operator: Operator,
): boolean {
  switch (interaction.type) {
    case 'anchor':
      return matchesDraftRulebookSelector(operator, interaction.source) ||
        matchesDraftRulebookSelector(operator, interaction.target)
    case 'progressive':
      return matchesDraftRulebookSelector(operator, interaction.group)
    case 'threshold':
      return matchesDraftRulebookSelector(operator, interaction.group) ||
        (interaction.anchor !== undefined && matchesDraftRulebookSelector(operator, interaction.anchor))
  }
}

export function buildRulebookOperatorInteractionDetails(
  rulebook: DraftRulebook,
  operator: Operator,
  dataset: OperatorDataset,
  rangeOperators: readonly Operator[] = dataset.operators,
): OperatorCardInteractionDetails | undefined {
  const affecting = rulebook.interactions.filter(
    (interaction) => draftRulebookInteractionAffectsOperator(interaction, operator),
  )
  if (affecting.length === 0) return undefined

  const cost = getDraftRulebookOperatorCostBreakdown(rulebook, operator, rangeOperators)
  const interactions: OperatorCardInteractionLine[] = affecting.map((interaction) => ({
    id: interaction.id,
    label: describeDraftRulebookInteraction(interaction, dataset),
    modifier: interactionModifierLabel(interaction),
  }))

  return {
    baselineCost: cost.baselineCost,
    minimumCost: cost.minimumCost,
    maximumCost: cost.maximumCost,
    interactions,
  }
}

export function buildLiveRulebookOperatorInteractionDetails(
  rulebook: DraftRulebook,
  operator: Operator,
  dataset: OperatorDataset,
  rangeOperators: readonly Operator[],
  state: Pick<DraftState, 'draftedOperatorIds'>,
  configuration: ResolvedDraftConfiguration,
): OperatorCardInteractionDetails | undefined {
  const details = buildRulebookOperatorInteractionDetails(
    rulebook,
    operator,
    dataset,
    rangeOperators,
  )
  if (!details) return undefined
  return {
    ...details,
    currentCost: getDraftOperatorCostForStateWithConfiguration(operator, state, configuration),
  }
}

export function buildLiveDraftInteractionBreakdown(
  rulebook: DraftRulebook,
  operator: Operator,
  dataset: OperatorDataset,
  state: Pick<DraftState, 'draftedOperatorIds'>,
  configuration: ResolvedDraftConfiguration,
): DraftLiveInteractionBreakdown | undefined {
  const contributionById = new Map(
    getDraftInteractionCostContributionsWithConfiguration(state, operator.id, configuration)
      .filter((contribution) => contribution.modifier !== 0)
      .map((contribution) => [contribution.interactionId, contribution] as const),
  )
  if (contributionById.size === 0) return undefined

  const baselineCost = getDraftRulebookOperatorCostBreakdown(rulebook, operator).baselineCost
  const contributions = rulebook.interactions.flatMap((interaction) => {
    const contribution = contributionById.get(interaction.id)
    if (!contribution) return []
    return [{
      id: interaction.id,
      label: describeDraftRulebookInteraction(interaction, dataset),
      modifier: contribution.modifier,
    }]
  })

  return {
    baselineCost,
    finalCost: getDraftOperatorCostForStateWithConfiguration(operator, state, configuration),
    contributions,
  }
}
