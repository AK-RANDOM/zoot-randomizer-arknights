import type { Operator } from './operator'

export const DRAFT_OFFER_SIZE = 3 as const

export type DraftRandomSource = () => number

/** Candidate generation stays replaceable so pull-distribution rules can evolve independently. */
export type DraftCandidateGenerator = (
  candidates: readonly Operator[],
  count: number,
  random: DraftRandomSource,
) => readonly Operator[]

export type DraftStatus = 'active' | 'complete'
export type DraftCompletionReason = 'squad-size-reached' | 'pool-exhausted'
export type DraftActionType = 'pick' | 'forfeit' | 'hold' | 'reroll' | 'slot-expansion'
export type DraftActionBlockReason =
  | 'draft-complete'
  | 'action-disabled'
  | 'invalid-offer-selection'
  | 'hold-slot-occupied'
  | 'per-round-limit'
  | 'per-draft-limit'
  | 'cooldown'

export interface DraftActionUsage {
  total: number
  round: number
  lastUsedRound: number | null
}

export type DraftActionUsageMap = Record<DraftActionType, DraftActionUsage>

interface DraftLimitedActionRules {
  enabled: boolean
  perRoundLimit: number | null
  perDraftLimit: number | null
  cooldownRounds: number
}

export interface DraftHoldRules extends DraftLimitedActionRules {
  discardUnheldOffer: boolean
}

export interface DraftForfeitRules extends DraftLimitedActionRules {
  discardOffer: boolean
}

export interface DraftRerollRules extends DraftLimitedActionRules {
  discardOffer: boolean
}

export type DraftSlotExpansionRules = DraftLimitedActionRules

export interface DraftActionRules {
  hold: DraftHoldRules
  forfeit: DraftForfeitRules
  reroll: DraftRerollRules
  slotExpansion: DraftSlotExpansionRules
}

/** Standard Draft remains M1-equivalent until a Rulebook opts into advanced actions. */
export const DEFAULT_DRAFT_ACTION_RULES: DraftActionRules = {
  hold: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardUnheldOffer: false,
  },
  forfeit: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardOffer: false,
  },
  reroll: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
    discardOffer: true,
  },
  slotExpansion: {
    enabled: false,
    perRoundLimit: 1,
    perDraftLimit: null,
    cooldownRounds: 0,
  },
}

export interface DraftState {
  targetSize: number
  /** Stable identity of the eligible pool + target size for this draft session. */
  poolKey: string
  draftedOperatorIds: string[]
  currentOfferIds: string[]
  /** Offered operators removed by configured discard semantics. */
  discardedOperatorIds: string[]
  /** Single offered-but-not-owned Hold slot. M3 will define commit/release economics. */
  heldOperatorId: string | null
  /** One-based active/last round number. */
  roundNumber: number
  completedRounds: number
  /** M2 records expansion requests; M3 gives these purchases capacity/economic meaning. */
  capacityExpansionCount: number
  actionUsage: DraftActionUsageMap
  status: DraftStatus
  completionReason: DraftCompletionReason | null
}

export interface DraftEngineOptions {
  candidateGenerator?: DraftCandidateGenerator
  random?: DraftRandomSource
  actionRules?: PartialDraftActionRules
}

export type PartialDraftActionRules = {
  hold?: Partial<DraftHoldRules>
  forfeit?: Partial<DraftForfeitRules>
  reroll?: Partial<DraftRerollRules>
  slotExpansion?: Partial<DraftSlotExpansionRules>
}

export type DraftAction =
  | { type: 'pick'; operatorId: string }
  | { type: 'hold'; operatorId: string }
  | { type: 'forfeit' }
  | { type: 'reroll' }
  | { type: 'slot-expansion' }

export interface DraftActionAvailability {
  available: boolean
  reason: DraftActionBlockReason | null
}

