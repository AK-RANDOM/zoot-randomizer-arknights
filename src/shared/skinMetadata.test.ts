import { describe, expect, it } from 'vitest'
import type { Operator, OperatorDataset } from './operator'
import {
  applySkinMetadata,
  operatorDatasetNeedsSkinMetadataRefresh,
  skinDisplayName,
} from './skinMetadata'

function operator(id: string, name: string, rarity: Operator['rarity'] = 6): Operator {
  return {
    id,
    name,
    rarity,
    class: id === 'char_1001_amiya2' ? 'Guard' : id === 'char_1037_amiya3' ? 'Medic' : 'Caster',
    subclass: { id: 'test', name: 'Test' },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: null, yearGroup: null },
      global: { date: null, yearGroup: null },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

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
    operator('char_222_bpipe', 'Bagpipe'),
    operator('char_002_amiya', 'Amiya (Caster)', 5),
    operator('char_1001_amiya2', 'Amiya (Guard)', 5),
    operator('char_1037_amiya3', 'Amiya (Medic)', 5),
    operator('char_124_kroos', 'Kroos', 3),
  ],
} satisfies OperatorDataset

const defaultRecord = (skinId: string, charId: string, avatarId: string, portraitId: string) => ({
  skinId,
  charId,
  avatarId,
  portraitId,
  displaySkin: { skinName: null, skinGroupName: 'Default Outfit', getTime: 0 },
})

