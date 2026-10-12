import { describe, expect, it } from 'vitest'
import { buildOverlappedRarityStars } from './RandomOperatorCard'

describe('buildOverlappedRarityStars', () => {
  it('hides stars without a rarity constraint', () => {
    expect(buildOverlappedRarityStars([])).toEqual([])
  })

  it.each([
    [
      [1, 6],
      [1, 6, 6, 6, 6, 6],
    ],
    [
      [1, 2, 4],
      [1, 2, 4, 4],
    ],
    [
      [4, 6],
      [4, 4, 4, 4, 6, 6],
    ],
    [
      [2, 5],
      [2, 2, 5, 5, 5],
    ],
  ] as const)('layers lower selected rarities over higher ones: %j', (selected, expected) => {
    expect(buildOverlappedRarityStars(selected)).toEqual(expected)
  })
})
