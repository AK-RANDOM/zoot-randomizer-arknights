import { describe, expect, it } from 'vitest'
import {
  ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK,
  BUILT_IN_DRAFT_RULEBOOKS,
  DEV_LAX_DRAFT_RULEBOOK,
  DEV_STRICT_DRAFT_RULEBOOK,
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  STANDARD_DRAFT_RULEBOOK,
  deserializeDraftRulebook,
  resolveDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
} from './draftRulebook'
import { SHARED_BALANCE_PRICING_PROFILE_ID } from './draftPricingProfile'

describe('Draft Rulebook', () => {
  it('keeps Standard Draft valid and behaviorally simple', () => {
    expect(validateDraftRulebook(STANDARD_DRAFT_RULEBOOK)).toEqual({ valid: true, errors: [] })
    const resolved = resolveDraftRulebook(STANDARD_DRAFT_RULEBOOK)
    expect(resolved.offerSize).toBe(3)
    expect(resolved.configuration.offerSize).toBe(3)
    expect(resolved.configuration.maxRounds).toBeNull()
    expect(resolved.configuration.economyRules.enabled).toBe(false)
  })

  it('ships the three #58 balance presets as valid built-ins', () => {
    expect(BUILT_IN_DRAFT_RULEBOOKS).toHaveLength(4)
    expect(BUILT_IN_DRAFT_RULEBOOKS.map((rulebook) => rulebook.identifier.name)).toEqual([
      'Standard Draft',
      'Dev Strict',
      'Arknights Headhunting',
      'Dev Lax',
    ])
    for (const rulebook of [
      DEV_STRICT_DRAFT_RULEBOOK,
      ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK,
      DEV_LAX_DRAFT_RULEBOOK,
    ]) {
      expect(validateDraftRulebook(rulebook)).toEqual({ valid: true, errors: [] })
      expect(rulebook.generalRules.pricingProfileId).toBe(SHARED_BALANCE_PRICING_PROFILE_ID)
    }
  })

  it('round-trips schema v4 without mutation', () => {
    const serialized = serializeDraftRulebook(DEV_STRICT_DRAFT_RULEBOOK)
    const imported = deserializeDraftRulebook(serialized)
    expect(imported).toEqual(DEV_STRICT_DRAFT_RULEBOOK)
    expect(imported.schemaVersion).toBe(DRAFT_RULEBOOK_SCHEMA_VERSION)
  })
})
