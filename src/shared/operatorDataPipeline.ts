import type {
  OperatorDataset,
  OperatorDatasetSources,
} from './operator.ts'
import {
  GAME_DATA_LOCALES,
  UPSTREAM,
  classLabelsFromMainText,
  createReleaseCategoryMap,
  createReleaseDateMap,
  factionLabelsFromHandbook,
  factionLabelsFromHandbooks,
  gameDataExcelPath,
  gameDataExcelUrl,
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
import {
  applyRaceMetadata,
  type RawHandbookInfoTable,
} from './raceMetadata.ts'

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

async function latestCommit(
  repository: string,
  path: string,
  options: OperatorDataFetchOptions,
): Promise<string> {
  const url = new URL(`https://api.github.com/repos/${repository}/commits`)
  url.searchParams.set('path', path)
  url.searchParams.set('per_page', '1')
  const commits = await fetchJson<Array<{ sha: string }>>(url.toString(), options)
  if (!commits[0]?.sha) throw new Error(`No upstream commit found for ${repository}/${path}`)
  return commits[0].sha
}

export async function fetchLatestOperatorDatasetSources(
  options: OperatorDataFetchOptions = {},
): Promise<OperatorDatasetSources> {
  const [
    gamedataCnCommit,
    gamedataEnCommit,
    gamedataJpCommit,
    gamedataKrCommit,
    gamedataTwCommit,
    gamedataCnHandbookCommit,
    gamedataEnHandbookCommit,
    gamedataJpHandbookCommit,
    gamedataKrHandbookCommit,
    gamedataTwHandbookCommit,
    resourcesCommit,
    releaseMetadataCommit,
  ] = await Promise.all([
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('cn', 'character_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('en', 'character_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('jp', 'character_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('kr', 'character_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('tw', 'character_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('cn', 'handbook_info_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('en', 'handbook_info_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('jp', 'handbook_info_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('kr', 'handbook_info_table.json'), options),
    latestCommit(UPSTREAM.gamedataRepo, gameDataExcelPath('tw', 'handbook_info_table.json'), options),
    latestCommit(UPSTREAM.resourcesRepo, UPSTREAM.resourceAvatarPath, options),
    latestCommit(UPSTREAM.releaseRepo, UPSTREAM.releaseInfoPath, options),
  ])

  return {
    gamedataCnCommit,
    gamedataEnCommit,
    gamedataJpCommit,
    gamedataKrCommit,
    gamedataTwCommit,
    gamedataCnHandbookCommit,
    gamedataEnHandbookCommit,
    gamedataJpHandbookCommit,
    gamedataKrHandbookCommit,
    gamedataTwHandbookCommit,
    resourcesCommit,
    releaseMetadataCommit,
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
    left.releaseMetadataCommit === right.releaseMetadataCommit
  )
}

export async function fetchAndBuildOperatorDataset(
  sources: OperatorDatasetSources,
  generatedAt = new Date().toISOString(),
  options: OperatorDataFetchOptions = {},
): Promise<{ dataset: OperatorDataset; validation: OperatorDatasetValidation }> {
  const localeEntries = await Promise.all(
    GAME_DATA_LOCALES.map(async (locale) => {
      const [characters, patch, handbook, handbookInfo, mainText] = await Promise.all([
        fetchJson<RawCharacterTable>(gameDataExcelUrl(locale, 'character_table.json'), options),
        fetchJson<RawCharacterPatchTable>(gameDataExcelUrl(locale, 'char_patch_table.json'), options),
        fetchJson<RawHandbookTeamTable>(gameDataExcelUrl(locale, 'handbook_team_table.json'), options),
        fetchJson<RawHandbookInfoTable>(gameDataExcelUrl(locale, 'handbook_info_table.json'), options),
        fetchJson<RawMainTextTable>(gameDataExcelUrl(locale, 'main_text.json'), options),
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
  ] = await Promise.all([
    fetchJson<RawCharacterMetaTable>(UPSTREAM.cnCharMetaUrl, options),
    fetchJson<RawCharacterMetaTable>(UPSTREAM.enCharMetaUrl, options),
    fetchJson<RawGachaTable>(UPSTREAM.cnGachaUrl, options),
    fetchJson<RawUniEquipData>(gameDataExcelUrl('cn', 'uniequip_data.json'), options),
    fetchText(UPSTREAM.releaseInfoUrl, options),
    fetchText(UPSTREAM.releaseCandidateUrl, options),
    fetchText(UPSTREAM.releaseEventUrl, options),
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

  const releaseDates = createReleaseDateMap(
    releaseInfoSource,
    releaseCandidateSource,
    releaseEventSource,
  )
  const releaseCategories = createReleaseCategoryMap(releaseInfoSource)
  const dataset = applyRaceMetadata(
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
        factionLabels: factionLabelsFromHandbooks(
          localeData.cn.handbook,
          localeData.en.handbook,
        ),
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
  )

  return {
    dataset,
    validation: validateOperatorDataset(dataset, { requireSourceCommits: true }),
  }
}
