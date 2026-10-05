import type { Operator } from './operator'
import type { ResolvedDraftInteraction } from './draft'
import type { DraftRulebookInteraction, DraftRulebookSelector } from './draftRulebook'
import { resolveDraftRulebookSelector } from './draftRulebookPool'

function resolveSelectorIds(
  operators: readonly Operator[],
  selector: DraftRulebookSelector,
): string[] {
  return resolveDraftRulebookSelector(operators, selector).map((operator) => operator.id)
}

/**
 * Expands declarative Rulebook selectors into runtime operator-ID sets.
 * The portable document remains selector-based; only the execution configuration
 * carries this resolved representation.
 */
export function resolveDraftRulebookInteractions(
  interactions: readonly DraftRulebookInteraction[],
  datasetOperators: readonly Operator[],
): ResolvedDraftInteraction[] {
  return interactions.map((interaction) => {
    switch (interaction.type) {
      case 'anchor':
        return {
          id: interaction.id,
          type: interaction.type,
          sourceOperatorIds: resolveSelectorIds(datasetOperators, interaction.source),
          targetOperatorIds: resolveSelectorIds(datasetOperators, interaction.target),
          modifier: interaction.modifier,
        }
      case 'progressive':
        return {
          id: interaction.id,
          type: interaction.type,
          groupOperatorIds: resolveSelectorIds(datasetOperators, interaction.group),
          steps: interaction.steps.map((step) => ({ ...step })),
        }
      case 'threshold':
        return {
          id: interaction.id,
          type: interaction.type,
          groupOperatorIds: resolveSelectorIds(datasetOperators, interaction.group),
          threshold: interaction.threshold,
          modifier: interaction.modifier,
          anchorOperatorIds: interaction.anchor
            ? resolveSelectorIds(datasetOperators, interaction.anchor)
            : undefined,
        }
    }
  })
}
