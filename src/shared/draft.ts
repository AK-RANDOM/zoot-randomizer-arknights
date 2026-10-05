import type { Operator } from './operator'
export const DRAFT_OFFER_SIZE = 3 as const
export type DraftRandomSource = () => number
export type DraftCandidateGenerator = (candidates: readonly Operator[], count: number, random: DraftRandomSource) => readonly Operator[]
export type DraftStatus = 'active' | 'complete'
export type DraftCompletionReason = 'squad-size-reached' | 'pool-exhausted' | 'capacity-exhausted'
export type DraftActionType = 'pick' | 'forfeit' | 'hold' | 'release-hold' | 'reroll' | 'slot-expansion'
export type DraftActionBlockReason = 'draft-complete' | 'action-disabled' | 'invalid-offer-selection' | 'hold-slot-occupied' | 'hold-slot-empty' | 'per-round-limit' | 'per-draft-limit' | 'cooldown' | 'capacity-full' | 'capacity-maxed' | 'capacity-forfeit-unavailable'
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
export interface DraftCapacityRules {
  enabled: boolean
  startingActiveSlots: number
  overflowSlots: number
  maxActiveSlots: number
}
export const DEFAULT_DRAFT_ACTION_RULES: DraftActionRules = {
  hold: { enabled: false, perRoundLimit: 1, perDraftLimit: null, cooldownRounds: 0, discardUnheldOffer: false },
  forfeit: { enabled: false, perRoundLimit: 1, perDraftLimit: null, cooldownRounds: 0, discardOffer: false },
  reroll: { enabled: false, perRoundLimit: 1, perDraftLimit: null, cooldownRounds: 0, discardOffer: true },
  slotExpansion: { enabled: false, perRoundLimit: 1, perDraftLimit: null, cooldownRounds: 0 },
}
export const DEFAULT_DRAFT_CAPACITY_RULES: DraftCapacityRules = { enabled: false, startingActiveSlots: 6, overflowSlots: 1, maxActiveSlots: 12 }
export interface DraftState {
  targetSize: number
  poolKey: string
  draftedOperatorIds: string[]
  currentOfferIds: string[]
  discardedOperatorIds: string[]
  heldOperatorId: string | null
  roundNumber: number
  completedRounds: number
  capacityExpansionCount: number
  activeCapacity: number
  overflowCapacity: number
  forfeitedCapacityCount: number
  capacityRulesEnabled: boolean
  actionUsage: DraftActionUsageMap
  status: DraftStatus
  completionReason: DraftCompletionReason | null
}
export type PartialDraftActionRules = {
  hold?: Partial<DraftHoldRules>
  forfeit?: Partial<DraftForfeitRules>
  reroll?: Partial<DraftRerollRules>
  slotExpansion?: Partial<DraftSlotExpansionRules>
}
export interface DraftEngineOptions {
  candidateGenerator?: DraftCandidateGenerator
  random?: DraftRandomSource
  actionRules?: PartialDraftActionRules
  capacityRules?: Partial<DraftCapacityRules>
}
export type DraftAction = {
  type: 'pick'
  operatorId: string
} | {
  type: 'hold'
  operatorId: string
} | {
  type: 'release-hold'
} | {
  type: 'forfeit'
} | {
  type: 'reroll'
} | {
  type: 'slot-expansion'
}
export interface DraftActionAvailability {
  available: boolean
  reason: DraftActionBlockReason | null
}
function emptyUsage(): DraftActionUsageMap {
  return { pick: { total: 0, round: 0, lastUsedRound: null }, forfeit: { total: 0, round: 0, lastUsedRound: null }, hold: { total: 0, round: 0, lastUsedRound: null }, 'release-hold': { total: 0, round: 0, lastUsedRound: null }, reroll: { total: 0, round: 0, lastUsedRound: null }, 'slot-expansion': { total: 0, round: 0, lastUsedRound: null } }
}
function resolvedRules(options: Pick<DraftEngineOptions, 'actionRules'>): DraftActionRules { const c = options.actionRules ?? {}; return { hold: { ...DEFAULT_DRAFT_ACTION_RULES.hold, ...c.hold }, forfeit: { ...DEFAULT_DRAFT_ACTION_RULES.forfeit, ...c.forfeit }, reroll: { ...DEFAULT_DRAFT_ACTION_RULES.reroll, ...c.reroll }, slotExpansion: { ...DEFAULT_DRAFT_ACTION_RULES.slotExpansion, ...c.slotExpansion } }; }
function resolvedCapacityRules(options: Pick<DraftEngineOptions, 'capacityRules' | 'actionRules'>): DraftCapacityRules {
  const inferred = options.capacityRules?.enabled ?? options.actionRules?.slotExpansion?.enabled ?? false
  return { ...DEFAULT_DRAFT_CAPACITY_RULES, ...options.capacityRules, enabled: inferred }
}
function uniqueOperatorsById(operators: readonly Operator[]): Operator[] { const seen = new Set<string>(); return operators.filter(o => seen.has(o.id) ? false : (seen.add(o.id), true)); }
function availableOperators(pool: readonly Operator[], state: Pick<DraftState, 'draftedOperatorIds' | 'discardedOperatorIds' | 'heldOperatorId'>): Operator[] { const unavailable = new Set([...state.draftedOperatorIds, ...state.discardedOperatorIds]); if (state.heldOperatorId)
  unavailable.add(state.heldOperatorId); return uniqueOperatorsById(pool).filter(o => !unavailable.has(o.id)); }
