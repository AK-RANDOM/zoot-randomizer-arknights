import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('Garrison stage table reorder controls', () => {
  it('supports drag/drop from a handle without blocking editing controls', () => {
    const code = read('./GarrisonSquadFeature.tsx')
    expect(code).toContain('className="garrison-stage-drag-handle"')
    expect(code).toContain('onDragStart={(event) => stageDragStart(event, stage.id)}')
    expect(code).toContain('onDragOver={(event) => stageDragOver(event, stage.id)}')
    expect(code).toContain('onDrop={(event) => stageDrop(event, stage.id)}')
    expect(code).toContain('onKeyDown={(event) => stageHandleKeyDown(event, stage.id)}')
    expect(code).toContain("event.key === 'ArrowUp' ? 'before' : 'after'")
    expect(code).toContain('applyWorkingEdit(next)')
    expect(code).toContain('disabled={stageEditor !== null || conflictDraft !== null}')
  })

  it('shows drop indicators and disables the handle while editing', () => {
    const css = read('./GarrisonSquadFeature.css')
    expect(css).toContain('.garrison-stage-row.is-drop-before')
    expect(css).toContain('.garrison-stage-row.is-drop-after')
    expect(css).toContain('.garrison-stage-drag-handle:disabled')
  })
})
