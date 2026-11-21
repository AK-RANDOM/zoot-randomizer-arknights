import { describe, expect, it } from 'vitest'
import { canonicalJson, compareJson, datasetBehavior, requestSummary, sha256 } from './dataBaseline'

describe('data baseline comparison', () => {
  it('ignores provenance and object key order while retaining pipeline output', () => {
    const before = {
      generatedAt: 'old',
      sources: { commit: 'old' },
      dataPipelineVersion: 1,
      skinMetadataVersion: 1,
      operators: [{ id: 'char_a', release: { cn: { date: '2026-01-01' } } }],
    }
    const after = {
      operators: [{ release: { cn: { date: '2026-01-01' } }, id: 'char_a' }],
      generatedAt: 'new',
      sources: { commit: 'new' },
      dataPipelineVersion: 2,
      skinMetadataVersion: 2,
    }
    expect(compareJson(datasetBehavior(before), datasetBehavior(after)).equal).toBe(true)
    expect(sha256(canonicalJson(datasetBehavior(before)))).toBe(
      sha256(canonicalJson(datasetBehavior(after))),
    )
  })

  it.each([
    [
      'release date',
      { release: { global: '2026-01-01' } },
      { release: { global: '2026-01-02' } },
      '/release/global',
    ],
    ['acquisition', { acquisition: 'kernel' }, { acquisition: 'postKernel' }, '/acquisition'],
    ['translation', { names: { jp: '旧' } }, { names: { jp: '新' } }, '/names/jp'],
    [
      'skin identity',
      { skins: [{ id: 'char_a#1' }] },
      { skins: [{ id: 'char_a#2' }] },
      '/skins/0/id',
    ],
    ['stage order', { standard: ['AA-1', 'AA-2'] }, { standard: ['AA-2', 'AA-1'] }, '/standard/0'],
    [
      'event helper',
      { helperOperatorId: 'char_a' },
      { helperOperatorId: null },
      '/helperOperatorId',
    ],
  ])('detects a changed %s', (_label, before, after, path) => {
    expect(compareJson(before, after).changes.map((change) => change.path)).toContain(path)
  })

  it('distinguishes absent fields from explicit null and escapes JSON pointers', () => {
    expect(compareJson({}, { 'a/b~c': null }).changes).toEqual([
      {
        path: '/a~1b~0c',
        beforePresent: false,
        afterPresent: true,
        before: undefined,
        after: null,
      },
    ])
  })

  it('counts every difference even when the detail limit is reached', () => {
    expect(compareJson([1, 2, 3], [4, 5, 6], 1)).toMatchObject({
      equal: false,
      changeCount: 3,
      truncated: true,
      changes: [{ path: '/0' }],
    })
    expect(compareJson({ a: [] }, { a: {} }).equal).toBe(false)
    expect(compareJson([1], []).changes[0].afterPresent).toBe(false)
  })

  it('keeps logical request costs separate from cache and network measurements', () => {
    const entry = {
      phase: 'catalog',
      url: 'https://example.test/table',
      status: 200,
      decodedBytes: 1000,
      declaredContentLength: 100,
      contentEncoding: 'gzip',
      elapsedMs: 1,
      bodySha256: 'sha',
    }
    expect(
      requestSummary([
        { ...entry, source: 'network' },
        { ...entry, source: 'cache' },
      ]),
    ).toEqual({
      logicalRequests: 2,
      networkRequests: 1,
      cacheHits: 1,
      logicalDecodedBytes: 2000,
      networkDecodedBytes: 1000,
      declaredNetworkContentLength: 100,
    })
    expect(
      requestSummary([{ ...entry, source: 'network', declaredContentLength: null }])
        .declaredNetworkContentLength,
    ).toBeNull()
  })
})
