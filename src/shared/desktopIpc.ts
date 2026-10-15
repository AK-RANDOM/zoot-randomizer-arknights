import { operatorClasses, type OperatorClass } from './operator'
import type { PromotionArt } from './portraits'
import type { ArknightsAccountServer } from './arknightsAccount'

export const DESKTOP_IPC_CHANNELS = {
  operatorDataGet: 'operator-data:get',
  operatorDataInfo: 'operator-data:info',
  operatorImage: 'operator-data:image',
  operatorPortrait: 'operator-data:portrait',
  operatorSkinPortrait: 'operator-data:skin-portrait',
  operatorSkinAvatar: 'operator-data:skin-avatar',
  classIcon: 'operator-data:class-icon',
  subclassIcon: 'operator-data:subclass-icon',
  factionIcon: 'operator-data:faction-icon',
  checkUpdates: 'operator-data:check-updates',
  updateData: 'operator-data:update',
  portraitProgress: 'operator-portraits:progress',
  portraitStart: 'operator-portraits:start',
  portraitCancel: 'operator-portraits:cancel',
  portraitProgressChanged: 'operator-portraits:progress-changed',
  arknightsAccountRequestCode: 'arknights-account:request-code',
  arknightsAccountSync: 'arknights-account:sync',
  arknightsAccountGet: 'arknights-account:get',
  arknightsAccountClear: 'arknights-account:clear',
  arknightsAccountAvatar: 'arknights-account:avatar',
} as const

const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const METADATA_ID_PATTERN = /^[a-z0-9_.:-]+$/i
const MAX_METADATA_ID_LENGTH = 128
const SKIN_ID_PATTERN = /^char_[a-z0-9_]+@[a-z0-9_+#-]+$/i
const ACCOUNT_AVATAR_ID_PATTERN = /^avatar_[a-z0-9_]+$/i

export function requireOperatorId(value: unknown): string {
  if (typeof value !== 'string' || !OPERATOR_ID_PATTERN.test(value)) {
    throw new TypeError('Invalid operator ID.')
  }
  return value
}

export function requirePromotionArt(value: unknown): PromotionArt {
  if (value !== 'e1' && value !== 'e2') {
    throw new TypeError('Invalid promotion artwork selection.')
  }
  return value
}

export function requireSkinId(value: unknown): string {
  if (typeof value !== 'string' || value.length > 160 || !SKIN_ID_PATTERN.test(value)) {
    throw new TypeError('Invalid skin ID.')
  }
  return value
}

export function requireOperatorClass(value: unknown): OperatorClass {
  if (typeof value !== 'string' || !operatorClasses.includes(value as OperatorClass)) {
    throw new TypeError('Invalid operator class.')
  }
  return value as OperatorClass
}

export function requireMetadataId(value: unknown, label = 'metadata'): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_METADATA_ID_LENGTH ||
    !METADATA_ID_PATTERN.test(value)
  ) {
    throw new TypeError(`Invalid ${label} ID.`)
  }
  return value
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function requireArknightsAccountAvatarId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 192 ||
    !ACCOUNT_AVATAR_ID_PATTERN.test(value)
  ) {
    throw new TypeError('Invalid Arknights account avatar ID.')
  }
  return value
}

const ARKNIGHTS_ACCOUNT_SERVERS = new Set<ArknightsAccountServer>(['en', 'jp', 'kr'])

export function requireArknightsAccountServer(value: unknown): ArknightsAccountServer {
  if (
    typeof value !== 'string' ||
    !ARKNIGHTS_ACCOUNT_SERVERS.has(value as ArknightsAccountServer)
  ) {
    throw new TypeError('Invalid Arknights account server.')
  }
  return value as ArknightsAccountServer
}

export function requireArknightsAccountString(
  value: unknown,
  label: 'email' | 'verification code',
): string {
  if (typeof value !== 'string') throw new TypeError(`Invalid Arknights account ${label}.`)
  return value
}
