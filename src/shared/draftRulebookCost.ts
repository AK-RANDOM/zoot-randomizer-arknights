import {
  getDraftInteractionCostModifierWithConfiguration,
  resolveDraftConfiguration,
  type ResolvedDraftAnchorInteraction,
  type ResolvedDraftProgressiveInteraction,
  type ResolvedDraftThresholdInteraction,
} from './draft'
import type { Operator } from './operator'
import type { DraftRulebook } from './draftRulebook'
import { resolveDraftRulebookInteractions } from './draftRulebookInteractions'

export interface DraftRulebookOperatorCostBreakdown {
  operatorId: string
  rarityCost: number
  overrideCost: number | null
  overrideDelta: number
  baselineCost: number
  minimumCost: number
  maximumCost: number
}

export interface DraftRulebookOperatorCostResolution {
  byOperatorId: Record<string, DraftRulebookOperatorCostBreakdown>
  unresolvedOverrideOperatorIds: string[]
}

interface InteractionRangeState {
  progressiveCounts: number[]
  thresholdCounts: number[]
  thresholdAnchors: boolean[]
}

interface InteractionRangeEnvelope {
  state: InteractionRangeState
  minimumAnchorModifier: number
  maximumAnchorModifier: number
}

interface ProgressiveRangeDimension {
  interaction: ResolvedDraftProgressiveInteraction
  countCap: number
}

interface ThresholdRangeDimension {
  interaction: ResolvedDraftThresholdInteraction
  candidateInGroup: boolean
  candidateIsAnchor: boolean
}

function includesOperator(operatorIds: readonly string[] | undefined, operatorId: string): boolean {
  return operatorIds?.includes(operatorId) ?? false
}

function rangeStateKey(state: InteractionRangeState): string {
  return `${state.progressiveCounts.join(',')}|${state.thresholdCounts.join(',')}|${state.thresholdAnchors.map((value) => value ? '1' : '0').join('')}`
}

function cloneRangeState(state: InteractionRangeState): InteractionRangeState {
  return {
    progressiveCounts: [...state.progressiveCounts],
    thresholdCounts: [...state.thresholdCounts],
    thresholdAnchors: [...state.thresholdAnchors],
  }
}

function anchorModifierForPriorOperator(
  interactions: readonly ResolvedDraftAnchorInteraction[],
  candidateId: string,
  priorOperatorId: string,
): number {
  let modifier = 0
  for (const interaction of interactions) {
    const candidateIsSource = includesOperator(interaction.sourceOperatorIds, candidateId)
    const candidateIsTarget = includesOperator(interaction.targetOperatorIds, candidateId)
    const completesForward = candidateIsSource && includesOperator(interaction.targetOperatorIds, priorOperatorId)
    const completesReverse = candidateIsTarget && includesOperator(interaction.sourceOperatorIds, priorOperatorId)
    if (completesForward || completesReverse) modifier += interaction.modifier
  }
  return modifier
}

function nonlinearModifierForState(
  state: InteractionRangeState,
  progressiveDimensions: readonly ProgressiveRangeDimension[],
  thresholdDimensions: readonly ThresholdRangeDimension[],
): number {
  let modifier = 0

  progressiveDimensions.forEach((dimension, index) => {
    const resultingMemberCount = state.progressiveCounts[index] + 1
    let activeModifier = 0
    for (const step of dimension.interaction.steps) {
      if (step.memberCount > resultingMemberCount) break
      activeModifier = step.modifier
    }
    modifier += activeModifier
  })

  thresholdDimensions.forEach((dimension, index) => {
    const interaction = dimension.interaction
    const groupBefore = state.thresholdCounts[index]
    const anchorBefore = interaction.anchorOperatorIds === undefined || state.thresholdAnchors[index]
    const groupAfter = Math.min(
      interaction.threshold,
      groupBefore + (dimension.candidateInGroup ? 1 : 0),
    )
    const anchorAfter = anchorBefore || dimension.candidateIsAnchor
    const satisfiedBefore = groupBefore >= interaction.threshold && anchorBefore
    const satisfiedAfter = groupAfter >= interaction.threshold && anchorAfter
    if (!satisfiedBefore && satisfiedAfter) modifier += interaction.modifier
  })

  return modifier
}

