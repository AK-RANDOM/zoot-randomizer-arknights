import { validatePreparedDataPackage } from './dataPackageValidationNode.ts'
export { validatePreparedDataPackage } from './dataPackageValidationNode.ts'
export { confirmedDateRegressions } from './dataPackageValidation.ts'
import {
  gameLocales,
  OPERATOR_DATASET_SCHEMA_VERSION,
  OPERATOR_DATA_PIPELINE_VERSION,
  type GameLocale,
  type OperatorDataset,
  type OperatorDatasetSources,
} from './operator.ts'
import { UPSTREAM, gameDataExcelPath } from './operatorData.ts'
import { fetchAndBuildOperatorDataset } from './operatorDataPipeline.ts'
import { OPERATOR_SKIN_METADATA_VERSION } from './skinMetadata.ts'
import { loadGarrisonEvents } from './loadGarrisonEvents.ts'
import { garrisonEventHelperOperator } from './garrisonEventHelper.ts'
import { CN_RELEASE_DATES_API } from './releaseMetadata.ts'
import {
  DATA_PACKAGE_FORMAT_VERSION,
  DATA_PACKAGE_READER_VERSION,
  GARRISON_PACKAGE_SCHEMA_VERSION,
  GARRISON_NORMALIZATION_VERSION,
  type DataPackageFile,
  type DataPackageInput,
  type DataPackageInputSnapshot,
  type DataPackageManifest,
  type DataPackageSources,
  type PackagedGarrisonCatalog,
  type PreparedDataPackage,
} from './dataPackage.ts'
import { DataPackageInputSession, fetchLatestDataPackageSources } from './dataPackageInputs.ts'
import {
  canonicalPackageJson,
  correctionsSnapshot,
  dataPackageId,
  dataSha256,
} from './dataPackageJson.ts'

const REGIONS = ['cn', 'global'] as const

function legacySourceShape(sources: DataPackageSources): OperatorDatasetSources {
  return {
    gamedataCnCommit: sources.gamedataCommit,
    gamedataEnCommit: sources.gamedataCommit,
    gamedataJpCommit: sources.gamedataCommit,
    gamedataKrCommit: sources.gamedataCommit,
    gamedataTwCommit: sources.gamedataCommit,
    gamedataCnHandbookCommit: sources.gamedataCommit,
    gamedataEnHandbookCommit: sources.gamedataCommit,
    gamedataJpHandbookCommit: sources.gamedataCommit,
    gamedataKrHandbookCommit: sources.gamedataCommit,
    gamedataTwHandbookCommit: sources.gamedataCommit,
    resourcesCommit: null,
    releaseMetadataCommit: sources.releaseMetadataCommit,
  }
}

