import type { OperatorDataset, OperatorDatasetSources } from './operator.ts'
import {
  GAME_DATA_LOCALES,
  UPSTREAM,
  classLabelsFromMainText,
  createReleaseCategoryMap,
  factionLabelsFromHandbook,
  factionLabelsFromHandbooks,
  gameDataExcelPath,
  normalizeCharacterTables,
  subclassLabelsFromUniEquip,
  validateOperatorDataset,
  type RawCharacterMetaTable,
  type RawCharacterPatchTable,
  type RawCharacterTable,
  type RawGachaTable,
  type RawHandbookTeamTable,
  type RawMainTextTable,
  type RawUniEquipData,
} from './operatorData.ts'
import { applyRaceMetadata, type RawHandbookInfoTable } from './raceMetadata.ts'
import { buildReleaseDateMap, RELEASE_VERSION_UPSTREAM } from './releaseMetadata.ts'

const GAMEDATA_BRANCH = 'master'
const RESOURCES_BRANCH = 'main'
const RELEASE_BRANCH = 'main'
const RELEASE_VERSION_BRANCH = 'master'

function githubRawUrl(repository: string, revision: string, path: string): string {
  return `https://raw.githubusercontent.com/${repository}/${revision}/${path}`
}

function gameDataExcelUrlAtRevision(
  locale: (typeof GAME_DATA_LOCALES)[number],
  filename: string,
  revision: string,
): string {
  return githubRawUrl(UPSTREAM.gamedataRepo, revision, gameDataExcelPath(locale, filename))
}

