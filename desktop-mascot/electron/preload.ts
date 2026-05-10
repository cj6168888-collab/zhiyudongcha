import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  moveWindow: (deltaX: number, deltaY: number) => 
    ipcRenderer.invoke('move-window', deltaX, deltaY),
  
  getScreenSize: () => 
    ipcRenderer.invoke('get-screen-size'),
  
  setWindowSize: (width: number, height: number) => 
    ipcRenderer.invoke('set-window-size', width, height),
  
  setIgnoreMouse: (ignore: boolean) => 
    ipcRenderer.invoke('set-ignore-mouse', ignore),
  
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),

  showMessageBox: (options: { type?: string; title?: string; message: string; buttons?: string[] }) =>
    ipcRenderer.invoke('show-message-box', options),

  listDesktopFiles: () =>
    ipcRenderer.invoke('list-desktop-files'),

  organizeDesktop: () =>
    ipcRenderer.invoke('organize-desktop'),

  findDuplicates: (directory?: string) =>
    ipcRenderer.invoke('find-duplicates', directory),

  findLargeFiles: (minSizeMB?: number) =>
    ipcRenderer.invoke('find-large-files', minSizeMB),

  openFile: (filePath: string) =>
    ipcRenderer.invoke('open-file', filePath),

  showInFolder: (filePath: string) =>
    ipcRenderer.invoke('show-in-folder', filePath),

  deleteFile: (filePath: string) =>
    ipcRenderer.invoke('delete-file', filePath),

  getSystemInfo: () =>
    ipcRenderer.invoke('get-system-info'),

  cleanTempFiles: () =>
    ipcRenderer.invoke('clean-temp-files'),

  cleanBrowserCache: () =>
    ipcRenderer.invoke('clean-browser-cache'),

  emptyRecycleBin: () =>
    ipcRenderer.invoke('empty-recycle-bin'),

  onOpenSettings: (callback: () => void) => 
    ipcRenderer.on('open-settings', callback),

  onAction: (callback: (action: string) => void) =>
    ipcRenderer.on('action', (_event, action) => callback(action)),

  onScreenCaptured: (callback: (screenshot: string) => void) =>
    ipcRenderer.on('screen-captured', (_event, screenshot) => callback(screenshot)),

  onAnalysisResult: (callback: (result: any) => void) =>
    ipcRenderer.on('analysis-result', (_event, result) => callback(result)),

  onStealthMode: (callback: (enabled: boolean) => void) =>
    ipcRenderer.on('stealth-mode', (_event, enabled) => callback(enabled)),

  analyzeScreen: (base64: string) =>
    ipcRenderer.invoke('overlay:analyze-screen', base64),

  toggleStealth: () =>
    ipcRenderer.invoke('overlay:stealth-toggle'),

  setClickthrough: (enabled: boolean) =>
    ipcRenderer.invoke('overlay:set-clickthrough', enabled),

  showOverlay: () =>
    ipcRenderer.invoke('overlay:show'),

  hideOverlay: () =>
    ipcRenderer.invoke('overlay:hide'),

  toggleOverlay: () =>
    ipcRenderer.invoke('overlay:toggle'),

  captureNow: () =>
    ipcRenderer.invoke('overlay:capture-now'),
})

declare global {
  interface Window {
    electronAPI: {
      moveWindow: (deltaX: number, deltaY: number) => Promise<void>
      getScreenSize: () => Promise<{ width: number; height: number }>
      setWindowSize: (width: number, height: number) => Promise<void>
      setIgnoreMouse: (ignore: boolean) => Promise<void>
      showNotification: (title: string, body: string) => Promise<void>
      showMessageBox: (options: { type?: string; title?: string; message: string; buttons?: string[] }) => Promise<{ response: number }>
      listDesktopFiles: () => Promise<Array<{ name: string; path: string; size: number; type: string; modifiedTime: number }>>
      organizeDesktop: () => Promise<{ moved: number; categories: Record<string, string[]> }>
      findDuplicates: (directory?: string) => Promise<{ groups: Array<{ hash: string; files: Array<{ path: string; size: number }> }>; totalDuplicates: number; potentialSavings: number }>
      findLargeFiles: (minSizeMB?: number) => Promise<Array<{ name: string; path: string; size: number }>>
      openFile: (filePath: string) => Promise<boolean>
      showInFolder: (filePath: string) => Promise<boolean>
      deleteFile: (filePath: string) => Promise<boolean>
      getSystemInfo: () => Promise<{ platform: string; cpuUsage: number; memoryUsage: number; diskUsage: number; uptime: number }>
      cleanTempFiles: () => Promise<{ freedSpace: number; itemsCleaned: number; details: string[] }>
      cleanBrowserCache: () => Promise<{ freedSpace: number; itemsCleaned: number; details: string[] }>
      emptyRecycleBin: () => Promise<{ freedSpace: number; itemsCleaned: number; details: string[] }>
      onOpenSettings: (callback: () => void) => void
      onAction: (callback: (action: string) => void) => void
      onScreenCaptured: (callback: (screenshot: string) => void) => void
      onAnalysisResult: (callback: (result: any) => void) => void
      onStealthMode: (callback: (enabled: boolean) => void) => void
      analyzeScreen: (base64: string) => Promise<any>
      toggleStealth: () => Promise<void>
      setClickthrough: (enabled: boolean) => Promise<void>
      showOverlay: () => Promise<void>
      hideOverlay: () => Promise<void>
      toggleOverlay: () => Promise<void>
      captureNow: () => Promise<string | null>
    }
  }
}
