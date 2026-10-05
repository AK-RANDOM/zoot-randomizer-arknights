import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import type { DraftRulebookEligibility } from './draftRulebook'
import {
  matchesDraftRulebookEligibility,
  matchesDraftRulebookSelector,
  resolveDraftRulebookPool,
  resolveDraftRulebookSelector,
} from './draftRulebookPool'

function operator(
  id: string,
  overrides: Partial<Operator> & Pick<Operator, 'rarity' | 'class'>,
): Operator {
  return {
    id,
    name: id,
    rarity: overrides.rarity,
    class: overrides.class,
    subclass: overrides.subclass ?? { id: 'sub_default', name: 'Default' },
    faction: overrides.faction ?? {
      nationId: null,
      groupId: null,
      teamId: null,
      primary: [],
      main: null,
      affiliations: [],
    },
    raceIds: overrides.raceIds ?? ['race:cn:default'],
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

const exusiai = operator('char_exusiai', {
  rarity: 6,
  class: 'Sniper',
  subclass: { id: 'sub_marksman', name: 'Marksman' },
  faction: {
    nationId: 'nation_laterano',
    groupId: 'group_penguin',
    teamId: null,
    primary: ['nation_laterano', 'group_penguin'],
    main: 'group_penguin',
    affiliations: ['nation_laterano', 'group_penguin'],
  },
  raceIds: ['race:cn:sankta'],
})

const gladiia = operator('char_gladiia', {
  rarity: 6,
  class: 'Specialist',
  subclass: { id: 'sub_hookmaster', name: 'Hookmaster' },
  faction: {
    nationId: 'nation_aegir',
    groupId: null,
    teamId: 'team_abyssal',
    primary: ['nation_aegir', 'team_abyssal'],
    main: 'team_abyssal',
    affiliations: ['nation_aegir', 'team_abyssal'],
  },
  raceIds: ['race:cn:aegir'],
})

const noirCorne = operator('char_noir', {
  rarity: 2,
  class: 'Defender',
  subclass: { id: 'sub_protector', name: 'Protector' },
  faction: {
    nationId: 'nation_higashi',
    groupId: 'group_rhodes',
    teamId: null,
    primary: ['nation_higashi', 'group_rhodes'],
    main: 'group_rhodes',
    affiliations: ['nation_higashi', 'group_rhodes'],
  },
  raceIds: ['race:cn:oni'],
})

const allOperators = [exusiai, gladiia, noirCorne]

describe('Draft Rulebook selector resolution', () => {
  it('matches every supported selector kind using stable metadata IDs', () => {
    expect(matchesDraftRulebookSelector(exusiai, {
      type: 'operators',
      operatorIds: ['char_exusiai'],
    })).toBe(true)
    expect(matchesDraftRulebookSelector(exusiai, {
      type: 'rarities',
      rarities: [5, 6],
    })).toBe(true)
    expect(matchesDraftRulebookSelector(exusiai, {
      type: 'classes',
      classes: ['Sniper'],
    })).toBe(true)
    expect(matchesDraftRulebookSelector(exusiai, {
      type: 'subclasses',
      subclassIds: ['sub_marksman'],
    })).toBe(true)
    expect(matchesDraftRulebookSelector(gladiia, {
      type: 'factions',
      factionIds: ['team_abyssal'],
    })).toBe(true)
    expect(matchesDraftRulebookSelector(gladiia, {
      type: 'races',
      raceIds: ['race:cn:aegir'],
    })).toBe(true)
  })

  it('composes allOf, anyOf and noneOf predictably', () => {
    const eligibility: DraftRulebookEligibility = {
      allOf: [{ type: 'rarities', rarities: [6] }],
      anyOf: [
        { type: 'classes', classes: ['Sniper'] },
        { type: 'factions', factionIds: ['team_abyssal'] },
      ],
      noneOf: [{ type: 'operators', operatorIds: ['char_gladiia'] }],
    }

    expect(matchesDraftRulebookEligibility(exusiai, eligibility)).toBe(true)
    expect(matchesDraftRulebookEligibility(gladiia, eligibility)).toBe(false)
    expect(matchesDraftRulebookEligibility(noirCorne, eligibility)).toBe(false)
  })

  it('treats an empty eligibility document as unrestricted', () => {
    const eligibility: DraftRulebookEligibility = { allOf: [], anyOf: [], noneOf: [] }
    expect(allOperators.filter((item) => matchesDraftRulebookEligibility(item, eligibility))).toEqual(
      allOperators,
    )
  })

  it('resolves selectors without expanding them in the Rulebook document', () => {
    expect(resolveDraftRulebookSelector(allOperators, {
      type: 'factions',
      factionIds: ['group_penguin'],
    }).map((item) => item.id)).toEqual(['char_exusiai'])
  })
})

describe('Draft Rulebook Pool Source resolution', () => {
  const globalPool = [exusiai, noirCorne]

  it('inherits the already-resolved Global Pool unchanged', () => {
    expect(resolveDraftRulebookPool({ source: 'inherit-global' }, allOperators, globalPool)).toEqual(
      globalPool,
    )
  })

  it('applies Rulebook restrictions only inside the Global Pool', () => {
    const result = resolveDraftRulebookPool(
      {
        source: 'global-restrictions',
        eligibility: {
          allOf: [],
          anyOf: [{ type: 'rarities', rarities: [6] }],
          noneOf: [],
        },
      },
      allOperators,
      globalPool,
    )

    expect(result.map((item) => item.id)).toEqual(['char_exusiai'])
    expect(result.some((item) => item.id === 'char_gladiia')).toBe(false)
  })

  it('lets an explicit Rulebook Pool ignore Global Pool exclusions', () => {
    const result = resolveDraftRulebookPool(
      {
        source: 'rulebook-pool',
        eligibility: {
          allOf: [],
          anyOf: [{ type: 'factions', factionIds: ['team_abyssal'] }],
          noneOf: [],
        },
      },
      allOperators,
      globalPool,
    )

    expect(result.map((item) => item.id)).toEqual(['char_gladiia'])
  })
})