function emptyUsage(): DraftActionUsageMap {
  return {
    pick: { total: 0, round: 0, lastUsedRound: null },
    forfeit: { total: 0, round: 0, lastUsedRound: null },
    hold: { total: 0, round: 0, lastUsedRound: null },
    reroll: { total: 0, round: 0, lastUsedRound: null },
    'slot-expansion': { total: 0, round: 0, lastUsedRound: null },
  }
}

function resolvedRules(options: Pick<DraftEngineOptions, 'actionRules'>): DraftActionRules {
  const custom = options.actionRules ?? {}
  return {
    hold: { ...DEFAULT_DRAFT_ACTION_RULES.hold, ...custom.hold },
    forfeit: { ...DEFAULT_DRAFT_ACTION_RULES.forfeit, ...custom.forfeit },
    reroll: { ...DEFAULT_DRAFT_ACTION_RULES.reroll, ...custom.reroll },
    slotExpansion: {
      ...DEFAULT_DRAFT_ACTION_RULES.slotExpansion,
      ...custom.slotExpansion,
    },
  }
}

function uniqueOperatorsById(operators: readonly Operator[]): Operator[] {
  const seen = new Set<string>()
  const unique: Operator[] = []
  for (const operator of operators) {
    if (seen.has(operator.id)) continue
    seen.add(operator.id)
    unique.push(operator)
  }
  return unique
}

function availableOperators(
  pool: readonly Operator[],
  state: Pick<
    DraftState,
    'draftedOperatorIds' | 'discardedOperatorIds' | 'heldOperatorId'
  >,
): Operator[] {
  const unavailable = new Set([...state.draftedOperatorIds, ...state.discardedOperatorIds])
  if (state.heldOperatorId) unavailable.add(state.heldOperatorId)
  return uniqueOperatorsById(pool).filter((operator) => !unavailable.has(operator.id))
}

function validateTargetSize(targetSize: number): void {
  if (!Number.isInteger(targetSize) || targetSize < 1) {
    throw new Error('Draft target size must be a positive integer.')
  }
}

function validateLimitedRule(label: string, rule: DraftLimitedActionRules): void {
  for (const [name, value] of [
    ['per-round limit', rule.perRoundLimit],
    ['per-draft limit', rule.perDraftLimit],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`Draft ${label} ${name} must be null or a positive integer.`)
    }
  }
  if (!Number.isInteger(rule.cooldownRounds) || rule.cooldownRounds < 0) {
    throw new Error(`Draft ${label} cooldown must be a non-negative integer.`)
  }
}

function validateRules(rules: DraftActionRules): void {
  validateLimitedRule('Hold', rules.hold)
  validateLimitedRule('Forfeit', rules.forfeit)
  validateLimitedRule('Reroll', rules.reroll)
  validateLimitedRule('slot expansion', rules.slotExpansion)
}

/** Stable identity for a Draft session. Pool order does not matter. */
export function createDraftPoolKey(pool: readonly Operator[], targetSize: number): string {
  validateTargetSize(targetSize)
  const ids = uniqueOperatorsById(pool)
    .map((operator) => operator.id)
    .sort()
  return JSON.stringify([targetSize, ...ids])
}

function validateGeneratedOffer(
  offer: readonly Operator[],
  candidates: readonly Operator[],
): void {
  if (offer.length !== DRAFT_OFFER_SIZE) {
    throw new Error(`Draft candidate generator must return exactly ${DRAFT_OFFER_SIZE} operators.`)
  }
  const candidateIds = new Set(candidates.map((operator) => operator.id))
  const seen = new Set<string>()
  for (const operator of offer) {
    if (!candidateIds.has(operator.id)) {
      throw new Error(`Draft candidate generator returned ineligible operator ${operator.id}.`)
    }
    if (seen.has(operator.id)) {
      throw new Error(`Draft candidate generator returned duplicate operator ${operator.id}.`)
    }
    seen.add(operator.id)
  }
}

function randomOffset(random: DraftRandomSource, range: number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Draft random source must return a finite value in the range [0, 1).')
  }
  return Math.floor(value * range)
}

