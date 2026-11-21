import { app, shell } from 'electron'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { ArtworkStorageInfo } from '../shared/desktop'
import { LEGACY_ARTWORK_CATEGORIES } from '../shared/artwork'
import { resolvePortableDataPath } from './portableStorage'

const CATEGORIES = [...LEGACY_ARTWORK_CATEGORIES, 'shared-artwork'] as const

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
  const portableData = resolvePortableDataPath({
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    portableExecutableDir: process.env['PORTABLE_EXECUTABLE_DIR'],
  })
  return {
    path: artworkRoot(),
    warning:
      portableData && resolve(app.getPath('userData')) !== resolve(portableData)
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
  const root = resolve(artworkRoot())
  for (const category of CATEGORIES) {
    const target = resolve(root, category)
    if (!target.startsWith(root + sep)) throw new Error('Invalid artwork cache location')
    await rm(target, { recursive: true, force: true })
  }
  return getArtworkStorageInfo()
}
