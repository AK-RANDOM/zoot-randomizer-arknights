import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import { resolveDraftRulebookExecution } from './draftRulebookExecution'
import { STANDARD_DRAFT_RULEBOOK } from './draftRulebook'
import type { DraftPricingProfile } from './draftPricingProfile'

const operators = [
  { id: 'char_a', name: 'A', rarity: 5, class: 'Guard' },
  { id: 'char_b', name: 'B', rarity: 6, class: 'Sniper' },
] as Operator[]

describe('Draft Rulebook execution', () => {
  it('rejects invalid in-progress Rulebooks without falling back to defaults', () => {
    const rulebook = structuredClone(STANDARD_DRAFT_RULEBOOK)
    rulebook.generalRules.offerSize = 0
    const result = resolveDraftRulebookExecution(rulebook, operators, operators)
    expect(result.valid).toBe(false)
    expect(result.configuration).toBeNull()
    expect(result.pool).toEqual([])
  })

  it('layers pricing profile base costs below Rulebook operator overrides', () => {
    const rulebook = structuredClone(STANDARD_DRAFT_RULEBOOK)
    rulebook.generalRules.pricingProfileId = 'local:pricing:test'
    rulebook.generalRules.economyRules = {
      enabled: true,
      rarityCosts: { 1: -7, 2: -4, 3: -3, 4: 0, 5: 7, 6: 21 },
    }
    rulebook.overrides.operatorCosts = { char_b: 50 }
    const profile: DraftPricingProfile = {
      schemaVersion: 1,
      id: 'local:pricing:test',
      name: 'Test',
      description: '',
      createdAt: '2026-10-10T00:00:00.000Z',
      revision: '1',
      operatorCosts: { char_a: 8, char_b: 45 },
    }
    const result = resolveDraftRulebookExecution(rulebook, operators, operators, [profile])
    expect(result.valid).toBe(true)
    expect(result.configuration?.economyRules.operatorCostOverrides).toEqual({
      char_a: 8,
      char_b: 50,
    })
  })

  it('fails explicitly when a referenced pricing profile is unavailable', () => {
    const rulebook = structuredClone(STANDARD_DRAFT_RULEBOOK)
    rulebook.generalRules.pricingProfileId = 'local:pricing:missing'
    const result = resolveDraftRulebookExecution(rulebook, operators, operators)
    expect(result.valid).toBe(false)
    expect(result.validation.errors).toContain(
      'Pricing profile “local:pricing:missing” is not available.',
    )
  })
})
