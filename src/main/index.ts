import { enumerateArtwork } from '../shared/artwork'
import { operatorArtworkCache } from './operatorArtwork'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PortraitSyncProgress } from '../shared/desktop'
import {
  DESKTOP_IPC_CHANNELS,
  isAllowedExternalUrl,
  requireArknightsAccountAvatarId,
  requireArknightsAccountServer,
  requireMetadataRegion,
  requireGameLocale,
  requireArknightsAccountString,
  requireAvatarAssetId,
  requireMetadataId,
  requireOperatorClass,
  requireOperatorId,
  requirePromotionArt,
  requireSkinId,
} from '../shared/desktopIpc'
import {
  checkOperatorUpdates,
  getOperatorDataInfo,
  getOperatorDataset,
  getOperatorImage,
  updateOperatorData,
} from './operatorDataService'
import {
  getOperatorPortrait,
  getOperatorSkinAvatar,
  getOperatorSkinPortrait,
} from './operatorPortraitService'
import { getOperatorAvatarAsset, getOperatorPromotionAvatar } from './operatorAvatarService'
import { getBundledClassIcon, getFactionIcon, getSubclassIcon } from './operatorUiAssetService'
import { ArknightsAccountService } from './arknightsAccount/service'
import { AccountSnapshotStore } from './arknightsAccount/snapshotStore'
import { getArknightsProfileAvatar } from './arknightsAccount/avatarService'
import { getGarrisonEventCatalog } from './garrisonEventCatalogService'
import {
  artworkRoot,
  clearDownloadedArtwork,
  getArtworkStorageInfo,
  openArtworkStorageFolder,
} from './artworkStorage'
import { ensureWritableDirectory, resolvePortableDataPath } from './portableStorage'

let portraitSyncProgress: PortraitSyncProgress = {
  status: 'idle',
  completed: 0,
  total: 0,
  message: 'Operator artwork has not been checked yet.',
}
let portraitSyncController: AbortController | null = null
let portraitSyncPromise: Promise<PortraitSyncProgress> | null = null

let activeImageRequests = 0
let clearingArtwork = false

async function guardedImageRequest<T>(request: () => Promise<T>): Promise<T> {
  if (clearingArtwork) throw new Error('Artwork cache is being cleared.')
  activeImageRequests++
  try {
    return await request()
  } finally {
    activeImageRequests--
  }
}

function configurePortableUserData(): void {
  const portableData = resolvePortableDataPath({
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    portableExecutableDir: process.env['PORTABLE_EXECUTABLE_DIR'],
  })
  if (!portableData) return

  try {
    ensureWritableDirectory(portableData)
    app.setPath('userData', portableData)
  } catch (error) {
    // Retain the normal userData directory rather than preventing launch.
    // Do not delete or move existing user data automatically.
    console.warn(
      `Portable data directory unavailable (${portableData}). Falling back to user profile storage.`,
      error,
    )
  }
}

configurePortableUserData()

let arknightsAccountService: ArknightsAccountService | null = null

function getArknightsAccountService(): ArknightsAccountService {
  if (!arknightsAccountService) {
    arknightsAccountService = new ArknightsAccountService(
      new AccountSnapshotStore(join(app.getPath('userData'), 'arknights-account-snapshot.json')),
    )
  }
  return arknightsAccountService
}

function publishPortraitProgress(progress: PortraitSyncProgress): PortraitSyncProgress {
  portraitSyncProgress = progress
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(DESKTOP_IPC_CHANNELS.portraitProgressChanged, progress)
  }
  return progress
}

async function startPortraitSync(): Promise<PortraitSyncProgress> {
  if (clearingArtwork) throw new Error('Artwork cache is being cleared.')
  if (portraitSyncPromise) return portraitSyncPromise

  const controller = new AbortController()
  portraitSyncController = controller
  portraitSyncPromise = (async () => {
    try {
      await mkdir(artworkRoot(), { recursive: true })
      const dataset = await getOperatorDataset()
      const assets = enumerateArtwork(dataset)
      const result = await operatorArtworkCache().download(assets, {
        signal: controller.signal,
        onProgress: (counts) =>
          publishPortraitProgress({
            ...counts,
            status: 'downloading',
            message: 'Downloading artwork… ' + counts.completed + '/' + counts.total,
          }),
      })
      const { warnings, ...counts } = result
      return publishPortraitProgress({
        status: 'complete',
        ...counts,
        message:
          warnings.length > 0
            ? `Artwork download finished. ${counts.unavailable} unavailable; ${counts.failed} could not be saved. Retry to resume.`
            : 'Operator artwork is ready for offline use.',
      })
    } catch {
      if (controller.signal.aborted) {
        return publishPortraitProgress({
          ...portraitSyncProgress,
          status: 'cancelled',
          message:
            'Artwork download paused. Completed files have been kept; choose Resume to continue.',
        })
      }
      return publishPortraitProgress({
        ...portraitSyncProgress,
        status: 'failed',
        message: 'Artwork download could not continue. The app remains usable offline.',
      })
    } finally {
      portraitSyncController = null
      portraitSyncPromise = null
    }
  })()

  return portraitSyncPromise
}