export function generateEqualOpportunityCandidates(
  candidates: readonly Operator[],
  count: number,
  random: DraftRandomSource = Math.random,
): Operator[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Candidate count must be a non-negative integer.')
  }
  if (candidates.length < count) {
    throw new Error(`Cannot generate ${count} candidates from a pool of ${candidates.length}.`)
  }
  const shuffled = [...candidates]
  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + randomOffset(random, shuffled.length - index)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}

function generatedOffer(
  pool: readonly Operator[],
  state: DraftState,
  options: DraftEngineOptions,
): string[] | null {
  const candidates = availableOperators(pool, state)
  if (candidates.length < DRAFT_OFFER_SIZE) return null
  const candidateGenerator = options.candidateGenerator ?? generateEqualOpportunityCandidates
  const random = options.random ?? Math.random
  const offer = candidateGenerator(candidates, DRAFT_OFFER_SIZE, random)
  validateGeneratedOffer(offer, candidates)
  return offer.map((operator) => operator.id)
}

function resetRoundUsage(usage: DraftActionUsageMap): DraftActionUsageMap {
  return Object.fromEntries(
    Object.entries(usage).map(([action, value]) => [action, { ...value, round: 0 }]),
  ) as DraftActionUsageMap
}

function recordAction(state: DraftState, action: DraftActionType): DraftActionUsageMap {
  const usage = state.actionUsage[action]
  return {
    ...state.actionUsage,
    [action]: {
      total: usage.total + 1,
      round: usage.round + 1,
      lastUsedRound: state.roundNumber,
    },
  }
}

function completeState(state: DraftState, reason: DraftCompletionReason): DraftState {
  return { ...state, currentOfferIds: [], status: 'complete', completionReason: reason }
}

function beginNextRound(
  state: DraftState,
  pool: readonly Operator[],
  options: DraftEngineOptions,
): DraftState {
  if (state.draftedOperatorIds.length >= state.targetSize) {
    return completeState(
      { ...state, completedRounds: state.completedRounds + 1 },
      'squad-size-reached',
    )
  }

  const nextBase: DraftState = {
    ...state,
    roundNumber: state.roundNumber + 1,
    completedRounds: state.completedRounds + 1,
    actionUsage: resetRoundUsage(state.actionUsage),
    currentOfferIds: [],
  }
  const offer = generatedOffer(pool, nextBase, options)
  if (!offer) {
    return completeState(
      { ...nextBase, roundNumber: state.roundNumber },
      'pool-exhausted',
    )
  }
  return { ...nextBase, currentOfferIds: offer, status: 'active', completionReason: null }
}

export function startDraft(
  pool: readonly Operator[],
  targetSize: number,
  options: DraftEngineOptions = {},
): DraftState {
  const rules = resolvedRules(options)
  validateRules(rules)
  const poolKey = createDraftPoolKey(pool, targetSize)
  const base: DraftState = {
    targetSize,
    poolKey,
    draftedOperatorIds: [],
    currentOfferIds: [],
    discardedOperatorIds: [],
    heldOperatorId: null,
    roundNumber: 1,
    completedRounds: 0,
    capacityExpansionCount: 0,
    actionUsage: emptyUsage(),
    status: 'active',
    completionReason: null,
  }
  const offer = generatedOffer(pool, base, options)
  return offer ? { ...base, currentOfferIds: offer } : completeState(base, 'pool-exhausted')
}

function actionRule(
  action: DraftActionType,
  rules: DraftActionRules,
): DraftLimitedActionRules | null {
  switch (action) {
    case 'pick':
      return null
    case 'hold':
      return rules.hold
    case 'forfeit':
      return rules.forfeit
    case 'reroll':
      return rules.reroll
    case 'slot-expansion':
      return rules.slotExpansion
  }
}