function validateTargetSize(n: number) { if (!Number.isInteger(n) || n < 1)
  throw new Error('Draft target size must be a positive integer.'); }
function validateLimitedRule(label: string, rule: DraftLimitedActionRules) { for (const [name, value] of [['per-round limit', rule.perRoundLimit], ['per-draft limit', rule.perDraftLimit]] as const) {
  if (value !== null && (!Number.isInteger(value) || value < 1))
    throw new Error(`Draft ${label} ${name} must be null or a positive integer.`)
} if (!Number.isInteger(rule.cooldownRounds) || rule.cooldownRounds < 0)
  throw new Error(`Draft ${label} cooldown must be a non-negative integer.`); }
function validateRules(rules: DraftActionRules) { validateLimitedRule('Hold', rules.hold); validateLimitedRule('Forfeit', rules.forfeit); validateLimitedRule('Reroll', rules.reroll); validateLimitedRule('slot expansion', rules.slotExpansion); }
function validateCapacityRules(rules: DraftCapacityRules) { for (const [label, value] of [['starting active slots', rules.startingActiveSlots], ['overflow slots', rules.overflowSlots], ['maximum active slots', rules.maxActiveSlots]] as const) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`Draft ${label} must be a non-negative integer.`)
} if (rules.startingActiveSlots < 1)
  throw new Error('Draft starting active slots must be at least 1.'); if (rules.maxActiveSlots < rules.startingActiveSlots)
  throw new Error('Draft maximum active slots cannot be below starting active slots.'); }
export function createDraftPoolKey(pool: readonly Operator[], targetSize: number): string { validateTargetSize(targetSize); return JSON.stringify([targetSize, ...uniqueOperatorsById(pool).map(o => o.id).sort()]); }
function validateGeneratedOffer(offer: readonly Operator[], candidates: readonly Operator[]) { if (offer.length !== DRAFT_OFFER_SIZE)
  throw new Error(`Draft candidate generator must return exactly ${DRAFT_OFFER_SIZE} operators.`); const ids = new Set(candidates.map(o => o.id)); const seen = new Set<string>(); for (const o of offer) {
  if (!ids.has(o.id))
    throw new Error(`Draft candidate generator returned ineligible operator ${o.id}.`)
  if (seen.has(o.id))
    throw new Error(`Draft candidate generator returned duplicate operator ${o.id}.`)
  seen.add(o.id)
} }
function randomOffset(random: DraftRandomSource, range: number) { const value = random(); if (!Number.isFinite(value) || value < 0 || value >= 1)
  throw new Error('Draft random source must return a finite value in the range [0, 1).'); return Math.floor(value * range); }
export function generateEqualOpportunityCandidates(candidates: readonly Operator[], count: number, random: DraftRandomSource = Math.random): Operator[] { if (!Number.isInteger(count) || count < 0)
  throw new Error('Candidate count must be a non-negative integer.'); if (candidates.length < count)
  throw new Error(`Cannot generate ${count} candidates from a pool of ${candidates.length}.`); const shuffled = [...candidates]; for (let i = 0; i < count; i++) {
  const j = i + randomOffset(random, shuffled.length - i)
  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
} return shuffled.slice(0, count); }
function generatedOffer(pool: readonly Operator[], state: DraftState, options: DraftEngineOptions): string[] | null { const candidates = availableOperators(pool, state); if (candidates.length < DRAFT_OFFER_SIZE)
  return null; const generator = options.candidateGenerator ?? generateEqualOpportunityCandidates; const offer = generator(candidates, DRAFT_OFFER_SIZE, options.random ?? Math.random); validateGeneratedOffer(offer, candidates); return offer.map(o => o.id); }