describe('skin metadata', () => {
  it('uses source maps for variable default-art counts, Amiya forms, and release order', () => {
    const result = applySkinMetadata(dataset, {
      cn: {
        buildinEvolveMap: {
          char_222_bpipe: { '0': 'char_222_bpipe#1', '2': 'char_222_bpipe#2' },
          char_002_amiya: {
            '0': 'char_002_amiya#1',
            '1': 'char_002_amiya#1+',
            '2': 'char_002_amiya#2',
          },
          char_124_kroos: { '0': 'char_124_kroos#1' },
        },
        buildinPatchMap: {
          char_002_amiya: {
            char_1001_amiya2: 'char_1001_amiya2#2',
            char_1037_amiya3: 'char_1037_amiya3#2',
          },
        },
        charSkins: {
          'char_222_bpipe#1': defaultRecord(
            'char_222_bpipe#1',
            'char_222_bpipe',
            'char_222_bpipe',
            'char_222_bpipe_1',
          ),
          'char_222_bpipe#2': defaultRecord(
            'char_222_bpipe#2',
            'char_222_bpipe',
            'char_222_bpipe_2',
            'char_222_bpipe_2',
          ),
          'char_002_amiya#1': defaultRecord(
            'char_002_amiya#1',
            'char_002_amiya',
            'char_002_amiya',
            'char_002_amiya_1',
          ),
          'char_002_amiya#1+': defaultRecord(
            'char_002_amiya#1+',
            'char_002_amiya',
            'char_002_amiya_1+',
            'char_002_amiya_1+',
          ),
          'char_002_amiya#2': defaultRecord(
            'char_002_amiya#2',
            'char_002_amiya',
            'char_002_amiya_2',
            'char_002_amiya_2',
          ),
          'char_1001_amiya2#2': {
            ...defaultRecord(
              'char_1001_amiya2#2',
              'char_002_amiya',
              'char_1001_amiya2_2',
              'char_1001_amiya2_2',
            ),
            tmplId: 'char_1001_amiya2',
          },
          'char_1037_amiya3#2': {
            ...defaultRecord(
              'char_1037_amiya3#2',
              'char_002_amiya',
              'char_1037_amiya3_2',
              'char_1037_amiya3_2',
            ),
            tmplId: 'char_1037_amiya3',
          },
          'char_124_kroos#1': defaultRecord(
            'char_124_kroos#1',
            'char_124_kroos',
            'char_124_kroos',
            'char_124_kroos_1',
          ),
          'char_222_bpipe@late#1': {
            skinId: 'char_222_bpipe@late#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_late#1',
            avatarId: 'char_222_bpipe_late#1',
            displaySkin: {
              skinName: 'Later',
              skinGroupName: 'Brand',
              getTime: 200,
            },
          },
          'char_222_bpipe@early#1': {
            skinId: 'char_222_bpipe@early#1',
            charId: 'char_222_bpipe',
            portraitId: 'char_222_bpipe_early#1',
            avatarId: 'char_222_bpipe_early#1',
            displaySkin: {
              skinName: 'Earlier',
              skinGroupName: 'Brand',
              getTime: 100,
            },
          },
          'char_1001_amiya2@sale#16': {
            skinId: 'char_1001_amiya2@sale#16',
            charId: 'char_002_amiya',
            tmplId: 'char_1001_amiya2',
            portraitId: 'char_1001_amiya2_sale#16',
            avatarId: 'char_1001_amiya2_sale#16',
            displaySkin: {
              skinName: 'Guard Skin',
              skinGroupName: 'Brand',
              getTime: 300,
            },
          },
          'char_1037_amiya3@sale#13': {
            skinId: 'char_1037_amiya3@sale#13',
            charId: 'char_002_amiya',
            tmplId: 'char_1037_amiya3',
            portraitId: 'char_1037_amiya3_sale#13',
            avatarId: 'char_1037_amiya3_sale#13',
            displaySkin: {
              skinName: 'Medic Skin',
              skinGroupName: 'Brand',
              getTime: 250,
            },
          },
        },
      },
    })

    const bagpipe = result.operators.find((item) => item.id === 'char_222_bpipe')!
    const caster = result.operators.find((item) => item.id === 'char_002_amiya')!
    const guard = result.operators.find((item) => item.id === 'char_1001_amiya2')!
    const medic = result.operators.find((item) => item.id === 'char_1037_amiya3')!
    const kroos = result.operators.find((item) => item.id === 'char_124_kroos')!

    expect(bagpipe.defaultArts?.map((art) => art.label)).toEqual(['E1', 'E2'])
    expect(bagpipe.skins?.filter((skin) => !skin.isDefault).map((skin) => skin.id)).toEqual([
      'char_222_bpipe@early#1',
      'char_222_bpipe@late#1',
    ])
    expect(caster.defaultArts?.map((art) => art.label)).toEqual(['E0', 'E1', 'E2'])
    expect(caster.skins?.find((skin) => skin.isDefault)?.id).toBe('char_002_amiya#1+')
    expect(guard.defaultArts?.map((art) => art.id)).toEqual(['char_1001_amiya2#2'])
    expect(guard.defaultArts?.map((art) => art.label)).toEqual(['Default'])
    expect(medic.defaultArts?.map((art) => art.id)).toEqual(['char_1037_amiya3#2'])
    expect(medic.defaultArts?.map((art) => art.label)).toEqual(['Default'])
    expect(kroos.defaultArts?.map((art) => art.id)).toEqual(['char_124_kroos#1'])
    expect(kroos.defaultArts?.map((art) => art.label)).toEqual(['Default'])
    expect(guard.skins?.filter((skin) => !skin.isDefault).map((skin) => skin.id)).toEqual([
      'char_1001_amiya2@sale#16',
    ])
    expect(medic.skins?.filter((skin) => !skin.isDefault).map((skin) => skin.id)).toEqual([
      'char_1037_amiya3@sale#13',
    ])
    expect(caster.skins?.some((skin) => skin.id.includes('amiya2@sale'))).toBe(false)
    expect(caster.skins?.some((skin) => skin.id.includes('amiya3@sale'))).toBe(false)
    expect(result.skinMetadataVersion).toBe(5)
    expect(skinDisplayName(bagpipe.skins![0], 'en')).toBe('Earlier')
  })

  it('forces v4 cosmetic metadata caches to regenerate under v5', () => {
    expect(
      operatorDatasetNeedsSkinMetadataRefresh({
        ...dataset,
        skinMetadataVersion: 4,
      }),
    ).toBe(true)
    expect(
      operatorDatasetNeedsSkinMetadataRefresh({
        ...dataset,
        skinMetadataVersion: 5,
      }),
    ).toBe(false)
  })
})
