import { BrowserWindow, screen, ipcMain, desktopCapturer, globalShortcut } from 'electron'
import path from 'path'

let overlayWindow: BrowserWindow | null = null
let isStealthMode = false
let captureInterval: NodeJS.Timeout | null = null
let isCapturing = false

const CAPTURE_INTERVAL_MS = 3000

export function createOverlayWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().bounds

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    type: 'desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173/overlay.html')
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
    stopCapture()
  })

  return overlayWindow
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function showOverlay(): void {
  overlayWindow?.show()
  if (!isStealthMode) {
    startCapture()
  }
}

export function hideOverlay(): void {
  overlayWindow?.hide()
  stopCapture()
}

export function toggleOverlay(): void {
  if (overlayWindow?.isVisible()) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

export function setOverlayOpacity(opacity: number): void {
  overlayWindow?.setOpacity(Math.max(0, Math.min(1, opacity)))
}

export function enterStealthMode(): void {
  isStealthMode = true
  setOverlayOpacity(0.05)
  stopCapture()
  overlayWindow?.webContents.send('stealth-mode', true)
}

export function exitStealthMode(): void {
  isStealthMode = false
  setOverlayOpacity(1)
  startCapture()
  overlayWindow?.webContents.send('stealth-mode', false)
}

export function toggleStealthMode(): void {
  if (isStealthMode) {
    exitStealthMode()
  } else {
    enterStealthMode()
  }
}

export function isInStealthMode(): boolean {
  return isStealthMode
}

async function captureScreen(): Promise<string | null> {
  if (isCapturing || isStealthMode) return null
  
  isCapturing = true
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })

    if (sources.length > 0) {
      const primarySource = sources[0]
      const thumbnail = primarySource.thumbnail
      const dataUrl = thumbnail.toDataURL()
      return dataUrl
    }
  } catch (error) {
    console.error('[Overlay] Screen capture error:', error)
  } finally {
    isCapturing = false
  }
  return null
}

export function startCapture(): void {
  if (captureInterval) return
  
  console.log('[Overlay] Starting screen capture loop')
  
  captureInterval = setInterval(async () => {
    const screenshot = await captureScreen()
    if (screenshot && overlayWindow) {
      overlayWindow.webContents.send('screen-captured', screenshot)
    }
  }, CAPTURE_INTERVAL_MS)
  
  captureScreen().then(screenshot => {
    if (screenshot && overlayWindow) {
      overlayWindow.webContents.send('screen-captured', screenshot)
    }
  })
}

export function stopCapture(): void {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
    console.log('[Overlay] Stopped screen capture loop')
  }
}

export function setupOverlayIPC(): void {
  ipcMain.handle('overlay:show', () => showOverlay())
  ipcMain.handle('overlay:hide', () => hideOverlay())
  ipcMain.handle('overlay:toggle', () => toggleOverlay())
  ipcMain.handle('overlay:stealth-toggle', () => toggleStealthMode())
  ipcMain.handle('overlay:stealth-enter', () => enterStealthMode())
  ipcMain.handle('overlay:stealth-exit', () => exitStealthMode())
  ipcMain.handle('overlay:set-opacity', (_event, opacity: number) => setOverlayOpacity(opacity))
  ipcMain.handle('overlay:is-stealth', () => isStealthMode)
  
  ipcMain.handle('overlay:capture-now', async () => {
    return await captureScreen()
  })
  
  ipcMain.handle('overlay:set-clickthrough', (_event, enabled: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(enabled, { forward: true })
  })
  
  ipcMain.handle('overlay:analyze-screen', async (_event, base64Image: string) => {
    try {
      const serverUrl = process.env.AVATAR_SERVER_URL || 'http://localhost:5000'
      const response = await fetch(`${serverUrl}/api/screen/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      })
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      
      const result = await response.json()
      sendAnalysisResult(result)
      return result
    } catch (error: any) {
      console.error('[Overlay] Analyze screen error:', error)
      const fallbackResult = {
        keywords: ['分析失败'],
        summary: error.message || '无法连接服务器',
        riskLevel: 0,
        emotionState: 'calm',
      }
      sendAnalysisResult(fallbackResult)
      return fallbackResult
    }
  })
}

export function registerOverlayShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleOverlay()
  })
  
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    toggleStealthMode()
  })
  
  globalShortcut.register('Escape', () => {
    if (overlayWindow?.isVisible() && !isStealthMode) {
      enterStealthMode()
    }
  })
  
  console.log('[Overlay] Shortcuts registered: Ctrl+Shift+X (toggle), Ctrl+Shift+S (stealth), Esc (quick hide)')
}

export function unregisterOverlayShortcuts(): void {
  globalShortcut.unregisterAll()
}

export function sendAnalysisResult(result: {
  keywords: string[]
  summary: string
  riskLevel: number
  emotionState: string
}): void {
  overlayWindow?.webContents.send('analysis-result', result)
}
