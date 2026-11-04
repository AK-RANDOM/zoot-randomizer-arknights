import { describe, expect, it, vi } from 'vitest'
import { UPSTREAM } from './operatorData'
import { CN_RELEASE_DATES_API } from './releaseMetadata'
import {
  fetchAndBuildOperatorDataset,
  fetchLatestOperatorDatasetSources,
  operatorDatasetNeedsPipelineRefresh,
} from './operatorDataPipeline'
import { buildSubclassFilterGroups } from './operatorFilterCatalog'
import { localizeOperatorDataset } from './gameLocalization'
import { OPERATOR_DATA_PIPELINE_VERSION } from './operator'

describe('fetchLatestOperatorDatasetSources', () => {
  it('requires normalization refresh for cached data from an older importer', () => {
    expect(operatorDatasetNeedsPipelineRefresh({})).toBe(true)
    expect(operatorDatasetNeedsPipelineRefresh({ dataPipelineVersion: 0 })).toBe(true)
    expect(
      operatorDatasetNeedsPipelineRefresh({ dataPipelineVersion: OPERATOR_DATA_PIPELINE_VERSION }),
    ).toBe(false)
  })
  it('uses one branch-head lookup per upstream repository', async () => {
    const shas = new Map([
      [UPSTREAM.gamedataRepo, 'gamedata-head'],
      [UPSTREAM.resourcesRepo, 'resources-head'],
      [UPSTREAM.releaseRepo, 'release-head'],
    ])
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const repository = [...shas.keys()].find((candidate) => url.includes(`/repos/${candidate}/`))
      if (!repository) throw new Error(`Unexpected URL: ${url}`)
      return new Response(JSON.stringify({ object: { sha: shas.get(repository) } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const sources = await fetchLatestOperatorDatasetSources({ fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sources).toEqual({
      gamedataCnCommit: 'gamedata-head',
      gamedataEnCommit: 'gamedata-head',
      gamedataJpCommit: 'gamedata-head',
      gamedataKrCommit: 'gamedata-head',
      gamedataTwCommit: 'gamedata-head',
      gamedataCnHandbookCommit: 'gamedata-head',
      gamedataEnHandbookCommit: 'gamedata-head',
      gamedataJpHandbookCommit: 'gamedata-head',
      gamedataKrHandbookCommit: 'gamedata-head',
      gamedataTwHandbookCommit: 'gamedata-head',
      resourcesCommit: 'resources-head',
      releaseMetadataCommit: 'release-head',
    })
  })
})

describe('operator updates with newly released branches', () => {
  it('imports a new CN operator through validation, localization and Global Filter', async () => {
    const characters = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [
        index === 0 ? 'char_4170_hdbell' : `char_fixture_${index}`,
        {
          name: index === 0 ? '行铃' : `Fixture ${index}`,
          appellation: index === 0 ? 'Herdbells' : `Fixture ${index}`,
          rarity: 'TIER_4',
          profession: 'SPECIAL',
          subProfessionId: index === 0 ? 'dispatcher' : 'executor',
          isNotObtainable: false,
        },
      ]),
    )
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      let body: unknown = {}
      if (url.endsWith('/character_table.json') && url.includes('/cn/')) body = characters
      if (url.endsWith('/uniequip_data.json'))
        body = {
          subProfDict: {
            dispatcher: { subProfessionId: 'dispatcher', subProfessionName: '调度员' },
          },
        }
      if (url.endsWith(UPSTREAM.releaseInfoPath)) {
        return new Response('export const operatorReleaseInfoByCharId = {}')
      }
      if (url.endsWith(UPSTREAM.releaseCandidatePath)) {
        return new Response('export const cnOperatorReleaseCandidateList = []')
      }
      if (url.endsWith(UPSTREAM.releaseEventPath)) {
        return new Response('export const generatedOperatorReleaseEventList = []')
      }
      if (url.startsWith(CN_RELEASE_DATES_API)) {
        body = {
          cargoquery: Object.values(characters).map((character) => ({
            title: { name: character.name, releaseDate: '2026-11-01 12:00:00' },
          })),
        }
      }
      if (url.includes('releasever')) throw new Error('Preload metadata must not be fetched')
      return new Response(JSON.stringify(body))
    }) as typeof fetch
    const sources = {
      gamedataCnCommit: 'game-head',
      gamedataEnCommit: 'game-head',
      gamedataJpCommit: 'game-head',
      gamedataKrCommit: 'game-head',
      gamedataTwCommit: 'game-head',
      resourcesCommit: 'resource-head',
      releaseMetadataCommit: 'release-head',
    }

    const { dataset, validation } = await fetchAndBuildOperatorDataset(
      sources,
      '2026-11-02T00:00:00Z',
      { fetchImpl },
    )

    expect(validation.valid, validation.errors.join('\n')).toBe(true)
    expect(dataset.operators).toHaveLength(300)
    expect(dataset.dataPipelineVersion).toBe(OPERATOR_DATA_PIPELINE_VERSION)
    const localized = localizeOperatorDataset(dataset, 'en')
    expect(
      localized.operators.find((operator) => operator.id === 'char_4170_hdbell'),
    ).toMatchObject({
      name: 'Herdbells',
      subclass: { id: 'dispatcher', name: '调度员' },
      availableOn: { cn: true, global: false },
      release: { cn: { date: '2026-11-01', yearGroup: 8 } },
    })
    expect(
      buildSubclassFilterGroups(localized).find((group) => group.operatorClass === 'Specialist')
        ?.subclasses,
    ).toContainEqual({ id: 'dispatcher', name: '调度员' })
    expect(validation.warnings).toEqual([expect.stringContaining('New subclass dispatcher')])
    expect(
      vi.mocked(fetchImpl).mock.calls.some(([url]) => String(url).includes('releasever')),
    ).toBe(false)
  })
})
