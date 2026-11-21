import { describe, expect, it, vi } from 'vitest'
import {
  dataPackageFixture,
  fixtureFeed,
  rehashDataPackage,
} from '../../scripts/testFixtures/dataPackage'
import { DataPackageClient, type DataPackageStorage } from './dataPackageClient'
import { canonicalPackageJson } from './dataPackageFormat'
import { readDataPackage, readDataChannel } from './dataPackageReader'
import type { DataPackageArtifact } from './dataPackage'
import type { OperatorDataset } from './operator'
import { gameLocales } from './operator'

function setup(artifact = dataPackageFixture().artifact) {
  let disk: string | null = null
  const storage: DataPackageStorage = {
    load: vi.fn(async () => disk),
    save: vi.fn(async (value) => {
      disk = value
    }),
  }
  const options = {
    loadBundled: async () => canonicalPackageJson(artifact),
    storage,
    channel: 'preview' as const,
    baseUrl: 'https://feed.invalid/',
  }
  return {
    artifact,
    storage,
    options,
    disk: () => disk,
    replace: (value: string) => {
      disk = value
    },
  }
}
function saved(artifact: DataPackageArtifact, installedAgainst = artifact.manifest.packageId) {
  return { installedAgainst, origin: 'downloaded', artifact }
}
function dataset(artifact: DataPackageArtifact): OperatorDataset {
  return JSON.parse(artifact.files['operators.json']) as OperatorDataset
}

