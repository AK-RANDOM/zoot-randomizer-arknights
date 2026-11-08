import { describe, expect, it } from 'vitest'
import {
  releaseEventNameMap,
  appendUnregisteredActivityReleases,
  gameplayReleaseCandidates,
} from './releaseEventNames'
import type { OperatorDataset } from './operator'

describe('official release event names', () => {
  it('discovers future mode launches, April Fools, and explicitly rewarded login operators', () => {
    const op = (id: string, date: string) => ({
      id,
      availableOn: { cn: false, global: true },
      release: { cn: { date: null, yearGroup: null }, global: { date, yearGroup: 10 } },
    })
    const dataset = {
      operators: [op('mode', '2030-01-02'), op('april', '2030-04-01'), op('login', '2030-06-02')],
    } as OperatorDataset
    const modes = gameplayReleaseCandidates(
      { topics: { rogue_20: { startTime: Date.parse('2030-01-02') / 1000 } } },
      {},
      {},
      {},
    )
    appendUnregisteredActivityReleases(
      dataset,
      {
        global: {
          gameplayReleaseCandidates: modes,
          basicInfo: {
            act99fun: { startTime: Date.parse('2030-04-01') / 1000 },
            act90sign: {
              name: 'Cooperation',
              startTime: Date.parse('2030-06-01') / 1000,
              endTime: Date.parse('2030-06-05') / 1000,
            },
          },
          activity: { CHECKIN_ONLY: { act90sign: { itemList: [{ id: 'login', type: 'CHAR' }] } } },
        },
      },
      { global: { dis_rogue_20: 'IS#21: New Topic' } },
    )
    expect(dataset.releaseEvents?.map(({ name }) => name)).toEqual([
      'IS#21: New Topic',
      '2030 April Fools',
      'Login Event: Cooperation',
    ])
  })
  it('discovers new CN story events without borrowing same-day login titles or leaking to Global', () => {
    const dataset = {
      operators: [
        {
          id: 'talulah',
          availableOn: { cn: true, global: false },
          release: {
            cn: { date: '2026-11-01', yearGroup: 8 },
            global: { date: null, yearGroup: null },
          },
        },
      ],
    } as OperatorDataset
    appendUnregisteredActivityReleases(
      dataset,
      {
        cn: {
          basicInfo: {
            act55side: { name: '时间啊，向前！', hasStage: true, startTime: 1793487600 },
            act65sign: { name: 'Login', hasStage: false, startTime: 1793487600 },
          },
        },
      },
      {},
    )
    expect(dataset.releaseEvents).toEqual([
      {
        id: 'act55side',
        category: 'side_story',
        server: 'cn',
        date: '2026-11-01',
        name: '时间啊，向前！',
        operatorIds: ['talulah'],
      },
    ])
  })
  it('includes Vignettes and Intermezzi independently of stage-catalog visibility', () => {
    expect(
      releaseEventNameMap({
        basicInfo: {
          mini: { name: 'English Vignette' },
          branch: { name: 'English Intermezzi' },
          act24sign: { name: 'Login event' },
        },
      }),
    ).toMatchObject({
      mini: 'English Vignette',
      branch: 'English Intermezzi',
      act24sign: 'Login event',
    })
  })
  it('maps gameplay release IDs to official mode names', () => {
    expect(
      releaseEventNameMap(
        {},
        { topics: { rogue_1: { name: 'Crimson Solitaire' } } },
        { seasonInfo: [{ seasonId: 'rune_season_9_1', name: 'Operation Deepness' }] },
        {},
        { basicInfo: { sandbox_1: { topicName: 'Tales Within the Sand' } } },
      ),
    ).toMatchObject({
      dis_rogue_1: 'IS#2: Crimson Solitaire',
      dis_rune_9: 'CC#9: Operation Deepness',
      dis_perm_sandbox_1: 'RA#2: Tales Within the Sand',
    })
  })
})
