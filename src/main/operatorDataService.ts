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
import type {
  OperatorClass,
  OperatorDataset,
  OperatorDatasetSources,
} from '../shared/operator'
import {
  CLASS_ICON_FILES,
  GAME_DATA_LOCALES,
  classLabelsFromMainText,
  createReleaseCategoryMap,
  createReleaseDateMap,
  factionLabelsFromHandbook,
  factionLabelsFromHandbooks,
  gameDataExcelPath,
  gameDataExcelUrl,
  subclassLabelsFromUniEquip,
  normalizeCharacterTables,
  type RawCharacterMetaTable,
  type RawCharacterPatchTable,
  type RawCharacterTable,
  type RawGachaTable,
  type RawHandbookTeamTable,
  type RawMainTextTable,
  type RawUniEquipData,
  UPSTREAM,
  validateOperatorDataset,
  upgradeLegacyOperatorDataset,
} from '../shared/operatorData'

const imageCache = new Map<string, string | null>()
const classIconCache = new Map<OperatorClass, string | null>()

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

function bundledClassIconPath(operatorClass: OperatorClass): string {
  return join(bundledRoot(), 'class-icons', CLASS_ICON_FILES[operatorClass])
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

export async function getOperatorImage(operatorId: string): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  if (imageCache.has(operatorId)) return imageCache.get(operatorId) ?? null

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

  imageCache.set(operatorId, null)
  return null
}

export async function getClassIcon(operatorClass: OperatorClass): Promise<string | null> {
  if (!(operatorClass in CLASS_ICON_FILES)) return null
  if (classIconCache.has(operatorClass)) return classIconCache.get(operatorClass) ?? null

  try {
    const data = await readFile(bundledClassIconPath(operatorClass))
    const url = `data:image/svg+xml;base64,${data.toString('base64')}`
    classIconCache.set(operatorClass, url)
    return url
  } catch {
    classIconCache.set(operatorClass, null)
    return null
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json, application/json',
      'User-Agent': 'arknights-randomizer',
    },
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
  return (await response.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'arknights-randomizer',
    },
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
  return response.text()
}

async function latestCommit(repository: string, path: string): Promise<string> {
  const url = new URL(`https://api.github.com/repos/${repository}/commits`)
  url.searchParams.set('path', path)
  url.searchParams.set('per_page', '1')
  const commits = await fetchJson<Array<{ sha: string }>>(url.toString())
  if (!commits[0]?.sha) throw new Error(`No upstream commit found for ${repository}/${path}`)
  return commits[0].sha
}

