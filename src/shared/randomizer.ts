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
import { standardAcquisitionGroup } from './operatorMetadata'
import { operatorGender } from './genderMetadata'

export interface ConstraintValidationResult {
  valid: boolean
  errors: string[]
}

type RandomSource = () => number

type ConstraintCountMap<T extends string | number> = Map<T, number>

export interface SolverStats {
  visits: number
  backtracks: number
  prunedBranches: number
  exhausted: boolean
  elapsedMs: number
}

interface SearchResult {
  squad: Operator[] | null
  exhausted: boolean
  stats: SolverStats
}

interface PreparedCandidate {
  operator: Operator
  exclusivityKeys: readonly string[]
  rarityGroups: readonly RarityGroupKey[]
}

interface PreparedBounds {
  class: Record<OperatorClass, { min: number; max: number }>
  rarity: Record<OperatorRarity, { min: number; max: number }>
  rarityGroups: Record<RarityGroupKey, { min: number; max: number }>
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

function acquisitionEnabled(operator: Operator, constraints: RandomizerConstraints): boolean {
  switch (operator.acquisition.family) {
    case 'limited':
      return operator.acquisition.group !== null
        ? constraints.acquisition.limited[operator.acquisition.group as LimitedAcquisitionGroup]
        : false
    case 'standard':
      return constraints.acquisition.standard[
        standardAcquisitionGroup(operator, constraints.release.server)
      ]
    case 'welfare':
      return operator.acquisition.group !== null
        ? constraints.acquisition.welfare[operator.acquisition.group as WelfareAcquisitionGroup]
        : false
  }
}

function factionEnabled(operator: Operator, constraints: RandomizerConstraints): boolean {
  const excluded = new Set(constraints.faction.excludedIds)
  if (excluded.size === 0) return true

  if (constraints.faction.matchMode === 'main') {
    const primary = operator.faction.primary?.at(-1) ?? operator.faction.main
    return primary === null || !excluded.has(primary)
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
  const { server, minYear, maxYear, minDate, maxDate, ignoreBoundsForLowRarity } = constraints.release
  const excludedSubclasses = new Set(constraints.subclass.excludedIds)
  const excludedGenders = new Set(constraints.gender?.excludedIds)

  return operators.filter((operator) => {
    if (!operator.availableOn[server]) return false

    const release = operator.release[server]
    if (!ignoreBoundsForLowRarity || operator.rarity >= 5) {
      if (minYear !== null && (release.yearGroup === null || release.yearGroup < minYear)) {
        return false
      }
      if (maxYear !== null && (release.yearGroup === null || release.yearGroup > maxYear)) {
        return false
      }
      if (minDate && (!release.date || release.date < minDate)) return false
      if (maxDate && (!release.date || release.date > maxDate)) return false
    }

    if (!acquisitionEnabled(operator, constraints)) return false

    if (operator.collaboration) {
      if (!collaborationSourceEnabled(constraints.collaboration, operator.collaboration)) {
        return false
      }
    } else if (!constraints.collaboration.includeNonCollab) {
      return false
    }

    if (excludedSubclasses.has(operator.subclass.id)) return false
    if (excludedGenders.size && excludedGenders.has(operatorGender(operator))) return false
    if (!factionEnabled(operator, constraints)) return false

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
  if (constraint.rarities.length > 0 && !constraint.rarities.includes(operator.rarity)) {
    return false
  }
  if (constraint.classes.length > 0 && !constraint.classes.includes(operator.class)) {
    return false
  }
  if (
    constraint.subclasses !== undefined &&
    !constraint.subclasses.includes(operator.subclass.id)
  ) {
    return false
  }
  if (constraint.operatorId && operator.id !== constraint.operatorId) return false
  if (
    constraint.mandatoryExclusivityGroup &&
    operator.mandatoryExclusivityGroup !== constraint.mandatoryExclusivityGroup
  ) {
    return false
  }
  return true
}

export function reservedMandatoryGroupsFromSlotConstraints(
  operators: readonly Operator[],
  constraints: RandomizerConstraints,
  exceptSlotIndex: number | null = null,
): Set<string> {
  const byId = new Map(operators.map((operator) => [operator.id, operator]))
  const groups = new Set<string>()
  constraints.slots.slice(0, constraints.squadSize).forEach((slot, index) => {
    if (index === exceptSlotIndex) return
    if (slot.mandatoryExclusivityGroup) groups.add(slot.mandatoryExclusivityGroup)
    if (slot.operatorId) {
      const group = byId.get(slot.operatorId)?.mandatoryExclusivityGroup
      if (group) groups.add(group)
    }
  })
  return groups
}

function exclusivityKeys(operator: Operator, constraints: RandomizerConstraints): string[] {
  const keys: string[] = []
  if (operator.mandatoryExclusivityGroup) {
    keys.push(`mandatory:${operator.mandatoryExclusivityGroup}`)
  }
  if (constraints.alterExclusivity && operator.alterGroup) {
    keys.push(operator.alterGroup)
  }
  return keys
}

const rarityGroupsByRarity = Object.fromEntries(
  operatorRarities.map((rarity) => [
    rarity,
    rarityGroupKeys.filter((group) =>
      (rarityGroupDefinitions[group].rarities as readonly OperatorRarity[]).includes(rarity),
    ),
  ]),
) as unknown as Record<OperatorRarity, readonly RarityGroupKey[]>

function rarityGroupsFor(rarity: OperatorRarity): readonly RarityGroupKey[] {
  return rarityGroupsByRarity[rarity]
}

function countFor<T extends string | number>(counts: ConstraintCountMap<T>, key: T): number {
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

function prepareBounds(constraints: RandomizerConstraints): PreparedBounds {
  return {
    class: Object.fromEntries(
      operatorClasses.map((operatorClass) => [
        operatorClass,
        resolveNumericConstraint(constraints.class[operatorClass]),
      ]),
    ) as PreparedBounds['class'],
    rarity: Object.fromEntries(
      operatorRarities.map((rarity) => [
        rarity,
        resolveNumericConstraint(constraints.rarity[rarity]),
      ]),
    ) as PreparedBounds['rarity'],
    rarityGroups: Object.fromEntries(
      rarityGroupKeys.map((group) => [
        group,
        resolveNumericConstraint(constraints.rarityGroups[group]),
      ]),
    ) as PreparedBounds['rarityGroups'],
  }
}

function prepareCandidate(
  operator: Operator,
  constraints: RandomizerConstraints,
): PreparedCandidate {
  return {
    operator,
    exclusivityKeys: exclusivityKeys(operator, constraints),
    rarityGroups: rarityGroupsFor(operator.rarity),
  }
}

function satisfiesMinimums(
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  bounds: PreparedBounds,
): boolean {
  return (
    operatorClasses.every(
      (operatorClass) => countFor(classCounts, operatorClass) >= bounds.class[operatorClass].min,
    ) &&
    operatorRarities.every(
      (rarity) => countFor(rarityCounts, rarity) >= bounds.rarity[rarity].min,
    ) &&
    rarityGroupKeys.every(
      (group) => countFor(rarityGroupCounts, group) >= bounds.rarityGroups[group].min,
    )
  )
}

function candidateCanFitMaximums(
  candidate: PreparedCandidate,
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  bounds: PreparedBounds,
): boolean {
  const operator = candidate.operator
  if (countFor(classCounts, operator.class) + 1 > bounds.class[operator.class].max) {
    return false
  }
  if (countFor(rarityCounts, operator.rarity) + 1 > bounds.rarity[operator.rarity].max) {
    return false
  }
  return candidate.rarityGroups.every(
    (group) => countFor(rarityGroupCounts, group) + 1 <= bounds.rarityGroups[group].max,
  )
}

function minimumsStillReachable(
  remainingSlots: readonly number[],
  candidatesBySlot: readonly PreparedCandidate[][],
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  bounds: PreparedBounds,
  candidateIsViable: (candidate: PreparedCandidate) => boolean,
): boolean {
  for (const operatorClass of operatorClasses) {
    const minimum = bounds.class[operatorClass].min
    if (minimum <= countFor(classCounts, operatorClass)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some((candidate) => candidate.operator.class === operatorClass && candidateIsViable(candidate))
          ? 1
          : 0),
      0,
    )
    if (countFor(classCounts, operatorClass) + possible < minimum) return false
  }

  for (const rarity of operatorRarities) {
    const minimum = bounds.rarity[rarity].min
    if (minimum <= countFor(rarityCounts, rarity)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some((candidate) => candidate.operator.rarity === rarity && candidateIsViable(candidate)) ? 1 : 0),
      0,
    )
    if (countFor(rarityCounts, rarity) + possible < minimum) return false
  }

  for (const group of rarityGroupKeys) {
    const minimum = bounds.rarityGroups[group].min
    if (minimum <= countFor(rarityGroupCounts, group)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some((candidate) => candidate.rarityGroups.includes(group) && candidateIsViable(candidate))
          ? 1
          : 0),
      0,
    )
    if (countFor(rarityGroupCounts, group) + possible < minimum) return false
  }

  return true
}

function classMinimumsFitSlots(
  candidatesBySlot: readonly PreparedCandidate[][],
  bounds: PreparedBounds,
): boolean {
  const slotsByClass = new Map(
    operatorClasses.map((operatorClass) => [
      operatorClass,
      candidatesBySlot.flatMap((candidates, index) =>
        candidates.some(({ operator }) => operator.class === operatorClass) ? [index] : [],
      ),
    ]),
  )
  const classBySlot = new Map<number, OperatorClass>()
  const assign = (operatorClass: OperatorClass, seen: Set<number>): boolean => {
    for (const slot of slotsByClass.get(operatorClass) ?? []) {
      if (seen.has(slot)) continue
      seen.add(slot)
      const previous = classBySlot.get(slot)
      if (previous === undefined || assign(previous, seen)) {
        classBySlot.set(slot, operatorClass)
        return true
      }
    }
    return false
  }

  // Required classes can each have candidates and still compete for the same slot.
  return operatorClasses.every((operatorClass) => {
    for (let count = 0; count < bounds.class[operatorClass].min; count += 1) {
      if (!assign(operatorClass, new Set())) return false
    }
    return true
  })
}

function solveAssignment(
  eligible: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource,
  slotSelection: 'static' | 'dynamic' = 'static',
  candidateOrdering: 'random' | 'deficit' = 'random',
  deadline = Infinity,
): SearchResult {
  const target = constraints.squadSize
  const bounds = prepareBounds(constraints)
  const preparedCandidates = eligible.map((operator) => prepareCandidate(operator, constraints))
  const candidatesBySlot = Array.from({ length: target }, (_, slotIndex) =>
    preparedCandidates.filter((candidate) =>
      operatorMatchesSlotConstraint(candidate.operator, constraints.slots[slotIndex]),
    ),
  )

  const classSupply = new Map<OperatorClass, number>()
  const raritySupply = new Map<OperatorRarity, number>()
  const rarityGroupSupply = new Map<RarityGroupKey, number>()
  const counted = new Set<string>()
  for (const candidates of candidatesBySlot) {
    for (const candidate of candidates) {
      const { id, class: operatorClass, rarity } = candidate.operator
      if (counted.has(id)) continue
      counted.add(id)
      increment(classSupply, operatorClass, 1)
      increment(raritySupply, rarity, 1)
      for (const group of candidate.rarityGroups) increment(rarityGroupSupply, group, 1)
    }
  }

  // A candidate matching several slots can only contribute to a minimum once.
  if (
    candidatesBySlot.some((candidates) => candidates.length === 0) ||
    !satisfiesMinimums(classSupply, raritySupply, rarityGroupSupply, bounds) ||
    !classMinimumsFitSlots(candidatesBySlot, bounds)
  ) {
    return {
      squad: null,
      exhausted: false,
      stats: {
        visits: 0,
        backtracks: 0,
        prunedBranches: 0,
        exhausted: false,
        elapsedMs: 0,
      },
    }
  }

  const slotOrder = Array.from({ length: target }, (_, index) => index).sort((left, right) => {
    const candidateDelta = candidatesBySlot[left].length - candidatesBySlot[right].length
    if (candidateDelta !== 0) return candidateDelta
    const leftConstraint = constraints.slots[left]
    const rightConstraint = constraints.slots[right]
    const leftSpecificity =
      leftConstraint.rarities.length +
      leftConstraint.classes.length +
      (leftConstraint.subclasses === undefined ? 0 : leftConstraint.subclasses.length + 1) +
      (leftConstraint.operatorId || leftConstraint.mandatoryExclusivityGroup ? 1 : 0)
    const rightSpecificity =
      rightConstraint.rarities.length +
      rightConstraint.classes.length +
      (rightConstraint.subclasses === undefined ? 0 : rightConstraint.subclasses.length + 1) +
      (rightConstraint.operatorId || rightConstraint.mandatoryExclusivityGroup ? 1 : 0)
    return rightSpecificity - leftSpecificity
  })

  const randomizedCandidates = candidatesBySlot.map((candidates) => shuffled(candidates, random))
  const equivalentCandidateKeys = new Map<PreparedCandidate, string>()
  if (candidateOrdering === 'deficit') {
    const slotMasks = new Map<PreparedCandidate, number>()
    candidatesBySlot.forEach((candidates, slot) => {
      for (const candidate of candidates) {
        slotMasks.set(candidate, (slotMasks.get(candidate) ?? 0) | (1 << slot))
      }
    })
    for (const candidate of preparedCandidates) {
      // Candidates in the same class and rarity that fit the same slots and use
      // the same exclusivity keys are interchangeable in a feasibility check.
      equivalentCandidateKeys.set(
        candidate,
        JSON.stringify([
          candidate.operator.class,
          candidate.operator.rarity,
          slotMasks.get(candidate),
          candidate.exclusivityKeys,
        ]),
      )
    }
  }
  const assignment: Array<Operator | undefined> = Array(target).fill(undefined)
  const usedIds = new Set<string>()
  const usedExclusivity = new Set<string>()
  const classCounts = new Map<OperatorClass, number>()
  const rarityCounts = new Map<OperatorRarity, number>()
  const rarityGroupCounts = new Map<RarityGroupKey, number>()
  let visits = 0
  let backtracks = 0
  let prunedBranches = 0
  let exhausted = false
  const startedAt = performance.now()

  const addOperator = (candidate: PreparedCandidate): void => {
    const operator = candidate.operator
    usedIds.add(operator.id)
    for (const key of candidate.exclusivityKeys) usedExclusivity.add(key)
    increment(classCounts, operator.class, 1)
    increment(rarityCounts, operator.rarity, 1)
    for (const group of candidate.rarityGroups) {
      increment(rarityGroupCounts, group, 1)
    }
  }

  const removeOperator = (candidate: PreparedCandidate): void => {
    const operator = candidate.operator
    usedIds.delete(operator.id)
    for (const key of candidate.exclusivityKeys) usedExclusivity.delete(key)
    increment(classCounts, operator.class, -1)
    increment(rarityCounts, operator.rarity, -1)
    for (const group of candidate.rarityGroups) {
      increment(rarityGroupCounts, group, -1)
    }
  }

  const candidateIsViable = (candidate: PreparedCandidate): boolean => {
    if (usedIds.has(candidate.operator.id)) return false
    if (candidate.exclusivityKeys.some((key) => usedExclusivity.has(key))) {
      return false
    }
    return candidateCanFitMaximums(candidate, classCounts, rarityCounts, rarityGroupCounts, bounds)
  }

  const deficitScore = (candidate: PreparedCandidate): number => {
    const operator = candidate.operator
    let score = 0
    if (countFor(classCounts, operator.class) < bounds.class[operator.class].min) {
      score += 1
    }
    if (countFor(rarityCounts, operator.rarity) < bounds.rarity[operator.rarity].min) {
      score += 1
    }
    for (const group of candidate.rarityGroups) {
      if (countFor(rarityGroupCounts, group) < bounds.rarityGroups[group].min) {
        score += 1
      }
    }
    return score
  }

  const orderedCandidatesForSlot = (slotIndex: number): readonly PreparedCandidate[] => {
    const candidates = randomizedCandidates[slotIndex]
    if (candidateOrdering === 'random') return candidates

    return candidates
      .map((candidate, randomIndex) => ({
        candidate,
        randomIndex,
        score: deficitScore(candidate),
      }))
      .sort((left, right) => right.score - left.score || left.randomIndex - right.randomIndex)
      .map(({ candidate }) => candidate)
  }

  function selectMostConstrainedSlot(depth: number): void {
    let bestPosition = depth
    let bestViableCount = Number.POSITIVE_INFINITY

    for (let position = depth; position < slotOrder.length; position += 1) {
      const slotIndex = slotOrder[position]
      let viableCount = 0
      for (const operator of randomizedCandidates[slotIndex]) {
        if (candidateIsViable(operator)) viableCount += 1
        if (viableCount >= bestViableCount) break
      }

      if (viableCount < bestViableCount) {
        bestPosition = position
        bestViableCount = viableCount
        if (viableCount === 0) break
      }
    }

    ;[slotOrder[depth], slotOrder[bestPosition]] = [slotOrder[bestPosition], slotOrder[depth]]
  }

  function search(depth: number): boolean {
    visits += 1
    if (visits > SEARCH_VISIT_LIMIT || ((visits & 63) === 1 && performance.now() >= deadline)) {
      exhausted = true
      return false
    }

    if (depth >= slotOrder.length) {
      return satisfiesMinimums(classCounts, rarityCounts, rarityGroupCounts, bounds)
    }

    if (slotSelection === 'dynamic') {
      selectMostConstrainedSlot(depth)
      if (!randomizedCandidates[slotOrder[depth]].some(candidateIsViable)) {
        prunedBranches += 1
        return false
      }
    }
    const remainingSlots = slotOrder.slice(depth)
    if (
      !minimumsStillReachable(
        remainingSlots,
        randomizedCandidates,
        classCounts,
        rarityCounts,
        rarityGroupCounts,
        bounds,
        candidateIsViable,
      )
    ) {
      prunedBranches += 1
      return false
    }

    const slotIndex = slotOrder[depth]
    const tried = candidateOrdering === 'deficit' ? new Set<string>() : undefined
    for (const candidate of orderedCandidatesForSlot(slotIndex)) {
      if (!candidateIsViable(candidate)) continue
      if (tried) {
        const key = equivalentCandidateKeys.get(candidate)!
        if (tried.has(key)) continue
        tried.add(key)
      }

      assignment[slotIndex] = candidate.operator
      addOperator(candidate)

      if (search(depth + 1)) return true

      removeOperator(candidate)
      assignment[slotIndex] = undefined
      backtracks += 1
      if (exhausted) return false
    }

    return false
  }

  const squad = search(0) ? (assignment as Operator[]) : null
  const stats: SolverStats = {
    visits,
    backtracks,
    prunedBranches,
    exhausted,
    elapsedMs: performance.now() - startedAt,
  }
  return { squad, exhausted, stats }
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
    ...(draft.subclasses !== undefined ? { subclasses: [...draft.subclasses] } : {}),
    ...(draft.operatorId ? { operatorId: draft.operatorId } : {}),
    ...(draft.mandatoryExclusivityGroup
      ? { mandatoryExclusivityGroup: draft.mandatoryExclusivityGroup }
      : {}),
  }
  return { ...constraints, slots }
}

export function canSlotResolveTo(
  operators: Operator[],
  constraints: RandomizerConstraints,
  slotIndex: number,
  draft: SlotConstraint,
  probe: {
    rarity?: OperatorRarity
    operatorClass?: OperatorClass
    subclassId?: string
    operatorId?: string
    mandatoryExclusivityGroup?: string
  },
): boolean {
  if (slotIndex < 0 || slotIndex >= constraints.squadSize) return false
  const forced: SlotConstraint = {
    rarities: probe.rarity === undefined ? [...draft.rarities] : [probe.rarity],
    classes: probe.operatorClass === undefined ? [...draft.classes] : [probe.operatorClass],
    ...(probe.subclassId !== undefined
      ? { subclasses: [probe.subclassId] }
      : draft.subclasses !== undefined
        ? { subclasses: [...draft.subclasses] }
        : {}),
    operatorId: probe.operatorId ?? draft.operatorId ?? null,
    mandatoryExclusivityGroup:
      probe.operatorId !== undefined
        ? null
        : (probe.mandatoryExclusivityGroup ?? draft.mandatoryExclusivityGroup ?? null),
  }
  return validateConstraints(constraintsWithSlotDraft(constraints, slotIndex, forced), operators)
    .valid
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

  // Validation only needs a witness that a valid squad exists. Prefer candidates
  // that satisfy outstanding minimums so background checks avoid unnecessary
  // backtracking, and reselect the tightest slot as bounds/exclusivity change.
  // A reset slot can otherwise defer an impossible choice behind millions of
  // equivalent assignments. User-facing generation keeps its random ordering.
  const result = solveAssignment(eligible, constraints, validationRandom(), 'dynamic', 'deficit')
  if (!result.squad) {
    errors.push(
      result.exhausted
        ? 'Constraint search exceeded the safe interactive limit. Simplify the current squad constraints or bounds.'
        : `No squad of ${constraints.squadSize} operators can satisfy the current slot constraints, filters, exclusivity rules, and class/rarity bounds.`,
    )
  }

  return { valid: errors.length === 0, errors }
}

export function measureConstraintSearch(
  operators: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource = validationRandom(),
  slotSelection: 'static' | 'dynamic' = 'static',
  candidateOrdering: 'random' | 'deficit' = 'random',
): { solved: boolean; stats: SolverStats } {
  const shapeErrors = validateConstraintShape(constraints)
  if (shapeErrors.length > 0) throw new Error(shapeErrors.join(' '))

  const eligible = filterEligibleOperators(operators, constraints)
  if (eligible.length < constraints.squadSize) {
    return {
      solved: false,
      stats: {
        visits: 0,
        backtracks: 0,
        prunedBranches: 0,
        exhausted: false,
        elapsedMs: 0,
      },
    }
  }

  const result = solveAssignment(eligible, constraints, random, slotSelection, candidateOrdering)
  return { solved: result.squad !== null, stats: result.stats }
}

export function generateSquadWithStats(
  operators: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource = Math.random,
): { squad: Operator[]; stats: SolverStats } {
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

  return { squad: result.squad, stats: result.stats }
}

export function generateSquad(
  operators: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource = Math.random,
): Operator[] {
  return generateSquadWithStats(operators, constraints, random).squad
}

interface SquadRerollPlan {
  pool: Operator[]
  constraints: RandomizerConstraints
}

export function rollSquadReroll(plan: SquadRerollPlan, random: RandomSource = Math.random): Operator[] {
  return drawChainSquad(plan.pool, plan.constraints, random)
}

export function drawChainSquad(
  pool: Operator[],
  constraints: RandomizerConstraints,
  random: RandomSource = Math.random,
): Operator[] {
  const errors = validateConstraintShape(constraints)
  if (errors.length > 0) throw new Error(errors.join(' '))
  const eligible = filterEligibleOperators(pool, constraints)
  // Shuffle on every click. Prefer candidates that meet unmet minimums and
  // break ties in shuffled order, as in the feasibility search.
  const deadline = performance.now() + 750
  let result: SearchResult
  do {
    result = solveAssignment(eligible, constraints, random, 'dynamic', 'deficit', Math.min(deadline, performance.now() + 125))
  } while (result.exhausted && performance.now() < deadline)
  if (!result.squad) {
    throw new Error(
      result.exhausted
        ? 'The reroll search took too long. Try rerolling again.'
        : 'No replacements satisfy the current squad rules.',
    )
  }
  return result.squad
}

export function createSquadRerollPlanner(
  constraints: RandomizerConstraints,
  squad: readonly Operator[],
  eligiblePool: Operator[],
  exhausted: readonly Operator[],
  deadline = Infinity,
) {
  const eligible = filterEligibleOperators(eligiblePool, constraints)
  const eligibleById = new Map(eligible.map((operator) => [operator.id, operator]))
  const unavailable = new Set([...squad, ...exhausted].map(({ id }) => id))
  const available = eligible.filter(({ id }) => !unavailable.has(id))
  const candidatesBySlot = squad.map((_, index) =>
    available.filter((operator) => operatorMatchesSlotConstraint(operator, constraints.slots[index])),
  )
  const plans = new Map<number, SquadRerollPlan | null>()
  const limited = new Set<number>()
  const validShape =
    squad.length === constraints.squadSize && validateConstraintShape(constraints).length === 0

  function plan(targets: readonly number[]) {
    if (!validShape || targets.length === 0) return null
    if (targets.some((index) => !candidatesBySlot[index] || constraints.slots[index]?.operatorId)) {
      return null
    }
    const mask = targets.reduce((current, index) => current | (1 << index), 0)
    if (plans.has(mask)) return plans.get(mask) ?? null
    const candidates = new Set(targets.flatMap((index) => candidatesBySlot[index]))
    const slots = constraints.slots.map((slot, index) => {
      const member = squad[index]
      if (!member || (mask & (1 << index))) return slot
      const retained = eligibleById.get(member.id)
      if (retained && operatorMatchesSlotConstraint(retained, slot)) candidates.add(retained)
      return { ...slot, operatorId: member.id, mandatoryExclusivityGroup: null }
    })
    const pool = [...candidates]
    const rerollConstraints = { ...constraints, slots }
    const result = pool.length >= constraints.squadSize
      ? solveAssignment(pool, rerollConstraints, validationRandom(), 'dynamic', 'deficit', deadline)
      : null
    if (result?.exhausted) limited.add(mask)
    const plan = result?.squad ? { pool, constraints: rerollConstraints } : null
    plans.set(mask, plan)
    return plan
  }

  return {
    available,
    candidatesBySlot,
    plan,
    wasLimited: (targets: readonly number[]) =>
      limited.has(targets.reduce((mask, index) => mask | (1 << index), 0)),
  }
}
