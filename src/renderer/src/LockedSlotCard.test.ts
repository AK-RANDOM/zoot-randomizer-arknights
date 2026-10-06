import { describe, expect, it } from 'vitest'
import type { SlotConstraint } from '../../shared/constraints'
import type { Operator, OperatorClass } from '../../shared/operator'
import { lockedSlotPresentation } from './LockedSlotCard'

function operator(
  id: string,
  name: string,
  operatorClass: OperatorClass,
  mandatoryExclusivityGroup: string | null = null,
): Operator {
  return {
    id,
    name,
    rarity: 5,
    class: operatorClass,
    subclass: { id: 'test', name: 'Test' },
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
  operator('char_002_amiya', 'Amiya (Caster)', 'Caster', 'amiya-forms'),
  operator('char_1001_amiya2', 'Amiya (Guard)', 'Guard', 'amiya-forms'),
  operator('char_1037_amiya3', 'Amiya (Medic)', 'Medic', 'amiya-forms'),
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
    })
  })

  it('defaults Amiya to Caster and exposes all eligible form classes in order', () => {
    expect(
      lockedSlotPresentation(constraint({ mandatoryExclusivityGroup: 'amiya-forms' }), amiyaForms),
    ).toEqual({ operator: amiyaForms[0], classes: ['Caster', 'Guard', 'Medic'] })
  })

  it('keeps the Caster base portrait while multiple non-Caster forms remain eligible', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Guard', 'Medic'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[0], classes: ['Guard', 'Medic'] })
  })

  it('uses the Guard form when Guard is the only eligible Amiya class', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Guard'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[1], classes: ['Guard'] })
  })

  it('uses the Medic form when Medic is the only eligible Amiya class', () => {
    expect(
      lockedSlotPresentation(
        constraint({ classes: ['Medic'], mandatoryExclusivityGroup: 'amiya-forms' }),
        amiyaForms,
      ),
    ).toEqual({ operator: amiyaForms[2], classes: ['Medic'] })
  })
})
