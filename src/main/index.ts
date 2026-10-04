import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { PortraitSyncProgress } from '../shared/desktop'
import type { PromotionArt } from '../shared/portraits'
import {
  checkOperatorUpdates,
  getOperatorDataInfo,
  getOperatorDataset,
  getOperatorImage,
  syncOperatorAvatars,
  updateOperatorData,
} from './operatorDataService'
import { getOperatorPortrait, syncOperatorPortraits } from './operatorPortraitService'
import {
  getBundledClassIcon,
  getFactionIcon,
  getSubclassIcon,
} from './operatorUiAssetService'

let portraitSyncProgress: PortraitSyncProgress = {
  status: 'idle',
  completed: 0,
  total: 0,
  message: 'Operator artwork has not been checked yet.',
}
let portraitSyncController: AbortController | null = null
let portraitSyncPromise: Promise<PortraitSyncProgress> | null = null

function configurePortableUserData(): void {
  const portableDir = process.env['PORTABLE_EXECUTABLE_DIR']
  if (!portableDir) return

  try {
    const portableData = join(portableDir, 'Arknights-Randomizer-Data')
    mkdirSync(portableData, { recursive: true })
    app.setPath('userData', portableData)
  } catch {
    // A read-only portable location should never prevent the app from launching.
    // Electron will fall back to its normal per-user application-data directory.
  }
}

configurePortableUserData()

function publishPortraitProgress(progress: PortraitSyncProgress): PortraitSyncProgress {
  portraitSyncProgress = progress
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('operator-portraits:progress-changed', progress)
  }
  return progress
}

async function startPortraitSync(): Promise<PortraitSyncProgress> {
  if (portraitSyncPromise) return portraitSyncPromise

  const controller = new AbortController()
  portraitSyncController = controller
  portraitSyncPromise = (async () => {
    try {
      const dataset = await getOperatorDataset()
      const operatorIds = dataset.operators.map((operator) => operator.id)
      const total = operatorIds.length * 2
      publishPortraitProgress({
        status: 'downloading',
        completed: 0,
        total,
        message: 'Downloading operator avatars…',
      })

      const avatarWarnings = await syncOperatorAvatars(operatorIds, {
        signal: controller.signal,
        onProgress: (completed) =>
          publishPortraitProgress({
            status: 'downloading',
            completed,
            total,
            message: `Downloading operator avatars… ${completed}/${operatorIds.length}`,
          }),
      })

      const portraitWarnings = await syncOperatorPortraits(operatorIds, {
        signal: controller.signal,
        onProgress: (progress) =>
          publishPortraitProgress({
            ...progress,
            completed: operatorIds.length + progress.completed,
            total,
            message: progress.message,
          }),
      })
      const warnings = [...avatarWarnings, ...portraitWarnings]
      return publishPortraitProgress({
        status: 'complete',
        completed: total,
        total,
        message:
          warnings.length > 0
            ? `Artwork download complete with ${warnings.length} unavailable asset(s).`
            : 'Operator artwork is ready for offline use.',
      })
    } catch {
      if (controller.signal.aborted) {
        return publishPortraitProgress({
          ...portraitSyncProgress,
          status: 'cancelled',
          message: 'Artwork download paused. It will resume on the next launch or when retried.',
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
  ipcMain.handle('operator-data:get', () => getOperatorDataset())
  ipcMain.handle('operator-data:info', () => getOperatorDataInfo())
  ipcMain.handle('operator-data:image', (_event, operatorId: string) =>
    getOperatorImage(operatorId),
  )
  ipcMain.handle(
    'operator-data:portrait',
    (_event, operatorId: string, promotionArt: PromotionArt) =>
      getOperatorPortrait(operatorId, promotionArt),
  )
  ipcMain.handle('operator-data:class-icon', (_event, operatorClass) =>
    getBundledClassIcon(operatorClass),
  )
  ipcMain.handle('operator-data:subclass-icon', (_event, subclassId: string) =>
    getSubclassIcon(subclassId),
  )
  ipcMain.handle('operator-data:faction-icon', (_event, factionId: string) =>
    getFactionIcon(factionId),
  )
  ipcMain.handle('operator-data:check-updates', () => checkOperatorUpdates())
  ipcMain.handle('operator-data:update', () => updateOperatorData())
  ipcMain.handle('operator-portraits:progress', () => portraitSyncProgress)
  ipcMain.handle('operator-portraits:start', () => startPortraitSync())
  ipcMain.handle('operator-portraits:cancel', () => cancelPortraitSync())
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

  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => app.quit(), 250)
    })
  } else {
    mainWindow.once('ready-to-show', () => mainWindow.show())
    mainWindow.webContents.once('did-finish-load', () => {
      void startPortraitSync()
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
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
