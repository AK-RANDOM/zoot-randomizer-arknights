import { accessSync, constants, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const PORTABLE_DATA_DIRECTORY = 'Arknights-Randomizer-Data'

/** A raw Electron distribution has no PORTABLE_EXECUTABLE_DIR injected by electron-builder. */
export function resolvePortableDataPath(options: {
  isPackaged: boolean
  executablePath: string
  portableExecutableDir?: string
}): string | null {
  const baseDirectory =
    options.portableExecutableDir ||
    (options.isPackaged ? dirname(options.executablePath) : null)
  return baseDirectory ? join(baseDirectory, PORTABLE_DATA_DIRECTORY) : null
}

/** Verify actual file creation rather than trusting permissions flags (which can be misleading). */
export function ensureWritableDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true })
  accessSync(directory, constants.W_OK)
  const probe = join(directory, `.write-test-${process.pid}-${Date.now()}`)
  const fd = openSync(probe, 'wx')
  try {
    closeSync(fd)
  } finally {
    unlinkSync(probe)
  }
}
