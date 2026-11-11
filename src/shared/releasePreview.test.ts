import { describe, expect, it } from 'vitest'
import type { ReleaseConstraint } from './constraints'
import type { Operator, OperatorDataset } from './operator'
import {
  getReleaseBoundPreview,
  buildReleaseDateOptions,
  buildBoundaryRepresentatives,
} from './releasePreview'
import type { GarrisonEvent } from './garrisonEventCatalog'

function operator(
  id: string,
  name: string,
  rarity: Operator['rarity'],
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
  it('caps previews at seven and fills remaining places down through the lowest rarities', () => {
    const ops = [1, 2, 3, 4, 5, 6, 6, 1].map((rarity, index) =>
      operator(`op${index}`, `Operator ${index}`, rarity as Operator['rarity'], '2021-07-01'),
    )
    const dataset = { operators: ops } as OperatorDataset
    expect(buildBoundaryRepresentatives(ops).map(({ rarity }) => rarity)).toEqual([
      6, 6, 5, 4, 3, 2, 1,
    ])
    expect(getReleaseBoundPreview(ops, cnRelease, 'min')?.representatives).toEqual(
      buildBoundaryRepresentatives(ops),
    )
    const option = buildReleaseDateOptions(dataset, cnRelease, 'min')[0]
    expect(option.representatives).toEqual(buildBoundaryRepresentatives(ops))
    expect(option.representative?.id).toBe('op5')
    expect(buildBoundaryRepresentatives(ops.slice(0, 3)).map(({ rarity }) => rarity)).toEqual([
      3, 2, 1,
    ])
  })
  it.each([4, 5, 6] as const)(
    'prioritizes event tiers for %i-star preview and dropdown representatives',
    (rarity) => {
      const ops = [
        operator('login', 'Alpha', rarity, '2021-07-01', 'limited'),
        operator('game', 'Bravo', rarity, '2021-07-01'),
        operator('story', 'Zulu', rarity, '2021-07-01', 'welfare'),
        operator('low', 'Low', 3, '2021-07-01'),
      ]
      const releaseEvents = [
        { category: 'login', name: 'Login Event: Gift', operatorIds: ['login'] },
        { category: 'crisis', name: 'CC#2: Operation Blade', operatorIds: ['game'] },
        { category: 'side_story', name: 'Story', operatorIds: ['story', 'low'] },
      ].map((event) => ({ ...event, server: 'cn', date: '2021-07-01' }))
      const option = buildReleaseDateOptions(
        { operators: ops, releaseEvents } as OperatorDataset,
        cnRelease,
        'min',
        [
          {
            id: 'helper',
            name: 'Lower-tier featured helper',
            group: 'side',
            releaseTime: Date.parse('2021-07-01') / 1000,
            limitedOperatorIds: ['login'],
            stages: { standard: [], h: [], ex: [], s: [] },
          },
        ] as GarrisonEvent[],
      )[0]
      expect(option.representatives.map(({ id }) => id)).toEqual(['story', 'game', 'login', 'low'])
      expect(option.representative?.id).toBe('story')
      expect(option.name).toBe('Story / CC#2: Operation Blade / Login Event: Gift')
    },
  )
  it('removes the generic release label from shop updates even for login-like source IDs', () => {
    const op = operator('shop', 'Shop', 5, '2020-05-20', 'welfare')
    op.acquisition.group = 'redCert'
    const releaseEvents = [
      {
        id: 'act1sign',
        category: 'other',
        server: 'cn',
        date: '2020-05-20',
        name: '2020-05-20 Operator Release',
        operatorIds: [op.id],
      },
    ]
    expect(
      buildReleaseDateOptions(
        { operators: [op], releaseEvents } as OperatorDataset,
        cnRelease,
        'min',
      )[0].name,
    ).toBe('2020-05-20 Shop Update')
  })
  it('overrides Nine-Colored Deer login names on both servers and without event metadata', () => {
    const op = operator('char_4019_ncdeer', 'Nine-Colored Deer', 5, '2022-01-10')
    for (const server of ['cn', 'global'] as const) {
      const releaseEvents = [
        {
          id: 'act24sign',
          category: 'other',
          server,
          date: op.release[server].date!,
          name: 'Login Event: Limited-time Cumulative Sign-In',
          operatorIds: [op.id],
        },
      ]
      for (const records of [releaseEvents, []]) {
        expect(
          buildReleaseDateOptions(
            { operators: [op], releaseEvents: records } as OperatorDataset,
            { ...cnRelease, server },
            'min',
          )[0].name,
        ).toBe('Login Event: Display of Auspices')
      }
    }
  })
  it('deduplicates overlapping event names without changing the single dropdown representative', () => {
    const ops = [operator('six', 'Six', 6, '2021-07-01'), operator('five', 'Five', 5, '2021-07-01')]
    const records = ['one', 'two'].map((id) => ({
      id,
      name: 'Shared event',
      server: 'cn' as const,
      date: '2021-07-01',
      operatorIds: ops.map(({ id }) => id),
    }))
    const option = buildReleaseDateOptions(
      { operators: ops, releaseEvents: records } as OperatorDataset,
      cnRelease,
      'min',
    )[0]
    expect(option.name).toBe('Shared event')
    expect(option.representative?.id).toBe('six')
    expect(option.representatives.map(({ id }) => id)).toEqual(['six', 'five'])
  })
  it('shows all overlapping events ordered actual, gameplay, then login', () => {
    const op = operator('shared', 'Shared', 5, '2020-11-26')
    const record = (id: string, category: string, name: string) => ({
      id,
      category,
      name,
      server: 'cn' as const,
      date: '2020-11-26',
      operatorIds: [op.id],
    })
    const login = record('sign', 'login', 'Login Event: Gift')
    const game = record('mode', 'crisis', 'CC#2: Operation Blade')
    const actual = record('story', 'side_story', 'Actual story')
    for (const records of [
      [login, game, actual],
      [actual, game, login],
    ]) {
      expect(
        buildReleaseDateOptions(
          { operators: [op], releaseEvents: records } as OperatorDataset,
          cnRelease,
          'min',
        )[0].name,
      ).toBe('Actual story / CC#2: Operation Blade / Login Event: Gift')
    }
    expect(
      buildReleaseDateOptions(
        { operators: [op], releaseEvents: [login, game] } as OperatorDataset,
        cnRelease,
        'min',
      )[0].name,
    ).toBe('CC#2: Operation Blade / Login Event: Gift')
    expect(
      buildReleaseDateOptions(
        { operators: [op], releaseEvents: [login] } as OperatorDataset,
        cnRelease,
        'min',
      )[0].name,
    ).toBe('Login Event: Gift')
  })
  it('corrects Beeswax and Chiave even when an older cache assigns them to CC#2', () => {
    const op = operator('char_344_beewax', 'Beeswax', 5, '2020-07-28')
    const dataset = {
      operators: [op],
      releaseEvents: [
        {
          id: 'dis_rune_2',
          category: 'crisis',
          name: 'CC#2: Operation Blade',
          server: 'cn',
          date: '2020-07-28',
          operatorIds: [op.id],
        },
      ],
    } as OperatorDataset
    expect(buildReleaseDateOptions(dataset, cnRelease, 'min')[0].name).toBe(
      "Grani and the Knights' Treasure Rerun",
    )
  })
  it('numbers Heart of Surging Flame parts using each server release order', () => {
    const hellagur = operator('char_188_helage', 'Hellagur', 6, '2019-09-10')
    const schwarz = operator('char_340_shwaz', 'Schwarz', 6, '2019-08-27')
    hellagur.release.global.date = '2020-04-15'
    schwarz.release.global.date = '2020-04-29'
    const dataset = { operators: [hellagur, schwarz] } as OperatorDataset
    expect(
      buildReleaseDateOptions(dataset, cnRelease, 'min').map(({ representative, name }) => [
        representative?.name,
        name,
      ]),
    ).toEqual([
      ['Schwarz', 'Heart of Surging Flame Part 1'],
      ['Hellagur', 'Heart of Surging Flame Part 2'],
    ])
    expect(
      buildReleaseDateOptions(dataset, { ...cnRelease, server: 'global' }, 'min').map(
        ({ representative, name }) => [representative?.name, name],
      ),
    ).toEqual([
      ['Hellagur', 'Heart of Surging Flame Part 1'],
      ['Schwarz', 'Heart of Surging Flame Part 2'],
    ])
  })
  it('applies Purestream login and Thorns rerun overrides', () => {
    const dataset = {
      operators: [
        operator('char_385_finlpp', 'Purestream', 5, '2020-03-03'),
        operator('char_293_thorns', 'Thorns', 6, '2020-08-11'),
      ],
    } as OperatorDataset
    expect(buildReleaseDateOptions(dataset, cnRelease, 'min').map(({ name }) => name)).toEqual([
      'Login Event: Coexistence',
      'Heart of Surging Flame Rerun',
    ])
  })
  it('groups Ancient Forge releases without changing individual dates and applies inclusive bounds', () => {
    const nian = operator('nian', 'Nian', 6, '2020-01-16', 'limited')
    const snowsant = operator('snowsant', 'Snowsant', 5, '2020-01-09', 'welfare')
    const dataset = {
      operators: [nian, snowsant],
      releaseEvents: [
        {
          id: 'forge',
          category: 'mini_event',
          server: 'cn',
          date: '2020-01-09',
          name: 'Ancient Forge',
          operatorIds: ['snowsant'],
        },
        {
          id: 'forge',
          category: 'mini_event',
          server: 'cn',
          date: '2020-01-16',
          name: 'Ancient Forge',
          operatorIds: ['nian'],
        },
      ],
    } as OperatorDataset
    const min = buildReleaseDateOptions(dataset, cnRelease, 'min')
    const max = buildReleaseDateOptions(dataset, cnRelease, 'max')
    expect(min).toHaveLength(1)
    expect(min[0]).toMatchObject({
      name: 'Ancient Forge',
      date: '2020-01-09',
      representative: { id: 'nian' },
    })
    expect(max[0].date).toBe('2020-01-16')
    expect(snowsant.release.cn.date).toBe('2020-01-09')
  })
  it('uses the localized Garrison chapter name instead of a generic release label', () => {
    const op = operator('char_010_chen', 'Chen', 6, '2019-07-09')
    const dataset = {
      operators: [op],
      releaseEvents: [
        {
          id: 'dis_main_5',
          category: 'main_story',
          server: 'cn',
          date: '2019-07-09',
          name: '2019-07-09 operator release',
          operatorIds: [op.id],
        },
      ],
    } as OperatorDataset
    const events = [
      {
        id: 'main:5',
        group: 'main',
        name: 'Chapter 5 - Necessary Solutions',
        releaseTime: null,
        stages: { standard: [], h: [], ex: [], s: [] },
      },
    ] as GarrisonEvent[]
    expect(buildReleaseDateOptions(dataset, cnRelease, 'min', events)[0].name).toBe(
      'Chapter 5 - Necessary Solutions',
    )
  })
  it('uses SilverAsh as the dropdown launch representative', () => {
    const dataset = {
      operators: [
        operator('char_103_angel', 'Exusiai', 6, '2019-05-01'),
        operator('char_172_svrash', 'SilverAsh', 6, '2019-05-01'),
      ],
    } as OperatorDataset
    expect(buildReleaseDateOptions(dataset, cnRelease, 'min')[0].representative?.name).toBe(
      'SilverAsh',
    )
  })
  it('uses annual April Fools and shop-only labels', () => {
    const april = {
      operators: [operator('char_159_peacok', 'Conviction', 5, '2020-04-01')],
    } as OperatorDataset
    expect(buildReleaseDateOptions(april, cnRelease, 'min')[0].name).toBe('2020 April Fools')
    const shop = operator('shop', 'Shop', 5, '2020-05-13', 'welfare')
    shop.acquisition.group = 'redCert'
    expect(
      buildReleaseDateOptions({ operators: [shop] } as OperatorDataset, cnRelease, 'min')[0].name,
    ).toBe('2020-05-13 Shop Update')
  })
  it('fills six places by rarity, then acquisition priority and alphabetical order', () => {
    const ops = [
      operator('t', 'Tsukinogi', 5, '2020-06-02'),
      operator('a', 'Asbestos', 5, '2020-06-02'),
      operator('w', 'A Welfare', 5, '2020-06-02', 'welfare'),
      ...['Zulu', 'Alpha', 'Bravo'].map((name) => ({
        ...operator(name, name, 5, '2020-06-02'),
        rarity: 4 as const,
      })),
    ]
    expect(
      buildReleaseDateOptions(
        { operators: ops } as OperatorDataset,
        cnRelease,
        'min',
      )[0].representatives.map(({ name }) => name),
    ).toEqual(['Asbestos', 'Tsukinogi', 'A Welfare', 'Alpha', 'Bravo', 'Zulu'])
  })
  it('shows all five four-stars when available and uses a dated unmatched label', () => {
    const low = ['Zulu', 'Delta', 'Alpha', 'Echo', 'Bravo'].map((name) => ({
      ...operator(name, name, 5, '2021-07-01'),
      rarity: 4 as const,
    }))
    const options = buildReleaseDateOptions({ operators: low } as OperatorDataset, cnRelease, 'min')
    expect(options[0].name).toBe('2021-07-01 Operator Release')
    expect(options[0].representatives.map(({ name }) => name)).toEqual([
      'Alpha',
      'Bravo',
      'Delta',
      'Echo',
      'Zulu',
    ])
  })
  it('keeps a matched gameplay name instead of borrowing a Garrison story name', () => {
    const op = operator('six', 'Six', 6, '2021-06-01')
    const dataset = {
      operators: [op],
      releaseEvents: [
        {
          id: 'mode',
          server: 'cn',
          date: '2021-06-01',
          name: 'Integrated Strategies — Topic',
          operatorIds: ['six'],
        },
      ],
    } as OperatorDataset
    const events = [
      {
        id: 'unrelated',
        name: 'Nearby story',
        group: 'side',
        releaseTime: Date.parse('2021-06-01') / 1000,
        stages: { standard: [], h: [], ex: [], s: [] },
      },
    ] as GarrisonEvent[]
    expect(buildReleaseDateOptions(dataset, cnRelease, 'min', events)[0].name).toBe(
      'Integrated Strategies — Topic',
    )
  })
  it('reuses Garrison names and featured representatives, falling back to the alphabetically first five star', () => {
    const limited = operator('limited', 'Limited', 6, '2021-06-01', 'limited')
    const standard = operator('standard', 'Standard', 6, '2021-06-01')
    const z = operator('z', 'Zulu', 5, '2021-07-01')
    const a = operator('a', 'Alpha', 5, '2021-07-01')
    const dataset = {
      operators: [standard, limited, z, a],
      releaseEvents: [
        {
          id: 'featured',
          server: 'cn',
          date: '2021-06-01',
          name: 'Localized Event',
          operatorIds: ['limited', 'standard'],
        },
      ],
    } as OperatorDataset
    const events = [
      {
        id: 'featured',
        group: 'side',
        name: 'Localized Event',
        releaseTime: Date.parse('2021-06-01') / 1000,
        limitedOperatorIds: ['limited'],
        stages: { standard: [], h: [], ex: [], s: [] },
      },
    ] as GarrisonEvent[]
    const options = buildReleaseDateOptions(dataset, cnRelease, 'min', events)
    expect(options[0].name).toBe('Localized Event')
    expect(options[0].representative?.id).toBe('limited')
    expect(options[1].representative?.id).toBe('a')
    expect(options.map(({ date }) => date)).toEqual(['2021-06-01', '2021-07-01'])
  })
  it('lists distinct regional dates within each bound group, independent of the current date selection', () => {
    const launch = operator('launch', 'Launch', 6, '2019-05-01')
    const first = operator('first', 'First', 6, '2019-06-01')
    const second = operator('second', 'Second', 5, '2019-07-01')
    const cnOnly = {
      ...operator('cn', 'CN only', 6, '2019-08-01'),
      availableOn: { cn: true, global: false },
    }
    const dataset = {
      operators: [launch, first, second, cnOnly],
      releaseEvents: [
        { server: 'cn', date: '2019-06-01', name: 'First Event', operatorIds: ['first'] },
      ],
    } as OperatorDataset
    const release = {
      ...cnRelease,
      minYear: 1,
      maxYear: 0,
      minDate: '2019-07-01',
      maxDate: '2019-05-01',
    }
    const options = buildReleaseDateOptions(dataset, release, 'min')
    expect(options.map(({ date }) => date)).toEqual(['2019-06-01', '2019-07-01', '2019-08-01'])
    expect(options[0].name).toBe('First Event')
    expect(options[0].representatives.map(({ id }) => id)).toEqual(['first'])
    expect(buildReleaseDateOptions(dataset, release, 'max').map(({ name }) => name)).toEqual([
      'Launch',
    ])
    expect(
      buildReleaseDateOptions(dataset, { ...release, server: 'global', minYear: null }, 'min'),
    ).toHaveLength(1)
  })
  it.each(['cn', 'global'] as const)(
    'uses the seven requested launch portraits in order on %s, even with localized names',
    (server) => {
      const launch = [
        operator('char_172_svrash', '银灰', 6, '2019-05-01'),
        operator('char_180_amgoat', '艾雅法拉', 6, '2019-05-01'),
        operator('char_102_texas', '德克萨斯', 5, '2019-05-01'),
        operator('char_128_plosis', '白面鸮', 5, '2019-05-01'),
        operator('char_143_ghost', '幽灵鲨', 5, '2019-05-01'),
        operator('char_002_amiya', '阿米娅', 5, '2019-05-01'),
        operator('char_237_gravel', '砾', 4, '2019-05-01'),
        operator('char_124_kroos', '克洛丝', 3, '2019-05-01'),
        operator('other', 'Other', 6, '2019-05-01'),
        operator('later', 'Later', 6, '2019-06-01'),
      ]

      if (server === 'global')
        for (const op of launch)
          op.release.global = {
            date: op.id === 'later' ? '2020-02-01' : '2020-01-16',
            yearGroup: op.id === 'later' ? 1 : 0,
          }
      const release = { ...cnRelease, server }
      const preview = getReleaseBoundPreview(launch, release, 'min')
      const ids = [
        'char_172_svrash',
        'char_180_amgoat',
        'char_002_amiya',
        'char_143_ghost',
        'char_128_plosis',
        'char_237_gravel',
        'char_124_kroos',
      ]
      expect(preview?.representatives.map(({ id }) => id)).toEqual(ids)
      for (const side of ['min', 'max'] as const) {
        const option = buildReleaseDateOptions(
          { operators: launch } as OperatorDataset,
          release,
          side,
        )[0]
        expect(option.representatives.map(({ id }) => id)).toEqual(ids)
        expect(option.representative?.id).toBe('char_172_svrash')
      }
    },
  )

  it('never borrows representatives from another release date', () => {
    const items = [
      operator('only', 'Only Five', 5, '2020-04-01'),
      operator('next6', 'Next Six', 6, '2020-04-02'),
      operator('next5', 'Next Five', 5, '2020-04-02'),
    ]
    const preview = getReleaseBoundPreview(items, cnRelease, 'min')
    expect(preview?.date).toBe('2020-04-01')
    expect(preview?.representatives.map((item) => item.id)).toEqual(['only'])
  })

  it('orders same-date representatives by rarity and then acquisition source', () => {
    const items = [
      operator('welfare6', 'A Welfare Name', 6, '2022-05-01', 'welfare'),
      operator('standard6', 'Z Standard Name', 6, '2022-05-01'),
      operator('limited6', 'M Limited Name', 6, '2022-05-01', 'limited'),
      operator('welfare5', 'A Welfare Five', 5, '2022-05-01', 'welfare'),
      operator('standard5', 'Z Standard Five', 5, '2022-05-01'),
      operator('limited5', 'M Limited Five', 5, '2022-05-01', 'limited'),
    ]
    const preview = getReleaseBoundPreview(items, cnRelease, 'max')
    expect(preview?.representatives.map(({ id }) => id)).toEqual([
      'limited6',
      'standard6',
      'welfare6',
      'limited5',
      'standard5',
      'welfare5',
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
