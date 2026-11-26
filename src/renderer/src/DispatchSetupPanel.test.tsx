import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DispatchSetupPanel from './DispatchSetupPanel'

describe('Dispatch setup panel', () => {
  it('renders summaries and primary actions independently of collapsible settings', () => {
    const html = renderToStaticMarkup(
      <DispatchSetupPanel
        mode="standard"
        summary={<strong>No constraint</strong>}
        actions={<button>Randomize</button>}
        secondaryActions={<button>Clear squad</button>}
        submenu={<span>Constraints</span>}
      >
        <select aria-label="Squad preset">
          <option>No constraint</option>
        </select>
      </DispatchSetupPanel>,
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(
      /class="dispatch-setup__actions">.*<button>Randomize<\/button><\/div><\/div><div class="dispatch-setup__settings"[^>]*>.*Squad preset/,
    )
    expect(html.indexOf('Clear squad')).toBeLessThan(html.indexOf('Edit setup'))
    expect(html.indexOf('Edit setup')).toBeLessThan(html.indexOf('Randomize'))
    expect(html).toContain('No constraint</strong>')
    const controlledIds = html.match(/aria-controls="([^"]+)"/)![1].split(' ')
    for (const id of controlledIds) expect(html).toContain(`id="${id}"`)
  })

  it('keeps disabled primary actions visible without adding a duplicate attention notice', () => {
    const html = renderToStaticMarkup(
      <DispatchSetupPanel
        mode="draft"
        summary="Draft"
        actions={<button disabled>Start Draft</button>}
      >
        <span>Rulebook settings</span>
      </DispatchSetupPanel>,
    )
    expect(html).not.toContain('Setup needs attention')
    expect(html).toContain('<button disabled="">Start Draft</button>')
  })
})
