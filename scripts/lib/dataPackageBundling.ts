import { buildArtworkInventory } from '../../src/shared/artworkInventory.ts'
import type { OperatorDataset } from '../../src/shared/operator.ts'
import * as fs from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { DATA_PACKAGE_PIN } from '../../src/shared/dataPackagePin.ts'
import type { DataPackageInputSnapshot } from '../../src/shared/dataPackage.ts'
import type { DataPackageChannelName } from '../../src/shared/dataPackage.ts'
import {
  packageDigest,
  parseDataPackageArtifact,
  validatePublishedSnapshot,
} from '../../src/shared/dataPackageDistribution.ts'
import { canonicalPackageJson, dataSha256 } from '../../src/shared/dataPackageJson.ts'

export interface DataBuildInfo {
  schemaVersion: 1
  applicationCommit: string
  sourceDirty: boolean
  packageId: string
  artifactSha256: string
  channel: DataPackageChannelName
  artworkId: string
}

async function selectedBody(
  projectRoot: string,
  kind: 'package' | 'snapshot',
  options: { store?: string; fetchImpl?: typeof fetch },
) {
  const digest = packageDigest(DATA_PACKAGE_PIN.packageId)
  const expectedHash =
    kind === 'package' ? DATA_PACKAGE_PIN.artifactSha256 : DATA_PACKAGE_PIN.snapshotSha256
  const filename = kind === 'package' ? 'package.json.gz' : 'snapshot.json'
  const relativePath = `packages/${digest}/${filename}`
  const verify = (bytes: Uint8Array) => {
    const body =
      kind === 'package'
        ? gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }).toString('utf8')
        : Buffer.from(bytes).toString('utf8')
    if (
      dataSha256(body) !== expectedHash ||
      (kind === 'package' && Buffer.byteLength(body) !== DATA_PACKAGE_PIN.artifactBytes)
    )
      throw new Error(`Pinned ${kind} checksum/size mismatch.`)
    return body
  }
  if (options.store) return verify(await fs.readFile(join(resolve(options.store), relativePath)))
  const cache = join(projectRoot, 'resources', 'cache', 'data-packages', digest, filename)
  try {
    return verify(await fs.readFile(cache))
  } catch {
    /* Re-fetch this exact version; never select another version. */
  }
  const response = await (options.fetchImpl ?? fetch)(
    new URL(relativePath, DATA_PACKAGE_PIN.baseUrl),
    { signal: AbortSignal.timeout(120_000) },
  )
  if (!response.ok) throw new Error(`Pinned ${kind} download failed (${response.status}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const body = verify(bytes)
  await fs.mkdir(dirname(cache), { recursive: true })
  await fs.writeFile(cache, bytes)
  return body
}

async function atomicWrite(path: string, body: string) {
  await fs.mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.partial`
  await fs.writeFile(temporary, body, { flag: 'wx' })
  await fs.rename(temporary, path)
}

export async function bundleSelectedData(
  projectRoot: string,
  options: { store?: string; fetchImpl?: typeof fetch; producerSnapshotPath?: string } = {},
): Promise<DataBuildInfo> {
  const body = await selectedBody(projectRoot, 'package', options)
  const artifact = parseDataPackageArtifact(body, DATA_PACKAGE_PIN.packageId)
  let snapshotBody: string | undefined
  if (options.producerSnapshotPath) {
    snapshotBody = await selectedBody(projectRoot, 'snapshot', options)
    validatePublishedSnapshot(JSON.parse(snapshotBody) as DataPackageInputSnapshot, artifact)
  }
  const applicationCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const sourceDirty = !!execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const ref =
    process.env['GITHUB_REF_NAME'] ??
    execFileSync('git', ['branch', '--show-current'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  const requestedChannel =
    process.env['AKR_DATA_CHANNEL'] ?? (ref === 'main' && !sourceDirty ? 'production' : 'preview')
  if (requestedChannel !== 'preview' && requestedChannel !== 'production')
    throw new Error('Unknown build data channel.')
  const info: DataBuildInfo = {
    schemaVersion: 1,
    applicationCommit,
    sourceDirty,
    packageId: DATA_PACKAGE_PIN.packageId,
    artifactSha256: DATA_PACKAGE_PIN.artifactSha256,
    channel: requestedChannel,
    artworkId: buildArtworkInventory(
      JSON.parse(artifact.files['operators.json']) as OperatorDataset,
      DATA_PACKAGE_PIN.packageId,
    ).artworkId,
  }
  const bundled = join(projectRoot, 'resources', 'bundled-data')
  await atomicWrite(join(bundled, 'data-package.json'), body)
  await atomicWrite(
    join(bundled, 'artwork-inventory.json'),
    canonicalPackageJson(
      buildArtworkInventory(
        JSON.parse(artifact.files['operators.json']) as OperatorDataset,
        DATA_PACKAGE_PIN.packageId,
      ),
    ),
  )
  await atomicWrite(join(bundled, 'operators', 'operators.json'), artifact.files['operators.json'])
  await atomicWrite(join(bundled, 'data-package-build.json'), canonicalPackageJson(info))
  if (options.producerSnapshotPath && snapshotBody)
    await atomicWrite(resolve(projectRoot, options.producerSnapshotPath), snapshotBody)
  return info
}
