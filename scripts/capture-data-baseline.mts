import { execFileSync } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'
import { gameLocales, type OperatorDataset, type ReleaseServer } from '../src/shared/operator.ts'
import { gameDataExcelPath, UPSTREAM, validateOperatorDataset } from '../src/shared/operatorData.ts'
import {
  fetchAndBuildOperatorDataset,
  fetchLatestOperatorDatasetSources,
} from '../src/shared/operatorDataPipeline.ts'
import {
  canonicalJson,
  compareJson,
  datasetBehavior,
  requestSummary,
  sha256,
  type BaselineRequest,
} from './lib/dataBaseline.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} needs a value`)
  return args[index + 1]
}
if (args.includes('--help')) {
  console.log(
    'Capture: node --experimental-transform-types scripts/capture-data-baseline.mts --online --output .tmp/data-baseline/capture',
  )
  console.log(
    'Replay: add --cache .tmp/data-baseline/capture/inputs, omit --online, and choose a new --output directory.',
  )
  console.log(
    'Compare: add --compare <earlier capture directory>. --dataset <operators.json> selects the local roster.',
  )
  process.exit(0)
}
const output = resolve(projectRoot, option('--output', '.tmp/data-baseline/capture')!)
const cacheRoot = resolve(projectRoot, option('--cache', join(output, 'inputs'))!)
const datasetPath = resolve(
  projectRoot,
  option('--dataset', 'resources/bundled-data/operators/operators.json')!,
)
const compareRoot = option('--compare')
const online = args.includes('--online')
const requests: BaselineRequest[] = []
const failures: Array<{ phase: string; url: string; error: string }> = []
const startedAt = new Date().toISOString()

interface CachedInput {
  url: string
  status: number
  capturedAt: string
  sha256: string
  decodedBytes: number
  declaredContentLength: number | null
  contentEncoding: string | null
}

async function input(
  url: string,
  init?: RequestInit,
): Promise<{ metadata: CachedInput; bytes: Uint8Array; source: 'network' | 'cache' }> {
  const parsedUrl = new URL(url)
  if (
    parsedUrl.protocol !== 'https:' ||
    !['raw.githubusercontent.com', 'api.github.com', 'prts.wiki'].includes(parsedUrl.hostname)
  )
    throw new Error(`Unexpected baseline source: ${url}`)
  const key = sha256(url)
  const metadataPath = join(cacheRoot, `${key}.json`)
  const bodyPath = join(cacheRoot, `${key}.body`)
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as CachedInput
    const bytes = await readFile(bodyPath)
    if (
      metadata.url !== url ||
      metadata.sha256 !== sha256(bytes) ||
      metadata.decodedBytes !== bytes.byteLength
    )
      throw new Error(`Baseline input integrity check failed: ${url}`)
    return { metadata, bytes, source: 'cache' }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (!online) throw new Error(`Offline baseline input is missing: ${url}`)
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) })
  const bytes = new Uint8Array(await response.arrayBuffer())
  const length = response.headers.get('content-length')
  const metadata: CachedInput = {
    url,
    status: response.status,
    capturedAt: new Date().toISOString(),
    sha256: sha256(bytes),
    decodedBytes: bytes.byteLength,
    declaredContentLength: length !== null && /^\d+$/.test(length) ? Number(length) : null,
    contentEncoding: response.headers.get('content-encoding'),
  }
  if (response.ok) {
    await mkdir(cacheRoot, { recursive: true })
    await writeFile(bodyPath, bytes)
    await writeFile(metadataPath, canonicalJson(metadata))
  }
  return { metadata, bytes, source: 'network' }
}

