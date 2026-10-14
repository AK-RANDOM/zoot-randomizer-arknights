import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ArknightsAccountServer,
  type ImportedArknightsAccount,
  type ImportedOperatorProgress,
} from '../../shared/arknightsAccount'

const SERVERS = new Set<ArknightsAccountServer>(['en', 'jp', 'kr'])
const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const MAX_ID_LENGTH = 192

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isServer(value: unknown): value is ArknightsAccountServer {
  return typeof value === 'string' && SERVERS.has(value as ArknightsAccountServer)
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

  if (
    equippedSkinId !== undefined &&
    (typeof equippedSkinId !== 'string' ||
      equippedSkinId.length === 0 ||
      equippedSkinId.length > MAX_ID_LENGTH ||
      !equippedSkinId.startsWith('char_'))
  ) {
    return null
  }

  return {
    operatorId,
    level,
    elite,
    ...(typeof equippedSkinId === 'string' ? { equippedSkinId } : {}),
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

  return {
    schemaVersion: ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
    server: value['server'],
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