function cancelPortraitSync(): PortraitSyncProgress {
  portraitSyncController?.abort()
  if (portraitSyncProgress.status !== 'downloading') return portraitSyncProgress
  return publishPortraitProgress({
    ...portraitSyncProgress,
    status: 'cancelled',
    message: 'Artwork download paused. Completed files have been kept.',
  })
}

function registerIpc(): void {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.operatorDataGet, () => getOperatorDataset())
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.garrisonEventsGet,
    (_event, region: unknown, locale: unknown) =>
      getGarrisonEventCatalog(requireMetadataRegion(region), requireGameLocale(locale)),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.operatorDataInfo, () => getOperatorDataInfo())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.operatorImage, (_event, operatorId: unknown) =>
    guardedImageRequest(() => getOperatorImage(requireOperatorId(operatorId))),
  )
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.operatorPortrait,
    (_event, operatorId: unknown, promotionArt: unknown) =>
      guardedImageRequest(() =>
        getOperatorPortrait(requireOperatorId(operatorId), requirePromotionArt(promotionArt)),
      ),
  )
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.operatorPromotionAvatar,
    (_event, operatorId: unknown, promotionArt: unknown) =>
      guardedImageRequest(() =>
        getOperatorPromotionAvatar(
          requireOperatorId(operatorId),
          requirePromotionArt(promotionArt),
        ),
      ),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.operatorAvatarAsset, (_event, avatarId: unknown) =>
    guardedImageRequest(() => getOperatorAvatarAsset(requireAvatarAssetId(avatarId))),
  )
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.operatorSkinPortrait,
    (_event, operatorId: unknown, skinId: unknown) =>
      guardedImageRequest(() =>
        getOperatorSkinPortrait(requireOperatorId(operatorId), requireSkinId(skinId)),
      ),
  )
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.operatorSkinAvatar,
    (_event, operatorId: unknown, skinId: unknown) =>
      guardedImageRequest(() =>
        getOperatorSkinAvatar(requireOperatorId(operatorId), requireSkinId(skinId)),
      ),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.classIcon, (_event, operatorClass: unknown) =>
    getBundledClassIcon(requireOperatorClass(operatorClass)),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.subclassIcon, (_event, subclassId: unknown) =>
    getSubclassIcon(requireMetadataId(subclassId, 'subclass')),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.factionIcon, (_event, factionId: unknown) =>
    getFactionIcon(requireMetadataId(factionId, 'faction')),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.checkUpdates, () => checkOperatorUpdates())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.updateData, () => updateOperatorData())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.artworkStorageInfo, () => getArtworkStorageInfo())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.artworkOpenFolder, () => openArtworkStorageFolder())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.artworkClear, async () => {
    if (clearingArtwork || portraitSyncPromise || activeImageRequests > 0)
      throw new Error(
        'Artwork is still being downloaded or displayed. Retry after activity finishes.',
      )
    clearingArtwork = true
    try {
      const result = await clearDownloadedArtwork()
      operatorArtworkCache().clearMemory()
      return result
    } finally {
      clearingArtwork = false
    }
  })
  ipcMain.handle(DESKTOP_IPC_CHANNELS.artworkDownloadAll, () => startPortraitSync())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.portraitProgress, () => portraitSyncProgress)
  ipcMain.handle(DESKTOP_IPC_CHANNELS.portraitStart, () => startPortraitSync())
  ipcMain.handle(DESKTOP_IPC_CHANNELS.portraitCancel, () => cancelPortraitSync())
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.arknightsAccountRequestCode,
    (_event, server: unknown, email: unknown) =>
      getArknightsAccountService().requestLoginCode(
        requireArknightsAccountServer(server),
        requireArknightsAccountString(email, 'email'),
      ),
  )
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.arknightsAccountSync,
    (_event, server: unknown, email: unknown, code: unknown) =>
      getArknightsAccountService().syncWithEmailCode(
        requireArknightsAccountServer(server),
        requireArknightsAccountString(email, 'email'),
        requireArknightsAccountString(code, 'verification code'),
      ),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.arknightsAccountGet, () =>
    getArknightsAccountService().getSnapshot(),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.arknightsAccountClear, () =>
    getArknightsAccountService().clearSnapshot(),
  )
  ipcMain.handle(DESKTOP_IPC_CHANNELS.arknightsAccountAvatar, (_event, avatarId: unknown) =>
    getArknightsProfileAvatar(requireArknightsAccountAvatarId(avatarId)),
  )
}

