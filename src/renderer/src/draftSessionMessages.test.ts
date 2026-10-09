import { describe, expect, it } from 'vitest'
import type { DraftState } from '../../shared/draft'
import { draftCompletionMessage } from './draftSessionMessages'

function state(completionReason: DraftState['completionReason']): DraftState {
  return {
    targetSize: 12,
    poolKey: 'pool',
    draftedOperatorIds: ['one', 'two'],
    currentOfferIds: [],
    discardedOperatorIds: [],
    heldOperatorId: null,
    holdUpkeepCharges: 0,
    roundNumber: 3,
    completedRounds: 2,
    capacityExpansionCount: 0,
    activeCapacity: 6,
    overflowCapacity: 1,
    forfeitedCapacityCount: 0,
    capacityRulesEnabled: false,
    points: 0,
    economyRulesEnabled: false,
    pullsSinceSixStar: 0,
    actionUsage: {
      pick: { total: 2, round: 0, lastUsedRound: 2 },
      forfeit: { total: 0, round: 0, lastUsedRound: null },
      hold: { total: 0, round: 0, lastUsedRound: null },
      'release-hold': { total: 0, round: 0, lastUsedRound: null },
      reroll: { total: 0, round: 0, lastUsedRound: null },
      'slot-expansion': { total: 0, round: 0, lastUsedRound: null },
    },
    status: 'complete',
    completionReason,
  }
}

describe('draftCompletionMessage', () => {
  it('distinguishes every engine completion reason', () => {
    expect(draftCompletionMessage(state('squad-size-reached'))).toBe(
      'Draft complete. 2 operators drafted.',
    )
    expect(draftCompletionMessage(state('pool-exhausted'))).toBe(
      'Draft ended because fewer than 3 eligible undrafted operators remain. 2 operators drafted.',
    )
    expect(draftCompletionMessage(state('capacity-exhausted'))).toBe(
      'Draft ended because no further ownership capacity is available. 2 operators drafted.',
    )
  })
})
