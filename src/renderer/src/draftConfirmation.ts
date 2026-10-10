import type { DraftAction } from '../../shared/draft'

export type DraftConfirmationIntent =
  | {
      type: 'draft-action'
      action: DraftAction
      operatorName?: string
      terminalAfterAction?: boolean
    }
  | { type: 'new-draft' }

export interface DraftConfirmationCopy {
  title: string
  body: string
  confirmLabel: string
  suppressionLabel: string
}

export function draftConfirmationCopy(intent: DraftConfirmationIntent): DraftConfirmationCopy {
  if (intent.type === 'new-draft') {
    return {
      title: 'Start a new Draft?',
      body: 'The current Draft session will be replaced with a fresh first offer.',
      confirmLabel: 'New Draft',
      suppressionLabel: 'Skip Draft confirmations in the new session',
    }
  }

  const operatorName = intent.operatorName ?? 'this operator'
  if (intent.terminalAfterAction) {
    const actionLabel =
      intent.action.type === 'pick'
        ? `Pick ${operatorName}`
        : intent.action.type === 'hold'
          ? `Hold ${operatorName}`
          : intent.action.type === 'forfeit'
            ? 'Forfeit'
            : intent.action.type === 'reroll'
              ? 'Reroll'
              : intent.action.type === 'release-hold'
                ? 'Release Hold'
                : 'Expand capacity'
    return {
      title: `${actionLabel} and end the Draft?`,
      body: 'This action is legal, but afterward no valid moves will remain. The Draft will end immediately.',
      confirmLabel:
        intent.action.type === 'release-hold'
          ? 'Release'
          : intent.action.type === 'slot-expansion'
            ? 'Expand'
            : intent.action.type === 'pick'
              ? 'Pick'
              : intent.action.type === 'hold'
                ? 'Hold'
                : intent.action.type === 'forfeit'
                  ? 'Forfeit'
                  : 'Reroll',
      suppressionLabel: 'Terminal-action warnings cannot be disabled for this Draft session',
    }
  }

  switch (intent.action.type) {
    case 'pick':
      return {
        title: `Pick ${operatorName}?`,
        body: 'This ends the current round and permanently adds the operator to your selected squad.',
        confirmLabel: 'Pick',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
    case 'hold':
      return {
        title: `Hold ${operatorName}?`,
        body: 'This ends the current round and places the operator in Hold.',
        confirmLabel: 'Hold',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
    case 'forfeit':
      return {
        title: 'Forfeit this round?',
        body: 'This ends the current round and permanently destroys one open permanent squad slot.',
        confirmLabel: 'Forfeit',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
    case 'reroll':
      return {
        title: 'Reroll this offer?',
        body: 'This replaces the complete generated offer without ending the round.',
        confirmLabel: 'Reroll',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
    case 'release-hold':
      return {
        title: 'Release the Held operator?',
        body: 'This clears Hold without ending the round. The current generated offer is unchanged.',
        confirmLabel: 'Release',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
    case 'slot-expansion':
      return {
        title: 'Expand permanent capacity?',
        body: 'This uses the configured expansion action without ending the round.',
        confirmLabel: 'Expand',
        suppressionLabel: 'Skip remaining confirmations for this Draft session',
      }
  }
}
