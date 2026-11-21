import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { enumerateArtwork } from '../src/shared/artwork.ts'
import { ArtworkCache } from '../src/main/artworkCache.ts'
import { readDataPackage } from '../src/shared/dataPackageReader.ts'

const args = process.argv.slice(2)
const value = (name: string, fallback: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const root = resolve(value('--cache', 'resources/bundled-data/operators'))
const kind = value('--kind', 'all')
if (!['avatar', 'portrait', 'all'].includes(kind))
  throw new Error('Choose --kind avatar, portrait or all.')
const { dataset } = await readDataPackage(
  await readFile('resources/bundled-data/data-package.json', 'utf8'),
)
const assets = enumerateArtwork(dataset).filter((asset) => kind === 'all' || asset.kind === kind)
const controller = new AbortController()
process.once('SIGINT', () => controller.abort())
try {
  const result = await new ArtworkCache({ root }).download(assets, {
    signal: controller.signal,
    onProgress: (counts) => process.stdout.write(`\rArtwork ${counts.completed}/${counts.total}`),
  })
  process.stdout.write('\n')
  console.log(JSON.stringify(result, null, 2))
  if (result.failed) process.exitCode = 1
} catch (error) {
  if (!controller.signal.aborted) throw error
  console.log('\nPaused; completed files have been kept.')
  process.exitCode = 130
}
