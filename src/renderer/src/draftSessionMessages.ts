import type { DraftState } from '../../shared/draft'

export function draftCompletionMessage(state: DraftState): string {
  const drafted = `${state.draftedOperatorIds.length} operators drafted.`

  switch (state.completionReason) {
    case 'squad-size-reached':
      return `Draft complete. ${drafted}`
    case 'pool-exhausted':
      return `Draft ended because fewer than ${state.offerSize} eligible undrafted operators remain. ${drafted}`
    case 'round-limit-reached':
      return `Draft ended at the configured round limit. ${drafted}`
    case 'capacity-exhausted':
      return `Draft ended because no further ownership capacity is available. ${drafted}`
    default:
      return `Draft ended. ${drafted}`
  }
}
