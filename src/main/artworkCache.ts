import { mkdir, readFile, open, rename, unlink, stat } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { ArtworkAsset } from '../shared/artwork.ts'
import { fetchArtworkBytes, validArtworkPng, MAX_ARTWORK_BYTES } from '../shared/artworkDownload.ts'

export interface ArtworkCounts {
  completed: number
  total: number
  downloaded: number
  cached: number
  unavailable: number
  failed: number
}
type Result =
  | { status: 'cached' | 'downloaded'; bytes: Uint8Array }
  | { status: 'unavailable' | 'failed'; message: string }
type Job = { controller: AbortController; promise: Promise<Result>; subscribers: Set<symbol> }

export class ArtworkCache {
  private readonly jobs = new Map<string, Job>()
  private readonly memory = new Map<string, string>()
  constructor(
    private readonly options: {
      root: string
      bundledRoot?: string
      fetchImpl?: typeof fetch
      retryDelayMs?: number
    },
  ) {}
  clearMemory(): void {
    this.memory.clear()
  }

  private async read(path: string): Promise<Uint8Array | null> {
    try {
      if ((await stat(path)).size > MAX_ARTWORK_BYTES) return null
      const bytes = await readFile(path)
      return validArtworkPng(bytes) ? bytes : null
    } catch {
      return null
    }
  }
  private cachePath(asset: ArtworkAsset): string {
    const key = createHash('sha256').update(asset.key).digest('hex')
    return join(this.options.root, 'shared-artwork', `${key}.png`)
  }
  private async local(asset: ArtworkAsset): Promise<Uint8Array | null> {
    const cached = await this.read(this.cachePath(asset))
    if (cached) return cached
    if (this.options.bundledRoot) {
      const bundled = await this.read(
        join(
          this.options.bundledRoot,
          'shared-artwork',
          `${createHash('sha256').update(asset.key).digest('hex')}.png`,
        ),
      )
      if (bundled) return bundled
    }
    for (const legacy of asset.legacy) {
      if (
        !/^(images|portraits|appearance-avatars|skin-portraits|skin-avatars)\/[a-z0-9_@#+-]+\.png$/i.test(
          legacy,
        )
      )
        throw new Error('Invalid artwork cache path')
      const existing =
        (await this.read(join(this.options.root, legacy))) ??
        (this.options.bundledRoot ? await this.read(join(this.options.bundledRoot, legacy)) : null)
      if (existing) return existing
    }
    return null
  }
  async cachedImage(asset: ArtworkAsset): Promise<string | null> {
    const bytes = await this.local(asset)
    return bytes ? `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` : null
  }
  private async obtain(asset: ArtworkAsset, signal: AbortSignal): Promise<Result> {
    const cached = await this.local(asset)
    if (cached) return { status: 'cached', bytes: cached }
    const target = this.cachePath(asset)
    const directory = join(this.options.root, 'shared-artwork')
    const received = await fetchArtworkBytes(asset.url, {
      signal,
      fetchImpl: this.options.fetchImpl,
      retryDelayMs: this.options.retryDelayMs,
    })
    if (received.status !== 'downloaded') return received
    signal.throwIfAborted()
    await mkdir(directory, { recursive: true })
    const temporary = join(directory, `.${randomUUID()}.part`)
    try {
      const handle = await open(temporary, 'wx')
      try {
        await handle.writeFile(received.bytes)
        await handle.sync()
      } finally {
        await handle.close()
      }
      signal.throwIfAborted()
      await rename(temporary, target)
      return received
    } finally {
      await unlink(temporary).catch(() => undefined)
    }
  }

  async acquire(asset: ArtworkAsset, signal?: AbortSignal): Promise<Result> {
    signal?.throwIfAborted()
    let job = this.jobs.get(asset.key)
    if (!job || job.controller.signal.aborted) {
      const controller = new AbortController()
      const created: Job = {
        controller,
        subscribers: new Set(),
        promise: Promise.resolve({ status: 'failed', message: '' }),
      }
      created.promise = this.obtain(asset, controller.signal)
        .catch((error: unknown): Result => {
          controller.signal.throwIfAborted()
          return {
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          }
        })
        .finally(() => {
          if (this.jobs.get(asset.key) === created) this.jobs.delete(asset.key)
        })
      job = created
      this.jobs.set(asset.key, job)
    }
    const current = job,
      subscriber = Symbol()
    current.subscribers.add(subscriber)
    return new Promise<Result>((accept, reject) => {
      const cleanup = () => {
        signal?.removeEventListener('abort', cancel)
        current.subscribers.delete(subscriber)
      }
      const cancel = () => {
        cleanup()
        if (!current.subscribers.size) current.controller.abort()
        reject(signal?.reason ?? new DOMException('Artwork download cancelled', 'AbortError'))
      }
      signal?.addEventListener('abort', cancel, { once: true })
      current.promise.then(
        (result) => {
          if (current.subscribers.has(subscriber)) {
            cleanup()
            accept(result)
          }
        },
        (error) => {
          if (current.subscribers.has(subscriber)) {
            cleanup()
            reject(error)
          }
        },
      )
      if (signal?.aborted) cancel()
    })
  }
  async image(asset: ArtworkAsset): Promise<string | null> {
    const existing = this.memory.get(asset.key)
    if (existing) {
      this.memory.delete(asset.key)
      this.memory.set(asset.key, existing)
      return existing
    }
    const result = await this.acquire(asset)
    if (result.status !== 'cached' && result.status !== 'downloaded') return null
    const url = `data:image/png;base64,${Buffer.from(result.bytes).toString('base64')}`
    this.memory.set(asset.key, url)
    // Bound duplicated base64 strings; disk remains the durable cache.
    let memoryBytes = [...this.memory.values()].reduce((sum, value) => sum + value.length * 2, 0)
    while (this.memory.size > 32 || memoryBytes > 32 * 1024 * 1024) {
      const first = this.memory.keys().next().value!
      memoryBytes -= this.memory.get(first)!.length * 2
      this.memory.delete(first)
    }
    return url
  }
  async download(
    assets: readonly ArtworkAsset[],
    options: { signal: AbortSignal; onProgress?: (counts: ArtworkCounts) => void },
  ): Promise<ArtworkCounts & { warnings: string[] }> {
    const unique = [...new Map(assets.map((asset) => [asset.key, asset])).values()]
    const counts: ArtworkCounts = {
      completed: 0,
      total: unique.length,
      downloaded: 0,
      cached: 0,
      unavailable: 0,
      failed: 0,
    }
    const warnings: string[] = []
    options.onProgress?.({ ...counts })
    for (let index = 0; index < unique.length; index += 6) {
      options.signal.throwIfAborted()
      await Promise.all(
        unique.slice(index, index + 6).map(async (asset) => {
          const result = await this.acquire(asset, options.signal)
          options.signal.throwIfAborted()
          counts[result.status]++
          counts.completed++
          if (result.status === 'failed' || result.status === 'unavailable')
            warnings.push(`${asset.kind}/${asset.filename}: ${result.message}`)
          options.onProgress?.({ ...counts })
        }),
      )
    }
    return { ...counts, warnings }
  }
}
