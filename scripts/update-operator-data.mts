import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
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
  UPSTREAM,
  validateOperatorDataset,
  type RawCharacterMetaTable,
  type RawCharacterPatchTable,
  type RawCharacterTable,
  type RawGachaTable,
  type RawHandbookTeamTable,
  type RawMainTextTable,
  type RawUniEquipData,
} from '../src/shared/operatorData.ts'
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json, application/json',
      'User-Agent': 'arknights-randomizer-data-updater',
    },
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
  return (await response.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/plain', 'User-Agent': 'arknights-randomizer-data-updater' },
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
  if (!commits[0]?.sha) throw new Error(`No commit found for ${repository}/${path}`)
  return commits[0].sha
}

async function sourceVersions(): Promise<OperatorDatasetSources> {
  const [gamedataCnCommit, gamedataEnCommit, gamedataJpCommit, gamedataKrCommit, gamedataTwCommit, resourcesCommit, releaseMetadataCommit] = await Promise.all([
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('cn', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('en', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('jp', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('kr', 'character_table.json')),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('tw', 'character_table.json')),
    latestCommit(UPSTREAM.resourcesRepo, UPSTREAM.resourceAvatarPath),
    latestCommit(UPSTREAM.releaseRepo, UPSTREAM.releaseInfoPath),
  ])
  return { gamedataCnCommit, gamedataEnCommit, gamedataJpCommit, gamedataKrCommit, gamedataTwCommit, resourcesCommit, releaseMetadataCommit }
}

async function currentDatasetState(): Promise<{ schemaVersion: unknown; sources: OperatorDatasetSources | null } | null> {
  try {
    const current = JSON.parse(await readFile(outputFile, 'utf8')) as { schemaVersion?: unknown; sources?: OperatorDatasetSources }
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
  const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${id}.png`, {
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
    const results = await Promise.all(batch.map(async (filename) => {
      const destination = join(directory, filename)
      if (await fileExists(destination)) return { filename, ok: true }
      const response = await fetch(`${baseUrl}/${filename}`, {
        headers: { 'User-Agent': 'arknights-randomizer-data-updater' },
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) return { filename, ok: false }
      await writeFile(destination, Buffer.from(await response.arrayBuffer()))
      return { filename, ok: true }
    }))
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
    downloadNamedAssets('class icons', classIconDir, UPSTREAM.classIconBaseUrl, Object.values(CLASS_ICON_FILES)),
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
    const results = await Promise.all(batch.map(async (id) => ({ id, ok: await downloadAvatar(id) })))
    missing.push(...results.filter((result) => !result.ok).map((result) => result.id))
    process.stdout.write(`\rDownloaded/checked avatars: ${Math.min(index + batchSize, ids.length)}/${ids.length}`)
  }
  process.stdout.write('\n')
  if (missing.length > 0) console.warn(`Missing avatars (${missing.length}): ${missing.join(', ')}`)
}

async function readValidatedDataset(): Promise<OperatorDataset> {
  const dataset = JSON.parse(await readFile(outputFile, 'utf8')) as OperatorDataset
  const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
  if (!validation.valid) throw new Error(`Bundled dataset failed validation:\n${validation.errors.join('\n')}`)
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
  const versions = await sourceVersions()
  const previous = await currentDatasetState()
  const previousSources = previous?.sources
  const unchanged =
    previous?.schemaVersion === OPERATOR_DATASET_SCHEMA_VERSION &&
    previousSources?.gamedataCnCommit === versions.gamedataCnCommit &&
    previousSources?.gamedataEnCommit === versions.gamedataEnCommit &&
    previousSources?.gamedataJpCommit === versions.gamedataJpCommit &&
    previousSources?.gamedataKrCommit === versions.gamedataKrCommit &&
    previousSources?.gamedataTwCommit === versions.gamedataTwCommit &&
    previousSources?.resourcesCommit === versions.resourcesCommit &&
    previousSources?.releaseMetadataCommit === versions.releaseMetadataCommit

  if (unchanged && !force && !downloadImages) {
    console.log('Operator dataset is already current.')
    await downloadUiAssets(await readValidatedDataset())
    return
  }

  let dataset: OperatorDataset

  if (unchanged && downloadImages && !force) {
    dataset = await readValidatedDataset()
  } else {
    console.log('Downloading operator tables and release metadata...')
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
    const [cnCharMeta, enCharMeta, cnGacha, cnUniEquip, releaseInfoSource, releaseCandidateSource, releaseEventSource] = await Promise.all([
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
    const localizedCharacterTables = Object.fromEntries(GAME_DATA_LOCALES.map((locale) => [locale, localeData[locale].characters]))
    const localizedPatchTables = Object.fromEntries(GAME_DATA_LOCALES.map((locale) => [locale, localeData[locale].patch]))
    const localizedFactionLabels = Object.fromEntries(GAME_DATA_LOCALES.map((locale) => [locale, factionLabelsFromHandbook(localeData[locale].handbook)]))
    const localizedClassLabels = Object.fromEntries(GAME_DATA_LOCALES.map((locale) => [locale, classLabelsFromMainText(localeData[locale].mainText)]))

    const releaseDates = createReleaseDateMap(releaseInfoSource, releaseCandidateSource, releaseEventSource)
    const releaseCategories = createReleaseCategoryMap(releaseInfoSource)
    dataset = normalizeCharacterTables(cn, en, versions, new Date().toISOString(), {
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
    })
    const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
    if (!validation.valid) throw new Error(`Generated dataset failed validation:\n${validation.errors.join('\n')}`)
    for (const warning of validation.warnings) console.warn(`Warning: ${warning}`)
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
