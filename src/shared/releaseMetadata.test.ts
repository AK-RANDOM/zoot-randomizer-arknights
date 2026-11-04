import { describe, expect, it } from 'vitest'
import { publishedCnReleaseDates, buildReleaseDateMap, releaseYearGroup } from './releaseMetadata'

describe('release metadata fallbacks', () => {
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
