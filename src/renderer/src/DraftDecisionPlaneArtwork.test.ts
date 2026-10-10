import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./DraftDecisionPlane.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./DraftDecisionPlane.css', import.meta.url), 'utf8')

describe('Draft Hold and Forfeit artwork', () => {
  it('renders dedicated artwork on the empty Hold and Forfeit cards', () => {
    expect(source).toContain('<DraftActionArtwork variant="hold" />')
    expect(source).toContain('<DraftActionArtwork variant="forfeit" />')
    expect(source).toContain('className="draft-action-artwork"')
  })

  it('keeps the artwork decorative and behind card content', () => {
    expect(source).toContain('aria-hidden="true"')
    expect(styles).toContain('.draft-action-artwork {')
    expect(styles).toContain('pointer-events: none;')
    expect(styles).toContain(
      '.draft-forfeit-surface__body {\n  position: relative;\n  z-index: 2;',
    )
    expect(styles).toContain(
      '.draft-hold-surface__body {\n  position: relative;\n  z-index: 2;',
    )
  })
})
