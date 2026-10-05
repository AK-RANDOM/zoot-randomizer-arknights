import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from './draftRulebook'
import { resolveDraftRulebookExecution } from './draftRulebookExecution'

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

function operator(id: string, factionId: string): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'sub_fighter', name: 'Fighter' },
    faction: {
      nationId: null,
      groupId: factionId,
      teamId: null,
      primary: [factionId],
      main: factionId,
      affiliations: [factionId],
    },
    raceIds: ['race:cn:test'],
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: null, yearGroup: null },
      global: { date: null, yearGroup: null },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }
}

const globalOp = operator('char_global', 'group_global')
const excludedOp = operator('char_excluded', 'group_special')
const dataset = [globalOp, excludedOp]
const globalPool = [globalOp]

describe('Draft Rulebook execution resolution', () => {
  it('executes the built-in Standard Rulebook against the Global Pool', () => {
    const result = resolveDraftRulebookExecution(STANDARD_DRAFT_RULEBOOK, dataset, globalPool)

    expect(result.valid).toBe(true)
    expect(result.pool).toEqual(globalPool)
    expect(result.configuration?.pullDistribution).toEqual({ type: 'equal' })
    expect(result.poolSourceLabel).toBe('Inherit Global Pool')
  })

  it('keeps Standard Draft behavior locked to the declarative Rulebook', () => {
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.offerSize).toBe(3)
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.pullDistribution).toEqual({ type: 'equal' })
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.economyRules).toEqual({ enabled: false })
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.capacityRules).toEqual({ enabled: false })
    expect(STANDARD_DRAFT_RULEBOOK.generalRules.actionRules).toEqual({
      hold: { enabled: false },
      forfeit: { enabled: false },
      reroll: { enabled: false },
      slotExpansion: { enabled: false },
    })
    expect(STANDARD_DRAFT_RULEBOOK.pool).toEqual({ source: 'inherit-global' })
    expect(STANDARD_DRAFT_RULEBOOK.overrides).toEqual({ operatorCosts: {} })
    expect(STANDARD_DRAFT_RULEBOOK.interactions).toEqual([])
  })

  it('uses the same execution contract for built-in, local, and imported Rulebooks', () => {
    const local = cloneStandard()
    local.identifier.id = 'local:test-rulebook'
    local.identifier.name = 'Local Test Rulebook'

    const imported = cloneStandard()
    imported.identifier.id = 'portable:test-rulebook'
    imported.identifier.name = 'Imported Test Rulebook'

    for (const rulebook of [STANDARD_DRAFT_RULEBOOK, local, imported]) {
      const result = resolveDraftRulebookExecution(rulebook, dataset, globalPool)
      expect(result.valid).toBe(true)
      expect(result.pool).toEqual(globalPool)
      expect(result.configuration?.pullDistribution).toEqual({ type: 'equal' })
      expect(result.poolSourceLabel).toBe('Inherit Global Pool')
      expect(result.identityKey).toContain(rulebook.identifier.id)
    }
  })

  it('keeps Global + Restrictions restrictive-only', () => {
    const rulebook = cloneStandard()
    rulebook.pool = {
      source: 'global-restrictions',
      eligibility: {
        allOf: [],
        anyOf: [{ type: 'factions', factionIds: ['group_special'] }],
        noneOf: [],
      },
    }

    const result = resolveDraftRulebookExecution(rulebook, dataset, globalPool)
    expect(result.pool).toEqual([])
  })

  it('lets Rulebook Pool resolve operators outside the Global Pool', () => {
    const rulebook = cloneStandard()
    rulebook.pool = {
      source: 'rulebook-pool',
      eligibility: {
        allOf: [],
        anyOf: [{ type: 'factions', factionIds: ['group_special'] }],
        noneOf: [],
      },
    }

    const result = resolveDraftRulebookExecution(rulebook, dataset, globalPool)
    expect(result.pool.map((item) => item.id)).toEqual(['char_excluded'])
  })

  it('does not silently fall back when a Rulebook is invalid', () => {
    const rulebook = cloneStandard()
    rulebook.identifier.name = ''

    const result = resolveDraftRulebookExecution(rulebook, dataset, globalPool)
    expect(result.valid).toBe(false)
    expect(result.pool).toEqual([])
    expect(result.configuration).toBeNull()
    expect(result.validation.errors.length).toBeGreaterThan(0)
  })

  it('changes its execution identity when portable Rulebook content changes', () => {
    const first = cloneStandard()
    const second = cloneStandard()
    second.generalRules.pullDistribution = { type: 'arknights' }

    expect(resolveDraftRulebookExecution(first, dataset, globalPool).identityKey)
      .not.toBe(resolveDraftRulebookExecution(second, dataset, globalPool).identityKey)
  })
})
