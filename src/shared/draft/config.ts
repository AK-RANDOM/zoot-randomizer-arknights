import type { DraftPullDistribution, DraftRateUpRule } from '../draftDistribution'
import type {
  DraftActionRules,
  DraftCapacityRules,
  DraftConfigurationInput,
  DraftEconomyRules,
  DraftEngineOptions,
  DraftLimitedActionRules,
  PartialDraftActionRules,
  ResolvedDraftConfiguration,
  ResolvedDraftInteraction,
} from './types'

export const DEFAULT_DRAFT_ACTION_RULES: DraftActionRules = {
  hold: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardUnheldOffer: false,
    upkeepMode: 'none',
    upkeepBaseCost: 0,
    upkeepEscalation: 0,
  },
  forfeit: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardOffer: false,
  },
  reroll: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardOffer: true,
  },
  slotExpansion: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
  },
}

export const DEFAULT_DRAFT_CAPACITY_RULES: DraftCapacityRules = {
  enabled: false,
  startingActiveSlots: 6,
  overflowSlots: 1,
  maxActiveSlots: 12,
}

export const DEFAULT_DRAFT_ECONOMY_RULES: DraftEconomyRules = {
  enabled: false,
  startingPoints: 0,
  rarityCosts: { 1: -8, 2: -6, 3: -4, 4: 0, 5: 12, 6: 32 },
  operatorCostOverrides: {},
  forfeitRebate: 4,
  rerollCost: 0,
  holdCost: 0,
  slotExpansionCost: 2,
}

const DEFAULT_DRAFT_PULL_DISTRIBUTION: DraftPullDistribution = { type: 'equal' }

function cloneRateUp(rateUp: DraftRateUpRule): DraftRateUpRule {
  return { ...rateUp, featuredOperatorIds: [...rateUp.featuredOperatorIds] }
}

function clonePullDistribution(distribution: DraftPullDistribution): DraftPullDistribution {
  if (distribution.type === 'equal') return { type: 'equal' }
  if (distribution.type === 'arknights') {
    return {
      type: 'arknights',
      rateUps: distribution.rateUps
        ? Object.fromEntries(
            Object.entries(distribution.rateUps).map(([id, rateUp]) => [id, cloneRateUp(rateUp)]),
          )
        : undefined,
    }
  }
  return {
    type: 'custom',
    buckets: distribution.buckets.map((bucket) => ({
      ...bucket,
      rarities: [...bucket.rarities],
      rateUp: bucket.rateUp ? cloneRateUp(bucket.rateUp) : undefined,
    })),
  }
}

function cloneInteractions(interactions: readonly ResolvedDraftInteraction[]): ResolvedDraftInteraction[] {
  return interactions.map((interaction) => {
    switch (interaction.type) {
      case 'anchor':
        return {
          ...interaction,
          sourceOperatorIds: [...interaction.sourceOperatorIds],
          targetOperatorIds: [...interaction.targetOperatorIds],
        }
      case 'progressive':
        return {
          ...interaction,
          groupOperatorIds: [...interaction.groupOperatorIds],
          steps: interaction.steps.map((step) => ({ ...step })),
        }
      case 'threshold':
        return {
          ...interaction,
          groupOperatorIds: [...interaction.groupOperatorIds],
          anchorOperatorIds: interaction.anchorOperatorIds
            ? [...interaction.anchorOperatorIds]
            : undefined,
        }
    }
  })
}

function mergeActionInputs(
  base: PartialDraftActionRules | undefined,
  override: PartialDraftActionRules | undefined,
): PartialDraftActionRules | undefined {
  if (!base && !override) return undefined
  return {
    hold: { ...base?.hold, ...override?.hold },
    forfeit: { ...base?.forfeit, ...override?.forfeit },
    reroll: { ...base?.reroll, ...override?.reroll },
    slotExpansion: { ...base?.slotExpansion, ...override?.slotExpansion },
  }
}

