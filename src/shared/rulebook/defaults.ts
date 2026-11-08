import { DRAFT_OFFER_SIZE, type DraftActionRules, type DraftEconomyRules } from '../draft'
import { arknightsBucketForRarity, type DraftPullDistribution } from '../draftDistribution'
import { SHARED_BALANCE_PRICING_PROFILE_ID } from '../draftPricingProfile'
import { operatorRarities } from '../operator'
import {
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  type DraftRulebook,
  type DraftRulebookEligibility,
} from './types'

export const STANDARD_DRAFT_RULEBOOK_ID = 'builtin:standard-draft' as const
export const SIMPLE_WEIGHTED_DRAFT_RULEBOOK_ID = 'builtin:simple-weighted' as const
export const DEV_STRICT_DRAFT_RULEBOOK_ID = 'builtin:dev-strict' as const
export const ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK_ID = 'builtin:arknights-headhunting' as const
export const DEV_LAX_DRAFT_RULEBOOK_ID = 'builtin:dev-lax' as const

const BALANCE_PRESET_REVISION = '2026.10-fallback55'
const DEV_LAX_PULL_WEIGHTS = { '3': 15, '4': 40, '5': 30, '6': 15 }
const SHARED_BALANCE_RARITY_COSTS: DraftEconomyRules['rarityCosts'] = {
  1: 7,
  2: 4,
  3: 3,
  4: 0,
  5: -7,
  // Unlisted/new 6★ operators default to 55; explicitly priced operators keep their profile costs.
  6: -55,
}
const SHARED_HOLD_UPKEEP: DraftEconomyRules['holdUpkeep'] = {
  mode: 'schedule',
  costs: [0, -2, -3, -5, -6],
  repeatLast: true,
}

function balanceActionRules(
  rerollsPerDraft: number,
  rerollCooldownRounds: number,
): DraftActionRules {
  return {
    hold: {
      enabled: true,
      perRoundLimit: 1,
      perDraftLimit: null,
      cooldownRounds: 0,
      discardUnheldOffer: false,
    },
    forfeit: {
      enabled: true,
      perRoundLimit: 1,
      perDraftLimit: null,
      cooldownRounds: 0,
      discardOffer: false,
    },
    reroll: {
      enabled: true,
      perRoundLimit: 1,
      perDraftLimit: rerollsPerDraft,
      cooldownRounds: rerollCooldownRounds,
      discardOffer: true,
    },
    slotExpansion: {
      enabled: true,
      perRoundLimit: 1,
      perDraftLimit: null,
      cooldownRounds: 2,
    },
  }
}

function balanceEconomy(startingPoints: number): Omit<DraftEconomyRules, 'operatorCostOverrides'> {
  return {
    enabled: true,
    startingPoints,
    rarityCosts: SHARED_BALANCE_RARITY_COSTS,
    forfeitRebate: 4,
    rerollCost: 0,
    holdCost: -3,
    holdUpkeep: SHARED_HOLD_UPKEEP,
    slotExpansionCost: -2,
  }
}

function weightedHeadhuntingBuckets(
  weights: Record<'3' | '4' | '5' | '6', number>,
): DraftPullDistribution {
  return {
    type: 'custom',
    buckets: Object.entries(weights).map(([id, weight]) => ({
      id,
      weight,
      rarities: operatorRarities.filter((rarity) => arknightsBucketForRarity(rarity) === id),
    })),
  }
}

