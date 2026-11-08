import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ReleaseDateDropdown from './ReleaseDateDropdown'
import type { ReleaseDateOption } from '../../shared/releasePreview'
import type { Operator } from '../../shared/operator'

describe('release dropdown representative', () => {
  it('defaults empty bounds to the earliest floor and latest ceiling without an Any choice', () => {
    const option = (date: string, name: string) =>
      ({
        date,
        startDate: date,
        endDate: date,
        name,
        representative: null,
        representatives: [],
        sixStar: [],
        fiveStar: [],
      }) as ReleaseDateOption
    const options = [option('2020-01-01', 'First event'), option('2020-02-01', 'Last event')]
    const floor = renderToStaticMarkup(
      createElement(ReleaseDateDropdown, {
        label: 'Floor',
        options,
        value: '',
        side: 'min',
        server: 'global',
        onChange: () => true,
      }),
    )
    const ceiling = renderToStaticMarkup(
      createElement(ReleaseDateDropdown, {
        label: 'Ceiling',
        options,
        value: '',
        side: 'max',
        server: 'global',
        onChange: () => true,
      }),
    )
    expect(floor).toContain('First event')
    expect(ceiling).toContain('Last event')
    expect(floor + ceiling).not.toContain('Any release')
  })
  it('shows one icon even when the preview box has multiple representatives', () => {
    const first = { id: 'first', name: 'First', rarity: 5 } as Operator
    const second = { id: 'second', name: 'Second', rarity: 4 } as Operator
    const option = {
      date: '2020-01-01',
      startDate: '2020-01-01',
      endDate: '2020-01-01',
      name: 'Event name',
      representative: first,
      representatives: [first, second],
      sixStar: [],
      fiveStar: [first],
    } as ReleaseDateOption
    const html = renderToStaticMarkup(
      createElement(ReleaseDateDropdown, {
        label: 'Release',
        options: [option],
        value: option.date,
        side: 'min',
        server: 'global',
        onChange: () => true,
      }),
    )
    expect(html.match(/class="garrison-event-helper-avatar"/g)).toHaveLength(1)
    expect(html).toContain('Event name')
  })
})