function mergeEconomyInputs(
  base: Partial<DraftEconomyRules> | undefined,
  override: Partial<DraftEconomyRules> | undefined,
): Partial<DraftEconomyRules> | undefined {
  if (!base && !override) return undefined
  return {
    ...base,
    ...override,
    rarityCosts:
      base?.rarityCosts || override?.rarityCosts
        ? { ...base?.rarityCosts, ...override?.rarityCosts }
        : undefined,
    operatorCostOverrides:
      base?.operatorCostOverrides || override?.operatorCostOverrides
        ? { ...base?.operatorCostOverrides, ...override?.operatorCostOverrides }
        : undefined,
  }
}

export function resolveDraftConfiguration(
  input: DraftConfigurationInput = {},
): ResolvedDraftConfiguration {
  const actionRules = input.actionRules ?? {}
  const economyRules = input.economyRules ?? {}
  return {
    actionRules: {
      hold: { ...DEFAULT_DRAFT_ACTION_RULES.hold, ...actionRules.hold },
      forfeit: { ...DEFAULT_DRAFT_ACTION_RULES.forfeit, ...actionRules.forfeit },
      reroll: { ...DEFAULT_DRAFT_ACTION_RULES.reroll, ...actionRules.reroll },
      slotExpansion: {
        ...DEFAULT_DRAFT_ACTION_RULES.slotExpansion,
        ...actionRules.slotExpansion,
      },
    },
    capacityRules: { ...DEFAULT_DRAFT_CAPACITY_RULES, ...input.capacityRules },
    economyRules: {
      ...DEFAULT_DRAFT_ECONOMY_RULES,
      ...economyRules,
      rarityCosts: { ...DEFAULT_DRAFT_ECONOMY_RULES.rarityCosts, ...economyRules.rarityCosts },
      operatorCostOverrides: {
        ...DEFAULT_DRAFT_ECONOMY_RULES.operatorCostOverrides,
        ...economyRules.operatorCostOverrides,
      },
    },
    pullDistribution: clonePullDistribution(
      input.pullDistribution ?? DEFAULT_DRAFT_PULL_DISTRIBUTION,
    ),
    interactions: cloneInteractions(input.interactions ?? []),
  }
}

export function resolveDraftEngineConfiguration(
  options: DraftEngineOptions = {},
): ResolvedDraftConfiguration {
  const nested = options.configuration ?? {}
  return resolveDraftConfiguration({
    actionRules: mergeActionInputs(nested.actionRules, options.actionRules),
    capacityRules:
      nested.capacityRules || options.capacityRules
        ? { ...nested.capacityRules, ...options.capacityRules }
        : undefined,
    economyRules: mergeEconomyInputs(nested.economyRules, options.economyRules),
    pullDistribution: options.pullDistribution ?? nested.pullDistribution,
    interactions: options.interactions ?? nested.interactions,
  })
}

function validateLimitedRule(label: string, rule: DraftLimitedActionRules): void {
  for (const [name, value] of [
    ['per-round limit', rule.perRoundLimit],
    ['per-draft limit', rule.perDraftLimit],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`Draft ${label} ${name} must be null or a positive integer.`)
    }
  }
  if (!Number.isInteger(rule.cooldownRounds) || rule.cooldownRounds < 0) {
    throw new Error(`Draft ${label} cooldown must be a non-negative integer.`)
  }
}

function validateOperatorIds(label: string, operatorIds: readonly string[]): void {
  const seen = new Set<string>()
  for (const operatorId of operatorIds) {
    if (typeof operatorId !== 'string' || operatorId.length === 0) {
      throw new Error(`Draft ${label} operator IDs must be non-empty strings.`)
    }
    if (seen.has(operatorId)) {
      throw new Error(`Draft ${label} operator IDs must not contain duplicates.`)
    }
    seen.add(operatorId)
  }
}

