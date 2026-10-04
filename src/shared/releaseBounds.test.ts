import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import type { Operator } from './operator'
import {
  applyCustomReleaseDate,
  applyReleaseGroupSelection,
  getReleaseGroupBounds,
  releaseGroupLabel,
  releaseGroupSelectValue,
  releaseRangeIsValid,
  remapReleaseConstraintServer,
} from './releaseBounds'

function operator(
  id: string,
  globalDate: string,
  globalYear: number,
  cnDate: string,
  cnYear: number,
): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'test', name: 'Test' },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: {
      global: { date: globalDate, yearGroup: globalYear },
      cn: { date: cnDate, yearGroup: cnYear },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }
}

const currentOperators = [
  operator('global-current', '2026-09-16', 7, '2026-04-20', 7),
  operator('cn-current', '2026-08-10', 7, '2026-09-03', 8),
]

describe('release group bounds', () => {
  it('uses launch day as the one-day Launch group', () => {
    expect(getReleaseGroupBounds(currentOperators, 'global', 0)).toEqual({
      start: '2020-01-16',
      end: '2020-01-16',
    })
    expect(getReleaseGroupBounds(currentOperators, 'cn', 0)).toEqual({
      start: '2019-05-01',
      end: '2019-05-01',
    })
    expect(releaseGroupLabel(0)).toBe('Launch')
  })

  it('uses region-specific anniversary boundaries', () => {
    expect(getReleaseGroupBounds(currentOperators, 'global', 1)).toEqual({
      start: '2020-01-17',
      end: '2020-12-29',
    })
    expect(getReleaseGroupBounds(currentOperators, 'global', 4)).toEqual({
      start: '2023-01-13',
      end: '2024-01-15',
    })
    expect(getReleaseGroupBounds(currentOperators, 'cn', 1)).toEqual({
      start: '2019-05-02',
      end: '2020-04-30',
    })
    expect(getReleaseGroupBounds(currentOperators, 'cn', 4)).toEqual({
      start: '2022-05-01',
      end: '2023-04-30',
    })
  })

  it('uses the latest known release for the open-ended current group', () => {
    expect(getReleaseGroupBounds(currentOperators, 'global', 7)).toEqual({
      start: '2026-01-16',
      end: '2026-09-16',
    })
    expect(getReleaseGroupBounds(currentOperators, 'cn', 8)).toEqual({
      start: '2026-05-01',
      end: '2026-09-03',
    })
  })
})

describe('release bound state synchronization', () => {
  it('prefills minimum and maximum dates from named groups', () => {
    const base = createDefaultConstraints().release
    const withMinimum = applyReleaseGroupSelection(base, 'min', 4, currentOperators)
    const withMaximum = applyReleaseGroupSelection(withMinimum, 'max', 6, currentOperators)

    expect(withMaximum.minYear).toBe(4)
    expect(withMaximum.minDate).toBe('2023-01-13')
    expect(withMaximum.maxYear).toBe(6)
    expect(withMaximum.maxDate).toBe('2026-01-15')
  })

  it('turns a manually edited bound into Custom and Any when cleared', () => {
    const grouped = applyReleaseGroupSelection(
      createDefaultConstraints().release,
      'min',
      4,
      currentOperators,
    )
    const custom = applyCustomReleaseDate(grouped, 'min', '2023-06-01')
    const cleared = applyCustomReleaseDate(custom, 'min', '')

    expect(custom.minYear).toBeNull()
    expect(custom.minDate).toBe('2023-06-01')
    expect(releaseGroupSelectValue(custom.minYear, custom.minDate)).toBe('custom')
    expect(releaseGroupSelectValue(cleared.minYear, cleared.minDate)).toBe('')
  })

  it('recalculates named group dates when metadata region changes', () => {
    let release = createDefaultConstraints().release
    release = applyReleaseGroupSelection(release, 'min', 4, currentOperators)
    release = applyReleaseGroupSelection(release, 'max', 6, currentOperators)

    const cn = remapReleaseConstraintServer(release, 'cn', currentOperators)
    expect(cn.server).toBe('cn')
    expect(cn.minYear).toBe(4)
    expect(cn.minDate).toBe('2022-05-01')
    expect(cn.maxYear).toBe(6)
    expect(cn.maxDate).toBe('2025-04-30')

    const globalAgain = remapReleaseConstraintServer(cn, 'global', currentOperators)
    expect(globalAgain.minDate).toBe('2023-01-13')
    expect(globalAgain.maxDate).toBe('2026-01-15')
  })

  it('keeps Custom dates authoritative across metadata-region changes', () => {
    let release = createDefaultConstraints().release
    release = applyCustomReleaseDate(release, 'min', '2024-02-03')
    release = applyReleaseGroupSelection(release, 'max', 6, currentOperators)

    const cn = remapReleaseConstraintServer(release, 'cn', currentOperators)
    expect(cn.minYear).toBeNull()
    expect(cn.minDate).toBe('2024-02-03')
    expect(cn.maxDate).toBe('2025-04-30')
  })

  it('accepts equal dates and rejects reversed ranges', () => {
    const base = createDefaultConstraints().release
    expect(releaseRangeIsValid({ ...base, minDate: '2025-01-01', maxDate: '2025-01-01' })).toBe(true)
    expect(releaseRangeIsValid({ ...base, minDate: '2025-01-02', maxDate: '2025-01-01' })).toBe(false)
    expect(releaseRangeIsValid({ ...base, minDate: '', maxDate: '2025-01-01' })).toBe(true)
  })
})
