import { describe, expect, it } from 'vitest'
import type { ImportedArknightsAccount } from './arknightsAccount'
import { importedAccountOwnedOperatorIds } from './arknightsAccountReconciliation'

const snapshot: ImportedArknightsAccount = {
  schemaVersion: 1,
  server: 'en',
  fetchedAt: '2026-10-17T00:00:00.000Z',
  operators: [
    { operatorId: 'char_103_angel', level: 90, elite: 2 },
    {
      operatorId: 'char_002_amiya',
      level: 80,
      elite: 2,
      activeFormId: 'char_1037_amiya3',
      forms: [
        { formId: 'char_002_amiya', level: 80, elite: 2 },
        { formId: 'char_1037_amiya3', level: 80, elite: 2 },
      ],
    },
  ],
  ownedSkinIds: [],
}

describe('Arknights account ownership expansion', () => {
  it('includes retained form identities without duplicating the canonical operator', () => {
    expect(importedAccountOwnedOperatorIds(snapshot)).toEqual([
      'char_002_amiya',
      'char_1037_amiya3',
      'char_103_angel',
    ])
  })
})
