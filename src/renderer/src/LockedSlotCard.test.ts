import { describe, expect, it } from 'vitest'
import type { SlotConstraint } from '../../shared/constraints'
import type { Operator, OperatorClass } from '../../shared/operator'
import { lockedSlotPresentation } from './LockedSlotCard'

function operator(
  id: string,
  name: string,
  operatorClass: OperatorClass,
  mandatoryExclusivityGroup: string | null = null,
  subclassId = 'test',
): Operator {
  return {
    id,
    name,
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
    mandatoryExclusivityGroup,
    imageFile: `operators/${id}.png`,
  }
}

const amiyaForms = [
  operator('char_002_amiya', 'Amiya (Caster)', 'Caster', 'amiya-forms', 'corecaster'),
  operator('char_1001_amiya2', 'Amiya (Guard)', 'Guard', 'amiya-forms', 'artsfghter'),
  operator('char_1037_amiya3', 'Amiya (Medic)', 'Medic', 'amiya-forms', 'incantationmedic'),
]

function constraint(overrides: Partial<SlotConstraint>): SlotConstraint {
  return { rarities: [], classes: [], ...overrides }
}

describe('locked slot presentation', () => {
  it('uses the exact operator portrait for an exact operator lock', () => {
    const exusiai = operator('char_103_angel', 'Exusiai', 'Sniper')
    expect(lockedSlotPresentation(constraint({ operatorId: exusiai.id }), [exusiai])).toEqual({
      operator: exusiai,
      classes: ['Sniper'],
      rarities: [],
    })
  })

  it('carries selected rarities so the locked-card border can use the slot gradient', () => {
    const exusiai = operator('char_103_angel', 'Exusiai', 'Sniper')
    expect(
      lockedSlotPresentation(constraint({ rarities: [5, 4], operatorId: exusiai.id }), [exusiai]),
    ).toEqual({ operator: exusiai, classes: ['Sniper'], rarities: [5, 4] })
  })

  it('defaults Amiya to Caster and exposes all eligible form classes in order', () => {
    expect(
      lockedSlotPresentation(constraint({ mandatoryExclusivityGroup: 'amiya-forms' }), amiyaForms),
    ).toEqual({ operator: amiyaForms[0], classes: ['Caster', 'Guard', 'Medic'], rarities: [] })
  })

  it('keeps the Caster base portrait while multiple non-Caster forms remain eligible', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Guard', 'Medic'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[0], classes: ['Guard', 'Medic'], rarities: [] })
  })

  it('uses the Guard form when Guard is the only eligible Amiya class', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Guard'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[1], classes: ['Guard'], rarities: [] })
  })

  it('uses the Medic form when Medic is the only eligible Amiya class', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Medic'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[2], classes: ['Medic'], rarities: [] })
  })

  it('lets a subclass filter narrow the visible Amiya form icons while preserving class order', () => {
    expect(
      lockedSlotPresentation(
        constraint({
          subclasses: ['artsfghter', 'incantationmedic'],
          mandatoryExclusivityGroup: 'amiya-forms',
        }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[0], classes: ['Guard', 'Medic'], rarities: [] })
  })
})
