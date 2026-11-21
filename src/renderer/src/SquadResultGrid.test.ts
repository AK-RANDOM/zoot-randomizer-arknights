import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Operator } from '../../shared/operator'
import SquadResultGrid from './SquadResultGrid'
import type { SquadShareResult } from './squadShare'

vi.mock('./OperatorCard', () => ({
  default: ({
    operator,
    showPersonalProgression,
    scrollName,
  }: {
    operator: Operator
    showPersonalProgression: boolean
    scrollName: boolean
  }) =>
    createElement('article', {
      'data-operator': operator.id,
      'data-progression': String(showPersonalProgression),
      'data-scroll-name': String(scrollName),
    }),
}))

const member = (id: string) => ({ id, name: id }) as Operator
const result = (members: Operator[], overflowStart: number): SquadShareResult => ({
  mode: 'Draft Mode',
  generatedAt: new Date('2026-11-21T00:00:00Z'),
  members,
  overflowStart,
})

describe('shared finalized squad grid', () => {
  it('keeps permanent members first, blanks in between, and overflow in slot 12', () => {
    const html = renderToStaticMarkup(
      createElement(SquadResultGrid, {
        result: result([member('Permanent'), member('Overflow')], 1),
      }),
    )
    expect(html).toContain('Squad slot 1: Permanent')
    expect(html).toContain('Squad slot 2: empty')
    expect(html).toContain('Squad slot 11: empty')
    expect(html).toContain('Squad slot 12: Overflow (Overflow)')
    expect(html.match(/class="squad-result-empty"/g)).toHaveLength(10)
    expect(html).toContain('squad-result-slot--overflow')
    expect(html).toContain('class="squad-result-overflow">Overflow</span>')
  })

  it('preserves multiple overflow members in the trailing slots', () => {
    const html = renderToStaticMarkup(
      createElement(SquadResultGrid, {
        result: result([member('Permanent'), member('First'), member('Second')], 1),
      }),
    )
    expect(html).toContain('Squad slot 11: First (Overflow)')
    expect(html).toContain('Squad slot 12: Second (Overflow)')
    expect(html.match(/data-operator=/g)).toHaveLength(3)
  })

  it('shows account progression on screen while preserving the image export privacy behavior', () => {
    const squad = result([member('Permanent')], 1)
    const screen = renderToStaticMarkup(createElement(SquadResultGrid, { result: squad }))
    const image = renderToStaticMarkup(
      createElement(SquadResultGrid, { result: squad, forImage: true }),
    )
    expect(screen).toContain('data-progression="true"')
    expect(screen).toContain('data-scroll-name="true"')
    expect(image).toContain('data-progression="false"')
    expect(image).toContain('data-scroll-name="false"')
    expect(image).toContain('squad-share-grid')
  })
})
