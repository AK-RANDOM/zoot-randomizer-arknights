import { DRAFT_OFFER_SIZE, type DraftActionRules, type DraftEconomyRules } from '../draft'
import { SHARED_BALANCE_PRICING_PROFILE_ID } from '../draftPricingProfile'
import {
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  type DraftRulebook,
  type DraftRulebookEligibility,
} from './types'

export const STANDARD_DRAFT_RULEBOOK_ID = 'builtin:standard-draft' as const
export const DEV_STRICT_DRAFT_RULEBOOK_ID = 'builtin:dev-strict' as const
export const ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK_ID = 'builtin:arknights-headhunting' as const
export const DEV_LAX_DRAFT_RULEBOOK_ID = 'builtin:dev-lax' as const

const BALANCE_PRESET_REVISION = '2026.10-m3'
const SHARED_BALANCE_RARITY_COSTS: DraftEconomyRules['rarityCosts'] = {
  1: -7,
  2: -4,
  3: -3,
  4: 0,
  5: 7,
  // Temporary 6★ fallback until concrete operator-specific prices are authored or imported.
  6: 21,
}
const SHARED_HOLD_UPKEEP: DraftEconomyRules['holdUpkeep'] = {
  mode: 'schedule',
  costs: [2, 2, 3, 5, 6],
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
      cooldownRounds: 0,
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
    holdCost: 0,
    holdUpkeep: SHARED_HOLD_UPKEEP,
    // #58 leaves expansion pricing for playtest validation; retain the existing provisional default.
    slotExpansionCost: 2,
  }
}

export const STANDARD_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: STANDARD_DRAFT_RULEBOOK_ID,
    name: 'Standard Draft',
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
      startingActiveSlots: 7,
      overflowSlots: 1,
      maxActiveSlots: 12,
    },
    economyRules: balanceEconomy(45),
    pullDistribution: {
      type: 'custom',
      buckets: [
        // #58 only names 3★–6★ rates. For the first executable pass, 1★/2★ share the low-rarity bucket.
        { id: '3', weight: 20, rarities: [1, 2, 3] },
        { id: '4', weight: 45, rarities: [4] },
        { id: '5', weight: 25, rarities: [5] },
        { id: '6', weight: 10, rarities: [6] },
      ],
    },
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
    offerSize: 4,
    pricingProfileId: SHARED_BALANCE_PRICING_PROFILE_ID,
    maxRounds: 15,
    actionRules: balanceActionRules(2, 3),
    capacityRules: {
      enabled: true,
      startingActiveSlots: 8,
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
      startingActiveSlots: 8,
      overflowSlots: 1,
      maxActiveSlots: 12,
    },
    economyRules: balanceEconomy(70),
    pullDistribution: {
      type: 'custom',
      buckets: [
        // #58 only names 3★–6★ rates. For the first executable pass, 1★/2★ share the low-rarity bucket.
        { id: '3', weight: 15, rarities: [1, 2, 3] },
        { id: '4', weight: 40, rarities: [4] },
        { id: '5', weight: 30, rarities: [5] },
        { id: '6', weight: 15, rarities: [6] },
      ],
    },
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

export const BUILT_IN_DRAFT_RULEBOOKS: readonly DraftRulebook[] = [
  STANDARD_DRAFT_RULEBOOK,
  DEV_STRICT_DRAFT_RULEBOOK,
  ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK,
  DEV_LAX_DRAFT_RULEBOOK,
]

export function createEmptyDraftRulebookEligibility(): DraftRulebookEligibility {
  return { allOf: [], anyOf: [], noneOf: [] }
}
