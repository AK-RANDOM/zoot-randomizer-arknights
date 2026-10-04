import {
  cloneSlotConstraints,
  collaborationSourceEnabled,
  rarityGroupDefinitions,
  rarityGroupKeys,
  resolveNumericConstraint,
  validateConstraintShape,
  type RandomizerConstraints,
  type RarityGroupKey,
  type SlotConstraint,
} from './constraints'
import {
  operatorClasses,
  operatorRarities,
  type LimitedAcquisitionGroup,
  type Operator,
  type OperatorClass,
  type OperatorRarity,
  type WelfareAcquisitionGroup,
} from './operator'
import { operatorEraForRelease } from './operatorMetadata'

export interface ConstraintValidationResult {
  valid: boolean
  errors: string[]
}

type RandomSource = () => number

type ConstraintCountMap<T extends string | number> = Map<T, number>

interface SearchResult {
  squad: Operator[] | null
  exhausted: boolean
}

const SEARCH_VISIT_LIMIT = 2_000_000

function shuffled<T>(input: readonly T[], random: RandomSource): T[] {
  const values = [...input]
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[values[index], values[other]] = [values[other], values[index]]
  }
  return values
}

function acquisitionEnabled(
  operator: Operator,
  constraints: RandomizerConstraints,
): boolean {
  switch (operator.acquisition.family) {
    case 'limited':
      return operator.acquisition.group !== null
        ? constraints.acquisition.limited[
            operator.acquisition.group as LimitedAcquisitionGroup
          ]
        : false
    case 'standard':
      return constraints.acquisition.standard
    case 'welfare':
      return operator.acquisition.group !== null
        ? constraints.acquisition.welfare[
            operator.acquisition.group as WelfareAcquisitionGroup
          ]
        : false
  }
}

function factionEnabled(
  operator: Operator,
  constraints: RandomizerConstraints,
): boolean {
  const excluded = new Set(constraints.faction.excludedIds)
  if (excluded.size === 0) return true

  if (constraints.faction.matchMode === 'main') {
    return operator.faction.main === null || !excluded.has(operator.faction.main)
  }

  return (
    operator.faction.affiliations.length === 0 ||
    operator.faction.affiliations.some((factionId) => !excluded.has(factionId))
  )
}

/**
 * Applies every operator-level filter that is independent from manual Pool
 * exclusions. This is the canonical higher-level eligibility stage used by
 * validation, slot feasibility, and final generation.
 */
export function filterHigherLevelEligibleOperators(
  operators: Operator[],
  constraints: RandomizerConstraints,
): Operator[] {
  const { server, minYear, maxYear, minDate, maxDate } = constraints.release
  const excludedSubclasses = new Set(constraints.subclass.excludedIds)

  return operators.filter((operator) => {
    if (!operator.availableOn[server]) return false

    const release = operator.release[server]
    if (
      minYear !== null &&
      (release.yearGroup === null || release.yearGroup < minYear)
    ) {
      return false
    }
    if (
      maxYear !== null &&
      (release.yearGroup === null || release.yearGroup > maxYear)
    ) {
      return false
    }
    if (minDate && (!release.date || release.date < minDate)) return false
    if (maxDate && (!release.date || release.date > maxDate)) return false

    if (!acquisitionEnabled(operator, constraints)) return false

    if (operator.collaboration) {
      if (
        !collaborationSourceEnabled(
          constraints.collaboration,
          operator.collaboration,
        )
      ) {
        return false
      }
    } else if (!constraints.collaboration.includeNonCollab) {
      return false
    }

    if (excludedSubclasses.has(operator.subclass.id)) return false
    if (!factionEnabled(operator, constraints)) return false

    if (constraints.era !== 'all') {
      const era = operatorEraForRelease(release.date, server)
      if (era !== constraints.era) return false
    }

    return true
  })
}

/**
 * Compatibility name retained until Pool exclusions become a distinct final
 * stage. It intentionally delegates to the canonical higher-level filter.
 */
