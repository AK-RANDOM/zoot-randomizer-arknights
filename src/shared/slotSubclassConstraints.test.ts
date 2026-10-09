import { describe, expect, it } from 'vitest'
import {
  cloneSlotConstraint,
  createDefaultConstraints,
  type SlotConstraint,
} from './constraints'
import type { Operator, OperatorClass } from './operator'
import {
  applySquadConfiguration,
  cloneSquadConfiguration,
  squadConfigurationFromConstraints,
} from './presets'
import {
  canSlotResolveTo,
  constraintsWithSlotDraft,
  generateSquad,
  operatorMatchesSlotConstraint,
  validateConstraints,
} from './randomizer'

function operator(id: string, operatorClass: OperatorClass, subclassId: string): Operator {
  return {
    id,
    name: id,
    rarity: 5,
    class: operatorClass,
    subclass: { id: subclassId, name: subclassId },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2020-01-01', yearGroup: 1 },
      global: { date: '2020-01-01', yearGroup: 1 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

const pioneer = operator('pioneer', 'Vanguard', 'subclass:pioneer')
const charger = operator('charger', 'Vanguard', 'subclass:charger')
const mystic = operator('mystic', 'Caster', 'subclass:mystic')
const pool = [pioneer, charger, mystic]

function slot(overrides: Partial<SlotConstraint> = {}): SlotConstraint {
  return { rarities: [], classes: [], ...overrides }
}

function seededRandom(): () => number {
  let state = 7
  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

describe('per-slot subclass constraints', () => {
  it('treats an absent subclass set as Any subclass', () => {
    expect(operatorMatchesSlotConstraint(pioneer, slot())).toBe(true)
    expect(operatorMatchesSlotConstraint(charger, slot())).toBe(true)
  })

  it('matches only explicitly allowed subclass IDs once the filter is defined', () => {
    const constraint = slot({ subclasses: ['subclass:pioneer'] })
    expect(operatorMatchesSlotConstraint(pioneer, constraint)).toBe(true)
    expect(operatorMatchesSlotConstraint(charger, constraint)).toBe(false)
  })

  it('allows an explicit empty subclass set to represent None', () => {
    const constraint = slot({ subclasses: [] })
    expect(operatorMatchesSlotConstraint(pioneer, constraint)).toBe(false)
    expect(operatorMatchesSlotConstraint(charger, constraint)).toBe(false)
  })

  it('derives subclass-only eligibility from the selected subclasses parent classes only', () => {
    const constraint = slot({ subclasses: ['subclass:pioneer'] })
    expect(operatorMatchesSlotConstraint(pioneer, constraint)).toBe(true)
    expect(operatorMatchesSlotConstraint(charger, constraint)).toBe(false)
    expect(operatorMatchesSlotConstraint(mystic, constraint)).toBe(false)
  })

  it('keeps a fully enabled class unrestricted while another class is partially filtered', () => {
    const constraint = slot({
      classes: ['Vanguard', 'Caster'],
      subclasses: ['subclass:pioneer', 'subclass:charger'],
    })
    expect(operatorMatchesSlotConstraint(pioneer, constraint)).toBe(true)
    expect(operatorMatchesSlotConstraint(charger, constraint)).toBe(true)
    expect(operatorMatchesSlotConstraint(mystic, constraint)).toBe(false)
  })

  it('generates from the selected subclass allow-list', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 1
    constraints.slots[0] = slot({ classes: ['Vanguard'], subclasses: ['subclass:charger'] })

    expect(validateConstraints(constraints, pool).valid).toBe(true)
    expect(generateSquad(pool, constraints, seededRandom())[0].id).toBe('charger')
  })

  it('supports subclass feasibility probes', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 1
    const draft = slot({ classes: ['Vanguard'] })

    expect(
      canSlotResolveTo(pool, constraints, 0, draft, { subclassId: 'subclass:pioneer' }),
    ).toBe(true)
    expect(
      canSlotResolveTo(pool, constraints, 0, draft, { subclassId: 'subclass:mystic' }),
    ).toBe(false)
  })

  it('clones and drafts subclass sets without sharing the source array', () => {
    const source = slot({ subclasses: ['subclass:pioneer'] })
    const cloned = cloneSlotConstraint(source)
    expect(cloned.subclasses).toEqual(['subclass:pioneer'])
    cloned.subclasses!.push('subclass:charger')
    expect(source.subclasses).toEqual(['subclass:pioneer'])

    const constraints = createDefaultConstraints()
    const drafted = constraintsWithSlotDraft(constraints, 0, source)
    expect(drafted.slots[0].subclasses).toEqual(['subclass:pioneer'])
    expect(constraints.slots[0].subclasses).toBeUndefined()
  })

  it('preserves explicit subclass filters through squad preset cloning and application', () => {
    const constraints = createDefaultConstraints()
    constraints.slots[0] = slot({ subclasses: ['subclass:pioneer'] })

    const cloned = cloneSquadConfiguration(constraints)
    expect(cloned.slots[0].subclasses).toEqual(['subclass:pioneer'])
    cloned.slots[0].subclasses!.push('subclass:charger')
    expect(constraints.slots[0].subclasses).toEqual(['subclass:pioneer'])

    const saved = squadConfigurationFromConstraints(constraints)
    const applied = applySquadConfiguration(createDefaultConstraints(), saved)
    expect(applied.slots[0].subclasses).toEqual(['subclass:pioneer'])
  })
})
