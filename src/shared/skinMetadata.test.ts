import { describe, expect, it } from 'vitest'
import type { OperatorDataset } from './operator'
import { applySkinMetadata, skinBrandName, skinDisplayName } from './skinMetadata'

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
      id: 'char_222_bpipe',
      name: 'Bagpipe',
      rarity: 6,
      class: 'Vanguard',
      subclass: { id: 'pioneer', name: 'Pioneer' },
      faction: { main: null, affiliations: [] },
      availableOn: { cn: true, global: true },
      release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
      acquisition: { family: 'standard', group: null },
      collaboration: null,
      alterGroup: null,
      mandatoryExclusivityGroup: null,
      imageFile: 'operators/char_222_bpipe.png',
    },
  ],
} satisfies OperatorDataset

describe('skin metadata', () => {
  it('keeps default avatar IDs and orders alternate skins by release time', () => {
    const result = applySkinMetadata(dataset, {
      cn: {
        charSkins: {
          'char_222_bpipe#1': {
            skinId: 'char_222_bpipe#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_1',
            avatarId: 'char_222_bpipe',
            displaySkin: { skinName: null, skinGroupName: 'Default Outfit' },
          },
          'char_222_bpipe#2': {
            skinId: 'char_222_bpipe#2',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_2',
            avatarId: 'char_222_bpipe_2',
            displaySkin: { skinName: null, skinGroupName: 'Elite 2' },
          },
          'char_222_bpipe@late#1': {
            skinId: 'char_222_bpipe@late#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_late#1',
            avatarId: 'char_222_bpipe_late#1',
            displaySkin: {
              skinName: 'Later CN Skin',
              skinGroupName: 'Later Collection',
              getTime: 200,
            },
          },
          'char_222_bpipe@race#1': {
            skinId: 'char_222_bpipe@race#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_race#1',
            avatarId: 'char_222_bpipe_race#1',
            displaySkin: { skinName: 'CN Skin', skinGroupName: 'Collection', getTime: 100 },
          },
        },
      },
      en: {
        charSkins: {
          'char_222_bpipe@late#1': {
            skinId: 'char_222_bpipe@late#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_late#1',
            avatarId: 'char_222_bpipe_late#1',
            displaySkin: { skinName: 'Later Skin', skinGroupName: 'Later Brand' },
          },
          'char_222_bpipe@race#1': {
            skinId: 'char_222_bpipe@race#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_race#1',
            avatarId: 'char_222_bpipe_race#1',
            displaySkin: { skinName: 'Queen, No. 1', skinGroupName: 'Whistlewind' },
          },
        },
      },
    })

    expect(result.operators[0].promotionAvatarIds).toEqual({
      e1: 'char_222_bpipe',
      e2: 'char_222_bpipe_2',
    })
    expect(result.operators[0].skins).toEqual([
      {
        id: 'char_222_bpipe@race#1',
        portraitId: 'char_222_bpipe_race#1',
        avatarId: 'char_222_bpipe_race#1',
        releaseTime: 100,
        names: { en: 'Queen, No. 1', cn: 'CN Skin' },
        brands: { en: 'Whistlewind', cn: 'Collection' },
      },
      {
        id: 'char_222_bpipe@late#1',
        portraitId: 'char_222_bpipe_late#1',
        avatarId: 'char_222_bpipe_late#1',
        releaseTime: 200,
        names: { en: 'Later Skin', cn: 'Later CN Skin' },
        brands: { en: 'Later Brand', cn: 'Later Collection' },
      },
    ])
    expect(result.skinMetadataVersion).toBe(3)
    expect(skinDisplayName(result.operators[0].skins![0], 'en')).toBe('Queen, No. 1')
    expect(skinBrandName(result.operators[0].skins![0], 'en')).toBe('Whistlewind')
  })
})
