import type { Operator } from '../operator'
import type { DraftPullDistribution } from '../draftDistribution'

export const DRAFT_OFFER_SIZE = 3 as const

export type DraftRandomSource = () => number
export type DraftCandidateGenerator = (
  candidates: readonly Operator[],
  count: number,
  random: DraftRandomSource,
) => readonly Operator[]

export type DraftStatus = 'active' | 'complete'
export type DraftCompletionReason =
  | 'squad-size-reached'
  | 'pool-exhausted'
  | 'capacity-exhausted'
  | 'round-limit-reached'
  | 'no-valid-move'
export type DraftActionType =
  | 'pick'
  | 'forfeit'
  | 'hold'
  | 'release-hold'
  | 'reroll'
  | 'slot-expansion'
export type DraftActionBlockReason =
  | 'draft-complete'
  | 'action-disabled'
  | 'invalid-offer-selection'
  | 'hold-slot-occupied'
  | 'hold-slot-empty'
  | 'per-round-limit'
  | 'per-draft-limit'
  | 'cooldown'
  | 'capacity-full'
  | 'capacity-maxed'
  | 'capacity-forfeit-unavailable'
  | 'insufficient-points'

export interface DraftActionUsage {
  total: number
  round: number
  lastUsedRound: number | null
}

export type DraftActionUsageMap = Record<DraftActionType, DraftActionUsage>

export interface DraftLimitedActionRules {
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

export type DraftHoldUpkeepRules =
  | { mode: 'none' }
  | { mode: 'static'; cost: number }
  | { mode: 'escalating'; baseCost: number; escalation: number }
  | { mode: 'schedule'; costs: number[]; repeatLast: boolean }

export interface DraftEconomyRules {
  enabled: boolean
  startingPoints: number
  rarityCosts: Record<number, number>
  operatorCostOverrides: Record<string, number>
  forfeitRebate: number
  rerollCost: number
  holdCost: number
  holdUpkeep: DraftHoldUpkeepRules
  slotExpansionCost: number
}

export interface ResolvedDraftAnchorInteraction {
  id: string
  type: 'anchor'
  sourceOperatorIds: string[]
  targetOperatorIds: string[]
  modifier: number
}

export interface ResolvedDraftProgressiveInteraction {
  id: string
  type: 'progressive'
  groupOperatorIds: string[]
  steps: Array<{ memberCount: number; modifier: number }>
}

export interface ResolvedDraftThresholdInteraction {
  id: string
  type: 'threshold'
  groupOperatorIds: string[]
  threshold: number
  modifier: number
  anchorOperatorIds?: string[]
}

export type ResolvedDraftInteraction =
  | ResolvedDraftAnchorInteraction
  | ResolvedDraftProgressiveInteraction
  | ResolvedDraftThresholdInteraction

export interface DraftInteractionCostContribution {
  interactionId: string
  type: ResolvedDraftInteraction['type']
  modifier: number
}

export type PartialDraftActionRules = {
  hold?: Partial<DraftHoldRules>
  forfeit?: Partial<DraftForfeitRules>
  reroll?: Partial<DraftRerollRules>
  slotExpansion?: Partial<DraftSlotExpansionRules>
}

export interface DraftConfigurationInput {
  offerSize?: number
  maxRounds?: number | null
  actionRules?: PartialDraftActionRules
  capacityRules?: Partial<DraftCapacityRules>
  economyRules?: Partial<DraftEconomyRules>
  pullDistribution?: DraftPullDistribution
  interactions?: ResolvedDraftInteraction[]
}

export interface ResolvedDraftConfiguration {
  offerSize: number
  maxRounds: number | null
  actionRules: DraftActionRules
  capacityRules: DraftCapacityRules
  economyRules: DraftEconomyRules
  pullDistribution: DraftPullDistribution
  interactions: ResolvedDraftInteraction[]
}

/**
 * Runtime controls stay separate from declarative Draft configuration.
 * Top-level rule fields remain supported for compatibility while Rulebooks migrate
 * toward the `configuration` entry point.
 */
export interface DraftEngineOptions extends DraftConfigurationInput {
  configuration?: DraftConfigurationInput
  candidateGenerator?: DraftCandidateGenerator
  random?: DraftRandomSource
}

export interface DraftState {
  targetSize: number
  offerSize: number
  poolKey: string
  draftedOperatorIds: string[]
  currentOfferIds: string[]
  discardedOperatorIds: string[]
  heldOperatorId: string | null
  holdUpkeepCharges: number
  roundNumber: number
  completedRounds: number
  capacityExpansionCount: number
  activeCapacity: number
  overflowCapacity: number
  forfeitedCapacityCount: number
  capacityRulesEnabled: boolean
  points: number
  economyRulesEnabled: boolean
  pullsSinceSixStar: number
  generatedCandidateCount: number
  actualFiveStarGeneratedInFirstTen: boolean
  actionUsage: DraftActionUsageMap
  status: DraftStatus
  completionReason: DraftCompletionReason | null
}

export type DraftAction =
  | { type: 'pick'; operatorId: string }
  | { type: 'hold'; operatorId: string }
  | { type: 'release-hold' }
  | { type: 'forfeit' }
  | { type: 'reroll' }
  | { type: 'slot-expansion' }

export interface DraftActionAvailability {
  available: boolean
  reason: DraftActionBlockReason | null
}

export interface DraftActionPreflight extends DraftActionAvailability {
  terminalAfterAction: boolean
  terminalReason: Extract<DraftCompletionReason, 'no-valid-move'> | null
}
