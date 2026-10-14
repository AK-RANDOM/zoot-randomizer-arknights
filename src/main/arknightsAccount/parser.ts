import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ArknightsAccountServer,
  type ImportedArknightsAccount,
  type ImportedOperatorProgress,
} from '../../shared/arknightsAccount'

const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const MAX_ID_LENGTH = 192

export interface AccountSyncParseResult {
  snapshot: ImportedArknightsAccount
  warnings: string[]
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRecord(value: unknown, key: string): JsonRecord | null {
  if (!isRecord(value)) return null
  const child = value[key]
  return isRecord(child) ? child : null
}

function readOperatorId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ID_LENGTH) return null
  return OPERATOR_ID_PATTERN.test(value) ? value : null
}

function readSkinId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LENGTH || !trimmed.startsWith('char_')) {
    return undefined
  }
  return trimmed
}

function readLevel(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 ? value : null
}

function readElite(value: unknown): 0 | 1 | 2 | null {
  return value === 0 || value === 1 || value === 2 ? value : null
}

function compareProgress(left: ImportedOperatorProgress, right: ImportedOperatorProgress): number {
  if (left.elite !== right.elite) return left.elite - right.elite
  return left.level - right.level
}

function parseOperators(chars: JsonRecord, warnings: string[]): ImportedOperatorProgress[] {
  const byOperatorId = new Map<string, ImportedOperatorProgress>()

  for (const [instanceId, rawEntry] of Object.entries(chars)) {
    if (!isRecord(rawEntry)) {
      warnings.push(`Skipped operator instance ${instanceId}: entry is not an object.`)
      continue
    }

    const operatorId = readOperatorId(rawEntry['charId'] ?? rawEntry['char_id'])
    const level = readLevel(rawEntry['level'])
    const elite = readElite(rawEntry['evolvePhase'] ?? rawEntry['phase'])

    if (!operatorId || level === null || elite === null) {
      warnings.push(
        `Skipped operator instance ${instanceId}: missing or invalid core progression fields.`,
      )
      continue
    }

    const rawSkin = rawEntry['skinId'] ?? rawEntry['skin']
    const equippedSkinId = readSkinId(rawSkin)
    if (rawSkin !== undefined && equippedSkinId === undefined) {
      warnings.push(`Ignored invalid equipped skin ID for ${operatorId}.`)
    }

    const operator: ImportedOperatorProgress = {
      operatorId,
      level,
      elite,
      ...(equippedSkinId ? { equippedSkinId } : {}),
    }

    const existing = byOperatorId.get(operatorId)
    if (!existing) {
      byOperatorId.set(operatorId, operator)
      continue
    }

    warnings.push(`Duplicate operator ${operatorId} was present in account sync data.`)
    if (compareProgress(existing, operator) < 0) {
      byOperatorId.set(operatorId, operator)
    }
  }

  return [...byOperatorId.values()].sort((left, right) =>
    left.operatorId.localeCompare(right.operatorId),
  )
}

function parseOwnedSkinIds(user: JsonRecord, warnings: string[]): string[] {
  const skin = getRecord(user, 'skin')
  if (!skin) return []

  const characterSkins = skin['characterSkins']
  if (characterSkins === undefined || characterSkins === null) return []
  if (!isRecord(characterSkins)) {
    warnings.push('Ignored owned skin data because skin.characterSkins is not an object.')
    return []
  }

  const ownedSkinIds: string[] = []
  for (const rawSkinId of Object.keys(characterSkins)) {
    const skinId = readSkinId(rawSkinId)
    if (skinId) ownedSkinIds.push(skinId)
    else warnings.push(`Ignored invalid owned skin ID: ${rawSkinId}.`)
  }

  return [...new Set(ownedSkinIds)].sort((left, right) => left.localeCompare(right))
}

function resolveUser(payload: unknown): JsonRecord {
  if (!isRecord(payload)) throw new TypeError('Arknights sync payload must be an object.')
  const user = getRecord(payload, 'user')
  return user ?? payload
}

export function parseArknightsSyncData(
  payload: unknown,
  server: ArknightsAccountServer,
  fetchedAt = new Date().toISOString(),
): AccountSyncParseResult {
  const user = resolveUser(payload)
  const troop = getRecord(user, 'troop')
  const chars = troop ? getRecord(troop, 'chars') : null
  if (!chars) {
    throw new TypeError('Arknights sync payload does not contain user.troop.chars.')
  }

  const warnings: string[] = []
  const operators = parseOperators(chars, warnings)
  if (operators.length === 0 && Object.keys(chars).length > 0) {
    throw new TypeError('Arknights sync payload did not contain any valid operator records.')
  }

  return {
    snapshot: {
      schemaVersion: ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
      server,
      operators,
      ownedSkinIds: parseOwnedSkinIds(user, warnings),
      fetchedAt,
    },
    warnings,
  }
}
