import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
let cacheRoot = '/tmp'
vi.mock('electron', () => ({ app: { getPath: () => cacheRoot }, shell: { openPath: async () => '' } }))
import { enumerateAdditionalArtwork, getArtworkStorageInfo, clearDownloadedArtwork } from './artworkStorage'
import type { OperatorDataset } from '../shared/operator'

describe('complete artwork manifest', () => {
  it('includes and deduplicates default art, skin portraits and skin avatars', () => {
    const dataset = { operators: [
      { defaultArts: [{ avatarId: 'char_test_1' }], skins: [{ portraitId: 'skin_test', avatarId: 'skin_avatar' }] },
      { defaultArts: [{ avatarId: 'char_test_1' }], skins: [{ portraitId: 'skin_test', avatarId: 'skin_avatar' }] },
    ] } as unknown as OperatorDataset
    const assets = enumerateAdditionalArtwork(dataset)
    expect(assets).toHaveLength(3)
    expect(assets.map((a) => `${a.category}/${a.filename}`).sort()).toEqual([
      'appearance-avatars/char_test_1.png', 'skin-avatars/skin_avatar.png', 'skin-portraits/skin_test.png',
    ])
  })
  it('ignores unsafe asset IDs', () => {
    const dataset = { operators: [{ skins: [{ portraitId: '../bad', avatarId: '../../bad' }] }] } as unknown as OperatorDataset
    expect(enumerateAdditionalArtwork(dataset)).toHaveLength(0)
  })
})

describe('artwork cache accounting and cleanup', () => {
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
