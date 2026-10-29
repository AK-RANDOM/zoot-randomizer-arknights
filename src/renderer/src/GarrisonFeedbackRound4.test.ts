import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const source = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison operator picker and overview review refinements', () => {
  it('uses Add Operator / Modify Operator without slot numbers', () => {
    const sourceCode = source('./GarrisonStageEditor.tsx')
    expect(sourceCode).toContain("{editingOperatorId ? 'Modify Operator' : 'Add Operator'}")
    expect(sourceCode).not.toContain('slot {editingSlotIndex + 1}')
  })

  it('places the unavailable reason immediately before the class icon, without an avatar gap', () => {
    const selector = source('./OperatorSelectorBase.tsx')
    const css = source('./OperatorSelector.css')
    const garrison = source('./GarrisonStageEditor.tsx')
    expect(selector.indexOf('<OperatorAvatar operator={option.operator} />')).toBeLessThan(
      selector.indexOf('operator-selector-availability-warning'),
    )
    expect(selector.indexOf('operator-selector-availability-warning')).toBeLessThan(
      selector.indexOf('<OperatorClassStack option={option} />'),
    )
    expect(css).toContain('grid-template-columns: 42px minmax(0, 1fr) auto;')
    expect(garrison).toContain("? 'Already in squad'")
    expect(garrison).toContain("? 'Alter in squad'")
    expect(garrison).toContain('`Assigned to ${stageNames.join(')
    expect(source('./OperatorSelector.tsx')).toContain("? 'Already in squad'")
    expect(source('./OperatorSelector.tsx')).toContain("'Alter in squad'")
  })

  it('uses the current accent for duplicate toggle and standard Delete font sizing', () => {
    const css = source('./GarrisonSquadFeature.css')
    expect(css).toContain('accent-color: var(--app-accent);')
    expect(css).toContain('.garrison-stage-actions .danger-button {\n  font-size: inherit;')
  })

  it('only shows participation counts while duplicates are enabled', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    expect(code).toContain('{working.duplicateOperatorsAllowed && (')
    expect(code).toContain('className="garrison-participant-count"')
    expect(code).toContain('{working.duplicateOperatorsAllowed && (')
    expect(code).toContain('{participation.length} unique')
  })
})
