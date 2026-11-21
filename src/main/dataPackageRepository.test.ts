import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { dataPackageFixture, fixtureFeed } from '../../scripts/testFixtures/dataPackage'
import { canonicalPackageJson } from '../shared/dataPackageJson'
import type { OperatorDataset } from '../shared/operator'
import { createDataPackageRepository, readLegacyOperatorData } from './dataPackageRepository'

const created: string[] = []
async function fixture() {
  const root = resolve('.tmp/repository-tests')
  await fs.mkdir(root, { recursive: true })
  const directory = await fs.mkdtemp(join(root, 'test-'))
  created.push(directory)
  const artifact = dataPackageFixture().artifact
  const bundledRoot = join(directory, 'bundled'),
    userDataRoot = join(directory, 'portable-user')
  await fs.mkdir(bundledRoot)
  await fs.mkdir(userDataRoot)
  await fs.writeFile(join(bundledRoot, 'data-package.json'), canonicalPackageJson(artifact))
  await fs.writeFile(
    join(bundledRoot, 'data-package-build.json'),
    JSON.stringify({ channel: 'preview' }),
  )
  return {
    directory,
    artifact,
    options: { bundledRoot, userDataRoot, pin: null, baseUrl: 'https://feed.invalid/' },
  }
}
afterEach(async () => {
  const root = resolve('.tmp/repository-tests') + sep
  for (const directory of created.splice(0)) {
    if (!resolve(directory).startsWith(root)) throw new Error('Unsafe test cleanup path')
    await fs.rm(directory, { recursive: true, force: true })
  }
})

describe('Windows complete package storage and migration', () => {
  it('activates on the portable data volume and restarts offline with all catalogs and previous data intact', async () => {
    const base = await fixture()
    const next = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
    const feed = fixtureFeed(next)
    const repository = createDataPackageRepository({ ...base.options, fetchImpl: feed.fetchImpl })
    expect((await repository.getInfo()).origin).toBe('bundled')
    await repository.installUpdate()
    const root = join(base.options.userDataRoot, 'data-packages')
    expect(await fs.readdir(root)).toEqual(['cache.json'])
    const saved = JSON.parse(await fs.readFile(join(root, 'cache.json'), 'utf8'))
    expect(saved.previous.artifact.manifest.packageId).toBe(base.artifact.manifest.packageId)
    const offline = createDataPackageRepository({
      ...base.options,
      fetchImpl: async () => {
        throw new Error('Offline')
      },
    })
    expect((await offline.getInfo()).packageId).toBe(next.manifest.packageId)
    expect((await offline.getCatalog('cn', 'kr'))[0].name).toBe('Fixture kr')
    expect((await offline.checkUpdates()).online).toBe(false)
  })

  it('falls back offline when the downloaded record is partial or the bundled file is corrupt', async () => {
    const base = await fixture()
    const root = join(base.options.userDataRoot, 'data-packages')
    await fs.mkdir(root)
    await fs.writeFile(join(root, 'cache.json'), '{interrupted')
    expect((await createDataPackageRepository(base.options).getInfo()).origin).toBe('bundled')
    const next = dataPackageFixture('2026-01-02T00:00:00.000Z').artifact
    await createDataPackageRepository({
      ...base.options,
      fetchImpl: fixtureFeed(next).fetchImpl,
    }).installUpdate()
    await fs.writeFile(join(base.options.bundledRoot, 'data-package.json'), 'corrupt')
    expect((await createDataPackageRepository(base.options).getInfo()).packageId).toBe(
      next.manifest.packageId,
    )
  })

  it('preserves newer legacy operators and cached events read-only until package activation', async () => {
    const base = await fixture()
    const legacyRoot = join(base.options.userDataRoot, 'operator-data')
    await fs.mkdir(legacyRoot)
    const legacy = JSON.parse(
      dataPackageFixture('2026-01-02T00:00:00.000Z').artifact.files['operators.json'],
    ) as OperatorDataset
    legacy.operators[0].id = 'char_385_finlpp'
    legacy.operators[0].imageFile = 'operators/char_385_finlpp.png'
    legacy.operators[0].acquisition = { family: 'standard', group: null }
    const legacyBody = canonicalPackageJson(legacy)
    await fs.writeFile(join(legacyRoot, 'operators.json'), legacyBody)
    const eventBody = JSON.stringify({
      version: 14,
      events: [
        { id: 'cached', name: 'Cached event', stages: { standard: ['C-1'], h: [], ex: [], s: [] } },
      ],
    })
    const eventFile = join(base.options.userDataRoot, 'garrison-event-catalog-global-en.json')
    await fs.writeFile(eventFile, eventBody)
    const repository = createDataPackageRepository(base.options)
    expect((await repository.getInfo()).warning).toContain('previously downloaded')
    expect((await repository.getDataset()).operators[0].acquisition).toEqual({
      family: 'welfare',
      group: 'recruitment',
    })
    expect((await repository.getCatalog('global', 'en'))[0].id).toBe('cached')
    expect(await fs.readFile(join(legacyRoot, 'operators.json'), 'utf8')).toBe(legacyBody)
    expect(await fs.readFile(eventFile, 'utf8')).toBe(eventBody)
  })

  it('corrects old pipeline dates without inventing dates for operators absent from the bundled roster', async () => {
    const base = await fixture()
    const bundled = JSON.parse(base.artifact.files['operators.json']) as OperatorDataset
    const legacy = structuredClone(bundled)
    legacy.dataPipelineVersion = 1
    legacy.operators[0].release.cn = { date: '2025-01-01', yearGroup: 2025 }
    legacy.operators.push({
      ...legacy.operators[0],
      id: 'char_newer',
      imageFile: 'operators/char_newer.png',
    })
    const root = join(base.options.userDataRoot, 'operator-data')
    await fs.mkdir(root)
    await fs.writeFile(join(root, 'operators.json'), canonicalPackageJson(legacy))
    const migrated = await readLegacyOperatorData(base.options.userDataRoot, bundled)
    expect(migrated?.operators[0].release.cn.date).toBe('2019-05-01')
    expect(migrated?.operators.at(-1)?.release.cn.date).toBeNull()
  })
})
