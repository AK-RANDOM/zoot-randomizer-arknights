import { describe, expect, it } from 'vitest'
import {
  cloneSlotConstraint,
  createDefaultConstraints,
  type SlotConstraint,
} from './constraints'
import type { Operator, OperatorClass } from './operator'
import { cloneSquadConfiguration } from './presets'
import { constraintsWithSlotDraft, operatorMatchesSlotConstraint } from './randomizer'

function operator(
  id: string,
  operatorClass: OperatorClass,
  subclassId: string,
): Operator {
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

function slot(overrides: Partial<SlotConstraint> = {}): SlotConstraint {
  return { rarities: [], classes: [], ...overrides }
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

  it('preserves explicit subclass filters through squad preset cloning', () => {
    const constraints = createDefaultConstraints()
    constraints.slots[0] = slot({ subclasses: ['subclass:pioneer'] })

    const cloned = cloneSquadConfiguration(constraints)
    expect(cloned.slots[0].subclasses).toEqual(['subclass:pioneer'])
    cloned.slots[0].subclasses!.push('subclass:charger')
    expect(constraints.slots[0].subclasses).toEqual(['subclass:pioneer'])
  })
})
