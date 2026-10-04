import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultOperatorPreferences } from '../../shared/operatorPool'
import {
  OPERATOR_PREFERENCES_STORAGE_KEY,
  loadOperatorPreferences,
  saveOperatorPreferences,
} from './operatorPreferencesStorage'

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
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

describe('Iteration 6 operator preference storage', () => {
  it('uses defaults when no persisted preference exists', () => {
    installWindow(createStorage())
    expect(loadOperatorPreferences()).toEqual(createDefaultOperatorPreferences())
  })

  it('persists metadata region, Pool presentation, and explicit exclusions', () => {
    const storage = createStorage()
    installWindow(storage)

    const preferences = {
      ...createDefaultOperatorPreferences(),
      metadataRegion: 'cn' as const,
      poolPresentation: 'detailedList' as const,
      excludedOperatorIds: ['char_a', 'char_b'],
    }
    saveOperatorPreferences(preferences)

    expect(loadOperatorPreferences()).toEqual(preferences)
  })

  it('normalizes malformed persisted state rather than throwing during startup', () => {
    const storage = createStorage({
      [OPERATOR_PREFERENCES_STORAGE_KEY]: '{not valid json',
    })
    installWindow(storage)

    expect(loadOperatorPreferences()).toEqual(createDefaultOperatorPreferences())
  })

  it('keeps operator Pool preferences isolated from existing presentation and squad keys', () => {
    const artworkKey = 'arknights-randomizer:operator-artwork:v1'
    const presetKey = 'arknights-randomizer:squad-presets:v1'
    const storage = createStorage({
      [artworkKey]: 'e1',
      [presetKey]: JSON.stringify({ version: 1, presets: [] }),
    })
    installWindow(storage)

    saveOperatorPreferences({
      ...createDefaultOperatorPreferences(),
      excludedOperatorIds: ['char_test'],
    })

    expect(storage.getItem(artworkKey)).toBe('e1')
    expect(storage.getItem(presetKey)).toBe(JSON.stringify({ version: 1, presets: [] }))
    expect(storage.length).toBe(3)
  })
})