function resetRoundUsage(usage: DraftActionUsageMap): DraftActionUsageMap { return Object.fromEntries(Object.entries(usage).map(([a, v]) => [a, { ...v, round: 0 }])) as DraftActionUsageMap; }
function recordAction(state: DraftState, action: DraftActionType): DraftActionUsageMap { const usage = state.actionUsage[action]; return { ...state.actionUsage, [action]: { total: usage.total + 1, round: usage.round + 1, lastUsedRound: state.roundNumber } }; }
function completeState(state: DraftState, reason: DraftCompletionReason): DraftState { return { ...state, currentOfferIds: [], status: 'complete', completionReason: reason }; }
export function currentDraftOwnershipCapacity(state: DraftState): number { return state.capacityRulesEnabled ? Math.max(0, Math.min(state.targetSize, state.activeCapacity + state.overflowCapacity - state.forfeitedCapacityCount)) : state.targetSize; }
function maxAttainableCapacity(state: DraftState, rules: DraftCapacityRules): number { return rules.enabled ? Math.max(0, Math.min(state.targetSize, rules.maxActiveSlots + state.overflowCapacity - state.forfeitedCapacityCount)) : state.targetSize; }
function beginNextRound(state: DraftState, pool: readonly Operator[], options: DraftEngineOptions): DraftState {
  if (state.draftedOperatorIds.length >= state.targetSize)
    return completeState({ ...state, completedRounds: state.completedRounds + 1 }, 'squad-size-reached')
  const capacity = resolvedCapacityRules(options)
  if (capacity.enabled && state.draftedOperatorIds.length >= maxAttainableCapacity(state, capacity))
    return completeState({ ...state, completedRounds: state.completedRounds + 1 }, 'capacity-exhausted')
  const nextBase = { ...state, roundNumber: state.roundNumber + 1, completedRounds: state.completedRounds + 1, actionUsage: resetRoundUsage(state.actionUsage), currentOfferIds: [] }
  const offer = generatedOffer(pool, nextBase, options)
  if (!offer)
    return completeState({ ...nextBase, roundNumber: state.roundNumber }, 'pool-exhausted')
  return { ...nextBase, currentOfferIds: offer, status: 'active', completionReason: null }
}
export function startDraft(pool: readonly Operator[], targetSize: number, options: DraftEngineOptions = {}): DraftState {
  const rules = resolvedRules(options)
  const capacity = resolvedCapacityRules(options)
  validateRules(rules)
  validateCapacityRules(capacity)
  const poolKey = createDraftPoolKey(pool, targetSize)
  const activeCapacity = capacity.enabled ? Math.min(targetSize, capacity.startingActiveSlots) : targetSize
  const overflowCapacity = capacity.enabled ? Math.max(0, Math.min(capacity.overflowSlots, targetSize - activeCapacity)) : 0
  const base: DraftState = { targetSize, poolKey, draftedOperatorIds: [], currentOfferIds: [], discardedOperatorIds: [], heldOperatorId: null, roundNumber: 1, completedRounds: 0, capacityExpansionCount: 0, activeCapacity, overflowCapacity, forfeitedCapacityCount: 0, capacityRulesEnabled: capacity.enabled, actionUsage: emptyUsage(), status: 'active', completionReason: null }
  const offer = generatedOffer(pool, base, options)
  return offer ? { ...base, currentOfferIds: offer } : completeState(base, 'pool-exhausted')
}
function actionRule(action: DraftActionType, rules: DraftActionRules): DraftLimitedActionRules | null { switch (action) {
  case 'pick':
  case 'release-hold': return null
  case 'hold': return rules.hold
  case 'forfeit': return rules.forfeit
  case 'reroll': return rules.reroll
  case 'slot-expansion': return rules.slotExpansion
} }
export function getDraftActionAvailability(state: DraftState, action: DraftAction, options: Pick<DraftEngineOptions, 'actionRules' | 'capacityRules'> = {}): DraftActionAvailability {
  if (state.status !== 'active')
    return { available: false, reason: 'draft-complete' }
  const selectingCurrent = (action.type === 'pick' || action.type === 'hold') && state.currentOfferIds.includes(action.operatorId)
  const selectingHeld = action.type === 'pick' && state.heldOperatorId === action.operatorId
  if ((action.type === 'pick' || action.type === 'hold') && !selectingCurrent && !selectingHeld)
    return { available: false, reason: 'invalid-offer-selection' }
  if (action.type === 'hold' && state.heldOperatorId !== null)
    return { available: false, reason: 'hold-slot-occupied' }
  if (action.type === 'release-hold' && state.heldOperatorId === null)
    return { available: false, reason: 'hold-slot-empty' }
  const capacity = resolvedCapacityRules(options)
  if (action.type === 'pick' && capacity.enabled && state.draftedOperatorIds.length >= currentDraftOwnershipCapacity(state))
    return { available: false, reason: 'capacity-full' }
  if (action.type === 'forfeit' && capacity.enabled && currentDraftOwnershipCapacity(state) <= state.draftedOperatorIds.length)
    return { available: false, reason: 'capacity-forfeit-unavailable' }
  if (action.type === 'slot-expansion' && capacity.enabled && state.activeCapacity >= Math.min(state.targetSize, capacity.maxActiveSlots))
    return { available: false, reason: 'capacity-maxed' }
  const rule = actionRule(action.type, resolvedRules(options))
  if (!rule)
    return { available: true, reason: null }
  if (!rule.enabled)
    return { available: false, reason: 'action-disabled' }
  const usage = state.actionUsage[action.type]
  if (rule.perRoundLimit !== null && usage.round >= rule.perRoundLimit)
    return { available: false, reason: 'per-round-limit' }
  if (rule.perDraftLimit !== null && usage.total >= rule.perDraftLimit)
    return { available: false, reason: 'per-draft-limit' }
  if (usage.lastUsedRound !== null && state.roundNumber - usage.lastUsedRound <= rule.cooldownRounds)
    return { available: false, reason: 'cooldown' }
  return { available: true, reason: null }
}
function assertPoolIdentity(state: DraftState, pool: readonly Operator[]) { if (createDraftPoolKey(pool, state.targetSize) !== state.poolKey)
  throw new Error('Draft pool or target size changed after this draft started.'); }
