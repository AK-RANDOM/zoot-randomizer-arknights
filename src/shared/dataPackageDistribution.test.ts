import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { dataPackageFixture } from '../../scripts/testFixtures/dataPackage'
import { canonicalPackageJson } from './dataPackageJson'
import { advanceDataChannel, packageDigest, publishPreparedData } from './dataPackageDistribution'

const created: string[] = []
async function prepared(date?: string) {
  const root = resolve('.tmp/distribution-tests')
  await fs.mkdir(root, { recursive: true })
  const directory = await fs.mkdtemp(join(root, 'test-'))
  created.push(directory)
  const fixture = dataPackageFixture(date)
  for (const [path, body] of Object.entries(fixture.artifact.files)) {
    const target = join(directory, 'package', path)
    await fs.mkdir(resolve(target, '..'), { recursive: true })
    await fs.writeFile(target, body)
  }
  await fs.writeFile(
    join(directory, 'package/manifest.json'),
    canonicalPackageJson(fixture.artifact.manifest),
  )
  await fs.mkdir(join(directory, 'capture'))
  await fs.writeFile(
    join(directory, 'capture/snapshot.json'),
    canonicalPackageJson(fixture.snapshot),
  )
  await fs.writeFile(
    join(directory, 'build-report.json'),
    canonicalPackageJson({
      packageId: fixture.artifact.manifest.packageId,
      eligibleForPublication: true,
    }),
  )
  return { directory, ...fixture }
}
afterEach(async () => {
  const root = resolve('.tmp/distribution-tests')
  for (const directory of created.splice(0)) {
    if (resolve(directory).startsWith(root + '\\') || resolve(directory).startsWith(root + '/'))
      await fs.rm(directory, { recursive: true, force: true })
  }
})

describe('versioned data publication', () => {
  it('keeps immutable versions and independent channels, and can roll back without rebuilding', async () => {
    const first = await prepared(),
      next = await prepared('2026-01-02T00:00:00.000Z')
    const store = join(first.directory, 'feed')
    const id = first.artifact.manifest.packageId,
      nextId = next.artifact.manifest.packageId
    const preview = await publishPreparedData({
      preparedRoot: first.directory,
      store,
      channel: 'preview',
      expectedPackageId: id,
    })
    expect(preview.artifactPath).toBe(`packages/${packageDigest(id)}/package.json.gz`)
    await expect(
      publishPreparedData({
        preparedRoot: first.directory,
        store,
        channel: 'production',
        expectedPackageId: id,
      }),
    ).rejects.toThrow(/confirmation/)
    await publishPreparedData({
      preparedRoot: first.directory,
      store,
      channel: 'production',
      expectedPackageId: id,
      confirmProduction: id,
    })
    await publishPreparedData({
      preparedRoot: next.directory,
      store,
      channel: 'preview',
      expectedPackageId: nextId,
    })
    expect(
      JSON.parse(await fs.readFile(join(store, 'channels/production.json'), 'utf8')).packageId,
    ).toBe(id)
    expect(
      JSON.parse(await fs.readFile(join(store, 'channels/preview.json'), 'utf8')).packageId,
    ).toBe(nextId)
    await advanceDataChannel({ store, channel: 'preview', packageId: id })
    expect(
      JSON.parse(await fs.readFile(join(store, 'channels/preview.json'), 'utf8')).packageId,
    ).toBe(id)
    expect(
      gunzipSync(
        await fs.readFile(join(store, 'packages', packageDigest(nextId), 'package.json.gz')),
      ).toString('utf8'),
    ).toContain(nextId)
  })

  it('rejects failed builds and corrupt packages while keeping the old pointer available', async () => {
    const first = await prepared(),
      next = await prepared('2026-01-02T00:00:00.000Z')
    const store = join(first.directory, 'feed'),
      id = first.artifact.manifest.packageId
    await publishPreparedData({
      preparedRoot: first.directory,
      store,
      channel: 'preview',
      expectedPackageId: id,
    })
    const pointer = await fs.readFile(join(store, 'channels/preview.json'), 'utf8')
    await fs.writeFile(
      join(next.directory, 'build-report.json'),
      canonicalPackageJson({
        packageId: next.artifact.manifest.packageId,
        eligibleForPublication: false,
      }),
    )
    await expect(
      publishPreparedData({
        preparedRoot: next.directory,
        store,
        channel: 'preview',
        expectedPackageId: next.artifact.manifest.packageId,
      }),
    ).rejects.toThrow(/publication gate/)
    await fs.writeFile(join(first.directory, 'package/operators.json'), '{}')
    await expect(
      publishPreparedData({
        preparedRoot: first.directory,
        store,
        channel: 'preview',
        expectedPackageId: id,
      }),
    ).rejects.toThrow(/checksum/)
    expect(await fs.readFile(join(store, 'channels/preview.json'), 'utf8')).toBe(pointer)
  })

  it('never overwrites an existing version and rejects concurrent publishers', async () => {
    const first = await prepared(),
      id = first.artifact.manifest.packageId,
      store = join(first.directory, 'feed')
    await publishPreparedData({
      preparedRoot: first.directory,
      store,
      channel: 'preview',
      expectedPackageId: id,
    })
    await fs.writeFile(
      join(store, 'packages', packageDigest(id), 'package.json.gz'),
      gzipSync('corrupt existing version'),
    )
    await expect(
      publishPreparedData({
        preparedRoot: first.directory,
        store,
        channel: 'preview',
        expectedPackageId: id,
      }),
    ).rejects.toThrow(/immutable/)
    await fs.writeFile(join(store, '.publish.lock'), 'held')
    await expect(
      publishPreparedData({
        preparedRoot: first.directory,
        store,
        channel: 'preview',
        expectedPackageId: id,
      }),
    ).rejects.toThrow()
  })
})
