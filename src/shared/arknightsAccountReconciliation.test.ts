import { describe, expect, it } from 'vitest'
import type { ImportedArknightsAccount } from './arknightsAccount'
import type { OperatorDataset } from './operator'
import {
  importedAccountEquippedSkinId,
  importedAccountOperatorState,
  importedAccountOwnedOperatorIds,
  importedAccountOwnsSkin,
  reconcileArknightsAccount,
  resolveArknightsOperatorIdentity,
  resolveArknightsSkinIdentity,
} from './arknightsAccountReconciliation'

const dataset = {
  schemaVersion: 6,
  generatedAt: null,
  sources: {
    gamedataCnCommit: null,
    gamedataEnCommit: null,
    resourcesCommit: null,
    releaseMetadataCommit: null,
  },
  factionLabels: {},
  operators: [
    {
      id: 'char_103_angel',
      name: 'Exusiai',
      rarity: 6,
      class: 'Sniper',
      subclass: { id: 'fastshot', name: 'Marksman' },
      faction: { main: null, affiliations: [] },
      availableOn: { cn: true, global: true },
      release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
      acquisition: { family: 'standard', group: null },
      collaboration: null,
      alterGroup: null,
      mandatoryExclusivityGroup: null,
      imageFile: 'operators/char_103_angel.png',
      defaultArts: [
        {
          id: 'char_103_angel#1',
          avatarId: 'char_103_angel_1',
          portraitId: 'char_103_angel_1',
          phase: 0,
          label: 'E1',
        },
        {
          id: 'char_103_angel#2',
          avatarId: 'char_103_angel_2',
          portraitId: 'char_103_angel_2',
          phase: 2,
          label: 'E2',
        },
      ],
      skins: [
        {
          id: 'char_103_angel@xmas#1',
          portraitId: 'char_103_angel_xmas#1',
          names: { en: 'Christmas' },
        },
      ],
    },
    {
      id: 'char_002_amiya',
      name: 'Amiya',
      rarity: 5,
      class: 'Caster',
      subclass: { id: 'corecaster', name: 'Core Caster' },
      faction: { main: null, affiliations: [] },
      availableOn: { cn: true, global: true },
      release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
      acquisition: { family: 'standard', group: null },
      collaboration: null,
      alterGroup: null,
      mandatoryExclusivityGroup: 'amiya-forms',
      imageFile: 'operators/char_002_amiya.png',
      defaultArts: [
        {
          id: 'char_002_amiya#2',
          avatarId: 'char_002_amiya_2',
          portraitId: 'char_002_amiya_2',
          label: 'Default',
        },
      ],
    },
    {
      id: 'char_1037_amiya3',
      name: 'Amiya (Medic)',
      rarity: 5,
      class: 'Medic',
      subclass: { id: 'physician', name: 'Medic' },
      faction: { main: null, affiliations: [] },
      availableOn: { cn: true, global: true },
      release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
      acquisition: { family: 'standard', group: null },
      collaboration: null,
      alterGroup: null,
      mandatoryExclusivityGroup: 'amiya-forms',
      imageFile: 'operators/char_1037_amiya3.png',
      defaultArts: [
        {
          id: 'char_1037_amiya3#2',
          avatarId: 'char_1037_amiya3_2',
          portraitId: 'char_1037_amiya3_2',
          label: 'Default',
        },
      ],
    },
  ],
} satisfies OperatorDataset

const snapshot = {
  schemaVersion: 1,
  server: 'en',
  fetchedAt: '2026-10-17T00:00:00.000Z',
  operators: [
    {
      operatorId: 'char_103_angel',
      level: 90,
      elite: 2,
      equippedSkinId: 'char_103_angel@xmas#1',
    },
    {
      operatorId: 'char_002_amiya',
      level: 80,
      elite: 2,
      activeFormId: 'char_1037_amiya3',
      equippedSkinId: 'char_1037_amiya3#2',
      forms: [
        { formId: 'char_002_amiya', level: 80, elite: 2, equippedSkinId: 'char_002_amiya#2' },
        {
          formId: 'char_1037_amiya3',
          level: 80,
          elite: 2,
          equippedSkinId: 'char_1037_amiya3#2',
        },
      ],
    },
    { operatorId: 'char_future_operator', level: 1, elite: 0 },
  ],
  ownedSkinIds: [
    'char_103_angel#1',
    'char_103_angel@xmas#1',
    'char_1037_amiya3#2',
    'char_future_operator@skin#1',
  ],
} satisfies ImportedArknightsAccount

describe('Arknights account reconciliation', () => {
  it('reports owned, recognized, and unknown operator and skin counts by native ID', () => {
    expect(reconcileArknightsAccount(snapshot, dataset)).toEqual({
      operators: { owned: 3, recognized: 2, unknown: 1 },
      skins: { owned: 4, recognized: 3, unknown: 1 },
      equippedSkins: { equipped: 3, recognized: 3, unknown: 0 },
      unknownOperatorIds: ['char_future_operator'],
      unknownSkinIds: ['char_future_operator@skin#1'],
      unknownEquippedSkinIds: [],
    })
  })

  it('expands retained form identities for ownership consumers', () => {
    expect(importedAccountOwnedOperatorIds(snapshot)).toEqual([
      'char_002_amiya',
      'char_1037_amiya3',
      'char_103_angel',
      'char_future_operator',
    ])
  })

  it('exposes form-specific progression and equipped skin state', () => {
    expect(importedAccountOperatorState(snapshot, 'char_1037_amiya3')).toEqual({
      operatorId: 'char_1037_amiya3',
      level: 80,
      elite: 2,
      equippedSkinId: 'char_1037_amiya3#2',
      source: 'form',
    })
    expect(importedAccountEquippedSkinId(snapshot, 'char_002_amiya')).toBe('char_002_amiya#2')
  })

  it('never infers owned skin state from an equipped skin', () => {
    const equippedButNotOwned = {
      ...snapshot,
      ownedSkinIds: snapshot.ownedSkinIds.filter((id) => id !== 'char_103_angel@xmas#1'),
    }
    expect(importedAccountEquippedSkinId(equippedButNotOwned, 'char_103_angel')).toBe(
      'char_103_angel@xmas#1',
    )
    expect(importedAccountOwnsSkin(equippedButNotOwned, 'char_103_angel@xmas#1')).toBe(false)
  })

  it('maps imported char IDs directly to current operator records', () => {
    expect(resolveArknightsOperatorIdentity(dataset, 'char_103_angel')).toBe(dataset.operators[0])
    expect(resolveArknightsOperatorIdentity(dataset, 'char_future_operator')).toBeNull()
  })

  it('maps alternate skins and current main defaultArts identities', () => {
    expect(resolveArknightsSkinIdentity(dataset, 'char_103_angel@xmas#1')).toEqual({
      skinId: 'char_103_angel@xmas#1',
      operatorId: 'char_103_angel',
      appearance: 'skin:char_103_angel@xmas#1',
    })
    expect(resolveArknightsSkinIdentity(dataset, 'char_103_angel#1')).toEqual({
      skinId: 'char_103_angel#1',
      operatorId: 'char_103_angel',
      appearance: 'default',
    })
  })

  it('treats unknown/newer identities as diagnostics instead of throwing', () => {
    expect(() => reconcileArknightsAccount(snapshot, dataset)).not.toThrow()
  })
})
