import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, PortraitSyncProgress } from '../shared/desktop'

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
  getSubclassIcon: (subclassId) =>
    ipcRenderer.invoke('operator-data:subclass-icon', subclassId),
  getFactionIcon: (factionId) =>
    ipcRenderer.invoke('operator-data:faction-icon', factionId),
  checkOperatorUpdates: () => ipcRenderer.invoke('operator-data:check-updates'),
  updateOperatorData: () => ipcRenderer.invoke('operator-data:update'),
  getPortraitSyncProgress: () => ipcRenderer.invoke('operator-portraits:progress'),
  startPortraitSync: () => ipcRenderer.invoke('operator-portraits:start'),
  cancelPortraitSync: () => ipcRenderer.invoke('operator-portraits:cancel'),
  onPortraitSyncProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: PortraitSyncProgress): void =>
      listener(progress)
    ipcRenderer.on('operator-portraits:progress-changed', handler)
    return () => ipcRenderer.removeListener('operator-portraits:progress-changed', handler)
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('desktop', desktopApi)
} else {
  throw new Error('Context isolation must remain enabled')
}
