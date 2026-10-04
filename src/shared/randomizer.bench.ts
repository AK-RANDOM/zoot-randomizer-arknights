import { bench, describe } from 'vitest'
import { DEFAULT_CONSTRAINTS, type RandomizerConstraints } from './constraints'
import type { Operator, OperatorClass, OperatorRarity } from './operator'
import { measureConstraintSearch } from './randomizer'

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
    for (const strategy of ['static', 'dynamic'] as const) {
      const baseline = measureConstraintSearch(
        scenario.operators,
        scenario.constraints,
        seededRandom(),
        strategy,
      )
      const stats = baseline.stats

      bench(
        `${scenario.name} [${strategy}] | visits=${stats.visits} backtracks=${stats.backtracks} exhausted=${stats.exhausted}`,
        () => {
          measureConstraintSearch(
            scenario.operators,
            scenario.constraints,
            seededRandom(),
            strategy,
          )
        },
        { time: 500 },
      )
    }
  }
})
