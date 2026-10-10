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

  it('moves preset and run controls with grid placement instead of absolute positioning', () => {
    expect(layoutCss).toContain('.squad-panel > .preset-toolbar')
    expect(layoutCss).toContain('.preset-actions > button:nth-child(1)')
    expect(layoutCss).toContain('.preset-actions > button:nth-child(2)')
    expect(layoutCss).toContain('.section-heading .randomize-button')
    expect(layoutCss).toContain('.section-heading .secondary-button')
    expect(layoutCss).not.toContain('position: absolute')
    expect(mainSource).toContain("import './StandardSquadLayoutOverrides.css'")
  })

  it('places Reset Constraints on the same grid row as Current constraints', () => {
    expect(layoutCss).toContain('.squad-panel > .current-constraint-summary')
    expect(layoutCss).toContain('.section-heading .danger-button')
    expect(layoutCss).toContain('grid-row: 2')
  })

  it('centers the Standard 6x2 grid', () => {
    expect(layoutCss).toContain('.squad-panel > .squad-grid')
    expect(layoutCss).toContain('width: min(100%, 1080px)')
    expect(layoutCss).toContain('margin-inline: auto')
  })
})
