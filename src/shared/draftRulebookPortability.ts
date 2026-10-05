import type { OperatorDataset } from './operator'
import {
  validateDraftRulebook,
  type DraftRulebook,
  type DraftRulebookSelector,
} from './draftRulebook'
import {
  migrateDraftRulebookDocument,
} from './rulebook/migrations'
import {
  createDraftRulebookDatasetReferences,
  inspectDraftRulebookSelectorReferences,
  type DraftRulebookDatasetReferences,
} from './rulebook/selectors'

export { migrateDraftRulebookDocument } from './rulebook/migrations'

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
  references: DraftRulebookDatasetReferences,
  issues: DraftRulebookCompatibilityIssue[],
): void {
  for (const reference of inspectDraftRulebookSelectorReferences(selector, references)) {
    if (!reference.resolved) {
      issues.push(unresolvedReferenceIssue(
        `${path}.${reference.pathSuffix}`,
        reference.kind,
        reference.id,
      ))
    }
  }
}

function inspectFeaturedOperators(
  operatorIds: readonly string[],
  path: string,
  references: DraftRulebookDatasetReferences,
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
  const references = createDraftRulebookDatasetReferences(dataset)

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
  const issues: DraftRulebookCompatibilityIssue[] = [...migration.issues]
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
