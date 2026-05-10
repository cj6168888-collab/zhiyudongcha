import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog } from 'electron'
import path from 'path'
import { setupFileSystemHandlers } from './file-system'
import { setupSystemInfoHandlers } from './system-info'
import { createOverlayWindow, setupOverlayIPC, registerOverlayShortcuts, unregisterOverlayShortcuts, toggleOverlay, toggleStealthMode } from './overlay-manager'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 280,
    height: 350,
    x: width - 320,
    y: height - 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🌟 显示领航者',
      click: () => mainWindow?.show(),
    },
    {
      label: '👻 隐藏领航者',
      click: () => mainWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: '🗂️ 整理桌面',
      click: () => {
        mainWindow?.webContents.send('action', 'organize-desktop')
      },
    },
    {
      label: '🧹 快速清理',
      click: () => {
        mainWindow?.webContents.send('action', 'quick-cleanup')
      },
    },
    {
      label: '💊 系统体检',
      click: () => {
        mainWindow?.webContents.send('action', 'health-check')
      },
    },
    { type: 'separator' },
    {
      label: '👁️ 透明驾驶舱',
      click: () => {
        toggleOverlay()
      },
    },
    {
      label: '👻 隐身模式',
      click: () => {
        toggleStealthMode()
      },
    },
    { type: 'separator' },
    {
      label: '🎤 注册声纹',
      click: () => {
        mainWindow?.webContents.send('action', 'enroll-voice')
      },
    },
    {
      label: '⚙️ 设置',
      click: () => {
        mainWindow?.webContents.send('open-settings')
      },
    },
    { type: 'separator' },
    {
      label: '❌ 退出',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setToolTip('领航者桌面精灵')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

ipcMain.handle('move-window', (_event, deltaX: number, deltaY: number) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x + deltaX, y + deltaY)
  }
})

ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { width, height }
})

ipcMain.handle('set-window-size', (_event, width: number, height: number) => {
  mainWindow?.setSize(width, height)
})

ipcMain.handle('set-ignore-mouse', (_event, ignore: boolean) => {
  mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
})

ipcMain.handle('show-notification', (_event, title: string, body: string) => {
  const { Notification } = require('electron')
  new Notification({ title, body }).show()
})

ipcMain.handle('show-message-box', async (_event, options: Electron.MessageBoxOptions) => {
  if (mainWindow) {
    return await dialog.showMessageBox(mainWindow, options)
  }
  return await dialog.showMessageBox(options)
})

app.whenReady().then(() => {
  setupFileSystemHandlers()
  setupSystemInfoHandlers()
  setupOverlayIPC()

  createWindow()
  createTray()

  createOverlayWindow()
  registerOverlayShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterOverlayShortcuts()
})