/**
 * Computes the exact interaction range reachable by drafting any subset of the
 * supplied operators before the candidate. The DP retains only the minimum and
 * maximum Anchor contribution for each nonlinear (Progressive / Threshold)
 * state, so mutually-exclusive threshold outcomes are not incorrectly summed.
 */
function getInteractionCostRange(
  rulebook: DraftRulebook,
  candidate: Operator,
  datasetOperators: readonly Operator[],
): { minimumModifier: number; maximumModifier: number } {
  if (rulebook.interactions.length === 0) {
    return { minimumModifier: 0, maximumModifier: 0 }
  }

  const resolved = resolveDraftRulebookInteractions(rulebook.interactions, datasetOperators)
  const anchorInteractions = resolved.filter(
    (interaction): interaction is ResolvedDraftAnchorInteraction => interaction.type === 'anchor',
  )
  const progressiveDimensions: ProgressiveRangeDimension[] = resolved
    .filter(
      (interaction): interaction is ResolvedDraftProgressiveInteraction =>
        interaction.type === 'progressive' && includesOperator(interaction.groupOperatorIds, candidate.id),
    )
    .map((interaction) => ({
      interaction,
      // Once the prior count reaches lastStep - 1, adding the candidate is at
      // or beyond the final authored step and larger counts are equivalent.
      countCap: Math.max(0, (interaction.steps.at(-1)?.memberCount ?? 1) - 1),
    }))
  const thresholdDimensions: ThresholdRangeDimension[] = resolved
    .filter((interaction): interaction is ResolvedDraftThresholdInteraction => interaction.type === 'threshold')
    .map((interaction) => ({
      interaction,
      candidateInGroup: includesOperator(interaction.groupOperatorIds, candidate.id),
      candidateIsAnchor: includesOperator(interaction.anchorOperatorIds, candidate.id),
    }))
    .filter((dimension) => dimension.candidateInGroup || dimension.candidateIsAnchor)

  const initialState: InteractionRangeState = {
    progressiveCounts: progressiveDimensions.map(() => 0),
    thresholdCounts: thresholdDimensions.map(() => 0),
    thresholdAnchors: thresholdDimensions.map(
      (dimension) => dimension.interaction.anchorOperatorIds === undefined,
    ),
  }
  let states = new Map<string, InteractionRangeEnvelope>([
    [rangeStateKey(initialState), {
      state: initialState,
      minimumAnchorModifier: 0,
      maximumAnchorModifier: 0,
    }],
  ])

  const priorOperators = datasetOperators.filter((operator) => {
    if (operator.id === candidate.id) return false
    if (anchorModifierForPriorOperator(anchorInteractions, candidate.id, operator.id) !== 0) return true
    if (progressiveDimensions.some((dimension) =>
      includesOperator(dimension.interaction.groupOperatorIds, operator.id))) return true
    return thresholdDimensions.some((dimension) =>
      includesOperator(dimension.interaction.groupOperatorIds, operator.id) ||
      includesOperator(dimension.interaction.anchorOperatorIds, operator.id))
  })

  for (const priorOperator of priorOperators) {
    const nextStates = new Map(states)
    const anchorIncrement = anchorModifierForPriorOperator(
      anchorInteractions,
      candidate.id,
      priorOperator.id,
    )

    for (const envelope of states.values()) {
      const nextState = cloneRangeState(envelope.state)

      progressiveDimensions.forEach((dimension, index) => {
        if (!includesOperator(dimension.interaction.groupOperatorIds, priorOperator.id)) return
        nextState.progressiveCounts[index] = Math.min(
          dimension.countCap,
          nextState.progressiveCounts[index] + 1,
        )
      })

      thresholdDimensions.forEach((dimension, index) => {
        if (includesOperator(dimension.interaction.groupOperatorIds, priorOperator.id)) {
          nextState.thresholdCounts[index] = Math.min(
            dimension.interaction.threshold,
            nextState.thresholdCounts[index] + 1,
          )
        }
        if (includesOperator(dimension.interaction.anchorOperatorIds, priorOperator.id)) {
          nextState.thresholdAnchors[index] = true
        }
      })

      const key = rangeStateKey(nextState)
      const minimumAnchorModifier = envelope.minimumAnchorModifier + anchorIncrement
      const maximumAnchorModifier = envelope.maximumAnchorModifier + anchorIncrement
      const existing = nextStates.get(key)
      if (!existing) {
        nextStates.set(key, {
          state: nextState,
          minimumAnchorModifier,
          maximumAnchorModifier,
        })
      } else {
        existing.minimumAnchorModifier = Math.min(
          existing.minimumAnchorModifier,
          minimumAnchorModifier,
        )
        existing.maximumAnchorModifier = Math.max(
          existing.maximumAnchorModifier,
          maximumAnchorModifier,
        )
      }
    }

    states = nextStates
  }

  let minimumModifier = Number.POSITIVE_INFINITY
  let maximumModifier = Number.NEGATIVE_INFINITY
  for (const envelope of states.values()) {
    const nonlinearModifier = nonlinearModifierForState(
      envelope.state,
      progressiveDimensions,
      thresholdDimensions,
    )
    minimumModifier = Math.min(
      minimumModifier,
      envelope.minimumAnchorModifier + nonlinearModifier,
    )
    maximumModifier = Math.max(
      maximumModifier,
      envelope.maximumAnchorModifier + nonlinearModifier,
    )
  }

  // The initial state is always reachable, but keep this defensive fallback so
  // malformed editor state cannot make a preview return Infinity.
  if (!Number.isFinite(minimumModifier) || !Number.isFinite(maximumModifier)) {
    const emptyStateModifier = getDraftInteractionCostModifierWithConfiguration(
      { draftedOperatorIds: [] },
      candidate.id,
      { interactions: resolved },
    )
    return { minimumModifier: emptyStateModifier, maximumModifier: emptyStateModifier }
  }

  return { minimumModifier, maximumModifier }
}