async function build(
  session: DataPackageInputSession,
  producerSourceSha256: string,
  previousDataset?: OperatorDataset,
  previousSnapshot?: DataPackageInputSnapshot,
): Promise<{
  prepared: PreparedDataPackage
  snapshot: DataPackageInputSnapshot
  inputBodies: Map<string, Uint8Array>
  inputRequests: number
}> {
  if (!/^[a-f0-9]{64}$/.test(producerSourceSha256))
    throw new Error('An exact producer source fingerprint is required.')
  const built = await fetchAndBuildOperatorDataset(
    legacySourceShape(session.sources),
    session.generatedAt,
    { fetchImpl: session.fetch, requireArtworkSourceCommit: false },
  )
  if (!built.validation.valid)
    throw new Error(`Operator output failed validation: ${built.validation.errors.join('; ')}`)
  const catalogs: PackagedGarrisonCatalog[] = []
  const tables = new Map<string, Promise<Record<string, unknown>>>()
  const fetchTable = (locale: GameLocale, filename: string) => {
    const url = `https://raw.githubusercontent.com/${UPSTREAM.gamedataRepo}/${session.sources.gamedataCommit}/${gameDataExcelPath(locale, filename)}`
    let request = tables.get(url)
    if (!request) {
      request = session.json(url)
      tables.set(url, request)
    }
    return request
  }
  for (const region of REGIONS) {
    for (const locale of gameLocales) {
      const catalog = await loadGarrisonEvents(region, locale, fetchTable)
      if (!catalog.localized)
        throw new Error(`Catalog localization input is unavailable: ${region}/${locale}`)
      catalogs.push({
        schemaVersion: GARRISON_PACKAGE_SCHEMA_VERSION,
        region,
        locale,
        events: catalog.events.map((event) => ({
          ...event,
          helperOperatorId:
            garrisonEventHelperOperator(event, built.dataset.operators, region)?.id ?? null,
        })),
      })
    }
  }
  let snapshot = await session.finish()
  if (previousSnapshot) {
    const contents = (value: DataPackageInputSnapshot) =>
      canonicalPackageJson({
        formatVersion: value.formatVersion,
        sources: value.sources,
        inputs: [...value.inputs].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)),
      })
    if (contents(previousSnapshot) === contents(snapshot)) {
      if (!Number.isFinite(Date.parse(previousSnapshot.generatedAt)))
        throw new Error('Previous input observation timestamp is invalid.')
      snapshot = { ...snapshot, generatedAt: previousSnapshot.generatedAt }
      built.dataset.generatedAt = snapshot.generatedAt
    }
  }
  const files: Record<string, string> = { 'operators.json': canonicalPackageJson(built.dataset) }
  const descriptors: DataPackageFile[] = [
    {
      path: 'operators.json',
      kind: 'operators',
      schemaVersion: OPERATOR_DATASET_SCHEMA_VERSION,
      bytes: Buffer.byteLength(files['operators.json']),
      sha256: dataSha256(files['operators.json']),
    },
  ]
  for (const catalog of catalogs) {
    const path = `garrison/${catalog.region}-${catalog.locale}.json`
    const body = canonicalPackageJson(catalog)
    files[path] = body
    descriptors.push({
      path,
      kind: 'garrison',
      region: catalog.region,
      locale: catalog.locale,
      schemaVersion: GARRISON_PACKAGE_SCHEMA_VERSION,
      bytes: Buffer.byteLength(body),
      sha256: dataSha256(body),
    })
  }
  const unsigned: Omit<DataPackageManifest, 'packageId'> = {
    packageFormatVersion: DATA_PACKAGE_FORMAT_VERSION,
    generatedAt: snapshot.generatedAt,
    compatibility: {
      minimumReaderVersion: DATA_PACKAGE_READER_VERSION,
      operatorDatasetSchemaVersion: OPERATOR_DATASET_SCHEMA_VERSION,
      garrisonCatalogSchemaVersion: GARRISON_PACKAGE_SCHEMA_VERSION,
    },
    normalization: {
      operatorPipelineVersion: OPERATOR_DATA_PIPELINE_VERSION,
      skinMetadataVersion: OPERATOR_SKIN_METADATA_VERSION,
      garrisonNormalizationVersion: GARRISON_NORMALIZATION_VERSION,
      producerSourceSha256,
      correctionsSha256: dataSha256(canonicalPackageJson(correctionsSnapshot())),
    },
    sources: {
      gamedata: { repository: UPSTREAM.gamedataRepo, commit: session.sources.gamedataCommit },
      releaseMetadata: {
        repository: UPSTREAM.releaseRepo,
        commit: session.sources.releaseMetadataCommit,
      },
      publishedCnDates: {
        endpoint: CN_RELEASE_DATES_API,
        inputSha256: session.publishedDatesHash(snapshot),
      },
    },
    files: descriptors.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  }
  const manifest: DataPackageManifest = { ...unsigned, packageId: dataPackageId(unsigned) }
  const validation = validatePreparedDataPackage({ manifest, files }, previousDataset)
  if (!validation.valid)
    throw new Error(`Prepared package failed validation: ${validation.errors.join('; ')}`)
  return {
    prepared: { manifest, files, dataset: built.dataset, catalogs, warnings: validation.warnings },
    snapshot,
    inputBodies: session.bodies,
    inputRequests: session.requests,
  }
}

/** Every live invocation checks PRTS; unchanged repository heads never skip the date source. */
export async function captureDataPackage(options: {
  producerSourceSha256: string
  fetchImpl?: typeof fetch
  sources?: DataPackageSources
  generatedAt?: string
  previousDataset?: OperatorDataset
  previousSnapshot?: DataPackageInputSnapshot
}) {
  const sources = options.sources ?? (await fetchLatestDataPackageSources(options.fetchImpl))
  const session = new DataPackageInputSession({
    sources,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fetchImpl: options.fetchImpl,
  })
  return build(
    session,
    options.producerSourceSha256,
    options.previousDataset,
    options.previousSnapshot,
  )
}

/** No network fallback is available in a frozen rebuild. */
export async function rebuildDataPackage(
  snapshot: DataPackageInputSnapshot,
  readInput: (input: DataPackageInput) => Promise<Uint8Array>,
  options: { producerSourceSha256: string; previousDataset?: OperatorDataset },
) {
  const session = new DataPackageInputSession({
    snapshot,
    sources: snapshot.sources,
    generatedAt: snapshot.generatedAt,
    readInput,
  })
  return build(session, options.producerSourceSha256, options.previousDataset)
}
