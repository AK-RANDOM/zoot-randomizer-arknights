import {
  limitedAcquisitionGroups,
  operatorClasses,
  operatorRarities,
  welfareAcquisitionGroups,
  type LimitedAcquisitionGroup,
  type OperatorClass,
  type OperatorRarity,
  type ReleaseServer,
  type WelfareAcquisitionGroup,
} from './operator'

export interface NumericConstraint {
  min: number
  max: number
}

export interface SlotConstraint {
  /** Empty means any rarity. */
  rarities: OperatorRarity[]
  /** Empty means any class. */
  classes: OperatorClass[]
}

export const rarityGroupDefinitions = {
  lte3: { label: '≤3★', rarities: [1, 2, 3] },
  lte4: { label: '≤4★', rarities: [1, 2, 3, 4] },
  lte5: { label: '≤5★', rarities: [1, 2, 3, 4, 5] },
  gte4: { label: '≥4★', rarities: [4, 5, 6] },
  gte5: { label: '≥5★', rarities: [5, 6] },
} as const satisfies Record<
  string,
  { label: string; rarities: readonly OperatorRarity[] }
>

export type RarityGroupKey = keyof typeof rarityGroupDefinitions
export const rarityGroupKeys = Object.keys(rarityGroupDefinitions) as RarityGroupKey[]

export type FactionMatchMode = 'main' | 'any'
export type OperatorEraFilter = 'all' | 'kernel' | 'postKernel'

export interface ReleaseConstraint {
  /**
   * Region-wide metadata source. Iteration 6 will move the selector to Options,
   * but this remains the single source of truth for all region-dependent
   * eligibility until that presentation/persistence migration lands.
   */
  server: ReleaseServer
  minYear: number | null
  maxYear: number | null
  minDate: string
  maxDate: string
}

export interface AcquisitionConstraint {
  limited: Record<LimitedAcquisitionGroup, boolean>
  standard: boolean
  welfare: Record<WelfareAcquisitionGroup, boolean>
}

export interface CollaborationConstraint {
  includeNonCollab: boolean
  /** Missing source keys default to enabled so newly-added collaborations remain opt-in safe. */
  sources: Record<string, boolean>
}

export interface SubclassConstraint {
  /** Sparse exclusions keep future/new subclasses enabled by default. */
  excludedIds: string[]
}

export interface FactionConstraint {
  matchMode: FactionMatchMode
  /** Sparse exclusions keep future/new factions enabled by default. */
  excludedIds: string[]
}

export interface RaceConstraint {
  /** Sparse stable race-ID exclusions keep future/new source races enabled by default. */
  excludedIds: string[]
}

export interface SquadConfiguration {
  squadSize: number
  rarity: Partial<Record<OperatorRarity, NumericConstraint>>
  rarityGroups: Partial<Record<RarityGroupKey, NumericConstraint>>
  class: Partial<Record<OperatorClass, NumericConstraint>>
  slots: SlotConstraint[]
}

export interface RandomizerConstraints extends SquadConfiguration {
  release: ReleaseConstraint
  acquisition: AcquisitionConstraint
  collaboration: CollaborationConstraint
  subclass: SubclassConstraint
  faction: FactionConstraint
  /** Optional only for backward compatibility with pre-M6 persisted/config objects. */
  race?: RaceConstraint
  era: OperatorEraFilter
  alterExclusivity: boolean
}

export const DEFAULT_NUMERIC_CONSTRAINT: NumericConstraint = {
  min: 0,
  max: 12,
}

export function createEmptySlotConstraint(): SlotConstraint {
  return { rarities: [], classes: [] }
}

export function createEmptySlotConstraints(): SlotConstraint[] {
  return Array.from({ length: 12 }, () => createEmptySlotConstraint())
}

