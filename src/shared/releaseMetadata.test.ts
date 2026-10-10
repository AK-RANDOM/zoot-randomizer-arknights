import { describe, expect, it } from 'vitest'
import { buildCnFirstSeenDateMap, buildReleaseDateMap } from './releaseMetadata'

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

  it('rejects malformed releasever payloads instead of silently inventing dates', () => {
    expect(() => buildCnFirstSeenDateMap('[]')).toThrow(
      'Release-version metadata payload is malformed.',
    )
    expect(() => buildCnFirstSeenDateMap('{')).toThrow(
      'Release-version metadata payload is malformed.',
    )
  })
})
