import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ArknightsAccountServer,
  type ImportedArknightsAccount,
  type ImportedOperatorFormProgress,
  type ImportedOperatorProgress,
} from '../../shared/arknightsAccount'

const SERVERS = new Set<ArknightsAccountServer>(['en', 'jp', 'kr'])
const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const MAX_ID_LENGTH = 192
const MAX_ACCOUNT_FIELD_LENGTH = 192

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isServer(value: unknown): value is ArknightsAccountServer {
  return typeof value === 'string' && SERVERS.has(value as ArknightsAccountServer)
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ACCOUNT_FIELD_LENGTH) return undefined
  return trimmed
}

function normalizeSkinId(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID_LENGTH ||
    !value.startsWith('char_')
  ) {
    return undefined
  }
  return value
}

function normalizeForm(value: unknown): ImportedOperatorFormProgress | null {
  if (!isRecord(value)) return null
  const formId = value['formId']
  const level = value['level']
  const elite = value['elite']
  const equippedSkinId = value['equippedSkinId']

  if (
    typeof formId !== 'string' ||
    formId.length > MAX_ID_LENGTH ||
    !OPERATOR_ID_PATTERN.test(formId) ||
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    level < 1 ||
    (elite !== 0 && elite !== 1 && elite !== 2)
  ) {
    return null
  }

  const normalizedSkin = normalizeSkinId(equippedSkinId)
  if (equippedSkinId !== undefined && !normalizedSkin) return null

  return {
    formId,
    level,
    elite,
    ...(normalizedSkin ? { equippedSkinId: normalizedSkin } : {}),
  }
}

function normalizeOperator(value: unknown): ImportedOperatorProgress | null {
  if (!isRecord(value)) return null
  const operatorId = value['operatorId']
  const level = value['level']
  const elite = value['elite']
  const equippedSkinId = value['equippedSkinId']

  if (
    typeof operatorId !== 'string' ||
    operatorId.length > MAX_ID_LENGTH ||
    !OPERATOR_ID_PATTERN.test(operatorId) ||
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    level < 1 ||
    (elite !== 0 && elite !== 1 && elite !== 2)
  ) {
    return null
  }

  const normalizedSkin = normalizeSkinId(equippedSkinId)
  if (equippedSkinId !== undefined && !normalizedSkin) return null

  let forms: ImportedOperatorFormProgress[] | undefined
  if (value['forms'] !== undefined) {
    if (!Array.isArray(value['forms'])) return null
    forms = []
    for (const rawForm of value['forms']) {
      const form = normalizeForm(rawForm)
      if (!form) return null
      forms.push(form)
    }
    forms = [...new Map(forms.map((form) => [form.formId, form])).values()].sort((left, right) =>
      left.formId.localeCompare(right.formId),
    )
  }

  const activeFormId = value['activeFormId']
  if (
    activeFormId !== undefined &&
    (typeof activeFormId !== 'string' ||
      !OPERATOR_ID_PATTERN.test(activeFormId) ||
      !forms?.some((form) => form.formId === activeFormId))
  ) {
    return null
  }

  return {
    operatorId,
    level,
    elite,
    ...(normalizedSkin ? { equippedSkinId: normalizedSkin } : {}),
    ...(typeof activeFormId === 'string' ? { activeFormId } : {}),
    ...(forms ? { forms } : {}),
  }
}

function normalizeSkinIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids: string[] = []
  for (const skinId of value) {
    if (
      typeof skinId !== 'string' ||
      skinId.length === 0 ||
      skinId.length > MAX_ID_LENGTH ||
      !skinId.startsWith('char_')
    ) {
      return null
    }
    ids.push(skinId)
  }
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right))
}

export function normalizeImportedAccount(value: unknown): ImportedArknightsAccount | null {
  if (!isRecord(value)) return null
  if (value['schemaVersion'] !== ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION) return null
  if (!isServer(value['server'])) return null
  if (typeof value['fetchedAt'] !== 'string' || Number.isNaN(Date.parse(value['fetchedAt'])))
    return null
  if (!Array.isArray(value['operators'])) return null

  const operators: ImportedOperatorProgress[] = []
  for (const rawOperator of value['operators']) {
    const operator = normalizeOperator(rawOperator)
    if (!operator) return null
    operators.push(operator)
  }

  const ownedSkinIds = normalizeSkinIds(value['ownedSkinIds'])
  if (!ownedSkinIds) return null

  const accountName = normalizeOptionalString(value['accountName'])
  if (value['accountName'] !== undefined && !accountName) return null
  const uid = normalizeOptionalString(value['uid'])
  if (value['uid'] !== undefined && !uid) return null

  return {
    schemaVersion: ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
    server: value['server'],
    ...(accountName ? { accountName } : {}),
    ...(uid ? { uid } : {}),
    operators: operators.sort((left, right) => left.operatorId.localeCompare(right.operatorId)),
    ownedSkinIds,
    fetchedAt: value['fetchedAt'],
  }
}

export class AccountSnapshotStore {
  constructor(private readonly snapshotPath: string) {}

  async load(): Promise<ImportedArknightsAccount | null> {
    try {
      const raw = JSON.parse(await readFile(this.snapshotPath, 'utf8')) as unknown
      return normalizeImportedAccount(raw)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      return null
    }
  }

  async save(snapshot: ImportedArknightsAccount): Promise<void> {
    const normalized = normalizeImportedAccount(snapshot)
    if (!normalized)
      throw new TypeError('Refusing to persist an invalid Arknights account snapshot.')

    await mkdir(dirname(this.snapshotPath), { recursive: true })
    const temporaryPath = `${this.snapshotPath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.snapshotPath)
  }

  async clear(): Promise<void> {
    await rm(this.snapshotPath, { force: true })
    await rm(`${this.snapshotPath}.tmp`, { force: true })
  }
}
