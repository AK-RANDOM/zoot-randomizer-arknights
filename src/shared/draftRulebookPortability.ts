import type { OperatorDataset } from './operator'
import {
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  validateDraftRulebook,
  type DraftRulebook,
  type DraftRulebookSelector,
} from './draftRulebook'

export const MAX_DRAFT_RULEBOOK_FILE_BYTES = 2 * 1024 * 1024

export type DraftRulebookCompatibilitySeverity = 'warning' | 'error'

export interface DraftRulebookCompatibilityIssue {
  severity: DraftRulebookCompatibilitySeverity
  code: string
  path: string
  message: string
}

export interface DraftRulebookImportAnalysis {
  compatible: boolean
  migrated: boolean
  sourceSchemaVersion: number | null
  rulebook: DraftRulebook | null
  issues: DraftRulebookCompatibilityIssue[]
  errors: string[]
  warnings: string[]
}

interface MigrationResult {
  document: unknown
  sourceSchemaVersion: number | null
  migrated: boolean
  issues: DraftRulebookCompatibilityIssue[]
}

type JsonRecord = Record<string, unknown>
type DraftRulebookMigration = (document: JsonRecord) => JsonRecord

/**
 * Schema v1 is the first externally portable Draft Rulebook format. Keep an
 * explicit migration registry now so future schema bumps have one canonical
 * import path instead of ad-hoc UI conversions.
 *
 * Keys are source schema versions; each migration must return the next version.
 */
const DRAFT_RULEBOOK_MIGRATIONS: Readonly<Record<number, DraftRulebookMigration>> = {}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function issue(
  severity: DraftRulebookCompatibilitySeverity,
  code: string,
  path: string,
  message: string,
): DraftRulebookCompatibilityIssue {
  return { severity, code, path, message }
}

export function migrateDraftRulebookDocument(value: unknown): MigrationResult {
  if (!isRecord(value)) {
    return {
      document: value,
      sourceSchemaVersion: null,
      migrated: false,
      issues: [issue('error', 'invalid-root', 'rulebook', 'Draft Rulebook must be an object.')],
    }
  }

  const rawVersion = value.schemaVersion
  if (!Number.isInteger(rawVersion) || (rawVersion as number) < 1) {
    return {
      document: value,
      sourceSchemaVersion: typeof rawVersion === 'number' ? rawVersion : null,
      migrated: false,
      issues: [issue(
        'error',
        'invalid-schema-version',
        'rulebook.schemaVersion',
        'Draft Rulebook schemaVersion must be a positive integer.',
      )],
    }
  }

  const sourceSchemaVersion = rawVersion as number
  if (sourceSchemaVersion > DRAFT_RULEBOOK_SCHEMA_VERSION) {
    return {
      document: value,
      sourceSchemaVersion,
      migrated: false,
      issues: [issue(
        'error',
        'newer-schema-version',
        'rulebook.schemaVersion',
        `This Draft Rulebook uses newer schema version ${sourceSchemaVersion}; this app supports up to version ${DRAFT_RULEBOOK_SCHEMA_VERSION}.`,
      )],
    }
  }

  let document = cloneJson(value)
  let version = sourceSchemaVersion
  let migrated = false
  const issues: DraftRulebookCompatibilityIssue[] = []

  while (version < DRAFT_RULEBOOK_SCHEMA_VERSION) {
    const migration = DRAFT_RULEBOOK_MIGRATIONS[version]
    if (!migration) {
      issues.push(issue(
        'error',
        'unsupported-older-schema',
        'rulebook.schemaVersion',
        `Draft Rulebook schema version ${version} cannot be migrated by this app.`,
      ))
      break
    }
    document = migration(document)
    version += 1
    migrated = true
  }

  return { document, sourceSchemaVersion, migrated, issues }
}

interface ReferenceSets {
  operatorIds: Set<string>
  subclassIds: Set<string>
  factionIds: Set<string>
  raceIds: Set<string>
}

function datasetReferenceSets(dataset: OperatorDataset): ReferenceSets {
  const operatorIds = new Set<string>()
  const subclassIds = new Set<string>()
  const factionIds = new Set(Object.keys(dataset.factionLabels))
  const raceIds = new Set(Object.keys(dataset.raceLabels ?? {}))

  for (const operator of dataset.operators) {
    operatorIds.add(operator.id)
    subclassIds.add(operator.subclass.id)
    for (const id of [
      operator.faction.nationId,
      operator.faction.groupId,
      operator.faction.teamId,
      operator.faction.main,
      ...(operator.faction.primary ?? []),
      ...operator.faction.affiliations,
    ]) {
      if (id) factionIds.add(id)
    }
    for (const id of operator.raceIds ?? []) raceIds.add(id)
  }

  return { operatorIds, subclassIds, factionIds, raceIds }
}

function unresolvedReferenceIssue(path: string, kind: string, value: string): DraftRulebookCompatibilityIssue {
  return issue(
    'warning',
    'unresolved-reference',
    path,
    `${kind} reference “${value}” is not present in the installed dataset. It will be preserved and may resolve after a data update.`,
  )
}

