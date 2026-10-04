import { describe, expect, it } from 'vitest'
import type { ReleaseConstraint } from './constraints'
import type { Operator } from './operator'
import { getReleaseBoundPreview } from './releasePreview'

function operator(
  id: string,
  name: string,
  rarity: 5 | 6,
  date: string,
  family: Operator['acquisition']['family'] = 'standard',
): Operator {
  return {
    id,
    name,
    rarity,
    class: 'Guard',
    subclass: { id: 'fearless', name: 'Dreadnought' },
    faction: { main: 'rhodes', affiliations: ['rhodes'] },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date, yearGroup: date === '2019-05-01' ? 0 : 1 },
      global: { date: '2020-07-01', yearGroup: 1 },
    },
    acquisition:
      family === 'limited'
        ? { family, group: 'anniversary' }
        : family === 'welfare'
          ? { family, group: 'eventStory' }
          : { family, group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/${id}.png`,
  }
}

const cnRelease: ReleaseConstraint = {
  server: 'cn',
  minYear: null,
  maxYear: null,
  minDate: '',
  maxDate: '',
}

describe('release bound previews', () => {
  it('uses the fixed launch representatives in the requested order', () => {
    const launch = [
      operator('silverash', 'SilverAsh', 6, '2019-05-01'),
      operator('eyja', 'Eyjafjalla', 6, '2019-05-01'),
      operator('specter', 'Specter', 5, '2019-05-01'),
      operator('ptilopsis', 'Ptilopsis', 5, '2019-05-01'),
      operator('lappland', 'Lappland', 5, '2019-05-01'),
      operator('other', 'Other', 6, '2019-05-01'),
      operator('later', 'Later', 6, '2019-06-01'),
    ]

    const preview = getReleaseBoundPreview(launch, cnRelease, 'min')
    expect(preview?.date).toBe('2019-05-01')
    expect(preview?.sixStar.map((item) => item.name)).toEqual(['SilverAsh', 'Eyjafjalla'])
    expect(preview?.fiveStar.map((item) => item.name)).toEqual([
      'Specter',
      'Ptilopsis',
      'Lappland',
    ])
  })

  it('never borrows representatives from another release date', () => {
    const items = [
      operator('only', 'Only Five', 5, '2020-04-01'),
      operator('next6', 'Next Six', 6, '2020-04-02'),
      operator('next5', 'Next Five', 5, '2020-04-02'),
    ]
    const preview = getReleaseBoundPreview(items, cnRelease, 'min')
    expect(preview?.date).toBe('2020-04-01')
    expect(preview?.sixStar).toEqual([])
    expect(preview?.fiveStar.map((item) => item.name)).toEqual(['Only Five'])
  })

  it('orders the same-date pool Limited before Standard before Welfare within rarity', () => {
    const items = [
      operator('welfare6', 'Welfare Six', 6, '2022-05-01', 'welfare'),
      operator('standard6', 'Standard Six', 6, '2022-05-01'),
      operator('limited6', 'Limited Six', 6, '2022-05-01', 'limited'),
      operator('welfare5', 'Welfare Five', 5, '2022-05-01', 'welfare'),
      operator('standard5', 'Standard Five', 5, '2022-05-01'),
      operator('limited5', 'Limited Five', 5, '2022-05-01', 'limited'),
    ]
    const preview = getReleaseBoundPreview(items, cnRelease, 'max')
    expect(preview?.sixStar.map((item) => item.name)).toEqual(['Limited Six', 'Standard Six'])
    expect(preview?.fiveStar.map((item) => item.name)).toEqual([
      'Limited Five',
      'Standard Five',
      'Welfare Five',
    ])
  })

  it('uses the earliest/latest actual operator event inside arbitrary date bounds', () => {
    const items = [
      operator('a', 'A', 6, '2024-02-03'),
      operator('b', 'B', 6, '2024-03-10'),
      operator('c', 'C', 6, '2024-04-11'),
    ]
    const constraint: ReleaseConstraint = {
      ...cnRelease,
      minDate: '2024-02-15',
      maxDate: '2024-04-01',
    }
    expect(getReleaseBoundPreview(items, constraint, 'min')?.date).toBe('2024-03-10')
    expect(getReleaseBoundPreview(items, constraint, 'max')?.date).toBe('2024-03-10')
  })
})