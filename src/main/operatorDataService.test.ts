import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/fixture-app',
    getPath: () => '/fixture-user',
  },
}))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(),
}))

import { readFile } from 'node:fs/promises'
import { normalizeCharacterTables } from '../shared/operatorData'
import { OPERATOR_DATA_PIPELINE_VERSION } from '../shared/operator'
import { OPERATOR_SKIN_METADATA_VERSION } from '../shared/skinMetadata'
import { getOperatorDataset, getOperatorDataInfo } from './operatorDataService'

function fixture(version: number, date: string) {
  const ids = Array.from({ length: 300 }, (_, index) => `char_fixture_${index}`)
  const records = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        name: id,
        rarity: 'TIER_6',
        profession: 'WARRIOR',
        subProfessionId: 'lord',
        isNotObtainable: false,
      },
    ]),
  )
  return {
    ...normalizeCharacterTables(
      records,
      {},
      {
        gamedataCnCommit: 'game',
        gamedataEnCommit: 'game',
        gamedataJpCommit: 'game',
        gamedataKrCommit: 'game',
        gamedataTwCommit: 'game',
        resourcesCommit: 'resources',
        releaseMetadataCommit: 'releases',
      },
      '2026-11-02T00:00:00Z',
      {
        releaseDates: Object.fromEntries(ids.map((id) => [id, { cn: date, global: null }])),
      },
    ),
    dataPipelineVersion: version,
    skinMetadataVersion: OPERATOR_SKIN_METADATA_VERSION,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('operator dataset normalization upgrades', () => {
  it('corrects Recruitment and Credit Shop assignments in cached data offline', async () => {
    const cached = fixture(OPERATOR_DATA_PIPELINE_VERSION, '2026-11-01')
    const expectedGroups = {
      char_385_finlpp: 'recruitment',
      char_198_blackd: 'creditShop',
      char_187_ccheal: 'creditShop',
      char_260_durnar: 'creditShop',
    }
    for (const [index, id] of Object.keys(expectedGroups).entries()) {
      cached.operators[index] = {
        ...cached.operators[index],
        id,
        imageFile: `operators/${id}.png`,
        acquisition:
          id === 'char_385_finlpp'
            ? { family: 'standard', group: null }
            : { family: 'welfare', group: 'eventStory' },
      }
    }
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(cached))

    const { operators } = await getOperatorDataset()
    for (const [id, group] of Object.entries(expectedGroups)) {
      expect(operators.find((operator) => operator.id === id)?.acquisition).toEqual({
        family: 'welfare',
        group,
      })
    }
  })

  it('uses corrected bundled dates offline instead of the same-source preload cache', async () => {
    const old = fixture(1, '2026-10-29')
    const corrected = fixture(OPERATOR_DATA_PIPELINE_VERSION, '2026-11-01')
    vi.mocked(readFile).mockImplementation(async (path) =>
      JSON.stringify(String(path).includes('bundled-data') ? corrected : old),
    )
    const fetch = vi.fn(() => {
      throw new Error('Offline')
    })
    vi.stubGlobal('fetch', fetch)
    expect((await getOperatorDataset()).operators[0].release.cn.date).toBe('2026-11-01')
    expect((await getOperatorDataInfo()).origin).toBe('bundled')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves downloaded data from a newer upstream revision', async () => {
    const downloaded = fixture(1, '2026-11-02')
    downloaded.sources.gamedataCnCommit = 'newer-game'
    downloaded.operators.push({
      ...downloaded.operators[0],
      id: 'char_newer',
      imageFile: 'operators/char_newer.png',
    })
    const bundled = fixture(OPERATOR_DATA_PIPELINE_VERSION, '2026-11-01')
    vi.mocked(readFile).mockImplementation(async (path) =>
      JSON.stringify(String(path).includes('bundled-data') ? bundled : downloaded),
    )
    const loaded = await getOperatorDataset()
    expect(loaded.sources.gamedataCnCommit).toBe('newer-game')
    expect(loaded.operators).toHaveLength(301)
    expect(loaded.operators[0].release.cn.date).toBe('2026-11-01')
    expect(
      loaded.operators.find((operator) => operator.id === 'char_newer')?.release.cn.date,
    ).toBeNull()
    expect((await getOperatorDataInfo()).origin).toBe('downloaded')
  })
})