export interface OperatorDataFetchOptions {
  userAgent?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type OperatorDatasetValidation = ReturnType<typeof validateOperatorDataset>

function fetchOptions(options: OperatorDataFetchOptions): Required<OperatorDataFetchOptions> {
  return {
    userAgent: options.userAgent ?? 'arknights-randomizer-data-pipeline',
    timeoutMs: options.timeoutMs ?? 120_000,
    fetchImpl: options.fetchImpl ?? fetch,
  }
}

async function fetchJson<T>(url: string, options: OperatorDataFetchOptions): Promise<T> {
  const resolved = fetchOptions(options)
  const response = await resolved.fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json, application/json',
      'User-Agent': resolved.userAgent,
    },
    signal: AbortSignal.timeout(resolved.timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
  return (await response.json()) as T
}

async function fetchText(url: string, options: OperatorDataFetchOptions): Promise<string> {
  const resolved = fetchOptions(options)
  const response = await resolved.fetchImpl(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': resolved.userAgent,
    },
    signal: AbortSignal.timeout(resolved.timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
  return response.text()
}

async function latestBranchCommit(
  repository: string,
  branch: string,
  options: OperatorDataFetchOptions,
): Promise<string> {
  const ref = await fetchJson<{ object?: { sha?: string } }>(
    `https://api.github.com/repos/${repository}/git/ref/heads/${branch}`,
    options,
  )
  if (!ref.object?.sha) {
    throw new Error(`No upstream branch head found for ${repository}@${branch}`)
  }
  return ref.object.sha
}

export async function fetchLatestOperatorDatasetSources(
  options: OperatorDataFetchOptions = {},
): Promise<OperatorDatasetSources> {
  const [gamedataCommit, resourcesCommit, releaseMetadataCommit, releaseVersionCommit] =
    await Promise.all([
      latestBranchCommit(UPSTREAM.gamedataRepo, GAMEDATA_BRANCH, options),
      latestBranchCommit(UPSTREAM.resourcesRepo, RESOURCES_BRANCH, options),
      latestBranchCommit(UPSTREAM.releaseRepo, RELEASE_BRANCH, options),
      latestBranchCommit(RELEASE_VERSION_UPSTREAM.repository, RELEASE_VERSION_BRANCH, options),
    ])

  return {
    gamedataCnCommit: gamedataCommit,
    gamedataEnCommit: gamedataCommit,
    gamedataJpCommit: gamedataCommit,
    gamedataKrCommit: gamedataCommit,
    gamedataTwCommit: gamedataCommit,
    gamedataCnHandbookCommit: gamedataCommit,
    gamedataEnHandbookCommit: gamedataCommit,
    gamedataJpHandbookCommit: gamedataCommit,
    gamedataKrHandbookCommit: gamedataCommit,
    gamedataTwHandbookCommit: gamedataCommit,
    resourcesCommit,
    releaseMetadataCommit,
    releaseVersionCommit,
  }
}

export function operatorDatasetSourcesEqual(
  left: OperatorDatasetSources,
  right: OperatorDatasetSources,
): boolean {
  return (
    left.gamedataCnCommit === right.gamedataCnCommit &&
    left.gamedataEnCommit === right.gamedataEnCommit &&
    left.gamedataJpCommit === right.gamedataJpCommit &&
    left.gamedataKrCommit === right.gamedataKrCommit &&
    left.gamedataTwCommit === right.gamedataTwCommit &&
    left.gamedataCnHandbookCommit === right.gamedataCnHandbookCommit &&
    left.gamedataEnHandbookCommit === right.gamedataEnHandbookCommit &&
    left.gamedataJpHandbookCommit === right.gamedataJpHandbookCommit &&
    left.gamedataKrHandbookCommit === right.gamedataKrHandbookCommit &&
    left.gamedataTwHandbookCommit === right.gamedataTwHandbookCommit &&
    left.resourcesCommit === right.resourcesCommit &&
    left.releaseMetadataCommit === right.releaseMetadataCommit &&
    (left.releaseVersionCommit ?? null) === (right.releaseVersionCommit ?? null)
  )
}

export function alignAvailabilityWithReleaseMetadata(dataset: OperatorDataset): OperatorDataset {
  const operators = dataset.operators.flatMap((operator) => {
    const cnAvailable =
      operator.availableOn.cn &&
      operator.release.cn.date !== null &&
      operator.release.cn.yearGroup !== null
    const globalAvailable =
      operator.availableOn.global &&
      operator.release.global.date !== null &&
      operator.release.global.yearGroup !== null

    if (!cnAvailable && !globalAvailable) return []
    if (
      cnAvailable === operator.availableOn.cn &&
      globalAvailable === operator.availableOn.global
    ) {
      return [operator]
    }

    return [
      {
        ...operator,
        availableOn: { cn: cnAvailable, global: globalAvailable },
        release: {
          cn: cnAvailable ? operator.release.cn : { date: null, yearGroup: null },
          global: globalAvailable ? operator.release.global : { date: null, yearGroup: null },
        },
      },
    ]
  })

  return { ...dataset, operators }
}

export async function fetchAndBuildOperatorDataset(
  sources: OperatorDatasetSources,
  generatedAt = new Date().toISOString(),
  options: OperatorDataFetchOptions = {},
): Promise<{ dataset: OperatorDataset; validation: OperatorDatasetValidation }> {
  const gamedataRevision = sources.gamedataCnCommit ?? GAMEDATA_BRANCH
  const releaseRevision = sources.releaseMetadataCommit ?? RELEASE_BRANCH
  const releaseVersionRevision = sources.releaseVersionCommit ?? RELEASE_VERSION_BRANCH

  const localeEntries = await Promise.all(
    GAME_DATA_LOCALES.map(async (locale) => {
      const [characters, patch, handbook, handbookInfo, mainText] = await Promise.all([
        fetchJson<RawCharacterTable>(
          gameDataExcelUrlAtRevision(locale, 'character_table.json', gamedataRevision),
          options,
        ),
        fetchJson<RawCharacterPatchTable>(
          gameDataExcelUrlAtRevision(locale, 'char_patch_table.json', gamedataRevision),
          options,
        ),
        fetchJson<RawHandbookTeamTable>(
          gameDataExcelUrlAtRevision(locale, 'handbook_team_table.json', gamedataRevision),
          options,
        ),
        fetchJson<RawHandbookInfoTable>(
          gameDataExcelUrlAtRevision(locale, 'handbook_info_table.json', gamedataRevision),
          options,
        ),
        fetchJson<RawMainTextTable>(
          gameDataExcelUrlAtRevision(locale, 'main_text.json', gamedataRevision),
          options,
        ),
      ])
      return [locale, { characters, patch, handbook, handbookInfo, mainText }] as const
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
    releaseVersionSource,
  ] = await Promise.all([
    fetchJson<RawCharacterMetaTable>(
      githubRawUrl(UPSTREAM.gamedataRepo, gamedataRevision, UPSTREAM.cnCharMetaPath),
      options,
    ),
    fetchJson<RawCharacterMetaTable>(
      githubRawUrl(UPSTREAM.gamedataRepo, gamedataRevision, UPSTREAM.enCharMetaPath),
      options,
    ),
    fetchJson<RawGachaTable>(
      githubRawUrl(UPSTREAM.gamedataRepo, gamedataRevision, UPSTREAM.cnGachaPath),
      options,
    ),
    fetchJson<RawUniEquipData>(
      gameDataExcelUrlAtRevision('cn', 'uniequip_data.json', gamedataRevision),
      options,
    ),
    fetchText(
      githubRawUrl(UPSTREAM.releaseRepo, releaseRevision, UPSTREAM.releaseInfoPath),
      options,
    ),
    fetchText(
      githubRawUrl(UPSTREAM.releaseRepo, releaseRevision, UPSTREAM.releaseCandidatePath),
      options,
    ),
    fetchText(
      githubRawUrl(UPSTREAM.releaseRepo, releaseRevision, UPSTREAM.releaseEventPath),
      options,
    ),
    fetchText(
      githubRawUrl(
        RELEASE_VERSION_UPSTREAM.repository,
        releaseVersionRevision,
        RELEASE_VERSION_UPSTREAM.path,
      ),
      options,
    ),
  ])

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
  const localizedHandbooks = Object.fromEntries(
    GAME_DATA_LOCALES.map((locale) => [locale, localeData[locale].handbookInfo]),
  )

  const releaseDates = buildReleaseDateMap(
    releaseInfoSource,
    releaseCandidateSource,
    releaseEventSource,
    releaseVersionSource,
  )
  const releaseCategories = createReleaseCategoryMap(releaseInfoSource)
  const dataset = alignAvailabilityWithReleaseMetadata(
    applyRaceMetadata(
      normalizeCharacterTables(
        localeData.cn.characters,
        localeData.en.characters,
        sources,
        generatedAt,
        {
          cnPatch: localeData.cn.patch,
          enPatch: localeData.en.patch,
          cnCharMeta,
          enCharMeta,
          cnGacha,
          factionLabels: factionLabelsFromHandbooks(localeData.cn.handbook, localeData.en.handbook),
          localizedCharacterTables,
          localizedPatchTables,
          localizedFactionLabels,
          localizedClassLabels,
          localizedSubclassLabels: { cn: subclassLabelsFromUniEquip(cnUniEquip) },
          releaseDates,
          releaseCategories,
        },
      ),
      localizedHandbooks,
    ),
  )

  return {
    dataset,
    validation: validateOperatorDataset(dataset, { requireSourceCommits: true }),
  }
}
