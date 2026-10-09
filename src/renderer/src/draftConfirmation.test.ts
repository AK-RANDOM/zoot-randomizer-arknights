import { describe, expect, it } from 'vitest'
import { draftConfirmationCopy } from './draftConfirmation'

describe('Draft action confirmation copy', () => {
  it('identifies operator actions without deriving gameplay legality', () => {
    expect(
      draftConfirmationCopy({
        type: 'draft-action',
        action: { type: 'pick', operatorId: 'char_001' },
        operatorName: 'Exusiai',
      }),
    ).toMatchObject({
      title: 'Pick Exusiai?',
      confirmLabel: 'Pick',
    })

    expect(
      draftConfirmationCopy({
        type: 'draft-action',
        action: { type: 'hold', operatorId: 'char_001' },
        operatorName: 'Exusiai',
      }),
    ).toMatchObject({
      title: 'Hold Exusiai?',
      confirmLabel: 'Hold',
    })
  })

  it('covers every non-operator Draft action', () => {
    const actions = [
      { type: 'forfeit' },
      { type: 'reroll' },
      { type: 'release-hold' },
      { type: 'slot-expansion' },
    ] as const

    expect(
      actions.map((action) =>
        draftConfirmationCopy({ type: 'draft-action', action }).confirmLabel,
      ),
    ).toEqual(['Forfeit', 'Reroll', 'Release', 'Expand'])
  })

  it('treats New Draft as a session replacement confirmation', () => {
    expect(draftConfirmationCopy({ type: 'new-draft' })).toMatchObject({
      title: 'Start a new Draft?',
      confirmLabel: 'New Draft',
      suppressionLabel: 'Skip Draft confirmations in the new session',
    })
  })
})
