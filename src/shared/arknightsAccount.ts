export const ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION = 1 as const

export type ArknightsAccountServer = 'en' | 'jp' | 'kr'
export type ImportedArknightsAvatarType = 'ASSISTANT' | 'ICON' | 'DEFAULT'

export interface ImportedArknightsAccountAvatar {
  type: ImportedArknightsAvatarType
  id?: string
}

export interface ImportedOperatorFormProgress {
  formId: string
  level: number
  elite: 0 | 1 | 2
  equippedSkinId?: string
}

export interface ImportedOperatorProgress {
  operatorId: string
  level: number
  elite: 0 | 1 | 2
  equippedSkinId?: string
  activeFormId?: string
  forms?: ImportedOperatorFormProgress[]
}

export interface ImportedArknightsAccount {
  schemaVersion: typeof ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION
  server: ArknightsAccountServer
  accountName?: string
  uid?: string
  avatar?: ImportedArknightsAccountAvatar
  operators: ImportedOperatorProgress[]
  ownedSkinIds: string[]
  fetchedAt: string
}

export interface ArknightsAccountSyncResult {
  snapshot: ImportedArknightsAccount
  warnings: string[]
}
