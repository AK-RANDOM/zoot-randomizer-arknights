import { describe, expect, it } from 'vitest'
import { normalizePersistedRaceFilter } from './raceFilterStorage'

describe('M6 Race filter persistence', () => {
  it('normalizes and deduplicates stable Race exclusions', () => {
    expect(
      normalizePersistedRaceFilter({
        version: 1,
        excludedIds: ['race:cn:a', 'race:cn:a', '', 7, ' race:cn:b '],
      }),
    ).toEqual({
      version: 1,
      excludedIds: ['race:cn:a', 'race:cn:b'],
    })
  })

  it('falls back safely from unknown persisted versions', () => {
    expect(normalizePersistedRaceFilter({ version: 99, excludedIds: ['race:cn:a'] })).toEqual({
      version: 1,
      excludedIds: [],
    })
  })
})
