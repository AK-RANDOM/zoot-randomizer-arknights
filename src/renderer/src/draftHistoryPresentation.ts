import type { DraftActionType, DraftHistoryEvent } from '../../shared/draft'

export interface DraftHistoryRound {
  roundNumber: number
  offers: Array<Extract<DraftHistoryEvent, { type: 'offer' }>>
  actions: Array<Extract<DraftHistoryEvent, { type: 'action' }>>
}

export function buildDraftHistoryRounds(
  history: readonly DraftHistoryEvent[],
): DraftHistoryRound[] {
  const rounds = new Map<number, DraftHistoryRound>()

  for (const event of history) {
    const round = rounds.get(event.roundNumber) ?? {
      roundNumber: event.roundNumber,
      offers: [],
      actions: [],
    }
    if (event.type === 'offer') round.offers.push(event)
    else round.actions.push(event)
    rounds.set(event.roundNumber, round)
  }

  return [...rounds.values()].sort((left, right) => left.roundNumber - right.roundNumber)
}

export function draftHistoryActionLabel(action: DraftActionType): string {
  switch (action) {
    case 'pick':
      return 'Pick'
    case 'hold':
      return 'Hold'
    case 'release-hold':
      return 'Release Hold'
    case 'forfeit':
      return 'Capacity Forfeit'
    case 'reroll':
      return 'Reroll'
    case 'slot-expansion':
      return 'Capacity Expansion'
  }
}