/**
 * Rulebook `overrides.operatorCosts` stores an absolute static baseline cost.
 * The user-facing override delta is derived from the active rarity cost so the
 * editor can present the locked design as e.g. "Default 30 / Override +6 / Baseline 36"
 * without duplicating both absolute and relative values in the portable file.
 *
 * This helper deliberately resolves the static economy layer without requiring
 * the whole Rulebook to be valid. When the current dataset is supplied it also
 * computes the exact legally reachable interaction range for the candidate.
 * Omitting the dataset preserves the original static-only behavior for callers
 * that do not have selector-resolution context.
 */
export function getDraftRulebookOperatorCostBreakdown(
  rulebook: DraftRulebook,
  operator: Operator,
  datasetOperators?: readonly Operator[],
): DraftRulebookOperatorCostBreakdown {
  const economy = resolveDraftConfiguration({
    economyRules: {
      ...rulebook.generalRules.economyRules,
      operatorCostOverrides: rulebook.overrides.operatorCosts,
    },
  }).economyRules
  const rarityCost = economy.rarityCosts[operator.rarity] ?? 0
  const overrideCost = Object.prototype.hasOwnProperty.call(
    rulebook.overrides.operatorCosts,
    operator.id,
  )
    ? rulebook.overrides.operatorCosts[operator.id] ?? null
    : null
  const baselineCost = overrideCost ?? rarityCost
  const range = datasetOperators
    ? getInteractionCostRange(rulebook, operator, datasetOperators)
    : { minimumModifier: 0, maximumModifier: 0 }

  return {
    operatorId: operator.id,
    rarityCost,
    overrideCost,
    overrideDelta: overrideCost === null ? 0 : overrideCost - rarityCost,
    baselineCost,
    minimumCost: baselineCost + range.minimumModifier,
    maximumCost: baselineCost + range.maximumModifier,
  }
}

export function getDraftRulebookOperatorBaselineCost(
  rulebook: DraftRulebook,
  operator: Operator,
): number {
  return getDraftRulebookOperatorCostBreakdown(rulebook, operator).baselineCost
}

export function resolveDraftRulebookOperatorCosts(
  rulebook: DraftRulebook,
  operators: readonly Operator[],
): DraftRulebookOperatorCostResolution {
  const byOperatorId: Record<string, DraftRulebookOperatorCostBreakdown> = {}
  const operatorIds = new Set<string>()

  for (const operator of operators) {
    operatorIds.add(operator.id)
    byOperatorId[operator.id] = getDraftRulebookOperatorCostBreakdown(
      rulebook,
      operator,
      operators,
    )
  }

  const unresolvedOverrideOperatorIds = Object.keys(rulebook.overrides.operatorCosts)
    .filter((operatorId) => !operatorIds.has(operatorId))
    .sort((left, right) => left.localeCompare(right))

  return { byOperatorId, unresolvedOverrideOperatorIds }
}