function inspectSelector(
  selector: DraftRulebookSelector,
  path: string,
  references: ReferenceSets,
  issues: DraftRulebookCompatibilityIssue[],
): void {
  switch (selector.type) {
    case 'operators':
      selector.operatorIds.forEach((id, index) => {
        if (!references.operatorIds.has(id)) {
          issues.push(unresolvedReferenceIssue(`${path}.operatorIds[${index}]`, 'Operator', id))
        }
      })
      return
    case 'subclasses':
      selector.subclassIds.forEach((id, index) => {
        if (!references.subclassIds.has(id)) {
          issues.push(unresolvedReferenceIssue(`${path}.subclassIds[${index}]`, 'Subclass', id))
        }
      })
      return
    case 'factions':
      selector.factionIds.forEach((id, index) => {
        if (!references.factionIds.has(id)) {
          issues.push(unresolvedReferenceIssue(`${path}.factionIds[${index}]`, 'Faction', id))
        }
      })
      return
    case 'races':
      selector.raceIds.forEach((id, index) => {
        if (!references.raceIds.has(id)) {
          issues.push(unresolvedReferenceIssue(`${path}.raceIds[${index}]`, 'Race', id))
        }
      })
      return
    case 'rarities':
    case 'classes':
      return
  }
}

function inspectFeaturedOperators(
  operatorIds: readonly string[],
  path: string,
  references: ReferenceSets,
  issues: DraftRulebookCompatibilityIssue[],
): void {
  operatorIds.forEach((id, index) => {
    if (!references.operatorIds.has(id)) {
      issues.push(unresolvedReferenceIssue(`${path}[${index}]`, 'Featured operator', id))
    }
  })
}

export function inspectDraftRulebookCompatibility(
  rulebook: DraftRulebook,
  dataset: OperatorDataset,
): DraftRulebookCompatibilityIssue[] {
  const issues: DraftRulebookCompatibilityIssue[] = []
  const references = datasetReferenceSets(dataset)

  if (rulebook.pool.source !== 'inherit-global') {
    for (const key of ['allOf', 'anyOf', 'noneOf'] as const) {
      rulebook.pool.eligibility[key].forEach((selector, index) =>
        inspectSelector(selector, `rulebook.pool.eligibility.${key}[${index}]`, references, issues))
    }
  }

  for (const operatorId of Object.keys(rulebook.overrides.operatorCosts)) {
    if (!references.operatorIds.has(operatorId)) {
      issues.push(unresolvedReferenceIssue(
        `rulebook.overrides.operatorCosts.${operatorId}`,
        'Operator override',
        operatorId,
      ))
    }
  }

  rulebook.interactions.forEach((interaction, index) => {
    const path = `rulebook.interactions[${index}]`
    if (interaction.type === 'anchor') {
      inspectSelector(interaction.source, `${path}.source`, references, issues)
      inspectSelector(interaction.target, `${path}.target`, references, issues)
    } else if (interaction.type === 'progressive') {
      inspectSelector(interaction.group, `${path}.group`, references, issues)
    } else {
      inspectSelector(interaction.group, `${path}.group`, references, issues)
      if (interaction.anchor) inspectSelector(interaction.anchor, `${path}.anchor`, references, issues)
    }
  })

  const distribution = rulebook.generalRules.pullDistribution
  if (distribution?.type === 'arknights' && distribution.rateUps) {
    const supportedBuckets = new Set(['3', '4', '5', '6'])
    for (const [bucketId, rateUp] of Object.entries(distribution.rateUps) as Array<[string, { featuredOperatorIds: string[] }]>) {
      if (!supportedBuckets.has(bucketId)) {
        issues.push(issue(
          'error',
          'unsupported-arknights-bucket',
          `rulebook.generalRules.pullDistribution.rateUps.${bucketId}`,
          `Arknights Headhunting rate-up bucket “${bucketId}” is not supported by this app.`,
        ))
      }
      inspectFeaturedOperators(
        rateUp.featuredOperatorIds,
        `rulebook.generalRules.pullDistribution.rateUps.${bucketId}.featuredOperatorIds`,
        references,
        issues,
      )
    }
  } else if (distribution?.type === 'custom') {
    distribution.buckets.forEach((bucket, index) => {
      if (!bucket.rateUp) return
      inspectFeaturedOperators(
        bucket.rateUp.featuredOperatorIds,
        `rulebook.generalRules.pullDistribution.buckets[${index}].rateUp.featuredOperatorIds`,
        references,
        issues,
      )
    })
  }

  return issues
}

export function analyzeDraftRulebookImport(
  serialized: string,
  dataset: OperatorDataset,
): DraftRulebookImportAnalysis {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    const parseIssue = issue('error', 'invalid-json', 'rulebook', 'Draft Rulebook file is not valid JSON.')
    return {
      compatible: false,
      migrated: false,
      sourceSchemaVersion: null,
      rulebook: null,
      issues: [parseIssue],
      errors: [parseIssue.message],
      warnings: [],
    }
  }

  const migration = migrateDraftRulebookDocument(parsed)
  const issues = [...migration.issues]
  if (!issues.some((entry) => entry.severity === 'error')) {
    const validation = validateDraftRulebook(migration.document)
    for (const message of validation.errors) {
      issues.push(issue('error', 'invalid-rulebook', 'rulebook', message))
    }
  }

  let rulebook: DraftRulebook | null = null
  if (!issues.some((entry) => entry.severity === 'error')) {
    rulebook = cloneJson(migration.document) as DraftRulebook
    issues.push(...inspectDraftRulebookCompatibility(rulebook, dataset))
  }

  const errors = issues.filter((entry) => entry.severity === 'error').map((entry) => entry.message)
  const warnings = issues.filter((entry) => entry.severity === 'warning').map((entry) => entry.message)
  if (errors.length > 0) rulebook = null

  return {
    compatible: errors.length === 0,
    migrated: migration.migrated,
    sourceSchemaVersion: migration.sourceSchemaVersion,
    rulebook,
    issues,
    errors,
    warnings,
  }
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function draftRulebookExportFileName(rulebook: DraftRulebook): string {
  const name = slugPart(rulebook.identifier.name) || 'draft-rulebook'
  const revision = slugPart(rulebook.identifier.revision)
  return `${name}${revision ? `-rev-${revision}` : ''}.draft-rulebook.json`
}
