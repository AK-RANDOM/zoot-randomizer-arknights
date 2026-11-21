import { access, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import {
  captureDataPackage,
  rebuildDataPackage,
  validatePreparedDataPackage,
} from '../src/shared/dataPackageProducer.ts'
import type { DataPackageInput, DataPackageInputSnapshot } from '../src/shared/dataPackage.ts'
import type { OperatorDataset, OperatorDatasetSources } from '../src/shared/operator.ts'
import {
  canonicalPackageJson,
  correctionsSnapshot,
  dataSha256,
} from '../src/shared/dataPackageJson.ts'
import { compareJson, operatorBehaviorSnapshot } from './lib/dataBaseline.ts'

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
    'M1 replay: node --experimental-transform-types scripts/build-data-package.mts --from-baseline <capture directory> --output <new directory>',
  )
  console.log(
    'Package replay: --snapshot <capture/snapshot.json> --output <new directory> [--compare-baseline <M1 capture>]',
  )
  console.log(
    'Live capture: --online --output <new directory>. Outputs a prepared package and frozen evidence; never installs or publishes it.',
  )
  process.exit(0)
}

const PRODUCER_FILES = [
  'src/shared/operator.ts',
  'src/shared/operatorData.ts',
  'src/shared/operatorAssets.ts',
  'src/shared/operatorDataPipeline.ts',
  'src/shared/acquisitionMetadata.ts',
  'src/shared/operatorMetadata.ts',
  'src/shared/releaseMetadata.ts',
  'src/shared/releaseEventNames.ts',
  'src/shared/raceMetadata.ts',
  'src/shared/genderMetadata.ts',
  'src/shared/bundledOperatorGenders.ts',
  'src/shared/skinMetadata.ts',
  'src/shared/garrisonEventCatalog.ts',
  'src/shared/garrisonEventHelper.ts',
  'src/shared/loadGarrisonEvents.ts',
  'src/shared/gameLocalization.ts',
  'src/shared/dataCorrections.ts',
  'src/shared/dataPackage.ts',
  'src/shared/dataPackageJson.ts',
  'src/shared/dataPackageFormat.ts',
  'src/shared/dataPackageValidation.ts',
  'src/shared/dataPackageValidationNode.ts',
  'src/shared/dataPackageInputs.ts',
  'src/shared/dataPackageProducer.ts',
].sort()