export function createDefaultConstraints(): RandomizerConstraints {
  return {
    squadSize: 12,
    rarity: {},
    rarityGroups: {},
    class: {},
    slots: createEmptySlotConstraints(),
    release: {
      server: 'global',
      minYear: null,
      maxYear: null,
      minDate: '',
      maxDate: '',
    },
    acquisition: {
      limited: Object.fromEntries(
        limitedAcquisitionGroups.map((group) => [group, true]),
      ) as Record<LimitedAcquisitionGroup, boolean>,
      standard: true,
      welfare: Object.fromEntries(
        welfareAcquisitionGroups.map((group) => [group, true]),
      ) as Record<WelfareAcquisitionGroup, boolean>,
    },
    collaboration: {
      includeNonCollab: true,
      sources: {},
    },
    subclass: {
      excludedIds: [],
    },
    faction: {
      matchMode: 'main',
      excludedIds: [],
    },
    race: {
      excludedIds: [],
    },
    era: 'all',
    alterExclusivity: false,
  }
}

export const DEFAULT_CONSTRAINTS: RandomizerConstraints = createDefaultConstraints()

export function resolveNumericConstraint(
  constraint: NumericConstraint | undefined,
): NumericConstraint {
  return constraint ?? DEFAULT_NUMERIC_CONSTRAINT
}

export function numericConstraintIsDefault(constraint: NumericConstraint | undefined): boolean {
  const resolved = resolveNumericConstraint(constraint)
  return resolved.min === 0 && resolved.max === 12
}

export function setNumericConstraintBound(
  current: NumericConstraint | undefined,
  field: keyof NumericConstraint,
  value: number,
): NumericConstraint {
  const next = { ...resolveNumericConstraint(current), [field]: value }
  if (field === 'min' && next.min > next.max) next.max = next.min
  if (field === 'max' && next.max < next.min) next.min = next.max
  return next
}

export function slotConstraintIsEmpty(constraint: SlotConstraint | undefined): boolean {
  return !constraint || (constraint.rarities.length === 0 && constraint.classes.length === 0)
}

export function cloneSlotConstraint(constraint: SlotConstraint | undefined): SlotConstraint {
  return {
    rarities: [...(constraint?.rarities ?? [])],
    classes: [...(constraint?.classes ?? [])],
  }
}

export function cloneSlotConstraints(slots: readonly SlotConstraint[]): SlotConstraint[] {
  return Array.from({ length: 12 }, (_, index) => cloneSlotConstraint(slots[index]))
}

export function normalizedConstraintEntries<T extends string | number>(
  entries: readonly T[],
  source: Partial<Record<T, NumericConstraint>>,
): Array<[T, NumericConstraint]> {
  return entries.map((entry) => [entry, resolveNumericConstraint(source[entry])])
}

export function totalMinimum(
  entries: readonly (readonly [unknown, NumericConstraint])[],
): number {
  return entries.reduce((sum, [, constraint]) => sum + constraint.min, 0)
}

export function totalMaximum(
  entries: readonly (readonly [unknown, NumericConstraint])[],
): number {
  return entries.reduce((sum, [, constraint]) => sum + constraint.max, 0)
}

export function collaborationSourceEnabled(
  constraint: CollaborationConstraint,
  source: string,
): boolean {
  return constraint.sources[source] ?? true
}

function validateNumericConstraint(
  label: string,
  constraint: NumericConstraint,
  errors: string[],
): void {
  if (
    !Number.isInteger(constraint.min) ||
    !Number.isInteger(constraint.max) ||
    constraint.min < 0 ||
    constraint.max < 0 ||
    constraint.min > 12 ||
    constraint.max > 12
  ) {
    errors.push(`${label} limits must be whole numbers between 0 and 12.`)
  } else if (constraint.min > constraint.max) {
    errors.push(`${label} minimum cannot exceed its maximum.`)
  }
}

function validateSparseIds(label: string, values: string[], errors: string[]): void {
  if (
    values.some((value) => typeof value !== 'string' || value.trim().length === 0) ||
    new Set(values).size !== values.length
  ) {
    errors.push(`${label} exclusions must contain unique non-empty IDs.`)
  }
}

