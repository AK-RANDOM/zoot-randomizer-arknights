import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from '../../shared/constraints'
import type { Operator } from '../../shared/operator'
import { buildSubclassFilterGroups } from '../../shared/operatorFilterCatalog'
import { buildGlobalFilterOperatorPool } from '../../shared/operatorPool'
import SquadConstraintEditor from './SquadConstraintEditorBase'
import SlotSubclassSelector from './SlotSubclassSelector'

const definitions = [
  ['charger', 'Charger', '2019-05-01'],
  ['pioneer', 'Pioneer', '2019-05-01'],
  ['bearer', 'Standard Bearer', '2019-09-10'],
  ['tactician', 'Tactician', '2021-01-05'],
  ['agent', 'Agent', '2022-08-11'],
  ['counsellor', 'Strategist', '2025-08-02'],
]
const operators: Operator[] = definitions.map(([id, name, date]) => ({
  id: `char_${id}`,
  name,
  rarity: 5,
  class: 'Vanguard',
  subclass: { id, name },
  faction: { main: null, affiliations: [] },
  availableOn: { cn: true, global: true },
  release: { cn: { date, yearGroup: 1 }, global: { date, yearGroup: 1 } },
  acquisition: { family: 'standard', group: null },
  collaboration: null,
  alterGroup: null,
  mandatoryExclusivityGroup: null,
  imageFile: `operators/char_${id}.png`,
}))

describe('slot subclass catalog under Global Filter exclusions', () => {
  it('uses all six Vanguard branches even when the effective pool contains only two', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 1
    constraints.release.server = 'cn'
    constraints.subclass.excludedIds = ['pioneer', 'bearer', 'agent', 'counsellor']
    const pool = buildGlobalFilterOperatorPool(operators, constraints)
    expect(pool.map((operator) => operator.subclass.id)).toEqual(['charger', 'tactician'])
    const value = { classes: ['Vanguard'] as const, rarities: [], subclasses: ['charger'] }
    const html = renderToStaticMarkup(
      createElement(SquadConstraintEditor, {
        slotIndex: 0,
        value: { ...value, classes: ['Vanguard'] },
        constraints,
        operators: pool,
        subclassReferenceOperators: operators,
        resetValue: { rarities: [], classes: [] },
        onApply: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('1 of 6 subclasses active')
    expect(html).not.toContain('1 of 2 subclasses active')
  })

  it('renders every branch in debut order and marks unavailable branches without hiding them', () => {
    const subclasses = buildSubclassFilterGroups({ operators })[0].subclasses
    const html = renderToStaticMarkup(
      createElement(SlotSubclassSelector, {
        classLabel: 'Vanguard',
        subclasses,
        allowedIds: ['charger', 'agent'],
        availableIds: new Set(['charger', 'tactician']),
        onToggle: () => {},
      }),
    )
    expect(html.match(/<button /g)).toHaveLength(6)
    expect(html.match(/is-unavailable/g)).toHaveLength(4)
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.filter((button) => button.includes('disabled=""'))).toHaveLength(4)
    expect(buttons.find((button) => button.includes('title="Agent —'))).toContain('disabled=""')
    expect(buttons.find((button) => button.includes('title="Charger —'))).not.toContain(
      'disabled=""',
    )
    expect(buttons.find((button) => button.includes('title="Tactician —'))).not.toContain(
      'disabled=""',
    )
    const positions = definitions.map(([, name]) => html.indexOf(`title="${name} —`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    expect(html).toContain(
      'Agent — active. No eligible operators with the current filters and slot criteria.',
    )
    expect(html).toContain('Charger — active')
    expect(html).toContain('Tactician — inactive')
  })

  it('disables an unavailable class even when it was already selected', () => {
    const constraints = createDefaultConstraints()
    constraints.squadSize = 1
    const html = renderToStaticMarkup(
      createElement(SquadConstraintEditor, {
        slotIndex: 0,
        value: { classes: ['Vanguard'], rarities: [6] },
        constraints,
        operators,
        subclassReferenceOperators: operators,
        resetValue: { rarities: [], classes: [] },
        onApply: () => {},
        onClose: () => {},
      }),
    )
    const selectedClass = html.match(
      /<button\b[^>]*class="slot-constraint-class-icon-button is-active[^>]*>/,
    )?.[0]
    expect(selectedClass).toContain('is-unavailable')
    expect(selectedClass).toContain('disabled=""')
  })
})
