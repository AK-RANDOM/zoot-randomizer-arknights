import type { GameLocale, OperatorDataset, ReleaseServer } from './operator.ts'
import type { GarrisonEvent } from './garrisonEventCatalog.ts'

export const DATA_PACKAGE_FORMAT_VERSION = 1 as const
export const DATA_PACKAGE_READER_VERSION = 1 as const
export const GARRISON_PACKAGE_SCHEMA_VERSION = 1 as const
export const GARRISON_NORMALIZATION_VERSION = 1 as const

export interface DataPackageSources {
  gamedataCommit: string
  releaseMetadataCommit: string
}

export interface DataPackageInput {
  url: string
  sha256: string
  bytes: number
}

export interface DataPackageInputSnapshot {
  formatVersion: 1
  /** Frozen input observation time, reused verbatim during offline rebuilds. */
  generatedAt: string
  sources: DataPackageSources
  inputs: DataPackageInput[]
}

export interface PackagedGarrisonCatalog {
  schemaVersion: typeof GARRISON_PACKAGE_SCHEMA_VERSION
  region: ReleaseServer
  locale: GameLocale
  events: Array<GarrisonEvent & { helperOperatorId: string | null }>
}

export type DataPackageFile = {
  path: string
  bytes: number
  sha256: string
} & (
  | { kind: 'operators'; schemaVersion: number }
  | { kind: 'garrison'; schemaVersion: number; region: ReleaseServer; locale: GameLocale }
)

export interface DataPackageManifest {
  packageFormatVersion: typeof DATA_PACKAGE_FORMAT_VERSION
  packageId: string
  generatedAt: string
  compatibility: {
    minimumReaderVersion: number
    operatorDatasetSchemaVersion: number
    garrisonCatalogSchemaVersion: number
  }
  normalization: {
    operatorPipelineVersion: number
    skinMetadataVersion: number
    garrisonNormalizationVersion: number
    producerSourceSha256: string
    correctionsSha256: string
  }
  sources: {
    gamedata: { repository: string; commit: string }
    releaseMetadata: { repository: string; commit: string }
    publishedCnDates: { endpoint: string; inputSha256: string }
  }
  files: DataPackageFile[]
}

/** Prepared output only; this does not activate or publish an application update. */
export interface PreparedDataPackage {
  manifest: DataPackageManifest
  files: Record<string, string>
  dataset: OperatorDataset
  catalogs: PackagedGarrisonCatalog[]
  warnings: string[]
}

export interface DataPackageArtifact {
  manifest: DataPackageManifest
  files: Record<string, string>
}

export type DataPackageChannelName = 'preview' | 'production'

export interface DataPackageChannel {
  formatVersion: 1
  channel: DataPackageChannelName
  packageId: string
  artifactPath: string
  artifactSha256: string
  artifactBytes: number
  artifactEncoding: 'gzip'
  compressedSha256: string
  compressedBytes: number
  snapshotSha256: string
  minimumReaderVersion: number
  generatedAt: string
  publishedAt: string
  sources: DataPackageManifest['sources']
}
