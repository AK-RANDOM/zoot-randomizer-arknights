import { describe, expect, it } from 'vitest'
import type { Operator, OperatorClass } from '../../shared/operator'
import { filterOperatorSelectorOptions, type OperatorSelectorOption } from './OperatorSelector'

function operator(
  id: string,
  name: string,
  operatorClass: OperatorClass,
  subclassName: string,
): Operator {
  return {
    id,
    name,
    rarity: 5,
    class: operatorClass,
    subclass: { id: `subclass:${subclassName}`, name: subclassName },
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

function option(operatorValue: Operator, aliases: readonly string[] = []): OperatorSelectorOption {
  return {
    key: operatorValue.id,
    label: operatorValue.name,
    operator: operatorValue,
    aliases,
  }
}

describe('operator selector search', () => {
  const options = [
    option(operator('char_103_angel', 'Exusiai', 'Sniper', 'Marksman'), ['Penguin Logistics']),
    option(operator('char_474_glady', 'Gladiia', 'Specialist', 'Hookmaster'), ['Abyssal Hunters']),
    option(operator('char_2025_shu', 'Shu', 'Defender', 'Guardian'), ['Sui']),
  ]

  it('searches display name, stable ID, and aliases', () => {
    expect(filterOperatorSelectorOptions(options, 'gladiia').map(({ key }) => key)).toEqual([
      'char_474_glady',
    ])
    expect(filterOperatorSelectorOptions(options, '2025').map(({ key }) => key)).toEqual([
      'char_2025_shu',
    ])
    expect(filterOperatorSelectorOptions(options, 'penguin').map(({ key }) => key)).toEqual([
      'char_103_angel',
    ])
  })

  it('caps the unfiltered result list for the full operator dataset', () => {
    const many = Array.from({ length: 75 }, (_, index) => ({
      ...options[0],
      key: `operator-${index}`,
      label: `Operator ${index}`,
    }))
    expect(filterOperatorSelectorOptions(many, '')).toHaveLength(60)
    expect(filterOperatorSelectorOptions(many, '', 12)).toHaveLength(12)
  })
})
