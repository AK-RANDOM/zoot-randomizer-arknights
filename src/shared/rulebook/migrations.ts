import { DRAFT_RULEBOOK_SCHEMA_VERSION } from './types'

export type DraftRulebookMigrationSeverity = 'error'

export interface DraftRulebookMigrationIssue {
  severity: DraftRulebookMigrationSeverity
  code: string
  path: string
  message: string
}

export interface DraftRulebookMigrationResult {
  document: unknown
  sourceSchemaVersion: number | null
  migrated: boolean
  issues: DraftRulebookMigrationIssue[]
}

type JsonRecord = Record<string, unknown>
export type DraftRulebookMigration = (document: JsonRecord) => JsonRecord

/** Keys are source schema versions. Each migration returns the next schema version. */
export const DRAFT_RULEBOOK_MIGRATIONS: Readonly<Record<number, DraftRulebookMigration>> = {
  1: (document) => ({ ...document, schemaVersion: 2 }),
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function issue(
  code: string,
  path: string,
  message: string,
): DraftRulebookMigrationIssue {
  return { severity: 'error', code, path, message }
}

export function migrateDraftRulebookDocument(value: unknown): DraftRulebookMigrationResult {
  if (!isRecord(value)) {
    return {
      document: value,
      sourceSchemaVersion: null,
      migrated: false,
      issues: [issue('invalid-root', 'rulebook', 'Draft Rulebook must be an object.')],
    }
  }

  const rawVersion = value.schemaVersion
  if (!Number.isInteger(rawVersion) || (rawVersion as number) < 1) {
    return {
      document: value,
      sourceSchemaVersion: typeof rawVersion === 'number' ? rawVersion : null,
      migrated: false,
      issues: [issue(
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
        'newer-schema-version',
        'rulebook.schemaVersion',
        `This Draft Rulebook uses newer schema version ${sourceSchemaVersion}; this app supports up to version ${DRAFT_RULEBOOK_SCHEMA_VERSION}.`,
      )],
    }
  }

  let document = cloneJson(value)
  let version = sourceSchemaVersion
  let migrated = false
  const issues: DraftRulebookMigrationIssue[] = []

  while (version < DRAFT_RULEBOOK_SCHEMA_VERSION) {
    const migration = DRAFT_RULEBOOK_MIGRATIONS[version]
    if (!migration) {
      issues.push(issue(
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
