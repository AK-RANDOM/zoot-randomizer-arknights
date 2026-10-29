import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./SquadConstraintEditor.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('./SquadConstraintEditorBase.tsx', import.meta.url), 'utf8')

describe('Squad constraint presentation', () => {
  it('keeps slot constraint class controls icon-only', () => {
    expect(styles).not.toContain('.slot-constraint-class-icon-button .class-icon::after {')
    expect(styles).not.toContain('content: attr(title);')
    expect(styles).toContain('width: 42px;')
  })

  it('renders the full slot reset label as a red button at normal control text size', () => {
    expect(source).toContain('Reset Constraint')
    expect(styles).toContain('.slot-editor-actions .danger-button {')
    expect(styles).toContain('background: #3a171b;')
    expect(styles).toContain('font-size: inherit;')
    expect(styles).not.toContain("content: 'Reset';")
  })
})
