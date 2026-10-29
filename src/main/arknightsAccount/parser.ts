import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ArknightsAccountServer,
  type ImportedArknightsAccount,
  type ImportedArknightsAccountAvatar,
  type ImportedOperatorFormProgress,
  type ImportedOperatorProgress,
} from '../../shared/arknightsAccount'

const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const MAX_ID_LENGTH = 192
const MAX_ACCOUNT_FIELD_LENGTH = 192
const AVATAR_TYPES = new Set<ImportedArknightsAccountAvatar['type']>([
  'ASSISTANT',
  'ICON',
  'DEFAULT',
])

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
  if (trimmed.length === 0) return undefined
  if (trimmed.length > MAX_ID_LENGTH || !trimmed.startsWith('char_')) return undefined
  return trimmed
}

function readLevel(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 ? value : null
}

function readElite(value: unknown): 0 | 1 | 2 | null {
  return value === 0 || value === 1 || value === 2 ? value : null
}

function readAccountString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ACCOUNT_FIELD_LENGTH) return undefined
  return trimmed
}

function compareProgress(left: ImportedOperatorProgress, right: ImportedOperatorProgress): number {
  if (left.elite !== right.elite) return left.elite - right.elite
  return left.level - right.level
}

function parseFormProgress(
  formId: string,
  baseEntry: JsonRecord,
  formEntry: JsonRecord,
  warnings: string[],
): ImportedOperatorFormProgress | null {
  const merged = { ...baseEntry, ...formEntry }
  const level = readLevel(merged['level'])
  const elite = readElite(merged['evolvePhase'] ?? merged['phase'])
  if (level === null || elite === null) {
    warnings.push(`Skipped Amiya form ${formId}: missing or invalid progression fields.`)
    return null
  }

  const rawSkin = merged['skinId'] ?? merged['skin']
  const equippedSkinId = readSkinId(rawSkin)
  if (
    rawSkin !== undefined &&
    rawSkin !== null &&
    !(typeof rawSkin === 'string' && rawSkin.trim().length === 0) &&
    equippedSkinId === undefined
  ) {
    warnings.push(`Ignored invalid equipped skin ID for Amiya form ${formId}.`)
  }

  return {
    formId,
    level,
    elite,
    ...(equippedSkinId ? { equippedSkinId } : {}),
  }
}

function parseAmiyaForms(
  rawEntry: JsonRecord,
  operatorId: string,
  warnings: string[],
): Pick<ImportedOperatorProgress, 'activeFormId' | 'forms' | 'equippedSkinId'> {
  const tmpl = getRecord(rawEntry, 'tmpl')
  if (!tmpl || Object.keys(tmpl).length === 0) return {}

  const forms: ImportedOperatorFormProgress[] = []
  for (const [rawFormId, rawFormEntry] of Object.entries(tmpl)) {
    const formId = readOperatorId(rawFormId)
    if (!formId || !isRecord(rawFormEntry)) {
      warnings.push(`Skipped invalid Amiya form entry ${rawFormId}.`)
      continue
    }
    const form = parseFormProgress(formId, rawEntry, rawFormEntry, warnings)
    if (form) forms.push(form)
  }

  forms.sort((left, right) => left.formId.localeCompare(right.formId))
  if (forms.length === 0) return {}

  const requestedActiveFormId = readOperatorId(rawEntry['currentTmpl'] ?? rawEntry['tmplId'])
  const activeFormId =
    requestedActiveFormId && forms.some((form) => form.formId === requestedActiveFormId)
      ? requestedActiveFormId
      : forms.find((form) => form.formId === operatorId)?.formId ?? forms[0]?.formId
  const activeForm = forms.find((form) => form.formId === activeFormId)

  return {
    ...(activeFormId ? { activeFormId } : {}),
    forms,
    ...(activeForm?.equippedSkinId ? { equippedSkinId: activeForm.equippedSkinId } : {}),
  }
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

    const amiyaState = parseAmiyaForms(rawEntry, operatorId, warnings)
    const rawSkin = rawEntry['skinId'] ?? rawEntry['skin']
    const baseEquippedSkinId = readSkinId(rawSkin)
    if (
      !amiyaState.forms &&
      rawSkin !== undefined &&
      rawSkin !== null &&
      !(typeof rawSkin === 'string' && rawSkin.trim().length === 0) &&
      baseEquippedSkinId === undefined
    ) {
      warnings.push(`Ignored invalid equipped skin ID for ${operatorId}.`)
    }

    const operator: ImportedOperatorProgress = {
      operatorId,
      level,
      elite,
      ...(baseEquippedSkinId ? { equippedSkinId: baseEquippedSkinId } : {}),
      ...amiyaState,
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

function parseAvatar(status: JsonRecord): ImportedArknightsAccountAvatar | undefined {
  const avatar = getRecord(status, 'avatar')
  if (!avatar) return undefined

  const rawType = avatar['type']
  if (typeof rawType !== 'string' || !AVATAR_TYPES.has(rawType as ImportedArknightsAccountAvatar['type'])) {
    return undefined
  }

  const id = readAccountString(avatar['id'])
  return {
    type: rawType as ImportedArknightsAccountAvatar['type'],
    ...(id ? { id } : {}),
  }
}

function parseAccountIdentity(
  user: JsonRecord,
): Pick<ImportedArknightsAccount, 'accountName' | 'uid' | 'avatar'> {
  const status = getRecord(user, 'status')
  if (!status) return {}

  const nickname = readAccountString(status['nickName'])
  const nickNumberRaw = status['nickNumber']
  const nickNumber =
    typeof nickNumberRaw === 'number' && Number.isFinite(nickNumberRaw)
      ? String(nickNumberRaw)
      : readAccountString(nickNumberRaw)
  const uidRaw = status['uid']
  const uid =
    typeof uidRaw === 'number' && Number.isFinite(uidRaw) ? String(uidRaw) : readAccountString(uidRaw)
  const avatar = parseAvatar(status)

  return {
    ...(nickname ? { accountName: nickNumber ? `${nickname}#${nickNumber}` : nickname } : {}),
    ...(uid ? { uid } : {}),
    ...(avatar ? { avatar } : {}),
  }
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
      ...parseAccountIdentity(user),
      operators,
      ownedSkinIds: parseOwnedSkinIds(user, warnings),
      fetchedAt,
    },
    warnings,
  }
}