function assertActionAvailable(state: DraftState, action: DraftAction, options: DraftEngineOptions) { const a = getDraftActionAvailability(state, action, options); if (!a.available)
  throw new Error(`Draft action ${action.type} is unavailable: ${a.reason}.`); }
function appendDiscarded(current: readonly string[], additions: readonly string[]): string[] { return [...new Set([...current, ...additions])]; }
export function applyDraftAction(state: DraftState, pool: readonly Operator[], action: DraftAction, options: DraftEngineOptions = {}): DraftState {
  assertPoolIdentity(state, pool)
  const rules = resolvedRules(options)
  const capacity = resolvedCapacityRules(options)
  validateRules(rules)
  validateCapacityRules(capacity)
  assertActionAvailable(state, action, options)
  const actionUsage = recordAction(state, action.type)
  switch (action.type) {
    case 'pick': {
      if (state.draftedOperatorIds.includes(action.operatorId))
        throw new Error(`Operator ${action.operatorId} has already been drafted.`)
      const fromHold = state.heldOperatorId === action.operatorId
      return beginNextRound({ ...state, draftedOperatorIds: [...state.draftedOperatorIds, action.operatorId], heldOperatorId: fromHold ? null : state.heldOperatorId, actionUsage }, pool, options)
    }
    case 'hold': {
      const discarded = rules.hold.discardUnheldOffer ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds.filter(id => id !== action.operatorId)) : state.discardedOperatorIds
      return beginNextRound({ ...state, heldOperatorId: action.operatorId, discardedOperatorIds: discarded, actionUsage }, pool, options)
    }
    case 'release-hold': return { ...state, heldOperatorId: null, actionUsage }
    case 'forfeit': {
      const discarded = rules.forfeit.discardOffer ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds) : state.discardedOperatorIds
      return beginNextRound({ ...state, discardedOperatorIds: discarded, forfeitedCapacityCount: capacity.enabled ? state.forfeitedCapacityCount + 1 : state.forfeitedCapacityCount, actionUsage }, pool, options)
    }
    case 'reroll': {
      const discarded = rules.reroll.discardOffer ? appendDiscarded(state.discardedOperatorIds, state.currentOfferIds) : state.discardedOperatorIds
      const next = { ...state, discardedOperatorIds: discarded, actionUsage, currentOfferIds: [] }
      const offer = generatedOffer(pool, next, options)
      return offer ? { ...next, currentOfferIds: offer } : completeState(next, 'pool-exhausted')
    }
    case 'slot-expansion': return { ...state, activeCapacity: capacity.enabled ? state.activeCapacity + 1 : state.activeCapacity, capacityExpansionCount: state.capacityExpansionCount + 1, actionUsage }
  }
}
export function pickDraftOperator(state: DraftState, pool: readonly Operator[], operatorId: string, options: DraftEngineOptions = {}): DraftState { return applyDraftAction(state, pool, { type: 'pick', operatorId }, options); }
