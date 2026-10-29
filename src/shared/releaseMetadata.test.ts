import { describe, expect, it } from 'vitest'
import {
  buildCnFirstSeenDateMap,
  buildReleaseDateMap,
  releaseYearGroup,
} from './releaseMetadata'

describe('release metadata fallbacks', () => {
  it('parses per-operator CN first-seen dates from releasever values', () => {
    const source = JSON.stringify({
      char_4231_clemnt: '26-10-08-04-51-28-56071834',
      char_393_toledo: '26-10-08-04-51-28-56071834',
      char_4232_hbound: '26-10-08-04-51-28-56071834',
      char_invalid: 'not-a-version',
      char_invalid_date: '26-99-99-deadbeef',
    })

    expect(buildCnFirstSeenDateMap(source)).toEqual({
      char_4231_clemnt: '2026-10-08',
      char_393_toledo: '2026-10-08',
      char_4232_hbound: '2026-10-08',
    })
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

  it('uses first-seen CN dates only when ordinary release metadata is missing', () => {
    const info =
      'export const operatorReleaseInfoByCharId = {"char_known":{"eventId":"event_known"}}'
    const candidates = 'export const cnOperatorReleaseCandidateList = []'
    const events =
      'export const generatedOperatorReleaseEventList = [{"id":"event_known","server":"future","startDate":"2026-10-09"}]'
    const releaseVersions = JSON.stringify({
      char_known: '26-10-08-04-51-28-56071834',
      char_4231_clemnt: '26-10-08-04-51-28-56071834',
      char_393_toledo: '26-10-08-04-51-28-56071834',
      char_4232_hbound: '26-10-08-04-51-28-56071834',
    })

    const dates = buildReleaseDateMap(info, candidates, events, releaseVersions)

    expect(dates.char_known).toEqual({ cn: '2026-10-09', global: null })
    expect(dates.char_4231_clemnt).toEqual({ cn: '2026-10-08', global: null })
    expect(dates.char_393_toledo).toEqual({ cn: '2026-10-08', global: null })
    expect(dates.char_4232_hbound).toEqual({ cn: '2026-10-08', global: null })
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

  it('rejects malformed releasever payloads instead of silently inventing dates', () => {
    expect(() => buildCnFirstSeenDateMap('[]')).toThrow(
      'Release-version metadata payload is malformed.',
    )
    expect(() => buildCnFirstSeenDateMap('{')).toThrow(
      'Release-version metadata payload is malformed.',
    )
  })
})
