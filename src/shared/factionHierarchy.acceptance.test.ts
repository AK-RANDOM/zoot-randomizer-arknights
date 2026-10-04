import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Operator, OperatorDataset } from './operator'
import { upgradeLegacyOperatorDataset } from './operatorData'

const raw = JSON.parse(
  readFileSync(
    join(process.cwd(), 'resources', 'bundled-data', 'operators', 'operators.json'),
    'utf8',
  ),
) as unknown
const dataset = upgradeLegacyOperatorDataset(raw) as OperatorDataset

function operatorNamed(name: string): Operator {
  const operator = dataset.operators.find((candidate) => candidate.name === name)
  if (!operator) throw new Error(`Missing bundled operator: ${name}`)
  return operator
}

function factionPath(name: string): string[] {
  const faction = operatorNamed(name).faction
  const primary = faction.primary ?? (faction.main ? [faction.main] : [])
  return primary.map((id) => dataset.factionLabels[id] ?? id)
}

function hierarchyEdges(): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>()
  for (const operator of dataset.operators) {
    const primary = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
    const labels = primary.map((id) => dataset.factionLabels[id] ?? id)
    for (let index = 0; index < labels.length - 1; index += 1) {
      const parent = labels[index]
      const child = labels[index + 1]
      const children = edges.get(parent) ?? new Set<string>()
      children.add(child)
      edges.set(parent, children)
    }
  }
  return edges
}

const lockedChildren: Record<string, string[]> = {
  'Rhodes Island': [
    'Rhodes Island-Elite Operator',
    'S.W.E.E.P.',
    'Op Team A4',
    'Reserve Op Team A1',
    'Reserve Op Team A4',
    'Reserve Op Team A6',
  ],
  Yan: ['Yan-Sui'],
  'Yan-Lungmen': [
    'Lungmen Guard Department',
    'Penguin Logistics',
    "Lee's Detective Agency",
  ],
  'Ægir': ['Abyssal Hunters'],
  Columbia: ['Blacksteel Worldwide', 'Rhine Lab', 'Siesta'],
  Kazimierz: ['Pinus Sylvestris'],
  Kjerag: ['Karlan Trade CO., LTD'],
  Siracusa: ['Chiave Gang'],
  Ursus: ['Ursus Student Self-government Group'],
  Victoria: ['Glasgow', 'Tara'],
}

const lockedStandalone = [
  'Bolívar',
  'Higashi',
  'Iberia',
  'Laterano',
  'Leithanien',
  'Minos',
  'Rim Billiton',
  'Sami',
  'Sargon',
  'Babel',
  'Followers',
  'Team Rainbow',
  "Laios's Party",
  'Ave Mujica',
  'S.E.E.S.',
  'Dublinn',
]

describe('polish pass faction hierarchy', () => {
  it('matches the locked operator-facing hierarchy examples', () => {
    expect(factionPath('Saria')).toEqual(['Columbia', 'Rhine Lab'])
    expect(factionPath('Liskarm')).toEqual(['Columbia', 'Blacksteel Worldwide'])
    expect(factionPath('Texas')).toEqual(['Yan-Lungmen', 'Penguin Logistics'])
    expect(factionPath("Ch'en")).toEqual(['Yan-Lungmen', 'Lungmen Guard Department'])
    expect(factionPath('Dusk')).toEqual(['Yan', 'Yan-Sui'])
    expect(factionPath('Gladiia')).toEqual(['Ægir', 'Abyssal Hunters'])
    expect(factionPath('Siege')).toEqual(['Victoria', 'Glasgow'])
    expect(factionPath('Angelina')).toEqual(['Siracusa'])
  })

  it('matches the complete source-defined parent-child tree', () => {
    const edges = hierarchyEdges()
    for (const [parent, expectedChildren] of Object.entries(lockedChildren)) {
      expect([...(edges.get(parent) ?? new Set())].sort(), parent).toEqual(
        [...expectedChildren].sort(),
      )
    }
  })

  it('keeps standalone factions out of inferred parent-child relationships', () => {
    const edges = hierarchyEdges()
    const childLabels = new Set([...edges.values()].flatMap((children) => [...children]))
    for (const label of lockedStandalone) {
      expect(edges.has(label), `${label} should not be a parent`).toBe(false)
      expect(childLabels.has(label), `${label} should not be a child`).toBe(false)
    }
  })

  it('keeps Lungmen independent from Yan', () => {
    const texas = factionPath('Texas')
    const chen = factionPath("Ch'en")
    expect(texas).not.toContain('Yan')
    expect(chen).not.toContain('Yan')
    expect(texas[0]).toBe('Yan-Lungmen')
    expect(chen[0]).toBe('Yan-Lungmen')
  })

  it('has display labels for every used primary faction node', () => {
    for (const operator of dataset.operators) {
      const primary = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
      for (const id of primary) {
        expect(dataset.factionLabels[id], `${operator.name}: ${id}`).toBeTruthy()
      }
    }
  })
})
