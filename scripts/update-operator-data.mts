import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLASS_ICON_FILES,
  createReleaseCategoryMap,
  createReleaseDateMap,
  factionLabelsFromHandbooks,
  normalizeCharacterTables,
  UPSTREAM,
  validateOperatorDataset,
  type RawCharacterMetaTable,
  type RawCharacterPatchTable,
  type RawCharacterTable,
  type RawGachaTable,
  type RawHandbookTeamTable,
} from '../src/shared/operatorData.ts'
import {
  OPERATOR_DATASET_SCHEMA_VERSION,
  type OperatorDatasetSources,
} from '../src/shared/operator.ts'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(projectRoot, 'resources', 'bundled-data', 'operators')
const outputFile = join(outputDir, 'operators.json')
const imageDir = join(outputDir, 'images')
const classIconDir = join(outputDir, 'class-icons')
const downloadImages = process.argv.includes('--download-images')
const downloadImagesOnly = process.argv.includes('--download-images-only')
const force = process.argv.includes('--force')
const cnHandbookTeamUrl = UPSTREAM.enHandbookTeamUrl.replace('/en/', '/cn/')

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
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'arknights-randomizer-data-updater',
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
  if (!commits[0]?.sha) throw new Error(`No commit found for ${repository}/${path}`)
  return commits[0].sha
}

async function sourceVersions(): Promise<OperatorDatasetSources> {
  const [
    gamedataCnCommit,
    gamedataEnCommit,
    resourcesCommit,
    releaseMetadataCommit,
  ] = await Promise.all([
    latestCommit(UPSTREAM.gamedataRepo, UPSTREAM.cnExcelPath),
    latestCommit(UPSTREAM.gamedataRepo, UPSTREAM.enExcelPath),
    latestCommit(UPSTREAM.resourcesRepo, UPSTREAM.resourceAvatarPath),
    latestCommit(UPSTREAM.releaseRepo, UPSTREAM.releaseInfoPath),
  ])

  return {
    gamedataCnCommit,
    gamedataEnCommit,
    resourcesCommit,
    releaseMetadataCommit,
  }
}

async function currentDatasetState(): Promise<{
  schemaVersion: unknown
  sources: OperatorDatasetSources | null
} | null> {
  try {
    const current = JSON.parse(await readFile(outputFile, 'utf8')) as {
      schemaVersion?: unknown
      sources?: OperatorDatasetSources
    }
    return {
      schemaVersion: current.schemaVersion,
      sources: current.sources ?? null,
    }
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

async function downloadClassIcons(): Promise<void> {
  await mkdir(classIconDir, { recursive: true })

  const entries = Object.entries(CLASS_ICON_FILES)
  const results = await Promise.all(
    entries.map(async ([operatorClass, filename]) => {
      const destination = join(classIconDir, filename)
      if (await fileExists(destination)) return { operatorClass, ok: true }

      const response = await fetch(`${UPSTREAM.classIconBaseUrl}/${operatorClass}/${filename}`, {
        headers: { 'User-Agent': 'arknights-randomizer-data-updater' },
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) return { operatorClass, ok: false }
      await writeFile(destination, Buffer.from(await response.arrayBuffer()))
      return { operatorClass, ok: true }
    }),
  )

  const missing = results.filter((result) => !result.ok).map((result) => result.operatorClass)
  if (missing.length > 0) {
    console.warn(`Missing class icons (${missing.length}): ${missing.join(', ')}`)
  } else {
    console.log('Downloaded/checked class icons: 8/8')
  }
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
  if (missing.length > 0) {
    console.warn(`Missing avatars (${missing.length}): ${missing.join(', ')}`)
  }
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  if (downloadImagesOnly) {
    const dataset = JSON.parse(await readFile(outputFile, 'utf8'))
    const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
    if (!validation.valid) {
      throw new Error(`Bundled dataset failed validation:\n${validation.errors.join('\n')}`)
    }

    await Promise.all([
      downloadAvatars(dataset.operators.map((operator: { id: string }) => operator.id)),
      downloadClassIcons(),
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
    previousSources?.resourcesCommit === versions.resourcesCommit &&
    previousSources?.releaseMetadataCommit === versions.releaseMetadataCommit

  if (unchanged && !force && !downloadImages) {
    console.log('Operator dataset is already current.')
    return
  }

  let dataset

  if (unchanged && downloadImages && !force) {
    dataset = JSON.parse(await readFile(outputFile, 'utf8'))
  } else {
    console.log('Downloading operator tables and release metadata...')
    const [
      cn,
      en,
      cnPatch,
      enPatch,
      cnCharMeta,
      enCharMeta,
      cnGacha,
      cnHandbookTeams,
      enHandbookTeams,
      releaseInfoSource,
      releaseCandidateSource,
      releaseEventSource,
    ] = await Promise.all([
      fetchJson<RawCharacterTable>(UPSTREAM.cnCharacterUrl),
      fetchJson<RawCharacterTable>(UPSTREAM.enCharacterUrl),
      fetchJson<RawCharacterPatchTable>(UPSTREAM.cnPatchUrl),
      fetchJson<RawCharacterPatchTable>(UPSTREAM.enPatchUrl),
      fetchJson<RawCharacterMetaTable>(UPSTREAM.cnCharMetaUrl),
      fetchJson<RawCharacterMetaTable>(UPSTREAM.enCharMetaUrl),
      fetchJson<RawGachaTable>(UPSTREAM.cnGachaUrl),
      fetchJson<RawHandbookTeamTable>(cnHandbookTeamUrl),
      fetchJson<RawHandbookTeamTable>(UPSTREAM.enHandbookTeamUrl),
      fetchText(UPSTREAM.releaseInfoUrl),
      fetchText(UPSTREAM.releaseCandidateUrl),
      fetchText(UPSTREAM.releaseEventUrl),
    ])

    const releaseDates = createReleaseDateMap(
      releaseInfoSource,
      releaseCandidateSource,
      releaseEventSource,
    )
    const releaseCategories = createReleaseCategoryMap(releaseInfoSource)
    dataset = normalizeCharacterTables(
      cn,
      en,
      versions,
      new Date().toISOString(),
      {
        cnPatch,
        enPatch,
        cnCharMeta,
        enCharMeta,
        cnGacha,
        factionLabels: factionLabelsFromHandbooks(cnHandbookTeams, enHandbookTeams),
        releaseDates,
        releaseCategories,
      },
    )
    const validation = validateOperatorDataset(dataset, {
      requireSourceCommits: true,
    })

    if (!validation.valid) {
      throw new Error(`Generated dataset failed validation:\n${validation.errors.join('\n')}`)
    }

    for (const warning of validation.warnings) console.warn(`Warning: ${warning}`)
    await writeFile(outputFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${dataset.operators.length} operators to ${outputFile}`)
  }

  if (downloadImages) {
    await Promise.all([
      downloadAvatars(dataset.operators.map((operator: { id: string }) => operator.id)),
      downloadClassIcons(),
    ])
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})