describe('complete data package reader and activation', () => {
  it('opens the roster and every region/language catalog offline with no source or artwork requests', async () => {
    const { options } = setup()
    const fetchImpl = vi.fn(() => {
      throw new Error('Offline')
    })
    const client = new DataPackageClient({ ...options, fetchImpl })
    expect((await client.getDataset()).operators).toHaveLength(300)
    for (const region of ['cn', 'global'] as const)
      for (const locale of gameLocales)
        expect((await client.getCatalog(region, locale))[0].name).toBe(`Fixture ${locale}`)
    expect((await client.getInfo()).packageId).toBe(
      dataPackageFixture().artifact.manifest.packageId,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    expect((await client.checkUpdates()).online).toBe(false)
    expect((await client.getDataset()).operators).toHaveLength(300)
  })

  it('updates catalogs and operators together even when upstream repository heads are unchanged', async () => {
    const base = setup()
    const next = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
    for (const key of Object.keys(next.files).filter((key) => key.startsWith('garrison/'))) {
      const catalog = JSON.parse(next.files[key])
      catalog.events[0].name += ' Updated'
      next.files[key] = canonicalPackageJson(catalog)
    }
    rehashDataPackage(next)
    const feed = fixtureFeed(next)
    const client = new DataPackageClient({ ...base.options, fetchImpl: feed.fetchImpl })
    expect((await client.checkUpdates()).updateAvailable).toBe(true)
    expect((await client.getCatalog('global', 'en'))[0].name).toBe('Fixture en')
    const results = await Promise.all([client.installUpdate(), client.installUpdate()])
    expect(results.every((result) => result.updated)).toBe(true)
    expect(base.storage.save).toHaveBeenCalledTimes(1)
    expect(feed.requests.filter((url) => url.endsWith('.gz'))).toHaveLength(1)
    expect(feed.requests.every((url) => url.startsWith(base.options.baseUrl))).toBe(true)
    expect((await client.getCatalog('global', 'en'))[0].name).toBe('Fixture en Updated')
    expect((await client.getInfo()).packageId).toBe(next.manifest.packageId)
    expect((await client.getDataset()).generatedAt).toBe(next.manifest.generatedAt)
    const restarted = new DataPackageClient(base.options)
    expect((await restarted.getInfo()).packageId).toBe(next.manifest.packageId)
    const cache = JSON.parse(base.disk()!)
    expect(cache.previous.artifact.manifest.packageId).toBe(base.artifact.manifest.packageId)
  })

  it.each([
    'truncated',
    'checksum',
    'decoded checksum',
    'wrong package',
    'missing catalog',
    'storage',
  ])('keeps previous data after a %s failure', async (failure) => {
    const base = setup()
    const next = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
    if (failure === 'missing catalog') delete next.files['garrison/cn-jp.json']
    const feed = fixtureFeed(next)
    if (failure === 'checksum') feed.pointer.compressedSha256 = '0'.repeat(64)
    if (failure === 'decoded checksum') feed.pointer.artifactSha256 = '0'.repeat(64)
    if (failure === 'wrong package') {
      feed.pointer.packageId = `sha256:${'1'.repeat(64)}`
      feed.pointer.artifactPath = `packages/${'1'.repeat(64)}/package.json.gz`
    }
    if (failure === 'storage')
      vi.mocked(base.storage.save).mockRejectedValue(new Error('Disk full'))
    const fetchImpl: typeof fetch =
      failure === 'truncated'
        ? async (input, init) =>
            String(input).endsWith('.gz')
              ? new Response(feed.gzip.subarray(0, -3))
              : feed.fetchImpl(input, init)
        : feed.fetchImpl
    const client = new DataPackageClient({ ...base.options, fetchImpl })
    await client.getDataset()
    await expect(client.installUpdate()).rejects.toThrow()
    expect((await client.getInfo()).packageId).toBe(base.artifact.manifest.packageId)
    expect((await client.getCatalog('cn', 'jp'))[0].name).toBe('Fixture jp')
    expect(base.disk()).toBeNull()
  })

  it('recovers a corrupt current package from the complete previous version before using bundled data', async () => {
    const base = setup()
    const previous = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
    const corrupt = structuredClone(previous)
    corrupt.files['operators.json'] += 'tampered'
    base.replace(
      canonicalPackageJson({
        formatVersion: 1,
        current: saved(corrupt),
        previous: saved(previous),
      }),
    )
    expect((await new DataPackageClient(base.options).getInfo()).packageId).toBe(
      previous.manifest.packageId,
    )
    base.replace('{partial write')
    expect((await new DataPackageClient(base.options).getInfo()).origin).toBe('bundled')
  })

  it('uses a newer app bundle instead of an older downloaded package', async () => {
    const newer = dataPackageFixture('2026-01-03T00:00:00.000Z').artifact
    const base = setup(newer)
    const older = dataPackageFixture().artifact
    base.replace(canonicalPackageJson({ formatVersion: 1, current: saved(older), previous: null }))
    expect((await new DataPackageClient(base.options).getInfo()).packageId).toBe(
      newer.manifest.packageId,
    )
  })

  it('retains newer legacy data until a complete package replaces it, then ignores the old cache', async () => {
    const base = setup()
    const legacy = dataset(dataPackageFixture('2026-01-02T00:00:00.000Z').artifact)
    const next = dataPackageFixture('2026-01-03T00:00:00.000Z').artifact
    const feed = fixtureFeed(next)
    const options = {
      ...base.options,
      fetchImpl: feed.fetchImpl,
      loadLegacy: vi.fn(async () => legacy),
      loadLegacyCatalog: vi.fn(async () => null),
    }
    const client = new DataPackageClient(options)
    expect((await client.getInfo()).warning).toContain('previously downloaded')
    expect((await client.getDataset()).generatedAt).toBe(legacy.generatedAt)
    expect((await client.getCatalog('cn', 'tw'))[0].name).toBe('Fixture tw')
    expect((await client.installUpdate()).updated).toBe(true)
    options.loadLegacy.mockClear()
    expect((await new DataPackageClient(options).getInfo()).packageId).toBe(next.manifest.packageId)
    expect(options.loadLegacy).not.toHaveBeenCalled()
    expect(legacy.generatedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('rejects removal of known operators or confirmed dates during activation', async () => {
    for (const remove of ['operator', 'date']) {
      const base = setup()
      const next = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
      const roster = dataset(next)
      if (remove === 'operator') {
        roster.operators.pop()
        // Keep the standalone candidate valid; the active-client guard has the previous roster.
        roster.operators.push({
          ...roster.operators[0],
          id: 'char_replacement',
          imageFile: 'operators/char_replacement.png',
        })
      } else roster.operators[0].release.cn = { date: null, yearGroup: null }
      next.files['operators.json'] = canonicalPackageJson(roster)
      rehashDataPackage(next)
      await readDataPackage(next)
      const client = new DataPackageClient({
        ...base.options,
        fetchImpl: fixtureFeed(next).fetchImpl,
      })
      await expect(client.installUpdate()).rejects.toThrow(/lose existing operator data/)
      expect(base.storage.save).not.toHaveBeenCalled()
    }
  })

  it('reports incompatible updates and rejects malformed channel paths without downloading payloads', async () => {
    const base = setup()
    const feed = fixtureFeed(dataPackageFixture('2026-01-02T00:00:00.000Z').artifact)
    feed.pointer.minimumReaderVersion = 2
    const client = new DataPackageClient({ ...base.options, fetchImpl: feed.fetchImpl })
    expect((await client.checkUpdates()).message).toContain('newer version of the app')
    await expect(client.installUpdate()).rejects.toThrow(/newer version/)
    expect(feed.requests.every((url) => url.endsWith('preview.json'))).toBe(true)
    expect(() =>
      readDataChannel({ ...feed.pointer, artifactPath: 'https://other.invalid/a' }, 'preview'),
    ).toThrow(/Invalid data channel/)
    expect(() => readDataChannel({ ...feed.pointer, sources: {} }, 'preview')).toThrow(
      /Invalid data channel/,
    )
  })

  it('uses persistent browser data offline and remains usable when browser storage is blocked', async () => {
    const base = setup()
    await new DataPackageClient({ ...base.options, cacheBundled: true }).getDataset()
    const loadBundled = async () => {
      throw new Error('Offline')
    }
    expect(
      (await new DataPackageClient({ ...base.options, loadBundled }).getInfo()).packageId,
    ).toBe(base.artifact.manifest.packageId)
    vi.mocked(base.storage.load).mockRejectedValue(new Error('Blocked'))
    vi.mocked(base.storage.save).mockRejectedValue(new Error('Quota exceeded'))
    expect(
      (await new DataPackageClient({ ...base.options, cacheBundled: true }).getDataset()).operators,
    ).toHaveLength(300)
  })

  it('rejects a bundled file that differs from the source-controlled build pin', async () => {
    const base = setup()
    const client = new DataPackageClient({
      ...base.options,
      bundledPin: {
        packageId: base.artifact.manifest.packageId,
        artifactSha256: '0'.repeat(64),
        artifactBytes: 1,
      },
    })
    await expect(client.getDataset()).rejects.toThrow(/No valid local data/)
  })
})