export function filterEligibleOperators(
  operators: Operator[],
  constraints: RandomizerConstraints,
): Operator[] {
  return filterHigherLevelEligibleOperators(operators, constraints)
}

export function operatorMatchesSlotConstraint(
  operator: Operator,
  constraint: SlotConstraint | undefined,
): boolean {
  if (!constraint) return true
  if (
    constraint.rarities.length > 0 &&
    !constraint.rarities.includes(operator.rarity)
  ) {
    return false
  }
  if (
    constraint.classes.length > 0 &&
    !constraint.classes.includes(operator.class)
  ) {
    return false
  }
  return true
}

export function countEligibleOperatorsForSlot(
  operators: Operator[],
  constraints: RandomizerConstraints,
  slot: SlotConstraint,
): number {
  return filterEligibleOperators(operators, constraints).filter((operator) =>
    operatorMatchesSlotConstraint(operator, slot),
  ).length
}

function exclusivityKeys(
  operator: Operator,
  constraints: RandomizerConstraints,
): string[] {
  const keys: string[] = []
  if (operator.mandatoryExclusivityGroup) {
    keys.push(`mandatory:${operator.mandatoryExclusivityGroup}`)
  }
  if (constraints.alterExclusivity && operator.alterGroup) {
    keys.push(operator.alterGroup)
  }
  return keys
}

function groupRarities(group: RarityGroupKey): readonly OperatorRarity[] {
  return rarityGroupDefinitions[group].rarities as readonly OperatorRarity[]
}

function rarityGroupsFor(rarity: OperatorRarity): RarityGroupKey[] {
  return rarityGroupKeys.filter((group) => groupRarities(group).includes(rarity))
}

function countFor<T extends string | number>(
  counts: ConstraintCountMap<T>,
  key: T,
): number {
  return counts.get(key) ?? 0
}

function increment<T extends string | number>(
  counts: ConstraintCountMap<T>,
  key: T,
  amount: number,
): void {
  const next = countFor(counts, key) + amount
  if (next === 0) counts.delete(key)
  else counts.set(key, next)
}

function satisfiesMinimums(
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  constraints: RandomizerConstraints,
): boolean {
  return (
    operatorClasses.every(
      (operatorClass) =>
        countFor(classCounts, operatorClass) >=
        resolveNumericConstraint(constraints.class[operatorClass]).min,
    ) &&
    operatorRarities.every(
      (rarity) =>
        countFor(rarityCounts, rarity) >=
        resolveNumericConstraint(constraints.rarity[rarity]).min,
    ) &&
    rarityGroupKeys.every(
      (group) =>
        countFor(rarityGroupCounts, group) >=
        resolveNumericConstraint(constraints.rarityGroups[group]).min,
    )
  )
}

function candidateCanFitMaximums(
  operator: Operator,
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  constraints: RandomizerConstraints,
): boolean {
  if (
    countFor(classCounts, operator.class) + 1 >
    resolveNumericConstraint(constraints.class[operator.class]).max
  ) {
    return false
  }
  if (
    countFor(rarityCounts, operator.rarity) + 1 >
    resolveNumericConstraint(constraints.rarity[operator.rarity]).max
  ) {
    return false
  }
  return rarityGroupsFor(operator.rarity).every(
    (group) =>
      countFor(rarityGroupCounts, group) + 1 <=
      resolveNumericConstraint(constraints.rarityGroups[group]).max,
  )
}

