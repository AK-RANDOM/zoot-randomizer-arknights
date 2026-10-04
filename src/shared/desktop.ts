import type { OperatorClass, OperatorDataset, OperatorDatasetSources } from './operator'
import type { PromotionArt } from './portraits'

export interface OperatorDataInfo {
  origin: 'bundled' | 'downloaded'
  generatedAt: string | null
  operatorCount: number
  sources: OperatorDatasetSources
}

export interface OperatorUpdateCheck {
  online: boolean
  updateAvailable: boolean
  current: OperatorDatasetSources
  latest: OperatorDatasetSources | null
  message: string
}

export interface OperatorUpdateResult {
  updated: boolean
  dataset: OperatorDataset
  warnings: string[]
}

export interface DesktopApi {
  platform: NodeJS.Platform
  getOperatorDataset(): Promise<OperatorDataset>
  getOperatorDataInfo(): Promise<OperatorDataInfo>
  getOperatorImage(operatorId: string): Promise<string | null>
  getOperatorPortrait(operatorId: string, promotionArt: PromotionArt): Promise<string | null>
  getClassIcon(operatorClass: OperatorClass): Promise<string | null>
  checkOperatorUpdates(): Promise<OperatorUpdateCheck>
  updateOperatorData(): Promise<OperatorUpdateResult>
}
