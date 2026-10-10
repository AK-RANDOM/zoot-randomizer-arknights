import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./DraftSquadGrid.css', import.meta.url), 'utf8')

describe('Draft selected operator class icon', () => {
  it('keeps the class icon small, frameless, and inline with the operator name', () => {
    expect(styles).toContain('gap: 2px;')
    expect(styles).toContain(
      '.draft-squad-avatar__class-icon {\n  display: block;\n  flex: 0 0 auto;\n  width: 10px;\n  height: 10px;',
    )
    expect(styles).toContain('border: 0;')
    expect(styles).toContain('background: transparent;')
    expect(styles).toContain('box-shadow: none;')
    expect(styles).toContain(
      '.draft-squad-avatar__class-icon img {\n  display: block;\n  width: 10px;\n  height: 10px;',
    )
  })
})
