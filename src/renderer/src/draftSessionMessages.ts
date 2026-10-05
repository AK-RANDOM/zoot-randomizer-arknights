import type { DraftState } from '../../shared/draft'

export function draftCompletionMessage(state: DraftState): string {
  const drafted = `${state.draftedOperatorIds.length} operators drafted.`

  switch (state.completionReason) {
    case 'squad-size-reached':
      return `Draft complete. ${drafted}`
    case 'pool-exhausted':
      return `Draft ended because fewer than 3 eligible undrafted operators remain. ${drafted}`
    case 'capacity-exhausted':
      return `Draft ended because no further ownership capacity is available. ${drafted}`
    default:
      return `Draft ended. ${drafted}`
  }
}
