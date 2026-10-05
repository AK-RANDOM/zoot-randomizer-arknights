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
} from './types'

export const DEFAULT_DRAFT_ACTION_RULES: DraftActionRules = {
  hold: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardUnheldOffer: false,
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

export function validateDraftConfiguration(configuration: ResolvedDraftConfiguration): void {
  validateLimitedRule('Hold', configuration.actionRules.hold)
  validateLimitedRule('Forfeit', configuration.actionRules.forfeit)
  validateLimitedRule('Reroll', configuration.actionRules.reroll)
  validateLimitedRule('slot expansion', configuration.actionRules.slotExpansion)

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
