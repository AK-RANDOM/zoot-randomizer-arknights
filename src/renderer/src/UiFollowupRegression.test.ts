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

  it('keeps Draft Rulebook portable-model preparation explicit and backend-compatible', () => {
    const panel = read('./DraftRulebookPanel.tsx')
    const rulebook = read('./DraftRulebookRulebookEditor.tsx')
    const compatibility = read('./DraftRulebookCompatibility.css')
    const probability = read('./DraftRulebookProbabilityEditor.tsx')
    const pricing = read('./DraftRulebookPricingEditor.tsx')
    const variables = read('./DraftRulebookVariablesEditor.tsx')

    expect(panel).toContain("{ id: 'rulebook', label: 'Rulebook' }")
    expect(panel).toContain("{ id: 'pool', label: 'Pool' }")
    expect(panel).toContain("{ id: 'variables', label: 'Variables' }")
    expect(panel).toContain("{ id: 'probability', label: 'Probability' }")
    expect(panel).toContain("{ id: 'pricing', label: 'Pricing' }")
    expect(panel).toContain("{ id: 'interactions', label: 'Interactions' }")
    expect(rulebook).toContain('rulebook-rulebook-compat')
    expect(compatibility).toContain(':has(.rulebook-distribution-editor)')
    expect(compatibility).not.toContain(':last-child')
    expect(probability).toContain('draft.generalRules.pullDistribution = nextDistribution')
    expect(pricing).toContain('<DraftRulebookOverridesEditor')
    expect(pricing).toContain('<DraftPricingProfileEditor')
    expect(variables).toContain('read-only until the portable Rulebook runtime is finalized')
  })

  it('keeps Standard squad icon framing and randomize animation consistent', () => {
    const theme = read('./RendererTheme.css')
    const indicator = read('./SlotClassConstraintIndicator.css')
    const card = read('./OperatorCard.tsx')
    expect(theme).toContain('inset: -20% 0 auto;')
    expect(theme).toContain('height: 120%;')
    expect(theme).toContain('.squad-panel .bound-grid--classes .bound-class-icon {')
    expect(theme).toContain('border-color: transparent;')
    expect(theme).toContain('background: transparent;')
    expect(theme).toContain('.squad-grid .slot-locked-card .operator-card--portrait')
    expect(theme).not.toContain(
      '.squad-grid .slot-locked-card .slot-class-constraint-indicator.is-left',
    )
    expect(indicator).toContain('.slot-class-constraint-indicator.is-left { left: 8px; }')
    expect(indicator).toContain('.squad-slot > .slot-class-constraint-indicator {\n  top: 11px;')
    expect(indicator).toContain(
      '.squad-slot > .slot-class-constraint-indicator.is-left {\n  left: 11px;',
    )
    expect(card).toContain('setRandomizeReplayKey((current) => current + 1)')
    expect(card).toContain("target.closest('.squad-panel .randomize-button')")
  })
})