async function fetchLatestSources(): Promise<OperatorDatasetSources> {
  const [
    gamedataCnCommit,
    gamedataEnCommit,
    gamedataJpCommit,
    gamedataKrCommit,
    gamedataTwCommit,
    resourcesCommit,
    releaseMetadataCommit,
  ] = await Promise.all([
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('cn', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('en', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('jp', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('kr', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('tw', 'character_table.json')),
    latestCommit(UPSTREAM.resourcesRepo, UPSTREAM.resourceAvatarPath),
    latestCommit(UPSTREAM.releaseRepo, UPSTREAM.releaseInfoPath),
  ])

  return {
    gamedataCnCommit,
    gamedataEnCommit,
    gamedataJpCommit,
    gamedataKrCommit,
    gamedataTwCommit,
    resourcesCommit,
    releaseMetadataCommit,
  }
}

function sameSources(
  left: OperatorDatasetSources,
  right: OperatorDatasetSources,
): boolean {
  return (
    left.gamedataCnCommit === right.gamedataCnCommit &&
    left.gamedataEnCommit === right.gamedataEnCommit &&
    left.gamedataJpCommit === right.gamedataJpCommit &&
    left.gamedataKrCommit === right.gamedataKrCommit &&
    left.gamedataTwCommit === right.gamedataTwCommit &&
    left.resourcesCommit === right.resourcesCommit &&
    left.releaseMetadataCommit === right.releaseMetadataCommit
  )
}

export async function checkOperatorUpdates(): Promise<OperatorUpdateCheck> {
  const current = (await getOperatorDataset()).sources

  try {
    const latest = await fetchLatestSources()
    const updateAvailable = !sameSources(current, latest)
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
  const latestSources = await fetchLatestSources()

  if (sameSources(current.sources, latestSources)) {
    return { updated: false, dataset: current, warnings: [] }
  }

  const localeEntries = await Promise.all(
    GAME_DATA_LOCALES.map(async (locale) => {
      const [characters, patch, handbook, mainText] = await Promise.all([
        fetchJson<RawCharacterTable>(gameDataExcelUrl(locale, 'character_table.json')),
        fetchJson<RawCharacterPatchTable>(gameDataExcelUrl(locale, 'char_patch_table.json')),
        fetchJson<RawHandbookTeamTable>(gameDataExcelUrl(locale, 'handbook_team_table.json')),
        fetchJson<RawMainTextTable>(gameDataExcelUrl(locale, 'main_text.json')),
      ])
      return [locale, { characters, patch, handbook, mainText }] as const
    }),
  )
  const localeData = Object.fromEntries(localeEntries)
  const [
    cnCharMeta,
    enCharMeta,
    cnGacha,
    cnUniEquip,
    releaseInfoSource,
    releaseCandidateSource,
    releaseEventSource,
  ] = await Promise.all([
    fetchJson<RawCharacterMetaTable>(UPSTREAM.cnCharMetaUrl),
    fetchJson<RawCharacterMetaTable>(UPSTREAM.enCharMetaUrl),
    fetchJson<RawGachaTable>(UPSTREAM.cnGachaUrl),
    fetchJson<RawUniEquipData>(gameDataExcelUrl('cn', 'uniequip_data.json')),
    fetchText(UPSTREAM.releaseInfoUrl),
    fetchText(UPSTREAM.releaseCandidateUrl),
    fetchText(UPSTREAM.releaseEventUrl),
  ])

  const cn = localeData.cn.characters
  const en = localeData.en.characters
  const cnPatch = localeData.cn.patch
  const enPatch = localeData.en.patch
  const cnHandbookTeams = localeData.cn.handbook
  const enHandbookTeams = localeData.en.handbook
  const localizedCharacterTables = Object.fromEntries(
    GAME_DATA_LOCALES.map((locale) => [locale, localeData[locale].characters]),
  )
  const localizedPatchTables = Object.fromEntries(
    GAME_DATA_LOCALES.map((locale) => [locale, localeData[locale].patch]),
  )
  const localizedFactionLabels = Object.fromEntries(
    GAME_DATA_LOCALES.map((locale) => [
      locale,
      factionLabelsFromHandbook(localeData[locale].handbook),
    ]),
  )
  const localizedClassLabels = Object.fromEntries(
    GAME_DATA_LOCALES.map((locale) => [
      locale,
      classLabelsFromMainText(localeData[locale].mainText),
    ]),
  )

  const releaseDates = createReleaseDateMap(
    releaseInfoSource,
    releaseCandidateSource,
    releaseEventSource,
  )
  const releaseCategories = createReleaseCategoryMap(releaseInfoSource)
  const dataset = normalizeCharacterTables(
    cn,
    en,
    latestSources,
    new Date().toISOString(),
    {
      cnPatch,
      enPatch,
      cnCharMeta,
      enCharMeta,
      cnGacha,
      factionLabels: factionLabelsFromHandbooks(cnHandbookTeams, enHandbookTeams),
      localizedCharacterTables,
      localizedPatchTables,
      localizedFactionLabels,
      localizedClassLabels,
      localizedSubclassLabels: { cn: subclassLabelsFromUniEquip(cnUniEquip) },
      releaseDates,
      releaseCategories,
    },
  )
  const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
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
