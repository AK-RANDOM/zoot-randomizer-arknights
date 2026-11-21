import { gameLocales, OPERATOR_DATASET_SCHEMA_VERSION, type OperatorDataset } from './operator.ts'
import { validateOperatorDataset } from './operatorData.ts'
import { garrisonEventHelperOperator } from './garrisonEventHelper.ts'
import type { DataPackageArtifact, PackagedGarrisonCatalog } from './dataPackage.ts'
import { canonicalPackageJson, dataPackageIdentityText } from './dataPackageFormat.ts'
const REGIONS = ['cn', 'global'] as const
const STAGE_TYPES = ['standard', 'h', 'ex', 's'] as const

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
export function validDataPackageSources(value: unknown): boolean {
  if (!record(value)) return false
  for (const [key, repository] of [
    ['gamedata', 'ArknightsAssets/ArknightsGamedata'],
    ['releaseMetadata', 'nadering/arknights-toolbox'],
  ]) {
    const source = value[key]
    if (
      !record(source) ||
      source.repository !== repository ||
      typeof source.commit !== 'string' ||
      !/^[a-f0-9]{40}$/.test(source.commit)
    )
      return false
  }
  const dates = value.publishedCnDates
  return (
    record(dates) &&
    dates.endpoint === 'https://prts.wiki/api.php' &&
    typeof dates.inputSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(dates.inputSha256)
  )
}
export function validateDataPackageEnvelope(value: unknown): string[] {
  if (!record(value) || !record(value.manifest) || !record(value.files))
    return ['Invalid data package envelope.']
  const m = value.manifest
  if (
    !record(m.compatibility) ||
    !record(m.normalization) ||
    !record(m.sources) ||
    !Array.isArray(m.files) ||
    m.files.length !== 11 ||
    typeof m.packageId !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(m.packageId) ||
    typeof m.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(m.generatedAt))
  )
    return ['Invalid data package manifest.']
  if (!validDataPackageSources(m.sources)) return ['Invalid data package sources.']
  if (
    m.files.some(
      (file) =>
        !record(file) ||
        typeof file.path !== 'string' ||
        typeof file.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(file.sha256) ||
        !Number.isSafeInteger(file.bytes) ||
        Number(file.bytes) <= 0,
    ) ||
    Object.values(value.files).some((body) => typeof body !== 'string')
  )
    return ['Invalid payload descriptors.']
  if (
    Object.keys(value.files).length !== 11 ||
    Object.values(value.files).reduce<number>(
      (sum, body) => sum + new TextEncoder().encode(body as string).byteLength,
      0,
    ) >
      16 * 1024 * 1024
  )
    return ['Invalid payload count or size.']
  return []
}

export function confirmedDateRegressions(
  previous: OperatorDataset | undefined,
  next: OperatorDataset,
): string[] {
  if (!previous) return []
  const current = new Map(next.operators.map((operator) => [operator.id, operator]))
  const errors: string[] = []
  for (const operator of previous.operators) {
    const candidate = current.get(operator.id)
    for (const region of REGIONS) {
      if (
        operator.availableOn[region] &&
        operator.release[region].date &&
        (!candidate?.availableOn[region] || !candidate.release[region].date)
      )
        errors.push(`Confirmed ${region} date would be lost for ${operator.id}.`)
    }
  }
  return errors
}