function validateInteractions(interactions: readonly ResolvedDraftInteraction[]): void {
  const ids = new Set<string>()
  for (const interaction of interactions) {
    if (!interaction.id || ids.has(interaction.id)) {
      throw new Error('Draft interactions must use unique, non-empty IDs.')
    }
    ids.add(interaction.id)

    if (interaction.type === 'anchor') {
      validateOperatorIds(`${interaction.id} source`, interaction.sourceOperatorIds)
      validateOperatorIds(`${interaction.id} target`, interaction.targetOperatorIds)
      if (!Number.isFinite(interaction.modifier) || interaction.modifier < 0) {
        throw new Error(`Draft interaction ${interaction.id} modifier must be non-negative.`)
      }
      continue
    }

    if (interaction.type === 'progressive') {
      validateOperatorIds(`${interaction.id} group`, interaction.groupOperatorIds)
      if (interaction.steps.length === 0) {
        throw new Error(`Draft interaction ${interaction.id} steps must be non-empty.`)
      }
      let previousCount = 0
      for (const step of interaction.steps) {
        if (!Number.isInteger(step.memberCount) || step.memberCount <= previousCount) {
          throw new Error(
            `Draft interaction ${interaction.id} member counts must be positive and strictly increasing.`,
          )
        }
        if (!Number.isFinite(step.modifier) || step.modifier < 0) {
          throw new Error(`Draft interaction ${interaction.id} modifier must be non-negative.`)
        }
        previousCount = step.memberCount
      }
      continue
    }

    validateOperatorIds(`${interaction.id} group`, interaction.groupOperatorIds)
    if (interaction.anchorOperatorIds) {
      validateOperatorIds(`${interaction.id} anchor`, interaction.anchorOperatorIds)
    }
    if (!Number.isInteger(interaction.threshold) || interaction.threshold < 1) {
      throw new Error(`Draft interaction ${interaction.id} threshold must be a positive integer.`)
    }
    if (!Number.isFinite(interaction.modifier) || interaction.modifier < 0) {
      throw new Error(`Draft interaction ${interaction.id} modifier must be non-negative.`)
    }
  }
}

export function validateDraftConfiguration(configuration: ResolvedDraftConfiguration): void {
  validateLimitedRule('Hold', configuration.actionRules.hold)
  validateLimitedRule('Forfeit', configuration.actionRules.forfeit)
  validateLimitedRule('Reroll', configuration.actionRules.reroll)
  validateLimitedRule('slot expansion', configuration.actionRules.slotExpansion)

  const hold = configuration.actionRules.hold
  if (!['none', 'static', 'escalating'].includes(hold.upkeepMode)) {
    throw new Error('Draft Hold upkeep mode must be none, static, or escalating.')
  }
  if (!Number.isFinite(hold.upkeepBaseCost) || hold.upkeepBaseCost < 0) {
    throw new Error('Draft Hold upkeep base cost must be a non-negative finite number.')
  }
  if (!Number.isFinite(hold.upkeepEscalation) || hold.upkeepEscalation < 0) {
    throw new Error('Draft Hold upkeep escalation must be a non-negative finite number.')
  }

  const capacity = configuration.capacityRules
  for (const [label, value] of [
    ['starting active slots', capacity.startingActiveSlots],
    ['overflow slots', capacity.overflowSlots],
    ['maximum active slots', capacity.maxActiveSlots],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Draft ${label} must be a non-negative integer.`)
    }
  }
  if (capacity.startingActiveSlots < 1) {
    throw new Error('Draft starting active slots must be at least 1.')
  }
  if (capacity.maxActiveSlots < capacity.startingActiveSlots) {
    throw new Error('Draft maximum active slots cannot be below starting active slots.')
  }
  validateInteractions(configuration.interactions)
}

export function draftPullDistributionLabel(distribution: DraftPullDistribution): string {
  switch (distribution.type) {
    case 'equal':
      return 'Equal Opportunity'
    case 'arknights':
      return 'Arknights Headhunting'
    case 'custom':
      return 'Custom Distribution'
  }
}

/** The simplest built-in Rulebook-equivalent configuration: plain pick 1 of 3. */
export const STANDARD_DRAFT_CONFIGURATION: ResolvedDraftConfiguration =
  resolveDraftConfiguration()
