import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from '../../shared/constraints'
import type { Operator } from '../../shared/operator'
import { filterReservedSlotOperatorOptions, type OperatorSelectorOption } from './OperatorSelector'

function operator(id: string, alterGroup: string | null = null): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'lord', name: 'Lord' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2024-01-01', yearGroup: 5 },
      global: { date: '2024-01-01', yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

function option(value: Operator): OperatorSelectorOption {
  return { key: `operator:${value.id}`, label: value.name, operator: value }
}

describe('Standard slot operator reservations', () => {
  it('removes exact operators locked by another slot', () => {
    const alpha = operator('alpha')
    const beta = operator('beta')
    const constraints = createDefaultConstraints()
    constraints.slots[0].operatorId = alpha.id

    const filtered = filterReservedSlotOperatorOptions([option(alpha), option(beta)], {
      slotIndex: 1,
      constraints,
      operators: [alpha, beta],
    })

    expect(filtered.map((entry) => entry.operator.id)).toEqual(['beta'])
  })

  it('also removes alters of another fixed operator when Alter Exclusivity is enabled', () => {
    const alpha = operator('alpha', 'alpha-family')
    const alphaAlter = operator('alpha-alter', 'alpha-family')
    const beta = operator('beta')
    const constraints = createDefaultConstraints()
    constraints.alterExclusivity = true
    constraints.slots[0].operatorId = alpha.id

    const filtered = filterReservedSlotOperatorOptions(
      [option(alpha), option(alphaAlter), option(beta)],
      { slotIndex: 1, constraints, operators: [alpha, alphaAlter, beta] },
    )

    expect(filtered.map((entry) => entry.operator.id)).toEqual(['beta'])
  })
})
