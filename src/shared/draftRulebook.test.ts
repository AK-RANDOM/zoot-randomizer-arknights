import { describe, expect, it } from 'vitest'
import { STANDARD_DRAFT_CONFIGURATION } from './draft'
import { SHARED_BALANCE_PRICING_PROFILE_ID } from './draftPricingProfile'
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
  type DraftRulebook,
} from './draftRulebook'

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

describe('Draft Rulebook foundation', () => {
  it('represents Standard Draft as a portable built-in Rulebook', () => {
    expect(DRAFT_RULEBOOK_SCHEMA_VERSION).toBe(4)
    expect(validateDraftRulebook(STANDARD_DRAFT_RULEBOOK)).toEqual({ valid: true, errors: [] })

    const resolved = resolveDraftRulebook(STANDARD_DRAFT_RULEBOOK)
    expect(resolved.configuration).toEqual(STANDARD_DRAFT_CONFIGURATION)
    expect(resolved.offerSize).toBe(3)
    expect(resolved.pool).toEqual({ source: 'inherit-global' })
    expect(resolved.interactions).toEqual([])
  })

  it('ships valid #58 balance presets with their locked M2 runtime values', () => {
    for (const rulebook of BUILT_IN_DRAFT_RULEBOOKS) {
      expect(validateDraftRulebook(rulebook)).toEqual({ valid: true, errors: [] })
    }

    for (const rulebook of [
      DEV_STRICT_DRAFT_RULEBOOK,
      ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK,
      DEV_LAX_DRAFT_RULEBOOK,
    ]) {
      expect(rulebook.generalRules.pricingProfileId).toBe(SHARED_BALANCE_PRICING_PROFILE_ID)
    }

    const strict = resolveDraftRulebook(DEV_STRICT_DRAFT_RULEBOOK).configuration
    expect(strict).toMatchObject({
      offerSize: 3,
      maxRounds: 15,
      capacityRules: { enabled: true, startingActiveSlots: 7, overflowSlots: 1 },
      economyRules: { enabled: true, startingPoints: 45, forfeitRebate: 4 },
      actionRules: { reroll: { perDraftLimit: 3, cooldownRounds: 3 } },
    })
    expect(strict.economyRules.rarityCosts[5]).toBe(7)
    expect(strict.economyRules.holdUpkeep).toEqual({
      mode: 'schedule',
      costs: [2, 2, 3, 5, 6],
      repeatLast: true,
    })
    expect(strict.pullDistribution).toMatchObject({
      type: 'custom',
      buckets: [
        { id: '3', weight: 20, rarities: [1, 2, 3] },
        { id: '4', weight: 45, rarities: [4] },
        { id: '5', weight: 25, rarities: [5] },
        { id: '6', weight: 10, rarities: [6] },
      ],
    })

    const arknights = resolveDraftRulebook(ARKNIGHTS_HEADHUNTING_DRAFT_RULEBOOK).configuration
    expect(arknights).toMatchObject({
      offerSize: 4,
      maxRounds: 15,
      capacityRules: { enabled: true, startingActiveSlots: 8, overflowSlots: 1 },
      economyRules: { enabled: true, startingPoints: 55, forfeitRebate: 4 },
      actionRules: { reroll: { perDraftLimit: 2, cooldownRounds: 3 } },
      pullDistribution: { type: 'arknights', firstTenActualFiveStarGuarantee: true },
    })

    const lax = resolveDraftRulebook(DEV_LAX_DRAFT_RULEBOOK).configuration
    expect(lax).toMatchObject({
      offerSize: 4,
      maxRounds: 15,
      capacityRules: { enabled: true, startingActiveSlots: 8, overflowSlots: 1 },
      economyRules: { enabled: true, startingPoints: 70, forfeitRebate: 4 },
      actionRules: { reroll: { perDraftLimit: 4, cooldownRounds: 2 } },
    })
    expect(lax.pullDistribution).toMatchObject({
      type: 'custom',
      buckets: [
        { id: '3', weight: 15, rarities: [1, 2, 3] },
        { id: '4', weight: 40, rarities: [4] },
        { id: '5', weight: 30, rarities: [5] },
        { id: '6', weight: 15, rarities: [6] },
      ],
    })
  })

  it('round-trips through the human-readable JSON interchange format', () => {
    const serialized = serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK)
    expect(serialized).toContain('"schemaVersion": 4')
    expect(serialized).toContain('"Standard Draft"')
    expect(deserializeDraftRulebook(serialized)).toEqual(STANDARD_DRAFT_RULEBOOK)
  })

  it('keeps schema version and author revision distinct', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.revision = '2026.10-balance-2'

    expect(rulebook.schemaVersion).toBe(4)
    expect(validateDraftRulebook(rulebook).valid).toBe(true)
    expect(resolveDraftRulebook(rulebook).revision).toBe('2026.10-balance-2')
  })

  it('resolves declarative engine rules and static operator cost overrides', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.id = 'test:advanced'
    rulebook.generalRules = {
      offerSize: 3,
      actionRules: { reroll: { enabled: true, perRoundLimit: 2 } },
      capacityRules: { enabled: true, startingActiveSlots: 6, overflowSlots: 1 },
      economyRules: { enabled: true, startingPoints: 20, rerollCost: 3 },
      pullDistribution: { type: 'arknights' },
    }
    rulebook.overrides.operatorCosts = { char_test: 17 }

    const resolved = resolveDraftRulebook(rulebook)
    expect(resolved.configuration.actionRules.reroll).toMatchObject({
      enabled: true,
      perRoundLimit: 2,
    })
    expect(resolved.configuration.capacityRules).toMatchObject({
      enabled: true,
      startingActiveSlots: 6,
      overflowSlots: 1,
    })
    expect(resolved.configuration.economyRules).toMatchObject({
      enabled: true,
      startingPoints: 20,
      rerollCost: 3,
    })
    expect(resolved.configuration.economyRules.operatorCostOverrides).toEqual({ char_test: 17 })
    expect(resolved.configuration.pullDistribution).toEqual({ type: 'arknights' })
  })

  it('resolves static, escalating, and scheduled Hold upkeep as portable economy rules', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.economyRules = {
      enabled: true,
      holdUpkeep: { mode: 'static', cost: 3 },
    }
    expect(resolveDraftRulebook(rulebook).configuration.economyRules.holdUpkeep).toEqual({
      mode: 'static',
      cost: 3,
    })

    rulebook.generalRules.economyRules.holdUpkeep = {
      mode: 'escalating',
      baseCost: 2,
      escalation: 1,
    }
    expect(validateDraftRulebook(rulebook).valid).toBe(true)
    expect(resolveDraftRulebook(rulebook).configuration.economyRules.holdUpkeep).toEqual({
      mode: 'escalating',
      baseCost: 2,
      escalation: 1,
    })

    rulebook.generalRules.economyRules.holdUpkeep = {
      mode: 'schedule',
      costs: [2, 2, 3, 5, 6],
      repeatLast: true,
    }
    expect(validateDraftRulebook(rulebook).valid).toBe(true)
    expect(resolveDraftRulebook(rulebook).configuration.economyRules.holdUpkeep).toEqual({
      mode: 'schedule',
      costs: [2, 2, 3, 5, 6],
      repeatLast: true,
    })
  })

  it('models future pool selectors and interactions without expanding them into operator lists', () => {
    const rulebook = cloneStandard()
    rulebook.pool = {
      source: 'global-restrictions',
      eligibility: {
        allOf: [{ type: 'classes', classes: ['Guard'] }],
        anyOf: [],
        noneOf: [{ type: 'operators', operatorIds: ['char_wang'] }],
      },
    }
    rulebook.interactions = [
      {
        id: 'abyssal-anchor',
        type: 'anchor',
        source: { type: 'operators', operatorIds: ['char_gladiia'] },
        target: { type: 'factions', factionIds: ['team_abyssal'] },
        modifier: 6,
      },
    ]

    expect(validateDraftRulebook(rulebook).valid).toBe(true)
    const resolved = resolveDraftRulebook(rulebook)
    expect(resolved.pool).toEqual(rulebook.pool)
    expect(resolved.interactions).toEqual(rulebook.interactions)
  })

  it('rejects unsupported schema/features and unknown executable-looking fields', () => {
    const wrongSchema = cloneStandard() as unknown as { schemaVersion: number } & Record<
      string,
      unknown
    >
    wrongSchema.schemaVersion = 5
    expect(validateDraftRulebook(wrongSchema).valid).toBe(false)

    const variableOffer = cloneStandard()
    variableOffer.generalRules.offerSize = 4
    variableOffer.generalRules.maxRounds = 15
    expect(validateDraftRulebook(variableOffer)).toEqual({ valid: true, errors: [] })
    expect(resolveDraftRulebook(variableOffer).configuration).toMatchObject({
      offerSize: 4,
      maxRounds: 15,
    })

    const withScript = cloneStandard() as DraftRulebook & { script?: string }
    withScript.script = 'doSomething()'
    expect(validateDraftRulebook(withScript).errors).toContain('rulebook.script is not supported.')
  })

  it('rejects malformed nested engine rules instead of silently defaulting them', () => {
    const malformedAction = cloneStandard() as unknown as {
      generalRules: { actionRules: unknown }
    }
    malformedAction.generalRules.actionRules = { reroll: 'yes' }
    expect(validateDraftRulebook(malformedAction).errors.join(' ')).toContain(
      'rulebook.generalRules.actionRules.reroll must be an object',
    )

    const malformedCapacity = cloneStandard() as unknown as {
      generalRules: { capacityRules: unknown }
    }
    malformedCapacity.generalRules.capacityRules = { enabled: 'yes' }
    expect(validateDraftRulebook(malformedCapacity).errors.join(' ')).toContain(
      'rulebook.generalRules.capacityRules.enabled must be boolean',
    )

    const malformedUpkeep = cloneStandard() as unknown as {
      generalRules: { economyRules: unknown }
    }
    malformedUpkeep.generalRules.economyRules = {
      holdUpkeep: { mode: 'escalating', baseCost: 2, escalation: -1 },
    }
    expect(validateDraftRulebook(malformedUpkeep).errors.join(' ')).toContain(
      'holdUpkeep.escalation must be a non-negative finite number',
    )
  })

  it('rejects ambiguous custom probability buckets during import validation', () => {
    const rulebook = cloneStandard()
    rulebook.generalRules.pullDistribution = {
      type: 'custom',
      buckets: [
        { id: 'low', weight: 50, rarities: [1, 2, 3] },
        { id: 'high', weight: 50, rarities: [3, 4, 5, 6] },
      ],
    }

    const validation = validateDraftRulebook(rulebook)
    expect(validation.valid).toBe(false)
    expect(validation.errors.join(' ')).toContain('rarity 3 belongs to multiple buckets')
  })

  it('reports malformed JSON distinctly from an invalid Rulebook document', () => {
    expect(() => deserializeDraftRulebook('{oops')).toThrow('not valid JSON')
    expect(() => deserializeDraftRulebook('{}')).toThrow('Invalid Draft Rulebook')
  })
})