function minimumsStillReachable(
  remainingSlots: readonly number[],
  candidatesBySlot: readonly Operator[][],
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  constraints: RandomizerConstraints,
): boolean {
  for (const operatorClass of operatorClasses) {
    const minimum = resolveNumericConstraint(
      constraints.class[operatorClass],
    ).min
    if (minimum <= countFor(classCounts, operatorClass)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some(
          (operator) => operator.class === operatorClass,
        )
          ? 1
          : 0),
      0,
    )
    if (countFor(classCounts, operatorClass) + possible < minimum) return false
  }

  for (const rarity of operatorRarities) {
    const minimum = resolveNumericConstraint(constraints.rarity[rarity]).min
    if (minimum <= countFor(rarityCounts, rarity)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some((operator) => operator.rarity === rarity)
          ? 1
          : 0),
      0,
    )
    if (countFor(rarityCounts, rarity) + possible < minimum) return false
  }

  for (const group of rarityGroupKeys) {
    const minimum = resolveNumericConstraint(
      constraints.rarityGroups[group],
    ).min
    if (minimum <= countFor(rarityGroupCounts, group)) continue
    const allowed = groupRarities(group)
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some((operator) =>
          allowed.includes(operator.rarity),
        )
          ? 1
          : 0),
      0,
    )
    if (countFor(rarityGroupCounts, group) + possible < minimum) return false
  }

  return true
}

function solveAssignment(
  eligible: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource,
): SearchResult {
  const target = constraints.squadSize
  const candidatesBySlot = Array.from({ length: target }, (_, slotIndex) =>
    eligible.filter((operator) =>
      operatorMatchesSlotConstraint(operator, constraints.slots[slotIndex]),
    ),
  )

  if (candidatesBySlot.some((candidates) => candidates.length === 0)) {
    return { squad: null, exhausted: false }
  }

  const slotOrder = Array.from({ length: target }, (_, index) => index).sort(
    (left, right) => {
      const candidateDelta =
        candidatesBySlot[left].length - candidatesBySlot[right].length
      if (candidateDelta !== 0) return candidateDelta
      const leftConstraint = constraints.slots[left]
      const rightConstraint = constraints.slots[right]
      const leftSpecificity =
        leftConstraint.rarities.length + leftConstraint.classes.length
      const rightSpecificity =
        rightConstraint.rarities.length + rightConstraint.classes.length
      return rightSpecificity - leftSpecificity
    },
  )

  const randomizedCandidates = candidatesBySlot.map((candidates) =>
    shuffled(candidates, random),
  )
  const assignment: Array<Operator | undefined> = Array(target).fill(undefined)
  const usedIds = new Set<string>()
  const usedExclusivity = new Set<string>()
  const classCounts = new Map<OperatorClass, number>()
  const rarityCounts = new Map<OperatorRarity, number>()
  const rarityGroupCounts = new Map<RarityGroupKey, number>()
  let visits = 0
  let exhausted = false

  const addOperator = (operator: Operator): void => {
    usedIds.add(operator.id)
    for (const key of exclusivityKeys(operator, constraints)) usedExclusivity.add(key)
    increment(classCounts, operator.class, 1)
    increment(rarityCounts, operator.rarity, 1)
    for (const group of rarityGroupsFor(operator.rarity)) {
      increment(rarityGroupCounts, group, 1)
    }
  }

  const removeOperator = (operator: Operator): void => {
    usedIds.delete(operator.id)
    for (const key of exclusivityKeys(operator, constraints)) usedExclusivity.delete(key)
    increment(classCounts, operator.class, -1)
    increment(rarityCounts, operator.rarity, -1)
    for (const group of rarityGroupsFor(operator.rarity)) {
      increment(rarityGroupCounts, group, -1)
    }
  }

  function search(depth: number): boolean {
    visits += 1
    if (visits > SEARCH_VISIT_LIMIT) {
      exhausted = true
      return false
    }

    if (depth >= slotOrder.length) {
      return satisfiesMinimums(
        classCounts,
        rarityCounts,
        rarityGroupCounts,
        constraints,
      )
    }

    const remainingSlots = slotOrder.slice(depth)
    if (
      !minimumsStillReachable(
        remainingSlots,
        randomizedCandidates,
        classCounts,
        rarityCounts,
        rarityGroupCounts,
        constraints,
      )
    ) {
      return false
    }

    const slotIndex = slotOrder[depth]
    for (const operator of randomizedCandidates[slotIndex]) {
      if (usedIds.has(operator.id)) continue
      const exclusivity = exclusivityKeys(operator, constraints)
      if (exclusivity.some((key) => usedExclusivity.has(key))) continue
      if (
        !candidateCanFitMaximums(
          operator,
          classCounts,
          rarityCounts,
          rarityGroupCounts,
          constraints,
        )
      ) {
        continue
      }

      assignment[slotIndex] = operator
      addOperator(operator)

      if (search(depth + 1)) return true

      removeOperator(operator)
      assignment[slotIndex] = undefined
      if (exhausted) return false
    }

    return false
  }

  if (!search(0)) return { squad: null, exhausted }
  return { squad: assignment as Operator[], exhausted: false }
}

