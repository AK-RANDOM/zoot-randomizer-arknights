import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { bundleSelectedData } from './dataPackageBundling'
import { DATA_PACKAGE_PIN } from '../../src/shared/dataPackagePin'
import { packageDigest } from '../../src/shared/dataPackageDistribution'

const roots: string[] = []
async function fixture() {
  const parent = resolve('.tmp/bundling-tests')
  await fs.mkdir(parent, { recursive: true })
  const root = await fs.mkdtemp(join(parent, 'test-'))
  roots.push(root)
  const body = await fs.readFile(resolve('resources/bundled-data/data-package.json'), 'utf8')
  const store = join(root, 'feed'),
    file = join(store, 'packages', packageDigest(DATA_PACKAGE_PIN.packageId), 'package.json.gz')
  await fs.mkdir(resolve(file, '..'), { recursive: true })
  await fs.writeFile(file, gzipSync(body))
  return { root, store, file, body }
}
afterEach(async () => {
  const parent = resolve('.tmp/bundling-tests') + sep
  for (const root of roots.splice(0))
    if (resolve(root).startsWith(parent)) await fs.rm(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('pinned build data', () => {
  it('uses one exact version for all build exports without resolving channels', async () => {
    const { root, store, body } = await fixture()
    const network = vi.fn()
    vi.stubEnv('AKR_DATA_CHANNEL', 'preview')
    const info = await bundleSelectedData(root, { store, fetchImpl: network })
    const bundled = join(root, 'resources/bundled-data')
    expect(info.packageId).toBe(DATA_PACKAGE_PIN.packageId)
    expect(info.channel).toBe('preview')
    expect(await fs.readFile(join(bundled, 'data-package.json'), 'utf8')).toBe(body)
    expect(await fs.readFile(join(bundled, 'operators/operators.json'), 'utf8')).toBe(
      JSON.parse(body).files['operators.json'],
    )
    expect(
      JSON.parse(await fs.readFile(join(bundled, 'data-package-build.json'), 'utf8'))
        .applicationCommit,
    ).toMatch(/^[a-f0-9]{40}$/)
    expect(network).not.toHaveBeenCalled()
  })

  it('uses its verified cache offline and rejects corrupt replacement data before changing bundled files', async () => {
    const { root, store, file, body } = await fixture()
    await bundleSelectedData(root, { store })
    await fs.writeFile(file, gzipSync('{}'))
    await expect(bundleSelectedData(root, { store })).rejects.toThrow(/checksum/)
    expect(await fs.readFile(join(root, 'resources/bundled-data/data-package.json'), 'utf8')).toBe(
      body,
    )
    const network = vi.fn(async () => new Response(new Uint8Array(gzipSync(body))))
    await bundleSelectedData(root, { fetchImpl: network })
    expect(network).toHaveBeenCalledTimes(1)
    const offline = vi.fn(() => {
      throw new Error('offline')
    })
    await bundleSelectedData(root, { fetchImpl: offline })
    expect(offline).not.toHaveBeenCalled()
  })
})