function createWindow(): void {
  const smokeTest = process.env['ELECTRON_SMOKE_TEST'] === '1'
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Renderer unload handlers cannot synchronously persist a React working
  // copy. Keep close ownership in Electron, and wait for the renderer to write
  // the Garrison before honoring the user's Save choice.
  let garrisonDirty = false
  let waitingForDecision = false
  let waitingForSave = false
  let allowClose = false
  const onDirty = (event: Electron.IpcMainEvent, dirty: unknown): void => {
    if (event.sender === mainWindow.webContents) garrisonDirty = dirty === true
  }
  const onSaveResult = (event: Electron.IpcMainEvent, success: unknown): void => {
    if (event.sender !== mainWindow.webContents || !waitingForSave) return
    waitingForSave = false
    if (success === true) {
      garrisonDirty = false
      allowClose = true
      mainWindow.close()
    } else {
      mainWindow.webContents.send(DESKTOP_IPC_CHANNELS.garrisonCloseSaveFailed)
    }
  }
  const onCloseDecision = (event: Electron.IpcMainEvent, choice: unknown): void => {
    if (event.sender !== mainWindow.webContents || !waitingForDecision) return
    if (choice !== 'save' && choice !== 'discard' && choice !== 'cancel') return
    waitingForDecision = false
    if (choice === 'discard') {
      allowClose = true
      mainWindow.close()
    } else if (choice === 'save') {
      waitingForSave = true
      mainWindow.webContents.send(DESKTOP_IPC_CHANNELS.garrisonCloseSaveRequest)
    }
  }
  ipcMain.on(DESKTOP_IPC_CHANNELS.garrisonCloseDirty, onDirty)
  ipcMain.on(DESKTOP_IPC_CHANNELS.garrisonCloseDecision, onCloseDecision)
  ipcMain.on(DESKTOP_IPC_CHANNELS.garrisonCloseSaveResult, onSaveResult)
  mainWindow.on('closed', () => {
    ipcMain.removeListener(DESKTOP_IPC_CHANNELS.garrisonCloseDirty, onDirty)
    ipcMain.removeListener(DESKTOP_IPC_CHANNELS.garrisonCloseDecision, onCloseDecision)
    ipcMain.removeListener(DESKTOP_IPC_CHANNELS.garrisonCloseSaveResult, onSaveResult)
  })
  mainWindow.on('close', (event) => {
    if (smokeTest || allowClose || !garrisonDirty) return
    event.preventDefault()
    if (waitingForSave || waitingForDecision) return
    waitingForDecision = true
    mainWindow.webContents.send(DESKTOP_IPC_CHANNELS.garrisonCloseDecisionRequest)
  })

  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      const reportPath = process.env['AKR_SMOKE_REPORT']
      if (reportPath) {
        void (async () => {
          const result = await mainWindow.webContents.executeJavaScript(`(async () => {
            const info = await window.desktop.getOperatorDataInfo()
            const dataset = await window.desktop.getOperatorDataset()
            const catalogs = []
            for (const region of ['cn','global']) for (const locale of ['en','jp','kr','tw','cn'])
              catalogs.push({ region, locale, events: (await window.desktop.getGarrisonEvents(region,locale)).length })
            return { info, operators: dataset.operators.length, catalogs, title: document.title }
          })()`)
          if (
            result.info.operatorCount !== result.operators ||
            result.catalogs.some((catalog: { events: number }) => !catalog.events)
          )
            throw new Error('Packaged data smoke check failed')
          const bundledRoot = app.isPackaged
            ? join(process.resourcesPath, 'bundled-data')
            : join(app.getAppPath(), 'resources/bundled-data')
          const build = JSON.parse(
            await readFile(join(bundledRoot, 'data-package-build.json'), 'utf8'),
          )
          const artwork = JSON.parse(
            await readFile(join(bundledRoot, 'artwork-inventory.json'), 'utf8'),
          )
          await writeFile(
            reportPath,
            JSON.stringify(
              {
                ...result,
                build,
                artworkId: artwork.artworkId,
                version: app.getVersion(),
                packaged: app.isPackaged,
              },
              null,
              2,
            ),
          )
          app.exit(0)
        })().catch((error: unknown) => {
          console.error(error)
          app.exit(1)
        })
        return
      }
      setTimeout(() => app.quit(), 250)
    })
  } else {
    mainWindow.once('ready-to-show', () => mainWindow.show())
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
