import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  captureDataPackage,
  confirmedDateRegressions,
  rebuildDataPackage,
  validatePreparedDataPackage,
} from './dataPackageProducer'
import {
  canonicalPackageJson,
  correctionsSnapshot,
  dataPackageId,
  dataSha256,
} from './dataPackageJson'
import { DataPackageInputSession, validatePackageInputUrl } from './dataPackageInputs'
import { UPSTREAM } from './operatorData'
import { CN_RELEASE_DATES_API } from './releaseMetadata'
import { RELEASE_DATE_OVERRIDES, SUBCLASS_LABELS, MODE_ONLY_OPERATOR_IDS } from './dataCorrections'
import type { PreparedDataPackage } from './dataPackage'

const sources = { gamedataCommit: 'a'.repeat(40), releaseMetadataCommit: 'b'.repeat(40) }
const identity = 'c'.repeat(64)
const generatedAt = '2026-11-20T00:00:00.000Z'
const ids = Array.from({ length: 300 }, (_, index) => `char_fixture_${index}`)

function fixture(
  options: {
    cnDate?: string
    failSuffix?: string
    failStatus?: number
    malformedPrts?: boolean
    emptyPrts?: boolean
    omitCnEvent?: boolean
    paginated?: boolean
  } = {},
) {
  const calls: string[] = []
  const characters = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        name: id,
        appellation: id,
        rarity: 'TIER_6',
        profession: 'WARRIOR',
        subProfessionId: 'lord',
        isNotObtainable: false,
      },
    ]),
  )
  const fetchImpl: typeof fetch = async (resource) => {
    const url = String(resource)
    calls.push(url)
    if (options.failSuffix && url.includes(options.failSuffix))
      return new Response('{}', { status: options.failStatus ?? 503 })
    if (url.includes('/git/ref/heads/'))
      return new Response(
        JSON.stringify({
          object: {
            sha: url.includes(UPSTREAM.gamedataRepo)
              ? sources.gamedataCommit
              : sources.releaseMetadataCommit,
          },
        }),
      )
    if (url.endsWith(UPSTREAM.releaseInfoPath))
      return new Response(
        `export const operatorReleaseInfoByCharId = ${JSON.stringify(Object.fromEntries(ids.map((id, index) => [id, { eventId: index === 0 ? 'event_fixture' : 'server_open', category: 'side_story' }])))}`,
      )
    if (url.endsWith(UPSTREAM.releaseCandidatePath))
      return new Response('export const cnOperatorReleaseCandidateList = []')
    if (url.endsWith(UPSTREAM.releaseEventPath))
      return new Response(
        `export const generatedOperatorReleaseEventList = ${JSON.stringify([
          {
            id: 'event_fixture',
            name: 'Fixture',
            startDate: '2026-01-01',
            server: 'global',
            category: 'side_story',
            operatorIds: [ids[0]],
          },
          ...(options.omitCnEvent
            ? []
            : [
                {
                  id: 'event_fixture',
                  name: 'Fixture',
                  startDate: '2026-01-01',
                  server: 'future',
                  category: 'side_story',
                  operatorIds: [ids[0]],
                },
              ]),
        ])}`,
      )
    let body: unknown = {}
    if (url.startsWith(CN_RELEASE_DATES_API)) {
      const row = { title: { name: ids[0], releaseDate: options.cnDate ?? '2026-01-01 00:00:00' } }
      body = options.malformedPrts
        ? { cargoquery: {} }
        : {
            cargoquery: options.emptyPrts
              ? []
              : options.paginated && new URL(url).searchParams.get('offset') === '0'
                ? Array.from({ length: 500 }, () => row)
                : [row],
          }
    } else if (url.endsWith('/character_table.json')) body = characters
    else if (url.endsWith('/char_patch_table.json')) body = { patchChars: {} }
    else if (url.endsWith('/activity_table.json'))
      body = {
        basicInfo: {
          act1side: {
            name: url.includes('/cn/') ? '测试活动' : 'Fixture Event',
            displayType: 'SIDESTORY',
            startTime: Date.parse('2026-01-01T00:00:00Z') / 1000,
          },
        },
      }
    else if (url.endsWith('/zone_table.json'))
      body = {
        zones: {
          act1side_zone1: { type: 'ACTIVITY', zoneIndex: 0, zoneNameSecond: 'Fixture Zone' },
        },
      }
    else if (url.endsWith('/stage_table.json'))
      body = {
        stages: {
          fixture_stage: {
            code: 'FX-1',
            zoneId: 'act1side_zone1',
            stageType: 'ACTIVITY',
            difficulty: 'NORMAL',
          },
        },
      }
    return new Response(JSON.stringify(body))
  }
  return { fetchImpl, calls }
}

