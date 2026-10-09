import { describe, expect, it } from 'vitest'
import { resolveSlotClassClick } from './SquadConstraintEditor'

describe('slot constraint class selector interaction', () => {
  it('activates an inactive class and opens its subclass row', () => {
    expect(resolveSlotClassClick([], null, 'Guard')).toEqual({
      classes: ['Guard'],
      openClass: 'Guard',
    })
  })

  it('keeps an active class enabled when first opening its subclass row', () => {
    expect(resolveSlotClassClick(['Guard', 'Medic'], null, 'Guard')).toEqual({
      classes: ['Guard', 'Medic'],
      openClass: 'Guard',
    })
  })

  it('deactivates an active class when clicking it again while its subclass row is open', () => {
    expect(resolveSlotClassClick(['Guard', 'Medic'], 'Guard', 'Guard')).toEqual({
      classes: ['Medic'],
      openClass: null,
    })
  })

  it('activates a new class while moving the subclass row to it', () => {
    expect(resolveSlotClassClick(['Guard'], 'Guard', 'Medic')).toEqual({
      classes: ['Guard', 'Medic'],
      openClass: 'Medic',
    })
  })
})
