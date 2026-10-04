import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { PromotionArt } from '../shared/portraits'
import {
  checkOperatorUpdates,
  getClassIcon,
  getOperatorDataInfo,
  getOperatorDataset,
  getOperatorImage,
} from './operatorDataService'
import {
  getOperatorPortrait,
  updateOperatorDataWithPortraits,
} from './operatorPortraitService'

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
    getClassIcon(operatorClass),
  )
  ipcMain.handle('operator-data:check-updates', () => checkOperatorUpdates())
  ipcMain.handle('operator-data:update', () => updateOperatorDataWithPortraits())
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
