import {
  createEmptySlotConstraints,
  type NumericConstraint,
  type RandomizerConstraints,
  type SlotConstraint,
  type SquadConfiguration,
} from './constraints'
import { operatorClasses, type OperatorClass, type OperatorRarity } from './operator'

export interface SquadPreset {
  id: string
  name: string
  builtIn: boolean
  configuration: SquadConfiguration
}

export interface StoredSquadPreset extends SquadPreset {
  builtIn: false
}

function cloneNumericMap<T extends string | number>(
  source: Partial<Record<T, NumericConstraint>>,
): Partial<Record<T, NumericConstraint>> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, { ...(value as NumericConstraint) }]),
  ) as Partial<Record<T, NumericConstraint>>
}

export function cloneSquadConfiguration(configuration: SquadConfiguration): SquadConfiguration {
  return {
    squadSize: configuration.squadSize,
    rarity: cloneNumericMap<OperatorRarity>(configuration.rarity),
    rarityGroups: cloneNumericMap(configuration.rarityGroups),
    class: cloneNumericMap<OperatorClass>(configuration.class),
    slots: Array.from({ length: 12 }, (_, index) => {
      const source = configuration.slots[index]
      const slot: SlotConstraint = {
        rarities: [...(source?.rarities ?? [])],
        classes: [...(source?.classes ?? [])],
      }
      if (source?.subclasses !== undefined) slot.subclasses = [...source.subclasses]
      if (source?.operatorId) slot.operatorId = source.operatorId
      if (source?.mandatoryExclusivityGroup)
        slot.mandatoryExclusivityGroup = source.mandatoryExclusivityGroup
      return slot
    }),
  }
}

export function squadConfigurationFromConstraints(
  constraints: RandomizerConstraints,
): SquadConfiguration {
  return cloneSquadConfiguration(constraints)
}

export function applySquadConfiguration(
  constraints: RandomizerConstraints,
  configuration: SquadConfiguration,
): RandomizerConstraints {
  const next = cloneSquadConfiguration(configuration)
  return {
    ...constraints,
    squadSize: next.squadSize,
    rarity: next.rarity,
    rarityGroups: next.rarityGroups,
    class: next.class,
    slots: next.slots,
  }
}

export function squadConfigurationEquals(
  left: SquadConfiguration,
  right: SquadConfiguration,
): boolean {
  return (
    JSON.stringify(cloneSquadConfiguration(left)) === JSON.stringify(cloneSquadConfiguration(right))
  )
}

export function createNoConstraintConfiguration(squadSize = 12): SquadConfiguration {
  return {
    squadSize,
    rarity: {},
    rarityGroups: {},
    class: {},
    slots: createEmptySlotConstraints(),
  }
}

const exact = (value: number): NumericConstraint => ({ min: value, max: value })
const classMinimums = (minimum: number): Partial<Record<OperatorClass, NumericConstraint>> =>
  Object.fromEntries(
    operatorClasses.map((operatorClass) => [operatorClass, { min: minimum, max: 12 }]),
  ) as Partial<Record<OperatorClass, NumericConstraint>>
const slot = (rarities: OperatorRarity[]): SlotConstraint => ({ rarities, classes: [] })

function mappedSlots(rarities: OperatorRarity[][]): SlotConstraint[] {
  return Array.from({ length: 12 }, (_, index) =>
    index < rarities.length ? slot([...rarities[index]]) : slot([]),
  )
}

export const BUILT_IN_SQUAD_PRESETS: SquadPreset[] = [
  {
    id: 'builtin:none',
    name: 'No constraint',
    builtIn: true,
    configuration: createNoConstraintConfiguration(12),
  },
  {
    id: 'builtin:operation-6-7',
    name: 'Operation 6-7 Comp',
    builtIn: true,
    configuration: {
      ...createNoConstraintConfiguration(12),
      rarity: {
        6: exact(1),
        5: exact(3),
        4: exact(5),
        3: exact(3),
      },
      class: {
        Vanguard: exact(2),
        Guard: exact(1),
        Sniper: exact(1),
        Caster: exact(2),
        Defender: exact(2),
        Medic: exact(2),
        Supporter: exact(0),
        Specialist: exact(2),
      },
      slots: (() => {
        const slots = mappedSlots([[5], [6], [4], [4], [5], [4], [4], [5], [4], [3], [3], [3]])
        slots[0].mandatoryExclusivityGroup = 'amiya-forms'
        return slots
      })(),
    },
  },
  {
    id: 'builtin:dev-recommended',
    name: 'Dev recommended',
    builtIn: true,
    configuration: {
      ...createNoConstraintConfiguration(12),
      rarity: {
        6: exact(1),
        5: exact(5),
        4: exact(4),
      },
      rarityGroups: {
        lte3: exact(2),
      },
      class: classMinimums(1),
      slots: mappedSlots([[6], [5], [5], [5], [5], [5], [4], [4], [4], [4], [1, 2, 3], [1, 2, 3]]),
    },
  },
]

export function findBuiltInPreset(id: string): SquadPreset | undefined {
  return BUILT_IN_SQUAD_PRESETS.find((preset) => preset.id === id)
}

export function isNoConstraintConfiguration(configuration: SquadConfiguration): boolean {
  return squadConfigurationEquals(
    configuration,
    createNoConstraintConfiguration(configuration.squadSize),
  )
}

export function createUserPreset(
  name: string,
  configuration: SquadConfiguration,
  id = `user:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
): StoredSquadPreset {
  return {
    id,
    name: name.trim() || 'Untitled preset',
    builtIn: false,
    configuration: cloneSquadConfiguration(configuration),
  }
}
