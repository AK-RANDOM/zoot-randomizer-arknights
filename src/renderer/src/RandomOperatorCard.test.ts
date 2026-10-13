import { readFileSync } from 'node:fs'
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

describe('Standard placeholder card alignment', () => {
  const css = readFileSync(new URL('./RandomOperatorCard.css', import.meta.url), 'utf8')

  it('compensates the constrained 3px frame so caption content matches portrait cards', () => {
    expect(css).toContain('.random-operator-card.is-constrained .random-operator-card__caption')
    expect(css).toContain('right: 8px')
    expect(css).toContain('bottom: 8px')
    expect(css).toContain('left: 8px')
  })

  it('anchors Unavailable text to the disabled card box itself', () => {
    const disabledStart = css.indexOf('.squad-grid .disabled-slot {')
    const disabledEnd = css.indexOf('}', disabledStart)
    const disabledRule = css.slice(disabledStart, disabledEnd)

    expect(disabledStart).toBeGreaterThanOrEqual(0)
    expect(disabledRule).toContain('position: relative')
  })
})
