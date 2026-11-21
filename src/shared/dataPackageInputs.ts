import { UPSTREAM } from './operatorData.ts'
import { CN_RELEASE_DATES_API } from './releaseMetadata.ts'
import type {
  DataPackageInput,
  DataPackageInputSnapshot,
  DataPackageSources,
} from './dataPackage.ts'
import { canonicalPackageJson, dataSha256 } from './dataPackageJson.ts'

export function validatePackageSources(sources: DataPackageSources): void {
  for (const revision of [sources.gamedataCommit, sources.releaseMetadataCommit]) {
    if (!/^[a-f0-9]{40}$/.test(revision))
      throw new Error('Prepared data requires full immutable source commit SHAs.')
  }
}

export async function fetchLatestDataPackageSources(
  fetchImpl: typeof fetch = fetch,
): Promise<DataPackageSources> {
  async function head(repo: string, branch: string): Promise<string> {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/git/ref/heads/${branch}`,
      {
        headers: { 'User-Agent': 'arknights-randomizer-data-package' },
        signal: AbortSignal.timeout(120_000),
      },
    )
    if (!response.ok) throw new Error(`Source check failed: ${repo} (${response.status})`)
    const body = (await response.json()) as { object?: { sha?: string } }
    return body.object?.sha ?? ''
  }
  const [gamedataCommit, releaseMetadataCommit] = await Promise.all([
    head(UPSTREAM.gamedataRepo, 'master'),
    head(UPSTREAM.releaseRepo, 'main'),
  ])
  const sources = { gamedataCommit, releaseMetadataCommit }
  validatePackageSources(sources)
  return sources
}

export function validatePackageInputUrl(url: string, sources: DataPackageSources): void {
  const parsed = new URL(url)
  const gamePrefix = `https://raw.githubusercontent.com/${UPSTREAM.gamedataRepo}/${sources.gamedataCommit}/`
  const releasePrefix = `https://raw.githubusercontent.com/${UPSTREAM.releaseRepo}/${sources.releaseMetadataCommit}/`
  if (
    url.startsWith(gamePrefix) &&
    /^(cn|en|jp|kr|tw)\/gamedata\/excel\/[a-z_0-9]+\.json$/.test(url.slice(gamePrefix.length))
  )
    return
  if (
    url.startsWith(releasePrefix) &&
    [UPSTREAM.releaseInfoPath, UPSTREAM.releaseCandidatePath, UPSTREAM.releaseEventPath].some(
      (path) => url === releasePrefix + path,
    )
  )
    return
  if (
    parsed.origin + parsed.pathname === CN_RELEASE_DATES_API &&
    !parsed.hash &&
    parsed.searchParams.get('action') === 'cargoquery' &&
    parsed.searchParams.get('format') === 'json' &&
    parsed.searchParams.get('tables') === 'char_obtain' &&
    parsed.searchParams.get('fields') === '_pageName=name,cnOnlineTime=releaseDate' &&
    parsed.searchParams.get('limit') === '500' &&
    parsed.searchParams.get('order_by') === '_pageName' &&
    /^(0|[1-9]\d*)$/.test(parsed.searchParams.get('offset') ?? '') &&
    Number(parsed.searchParams.get('offset')) % 500 === 0 &&
    [...parsed.searchParams.keys()].length === 7
  )
    return
  throw new Error(`Unpinned or unexpected package input: ${url}`)
}

/** One immutable body per URL, shared by the operator builder and every region/language catalog. */
export class DataPackageInputSession {
  private readonly pending = new Map<string, Promise<Uint8Array>>()
  private readonly parsed = new Map<string, unknown>()
  private readonly descriptors = new Map<string, DataPackageInput>()
  private readonly expected: Map<string, DataPackageInput> | undefined
  private readonly failures: string[] = []
  readonly bodies = new Map<string, Uint8Array>()
  readonly sources: DataPackageSources
  readonly generatedAt: string
  requests = 0

  constructor(
    private readonly options: {
      sources: DataPackageSources
      generatedAt: string
      snapshot?: DataPackageInputSnapshot
      readInput?: (input: DataPackageInput) => Promise<Uint8Array>
      fetchImpl?: typeof fetch
    },
  ) {
    this.sources = options.sources
    this.generatedAt = options.generatedAt
    validatePackageSources(this.sources)
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(this.generatedAt) ||
      !Number.isFinite(Date.parse(this.generatedAt))
    )
      throw new Error('Input snapshot requires a valid frozen generation timestamp.')
    if (options.snapshot) {
      if (options.snapshot.formatVersion !== 1 || !options.readInput)
        throw new Error('Offline input snapshot requires format v1 and an input reader.')
      this.expected = new Map()
      for (const input of options.snapshot.inputs) {
        validatePackageInputUrl(input.url, this.sources)
        if (
          this.expected.has(input.url) ||
          !/^[a-f0-9]{64}$/.test(input.sha256) ||
          !Number.isSafeInteger(input.bytes) ||
          input.bytes <= 0
        )
          throw new Error('Invalid or duplicate input descriptor in snapshot.')
        this.expected.set(input.url, input)
      }
    }
  }

  private read(url: string, init?: RequestInit): Promise<Uint8Array> {
    this.requests++
    const existing = this.pending.get(url)
    if (existing) return existing
    const task = (async () => {
      validatePackageInputUrl(url, this.sources)
      let bytes: Uint8Array
      if (this.expected) {
        const descriptor = this.expected.get(url)
        if (!descriptor) throw new Error(`Frozen snapshot is missing input: ${url}`)
        bytes = await this.options.readInput!(descriptor)
        if (bytes.byteLength !== descriptor.bytes || dataSha256(bytes) !== descriptor.sha256)
          throw new Error(`Input checksum mismatch: ${url}`)
      } else {
        const headers = new Headers(init?.headers)
        headers.set('User-Agent', 'arknights-randomizer-data-package')
        const response = await (this.options.fetchImpl ?? fetch)(url, {
          ...init,
          headers,
          signal: AbortSignal.timeout(120_000),
        })
        if (!response.ok) throw new Error(`Input fetch failed: ${url} (${response.status})`)
        bytes = new Uint8Array(await response.arrayBuffer())
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (!url.endsWith('.ts')) {
        const value = JSON.parse(text) as unknown
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error(`Expected source-table object: ${url}`)
        if (url.startsWith(CN_RELEASE_DATES_API)) {
          const rows = (
            value as { cargoquery?: Array<{ title?: { name?: unknown; releaseDate?: unknown } }> }
          ).cargoquery
          if (
            !Array.isArray(rows) ||
            rows.length > 500 ||
            rows.some(
              (row) =>
                !row?.title ||
                typeof row.title.name !== 'string' ||
                typeof row.title.releaseDate !== 'string',
            )
          )
            throw new Error(`Malformed published CN date page: ${url}`)
        }
        this.parsed.set(url, value)
      }
      const descriptor = { url, sha256: dataSha256(bytes), bytes: bytes.byteLength }
      this.descriptors.set(url, descriptor)
      this.bodies.set(descriptor.sha256, bytes)
      return bytes
    })().catch((error: unknown) => {
      this.failures.push(error instanceof Error ? error.message : String(error))
      throw error
    })
    this.pending.set(url, task)
    return task
  }

  fetch: typeof fetch = async (resource, init) => {
    const url =
      typeof resource === 'string'
        ? resource
        : resource instanceof URL
          ? resource.href
          : resource.url
    const bytes = await this.read(url, init)
    const response = new Response(new Uint8Array(bytes), { status: 200 })
    // Inputs are validated once and normalization treats source tables as read-only.
    if (this.parsed.has(url)) response.json = async () => this.parsed.get(url)
    return response
  }

  async json(url: string): Promise<Record<string, unknown>> {
    await this.read(url)
    return this.parsed.get(url) as Record<string, unknown>
  }

  async finish(): Promise<DataPackageInputSnapshot> {
    await Promise.allSettled(this.pending.values())
    if (this.failures.length)
      throw new Error(`Cannot prepare incomplete data: ${this.failures.join('; ')}`)
    if (this.expected && this.expected.size !== this.descriptors.size)
      throw new Error('Frozen snapshot has unused or incomplete inputs.')
    const inputs = [...this.descriptors.values()].sort((a, b) =>
      a.url < b.url ? -1 : a.url > b.url ? 1 : 0,
    )
    const published = inputs.filter((entry) => entry.url.startsWith(CN_RELEASE_DATES_API))
    const rows = published.reduce(
      (sum, entry) =>
        sum + (this.parsed.get(entry.url) as { cargoquery: unknown[] }).cargoquery.length,
      0,
    )
    if (!published.length || !rows)
      throw new Error('Published CN dates must be captured before a package can be prepared.')
    return { formatVersion: 1, generatedAt: this.generatedAt, sources: this.sources, inputs }
  }

  publishedDatesHash(snapshot: DataPackageInputSnapshot): string {
    return dataSha256(
      canonicalPackageJson(
        snapshot.inputs.filter((input) => input.url.startsWith(CN_RELEASE_DATES_API)),
      ),
    )
  }
}
