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

// Current tentative 137-operator 6★ priceboard from Draft balance workboard #58.
// Stable game IDs preserve the price across language/localization changes.
export const SHARED_BALANCE_SIX_STAR_COSTS: Readonly<Record<string, number>> = {
  // 60 fund — 8 operators.
  char_1035_wisdel: -60,
  char_1042_phatm2: -60,
  char_1044_hsgma2: -60,
  char_1045_svash2: -60,
  char_1046_sbell2: -60,
  char_1050_chen3: -60,
  char_1052_kalts2: -60,
  char_2027_wang: -60,
  // 55 fund — 6 operators.
  char_1015_aglna2: -55,
  char_1041_angel2: -55,
  char_4179_monstr: -55,
  char_4202_haruka: -55,
  char_4217_makoto: -55,
  char_4228_closur: -55,
  // 50 fund — 6 operators.
  char_1043_leizi2: -50,
  char_2025_shu: -50,
  char_4087_ines: -50,
  char_4132_ascln: -50,
  char_4182_oblvns: -50,
  char_4204_mantra: -50,
  // 45 fund — 6 operators.
  char_1016_agoat2: -45,
  char_1038_whitw2: -45,
  char_1051_headb2: -45,
  char_4133_logos: -45,
  char_4138_narant: -45,
  char_4145_ulpia: -45,
  // 40 fund — 6 operators.
  char_1029_yato2: -40,
  char_2026_yu: -40,
  char_4064_mlynar: -40,
  char_4123_ela: -40,
  char_4193_lemuen: -40,
  char_450_necras: -40,
  // 30 fund — 15 operators.
  char_1020_reed2: -30,
  char_1028_texas2: -30,
  char_1040_blaze2: -30,
  char_1048_orchd2: -30,
  char_202_demkni: -30,
  char_206_gnosis: -30,
  char_222_bpipe: -30,
  char_358_lisa: -30,
  char_4010_etlchi: -30,
  char_4037_demetr: -30,
  char_4056_titi: -30,
  char_4117_ray: -30,
  char_4195_radian: -30,
  char_4230_mcnist: -30,
  char_4235_thumpy: -30,
  // 27 fund — 15 operators.
  char_003_kalts: -27,
  char_1012_skadi2: -27,
  char_1013_chen2: -27,
  char_180_amgoat: -27,
  char_245_cello: -27,
  char_4026_vulpis: -27,
  char_4088_hodrer: -27,
  char_4098_vvana: -27,
  char_4116_blkkgt: -27,
  char_4134_cetsyr: -27,
  char_4141_marcil: -27,
  char_4146_nymph: -27,
  char_4212_nasti: -27,
  char_4229_aphris: -27,
  char_479_sleach: -27,
  // 24 fund — 15 operators.
  char_1014_nearl2: -24,
  char_1019_siege2: -24,
  char_1039_thorn2: -24,
  char_172_svrash: -24,
  char_179_cgbird: -24,
  char_2014_nian: -24,
  char_2015_dusk: -24,
  char_2023_ling: -24,
  char_2024_chyue: -24,
  char_249_mlyss: -24,
  char_350_surtr: -24,
  char_377_gdglow: -24,
  char_4048_doroth: -24,
  char_4058_pepe: -24,
  char_4121_zuole: -24,
  // 21 fund — 15 operators.
  char_1023_ghost2: -21,
  char_1026_gvial2: -21,
  char_1032_excu2: -21,
  char_1034_jesca2: -21,
  char_103_angel: -21,
  char_1502_crosly: -21,
  char_2012_typhon: -21,
  char_264_f12yin: -21,
  char_311_mudrok: -21,
  char_332_archet: -21,
  char_400_weedy: -21,
  char_4055_bgsnow: -21,
  char_4065_judge: -21,
  char_4194_rmixer: -21,
  char_474_glady: -21,
  // 18 fund — 15 operators.
  char_017_huang: -18,
  char_134_ifrit: -18,
  char_136_hsguma: -18,
  char_2013_cerber: -18,
  char_293_thorns: -18,
  char_300_phenxi: -18,
  char_4009_irene: -18,
  char_4027_heyak: -18,
  char_4042_lumen: -18,
  char_4046_ebnhlz: -18,
  char_4072_ironmn: -18,
  char_4080_lin: -18,
  char_4082_qiubai: -18,
  char_437_mizuki: -18,
  char_472_pasngr: -18,
  // 16 fund — 15 operators.
  char_010_chen: -16,
  char_1047_halo2: -16,
  char_113_cqbw: -16,
  char_147_shining: -16,
  char_197_poca: -16,
  char_213_mostma: -16,
  char_248_mgllan: -16,
  char_250_phatom: -16,
  char_263_skadi: -16,
  char_340_shwaz: -16,
  char_391_rosmon: -16,
  char_4039_horn: -16,
  char_420_flamtl: -16,
  char_4226_veen: -16,
  char_423_blemsh: -16,
  // 14 fund — 15 operators.
  char_1031_slent2: -14,
  char_1033_swire2: -14,
  char_112_siege: -14,
  char_188_helage: -14,
  char_225_haak: -14,
  char_291_aglina: -14,
  char_322_lmlee: -14,
  char_362_saga: -14,
  char_4011_lessng: -14,
  char_416_zumama: -14,
  char_426_billro: -14,
  char_427_vigil: -14,
  char_430_fartth: -14,
  char_456_ash: -14,
  char_485_pallas: -14,
}

export const SHARED_BALANCE_PRICING_PROFILE: DraftPricingProfile = {
  schemaVersion: DRAFT_PRICING_PROFILE_SCHEMA_VERSION,
  id: SHARED_BALANCE_PRICING_PROFILE_ID,
  name: 'Shared Balance Pricing',
  description:
    'Shared #58 base-pricing profile: 137 authored 6★ costs from 14–60 fund, with 5★ fallback cost 7.',
  createdAt: '2026-10-10T00:00:00.000Z',
  revision: '2026.10-workboard-58',
  operatorCosts: { ...SHARED_BALANCE_SIX_STAR_COSTS },
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
