import * as fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import type {
  DataPackageArtifact,
  DataPackageChannel,
  DataPackageChannelName,
  DataPackageInputSnapshot,
} from './dataPackage.ts'
import { validatePreparedDataPackage } from './dataPackageValidationNode.ts'
import { canonicalPackageJson, dataSha256 } from './dataPackageJson.ts'
import { validatePackageInputUrl, validatePackageSources } from './dataPackageInputs.ts'
import { CN_RELEASE_DATES_API } from './releaseMetadata.ts'

export const DATA_ARTIFACT_LIMIT = 16 * 1024 * 1024

export function packageDigest(packageId: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(packageId)) throw new Error('Invalid data package identity.')
  return packageId.slice(7)
}

export function parseDataPackageArtifact(body: string, expectedId?: string): DataPackageArtifact {
  if (Buffer.byteLength(body) > DATA_ARTIFACT_LIMIT) throw new Error('Data package is too large.')
  const parsed = JSON.parse(body) as DataPackageArtifact
  const result = validatePreparedDataPackage(parsed)
  if (!result.valid) throw new Error(`Invalid data package: ${result.errors.join('; ')}`)
  if (expectedId && parsed.manifest.packageId !== expectedId)
    throw new Error('Data package differs from the requested version.')
  return parsed
}

export async function readDataPackageDirectory(directory: string): Promise<DataPackageArtifact> {
  const manifest = JSON.parse(
    await fs.readFile(join(directory, 'manifest.json'), 'utf8'),
  ) as DataPackageArtifact['manifest']
  const files: Record<string, string> = {}
  const paths = [
    'operators.json',
    ...(['cn', 'global'] as const).flatMap((region) =>
      ['en', 'jp', 'kr', 'tw', 'cn'].map((locale) => `garrison/${region}-${locale}.json`),
    ),
  ]
  for (const path of paths) files[path] = await fs.readFile(join(directory, path), 'utf8')
  return parseDataPackageArtifact(canonicalPackageJson({ manifest, files }))
}

export function validatePublishedSnapshot(
  snapshot: DataPackageInputSnapshot,
  artifact: DataPackageArtifact,
): void {
  validatePackageSources(snapshot.sources)
  if (
    snapshot.formatVersion !== 1 ||
    snapshot.generatedAt !== artifact.manifest.generatedAt ||
    snapshot.sources.gamedataCommit !== artifact.manifest.sources.gamedata.commit ||
    snapshot.sources.releaseMetadataCommit !== artifact.manifest.sources.releaseMetadata.commit ||
    !Array.isArray(snapshot.inputs) ||
    !snapshot.inputs.length ||
    new Set(snapshot.inputs.map((input) => input.url)).size !== snapshot.inputs.length
  )
    throw new Error('Source snapshot differs from its data package.')
  for (const input of snapshot.inputs) {
    validatePackageInputUrl(input.url, snapshot.sources)
    if (
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !Number.isSafeInteger(input.bytes) ||
      input.bytes <= 0
    )
      throw new Error('Invalid published source descriptor.')
  }
  const published = snapshot.inputs.filter((input) => input.url.startsWith(CN_RELEASE_DATES_API))
  if (
    !published.length ||
    dataSha256(canonicalPackageJson(published)) !==
      artifact.manifest.sources.publishedCnDates.inputSha256
  )
    throw new Error('Published date inputs differ from the package.')
}

