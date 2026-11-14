import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
let cacheRoot = '/tmp'
vi.mock('electron', () => ({
  app: { getPath: () => cacheRoot },
  shell: { openPath: async () => '' },
}))
import {
  downloadAdditionalArtwork,
  enumerateAdditionalArtwork,
  getArtworkStorageInfo,
  clearDownloadedArtwork,
} from './artworkStorage'
import { clearAvatarMemoryCaches, getOperatorAvatarAsset } from './operatorAvatarService'
import type { OperatorDataset } from '../shared/operator'

describe('complete artwork manifest', () => {
  it('includes and deduplicates default art, skin portraits and skin avatars', () => {
    const dataset = {
      operators: [
        {
          defaultArts: [{ avatarId: 'char_test_1' }],
          skins: [{ portraitId: 'skin_test', avatarId: 'skin_avatar' }],
        },
        {
          defaultArts: [{ avatarId: 'skin_avatar' }],
          skins: [{ portraitId: 'skin_test', avatarId: 'skin_avatar' }],
        },
      ],
    } as unknown as OperatorDataset
    const assets = enumerateAdditionalArtwork(dataset)
    expect(assets).toHaveLength(3)
    expect(assets.map((a) => `${a.category}/${a.filename}`).sort()).toEqual([
      'appearance-avatars/char_test_1.png',
      'appearance-avatars/skin_avatar.png',
      'skin-portraits/skin_test.png',
    ])
  })
  it('ignores unsafe asset IDs', () => {
    const dataset = {
      operators: [{ skins: [{ portraitId: '../bad', avatarId: '../../bad' }] }],
    } as unknown as OperatorDataset
    expect(enumerateAdditionalArtwork(dataset)).toHaveLength(0)
  })
})

describe('artwork cache accounting and cleanup', () => {
  it('reuses a legacy skin avatar for display and bulk downloads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ak-artwork-test-'))
    cacheRoot = root
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const png = Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex')
    try {
      const legacy = join(root, 'operator-data', 'skin-avatars')
      mkdirSync(legacy, { recursive: true })
      writeFileSync(join(legacy, 'shared_avatar.png'), png)
      const dataset = {
        operators: [{ defaultArts: [{ avatarId: 'shared_avatar' }] }],
      } as unknown as OperatorDataset

      expect(await getOperatorAvatarAsset('shared_avatar')).toBe(
        `data:image/png;base64,${png.toString('base64')}`,
      )
      expect(
        await downloadAdditionalArtwork(dataset, {
          signal: new AbortController().signal,
          onProgress: vi.fn(),
        }),
      ).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
      const before = await getArtworkStorageInfo()
      expect(before.categories.find(({ name }) => name === 'skin-avatars')?.files).toBe(1)
      expect((await clearDownloadedArtwork()).totalFiles).toBe(0)
    } finally {
      fetchMock.mockRestore()
      clearAvatarMemoryCaches()
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
