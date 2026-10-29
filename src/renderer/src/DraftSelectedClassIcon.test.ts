import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./DraftSquadGrid.css', import.meta.url), 'utf8')

describe('Draft selected operator class icon', () => {
  it('keeps the class icon small, frameless, and inline with the operator name', () => {
    expect(styles).toContain('gap: 3px;')
    expect(styles).toContain(
      '.draft-squad-avatar__identity .draft-squad-avatar__class-icon {\n  display: block;\n  flex: 0 0 1em;\n  width: 1em;\n  height: 1em;',
    )
    expect(styles).toContain('padding: 0;')
    expect(styles).toContain('border: 0;')
    expect(styles).toContain('background: transparent;')
    expect(styles).toContain('box-shadow: none;')
    expect(styles).toContain(
      '.draft-squad-avatar__identity .draft-squad-avatar__class-icon img {\n  display: block;\n  width: 1em;\n  height: 1em;',
    )
  })
})
