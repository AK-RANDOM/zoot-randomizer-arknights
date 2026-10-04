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
  it('uses the locked four launch representative IDs even when display names are localized', () => {
    const launch = [
      operator('char_172_svrash', '银灰', 6, '2019-05-01'),
      operator('char_180_amgoat', '艾雅法拉', 6, '2019-05-01'),
      operator('char_102_texas', '德克萨斯', 5, '2019-05-01'),
      operator('char_128_plosis', '白面鸮', 5, '2019-05-01'),
      operator('char_143_ghost', '幽灵鲨', 5, '2019-05-01'),
      operator('other', 'Other', 6, '2019-05-01'),
      operator('later', 'Later', 6, '2019-06-01'),
    ]

    const preview = getReleaseBoundPreview(launch, cnRelease, 'min')
    expect(preview?.date).toBe('2019-05-01')
    expect(preview?.sixStar.map((item) => item.id)).toEqual([
      'char_172_svrash',
      'char_180_amgoat',
    ])
    expect(preview?.fiveStar.map((item) => item.id)).toEqual([
      'char_102_texas',
      'char_128_plosis',
    ])
    expect(preview?.fiveStar.some((item) => item.id === 'char_143_ghost')).toBe(false)
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
    expect(preview?.fiveStar.map((item) => item.id)).toEqual(['only'])
  })

  it('orders the same-date pool Limited before Standard before Welfare and caps each rarity at two', () => {
    const items = [
      operator('welfare6', 'A Welfare Name', 6, '2022-05-01', 'welfare'),
      operator('standard6', 'Z Standard Name', 6, '2022-05-01'),
      operator('limited6', 'M Limited Name', 6, '2022-05-01', 'limited'),
      operator('welfare5', 'A Welfare Five', 5, '2022-05-01', 'welfare'),
      operator('standard5', 'Z Standard Five', 5, '2022-05-01'),
      operator('limited5', 'M Limited Five', 5, '2022-05-01', 'limited'),
    ]
    const preview = getReleaseBoundPreview(items, cnRelease, 'max')
    expect(preview?.sixStar.map((item) => item.id)).toEqual(['limited6', 'standard6'])
    expect(preview?.fiveStar.map((item) => item.id)).toEqual(['limited5', 'standard5'])
    expect((preview?.sixStar.length ?? 0) + (preview?.fiveStar.length ?? 0)).toBeLessThanOrEqual(4)
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
