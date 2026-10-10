import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  UPSTREAM,
  validateOperatorDataset,
} from '../src/shared/operatorData.ts'
import { operatorAvatarSourceFilename } from '../src/shared/operatorAvatar.ts'
import {
  fetchAndBuildOperatorDataset,
  fetchLatestOperatorDatasetSources,
  operatorDatasetSourcesEqual,
} from '../src/shared/operatorDataPipeline.ts'
import {
  CLASS_ICON_FILES,
  factionIconFile,
  subclassIconFile,
} from '../src/shared/operatorAssets.ts'
import {
  OPERATOR_DATASET_SCHEMA_VERSION,
  type OperatorDataset,
  type OperatorDatasetSources,
} from '../src/shared/operator.ts'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(projectRoot, 'resources', 'bundled-data', 'operators')
const outputFile = join(outputDir, 'operators.json')
const imageDir = join(outputDir, 'images')
const classIconDir = join(outputDir, 'class-icons')
const subclassIconDir = join(outputDir, 'subclass-icons')
const factionIconDir = join(outputDir, 'faction-icons')
const downloadImages = process.argv.includes('--download-images')
const downloadImagesOnly = process.argv.includes('--download-images-only')
const force = process.argv.includes('--force')

const authenticatedFetch: typeof fetch = (input, init) => {
  const token = process.env.GITHUB_TOKEN
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const headers = new Headers(init?.headers)
  if (token && url.startsWith('https://api.github.com/')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}

const PIPELINE_FETCH_OPTIONS = {
  userAgent: 'arknights-randomizer-data-updater',
  fetchImpl: authenticatedFetch,
} as const

async function currentDatasetState(): Promise<{
  schemaVersion: unknown
  sources: OperatorDatasetSources | null
} | null> {
  try {
    const current = JSON.parse(await readFile(outputFile, 'utf8')) as {
      schemaVersion?: unknown
      sources?: OperatorDatasetSources
    }
    return { schemaVersion: current.schemaVersion, sources: current.sources ?? null }
  } catch {
    return null
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function downloadAvatar(id: string): Promise<boolean> {
  const destination = join(imageDir, `${id}.png`)
  if (await fileExists(destination)) return true
  const sourceFilename = operatorAvatarSourceFilename(id)
  const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${sourceFilename}`, {
    headers: { 'User-Agent': 'arknights-randomizer-data-updater' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) return false
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
  return true
}

async function downloadNamedAssets(
  label: string,
  directory: string,
  baseUrl: string,
  filenames: readonly string[],
): Promise<void> {
  await mkdir(directory, { recursive: true })
  const uniqueFiles = [...new Set(filenames)]
  const missing: string[] = []
  const batchSize = 12

  for (let index = 0; index < uniqueFiles.length; index += batchSize) {
    const batch = uniqueFiles.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (filename) => {
        const destination = join(directory, filename)
        if (await fileExists(destination)) return { filename, ok: true }
        const response = await fetch(`${baseUrl}/${filename}`, {
          headers: { 'User-Agent': 'arknights-randomizer-data-updater' },
          signal: AbortSignal.timeout(60_000),
        })
        if (!response.ok) return { filename, ok: false }
        await writeFile(destination, Buffer.from(await response.arrayBuffer()))
        return { filename, ok: true }
      }),
    )
    missing.push(...results.filter((result) => !result.ok).map((result) => result.filename))
  }

  if (missing.length > 0) console.warn(`Missing ${label} (${missing.length}): ${missing.join(', ')}`)
  else console.log(`Downloaded/checked ${label}: ${uniqueFiles.length}/${uniqueFiles.length}`)
}

async function downloadUiAssets(dataset: OperatorDataset): Promise<void> {
  const subclassFiles = dataset.operators
    .map((operator) => subclassIconFile(operator.subclass.id))
    .filter((filename): filename is string => filename !== null)
  const factionFiles = Object.values(dataset.factionLabels)
    .map((label) => factionIconFile(label))
    .filter((filename): filename is string => filename !== null)

  await Promise.all([
    downloadNamedAssets(
      'class icons',
      classIconDir,
      UPSTREAM.classIconBaseUrl,
      Object.values(CLASS_ICON_FILES),
    ),
    downloadNamedAssets('subclass icons', subclassIconDir, UPSTREAM.subclassIconBaseUrl, subclassFiles),
    downloadNamedAssets('faction icons', factionIconDir, UPSTREAM.factionIconBaseUrl, factionFiles),
  ])
}

async function downloadAvatars(ids: string[]): Promise<void> {
  await mkdir(imageDir, { recursive: true })
  const missing: string[] = []
  const batchSize = 8
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (id) => ({ id, ok: await downloadAvatar(id) })),
    )
    missing.push(...results.filter((result) => !result.ok).map((result) => result.id))
    process.stdout.write(
      `\rDownloaded/checked avatars: ${Math.min(index + batchSize, ids.length)}/${ids.length}`,
    )
  }
  process.stdout.write('\n')
  if (missing.length > 0) console.warn(`Missing avatars (${missing.length}): ${missing.join(', ')}`)
}

async function readValidatedDataset(): Promise<OperatorDataset> {
  const dataset = JSON.parse(await readFile(outputFile, 'utf8')) as OperatorDataset
  const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
  if (!validation.valid) {
    throw new Error(`Bundled dataset failed validation:\n${validation.errors.join('\n')}`)
  }
  return dataset
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  if (downloadImagesOnly) {
    const dataset = await readValidatedDataset()
    await Promise.all([
      downloadAvatars(dataset.operators.map((operator) => operator.id)),
      downloadUiAssets(dataset),
    ])
    return
  }

  console.log('Checking upstream source versions...')
  const versions = await fetchLatestOperatorDatasetSources(PIPELINE_FETCH_OPTIONS)
  const previous = await currentDatasetState()
  const previousSources = previous?.sources ?? null
  const unchanged =
    previous?.schemaVersion === OPERATOR_DATASET_SCHEMA_VERSION &&
    previousSources !== null &&
    operatorDatasetSourcesEqual(previousSources, versions)

  if (unchanged && !force && !downloadImages) {
    console.log('Operator dataset is already current.')
    await downloadUiAssets(await readValidatedDataset())
    return
  }

  let dataset: OperatorDataset

  if (unchanged && downloadImages && !force) {
    dataset = await readValidatedDataset()
  } else {
    console.log('Downloading operator tables, handbook metadata and release metadata...')
    const built = await fetchAndBuildOperatorDataset(
      versions,
      new Date().toISOString(),
      PIPELINE_FETCH_OPTIONS,
    )
    dataset = built.dataset
    if (!built.validation.valid) {
      throw new Error(`Generated dataset failed validation:\n${built.validation.errors.join('\n')}`)
    }
    for (const warning of built.validation.warnings) console.warn(`Warning: ${warning}`)
    await writeFile(outputFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${dataset.operators.length} operators to ${outputFile}`)
  }

  await downloadUiAssets(dataset)
  if (downloadImages) await downloadAvatars(dataset.operators.map((operator) => operator.id))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
