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
  const sharedCss = readFileSync(new URL('./PresentationPreferences.css', import.meta.url), 'utf8')

  it('uses the same caption inset for constrained and unconstrained placeholders', () => {
    expect(css).toContain('.random-operator-card__caption {')
    expect(sharedCss).toContain('.operator-card--portrait .operator-card__caption,')
    expect(sharedCss).toContain('.random-operator-card__caption,')
    expect(sharedCss).toContain('right: 10px')
    expect(sharedCss).toContain('bottom: 10px')
    expect(sharedCss).toContain('left: 10px')
    expect(css).not.toContain('.random-operator-card.is-constrained .random-operator-card__caption')
  })

  it('anchors Unavailable text to the disabled card box itself', () => {
    const disabledStart = css.indexOf('.squad-grid .disabled-slot {')
    const disabledEnd = css.indexOf('}', disabledStart)
    const disabledRule = css.slice(disabledStart, disabledEnd)

    expect(disabledStart).toBeGreaterThanOrEqual(0)
    expect(disabledRule).toContain('position: relative')
  })
})
