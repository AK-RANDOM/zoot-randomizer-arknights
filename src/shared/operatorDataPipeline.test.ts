import { describe, expect, it, vi } from 'vitest'
import { UPSTREAM } from './operatorData'
import { fetchLatestOperatorDatasetSources } from './operatorDataPipeline'

describe('fetchLatestOperatorDatasetSources', () => {
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
