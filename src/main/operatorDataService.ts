import { app } from 'electron'
import { join } from 'node:path'
import type { OperatorDataInfo, OperatorUpdateCheck, OperatorUpdateResult } from '../shared/desktop'
import type { OperatorDataset } from '../shared/operator'
import { operatorAvatarAsset } from '../shared/artwork'
import { operatorArtworkCache } from './operatorArtwork'
import { createDataPackageRepository } from './dataPackageRepository'
export function clearOperatorImageMemoryCaches(): void {
  operatorArtworkCache().clearMemory()
}
let dataClient: ReturnType<typeof createDataPackageRepository> | undefined

export function getOperatorDataClient() {
  return (dataClient ??= createDataPackageRepository({
    bundledRoot: app.isPackaged
      ? join(process.resourcesPath, 'bundled-data')
      : join(app.getAppPath(), 'resources', 'bundled-data'),
    userDataRoot: app.getPath('userData'),
  }))
}

export async function getOperatorDataset(): Promise<OperatorDataset> {
  return getOperatorDataClient().getDataset()
}

export async function getOperatorDataInfo(): Promise<OperatorDataInfo> {
  return getOperatorDataClient().getInfo()
}

export async function getOperatorImage(operatorId: string): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  if (!(await getOperatorDataset()).operators.some((operator) => operator.id === operatorId))
    return null
  return operatorArtworkCache().image(operatorAvatarAsset(operatorId))
}
export async function checkOperatorUpdates(): Promise<OperatorUpdateCheck> {
  return getOperatorDataClient().checkUpdates()
}

export async function updateOperatorData(): Promise<OperatorUpdateResult> {
  const result = await getOperatorDataClient().installUpdate()
  if (result.updated) operatorArtworkCache().clearMemory()
  return result
}
