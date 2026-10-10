import type { DraftPullDistribution, DraftRateUpRule } from '../draftDistribution'
import { DRAFT_OFFER_SIZE } from './types'
import type {
  DraftActionRules,
  DraftCapacityRules,
  DraftConfigurationInput,
  DraftEconomyRules,
  DraftEngineOptions,
  DraftHoldUpkeepRules,
  DraftLimitedActionRules,
  PartialDraftActionRules,
  ResolvedDraftConfiguration,
  ResolvedDraftInteraction,
} from './types'

export const DEFAULT_DRAFT_MAX_ROUNDS: number | null = null

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
  holdUpkeep: { mode: 'none' },
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
      firstTenActualFiveStarGuarantee: distribution.firstTenActualFiveStarGuarantee,
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

function cloneHoldUpkeep(rules: DraftHoldUpkeepRules): DraftHoldUpkeepRules {
  return rules.mode === 'schedule' ? { ...rules, costs: [...rules.costs] } : { ...rules }
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
    offerSize: input.offerSize ?? DRAFT_OFFER_SIZE,
    maxRounds: input.maxRounds ?? DEFAULT_DRAFT_MAX_ROUNDS,
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
      holdUpkeep: cloneHoldUpkeep(
        economyRules.holdUpkeep ?? DEFAULT_DRAFT_ECONOMY_RULES.holdUpkeep,
      ),
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
    offerSize: options.offerSize ?? nested.offerSize,
    maxRounds: options.maxRounds !== undefined ? options.maxRounds : nested.maxRounds,
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

function validateHoldUpkeep(rules: DraftHoldUpkeepRules): void {
  if (rules.mode === 'none') return
  if (rules.mode === 'static') {
    if (!Number.isFinite(rules.cost) || rules.cost < 0) {
      throw new Error('Draft static Hold upkeep cost must be a non-negative finite number.')
    }
    return
  }
  if (rules.mode === 'schedule') {
    if (rules.costs.length === 0) {
      throw new Error('Draft scheduled Hold upkeep requires at least one cost.')
    }
    if (rules.costs.some((cost) => !Number.isFinite(cost) || cost < 0)) {
      throw new Error('Draft scheduled Hold upkeep costs must be non-negative finite numbers.')
    }
    if (typeof rules.repeatLast !== 'boolean') {
      throw new Error('Draft scheduled Hold upkeep repeatLast must be boolean.')
    }
    return
  }
  if (!Number.isFinite(rules.baseCost) || rules.baseCost < 0) {
    throw new Error('Draft escalating Hold upkeep base cost must be a non-negative finite number.')
  }
  if (!Number.isFinite(rules.escalation) || rules.escalation < 0) {
    throw new Error('Draft Hold upkeep escalation must be a non-negative finite number.')
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
  if (!Number.isInteger(configuration.offerSize) || configuration.offerSize < 1) {
    throw new Error('Draft offer size must be a positive integer.')
  }
  if (
    configuration.maxRounds !== null &&
    (!Number.isInteger(configuration.maxRounds) || configuration.maxRounds < 1)
  ) {
    throw new Error('Draft maximum rounds must be null or a positive integer.')
  }
  validateLimitedRule('Hold', configuration.actionRules.hold)
  validateLimitedRule('Forfeit', configuration.actionRules.forfeit)
  validateLimitedRule('Reroll', configuration.actionRules.reroll)
  validateLimitedRule('slot expansion', configuration.actionRules.slotExpansion)
  validateHoldUpkeep(configuration.economyRules.holdUpkeep)

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