async function mustBeNew(path: string): Promise<void> {
  try {
    await access(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  throw new Error(`Output already exists; leave existing evidence/package untouched: ${path}`)
}

async function main(): Promise<void> {
  const modes = [
    args.includes('--online'),
    !!option('--from-baseline'),
    !!option('--snapshot'),
  ].filter(Boolean).length
  if (modes !== 1) throw new Error('Choose exactly one of --online, --from-baseline or --snapshot.')
  const output = resolve(projectRoot, option('--output', '.tmp/data-package/prepared')!)
  await mustBeNew(output)
  const sourceFiles = await Promise.all(
    PRODUCER_FILES.map(async (path) => ({
      path,
      sha256: dataSha256(await readFile(join(projectRoot, path))),
    })),
  )
  const producerSourceSha256 = dataSha256(canonicalPackageJson(sourceFiles))
  const baselineOption = option('--from-baseline')
  const baselineRoot = baselineOption ? resolve(projectRoot, baselineOption) : undefined
  const compareRoot = resolve(projectRoot, option('--compare-baseline', baselineRoot ?? '')!)
  const shouldCompare = !!option('--compare-baseline') || !!baselineRoot
  let snapshot: DataPackageInputSnapshot | undefined
  let readInput: ((input: DataPackageInput) => Promise<Uint8Array>) | undefined
  if (baselineRoot) {
    const report = JSON.parse(await readFile(join(baselineRoot, 'report.json'), 'utf8')) as {
      capturedAt: string
      provenance: { detectedSources: OperatorDatasetSources }
      requests: Array<{ url: string; bodySha256: string; decodedBytes: number; status: number }>
    }
    const unique = new Map<string, DataPackageInput>()
    for (const request of report.requests) {
      if (new URL(request.url).hostname === 'api.github.com') continue
      if (request.status !== 200)
        throw new Error('Cannot reuse a baseline containing failed source responses.')
      const descriptor = {
        url: request.url,
        sha256: request.bodySha256,
        bytes: request.decodedBytes,
      }
      const previous = unique.get(request.url)
      if (previous && canonicalPackageJson(previous) !== canonicalPackageJson(descriptor))
        throw new Error(`Baseline contains inconsistent source bodies: ${request.url}`)
      unique.set(request.url, descriptor)
    }
    snapshot = {
      formatVersion: 1,
      generatedAt: report.capturedAt,
      sources: {
        gamedataCommit: report.provenance.detectedSources.gamedataCnCommit!,
        releaseMetadataCommit: report.provenance.detectedSources.releaseMetadataCommit!,
      },
      inputs: [...unique.values()],
    }
    readInput = (input) => readFile(join(baselineRoot, 'inputs', `${dataSha256(input.url)}.body`))
  } else if (option('--snapshot')) {
    const snapshotPath = resolve(projectRoot, option('--snapshot')!)
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as DataPackageInputSnapshot
    readInput = (input) => readFile(join(dirname(snapshotPath), 'bodies', `${input.sha256}.body`))
  }
  const previousPath = resolve(
    projectRoot,
    option(
      '--previous-dataset',
      baselineRoot
        ? join(baselineRoot, 'local-dataset.json')
        : 'resources/bundled-data/operators/operators.json',
    )!,
  )
  const previousDataset = JSON.parse(await readFile(previousPath, 'utf8')) as OperatorDataset
  const previousSnapshotPath = option('--previous-snapshot')
  if (previousSnapshotPath && !args.includes('--online'))
    throw new Error(
      '--previous-snapshot applies to a live capture; frozen rebuilds already retain observation time.',
    )
  const previousSnapshot = previousSnapshotPath
    ? (JSON.parse(
        await readFile(resolve(projectRoot, previousSnapshotPath), 'utf8'),
      ) as DataPackageInputSnapshot)
    : undefined
  const started = performance.now()
  let networkRequests = 0
  const fetchImpl: typeof fetch = async (resource, init) => {
    networkRequests++
    return fetch(resource, init)
  }
  const result = snapshot
    ? await rebuildDataPackage(snapshot, readInput!, { producerSourceSha256, previousDataset })
    : await captureDataPackage({
        producerSourceSha256,
        previousDataset,
        previousSnapshot,
        fetchImpl,
      })
  const elapsedMs = performance.now() - started
  const { prepared } = result
  const comparisons: Array<{
    path: string
    equal: boolean
    changeCount: number
    changes: unknown[]
    truncated: boolean
  }> = []
  if (shouldCompare) {
    const report = JSON.parse(await readFile(join(compareRoot, 'report.json'), 'utf8')) as {
      snapshots: Array<{ path: string; sha256: string }>
    }
    async function compare(path: string, value: unknown): Promise<void> {
      const expected = report.snapshots.find((entry) => entry.path === path)
      if (!expected) throw new Error(`Baseline snapshot is missing: ${path}`)
      const body = await readFile(join(compareRoot, path))
      if (dataSha256(body) !== expected.sha256)
        throw new Error(`Baseline snapshot checksum mismatch: ${path}`)
      comparisons.push({ path, ...compareJson(JSON.parse(body.toString('utf8')), value) })
    }
    await compare('rebuilt-operator-behavior.json', operatorBehaviorSnapshot(prepared.dataset))
    for (const catalog of prepared.catalogs)
      await compare(`catalogs/${catalog.region}-${catalog.locale}.json`, {
        region: catalog.region,
        locale: catalog.locale,
        events: catalog.events,
      })
  }
  const validation = validatePreparedDataPackage(prepared, previousDataset)
  if (!validation.valid)
    throw new Error(`Package validation failed: ${validation.errors.join('; ')}`)
  const baselineMatches = comparisons.every((comparison) => comparison.equal)
  const payloadDirectory = baselineMatches ? 'package' : 'evidence/candidate'
  await mkdir(dirname(output), { recursive: true })
  const stage = await mkdtemp(join(dirname(output), '.data-package-'))
  async function write(path: string, body: string | Uint8Array): Promise<void> {
    const target = join(stage, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, body)
  }
  try {
    for (const [path, body] of Object.entries(prepared.files))
      await write(`${payloadDirectory}/${path}`, body)
    await write(`${payloadDirectory}/manifest.json`, canonicalPackageJson(prepared.manifest))
    await write('capture/snapshot.json', canonicalPackageJson(result.snapshot))
    for (const [digest, bytes] of result.inputBodies)
      await write(`capture/bodies/${digest}.body`, bytes)
    await write('evidence/source-inventory.json', canonicalPackageJson(sourceFiles))
    for (const source of sourceFiles)
      await write(
        `evidence/producer-source/${source.path}`,
        await readFile(join(projectRoot, source.path)),
      )
    await write('evidence/corrections.json', canonicalPackageJson(correctionsSnapshot()))
    const summary = {
      packageId: prepared.manifest.packageId,
      generatedAt: prepared.manifest.generatedAt,
      producerSourceSha256,
      elapsedMs,
      networkRequests,
      inputRequests: result.inputRequests,
      uniqueInputs: result.snapshot.inputs.length,
      decodedInputBytes: result.snapshot.inputs.reduce((sum, input) => sum + input.bytes, 0),
      operatorCount: prepared.dataset.operators.length,
      catalogCount: prepared.catalogs.length,
      payloadBytes: prepared.manifest.files.reduce((sum, file) => sum + file.bytes, 0),
      validation,
      comparisons,
      eligibleForPublication: baselineMatches,
      scope:
        'Prepared package only. No application activation, publication, CI or deployment. Capture bodies and evidence are producer artifacts, not client package contents.',
      expectedEnvelopeChanges: [
        'Garrison payloads gain schemaVersion 1.',
        'Operator resourcesCommit is null; artwork is outside metadata identity.',
        'Serialization sorts object keys deterministically; arrays and behavior fields retain their existing order.',
      ],
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
    }
    await write('build-report.json', canonicalPackageJson(summary))
    await mustBeNew(output)
    await rename(stage, output)
    console.log(
      JSON.stringify(
        {
          output,
          ...summary,
          comparisons: comparisons.map(({ path, equal, changeCount }) => ({
            path,
            equal,
            changeCount,
          })),
        },
        null,
        2,
      ),
    )
    if (!baselineMatches) process.exitCode = 2
  } catch (error) {
    // Keep failed write evidence in its separate stage; existing packages are never removed.
    throw new Error(`Package output failed; staging evidence retained at ${stage}`, {
      cause: error,
    })
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
