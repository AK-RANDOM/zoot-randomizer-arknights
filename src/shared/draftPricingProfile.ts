import type { Operator, OperatorDataset } from './operator'

export const DRAFT_PRICING_PROFILE_SCHEMA_VERSION = 1 as const
export const SHARED_BALANCE_PRICING_PROFILE_ID = 'builtin:shared-balance' as const

export interface DraftPricingProfile {
  schemaVersion: typeof DRAFT_PRICING_PROFILE_SCHEMA_VERSION
  id: string
  name: string
  description: string
  createdAt: string
  revision: string
  operatorCosts: Record<string, number>
}

export const SHARED_BALANCE_PRICING_PROFILE: DraftPricingProfile = {
  schemaVersion: DRAFT_PRICING_PROFILE_SCHEMA_VERSION,
  id: SHARED_BALANCE_PRICING_PROFILE_ID,
  name: 'Shared Balance Pricing',
  description:
    'Shared #58 base-pricing profile. 5★ currently use the Rulebook fallback cost of 7; operator-specific 6★ prices are refined through this profile.',
  createdAt: '2026-10-10T00:00:00.000Z',
  revision: '2026.10-m3',
  operatorCosts: {},
}

export const BUILT_IN_DRAFT_PRICING_PROFILES: readonly DraftPricingProfile[] = [
  SHARED_BALANCE_PRICING_PROFILE,
]

export interface DraftPricingCsvIssue {
  row: number
  code:
    | 'missing-column'
    | 'invalid-row'
    | 'unknown-operator'
    | 'duplicate-operator'
    | 'invalid-cost'
  message: string
}

export interface DraftPricingCsvRow {
  row: number
  operatorId: string
  baseCost: number
}

export interface DraftPricingCsvAnalysis {
  rows: DraftPricingCsvRow[]
  issues: DraftPricingCsvIssue[]
  valid: boolean
  updatedCount: number
  unknownCount: number
  duplicateCount: number
  invalidCount: number
}

function parseCsvRecords(serialized: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < serialized.length; index += 1) {
    const char = serialized[index]
    if (quoted) {
      if (char === '"' && serialized[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && serialized[index + 1] === '\n') index += 1
      record.push(field)
      field = ''
      if (record.some((value) => value.length > 0)) records.push(record)
      record = []
    } else field += char
  }

  record.push(field)
  if (record.some((value) => value.length > 0)) records.push(record)
  return records
}

export function analyzeDraftPricingCsv(
  serialized: string,
  operators: readonly Operator[] | OperatorDataset,
): DraftPricingCsvAnalysis {
  const operatorList = 'operators' in operators ? operators.operators : operators
  const knownIds = new Set(operatorList.map((operator) => operator.id))
  const records = parseCsvRecords(serialized)
  const issues: DraftPricingCsvIssue[] = []
  const rows: DraftPricingCsvRow[] = []

  if (records.length === 0) {
    issues.push({
      row: 1,
      code: 'missing-column',
      message: 'CSV is empty. Expected operator_id and base_cost columns.',
    })
    return {
      rows,
      issues,
      valid: false,
      updatedCount: 0,
      unknownCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
    }
  }

  const header = records[0].map((value) => value.trim().toLocaleLowerCase())
  const operatorIdIndex = header.indexOf('operator_id')
  const baseCostIndex = header.indexOf('base_cost')
  if (operatorIdIndex < 0 || baseCostIndex < 0) {
    issues.push({
      row: 1,
      code: 'missing-column',
      message: 'CSV header must include operator_id and base_cost columns.',
    })
    return {
      rows,
      issues,
      valid: false,
      updatedCount: 0,
      unknownCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
    }
  }

  const seen = new Set<string>()
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index]
    const rowNumber = index + 1
    const operatorId = (record[operatorIdIndex] ?? '').trim()
    const costText = (record[baseCostIndex] ?? '').trim()
    if (!operatorId || !costText) {
      issues.push({
        row: rowNumber,
        code: 'invalid-row',
        message: `Row ${rowNumber} must include both operator_id and base_cost.`,
      })
      continue
    }
    if (seen.has(operatorId)) {
      issues.push({
        row: rowNumber,
        code: 'duplicate-operator',
        message: `Row ${rowNumber}: duplicate operator_id “${operatorId}”.`,
      })
      continue
    }
    seen.add(operatorId)
    if (!knownIds.has(operatorId)) {
      issues.push({
        row: rowNumber,
        code: 'unknown-operator',
        message: `Row ${rowNumber}: unknown operator_id “${operatorId}”.`,
      })
      continue
    }
    const baseCost = Number(costText)
    if (!Number.isFinite(baseCost) || !Number.isInteger(baseCost)) {
      issues.push({
        row: rowNumber,
        code: 'invalid-cost',
        message: `Row ${rowNumber}: base_cost must be a finite integer.`,
      })
      continue
    }
    rows.push({ row: rowNumber, operatorId, baseCost })
  }

  return {
    rows,
    issues,
    valid: issues.length === 0,
    updatedCount: rows.length,
    unknownCount: issues.filter((entry) => entry.code === 'unknown-operator').length,
    duplicateCount: issues.filter((entry) => entry.code === 'duplicate-operator').length,
    invalidCount: issues.filter(
      (entry) => entry.code !== 'unknown-operator' && entry.code !== 'duplicate-operator',
    ).length,
  }
}

export function applyDraftPricingCsv(
  current: Readonly<Record<string, number>>,
  analysis: DraftPricingCsvAnalysis,
  mode: 'merge' | 'replace',
): Record<string, number> {
  if (!analysis.valid) throw new Error('Cannot apply an invalid pricing CSV import.')
  const next: Record<string, number> = mode === 'merge' ? { ...current } : {}
  for (const row of analysis.rows) next[row.operatorId] = row.baseCost
  return next
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function serializeDraftPricingCsv(profile: DraftPricingProfile): string {
  const lines = ['operator_id,base_cost']
  for (const [operatorId, baseCost] of Object.entries(profile.operatorCosts).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    lines.push(`${csvCell(operatorId)},${baseCost}`)
  }
  return `${lines.join('\n')}\n`
}

export function draftPricingProfileExportFileName(profile: DraftPricingProfile): string {
  const slug =
    profile.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'draft-pricing'
  return `${slug}.draft-pricing.csv`
}

export function validateDraftPricingProfile(profile: DraftPricingProfile): string[] {
  const errors: string[] = []
  if (profile.schemaVersion !== DRAFT_PRICING_PROFILE_SCHEMA_VERSION)
    errors.push('Unsupported pricing profile schema version.')
  if (!profile.id.trim()) errors.push('Pricing profile ID is required.')
  if (!profile.name.trim()) errors.push('Pricing profile name is required.')
  for (const [operatorId, cost] of Object.entries(profile.operatorCosts)) {
    if (!operatorId.trim()) errors.push('Pricing profile contains an empty operator ID.')
    if (!Number.isFinite(cost) || !Number.isInteger(cost))
      errors.push(`Pricing for ${operatorId} must be a finite integer.`)
  }
  return errors
}