export function validateConstraintShape(constraints: RandomizerConstraints): string[] {
  const errors: string[] = []

  if (
    !Number.isInteger(constraints.squadSize) ||
    constraints.squadSize < 1 ||
    constraints.squadSize > 12
  ) {
    errors.push('Squad size must be between 1 and 12.')
  }

  const rarityEntries = normalizedConstraintEntries(operatorRarities, constraints.rarity)
  const classEntries = normalizedConstraintEntries(operatorClasses, constraints.class)
  const rarityGroupEntries = normalizedConstraintEntries(
    rarityGroupKeys,
    constraints.rarityGroups,
  )

  for (const [label, constraint] of rarityEntries) {
    validateNumericConstraint(`${label}★`, constraint, errors)
  }
  for (const [label, constraint] of classEntries) {
    validateNumericConstraint(String(label), constraint, errors)
  }
  for (const [group, constraint] of rarityGroupEntries) {
    validateNumericConstraint(rarityGroupDefinitions[group].label, constraint, errors)
  }

  const rarityMinimum = totalMinimum(rarityEntries)
  const classMinimum = totalMinimum(classEntries)
  const rarityMaximum = totalMaximum(rarityEntries)
  const classMaximum = totalMaximum(classEntries)

  if (rarityMinimum > constraints.squadSize) {
    errors.push(`Rarity minimums require ${rarityMinimum} operators, above the squad size.`)
  }
  if (classMinimum > constraints.squadSize) {
    errors.push(`Class minimums require ${classMinimum} operators, above the squad size.`)
  }
  if (rarityMaximum < constraints.squadSize) {
    errors.push(`Rarity maximums allow only ${rarityMaximum} operators, below the squad size.`)
  }
  if (classMaximum < constraints.squadSize) {
    errors.push(`Class maximums allow only ${classMaximum} operators, below the squad size.`)
  }

  if (!Array.isArray(constraints.slots) || constraints.slots.length < 12) {
    errors.push('Slot constraints must define all 12 squad positions.')
  } else {
    const raritySet = new Set<number>(operatorRarities)
    const classSet = new Set<string>(operatorClasses)
    constraints.slots.forEach((slot, index) => {
      if (
        slot.rarities.some((rarity) => !raritySet.has(rarity)) ||
        new Set(slot.rarities).size !== slot.rarities.length
      ) {
        errors.push(`Slot ${index + 1} contains an invalid or duplicate rarity choice.`)
      }
      if (
        slot.classes.some((operatorClass) => !classSet.has(operatorClass)) ||
        new Set(slot.classes).size !== slot.classes.length
      ) {
        errors.push(`Slot ${index + 1} contains an invalid or duplicate class choice.`)
      }
    })
  }

  const { minYear, maxYear, minDate, maxDate } = constraints.release
  if (minYear !== null && (!Number.isInteger(minYear) || minYear < 0)) {
    errors.push('Minimum release year must be Year 0 or later.')
  }
  if (maxYear !== null && (!Number.isInteger(maxYear) || maxYear < 0)) {
    errors.push('Maximum release year must be Year 0 or later.')
  }
  if (minYear !== null && maxYear !== null && minYear > maxYear) {
    errors.push('Minimum release year cannot exceed maximum release year.')
  }
  if (minDate && maxDate && minDate > maxDate) {
    errors.push('Minimum release date cannot be after maximum release date.')
  }

  const anyAcquisition =
    constraints.acquisition.standard ||
    Object.values(constraints.acquisition.limited).some(Boolean) ||
    Object.values(constraints.acquisition.welfare).some(Boolean)
  if (!anyAcquisition) errors.push('At least one acquisition category must be enabled.')

  validateSparseIds('Subclass', constraints.subclass.excludedIds, errors)
  validateSparseIds('Faction', constraints.faction.excludedIds, errors)
  validateSparseIds('Race', constraints.race?.excludedIds ?? [], errors)
  if (constraints.faction.matchMode !== 'main' && constraints.faction.matchMode !== 'any') {
    errors.push('Faction match mode must be main or any affiliation.')
  }
  if (constraints.era !== 'all' && constraints.era !== 'kernel' && constraints.era !== 'postKernel') {
    errors.push('Operator era filter must be all, kernel, or postKernel.')
  }

  return errors
}
