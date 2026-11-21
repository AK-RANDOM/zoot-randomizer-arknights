import { gameLocales, type OperatorDataset } from './operator.ts'
import type {
  DataPackageArtifact,
  DataPackageChannel,
  DataPackageChannelName,
  PackagedGarrisonCatalog,
} from './dataPackage.ts'
import { DATA_PACKAGE_READER_VERSION } from './dataPackage.ts'
import { canonicalPackageJson, dataPackageIdentityText } from './dataPackageFormat.ts'
import {
  validateDataPackageEnvelope,
  validateDataPackageWithHash,
  validDataPackageSources,
} from './dataPackageValidation.ts'

export const MAX_DATA_PACKAGE_BYTES = 16 * 1024 * 1024
export interface ReadDataPackage {
  artifact: DataPackageArtifact
  dataset: OperatorDataset
  catalogs: PackagedGarrisonCatalog[]
  warnings: string[]
}

export class IncompatibleDataPackageError extends Error {
  constructor() {
    super('This data update requires a newer version of the app.')
  }
}

export async function digestData(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function readDataPackage(value: unknown): Promise<ReadDataPackage> {
  if (typeof value === 'string') {
    if (new TextEncoder().encode(value).byteLength > MAX_DATA_PACKAGE_BYTES)
      throw new Error('Data package exceeds its size limit.')
    value = JSON.parse(value) as unknown
  }
  const envelopeErrors = validateDataPackageEnvelope(value)
  if (envelopeErrors.length) throw new Error(envelopeErrors.join(' '))
  const artifact = value as DataPackageArtifact
  if (artifact.manifest.compatibility.minimumReaderVersion > DATA_PACKAGE_READER_VERSION)
    throw new IncompatibleDataPackageError()
  const texts = new Set([
    dataPackageIdentityText(artifact.manifest),
    ...Object.values(artifact.files),
  ])
  const hashes = new Map(
    await Promise.all([...texts].map(async (text) => [text, await digestData(text)] as const)),
  )
  let validation: ReturnType<typeof validateDataPackageWithHash>
  try {
    validation = validateDataPackageWithHash(artifact, (text) => hashes.get(text) ?? '')
  } catch {
    throw new Error('Malformed data package contents.')
  }
  if (!validation.valid)
    throw new Error(`Data package did not pass validation: ${validation.errors.join(' ')}`)
  return {
    artifact,
    dataset: JSON.parse(artifact.files['operators.json']) as OperatorDataset,
    catalogs: (['cn', 'global'] as const).flatMap((region) =>
      gameLocales.map(
        (locale) =>
          JSON.parse(
            artifact.files[`garrison/${region}-${locale}.json`],
          ) as PackagedGarrisonCatalog,
      ),
    ),
    warnings: validation.warnings,
  }
}

export function readDataChannel(
  value: unknown,
  expected: DataPackageChannelName,
): DataPackageChannel {
  const pointer = value as Partial<DataPackageChannel> | null
  if (
    !pointer ||
    pointer.formatVersion !== 1 ||
    pointer.channel !== expected ||
    typeof pointer.packageId !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(pointer.packageId) ||
    pointer.artifactPath !== `packages/${pointer.packageId.slice(7)}/package.json.gz` ||
    pointer.artifactEncoding !== 'gzip' ||
    !Number.isSafeInteger(pointer.minimumReaderVersion) ||
    !pointer.minimumReaderVersion ||
    pointer.minimumReaderVersion < 1 ||
    !validDataPackageSources(pointer.sources) ||
    typeof pointer.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(pointer.generatedAt))
  )
    throw new Error('Invalid data channel response.')
  for (const digest of [pointer.artifactSha256, pointer.compressedSha256, pointer.snapshotSha256])
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))
      throw new Error('Invalid data channel checksum.')
  for (const length of [pointer.artifactBytes, pointer.compressedBytes])
    if (!Number.isSafeInteger(length) || !length || length < 1 || length > MAX_DATA_PACKAGE_BYTES)
      throw new Error('Invalid data channel size.')
  if (pointer.minimumReaderVersion > DATA_PACKAGE_READER_VERSION)
    throw new IncompatibleDataPackageError()
  return pointer as DataPackageChannel
}

async function limitedBytes(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array> {
  if (!stream) throw new Error('Empty data response.')
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) throw new Error('Data response exceeds its declared size.')
      chunks.push(next.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

export async function fetchDataChannel(
  baseUrl: string,
  channel: DataPackageChannelName,
  fetchImpl: typeof fetch = fetch,
): Promise<DataPackageChannel> {
  const response = await fetchImpl(new URL(`channels/${channel}.json`, baseUrl), {
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Data update check failed (${response.status}).`)
  const bytes = await limitedBytes(response.body, 32 * 1024)
  return readDataChannel(JSON.parse(new TextDecoder().decode(bytes)) as unknown, channel)
}

export async function fetchDataPackage(
  baseUrl: string,
  pointer: DataPackageChannel,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadDataPackage> {
  const response = await fetchImpl(new URL(pointer.artifactPath, baseUrl), {
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`Data download failed (${response.status}).`)
  const compressed = await limitedBytes(response.body, pointer.compressedBytes)
  if (
    compressed.byteLength !== pointer.compressedBytes ||
    (await digestData(compressed)) !== pointer.compressedSha256
  )
    throw new Error('Downloaded data checksum/size mismatch.')
  const decompressed = new Response(new Uint8Array(compressed).buffer).body!.pipeThrough(
    new DecompressionStream('gzip'),
  )
  const decoded = await limitedBytes(decompressed, pointer.artifactBytes)
  if (
    decoded.byteLength !== pointer.artifactBytes ||
    (await digestData(decoded)) !== pointer.artifactSha256
  )
    throw new Error('Decoded data checksum/size mismatch.')
  const parsed = await readDataPackage(new TextDecoder('utf-8', { fatal: true }).decode(decoded))
  if (
    parsed.artifact.manifest.packageId !== pointer.packageId ||
    parsed.artifact.manifest.generatedAt !== pointer.generatedAt ||
    parsed.artifact.manifest.compatibility.minimumReaderVersion !== pointer.minimumReaderVersion ||
    canonicalPackageJson(parsed.artifact.manifest.sources) !== canonicalPackageJson(pointer.sources)
  )
    throw new Error('Downloaded package differs from its data channel.')
  return parsed
}
