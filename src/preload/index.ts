import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, PortraitSyncProgress } from '../shared/desktop'
import { DESKTOP_IPC_CHANNELS } from '../shared/desktopIpc'

const desktopApi: DesktopApi = {
  platform: process.platform,
  getOperatorDataset: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorDataGet),
  getOperatorDataInfo: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorDataInfo),
  getOperatorImage: (operatorId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorImage, operatorId),
  getOperatorPortrait: (operatorId, promotionArt) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorPortrait, operatorId, promotionArt),
  getClassIcon: (operatorClass) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.classIcon, operatorClass),
  getSubclassIcon: (subclassId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.subclassIcon, subclassId),
  getFactionIcon: (factionId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.factionIcon, factionId),
  checkOperatorUpdates: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.checkUpdates),
  updateOperatorData: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.updateData),
  getPortraitSyncProgress: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitProgress),
  startPortraitSync: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitStart),
  cancelPortraitSync: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitCancel),
  onPortraitSyncProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: PortraitSyncProgress): void =>
      listener(progress)
    ipcRenderer.on(DESKTOP_IPC_CHANNELS.portraitProgressChanged, handler)
    return () => ipcRenderer.removeListener(DESKTOP_IPC_CHANNELS.portraitProgressChanged, handler)
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('desktop', desktopApi)
} else {
  throw new Error('Context isolation must remain enabled')
}
