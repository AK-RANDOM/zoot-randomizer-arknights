import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layoutCss = readFileSync(
  new URL('./StandardSquadLayoutOverrides.css', import.meta.url),
  'utf8',
)
const indicatorCss = readFileSync(
  new URL('./SlotClassConstraintIndicator.css', import.meta.url),
  'utf8',
)
const featureSource = readFileSync(new URL('./StandardSquadFeature.tsx', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')

describe('Standard Squad layout refinements', () => {
  it('aligns pre-random class indicators with portrait operator-card class icons', () => {
    expect(indicatorCss).toContain('top: 8px')
    expect(indicatorCss).toContain('.slot-class-constraint-indicator.is-left { left: 8px; }')
    expect(indicatorCss).toContain('width: 30px')
    expect(indicatorCss).toContain('width: 23px')
  })

  it('keeps preset and run controls together inside the preset toolbar', () => {
    const toolbarStart = featureSource.indexOf('<div className="preset-toolbar">')
    const toolbarEnd = featureSource.indexOf(
      '<div className="current-constraint-summary"',
      toolbarStart,
    )
    const toolbarSource = featureSource.slice(toolbarStart, toolbarEnd)

    expect(toolbarStart).toBeGreaterThanOrEqual(0)
    expect(toolbarSource).toContain('<span className="preset-toolbar-label">Preset</span>')
    expect(toolbarSource).toContain('Save as preset…')
    expect(toolbarSource).toContain('Clear Squad')
    expect(toolbarSource).toContain('Randomize')
    expect(toolbarSource).toContain('disabled={squad.length === 0}')
    expect(featureSource).not.toContain('Randomize Again')
    expect(layoutCss).toContain('.preset-toolbar .preset-actions-spacer')
    expect(layoutCss).not.toContain('.section-heading .randomize-button')
    expect(mainSource).toContain("import './StandardSquadLayoutOverrides.css'")
  })

  it('keeps Reset Constraints inside the Current constraints box and always rendered', () => {
    const summaryStart = featureSource.indexOf('<div className="current-constraint-summary"')
    const summaryEnd = featureSource.indexOf('{dataset && !validation.valid', summaryStart)
    const summarySource = featureSource.slice(summaryStart, summaryEnd)

    expect(summaryStart).toBeGreaterThanOrEqual(0)
    expect(summaryEnd).toBeGreaterThan(summaryStart)
    expect(summarySource).toContain('Reset Constraints')
    expect(summarySource).toContain('disabled={!canResetConstraints}')
    expect(layoutCss).toContain('.current-constraint-summary .danger-button')
    expect(layoutCss).not.toContain('.section-heading .danger-button')
  })

  it('centers the Standard 6x2 grid', () => {
    expect(layoutCss).toContain('.squad-panel > .squad-grid')
    expect(layoutCss).toContain('width: min(100%, 1080px)')
    expect(layoutCss).toContain('margin-inline: auto')
  })
})
