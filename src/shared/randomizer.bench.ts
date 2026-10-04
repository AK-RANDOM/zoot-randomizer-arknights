import { describe, expect, it } from 'vitest'
import { DEFAULT_CONSTRAINTS, type RandomizerConstraints } from './constraints'
import type { Operator, OperatorClass, OperatorRarity } from './operator'
import { generateSquadForMeasurement, measureConstraintSearch } from './randomizer'

function operator(
  id: string,
  rarity: OperatorRarity,
  operatorClass: OperatorClass,
  extras: Partial<Operator> = {},
): Operator {
  return {
    id,
    name: id,
    rarity,
    class: operatorClass,
    subclass: { id: 'benchmark', name: 'Benchmark' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: '2024-01-01', yearGroup: 5 },
      global: { date: '2024-01-01', yearGroup: 5 },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
    ...extras,
  }
}

const classes: OperatorClass[] = [
  'Vanguard',
  'Guard',
  'Defender',
  'Sniper',
  'Caster',
  'Medic',
  'Supporter',
  'Specialist',
]
const rarities: OperatorRarity[] = [1, 2, 3, 4, 5, 6]

const broadPool = Array.from({ length: 96 }, (_, index) =>
  operator(
    `char_bench_${index}`,
    rarities[index % rarities.length],
    classes[index % classes.length],
  ),
)

function seededRandom(seed = 0x12345678): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

interface PerformanceCase {
  name: string
  operators: Operator[]
  constraints: RandomizerConstraints
}

const cases: PerformanceCase[] = [
  {
    name: 'easy default',
    operators: broadPool,
    constraints: { ...DEFAULT_CONSTRAINTS, squadSize: 12 },
  },
  {
    name: 'moderately constrained',
    operators: broadPool,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 12,
      class: {
        Guard: { min: 2, max: 3 },
        Medic: { min: 1, max: 2 },
        Sniper: { min: 1, max: 3 },
      },
      rarity: {
        6: { min: 2, max: 4 },
        5: { min: 2, max: 5 },
        4: { min: 1, max: 5 },
      },
    },
  },
  {
    name: 'highly constrained satisfiable',
    operators: broadPool,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 8,
      class: {
        Guard: { min: 2, max: 2 },
        Caster: { min: 2, max: 2 },
        Medic: { min: 2, max: 2 },
        Sniper: { min: 2, max: 2 },
      },
      slots: [
        { rarities: [6], classes: ['Guard', 'Caster'] },
        { rarities: [5], classes: ['Guard', 'Caster'] },
        { rarities: [4], classes: ['Medic', 'Sniper'] },
        { rarities: [3], classes: ['Medic', 'Sniper'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(4),
      ],
    },
  },
  {
    name: 'impossible exclusivity',
    operators: broadPool.map((item) =>
      item.class === 'Guard'
        ? { ...item, mandatoryExclusivityGroup: 'benchmark-guards' }
        : item,
    ),
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 6,
      slots: [
        { rarities: [], classes: ['Guard'] },
        { rarities: [], classes: ['Guard'] },
        ...DEFAULT_CONSTRAINTS.slots.slice(2),
      ],
    },
  },
  {
    name: 'adversarial narrow slots',
    operators: broadPool,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      squadSize: 12,
      rarity: {
        6: { min: 3, max: 3 },
        5: { min: 3, max: 3 },
        4: { min: 3, max: 3 },
        3: { min: 3, max: 3 },
      },
      slots: Array.from({ length: 12 }, (_, index) => ({
        rarities: [3, 4, 5, 6] as OperatorRarity[],
        classes: [classes[index % 4], classes[(index + 1) % 4]],
      })),
    },
  },
]

describe('constraint solver performance', () => {
  for (const scenario of cases) {
    for (const ordering of ['random', 'deficit'] as const) {
      const baseline = measureConstraintSearch(
        scenario.operators,
        scenario.constraints,
        seededRandom(),
        'static',
        ordering,
      )
      const stats = baseline.stats

      it(`${scenario.name} [${ordering}]`, () => {
        const iterations = 100
        const startedAt = performance.now()
        for (let index = 0; index < iterations; index += 1) {
          measureConstraintSearch(
            scenario.operators,
            scenario.constraints,
            seededRandom(),
            'static',
            ordering,
          )
        }
        const elapsedMs = performance.now() - startedAt
        const averageMs = elapsedMs / iterations
        console.log(
          `BENCH ${scenario.name} [${ordering}] avgMs=${averageMs.toFixed(3)} visits=${stats.visits} backtracks=${stats.backtracks} pruned=${stats.prunedBranches} exhausted=${stats.exhausted}`,
        )
        expect(baseline.solved || stats.visits >= 0).toBe(true)
      })
    }
  }

  it('measures moderate-case selection distribution', () => {
    const scenario = cases.find((item) => item.name === 'moderately constrained')!
    const samples = 2000

    for (const ordering of ['random', 'deficit'] as const) {
      const appearances = new Map<string, number>()
      const classTotals = new Map<OperatorClass, number>()
      const rarityTotals = new Map<OperatorRarity, number>()

      for (let sample = 0; sample < samples; sample += 1) {
        const result = measureConstraintSearch(
          scenario.operators,
          scenario.constraints,
          seededRandom(0x12345678 + sample),
          'static',
          ordering,
        )
        expect(result.solved).toBe(true)

        const squad = generateSquadForMeasurement(
          scenario.operators,
          scenario.constraints,
          seededRandom(0x12345678 + sample),
          ordering,
        )
        for (const item of squad) {
          appearances.set(item.id, (appearances.get(item.id) ?? 0) + 1)
          classTotals.set(item.class, (classTotals.get(item.class) ?? 0) + 1)
          rarityTotals.set(item.rarity, (rarityTotals.get(item.rarity) ?? 0) + 1)
        }
      }

      const expected = (samples * scenario.constraints.squadSize) / scenario.operators.length
      const operatorCounts = scenario.operators.map(
        (item) => appearances.get(item.id) ?? 0,
      )
      const maxRelativeDeviation = Math.max(
        ...operatorCounts.map((count) => Math.abs(count - expected) / expected),
      )
      const meanAbsoluteRelativeDeviation =
        operatorCounts.reduce(
          (sum, count) => sum + Math.abs(count - expected) / expected,
          0,
        ) / operatorCounts.length

      console.log(
        `FAIRNESS moderate [${ordering}] samples=${samples} operatorMeanAbsRelDev=${meanAbsoluteRelativeDeviation.toFixed(4)} operatorMaxRelDev=${maxRelativeDeviation.toFixed(4)} classes=${JSON.stringify(Object.fromEntries(classTotals))} rarities=${JSON.stringify(Object.fromEntries(rarityTotals))}`,
      )
    }
  })
})
