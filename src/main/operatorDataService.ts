import { app } from 'electron'
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  OperatorDataInfo,
  OperatorUpdateCheck,
  OperatorUpdateResult,
} from '../shared/desktop'
import type { OperatorDataset } from '../shared/operator'
import {
  UPSTREAM,
  validateOperatorDataset,
  upgradeLegacyOperatorDataset,
} from '../shared/operatorData'
import {
  fetchAndBuildOperatorDataset,
  fetchLatestOperatorDatasetSources,
  operatorDatasetSourcesEqual,
} from '../shared/operatorDataPipeline'

const imageCache = new Map<string, string>()
const avatarDownloadPromises = new Map<string, Promise<boolean>>()
const PIPELINE_FETCH_OPTIONS = { userAgent: 'arknights-randomizer' } as const

function bundledRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bundled-data', 'operators')
    : join(app.getAppPath(), 'resources', 'bundled-data', 'operators')
}

function downloadedRoot(): string {
  return join(app.getPath('userData'), 'operator-data')
}

function downloadedDatasetPath(): string {
  return join(downloadedRoot(), 'operators.json')
}

function downloadedImagePath(operatorId: string): string {
  return join(downloadedRoot(), 'images', `${operatorId}.png`)
}

function bundledImagePath(operatorId: string): string {
  return join(bundledRoot(), 'images', `${operatorId}.png`)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readDataset(path: string): Promise<OperatorDataset | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
    const legacy =
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as { schemaVersion?: unknown }).schemaVersion === 4
    const upgraded = upgradeLegacyOperatorDataset(parsed)
    const validation = validateOperatorDataset(upgraded, { requireSourceCommits: !legacy })
    return validation.valid ? (upgraded as OperatorDataset) : null
  } catch {
    return null
  }
}

async function datasetWithOrigin(): Promise<{
  dataset: OperatorDataset
  origin: 'bundled' | 'downloaded'
}> {
  const downloaded = await readDataset(downloadedDatasetPath())
  if (downloaded) return { dataset: downloaded, origin: 'downloaded' }

  const bundled = await readDataset(join(bundledRoot(), 'operators.json'))
  if (!bundled) {
    throw new Error(
      'No valid operator dataset is available. Run the data updater or reinstall the application.',
    )
  }

  return { dataset: bundled, origin: 'bundled' }
}

export async function getOperatorDataset(): Promise<OperatorDataset> {
  return (await datasetWithOrigin()).dataset
}

export async function getOperatorDataInfo(): Promise<OperatorDataInfo> {
  const { dataset, origin } = await datasetWithOrigin()
  return {
    origin,
    generatedAt: dataset.generatedAt,
    operatorCount: dataset.operators.length,
    sources: dataset.sources,
  }
}

async function readOperatorImage(operatorId: string): Promise<string | null> {
  const candidates = [downloadedImagePath(operatorId), bundledImagePath(operatorId)]
  for (const path of candidates) {
    if (!(await exists(path))) continue
    try {
      const data = await readFile(path)
      const url = `data:image/png;base64,${data.toString('base64')}`
      imageCache.set(operatorId, url)
      return url
    } catch {
      // Try the next source before falling back to the card placeholder.
    }
  }
  return null
}

