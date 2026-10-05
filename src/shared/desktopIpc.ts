import {
  operatorClasses,
  type OperatorClass,
} from './operator'
import type { PromotionArt } from './portraits'

export const DESKTOP_IPC_CHANNELS = {
  operatorDataGet: 'operator-data:get',
  operatorDataInfo: 'operator-data:info',
  operatorImage: 'operator-data:image',
  operatorPortrait: 'operator-data:portrait',
  classIcon: 'operator-data:class-icon',
  subclassIcon: 'operator-data:subclass-icon',
  factionIcon: 'operator-data:faction-icon',
  checkUpdates: 'operator-data:check-updates',
  updateData: 'operator-data:update',
  portraitProgress: 'operator-portraits:progress',
  portraitStart: 'operator-portraits:start',
  portraitCancel: 'operator-portraits:cancel',
  portraitProgressChanged: 'operator-portraits:progress-changed',
} as const

const OPERATOR_ID_PATTERN = /^char_[a-z0-9_]+$/i
const METADATA_ID_PATTERN = /^[a-z0-9_.:-]+$/i
const MAX_METADATA_ID_LENGTH = 128

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
