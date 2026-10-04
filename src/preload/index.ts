import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/desktop'

const desktopApi: DesktopApi = {
  platform: process.platform,
  getOperatorDataset: () => ipcRenderer.invoke('operator-data:get'),
  getOperatorDataInfo: () => ipcRenderer.invoke('operator-data:info'),
  getOperatorImage: (operatorId) =>
    ipcRenderer.invoke('operator-data:image', operatorId),
  getOperatorPortrait: (operatorId, promotionArt) =>
    ipcRenderer.invoke('operator-data:portrait', operatorId, promotionArt),
  getClassIcon: (operatorClass) =>
    ipcRenderer.invoke('operator-data:class-icon', operatorClass),
  checkOperatorUpdates: () => ipcRenderer.invoke('operator-data:check-updates'),
  updateOperatorData: () => ipcRenderer.invoke('operator-data:update'),
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('desktop', desktopApi)
} else {
  throw new Error('Context isolation must remain enabled')
}
