import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { ArtworkCache } from './artworkCache'
import { artworkAsset, operatorAvatarAsset, enumerateArtwork } from '../shared/artwork'
import { validArtworkPng, fetchArtworkBytes } from '../shared/artworkDownload'
import { buildArtworkInventory } from '../shared/artworkInventory'
import type { OperatorDataset } from '../shared/operator'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const roots: string[] = []
async function root() {
  const parent = resolve('.tmp/artwork-cache-tests')
  await fs.mkdir(parent, { recursive: true })
  const result = await fs.mkdtemp(join(parent, 'test-'))
  roots.push(result)
  return result
}
afterEach(async () => {
  for (const path of roots.splice(0)) {
    if (!resolve(path).startsWith(resolve('.tmp/artwork-cache-tests') + sep))
      throw Error('Invalid cleanup')
    await fs.rm(path, { recursive: true, force: true })
  }
})

describe('shared artwork policy', () => {
  it('keeps completed files when bulk downloading is cancelled and skips them on resume', async () => {
    const directory = await root(),
      controller = new AbortController()
    const assets = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => artworkAsset('avatar', `${id}.png`))
    const cache = new ArtworkCache({
      root: directory,
      fetchImpl: async (url, init) => {
        if (String(url).endsWith('/a.png')) return new Response(png)
        return new Promise<Response>((_accept, reject) => {
          const cancel = () => reject(init?.signal?.reason)
          init?.signal?.addEventListener('abort', cancel, { once: true })
          if (init?.signal?.aborted) cancel()
        })
      },
    })
    await expect(
      cache.download(assets, {
        signal: controller.signal,
        onProgress: (counts) => {
          if (counts.completed === 1) controller.abort()
        },
      }),
    ).rejects.toThrow()
    expect(
      (await fs.readdir(join(directory, 'shared-artwork'))).filter((file) => file.endsWith('.png')),
    ).toHaveLength(1)
    const resumed = new ArtworkCache({ root: directory, fetchImpl: async () => new Response(png) })
    expect(await resumed.download(assets, { signal: new AbortController().signal })).toMatchObject({
      completed: 6,
      cached: 1,
      downloaded: 5,
      failed: 0,
    })
  })
  it('deduplicates real source identities across normal/default/skin references and preserves legacy aliases', () => {
    const dataset = {
      operators: [
        {
          id: 'char_test',
          defaultArts: [{ avatarId: 'char_test' }],
          skins: [{ portraitId: 'char_test_1', avatarId: 'char_test' }],
        },
      ],
    } as unknown as OperatorDataset
    const assets = enumerateArtwork(dataset)
    expect(assets).toHaveLength(3)
    expect(assets.filter((asset) => asset.kind === 'avatar')[0].legacy).toContain(
      'images/char_test.png',
    )
    expect(assets.find((asset) => asset.filename === 'char_test_1.png')?.legacy).toContain(
      'skin-portraits/char_test_1.png',
    )
    expect(artworkAsset('avatar', 'char_1037_amiya3_2.png').legacy).toContain(
      'images/char_1037_amiya3.png',
    )
    expect(() => artworkAsset('avatar', '../bad.png')).toThrow()
    expect(() => artworkAsset('avatar', 'safe.png', ['../bad'])).toThrow()
    const first = buildArtworkInventory(dataset, 'metadata-one'),
      second = buildArtworkInventory(dataset, 'metadata-two')
    expect(first.artworkId).toBe(second.artworkId)
    expect(first.metadataPackageId).not.toBe(second.metadataPackageId)
  })
  it('validates full PNGs and rejects truncation, modified content and HTML responses', () => {
    expect(validArtworkPng(png)).toBe(true)
    expect(validArtworkPng(png.subarray(0, -1))).toBe(false)
    const corrupt = Buffer.from(png)
    corrupt[45] ^= 1
    expect(validArtworkPng(corrupt)).toBe(false)
    expect(validArtworkPng(Buffer.from('<html>not an image</html>'))).toBe(false)
  })
  it('reuses valid old files offline without rewriting or deleting them', async () => {
    const directory = await root()
    await fs.mkdir(join(directory, 'images'))
    await fs.writeFile(join(directory, 'images/char_1037_amiya3.png'), png)
    const network = vi.fn(() => {
      throw Error('Offline')
    })
    const cache = new ArtworkCache({ root: directory, fetchImpl: network })
    expect(await cache.image(artworkAsset('avatar', 'char_1037_amiya3_2.png'))).toContain(
      'data:image/png;base64,',
    )
    expect(network).not.toHaveBeenCalled()
    expect(await fs.readFile(join(directory, 'images/char_1037_amiya3.png'))).toEqual(png)
  })
  it('shares one download between individual and bulk requests, then reuses the file after restart', async () => {
    const directory = await root()
    const fetchImpl = vi.fn(async () => new Response(png))
    const cache = new ArtworkCache({ root: directory, fetchImpl })
    const asset = operatorAvatarAsset('char_test')
    const [image, report] = await Promise.all([
      cache.image(asset),
      cache.download([asset, asset], { signal: new AbortController().signal }),
    ])
    expect(image).toContain('data:image/png;base64,')
    expect(report.completed).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(
      (await fs.readdir(join(directory, 'shared-artwork'))).filter((file) => file.endsWith('.png')),
    ).toHaveLength(1)
    expect(
      (await fs.readdir(join(directory, 'shared-artwork'))).some((file) => file.endsWith('.part')),
    ).toBe(false)
    const offline = new ArtworkCache({
      root: directory,
      fetchImpl: vi.fn(() => {
        throw Error('Offline')
      }),
    })
    expect((await offline.download([asset], { signal: new AbortController().signal })).cached).toBe(
      1,
    )
  })
  it('retries transient/invalid responses but classifies missing assets without retries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad', { status: 503 }))
      .mockResolvedValueOnce(new Response('not PNG'))
      .mockResolvedValueOnce(new Response(png))
    expect(
      (
        await fetchArtworkBytes('https://source.invalid/a.png', {
          fetchImpl,
          signal: new AbortController().signal,
          retryDelayMs: 0,
        })
      ).status,
    ).toBe('downloaded')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const missing = vi.fn(async () => new Response('', { status: 404 }))
    expect(
      (
        await fetchArtworkBytes('https://source.invalid/missing.png', {
          fetchImpl: missing,
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe('unavailable')
    expect(missing).toHaveBeenCalledTimes(1)
  })
  it('cancels only the requesting subscriber, preserving an on-screen request sharing the asset', async () => {
    let finish!: () => void
    const ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    const fetchImpl = vi.fn(async () => {
      await ready
      return new Response(png)
    })
    const cache = new ArtworkCache({ root: await root(), fetchImpl }),
      asset = operatorAvatarAsset('char_test'),
      controller = new AbortController()
    const bulk = cache.acquire(asset, controller.signal)
    const rejected = expect(bulk).rejects.toThrow()
    const visible = cache.acquire(asset)
    controller.abort()
    finish()
    await rejected
    expect((await visible).status).toBe('downloaded')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('cancels a lone download and resumes without exposing a partial file', async () => {
    const directory = await root()
    const controller = new AbortController()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const fetchImpl = vi.fn(
      async (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_accept, reject) => {
          started()
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
        }),
    )
    const cache = new ArtworkCache({ root: directory, fetchImpl }),
      asset = operatorAvatarAsset('char_test')
    const pending = cache.acquire(asset, controller.signal)
    const rejected = expect(pending).rejects.toThrow()
    await ready
    controller.abort()
    await rejected
    expect(await fs.readdir(directory)).toEqual([])
    const resumed = new ArtworkCache({ root: directory, fetchImpl: async () => new Response(png) })
    expect((await resumed.acquire(asset)).status).toBe('downloaded')
  })
  it('reports unavailable and failed assets separately while preserving completed files for resume', async () => {
    const directory = await root(),
      assets = ['ok', 'absent', 'broken'].map((id) => artworkAsset('avatar', `${id}.png`))
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('ok.png')
        ? new Response(png)
        : String(url).endsWith('absent.png')
          ? new Response('', { status: 404 })
          : new Response('corrupt'),
    )
    const cache = new ArtworkCache({ root: directory, fetchImpl, retryDelayMs: 0 })
    const result = await cache.download(assets, { signal: new AbortController().signal })
    expect(result).toMatchObject({
      completed: 3,
      total: 3,
      downloaded: 1,
      cached: 0,
      unavailable: 1,
      failed: 1,
    })
    expect(
      (await cache.download([assets[0]], { signal: new AbortController().signal })).cached,
    ).toBe(1)
  })
  it('keeps storage failures out of the completed cache and retains valid legacy files', async () => {
    const directory = await root()
    await fs.writeFile(join(directory, 'shared-artwork'), 'blocked')
    const cache = new ArtworkCache({ root: directory, fetchImpl: async () => new Response(png) })
    expect((await cache.acquire(operatorAvatarAsset('char_test'))).status).toBe('failed')
    expect(await fs.readFile(join(directory, 'shared-artwork'), 'utf8')).toBe('blocked')
  })
})
