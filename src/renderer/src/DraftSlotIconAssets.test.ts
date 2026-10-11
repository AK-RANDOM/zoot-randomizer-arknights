import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Draft and Standard slot icon assets', () => {
  it('wires custom Draft action assets for Hold and Forfeit', () => {
    const source = read('./DraftDecisionPlane.tsx')
    const styles = read('./DraftDecisionPlane.css')
    expect(source).toContain("./assets/draft/hold-icon.png")
    expect(source).toContain("./assets/draft/forfeit-icon.png")
    expect(source).toContain('className="draft-action-artwork"')
    expect(styles).toContain('object-fit: contain;')
  })

  it('uses the custom open, overflow, and locked slot icons in Current Draft', () => {
    const source = read('./DraftSquadGrid.tsx')
    const styles = read('./DraftSquadGrid.css')
    expect(source).toContain("./assets/draft/open-slot-icon.png")
    expect(source).toContain("./assets/draft/overflow-slot-icon.png")
    expect(source).toContain("./assets/draft/locked-slot-icon.png")
    expect(source).toContain('className="draft-squad-slot__icon"')
    expect(source).toContain('className="draft-squad-overflow__icon"')
    expect(styles).toContain('.draft-squad-slot__icon {')
    expect(styles).toContain('.draft-squad-overflow__icon {')
  })

  it('reuses the locked slot icon for unavailable Standard Squad slots', () => {
    const source = read('./StandardSquadFeature.tsx')
    const styles = read('./RendererTheme.css')
    expect(source).toContain('className="disabled-slot"')
    expect(styles).toContain("url('./assets/draft/locked-slot-icon.png')")
    expect(styles).toContain('.squad-grid .disabled-slot::before {')
  })
})
