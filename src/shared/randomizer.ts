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

const rarityGroupsByRarity = Object.fromEntries(
  operatorRarities.map((rarity) => [
    rarity,
    rarityGroupKeys.filter((group) =>
      (rarityGroupDefinitions[group].rarities as readonly OperatorRarity[]).includes(
        rarity,
      ),
    ),
  ]),
) as unknown as Record<OperatorRarity, readonly RarityGroupKey[]>

function rarityGroupsFor(rarity: OperatorRarity): readonly RarityGroupKey[] {
  return rarityGroupsByRarity[rarity]
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
      (operatorClass) =>
        countFor(classCounts, operatorClass) >= bounds.class[operatorClass].min,
    ) &&
    operatorRarities.every(
      (rarity) => countFor(rarityCounts, rarity) >= bounds.rarity[rarity].min,
    ) &&
    rarityGroupKeys.every(
      (group) =>
        countFor(rarityGroupCounts, group) >= bounds.rarityGroups[group].min,
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
    (group) =>
      countFor(rarityGroupCounts, group) + 1 <= bounds.rarityGroups[group].max,
  )
}

function minimumsStillReachable(
  remainingSlots: readonly number[],
  candidatesBySlot: readonly PreparedCandidate[][],
  classCounts: ConstraintCountMap<OperatorClass>,
  rarityCounts: ConstraintCountMap<OperatorRarity>,
  rarityGroupCounts: ConstraintCountMap<RarityGroupKey>,
  bounds: PreparedBounds,
): boolean {
  for (const operatorClass of operatorClasses) {
    const minimum = bounds.class[operatorClass].min
    if (minimum <= countFor(classCounts, operatorClass)) continue
    const possible = remainingSlots.reduce(
      (total, slot) =>
        total +
        (candidatesBySlot[slot].some(
          (candidate) => candidate.operator.class === operatorClass,
        )
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
        (candidatesBySlot[slot].some(
          (candidate) => candidate.operator.rarity === rarity,
        )
          ? 1
          : 0),
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
        (candidatesBySlot[slot].some((candidate) =>
          candidate.rarityGroups.includes(group),
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
  slotSelection: 'static' | 'dynamic' = 'static',
  candidateOrdering: 'random' | 'deficit' = 'random',
): SearchResult {
  const target = constraints.squadSize
  const bounds = prepareBounds(constraints)
  const preparedCandidates = eligible.map((operator) =>
    prepareCandidate(operator, constraints),
  )
  const candidatesBySlot = Array.from({ length: target }, (_, slotIndex) =>
    preparedCandidates.filter((candidate) =>
      operatorMatchesSlotConstraint(
        candidate.operator,
        constraints.slots[slotIndex],
      ),
    ),
  )

  if (candidatesBySlot.some((candidates) => candidates.length === 0)) {
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
    return candidateCanFitMaximums(
      candidate,
      classCounts,
      rarityCounts,
      rarityGroupCounts,
      bounds,
    )
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
      if (
        countFor(rarityGroupCounts, group) <
        bounds.rarityGroups[group].min
      ) {
        score += 1
      }
    }
    return score
  }

  const orderedCandidatesForSlot = (
    slotIndex: number,
  ): readonly PreparedCandidate[] => {
    const candidates = randomizedCandidates[slotIndex]
    if (candidateOrdering === 'random') return candidates

    return candidates
      .map((candidate, randomIndex) => ({
        candidate,
        randomIndex,
        score: deficitScore(candidate),
      }))
      .sort(
        (left, right) =>
          right.score - left.score || left.randomIndex - right.randomIndex,
      )
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

    ;[slotOrder[depth], slotOrder[bestPosition]] = [
      slotOrder[bestPosition],
      slotOrder[depth],
    ]
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
        bounds,
      )
    }

    if (slotSelection === 'dynamic') selectMostConstrainedSlot(depth)
    const remainingSlots = slotOrder.slice(depth)
    if (
      !minimumsStillReachable(
        remainingSlots,
        randomizedCandidates,
        classCounts,
        rarityCounts,
        rarityGroupCounts,
        bounds,
      )
    ) {
      prunedBranches += 1
      return false
    }

    const slotIndex = slotOrder[depth]
    for (const candidate of orderedCandidatesForSlot(slotIndex)) {
      if (!candidateIsViable(candidate)) continue

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

  const result = solveAssignment(
    eligible,
    constraints,
    random,
    slotSelection,
    candidateOrdering,
  )
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
