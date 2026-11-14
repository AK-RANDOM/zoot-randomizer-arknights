import { afterEach, describe, expect, it } from 'vitest'
import { loadOperatorArtwork, saveOperatorArtwork } from './rendererPersistence'

function createStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(seed))

  return {
    get length() {
      return values.size
    },
    clear(): void {
      values.clear()
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null
    },
    key(index: number): string | null {
      return [...values.keys()][index] ?? null
    },
    removeItem(key: string): void {
      values.delete(key)
    },
    setItem(key: string, value: string): void {
      values.set(key, String(value))
    },
  }
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

function installWindow(storage: Storage): void {
  const fakeWindow = { localStorage: storage }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  })
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

describe('operator artwork preference', () => {
  it('persists E1/E2 selection and reads it back across calls', () => {
    const storage = createStorage()
    installWindow(storage)

    expect(loadOperatorArtwork()).toBe('e2')

    saveOperatorArtwork('e1')
    expect(loadOperatorArtwork()).toBe('e1')

    saveOperatorArtwork('e2')
    expect(loadOperatorArtwork()).toBe('e2')
  })

  it('keeps artwork preference storage isolated from squad/randomizer preferences', () => {
    const squadPresets = JSON.stringify({ version: 1, presets: [{ id: 'user:test' }] })
    const storage = createStorage({
      'arknights-randomizer:squad-presets:v1': squadPresets,
      'arknights-randomizer:dismiss-bound-reset-warning': '1',
    })
    installWindow(storage)

    saveOperatorArtwork('e1')

    expect(storage.getItem('arknights-randomizer:squad-presets:v1')).toBe(squadPresets)
    expect(storage.getItem('arknights-randomizer:dismiss-bound-reset-warning')).toBe('1')
    expect(storage.length).toBe(3)
    expect(loadOperatorArtwork()).toBe('e1')
  })
})