export function validateDataPackageWithHash(
  prepared: unknown,
  hash: (text: string) => string,
  previousDataset?: OperatorDataset,
) {
  const envelopeErrors = validateDataPackageEnvelope(prepared)
  if (envelopeErrors.length)
    return { valid: false, errors: envelopeErrors, warnings: [] as string[] }
  const { manifest, files } = prepared as DataPackageArtifact
  const errors: string[] = []
  const expected = new Set([
    'operators.json',
    ...REGIONS.flatMap((region) =>
      gameLocales.map((locale) => `garrison/${region}-${locale}.json`),
    ),
  ])
  if (
    manifest.packageFormatVersion !== 1 ||
    manifest.compatibility.minimumReaderVersion !== 1 ||
    manifest.compatibility.operatorDatasetSchemaVersion !== OPERATOR_DATASET_SCHEMA_VERSION ||
    manifest.compatibility.garrisonCatalogSchemaVersion !== 1
  )
    errors.push('Unsupported package or payload format.')
  if (manifest.packageId !== `sha256:${hash(dataPackageIdentityText(manifest))}`)
    errors.push('Package identity does not match its manifest.')
  if (
    !/^[a-f0-9]{64}$/.test(manifest.normalization.producerSourceSha256) ||
    !/^[a-f0-9]{64}$/.test(manifest.normalization.correctionsSha256)
  )
    errors.push('Package normalization fingerprints are invalid.')
  if (
    manifest.files.length !== expected.size ||
    new Set(manifest.files.map((entry) => entry.path)).size !== expected.size ||
    Object.keys(files).length !== expected.size
  )
    errors.push('Package must contain exactly one roster and all ten catalogs.')
  for (const descriptor of manifest.files) {
    const body = files[descriptor.path]
    if (!expected.has(descriptor.path) || typeof body !== 'string') {
      errors.push(`Unexpected or missing payload: ${descriptor.path}`)
      continue
    }
    if (
      new TextEncoder().encode(body).byteLength !== descriptor.bytes ||
      hash(body) !== descriptor.sha256
    )
      errors.push(`Payload checksum/size mismatch: ${descriptor.path}`)
    if (
      descriptor.path === 'operators.json'
        ? descriptor.kind !== 'operators' ||
          descriptor.schemaVersion !== OPERATOR_DATASET_SCHEMA_VERSION
        : descriptor.kind !== 'garrison' ||
          descriptor.schemaVersion !== 1 ||
          descriptor.path !== `garrison/${descriptor.region}-${descriptor.locale}.json`
    )
      errors.push(`Payload descriptor mismatch: ${descriptor.path}`)
  }
  for (const path of [...expected, ...Object.keys(files)])
    if (!expected.has(path) || typeof files[path] !== 'string')
      errors.push(`Unexpected or missing payload: ${path}`)
  if (errors.length) return { valid: false, errors, warnings: [] as string[] }

  let dataset: OperatorDataset
  const catalogs: PackagedGarrisonCatalog[] = []
  try {
    dataset = JSON.parse(files['operators.json']) as OperatorDataset
    for (const region of REGIONS) {
      for (const locale of gameLocales) {
        const catalog = JSON.parse(
          files[`garrison/${region}-${locale}.json`],
        ) as PackagedGarrisonCatalog
        if (catalog.region !== region || catalog.locale !== locale)
          errors.push(`Catalog region/language differs from its path: ${region}/${locale}`)
        catalogs.push(catalog)
      }
    }
  } catch {
    return { valid: false, errors: ['Package contains invalid JSON.'], warnings: [] as string[] }
  }
  const validation = validateOperatorDataset(dataset, {
    requireSourceCommits: true,
    requireArtworkSourceCommit: false,
  })
  if (!validation.valid)
    return {
      valid: false,
      errors: [...errors, ...validation.errors],
      warnings: validation.warnings,
    }
  errors.push(...validation.errors, ...confirmedDateRegressions(previousDataset, dataset))
  if (
    dataset.sources.resourcesCommit !== null ||
    dataset.sources.releaseMetadataCommit !== manifest.sources.releaseMetadata.commit ||
    Object.entries(dataset.sources).some(
      ([key, value]) => key.startsWith('gamedata') && value !== manifest.sources.gamedata.commit,
    )
  )
    errors.push('Dataset sources differ from the package or contain an artwork dependency.')
  if (
    dataset.generatedAt !== manifest.generatedAt ||
    dataset.dataPipelineVersion !== manifest.normalization.operatorPipelineVersion ||
    dataset.skinMetadataVersion !== manifest.normalization.skinMetadataVersion
  )
    errors.push('Dataset provenance differs from the package.')
  if (
    gameLocales.some(
      (locale) =>
        !dataset.localizations?.[locale] ||
        !Object.keys(dataset.localizations[locale].operatorNames).length,
    )
  )
    errors.push('Package is missing a supported localization.')
  for (const catalog of catalogs) {
    if (
      catalog.schemaVersion !== 1 ||
      !REGIONS.includes(catalog.region) ||
      !gameLocales.includes(catalog.locale) ||
      !Array.isArray(catalog.events) ||
      !catalog.events.length
    ) {
      errors.push('Invalid or empty regional catalog.')
      continue
    }
    const ids = new Set<string>()
    for (const event of catalog.events) {
      if (
        !event ||
        typeof event.id !== 'string' ||
        !event.id ||
        ids.has(event.id) ||
        typeof event.name !== 'string' ||
        !event.name.trim() ||
        !['main', 'side'].includes(event.group) ||
        (event.releaseTime !== null &&
          (!Number.isFinite(event.releaseTime) || event.releaseTime <= 0))
      ) {
        errors.push(`Invalid or duplicate event in ${catalog.region}/${catalog.locale}.`)
        continue
      }
      ids.add(event.id)
      if (
        !event.stages ||
        STAGE_TYPES.some(
          (type) =>
            !Array.isArray(event.stages[type]) ||
            event.stages[type].some((code) => typeof code !== 'string' || !code.trim()) ||
            new Set(event.stages[type]).size !== event.stages[type].length,
        ) ||
        !STAGE_TYPES.some((type) => event.stages[type].length)
      )
        errors.push(`Invalid stage groups: ${catalog.region}/${event.id}`)
      if (
        event.helperOperatorId !==
        (garrisonEventHelperOperator(event, dataset.operators, catalog.region)?.id ?? null)
      )
        errors.push(`Invalid event representative: ${catalog.region}/${event.id}`)
    }
  }
  // Localization can replace names, never content identities, stage groups/order or helpers.
  if (errors.length) return { valid: false, errors, warnings: validation.warnings }
  for (const region of REGIONS) {
    const regional = catalogs.filter((catalog) => catalog.region === region)
    const structural = regional.map((catalog) =>
      canonicalPackageJson(
        catalog.events.map((event) =>
          Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'name')),
        ),
      ),
    )
    if (new Set(structural).size !== 1)
      errors.push(`Localization changed ${region} catalog identities or stages.`)
  }
  return { valid: errors.length === 0, errors, warnings: validation.warnings }
}
