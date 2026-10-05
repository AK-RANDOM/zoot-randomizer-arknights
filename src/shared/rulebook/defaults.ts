import { DRAFT_OFFER_SIZE } from '../draft'
import {
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  type DraftRulebook,
  type DraftRulebookEligibility,
} from './types'

export const STANDARD_DRAFT_RULEBOOK_ID = 'builtin:standard-draft' as const

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

export function createEmptyDraftRulebookEligibility(): DraftRulebookEligibility {
  return { allOf: [], anyOf: [], noneOf: [] }
}
