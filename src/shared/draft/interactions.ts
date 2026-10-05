import type {
  DraftInteractionCostContribution,
  DraftState,
  ResolvedDraftConfiguration,
  ResolvedDraftInteraction,
} from './types'

function includesOperator(operatorIds: readonly string[], operatorId: string): boolean {
  return operatorIds.includes(operatorId)
}

function countOwnedMatches(
  draftedOperatorIds: readonly string[],
  operatorIds: readonly string[],
): number {
  return draftedOperatorIds.reduce(
    (count, operatorId) => count + (includesOperator(operatorIds, operatorId) ? 1 : 0),
    0,
  )
}

function interactionModifier(
  interaction: ResolvedDraftInteraction,
  operatorId: string,
  draftedOperatorIds: readonly string[],
): DraftInteractionCostContribution | null {
  switch (interaction.type) {
    case 'anchor': {
      const candidateIsSource = includesOperator(interaction.sourceOperatorIds, operatorId)
      const candidateIsTarget = includesOperator(interaction.targetOperatorIds, operatorId)
      if (!candidateIsSource && !candidateIsTarget) return null

      let connectionCount = 0
      for (const draftedOperatorId of draftedOperatorIds) {
        const completesForward =
          candidateIsSource &&
          includesOperator(interaction.targetOperatorIds, draftedOperatorId)
        const completesReverse =
          candidateIsTarget &&
          includesOperator(interaction.sourceOperatorIds, draftedOperatorId)
        if (completesForward || completesReverse) connectionCount += 1
      }
      if (connectionCount === 0) return null
      return {
        interactionId: interaction.id,
        type: interaction.type,
        modifier: interaction.modifier * connectionCount,
      }
    }
    case 'progressive': {
      if (!includesOperator(interaction.groupOperatorIds, operatorId)) return null
      const resultingMemberCount =
        countOwnedMatches(draftedOperatorIds, interaction.groupOperatorIds) + 1
      let activeModifier = 0
      for (const step of interaction.steps) {
        if (step.memberCount > resultingMemberCount) break
        activeModifier = step.modifier
      }
      if (activeModifier === 0) return null
      return {
        interactionId: interaction.id,
        type: interaction.type,
        modifier: activeModifier,
      }
    }
    case 'threshold': {
      const groupBefore = countOwnedMatches(draftedOperatorIds, interaction.groupOperatorIds)
      const groupAfter =
        groupBefore + (includesOperator(interaction.groupOperatorIds, operatorId) ? 1 : 0)
      const anchorBefore =
        interaction.anchorOperatorIds === undefined ||
        draftedOperatorIds.some((draftedOperatorId) =>
          includesOperator(interaction.anchorOperatorIds ?? [], draftedOperatorId),
        )
      const anchorAfter =
        anchorBefore ||
        (interaction.anchorOperatorIds !== undefined &&
          includesOperator(interaction.anchorOperatorIds, operatorId))
      const satisfiedBefore = groupBefore >= interaction.threshold && anchorBefore
      const satisfiedAfter = groupAfter >= interaction.threshold && anchorAfter
      if (satisfiedBefore || !satisfiedAfter) return null
      return {
        interactionId: interaction.id,
        type: interaction.type,
        modifier: interaction.modifier,
      }
    }
  }
}

/**
 * Evaluates the interaction surcharge paid by a candidate at the moment it is drafted.
 * Existing operators are never repriced. Anchor connections are symmetrical at execution
 * time so drafting source→target or target→source produces the same total final cost.
 */
export function getDraftInteractionCostContributionsWithConfiguration(
  state: Pick<DraftState, 'draftedOperatorIds'>,
  operatorId: string,
  configuration: Pick<ResolvedDraftConfiguration, 'interactions'>,
): DraftInteractionCostContribution[] {
  const contributions: DraftInteractionCostContribution[] = []
  for (const interaction of configuration.interactions) {
    const contribution = interactionModifier(interaction, operatorId, state.draftedOperatorIds)
    if (contribution) contributions.push(contribution)
  }
  return contributions
}

export function getDraftInteractionCostModifierWithConfiguration(
  state: Pick<DraftState, 'draftedOperatorIds'>,
  operatorId: string,
  configuration: Pick<ResolvedDraftConfiguration, 'interactions'>,
): number {
  return getDraftInteractionCostContributionsWithConfiguration(
    state,
    operatorId,
    configuration,
  ).reduce((total, contribution) => total + contribution.modifier, 0)
}
