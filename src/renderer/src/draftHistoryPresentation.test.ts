import { describe, expect, it } from 'vitest'
import type { DraftHistoryEvent } from '../../shared/draft'
import { buildDraftHistoryRounds, draftHistoryActionLabel } from './draftHistoryPresentation'

describe('Draft history presentation', () => {
  it('tracks sidecars across holds, rerolls and held picks', () => {
    const history: DraftHistoryEvent[] = [
      { type: 'action', roundNumber: 1, action: 'hold', operatorId: 'a' },
      { type: 'offer', roundNumber: 2, operatorIds: ['b'], source: 'round-start' },
      { type: 'action', roundNumber: 2, action: 'reroll', operatorId: null },
      { type: 'offer', roundNumber: 2, operatorIds: ['c'], source: 'reroll' },
      { type: 'action', roundNumber: 2, action: 'pick', operatorId: 'a' },
      { type: 'offer', roundNumber: 3, operatorIds: ['d'], source: 'round-start' },
    ]
    const rounds = buildDraftHistoryRounds(history)
    expect(rounds[1].offers.map((offer) => offer.sidecarOperatorId)).toEqual(['a', 'a'])
    expect(rounds[2].offers[0].sidecarOperatorId).toBeUndefined()
  })
  it('groups chronological events into ascending round rows', () => {
    const history: DraftHistoryEvent[] = [
      { type: 'offer', roundNumber: 1, operatorIds: ['a', 'b', 'c'], source: 'initial' },
      { type: 'action', roundNumber: 1, action: 'reroll', operatorId: null },
      { type: 'offer', roundNumber: 1, operatorIds: ['d', 'e', 'f'], source: 'reroll' },
      { type: 'action', roundNumber: 1, action: 'pick', operatorId: 'e' },
      { type: 'offer', roundNumber: 2, operatorIds: ['g', 'h', 'i'], source: 'round-start' },
      { type: 'action', roundNumber: 2, action: 'hold', operatorId: 'h' },
    ]

    expect(buildDraftHistoryRounds(history)).toEqual([
      {
        roundNumber: 1,
        offers: [history[0], history[2]],
        actions: [history[1], history[3]],
      },
      {
        roundNumber: 2,
        offers: [history[4]],
        actions: [history[5]],
      },
    ])
  })

  it('uses canonical action labels', () => {
    expect(draftHistoryActionLabel('forfeit')).toBe('Capacity Forfeit')
    expect(draftHistoryActionLabel('slot-expansion')).toBe('Capacity Expansion')
    expect(draftHistoryActionLabel('release-hold')).toBe('Release Hold')
  })
})
