import { describe, expect, it } from 'vitest'
import type { OperatorDataset } from './operator'
import { fetchAndApplySkinMetadata } from './operatorDataPipeline'

const dataset: OperatorDataset = {
  schemaVersion: 6,
  generatedAt: null,
  sources: {
    gamedataCnCommit: 'abc123',
    gamedataEnCommit: 'def456',
    resourcesCommit: 'res',
    releaseMetadataCommit: 'release',
  },
  factionLabels: {},
  operators: [
    {
      id: 'char_124_kroos',
      name: 'Kroos',
      rarity: 3,
      class: 'Sniper',
      subclass: { id: 'fastshot', name: 'Marksman' },
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
      imageFile: 'operators/char_124_kroos.png',
    },
  ],
}

describe('lightweight skin metadata refresh', () => {
  it('fetches only locale skin tables and enriches before a full data update', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      urls.push(url)
      const body = url.includes('/cn/')
        ? {
            buildinEvolveMap: { char_124_kroos: { '0': 'char_124_kroos#1' } },
            charSkins: {
              'char_124_kroos#1': {
                skinId: 'char_124_kroos#1',
                charId: 'char_124_kroos',
                avatarId: 'char_124_kroos',
                portraitId: 'char_124_kroos_1',
                displaySkin: null,
              },
              'char_124_kroos@test#1': {
                skinId: 'char_124_kroos@test#1',
                charId: 'char_124_kroos',
                avatarId: 'char_124_kroos_test#1',
                portraitId: 'char_124_kroos_test#1',
                displaySkin: { skinName: 'Test Outfit', getTime: 10 },
              },
            },
          }
        : { charSkins: {} }
      return new Response(JSON.stringify(body), { status: 200 })
    }

    const result = await fetchAndApplySkinMetadata(dataset, { fetchImpl })
    expect(urls).toHaveLength(5)
    expect(urls.every((url) => url.endsWith('/skin_table.json'))).toBe(true)
    expect(urls.every((url) => url.includes('/abc123/'))).toBe(true)
    expect(result.skinMetadataVersion).toBe(5)
    expect(result.operators[0].defaultArts?.map((art) => art.label)).toEqual(['Default'])
    expect(result.operators[0].skins?.[0]?.avatarId).toBe('char_124_kroos_test#1')
  })
})
