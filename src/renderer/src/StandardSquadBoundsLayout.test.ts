import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const featureSource = readFileSync(new URL('./StandardSquadFeature.tsx', import.meta.url), 'utf8')
const featureStyles = readFileSync(new URL('./StandardSquadFeature.css', import.meta.url), 'utf8')
const boundPillSource = readFileSync(new URL('./BoundPill.tsx', import.meta.url), 'utf8')

describe('Standard Squad bounds layout structure', () => {
  it('keeps rarity, aggregate rarity, and class bounds as three sibling fieldsets', () => {
    const layoutStart = featureSource.indexOf('<div className="squad-bounds-layout">')
    const layoutEnd = featureSource.indexOf('</div>\n        </div>\n      </details>', layoutStart)
    const layoutSource = featureSource.slice(layoutStart, layoutEnd)

    expect(layoutStart).toBeGreaterThanOrEqual(0)
    expect(layoutSource.match(/<fieldset/g)).toHaveLength(3)
    expect(layoutSource).toContain('<legend>Rarity bounds</legend>')
    expect(layoutSource).toContain('<legend>Aggregate rarity group</legend>')
    expect(layoutSource).toContain('squad-bound-group--classes')
  })

  it('does not restore the obsolete nested-rarity first-child override', () => {
    expect(featureStyles).not.toContain('.squad-bounds-layout > .squad-bound-group:first-child')
    expect(featureStyles).toContain('.squad-bound-group--classes {\n  grid-column: 1 / -1;')
  })

  it('closes the previously active bound popover before opening another', () => {
    expect(boundPillSource).toContain('let activeBoundPopover: ActiveBoundPopover | null = null')
    expect(boundPillSource).toContain('activeBoundPopover?.close()')
    expect(boundPillSource).toContain('activeBoundPopover = { token: instanceToken, close: closePopover }')
  })

  it('only persists a bound draft from the explicit Save action', () => {
    expect(boundPillSource).toContain('onSave(draft)')
    expect(boundPillSource.match(/onSave\(/g)).toHaveLength(1)
    expect(boundPillSource).not.toContain('onSave(resolved)')
    expect(boundPillSource).toContain('<button type="button" className="secondary-button" onClick={closePopover}>')
  })
})