async function capture(options: Parameters<typeof fixture>[0] = {}) {
  const mock = fixture(options)
  const result = await captureDataPackage({
    producerSourceSha256: identity,
    generatedAt,
    fetchImpl: mock.fetchImpl,
  })
  return { ...result, ...mock }
}

function replacePayload(
  prepared: PreparedDataPackage,
  path: string,
  transform: (value: Record<string, unknown>) => void,
) {
  const copy = structuredClone({ manifest: prepared.manifest, files: prepared.files })
  const value = JSON.parse(copy.files[path]) as Record<string, unknown>
  transform(value)
  const body = canonicalPackageJson(value)
  copy.files[path] = body
  const descriptor = copy.manifest.files.find((file) => file.path === path)!
  descriptor.bytes = Buffer.byteLength(body)
  descriptor.sha256 = dataSha256(body)
  copy.manifest.packageId = dataPackageId(copy.manifest)
  return copy
}

afterEach(() => vi.unstubAllGlobals())

describe('prepared data producer', () => {
  it('builds eleven complete payloads using one fetch per pinned source input and no artwork check', async () => {
    const result = await capture()
    expect(result.prepared.manifest.files).toHaveLength(11)
    expect(result.prepared.catalogs).toHaveLength(10)
    expect(result.snapshot.inputs).toHaveLength(59)
    expect(result.calls).toHaveLength(61)
    expect(new Set(result.calls).size).toBe(result.calls.length)
    expect(result.calls.filter((url) => url.includes('/git/ref/heads/'))).toHaveLength(2)
    expect(result.calls.some((url) => url.includes(UPSTREAM.resourcesRepo))).toBe(false)
    expect(result.prepared.dataset.sources.resourcesCommit).toBeNull()
    expect(
      result.prepared.catalogs.every((catalog) => catalog.events[0].stages.standard[0] === 'FX-1'),
    ).toBe(true)
    expect(validatePreparedDataPackage(result.prepared).valid).toBe(true)
  })

  it('replays byte-identical payloads and identities with no network fallback', async () => {
    const result = await capture()
    const network = vi.fn(() => {
      throw new Error('Network forbidden')
    })
    vi.stubGlobal('fetch', network)
    const replay = await rebuildDataPackage(
      result.snapshot,
      async (input) => result.inputBodies.get(input.sha256)!,
      { producerSourceSha256: identity },
    )
    expect(replay.prepared.files).toEqual(result.prepared.files)
    expect(replay.prepared.manifest).toEqual(result.prepared.manifest)
    expect(network).not.toHaveBeenCalled()
  })

  it('rechecks published dates when GitHub heads match and retains observation time for identical content', async () => {
    const original = await capture()
    const unchanged = fixture()
    const repeat = await captureDataPackage({
      producerSourceSha256: identity,
      previousSnapshot: original.snapshot,
      generatedAt: '2026-11-21T00:00:00.000Z',
      fetchImpl: unchanged.fetchImpl,
    })
    expect(unchanged.calls.some((url) => url.startsWith(CN_RELEASE_DATES_API))).toBe(true)
    expect(repeat.prepared.manifest.packageId).toBe(original.prepared.manifest.packageId)
    const changed = fixture({ cnDate: '2026-01-02 00:00:00' })
    const updated = await captureDataPackage({
      producerSourceSha256: identity,
      previousSnapshot: original.snapshot,
      generatedAt: '2026-11-21T00:00:00.000Z',
      fetchImpl: changed.fetchImpl,
    })
    expect(updated.prepared.dataset.operators[0].release.cn.date).toBe('2026-01-02')
    expect(updated.prepared.manifest.sources.publishedCnDates.inputSha256).not.toBe(
      original.prepared.manifest.sources.publishedCnDates.inputSha256,
    )
    expect(updated.prepared.manifest.packageId).not.toBe(original.prepared.manifest.packageId)
    expect(updated.snapshot.generatedAt).toBe('2026-11-21T00:00:00.000Z')
  })

  it('captures and verifies every published-date pagination response', async () => {
    const result = await capture({ paginated: true })
    expect(
      result.snapshot.inputs.filter((input) => input.url.startsWith(CN_RELEASE_DATES_API)),
    ).toHaveLength(2)
    expect(result.calls.some((url) => url.includes('offset=500'))).toBe(true)
    const replay = await rebuildDataPackage(
      result.snapshot,
      async (input) => result.inputBodies.get(input.sha256)!,
      { producerSourceSha256: identity },
    )
    expect(replay.prepared.manifest.packageId).toBe(result.prepared.manifest.packageId)
  })

  it.each([
    'crisis_table.json',
    'prts.wiki/api.php',
    '/jp/gamedata/excel/main_text.json',
    '/kr/gamedata/excel/zone_table.json',
  ])(
    'rejects unavailable input %s even when a legacy path would tolerate it',
    async (failSuffix) => {
      await expect(capture({ failSuffix })).rejects.toThrow(/failed|incomplete|unavailable/i)
    },
  )

  it.each([{ malformedPrts: true }, { emptyPrts: true }])(
    'rejects unusable published-date input %j',
    async (options) => {
      await expect(capture(options)).rejects.toThrow(/incomplete|published/i)
    },
  )

  it('rejects corrupted or missing frozen bodies without attempting network access', async () => {
    const original = await capture()
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    await expect(
      rebuildDataPackage(original.snapshot, async () => new Uint8Array([123, 125]), {
        producerSourceSha256: identity,
      }),
    ).rejects.toThrow(/checksum/i)
    const missing = structuredClone(original.snapshot)
    missing.inputs = missing.inputs.filter((input) => !input.url.endsWith('/crisis_table.json'))
    await expect(
      rebuildDataPackage(missing, async (input) => original.inputBodies.get(input.sha256)!, {
        producerSourceSha256: identity,
      }),
    ).rejects.toThrow(/incomplete/i)
    expect(network).not.toHaveBeenCalled()
  })

  it('rejects moving revisions and duplicate snapshot input identities', async () => {
    const original = await capture()
    expect(() =>
      validatePackageInputUrl(
        `https://raw.githubusercontent.com/${UPSTREAM.gamedataRepo}/master/cn/gamedata/excel/character_table.json`,
        sources,
      ),
    ).toThrow(/Unpinned/)
    const duplicate = structuredClone(original.snapshot)
    duplicate.inputs.push(duplicate.inputs[0])
    expect(
      () =>
        new DataPackageInputSession({
          sources,
          generatedAt,
          snapshot: duplicate,
          readInput: async () => new Uint8Array(),
        }),
    ).toThrow(/duplicate/)
  })

  it('blocks disappearance of previously confirmed availability or dates', async () => {
    const original = await capture()
    const missing = fixture({ cnDate: '', omitCnEvent: true })
    await expect(
      captureDataPackage({
        producerSourceSha256: identity,
        generatedAt,
        previousDataset: original.prepared.dataset,
        fetchImpl: missing.fetchImpl,
      }),
    ).rejects.toThrow(/Confirmed cn date would be lost/)
    const unavailable = structuredClone(original.prepared.dataset)
    unavailable.operators[0].availableOn.cn = false
    expect(confirmedDateRegressions(original.prepared.dataset, unavailable)).toContain(
      `Confirmed cn date would be lost for ${ids[0]}.`,
    )
  })

  it('validates content as well as manifest and payload checksums', async () => {
    const result = await capture()
    const corrupt = structuredClone(result.prepared)
    corrupt.files['operators.json'] += ' '
    expect(
      validatePreparedDataPackage(corrupt).errors.some((error) => error.includes('checksum')),
    ).toBe(true)
    const wrongRegion = replacePayload(result.prepared, 'garrison/global-en.json', (value) => {
      value.region = 'cn'
    })
    expect(
      validatePreparedDataPackage(wrongRegion).errors.some((error) =>
        error.includes('differs from its path'),
      ),
    ).toBe(true)
    const wrongHelper = replacePayload(result.prepared, 'garrison/cn-en.json', (value) => {
      ;(value.events as Array<{ helperOperatorId: string }>)[0].helperOperatorId = 'char_unknown'
    })
    expect(
      validatePreparedDataPackage(wrongHelper).errors.some((error) =>
        error.includes('representative'),
      ),
    ).toBe(true)
    const changedStages = replacePayload(result.prepared, 'garrison/cn-en.json', (value) => {
      ;(value.events as Array<{ stages: { standard: string[] } }>)[0].stages.standard.push('FX-2')
    })
    expect(
      validatePreparedDataPackage(changedStages).errors.some((error) =>
        error.includes('Localization changed'),
      ),
    ).toBe(true)
    const extra = structuredClone(result.prepared)
    extra.files['../extra.json'] = '{}'
    expect(validatePreparedDataPackage(extra).valid).toBe(false)
  })

  it('includes every inherited correction and preserves null overrides and membership sets', () => {
    const snapshot = correctionsSnapshot() as Record<string, unknown>
    expect(snapshot.RELEASE_DATE_OVERRIDES).toEqual(RELEASE_DATE_OVERRIDES)
    expect(snapshot.SUBCLASS_LABELS).toEqual(SUBCLASS_LABELS)
    expect(snapshot.MODE_ONLY_OPERATOR_IDS).toEqual([...MODE_ONLY_OPERATOR_IDS].sort())
    expect(snapshot.RELEASE_DATE_OVERRIDES).toMatchObject({ char_4230_mcnist: { global: null } })
    expect(canonicalPackageJson({ z: 1, A: 2, a: [2, 1] })).toBe(
      '{\n  "A": 2,\n  "a": [\n    2,\n    1\n  ],\n  "z": 1\n}\n',
    )
  })
})
