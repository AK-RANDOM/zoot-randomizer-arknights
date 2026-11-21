import { normalizeCharacterTables } from '../../src/shared/operatorData.ts'
import { gameLocales, OPERATOR_DATA_PIPELINE_VERSION } from '../../src/shared/operator.ts'
import { OPERATOR_SKIN_METADATA_VERSION } from '../../src/shared/skinMetadata.ts'
import {
  canonicalPackageJson,
  dataPackageId,
  dataSha256,
} from '../../src/shared/dataPackageJson.ts'
import type {
  DataPackageArtifact,
  DataPackageInputSnapshot,
  DataPackageManifest,
  DataPackageChannel,
} from '../../src/shared/dataPackage.ts'
import { gzipSync } from 'node:zlib'

export function rehashDataPackage(artifact: DataPackageArtifact): DataPackageArtifact {
  for (const descriptor of artifact.manifest.files) {
    const body = artifact.files[descriptor.path]
    descriptor.bytes = Buffer.byteLength(body)
    descriptor.sha256 = dataSha256(body)
  }
  artifact.manifest.packageId = dataPackageId(artifact.manifest)
  return artifact
}

export function fixtureFeed(artifact: DataPackageArtifact) {
  const body = canonicalPackageJson(artifact)
  const gzip = gzipSync(body)
  const pointer: DataPackageChannel = {
    formatVersion: 1,
    channel: 'preview',
    packageId: artifact.manifest.packageId,
    artifactPath: `packages/${artifact.manifest.packageId.slice(7)}/package.json.gz`,
    artifactSha256: dataSha256(body),
    artifactBytes: Buffer.byteLength(body),
    artifactEncoding: 'gzip',
    compressedSha256: dataSha256(gzip),
    compressedBytes: gzip.length,
    snapshotSha256: 'f'.repeat(64),
    minimumReaderVersion: artifact.manifest.compatibility.minimumReaderVersion,
    generatedAt: artifact.manifest.generatedAt,
    publishedAt: artifact.manifest.generatedAt,
    sources: artifact.manifest.sources,
  }
  const requests: string[] = []
  const fetchImpl = (async (input) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith('/channels/preview.json')) return new Response(JSON.stringify(pointer))
    if (url.endsWith(pointer.artifactPath)) return new Response(gzip)
    throw new Error(`Unexpected metadata request: ${url}`)
  }) as typeof fetch
  return { pointer, gzip, requests, fetchImpl }
}

export function dataPackageFixture(date = '2026-01-01T00:00:00.000Z'): {
  artifact: DataPackageArtifact
  snapshot: DataPackageInputSnapshot
} {
  const game = 'a'.repeat(40),
    release = 'b'.repeat(40)
  const records = Object.fromEntries(
    Array.from({ length: 300 }, (_, index) => [
      `char_fixture_${index}`,
      {
        name: `Fixture ${index}`,
        rarity: 'TIER_6',
        profession: 'WARRIOR',
        subProfessionId: 'lord',
        isNotObtainable: false,
      },
    ]),
  )
  const sources = {
    gamedataCnCommit: game,
    gamedataEnCommit: game,
    gamedataJpCommit: game,
    gamedataKrCommit: game,
    gamedataTwCommit: game,
    resourcesCommit: null,
    releaseMetadataCommit: release,
  }
  const dataset = normalizeCharacterTables(records, records, sources, date, {
    releaseDates: Object.fromEntries(
      Object.keys(records).map((id) => [id, { cn: '2019-05-01', global: '2020-01-16' }]),
    ),
    localizedCharacterTables: Object.fromEntries(gameLocales.map((locale) => [locale, records])),
  })
  dataset.dataPipelineVersion = OPERATOR_DATA_PIPELINE_VERSION
  dataset.skinMetadataVersion = OPERATOR_SKIN_METADATA_VERSION
  const input = {
    url: 'https://prts.wiki/api.php?action=cargoquery&format=json&tables=char_obtain&fields=_pageName%3Dname%2CcnOnlineTime%3DreleaseDate&limit=500&offset=0&order_by=_pageName',
    bytes: 1,
    sha256: 'd'.repeat(64),
  }
  const snapshot: DataPackageInputSnapshot = {
    formatVersion: 1,
    generatedAt: date,
    sources: { gamedataCommit: game, releaseMetadataCommit: release },
    inputs: [input],
  }
  const files: Record<string, string> = { 'operators.json': canonicalPackageJson(dataset) }
  const descriptors: DataPackageManifest['files'] = [
    {
      path: 'operators.json',
      kind: 'operators',
      schemaVersion: 6,
      bytes: Buffer.byteLength(files['operators.json']),
      sha256: dataSha256(files['operators.json']),
    },
  ]
  for (const region of ['cn', 'global'] as const)
    for (const locale of gameLocales) {
      const path = `garrison/${region}-${locale}.json`
      const body = canonicalPackageJson({
        schemaVersion: 1,
        region,
        locale,
        events: [
          {
            id: 'act1side',
            name: `Fixture ${locale}`,
            group: 'side',
            releaseTime: 1767225600,
            stages: { standard: ['FX-1'], h: [], ex: [], s: [] },
            helperOperatorId: null,
          },
        ],
      })
      files[path] = body
      descriptors.push({
        path,
        kind: 'garrison',
        region,
        locale,
        schemaVersion: 1,
        bytes: Buffer.byteLength(body),
        sha256: dataSha256(body),
      })
    }
  const unsigned: Omit<DataPackageManifest, 'packageId'> = {
    packageFormatVersion: 1,
    generatedAt: date,
    compatibility: {
      minimumReaderVersion: 1,
      operatorDatasetSchemaVersion: 6,
      garrisonCatalogSchemaVersion: 1,
    },
    normalization: {
      operatorPipelineVersion: OPERATOR_DATA_PIPELINE_VERSION,
      skinMetadataVersion: OPERATOR_SKIN_METADATA_VERSION,
      garrisonNormalizationVersion: 1,
      producerSourceSha256: 'c'.repeat(64),
      correctionsSha256: 'e'.repeat(64),
    },
    sources: {
      gamedata: { repository: 'ArknightsAssets/ArknightsGamedata', commit: game },
      releaseMetadata: { repository: 'nadering/arknights-toolbox', commit: release },
      publishedCnDates: {
        endpoint: 'https://prts.wiki/api.php',
        inputSha256: dataSha256(canonicalPackageJson([input])),
      },
    },
    files: descriptors,
  }
  return {
    artifact: { manifest: { ...unsigned, packageId: dataPackageId(unsigned) }, files },
    snapshot,
  }
}