export function getDraftActionAvailability(
  state: DraftState,
  action: DraftAction,
  options: Pick<DraftEngineOptions, 'actionRules'> = {},
): DraftActionAvailability {
  if (state.status !== 'active') return { available: false, reason: 'draft-complete' }
  if (
    (action.type === 'pick' || action.type === 'hold') &&
    !state.currentOfferIds.includes(action.operatorId)
  ) {
    return { available: false, reason: 'invalid-offer-selection' }
  }
  if (action.type === 'hold' && state.heldOperatorId !== null) {
    return { available: false, reason: 'hold-slot-occupied' }
  }

  const rule = actionRule(action.type, resolvedRules(options))
  if (!rule) return { available: true, reason: null }
  if (!rule.enabled) return { available: false, reason: 'action-disabled' }

  const usage = state.actionUsage[action.type]
  if (rule.perRoundLimit !== null && usage.round >= rule.perRoundLimit) {
    return { available: false, reason: 'per-round-limit' }
  }
  if (rule.perDraftLimit !== null && usage.total >= rule.perDraftLimit) {
    return { available: false, reason: 'per-draft-limit' }
  }
  if (
    usage.lastUsedRound !== null &&
    state.roundNumber - usage.lastUsedRound <= rule.cooldownRounds
  ) {
    return { available: false, reason: 'cooldown' }
  }
  return { available: true, reason: null }
}

function assertPoolIdentity(state: DraftState, pool: readonly Operator[]): void {
  if (createDraftPoolKey(pool, state.targetSize) !== state.poolKey) {
    throw new Error('Draft pool or target size changed after this draft started.')
  }
}

function assertActionAvailable(
  state: DraftState,
  action: DraftAction,
  options: DraftEngineOptions,
): void {
  const availability = getDraftActionAvailability(state, action, options)
  if (!availability.available) {
    throw new Error(`Draft action ${action.type} is unavailable: ${availability.reason}.`)
  }
}

function appendDiscarded(current: readonly string[], additions: readonly string[]): string[] {
  return [...new Set([...current, ...additions])]
}

export function applyDraftAction(
  state: DraftState,
  pool: readonly Operator[],
  action: DraftAction,
  options: DraftEngineOptions = {},
): DraftState {
  assertPoolIdentity(state, pool)
  const rules = resolvedRules(options)
  validateRules(rules)
  assertActionAvailable(state, action, options)
  const actionUsage = recordAction(state, action.type)

  switch (action.type) {
    case 'pick':
      if (state.draftedOperatorIds.includes(action.operatorId)) {
        throw new Error(`Operator ${action.operatorId} has already been drafted.`)
      }
      return beginNextRound(
        {
          ...state,
          draftedOperatorIds: [...state.draftedOperatorIds, action.operatorId],
          actionUsage,
        },
        pool,
        options,
      )

    case 'hold': {
      const discardedOperatorIds = rules.hold.discardUnheldOffer
        ? appendDiscarded(
            state.discardedOperatorIds,
            state.currentOfferIds.filter((id) => id !== action.operatorId),
          )
        : state.discardedOperatorIds
      return beginNextRound(
        { ...state, heldOperatorId: action.operatorId, discardedOperatorIds, actionUsage },
        pool,
        options,
      )
    }

    case 'forfeit': {
      const discardedOperatorIds = rules.forfeit.discardOffer
        ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds)
        : state.discardedOperatorIds
      return beginNextRound({ ...state, discardedOperatorIds, actionUsage }, pool, options)
    }

    case 'reroll': {
      const discardedOperatorIds = rules.reroll.discardOffer
        ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds)
        : state.discardedOperatorIds
      const next = { ...state, discardedOperatorIds, actionUsage, currentOfferIds: [] }
      const offer = generatedOffer(pool, next, options)
      return offer ? { ...next, currentOfferIds: offer } : completeState(next, 'pool-exhausted')
    }

    case 'slot-expansion':
      return {
        ...state,
        capacityExpansionCount: state.capacityExpansionCount + 1,
        actionUsage,
      }
  }
}

export function pickDraftOperator(
  state: DraftState,
  pool: readonly Operator[],
  operatorId: string,
  options: DraftEngineOptions = {},
): DraftState {
  return applyDraftAction(state, pool, { type: 'pick', operatorId }, options)
}