async function downloadAvatarToCache(
  operatorId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (await exists(downloadedImagePath(operatorId))) return true

  const current = avatarDownloadPromises.get(operatorId)
  if (current) return current

  const promise = (async () => {
    const timeout = AbortSignal.timeout(60_000)
    try {
      const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${operatorId}.png`, {
        headers: { 'User-Agent': 'arknights-randomizer' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
      if (!response.ok) return false

      await mkdir(join(downloadedRoot(), 'images'), { recursive: true })
      await writeFile(
        downloadedImagePath(operatorId),
        Buffer.from(await response.arrayBuffer()),
      )
      imageCache.delete(operatorId)
      return true
    } catch (error) {
      if (signal?.aborted) throw error
      return false
    } finally {
      avatarDownloadPromises.delete(operatorId)
    }
  })()

  avatarDownloadPromises.set(operatorId, promise)
  return promise
}

export async function getOperatorImage(operatorId: string): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  const cached = imageCache.get(operatorId)
  if (cached) return cached

  const local = await readOperatorImage(operatorId)
  if (local) return local

  const dataset = await getOperatorDataset()
  if (!dataset.operators.some((operator) => operator.id === operatorId)) return null

  if (await downloadAvatarToCache(operatorId)) {
    return readOperatorImage(operatorId)
  }
  return null
}

export async function syncOperatorAvatars(
  operatorIds: readonly string[],
  options: {
    signal?: AbortSignal
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<string[]> {
  const warnings: string[] = []
  const batchSize = 8
  let completed = 0

  options.onProgress?.(completed, operatorIds.length)
  for (let index = 0; index < operatorIds.length; index += batchSize) {
    if (options.signal?.aborted) {
      throw new DOMException('Avatar sync cancelled.', 'AbortError')
    }

    const batch = operatorIds.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (operatorId) => ({
        operatorId,
        ok: await downloadAvatarToCache(operatorId, options.signal),
      })),
    )
    warnings.push(
      ...results
        .filter((result) => !result.ok)
        .map((result) => `No avatar found for ${result.operatorId}.`),
    )
    completed += batch.length
    options.onProgress?.(completed, operatorIds.length)
  }

  imageCache.clear()
  return warnings
}

export async function checkOperatorUpdates(): Promise<OperatorUpdateCheck> {
  const current = (await getOperatorDataset()).sources

  try {
    const latest = await fetchLatestOperatorDatasetSources(PIPELINE_FETCH_OPTIONS)
    const updateAvailable = !operatorDatasetSourcesEqual(current, latest)
    return {
      online: true,
      updateAvailable,
      current,
      latest,
      message: updateAvailable
        ? 'New operator data is available.'
        : 'Operator data is up to date.',
    }
  } catch {
    return {
      online: false,
      updateAvailable: false,
      current,
      latest: null,
      message: 'Unable to reach the update source. The local dataset remains available.',
    }
  }
}

async function downloadAvatar(
  operatorId: string,
  destination: string,
): Promise<boolean> {
  const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${operatorId}.png`, {
    headers: { 'User-Agent': 'arknights-randomizer' },
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) return false
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
  return true
}

async function stageMissingImages(
  dataset: OperatorDataset,
  stageImages: string,
): Promise<string[]> {
  await mkdir(stageImages, { recursive: true })
  const needsDownload: string[] = []

  for (const operator of dataset.operators) {
    if (
      !(await exists(downloadedImagePath(operator.id))) &&
      !(await exists(bundledImagePath(operator.id)))
    ) {
      needsDownload.push(operator.id)
    }
  }

  const warnings: string[] = []
  const batchSize = 6

  for (let index = 0; index < needsDownload.length; index += batchSize) {
    const batch = needsDownload.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (operatorId) => ({
        operatorId,
        ok: await downloadAvatar(operatorId, join(stageImages, `${operatorId}.png`)),
      })),
    )

    for (const result of results) {
      if (!result.ok) warnings.push(`No avatar found for ${result.operatorId}.`)
    }
  }

  return warnings
}

async function activateStagedData(
  stageRoot: string,
  stageDataset: string,
): Promise<void> {
  const targetRoot = downloadedRoot()
  const targetImages = join(targetRoot, 'images')
  await mkdir(targetImages, { recursive: true })

  const stageImages = join(stageRoot, 'images')
  if (await exists(stageImages)) {
    for (const filename of await readdir(stageImages)) {
      await copyFile(join(stageImages, filename), join(targetImages, filename))
    }
  }

  const targetDataset = downloadedDatasetPath()
  const backupDataset = `${targetDataset}.bak`
  await rm(backupDataset, { force: true })

  const hadCurrent = await exists(targetDataset)
  if (hadCurrent) await rename(targetDataset, backupDataset)

  try {
    await rename(stageDataset, targetDataset)
    await rm(backupDataset, { force: true })
  } catch (error) {
    if (hadCurrent && (await exists(backupDataset))) {
      await rename(backupDataset, targetDataset)
    }
    throw error
  }
}

export async function updateOperatorData(): Promise<OperatorUpdateResult> {
  const current = await getOperatorDataset()
  const latestSources = await fetchLatestOperatorDatasetSources(PIPELINE_FETCH_OPTIONS)

  if (operatorDatasetSourcesEqual(current.sources, latestSources)) {
    return { updated: false, dataset: current, warnings: [] }
  }

  const { dataset, validation } = await fetchAndBuildOperatorDataset(
    latestSources,
    new Date().toISOString(),
    PIPELINE_FETCH_OPTIONS,
  )
  if (!validation.valid) {
    throw new Error(
      `Downloaded operator data failed validation: ${validation.errors.join(' ')}`,
    )
  }

  const stageRoot = await mkdtemp(join(tmpdir(), 'arknights-randomizer-data-'))
  const stageDataset = join(stageRoot, 'operators.json')
  const warnings = [...validation.warnings]

  try {
    warnings.push(...(await stageMissingImages(dataset, join(stageRoot, 'images'))))
    await writeFile(stageDataset, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
    await mkdir(downloadedRoot(), { recursive: true })
    await activateStagedData(stageRoot, stageDataset)
  } finally {
    await rm(stageRoot, { recursive: true, force: true })
  }

  imageCache.clear()
  return { updated: true, dataset, warnings }
}
