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
    expect(session).toContain("draftOngoing ? 'Abandon' : 'Start Draft'")
    expect(app).toContain('Leaving this page will abandon the Draft')
    expect(app).toContain('DRAFT_SESSION_RESET_EVENT')
  })
})