function validationRandom(): RandomSource {
  let state = 0x9e3779b9
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function constraintsWithSlotDraft(
  constraints: RandomizerConstraints,
  slotIndex: number,
  draft: SlotConstraint,
): RandomizerConstraints {
  const slots = cloneSlotConstraints(constraints.slots)
  slots[slotIndex] = {
    rarities: [...draft.rarities],
    classes: [...draft.classes],
  }
  return { ...constraints, slots }
}

export function canSlotResolveTo(
  operators: Operator[],
  constraints: RandomizerConstraints,
  slotIndex: number,
  draft: SlotConstraint,
  probe: { rarity?: OperatorRarity; operatorClass?: OperatorClass },
): boolean {
  if (slotIndex < 0 || slotIndex >= constraints.squadSize) return false
  const forced: SlotConstraint = {
    rarities:
      probe.rarity === undefined ? [...draft.rarities] : [probe.rarity],
    classes:
      probe.operatorClass === undefined
        ? [...draft.classes]
        : [probe.operatorClass],
  }
  return validateConstraints(
    constraintsWithSlotDraft(constraints, slotIndex, forced),
    operators,
  ).valid
}

export function validateConstraints(
  constraints: RandomizerConstraints,
  operators: Operator[] = [],
): ConstraintValidationResult {
  const errors = validateConstraintShape(constraints)
  if (errors.length > 0 || operators.length === 0) {
    return { valid: errors.length === 0, errors }
  }

  const eligible = filterEligibleOperators(operators, constraints)
  if (eligible.length < constraints.squadSize) {
    errors.push(
      `Only ${eligible.length} eligible operators are available for ${constraints.squadSize} requested slots.`,
    )
    return { valid: false, errors }
  }

  for (let slotIndex = 0; slotIndex < constraints.squadSize; slotIndex += 1) {
    const count = eligible.filter((operator) =>
      operatorMatchesSlotConstraint(operator, constraints.slots[slotIndex]),
    ).length
    if (count === 0) {
      errors.push(`Slot ${slotIndex + 1} has no eligible operators.`)
    }
  }
  if (errors.length > 0) return { valid: false, errors }

  const result = solveAssignment(eligible, constraints, validationRandom())
  if (!result.squad) {
    errors.push(
      result.exhausted
        ? 'Constraint search exceeded the safe interactive limit. Simplify the current squad constraints or bounds.'
        : `No squad of ${constraints.squadSize} operators can satisfy the current slot constraints, filters, exclusivity rules, and class/rarity bounds.`,
    )
  }

  return { valid: errors.length === 0, errors }
}

export function generateSquad(
  operators: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource = Math.random,
): Operator[] {
  const shapeErrors = validateConstraintShape(constraints)
  if (shapeErrors.length > 0) throw new Error(shapeErrors.join(' '))

  const eligible = filterEligibleOperators(operators, constraints)
  if (eligible.length < constraints.squadSize) {
    throw new Error(
      `Only ${eligible.length} eligible operators are available for ${constraints.squadSize} requested slots.`,
    )
  }

  const result = solveAssignment(eligible, constraints, random)
  if (!result.squad) {
    throw new Error(
      result.exhausted
        ? 'Constraint search exceeded the safe interactive limit. Simplify the current squad constraints or bounds.'
        : `No squad of ${constraints.squadSize} operators can satisfy the current slot constraints, filters, exclusivity rules, and class/rarity bounds.`,
    )
  }

  return result.squad
}
