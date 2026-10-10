import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./SquadConstraintEditor.css', import.meta.url), 'utf8')

describe('Squad constraint presentation', () => {
  it('shows the class name beside each class icon', () => {
    expect(styles).toContain('.slot-constraint-class-icon-button .class-icon::after {')
    expect(styles).toContain('content: attr(title);')
    expect(styles).toContain('width: auto;')
  })

  it('renders the slot reset control as a red button labelled Reset', () => {
    expect(styles).toContain('.slot-editor-actions .danger-button {')
    expect(styles).toContain('background: #3a171b;')
    expect(styles).toContain("content: 'Reset';")
  })
})
