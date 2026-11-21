import { createHash } from 'node:crypto'
import { gameLocales, type OperatorDataset } from '../../src/shared/operator.ts'
import { localizeOperatorDataset } from '../../src/shared/gameLocalization.ts'

export function operatorBehaviorSnapshot(value: OperatorDataset) {
  return {
    dataset: datasetBehavior(value as unknown as Record<string, unknown>),
    localizedViews: Object.fromEntries(
      gameLocales.map((locale) => {
        const localized = localizeOperatorDataset(value, locale)
        return [
          locale,
          {
            operators: localized.operators.map((operator) => ({
              id: operator.id,
              name: operator.name,
              subclass: operator.subclass,
            })),
            classLabels: localized.classLabels,
            factionLabels: localized.factionLabels,
            raceLabels: localized.raceLabels,
          },
        ]
      }),
    ),
  }
}

export function canonicalJson(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, entry: unknown) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          return Object.fromEntries(
            Object.entries(entry).sort(([left], [right]) => left.localeCompare(right, 'en')),
          )
        }
        return entry
      },
      2,
    ) + '\n'
  )
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Only provenance is excluded. Entity order and every behavior/display field remain significant. */
export function datasetBehavior(dataset: Record<string, unknown>): Record<string, unknown> {
  const omitted = new Set(['generatedAt', 'sources', 'dataPipelineVersion', 'skinMetadataVersion'])
  return Object.fromEntries(Object.entries(dataset).filter(([key]) => !omitted.has(key)))
}

export interface BaselineChange {
  path: string
  beforePresent: boolean
  afterPresent: boolean
  before?: unknown
  after?: unknown
}

/** JSON pointers identify changed fields; object key order is ignored, array order is preserved. */
export function compareJson(
  before: unknown,
  after: unknown,
  limit = 100,
): {
  equal: boolean
  changeCount: number
  changes: BaselineChange[]
  truncated: boolean
} {
  const changes: BaselineChange[] = []
  let changeCount = 0
  function visit(
    left: unknown,
    right: unknown,
    path: string,
    leftPresent = true,
    rightPresent = true,
  ): void {
    if (leftPresent === rightPresent && Object.is(left, right)) return
    const arrays = Array.isArray(left) && Array.isArray(right)
    const objects =
      left &&
      right &&
      typeof left === 'object' &&
      typeof right === 'object' &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    if (leftPresent && rightPresent && (arrays || objects)) {
      const a = left as Record<string, unknown>
      const b = right as Record<string, unknown>
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1')
        visit(a[key], b[key], `${path}/${escaped}`, Object.hasOwn(a, key), Object.hasOwn(b, key))
      }
      return
    }
    changeCount++
    if (changes.length < limit)
      changes.push({
        path,
        beforePresent: leftPresent,
        afterPresent: rightPresent,
        before: left,
        after: right,
      })
  }
  visit(before, after, '')
  return { equal: changeCount === 0, changeCount, changes, truncated: changeCount > changes.length }
}

export interface BaselineRequest {
  phase: string
  url: string
  status: number
  source: 'network' | 'cache'
  decodedBytes: number
  declaredContentLength: number | null
  contentEncoding: string | null
  elapsedMs: number
  bodySha256: string
}

export function requestSummary(requests: readonly BaselineRequest[]) {
  const network = requests.filter((request) => request.source === 'network')
  return {
    logicalRequests: requests.length,
    networkRequests: network.length,
    cacheHits: requests.length - network.length,
    logicalDecodedBytes: requests.reduce((sum, request) => sum + request.decodedBytes, 0),
    networkDecodedBytes: network.reduce((sum, request) => sum + request.decodedBytes, 0),
    // These are HTTP body header values, not a measurement of TLS/HTTP wire traffic.
    declaredNetworkContentLength: network.every((request) => request.declaredContentLength !== null)
      ? network.reduce((sum, request) => sum + request.declaredContentLength!, 0)
      : null,
  }
}
