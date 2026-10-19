import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, PortraitSyncProgress } from '../shared/desktop'
import { DESKTOP_IPC_CHANNELS } from '../shared/desktopIpc'

const desktopApi: DesktopApi = {
  platform: process.platform,
  getOperatorDataset: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorDataGet),
  getGarrisonEvents: (region, locale) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.garrisonEventsGet, region, locale),
  setGarrisonCloseDirty: (dirty) => ipcRenderer.send(DESKTOP_IPC_CHANNELS.garrisonCloseDirty, dirty),
  onGarrisonCloseSaveRequested: (listener) => {
    const handler = (): void => listener()
    ipcRenderer.on(DESKTOP_IPC_CHANNELS.garrisonCloseSaveRequest, handler)
    return () => ipcRenderer.removeListener(DESKTOP_IPC_CHANNELS.garrisonCloseSaveRequest, handler)
  },
  completeGarrisonCloseSave: (success) =>
    ipcRenderer.send(DESKTOP_IPC_CHANNELS.garrisonCloseSaveResult, success),
  getOperatorDataInfo: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorDataInfo),
  getOperatorImage: (operatorId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorImage, operatorId),
  getOperatorPortrait: (operatorId, promotionArt) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorPortrait, operatorId, promotionArt),
  getOperatorPromotionAvatar: (operatorId, promotionArt) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorPromotionAvatar, operatorId, promotionArt),
  getOperatorAvatarAsset: (avatarId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorAvatarAsset, avatarId),
  getOperatorSkinPortrait: (operatorId, skinId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorSkinPortrait, operatorId, skinId),
  getOperatorSkinAvatar: (operatorId, skinId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.operatorSkinAvatar, operatorId, skinId),
  getArknightsProfileAvatar: (avatarId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.arknightsAccountAvatar, avatarId),
  getClassIcon: (operatorClass) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.classIcon, operatorClass),
  getSubclassIcon: (subclassId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.subclassIcon, subclassId),
  getFactionIcon: (factionId) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.factionIcon, factionId),
  checkOperatorUpdates: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.checkUpdates),
  updateOperatorData: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.updateData),
  getArtworkStorageInfo: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.artworkStorageInfo),
  openArtworkStorageFolder: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.artworkOpenFolder),
  clearDownloadedArtwork: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.artworkClear),
  startCompleteArtworkDownload: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.artworkDownloadAll),
  getPortraitSyncProgress: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitProgress),
  startPortraitSync: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitStart),
  cancelPortraitSync: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.portraitCancel),
  requestArknightsLoginCode: (server, email) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.arknightsAccountRequestCode, server, email),
  syncArknightsAccount: (server, email, code) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.arknightsAccountSync, server, email, code),
  getImportedArknightsAccount: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.arknightsAccountGet),
  clearImportedArknightsAccount: () =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.arknightsAccountClear),
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
