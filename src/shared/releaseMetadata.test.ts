import { describe, expect, it } from 'vitest'
import {
  publishedCnReleaseDates,
  buildReleaseDateMap,
  releaseYearGroup,
  buildReleaseEventNames,
} from './releaseMetadata'
import type { Operator } from './operator'

describe('release metadata fallbacks', () => {
  it('follows Skadi and Ch’en per server and fixes the Global shop update date', () => {
    const published = {
      char_282_catap: '2019-05-23',
      char_263_skadi: '2019-05-30',
      char_284_spot: '2019-07-01',
      char_010_chen: '2019-07-09',
      char_275_breeze: '2019-11-01',
      char_355_ethan: '2019-11-01',
      char_260_durnar: '2019-10-01',
    }
    const events = `export const generatedOperatorReleaseEventList = ${JSON.stringify([
      {
        id: '1stact',
        server: 'global',
        startDate: '2020-02-05',
        operatorIds: ['char_282_catap', 'char_263_skadi'],
      },
      {
        id: 'dis_main_5',
        server: 'global',
        startDate: '2020-02-26',
        operatorIds: ['char_284_spot', 'char_010_chen'],
      },
    ])}`
    const dates = buildReleaseDateMap(
      'export const operatorReleaseInfoByCharId = {}',
      'export const cnOperatorReleaseCandidateList = []',
      events,
      undefined,
      published,
    )
    expect(dates.char_282_catap).toEqual(dates.char_263_skadi)
    expect(dates.char_282_catap.cn).toBe('2019-05-30')
    expect(dates.char_284_spot).toEqual(dates.char_010_chen)
    expect(dates.char_284_spot.global).toBe('2020-02-26')
    for (const id of ['char_275_breeze', 'char_355_ethan', 'char_260_durnar'])
      expect(dates[id]).toEqual({
        cn: published[id as keyof typeof published],
        global: '2020-05-20',
      })
  })
  it('uses the April 16, 2024 Global release date for every Chapter 13 operator', () => {
    const ids = ['char_4107_vrdant', 'char_4110_delphn', 'char_494_vendla', 'char_4088_hodrer']
    const source = `export const generatedOperatorReleaseEventList = [{id:"dis_main_13",server:"global",startDate:"2024-04-30",operatorIds:${JSON.stringify(ids)}}]`
    const dates = buildReleaseDateMap(
      'export const operatorReleaseInfoByCharId = {}',
      'export const cnOperatorReleaseCandidateList = []',
      source,
    )
    expect(ids.map((id) => dates[id].global)).toEqual(ids.map(() => '2024-04-16'))
  })
  it('separates Beeswax and Chiave rerun releases from genuine CC#2 rewards', () => {
    const ids = ['char_344_beewax', 'char_349_chiave', 'reward']
    const ops = ids.map((id) => ({
      id,
      availableOn: { cn: true, global: false },
      release: {
        cn: { date: '2020-07-28', yearGroup: 2 },
        global: { date: null, yearGroup: null },
      },
    })) as Operator[]
    const source =
      'export const generatedOperatorReleaseEventList = [{id:"dis_rune_2",category:"crisis",operatorIds:["char_344_beewax","char_349_chiave","reward"]}]'
    const records = buildReleaseEventNames(source, ops, {
      global: { dis_rune_2: 'CC#2: Operation Blade' },
    })
    expect(records.find(({ id }) => id === 'act13d2')).toMatchObject({
      category: 'side_story',
      name: "Grani and the Knights' Treasure Rerun",
      operatorIds: ids.slice(0, 2),
    })
    expect(records.find(({ id }) => id === 'dis_rune_2')?.operatorIds).toEqual(['reward'])
  })
  it('overrides CN Snowsant to the Nian release date while retaining Global dates', () => {
    const source =
      'export const generatedOperatorReleaseEventList = [{id:"forge",operatorIds:["char_383_snsant","char_2014_nian"],server:"global",startDate:"2020-07-29"}]'
    const dates = buildReleaseDateMap(
      'export const operatorReleaseInfoByCharId = {}',
      'export const cnOperatorReleaseCandidateList = []',
      source,
      undefined,
      { char_383_snsant: '2020-01-09', char_2014_nian: '2020-01-16' },
    )
    expect(dates.char_383_snsant).toEqual({ cn: '2020-01-16', global: '2020-07-29' })
  })
  it('retains Catapult’s Grani association on both servers for the Skadi date override', () => {
    const op = {
      id: 'char_282_catap',
      availableOn: { cn: true, global: true },
      release: {
        cn: { date: '2019-05-30', yearGroup: 1 },
        global: { date: '2020-02-05', yearGroup: 1 },
      },
    } as Operator
    const source =
      'export const generatedOperatorReleaseEventList = [{id:"1stact",category:"side_story",operatorIds:["char_282_catap"]}]'
    const records = buildReleaseEventNames(source, [op], { global: { '1stact': 'Grani event' } })
    expect(records).toHaveLength(2)
    expect(records.map(({ server }) => server)).toEqual(['cn', 'global'])
  })
  it('uses official regional event names and actual regional operator dates', () => {
    const operators = [
      {
        id: 'operator',
        availableOn: { cn: true, global: true },
        release: {
          cn: { date: '2025-01-01', yearGroup: 6 },
          global: { date: '2025-07-01', yearGroup: 6 },
        },
      },
    ] as Operator[]
    const events =
      'export const generatedOperatorReleaseEventList = [{id:"event",name:"Source name",operatorIds:["operator","missing"]}]'
    expect(
      buildReleaseEventNames(events, operators, { global: { event: 'Official name' } }),
    ).toEqual([
      {
        id: 'event',
        category: undefined,
        server: 'cn',
        date: '2025-01-01',
        name: 'Official name',
        operatorIds: ['operator'],
      },
      {
        id: 'event',
        category: undefined,
        server: 'global',
        date: '2025-07-01',
        name: 'Official name',
        operatorIds: ['operator'],
      },
    ])
  })
  it('uses the limited debut banner before preload dates, without replacing grounded event dates', () => {
    const info =
      'export const operatorReleaseInfoByCharId = {"char_known":{"eventId":"known"},"char_candidate":{}}'
    const candidates =
      'export const cnOperatorReleaseCandidateList = [{"commitDate":"2026-10-29","addedOperatorList":[{"charId":"char_candidate"}]}]'
    const events =
      'export const generatedOperatorReleaseEventList = [{"id":"known","server":"future","startDate":"2026-11-02"}]'
    const openTime = Date.parse('2026-10-31T23:00:00Z') / 1000
    const dates = buildReleaseDateMap(info, candidates, events, {
      gachaPoolClient: {
        debut: { openTime, limitParam: { limitedCharId: 'char_4247_oxi' } },
        later: { openTime: openTime + 86_400, limitParam: { limitedCharId: 'char_4247_oxi' } },
        known: { openTime, limitParam: { limitedCharId: ['char_known', 'char_candidate'] } },
        invalid: { openTime: 'invalid', limitParam: { limitedCharId: 'char_invalid' } },
      },
    })
    expect(dates.char_4247_oxi).toEqual({ cn: '2026-11-01', global: null })
    expect(dates.char_candidate).toEqual({ cn: '2026-11-01', global: null })
    expect(dates.char_known).toEqual({ cn: '2026-11-02', global: null })
    expect(dates.char_invalid).toBeUndefined()
  })

  it('maps published local availability dates to stable operator IDs without timezone shifts', () => {
    expect(
      publishedCnReleaseDates(
        [
          { name: '行铃', releaseDate: '2026-11-01 00:30:00' },
          { name: '行铃', releaseDate: '2027-11-01 00:30:00' },
          { name: '坏日期', releaseDate: '2026-02-30 12:00:00' },
          { name: '未公开', releaseDate: '' },
        ],
        {
          char_4170_hdbell: { name: '行铃' },
          char_invalid: { name: '坏日期' },
          char_unknown: { name: '未公开' },
        },
      ),
    ).toEqual({ char_4170_hdbell: '2026-11-01' })
  })

  it('parses generated TypeScript event literals with identifier keys and trailing commas', () => {
    const info =
      'export const operatorReleaseInfoByCharId = {"char_current":{"eventId":"event_current"}}'
    const candidates = 'export const cnOperatorReleaseCandidateList = []'
    const events = `
      export const generatedOperatorReleaseEventList: readonly GeneratedOperatorReleaseEvent[] =
        [
          {
            id: "event_current",
            name: "Current event",
            category: "main_story",
            server: "global",
            source: "manual",
            order: 1,
            startTime: 1791399600,
            startDate: "2026-10-08",
            operatorIds: ["char_current"],
          },
        ]
    `

    expect(buildReleaseDateMap(info, candidates, events).char_current).toEqual({
      cn: null,
      global: '2026-10-08',
    })
  })

  it('uses one actual event day for every member and ignores commit/preload dates entirely', () => {
    const info =
      'export const operatorReleaseInfoByCharId = {"char_known":{"eventId":"event_known"}}'
    const candidates =
      'export const cnOperatorReleaseCandidateList = [{"commitDate":"2026-10-08","addedOperatorList":[{"charId":"char_only_preloaded"},{"charId":"char_known"}]}]'
    const events =
      'export const generatedOperatorReleaseEventList = [{"id":"event_known","server":"future","startDate":"2026-10-09","operatorIds":["char_known","char_4231_clemnt","char_393_toledo","char_4232_hbound"]}]'

    const dates = buildReleaseDateMap(info, candidates, events)

    expect(dates.char_known).toEqual({ cn: '2026-10-09', global: null })
    expect(dates.char_4231_clemnt).toEqual({ cn: '2026-10-09', global: null })
    expect(dates.char_393_toledo).toEqual({ cn: '2026-10-09', global: null })
    expect(dates.char_4232_hbound).toEqual({ cn: '2026-10-09', global: null })
    expect(dates.char_only_preloaded).toBeUndefined()
  })

  it('keeps all Episode 17 operators at the Year 8 CN boundary', () => {
    const episode17 = [
      'char_4227_gallus',
      'char_4225_tanya',
      'char_4226_veen',
      'char_4228_closur',
      'char_1052_kalts2',
    ]
    const info = `export const operatorReleaseInfoByCharId = ${JSON.stringify(
      Object.fromEntries(episode17.map((operatorId) => [operatorId, {}])),
    )}`
    const candidates = `export const cnOperatorReleaseCandidateList = ${JSON.stringify([
      {
        commitDate: '2026-04-30T00:00:00Z',
        addedOperatorList: episode17.map((charId) => ({ charId })),
      },
    ])}`
    const events = 'export const generatedOperatorReleaseEventList = []'

    const dates = buildReleaseDateMap(info, candidates, events)

    for (const operatorId of episode17) {
      expect(dates[operatorId]).toEqual({ cn: '2026-05-01', global: null })
      expect(releaseYearGroup(dates[operatorId].cn, 'cn')).toBe(8)
    }
  })

  it('applies the confirmed November 1 date to all six newly released operators', () => {
    const ids = [
      'char_4247_oxi',
      'char_4244_tocka',
      'char_4246_dminon',
      'char_4245_alga',
      'char_4169_caledo',
      'char_4170_hdbell',
    ]
    const dates = buildReleaseDateMap(
      'export const operatorReleaseInfoByCharId = {}',
      `export const cnOperatorReleaseCandidateList = [{"commitDate":"2026-10-29","addedOperatorList":${JSON.stringify(ids.map((charId) => ({ charId })))}}]`,
      'export const generatedOperatorReleaseEventList = []',
      undefined,
      Object.fromEntries(ids.map((id) => [id, '2026-11-01'])),
    )
    expect(ids.map((id) => dates[id].cn)).toEqual(ids.map(() => '2026-11-01'))
  })
})
