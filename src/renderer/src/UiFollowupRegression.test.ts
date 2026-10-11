import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Standard and Draft UI follow-up', () => {
  it('centers Standard grid and uses an in-app preset naming dialog', () => {
    const layout = read('./StandardSquadLayoutOverrides.css')
    const standard = read('./StandardSquadFeature.tsx')
    expect(layout).toContain('width: min(100%, 1080px)')
    expect(layout).toContain('margin-inline: auto')
    expect(standard).toContain("mode: 'save' | 'duplicate' | 'rename'")
    expect(standard).not.toContain("window.prompt('Name this squad preset:")
    expect(standard).toContain('<TextInputDialog')
  })

  it('shrinks the whole Draft decision strip uniformly and gives Forfeit operator-card hover motion', () => {
    const view = read('./DraftDecisionPlane.tsx')
    const css = read('./DraftDecisionPlane.css')
    expect(view).toContain('const stripCardCount = offerCardCount + sideCardCount')
    expect(css).toContain('grid-template-columns: repeat(var(--draft-strip-count), minmax(0, 1fr))')
    expect(css).toContain('transform: translateY(-2px)')
    expect(css).not.toContain('outline: 2px solid #fff')
  })

  it('integrates Rulebook selection and protects active Draft navigation', () => {
    const panel = read('./DraftPanel.tsx')
    const session = read('./DraftSessionView.tsx')
    const app = read('./App.tsx')
    expect(panel).toContain('className="draft-rulebook-select"')
    expect(session).toContain("draftOngoing ? 'Finalize' : 'Start Draft'")
    expect(app).toContain('Leaving this page will abandon the Draft')
    expect(app).toContain('DRAFT_SESSION_RESET_EVENT')
  })

  it('keeps Standard squad icon framing and randomize animation consistent', () => {
    const theme = read('./RendererTheme.css')
    const card = read('./OperatorCard.tsx')
    expect(theme).toContain('inset: -20% 0 auto;')
    expect(theme).toContain('height: 120%;')
    expect(theme).toContain('.squad-panel .bound-grid--classes .bound-class-icon {')
    expect(theme).toContain('border-color: transparent;')
    expect(theme).toContain('background: transparent;')
    expect(theme).toContain('.squad-grid .slot-locked-card .operator-card--portrait')
    expect(theme).toContain(
      '.squad-grid .slot-locked-card .slot-class-constraint-indicator.is-left',
    )
    expect(theme).toContain('top: 11px;')
    expect(theme).toContain('left: 11px;')
    expect(card).toContain('setRandomizeReplayKey((current) => current + 1)')
    expect(card).toContain("target.closest('.squad-panel .randomize-button')")
  })
})