function measuredFetch(phase: string): typeof fetch {
  return async (resource, init) => {
    const url =
      typeof resource === 'string'
        ? resource
        : resource instanceof URL
          ? resource.href
          : resource.url
    const started = performance.now()
    let result: Awaited<ReturnType<typeof input>>
    try {
      result = await input(url, init)
    } catch (error) {
      failures.push({ phase, url, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
    const { metadata, bytes, source } = result
    requests.push({
      phase,
      url,
      status: metadata.status,
      source,
      decodedBytes: metadata.decodedBytes,
      declaredContentLength: metadata.declaredContentLength,
      contentEncoding: metadata.contentEncoding,
      elapsedMs: performance.now() - started,
      bodySha256: metadata.sha256,
    })
    return new Response(new Uint8Array(bytes), {
      status: metadata.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function saveJson(
  path: string,
  value: unknown,
): Promise<{ path: string; bytes: number; sha256: string }> {
  const text = canonicalJson(value)
  await mkdir(dirname(join(output, path)), { recursive: true })
  await writeFile(join(output, path), text, 'utf8')
  return { path, bytes: Buffer.byteLength(text), sha256: sha256(text) }
}

async function main(): Promise<void> {
  try {
    await access(join(output, 'report.json'))
    throw new Error(
      'This capture already exists. Choose a new output directory to preserve the baseline.',
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const readStarted = performance.now()
  const originalBytes = await readFile(datasetPath)
  const dataset = JSON.parse(originalBytes.toString('utf8')) as OperatorDataset
  const readParseMs = performance.now() - readStarted
  const validationStarted = performance.now()
  const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
  const validationMs = performance.now() - validationStarted
  if (!validation.valid) throw new Error(`Local dataset invalid: ${validation.errors.join('; ')}`)

  // Vite's existing module loader resolves the legacy extensionless shared imports.
  // Middleware mode does not start a preview/listening HTTP server or load app config.
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'error',
  })
  try {
    const { localizeOperatorDataset } = (await server.ssrLoadModule(
      '/src/shared/gameLocalization.ts',
    )) as typeof import('../src/shared/gameLocalization.ts')
    const { loadGarrisonEvents } = (await server.ssrLoadModule(
      '/src/shared/loadGarrisonEvents.ts',
    )) as typeof import('../src/shared/loadGarrisonEvents.ts')
    const { garrisonEventHelperOperator } = (await server.ssrLoadModule(
      '/src/shared/garrisonEventHelper.ts',
    )) as typeof import('../src/shared/garrisonEventHelper.ts')
    const snapshots: Array<{ path: string; bytes: number; sha256: string }> = []
    function behavior(value: OperatorDataset) {
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
    const localizeStarted = performance.now()
    snapshots.push(await saveJson('local-operator-behavior.json', behavior(dataset)))
    const localizeAndSnapshotMs = performance.now() - localizeStarted
    await saveJson('local-dataset.json', dataset)
    console.log(`Local roster captured: ${dataset.operators.length} operators`)

    const sourceStarted = performance.now()
    const latestSources = await fetchLatestOperatorDatasetSources({
      fetchImpl: measuredFetch('source-check'),
    })
    const sourceCheckMs = performance.now() - sourceStarted
    await saveJson('detected-sources.json', latestSources)
    const rebuildStarted = performance.now()
    console.log('Measuring the existing full operator pipeline...')
    const built = await fetchAndBuildOperatorDataset(latestSources, startedAt, {
      fetchImpl: measuredFetch('operator-rebuild'),
    })
    const rebuildMs = performance.now() - rebuildStarted
    if (!built.validation.valid)
      throw new Error(`Rebuilt dataset invalid: ${built.validation.errors.join('; ')}`)
    snapshots.push(await saveJson('rebuilt-operator-behavior.json', behavior(built.dataset)))
    const rebuiltFile = await saveJson('rebuilt-dataset.json', built.dataset)

    const catalogSummaries: Array<Record<string, unknown>> = []
    // Base regions first; all ten region/language combinations retain separate outputs.
    const cases = [
      ['global', 'en'],
      ['cn', 'cn'],
      ...(['cn', 'global'] as const).flatMap((region) =>
        gameLocales
          .filter((locale) => locale !== (region === 'cn' ? 'cn' : 'en'))
          .map((locale) => [region, locale]),
      ),
    ] as Array<[ReleaseServer, (typeof gameLocales)[number]]>
    for (const [region, locale] of cases) {
      const phase = `garrison-${region}-${locale}`
      const fetchTable = measuredFetch(phase)
      const catalogStarted = performance.now()
      const catalog = await loadGarrisonEvents(region, locale, async (language, filename) => {
        const url = `https://raw.githubusercontent.com/${UPSTREAM.gamedataRepo}/${latestSources.gamedataCnCommit}/${gameDataExcelPath(language, filename)}`
        const response = await fetchTable(url, {
          headers: { 'User-Agent': 'arknights-randomizer-m1-baseline' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
        return response.json() as Promise<Record<string, unknown>>
      })
      if (!catalog.localized)
        throw new Error(`Incomplete localization in baseline: ${region}/${locale}`)
      const events = catalog.events.map((event) => ({
        ...event,
        helperOperatorId:
          garrisonEventHelperOperator(event, built.dataset.operators, region)?.id ?? null,
      }))
      const elapsedMs = performance.now() - catalogStarted
      snapshots.push(
        await saveJson(`catalogs/${region}-${locale}.json`, { region, locale, events }),
      )
      const summary = {
        region,
        locale,
        eventCount: events.length,
        stageEntries: events.reduce(
          (sum, event) =>
            sum + Object.values(event.stages).reduce((total, codes) => total + codes.length, 0),
          0,
        ),
        helperCount: events.filter((event) => event.helperOperatorId !== null).length,
        elapsedMs,
        ...requestSummary(requests.filter((request) => request.phase === phase)),
      }
      catalogSummaries.push(summary)
      console.log(`Garrison ${region}/${locale}: ${events.length} events`)
    }

    const sameSourceDrift = compareJson(behavior(dataset), behavior(built.dataset))
    if (
      failures.length ||
      requests.some((request) => request.status < 200 || request.status >= 300)
    ) {
      await saveJson('capture-failures.json', {
        failures,
        failedResponses: requests.filter(
          (request) => request.status < 200 || request.status >= 300,
        ),
      })
      throw new Error(
        'Baseline capture has incomplete inputs. Resolve capture-failures.json before using this baseline.',
      )
    }
    const comparisons: Array<Record<string, unknown>> = []
    if (compareRoot) {
      const previousRoot = resolve(projectRoot, compareRoot)
      const previous = JSON.parse(await readFile(join(previousRoot, 'report.json'), 'utf8')) as {
        snapshots: Array<{ path: string; sha256: string }>
      }
      const previousPaths = new Set(previous.snapshots.map((snapshot) => snapshot.path))
      const currentPaths = new Set(snapshots.map((snapshot) => snapshot.path))
      if (
        previousPaths.size !== currentPaths.size ||
        [...previousPaths].some((path) => !currentPaths.has(path))
      )
        throw new Error('Baseline snapshot set changed; compare captures with the same format.')
      for (const snapshot of snapshots) {
        const oldBytes = await readFile(join(previousRoot, snapshot.path))
        if (
          sha256(oldBytes) !==
          previous.snapshots.find((entry) => entry.path === snapshot.path)!.sha256
        )
          throw new Error(`Previous baseline changed: ${snapshot.path}`)
        comparisons.push({
          path: snapshot.path,
          ...compareJson(
            JSON.parse(oldBytes.toString('utf8')),
            JSON.parse(await readFile(join(output, snapshot.path), 'utf8')),
          ),
        })
      }
    }
    const trackedSourcePaths = [
      'src/shared/operatorDataPipeline.ts',
      'src/shared/operatorData.ts',
      'src/shared/operatorAssets.ts',
      'src/shared/dataCorrections.ts',
      'src/shared/operator.ts',
      'src/shared/releaseMetadata.ts',
      'src/shared/acquisitionMetadata.ts',
      'src/shared/operatorMetadata.ts',
      'src/shared/skinMetadata.ts',
      'src/shared/raceMetadata.ts',
      'src/shared/genderMetadata.ts',
      'src/shared/bundledOperatorGenders.ts',
      'src/shared/gameLocalization.ts',
      'src/shared/releaseEventNames.ts',
      'src/shared/loadGarrisonEvents.ts',
      'src/shared/garrisonEventCatalog.ts',
      'src/shared/garrisonEventHelper.ts',
      'scripts/capture-data-baseline.mts',
      'scripts/lib/dataBaseline.ts',
    ]
    const sourceFiles: Array<{ path: string; sha256: string }> = []
    // Serial directory creation avoids Windows contention between shared archive parents.
    for (const path of trackedSourcePaths) {
      const bytes = await readFile(join(projectRoot, path))
      const target = join(output, 'producer-source', path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
      sourceFiles.push({ path, sha256: sha256(bytes) })
    }
    const report = {
      formatVersion: 1,
      capturedAt: startedAt,
      completedAt: new Date().toISOString(),
      mode: online ? 'network-allowed' : 'offline-replay',
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      provenance: {
        gitHead: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: projectRoot,
          encoding: 'utf8',
        }).trim(),
        workingTree: execFileSync('git', ['status', '--short'], {
          cwd: projectRoot,
          encoding: 'utf8',
        }).trim(),
        sourceFiles,
        datasetPath: relative(projectRoot, datasetPath),
        originalDatasetSha256: sha256(originalBytes),
        originalDatasetBytes: originalBytes.byteLength,
        originalGeneratedAt: dataset.generatedAt,
        originalSources: dataset.sources,
        detectedSources: latestSources,
        garrisonSourcePolicy:
          'Moving legacy source resolved once, then pinned for this capture; no claim that old app caches used this same revision.',
      },
      local: {
        operatorCount: dataset.operators.length,
        releaseEventCount: dataset.releaseEvents?.length ?? 0,
        schemaVersion: dataset.schemaVersion,
        dataPipelineVersion: dataset.dataPipelineVersion,
        skinMetadataVersion: dataset.skinMetadataVersion,
        validation,
        readParseMs,
        validationMs,
        localizeAndSnapshotMs,
      },
      rebuild: {
        operatorCount: built.dataset.operators.length,
        releaseEventCount: built.dataset.releaseEvents?.length ?? 0,
        validation: built.validation,
        elapsedMs: rebuildMs,
        output: rebuiltFile,
        sourceCheckMs,
        ...requestSummary(requests.filter((request) => request.phase === 'operator-rebuild')),
      },
      localToRebuiltComparison: sameSourceDrift,
      catalogs: catalogSummaries,
      snapshots,
      comparisons,
      requests,
      totals: requestSummary(requests),
      measurementScope: {
        timings:
          'One observation per phase; source-check and fetch/normalize/validate pipeline timings are separate. Excludes Electron startup, artwork, staging, activation and UI rendering. Catalog timings may reuse captured inputs; inspect per-phase network/cache counts.',
        bytes:
          'Decoded HTTP response bodies. Declared content lengths are recorded separately when available; neither includes HTTP/TLS overhead. Logical request bytes include replayed bodies and must not be called network transfer.',
        replay:
          'Inputs are cached by full URL and verified by SHA-256. Omit --online to forbid network, and reuse --cache. Moving branch refs and PRTS responses are frozen by the capture; the old bundle did not record its PRTS input.',
      },
    }
    await saveJson('report.json', report)
    console.log(
      JSON.stringify(
        {
          report: join(output, 'report.json'),
          operators: built.dataset.operators.length,
          catalogs: catalogSummaries.length,
          ...report.totals,
          comparisonEqual: comparisons.length ? comparisons.every((entry) => entry.equal) : null,
        },
        null,
        2,
      ),
    )
    if (comparisons.some((entry) => !entry.equal)) process.exitCode = 2
  } finally {
    await server.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
