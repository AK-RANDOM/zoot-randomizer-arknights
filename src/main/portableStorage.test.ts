import { describe, expect, it } from 'vitest'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureWritableDirectory, resolvePortableDataPath } from './portableStorage'

describe('portable storage', () => {
  it('resolves alongside packaged executable even without NSIS portable environment', () => {
    expect(
      resolvePortableDataPath({
        isPackaged: true,
        executablePath: '/opt/Randomizer/Arknights Randomizer.exe',
      }),
    ).toBe('/opt/Randomizer/Arknights-Randomizer-Data')
  })

  it('uses the provided portable executable directory when present', () => {
    expect(
      resolvePortableDataPath({
        isPackaged: true,
        executablePath: '/other/app',
        portableExecutableDir: '/portable',
      }),
    ).toBe('/portable/Arknights-Randomizer-Data')
  })

  it('does not redirect development builds', () => {
    expect(
      resolvePortableDataPath({ isPackaged: false, executablePath: '/dev/electron' }),
    ).toBeNull()
  })

  it('creates and validates a writable directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'ak-portable-'))
    try {
      const data = join(root, 'nested', 'data')
      ensureWritableDirectory(data)
      expect(existsSync(data)).toBe(true)
      expect(ensureWritableDirectory(data)).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