function requireChannel(
  channel: string,
  packageId: string,
  confirmation?: string,
): asserts channel is DataPackageChannelName {
  packageDigest(packageId)
  if (channel !== 'preview' && channel !== 'production') throw new Error('Unknown data channel.')
  if (channel === 'production' && confirmation !== packageId)
    throw new Error('Production publication requires confirmation of this exact package ID.')
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function atomicWrite(
  store: string,
  target: string,
  body: string | Uint8Array,
): Promise<void> {
  const staging = join(store, '.staging')
  await fs.mkdir(staging, { recursive: true })
  await fs.mkdir(dirname(target), { recursive: true })
  const temporary = join(staging, `${randomUUID()}.json`)
  await fs.writeFile(temporary, body, { flag: 'wx' })
  await fs.rename(temporary, target)
}

async function immutableWrite(store: string, target: string, body: string): Promise<void> {
  if (await exists(target)) {
    if ((await fs.readFile(target, 'utf8')) !== body)
      throw new Error('An immutable data version already exists with different contents.')
    return
  }
  await atomicWrite(store, target, body)
}

async function locked<T>(root: string, action: (store: string) => Promise<T>): Promise<T> {
  const store = resolve(root)
  await fs.mkdir(store, { recursive: true })
  const lockPath = join(store, '.publish.lock')
  const lock = await fs.open(lockPath, 'wx')
  try {
    return await action(store)
  } finally {
    await lock.close()
    await fs.unlink(lockPath)
  }
}

async function advance(
  store: string,
  packageId: string,
  channel: DataPackageChannelName,
): Promise<DataPackageChannel> {
  const directory = join(store, 'packages', packageDigest(packageId))
  const compressed = await fs.readFile(join(directory, 'package.json.gz'))
  const body = gunzipSync(compressed, { maxOutputLength: DATA_ARTIFACT_LIMIT }).toString('utf8')
  const artifact = parseDataPackageArtifact(body, packageId)
  const snapshotBody = await fs.readFile(join(directory, 'snapshot.json'), 'utf8')
  validatePublishedSnapshot(JSON.parse(snapshotBody) as DataPackageInputSnapshot, artifact)
  const pointer: DataPackageChannel = {
    formatVersion: 1,
    channel,
    packageId,
    artifactPath: `packages/${packageDigest(packageId)}/package.json.gz`,
    artifactSha256: dataSha256(body),
    artifactBytes: Buffer.byteLength(body),
    artifactEncoding: 'gzip',
    compressedSha256: dataSha256(compressed),
    compressedBytes: compressed.byteLength,
    snapshotSha256: dataSha256(snapshotBody),
    minimumReaderVersion: artifact.manifest.compatibility.minimumReaderVersion,
    generatedAt: artifact.manifest.generatedAt,
    publishedAt: new Date().toISOString(),
    sources: artifact.manifest.sources,
  }
  // The complete immutable package exists and is validated before the channel is replaced.
  await atomicWrite(
    store,
    join(store, 'channels', `${channel}.json`),
    canonicalPackageJson(pointer),
  )
  return pointer
}

export async function publishPreparedData(options: {
  preparedRoot: string
  store: string
  channel: string
  expectedPackageId: string
  confirmProduction?: string
}): Promise<DataPackageChannel> {
  requireChannel(options.channel, options.expectedPackageId, options.confirmProduction)
  const artifact = await readDataPackageDirectory(join(options.preparedRoot, 'package'))
  const report = JSON.parse(
    await fs.readFile(join(options.preparedRoot, 'build-report.json'), 'utf8'),
  ) as { packageId?: string; eligibleForPublication?: boolean }
  if (
    artifact.manifest.packageId !== options.expectedPackageId ||
    report.packageId !== options.expectedPackageId ||
    report.eligibleForPublication !== true
  )
    throw new Error('Prepared build has not passed the publication gate for this version.')
  const snapshot = JSON.parse(
    await fs.readFile(join(options.preparedRoot, 'capture', 'snapshot.json'), 'utf8'),
  ) as DataPackageInputSnapshot
  validatePublishedSnapshot(snapshot, artifact)
  const body = canonicalPackageJson(artifact)
  if (Buffer.byteLength(body) > DATA_ARTIFACT_LIMIT) throw new Error('Data package is too large.')
  const channel = options.channel
  return locked(options.store, async (store) => {
    const directory = join(store, 'packages', packageDigest(options.expectedPackageId))
    const compressedPath = join(directory, 'package.json.gz')
    if (await exists(compressedPath)) {
      const previous = gunzipSync(await fs.readFile(compressedPath), {
        maxOutputLength: DATA_ARTIFACT_LIMIT,
      }).toString('utf8')
      if (previous !== body)
        throw new Error('An immutable data version already exists with different contents.')
    } else {
      const compressed = gzipSync(body, { level: 9 })
      compressed[9] = 255
      await atomicWrite(store, compressedPath, compressed)
    }
    await immutableWrite(store, join(directory, 'snapshot.json'), canonicalPackageJson(snapshot))
    return advance(store, options.expectedPackageId, channel)
  })
}

/** Rollback selects an already validated immutable version; it never rebuilds historical data. */
export async function advanceDataChannel(options: {
  store: string
  channel: string
  packageId: string
  confirmProduction?: string
}): Promise<DataPackageChannel> {
  requireChannel(options.channel, options.packageId, options.confirmProduction)
  const channel = options.channel
  return locked(options.store, (store) => advance(store, options.packageId, channel))
}
