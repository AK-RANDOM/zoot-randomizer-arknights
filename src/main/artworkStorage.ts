import { app, shell } from 'electron'
import { mkdir, readdir, rm, stat, writeFile, rename, readFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import type { OperatorDataset } from '../shared/operator'
import type { ArtworkStorageInfo } from '../shared/desktop'
import { UPSTREAM } from '../shared/operatorData'
import { PORTRAIT_SOURCE, skinAvatarFilename, skinPortraitFilename } from '../shared/portraits'

const CATEGORIES = ['images', 'portraits', 'appearance-avatars', 'skin-portraits', 'skin-avatars'] as const
const isPng = (data: Uint8Array): boolean =>
  data.length >= 24 &&
  Buffer.from(data.subarray(0, 8)).toString('hex') === '89504e470d0a1a0a' &&
  Buffer.from(data.subarray(12, 16)).toString('ascii') === 'IHDR'

const validId = (value: string): boolean => /^[a-z0-9_@#+-]+$/i.test(value)

export function artworkRoot(): string {
  return join(app.getPath('userData'), 'operator-data')
}

export async function getArtworkStorageInfo(): Promise<ArtworkStorageInfo> {
  const categories = await Promise.all(
    CATEGORIES.map(async (name) => {
      let files = 0
      let bytes = 0
      try {
        for (const entry of await readdir(join(artworkRoot(), name), { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith('.png')) continue
          const size = await stat(join(artworkRoot(), name, entry.name))
          files++
          bytes += size.size
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      return { name, files, bytes }
    }),
  )
  const expected = join(dirname(process.execPath), 'Arknights-Randomizer-Data', 'operator-data')
  return {
    path: artworkRoot(),
    warning: app.isPackaged && resolve(artworkRoot()) !== resolve(expected)
      ? 'Portable storage is unavailable. Files are being stored in your Windows user profile instead.'
      : undefined,
    categories,
    totalFiles: categories.reduce((n, c) => n + c.files, 0),
    totalBytes: categories.reduce((n, c) => n + c.bytes, 0),
  }
}

export async function openArtworkStorageFolder(): Promise<void> {
  await mkdir(artworkRoot(), { recursive: true })
  const error = await shell.openPath(artworkRoot())
  if (error) throw new Error(error)
}

export async function clearDownloadedArtwork(): Promise<ArtworkStorageInfo> {
  for (const category of CATEGORIES)
    await rm(join(artworkRoot(), category), { recursive: true, force: true })
  return getArtworkStorageInfo()
}

type Asset = { category: (typeof CATEGORIES)[number]; filename: string; url: string }
export function enumerateAdditionalArtwork(dataset: OperatorDataset): Asset[] {
  const assets = new Map<string, Asset>()
  const add = (category: Asset['category'], filename: string, base: string): void => {
    const id = filename.slice(0, -4)
    if (!validId(id)) return
    assets.set(`${category}/${filename}`, {
      category,
      filename,
      url: `${base}/${encodeURIComponent(filename)}`,
    })
  }
  for (const op of dataset.operators) {
    for (const art of op.defaultArts ?? [])
      add('appearance-avatars', skinAvatarFilename(art.avatarId), UPSTREAM.avatarBaseUrl)
    for (const skin of op.skins ?? []) {
      add('skin-portraits', skinPortraitFilename(skin.portraitId), PORTRAIT_SOURCE.baseUrl)
      if (skin.avatarId)
        add('skin-avatars', skinAvatarFilename(skin.avatarId), UPSTREAM.avatarBaseUrl)
    }
  }
  return [...assets.values()]
}

export async function downloadAdditionalArtwork(
  dataset: OperatorDataset,
  options: { signal: AbortSignal; onProgress: (completed: number, total: number) => void },
): Promise<string[]> {
  const assets = enumerateAdditionalArtwork(dataset)
  const warnings: string[] = []
  let completed = 0
  options.onProgress(completed, assets.length)
  for (let index = 0; index < assets.length; index += 6) {
    if (options.signal.aborted) throw new DOMException('Artwork download cancelled', 'AbortError')
    const batch = assets.slice(index, index + 6)
    await Promise.all(batch.map(async (asset) => {
      const directory = join(artworkRoot(), asset.category)
      const path = join(directory, asset.filename)
      let temporary: string | null = null
      try {
        try {
          if (isPng(await readFile(path))) return
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
        }
        let data: Buffer | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(asset.url, {
              headers: { 'User-Agent': 'arknights-randomizer' },
              signal: AbortSignal.any([options.signal, AbortSignal.timeout(60_000)]),
            })
            if (response.status === 404 || response.status === 410) {
              warnings.push(`${asset.category}/${asset.filename}: unavailable (HTTP ${response.status})`)
              return
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const received = Buffer.from(await response.arrayBuffer())
            if (!isPng(received)) throw new Error('Invalid PNG image')
            data = received
            break
          } catch (error) {
            if (options.signal.aborted) throw error
            if (attempt === 2) throw error
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
          }
        }
        if (!data) throw new Error('Download yielded no image')
        await mkdir(directory, { recursive: true })
        temporary = `${path}.${process.pid}.${index}.part`
        await writeFile(temporary, data, { flag: 'wx' })
        if (options.signal.aborted)
          throw new DOMException('Artwork download cancelled', 'AbortError')
        await rename(temporary, path)
        temporary = null
      } catch (error) {
        if (options.signal.aborted) throw error
        warnings.push(`${asset.category}/${asset.filename}: ${String(error)}`)
      } finally {
        if (temporary) await rm(temporary, { force: true })
      }
    }))
    completed += batch.length
    options.onProgress(completed, assets.length)
  }
  return warnings
}
