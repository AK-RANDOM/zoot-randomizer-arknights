export const ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION = 1 as const

export type ArknightsAccountServer = 'en' | 'jp' | 'kr'

export interface ImportedOperatorProgress {
  operatorId: string
  level: number
  elite: 0 | 1 | 2
  equippedSkinId?: string
}

export interface ImportedArknightsAccount {
  schemaVersion: typeof ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION
  server: ArknightsAccountServer
  operators: ImportedOperatorProgress[]
  ownedSkinIds: string[]
  fetchedAt: string
}
