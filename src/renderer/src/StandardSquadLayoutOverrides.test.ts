import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layoutCss = readFileSync(new URL('./StandardSquadLayoutOverrides.css', import.meta.url), 'utf8')
const indicatorCss = readFileSync(new URL('./SlotClassConstraintIndicator.css', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')

describe('Standard Squad layout refinements', () => {
  it('aligns pre-random class indicators with portrait operator-card class icons', () => {
    expect(indicatorCss).toContain('top: 8px')
    expect(indicatorCss).toContain('.slot-class-constraint-indicator.is-left { left: 8px; }')
    expect(indicatorCss).toContain('width: 30px')
    expect(indicatorCss).toContain('width: 23px')
  })

  it('moves preset and randomize controls while hiding the redundant Standard heading', () => {
    expect(layoutCss).toContain('.squad-panel > .section-heading > div:first-child')
    expect(layoutCss).toContain('display: none')
    expect(layoutCss).toContain('.preset-actions > button:nth-child(1)')
    expect(layoutCss).toContain('.preset-actions > button:nth-child(2)')
    expect(layoutCss).toContain('.section-heading .randomize-button')
    expect(mainSource).toContain("import './StandardSquadLayoutOverrides.css'")
  })

  it('places the reset control alongside the current constraint summary', () => {
    expect(layoutCss).toContain('.current-constraint-summary')
    expect(layoutCss).toContain('.section-heading .danger-button')
    expect(layoutCss).toContain('top: 111px')
  })
})
