import { describe, expect, it } from 'vitest'
import type { SlotConstraint } from '../../shared/constraints'
import {
  operatorClasses,
  type Operator,
  type OperatorClass,
} from '../../shared/operator'
import {
  buildSlotClassIndicatorItems,
  splitSlotClassIndicatorItems,
} from './SlotClassConstraintIndicator'

function operator(
  id: string,
  operatorClass: OperatorClass,
  subclassId: string,
  subclassName: string,
): Operator {
  return {
    id,
    name: id,
    rarity: 5,
    class: operatorClass,
    subclass: { id: subclassId, name: subclassName },
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

function constraint(overrides: Partial<SlotConstraint> = {}): SlotConstraint {
  return { rarities: [], classes: [], ...overrides }
}

const operators = [
  operator('vanguard-charger', 'Vanguard', 'charger', 'Charger'),
  operator('vanguard-tactician', 'Vanguard', 'tactician', 'Tactician'),
  operator('guard-arts', 'Guard', 'artsfighter', 'Arts Fighter'),
  operator('defender-guardian', 'Defender', 'guardian', 'Guardian'),
  operator('sniper-marksman', 'Sniper', 'marksman', 'Marksman'),
  operator('medic-core', 'Medic', 'medic', 'Medic'),
]

describe('generic slot class indicator model', () => {
  it('uses canonical class ordering for ordinary class constraints', () => {
    const classes: OperatorClass[] = ['Medic', 'Vanguard', 'Sniper', 'Guard']
    const items = buildSlotClassIndicatorItems(constraint({ classes }), operators)
    expect(items.map(({ operatorClass }) => operatorClass)).toEqual(
      operatorClasses.filter((operatorClass) => classes.includes(operatorClass)),
    )
  })

  it('infers parent classes from subclass-only constraints', () => {
    const items = buildSlotClassIndicatorItems(
      constraint({ subclasses: ['charger', 'artsfighter'] }),
      operators,
    )
    expect(items).toEqual([
      { operatorClass: 'Vanguard', subclassNames: ['Charger'] },
      { operatorClass: 'Guard', subclassNames: ['Arts Fighter'] },
    ])
  })

  it('groups subclass subfilters under their parent class', () => {
    const items = buildSlotClassIndicatorItems(
      constraint({ classes: ['Vanguard'], subclasses: ['tactician', 'charger'] }),
      operators,
    )
    expect(items).toEqual([
      { operatorClass: 'Vanguard', subclassNames: ['Charger', 'Tactician'] },
    ])
  })

  it('preserves the locked-slot class override order used by Amiya and other multi-form identities', () => {
    const items = buildSlotClassIndicatorItems(
      constraint(),
      operators,
      ['Caster', 'Guard', 'Medic'],
    )
    expect(items.map(({ operatorClass }) => operatorClass)).toEqual(['Caster', 'Guard', 'Medic'])
  })

  it('collapses class overflow after three visible icons', () => {
    const classes: OperatorClass[] = ['Vanguard', 'Guard', 'Defender', 'Sniper', 'Medic']
    const items = buildSlotClassIndicatorItems(constraint({ classes }), operators)
    const { visible, overflow } = splitSlotClassIndicatorItems(items, 3)
    expect(visible).toHaveLength(3)
    expect(overflow).toBe(2)
  })
})
