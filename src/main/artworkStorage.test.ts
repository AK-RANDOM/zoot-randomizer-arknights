import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
let cacheRoot = '/tmp'
let isPackaged = false
vi.mock('electron', () => ({
  app: {
    getPath: () => cacheRoot,
    get isPackaged() {
      return isPackaged
    },
  },
  shell: { openPath: async () => '' },
}))
import { getArtworkStorageInfo, clearDownloadedArtwork } from './artworkStorage'

describe('artwork cache accounting and cleanup', () => {
  it('warns only when a portable build actually falls back to profile storage', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ak-artwork-portable-'))
    const previousRoot = cacheRoot
    isPackaged = true
    vi.stubEnv('PORTABLE_EXECUTABLE_DIR', root)
    try {
      cacheRoot = join(root, 'Arknights-Randomizer-Data')
      const portable = await getArtworkStorageInfo()
      expect(portable.path).toBe(join(cacheRoot, 'operator-data'))
      expect(portable.warning).toBeUndefined()

      cacheRoot = join(root, 'profile')
      expect((await getArtworkStorageInfo()).warning).toContain('Windows user profile')
    } finally {
      cacheRoot = previousRoot
      isPackaged = false
      vi.unstubAllEnvs()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('includes operator-data/images and clears only downloaded artwork categories', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ak-artwork-test-'))
    cacheRoot = root
    try {
      const images = join(root, 'operator-data', 'images')
      mkdirSync(images, { recursive: true })
      writeFileSync(join(images, 'operator.png'), Buffer.from('image payload'))
      writeFileSync(join(root, 'operator-data', 'operators.json'), '{}')
      const before = await getArtworkStorageInfo()
      expect(before.totalFiles).toBe(1)
      expect(before.categories.find((category) => category.name === 'images')?.files).toBe(1)
      const after = await clearDownloadedArtwork()
      expect(after.totalFiles).toBe(0)
      expect(existsSync(join(root, 'operator-data', 'operators.json'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
