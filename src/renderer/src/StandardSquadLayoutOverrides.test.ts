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
const lockedSource = readFileSync(new URL('./LockedSlotCard.tsx', import.meta.url), 'utf8')
const sharedCss = readFileSync(new URL('./PresentationPreferences.css', import.meta.url), 'utf8')
const randomCss = readFileSync(new URL('./RandomOperatorCard.css', import.meta.url), 'utf8')
const operatorCss = readFileSync(new URL('./OperatorCard.css', import.meta.url), 'utf8')
const lockedCss = readFileSync(new URL('./LockedSlotCard.css', import.meta.url), 'utf8')
const themeCss = readFileSync(new URL('./RendererTheme.css', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')

describe('Standard Squad layout refinements', () => {
  it('keeps the 8% rarity wash behind selected Standard and Draft operator artwork', () => {
    expect(sharedCss).toContain('.squad-grid .operator-card--portrait .operator-card__art,')
    expect(sharedCss).toContain(
      '.draft-decision-offer-grid .operator-card--portrait .operator-card__art {',
    )
    expect(sharedCss).toContain('background: color-mix(in srgb, var(--rarity-color) 8%, #171719)')
    expect(sharedCss).not.toContain('.operator-card--portrait::before')
    expect(sharedCss).not.toContain('.random-operator-card::before')
    expect(sharedCss).not.toContain('.disabled-slot::before')
  })

  it('uses one exact visual shell for operator icons, slot numbers, and constraints', () => {
    expect(sharedCss).toContain('.operator-card--portrait .operator-card__class-icon,')
    expect(sharedCss).toContain('.random-operator-card > .slot-config-number,')
    expect(sharedCss).toContain('.squad-grid .disabled-slot > .slot-config-number,')
    expect(sharedCss).toContain('.slot-class-constraint-item .class-icon,')
    expect(sharedCss).toContain('.slot-class-constraint-overflow {')
    expect(sharedCss).toContain('width: 30px')
    expect(sharedCss).toContain('height: 30px')
    expect(sharedCss).toContain('padding: 0')
    expect(sharedCss).toContain('border: 1px solid rgba(255, 255, 255, 0.24)')
    expect(sharedCss).toContain('border-radius: 6px')
    expect(sharedCss).toContain('background: rgba(7, 7, 9, 0.58)')
    expect(sharedCss).toContain('box-shadow: 0 2px 9px rgba(0, 0, 0, 0.26)')
    expect(sharedCss).toContain('backdrop-filter: blur(5px)')
    expect(sharedCss).toContain('.operator-card--portrait .operator-card__class-icon img,')
    expect(sharedCss).toContain('.slot-class-constraint-item .class-icon img {')
    expect(sharedCss).toContain('width: 23px')
    expect(sharedCss).toContain('height: 23px')
  })

  it('keeps all Standard marker positions on the selected-operator reference', () => {
    expect(sharedCss).toContain(
      '.operator-card--portrait .operator-card__class-icon {\n  top: 8px;\n  left: 8px;',
    )
    expect(randomCss).toContain('.random-operator-card > .slot-config-number')
    expect(randomCss).toContain('.squad-grid .disabled-slot > .slot-config-number')
    expect(randomCss).toContain('top: 8px')
    expect(randomCss).toContain('left: 8px')
    expect(indicatorCss).toContain('top: 8px')
    expect(indicatorCss).toContain('.slot-class-constraint-indicator.is-left { left: 8px; }')
    expect(indicatorCss).toContain('.squad-slot > .slot-class-constraint-indicator {\n  top: 11px;')
    expect(indicatorCss).toContain('.squad-slot > .slot-class-constraint-indicator.is-left {\n  left: 11px;')
    expect(indicatorCss).toContain('width: 30px')
    expect(indicatorCss).toContain('height: 30px')
    expect(indicatorCss).toContain('flex: 0 0 30px')
    expect(indicatorCss).toContain('right: -4px')
    expect(indicatorCss).not.toContain('left: -4px')
    expect(indicatorCss).not.toContain('.slot-class-constraint-item.is-subfiltered .class-icon')
    expect(themeCss).not.toContain(
      '.squad-grid .operator-card--portrait .operator-card__class-icon',
    )
  })

  it('keeps Random Operator, constrained, and Unavailable captions on one reference inset', () => {
    expect(sharedCss).toContain('.operator-card--portrait .operator-card__caption,')
    expect(sharedCss).toContain('.random-operator-card__caption,')
    expect(sharedCss).toContain('.squad-grid .disabled-slot > span:not(.slot-config-number) {')
    expect(sharedCss).toContain('right: 10px')
    expect(sharedCss).toContain('bottom: 10px')
    expect(sharedCss).toContain('left: 10px')
    expect(sharedCss).toContain('.operator-card--portrait .operator-card__caption strong,')
    expect(sharedCss).toContain('.random-operator-card__caption strong,')
    expect(sharedCss).toContain('font-size: clamp(0.72rem, 1.2vw, 0.94rem)')
    expect(sharedCss).toContain('font-weight: 900')
    expect(sharedCss).toContain('line-height: 1.12')
    expect(randomCss).not.toContain('.random-operator-card.is-constrained .random-operator-card__caption')
    expect(randomCss).toContain('letter-spacing: -0.055em')
    expect(randomCss).toMatch(/\.random-operator-card__star\s*\{[^}]*display:\s*inline;/s)
    expect(randomCss).not.toContain('display: flex')
    expect(randomCss).not.toContain('margin-right: -0.055em')
    expect(randomCss).not.toContain('-webkit-text-stroke: 1.2px')
    expect(operatorCss).toContain(
      '.operator-card--portrait .operator-card__name-viewport,\n.random-operator-card .operator-card__name-viewport {',
    )
    expect(operatorCss).toContain(
      '.operator-card--portrait .operator-card__caption strong,\n.random-operator-card .operator-card__caption strong {',
    )
    expect(operatorCss).toContain(
      '.operator-card--portrait .operator-card__name-text,\n.random-operator-card .operator-card__name-text {',
    )
  })

  it('removes late overrides that previously split Standard marker geometry', () => {
    expect(themeCss).not.toContain('.squad-grid .slot-config-number {')
    expect(themeCss).not.toContain('.squad-grid .slot-class-constraint-indicator {')
    expect(themeCss).not.toContain('.squad-grid .slot-locked-card .slot-class-constraint-indicator.is-left {')
    expect(lockedCss).not.toContain('.slot-config-card.is-constrained .slot-config-number {')
  })

  it('uses the same vertical class indicator component for general constraints and Amiya', () => {
    expect(featureSource).toContain('<SlotClassConstraintIndicator')
    expect(lockedSource).toContain('<SlotClassConstraintIndicator')
    expect(lockedSource).toContain("const AMIYA_CLASS_ORDER: readonly OperatorClass[] = ['Caster', 'Guard', 'Medic']")
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
    expect(toolbarSource).toContain('Clear')
    expect(toolbarSource).toContain('Randomize')
    expect(toolbarSource).toContain('disabled={squad.length === 0}')
    expect(featureSource).not.toContain('Randomize Again')
    expect(layoutCss).toContain('.preset-toolbar .preset-actions-spacer')
    expect(layoutCss).not.toContain('.section-heading .randomize-button')
    expect(mainSource).toContain("import './StandardSquadLayoutOverrides.css'")
  })

  it('keeps Reset inside the Current constraints box and always rendered', () => {
    const summaryStart = featureSource.indexOf('<div className="current-constraint-summary"')
    const summaryEnd = featureSource.indexOf('{dataset && !validation.valid', summaryStart)
    const summarySource = featureSource.slice(summaryStart, summaryEnd)

    expect(summaryStart).toBeGreaterThanOrEqual(0)
    expect(summaryEnd).toBeGreaterThan(summaryStart)
    expect(summarySource).toContain('Reset')
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