export const STANDARD_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: STANDARD_DRAFT_RULEBOOK_ID,
    name: 'Simple Draft',
    description: 'Plain pick 1 of 3 using the current Global Pool.',
    createdAt: '2026-10-05T00:00:00.000Z',
    revision: '1',
  },
  generalRules: {
    offerSize: DRAFT_OFFER_SIZE,
    actionRules: {
      hold: { enabled: false },
      forfeit: { enabled: false },
      reroll: { enabled: false },
      slotExpansion: { enabled: false },
    },
    capacityRules: { enabled: false },
    economyRules: { enabled: false },
    pullDistribution: { type: 'equal' },
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

export const SIMPLE_WEIGHTED_DRAFT_RULEBOOK: DraftRulebook = {
  ...STANDARD_DRAFT_RULEBOOK,
  identifier: {
    id: SIMPLE_WEIGHTED_DRAFT_RULEBOOK_ID,
    name: 'Simple Weighted',
    description: 'Pick 1 of 4 from the current Global Pool with custom rarity weights.',
    createdAt: '2026-11-08T00:00:00.000Z',
    revision: '2',
  },
  generalRules: {
    ...STANDARD_DRAFT_RULEBOOK.generalRules,
    offerSize: 4,
    pullDistribution: weightedHeadhuntingBuckets({ '3': 38, '4': 32, '5': 24, '6': 6 }),
  },
}

export const DEV_STRICT_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: DEV_STRICT_DRAFT_RULEBOOK_ID,
    name: 'Dev Strict',
    description: '#58 scarcity-oriented balance preset.',
    createdAt: '2026-10-10T00:00:00.000Z',
    revision: BALANCE_PRESET_REVISION,
  },
  generalRules: {
    offerSize: 3,
    pricingProfileId: SHARED_BALANCE_PRICING_PROFILE_ID,
    maxRounds: 15,
    actionRules: balanceActionRules(3, 3),
    capacityRules: {
      enabled: true,
      startingActiveSlots: 6,
      overflowSlots: 1,
      maxActiveSlots: 12,
    },
    economyRules: balanceEconomy(45),
    pullDistribution: weightedHeadhuntingBuckets({ '3': 20, '4': 45, '5': 25, '6': 10 }),
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

export const ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK_ID,
    name: 'Arknights Headhunting',
    description: '#58 Arknights-like appearance-scarcity balance preset.',
    createdAt: '2026-10-10T00:00:00.000Z',
    revision: BALANCE_PRESET_REVISION,
  },
  generalRules: {
    offerSize: 5,
    pricingProfileId: SHARED_BALANCE_PRICING_PROFILE_ID,
    maxRounds: 15,
    actionRules: balanceActionRules(2, 3),
    capacityRules: {
      enabled: true,
      startingActiveSlots: 6,
      overflowSlots: 1,
      maxActiveSlots: 12,
    },
    economyRules: balanceEconomy(55),
    pullDistribution: {
      type: 'arknights',
      firstTenActualFiveStarGuarantee: true,
    },
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

export const DEV_LAX_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: DEV_LAX_DRAFT_RULEBOOK_ID,
    name: 'Dev Lax',
    description: '#58 high-steering balance preset.',
    createdAt: '2026-10-10T00:00:00.000Z',
    revision: BALANCE_PRESET_REVISION,
  },
  generalRules: {
    offerSize: 4,
    pricingProfileId: SHARED_BALANCE_PRICING_PROFILE_ID,
    maxRounds: 15,
    actionRules: balanceActionRules(4, 2),
    capacityRules: {
      enabled: true,
      startingActiveSlots: 6,
      overflowSlots: 1,
      maxActiveSlots: 12,
    },
    economyRules: balanceEconomy(70),
    pullDistribution: weightedHeadhuntingBuckets(DEV_LAX_PULL_WEIGHTS),
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

export const BUILT_IN_DRAFT_RULEBOOKS: readonly DraftRulebook[] = [
  STANDARD_DRAFT_RULEBOOK,
  SIMPLE_WEIGHTED_DRAFT_RULEBOOK,
  ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK,
  DEV_LAX_DRAFT_RULEBOOK,
  DEV_STRICT_DRAFT_RULEBOOK,
]

export function createEmptyDraftRulebookEligibility(): DraftRulebookEligibility {
  return { allOf: [], anyOf: [], noneOf: [] }
}
