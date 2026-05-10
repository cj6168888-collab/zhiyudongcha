interface SyncConfig {
  provider: 'local' | 'webdav' | 'custom'
  endpoint?: string
  username?: string
  syncInterval: number
  syncFolders: string[]
  excludePatterns: string[]
}

interface SyncStatus {
  lastSync: Date | null
  pendingChanges: number
  isSyncing: boolean
  errors: string[]
}

interface SyncItem {
  path: string
  type: 'file' | 'folder'
  action: 'upload' | 'download' | 'delete' | 'conflict'
  localModified?: Date
  remoteModified?: Date
  size: number
}

interface BackupInfo {
  id: string
  name: string
  createdAt: Date
  size: number
  items: number
}

const STORAGE_KEYS = {
  CONFIG: 'xiaozhi-sync-config',
  HISTORY: 'xiaozhi-sync-history',
}

class CloudSync {
  private electronAPI: typeof window.electronAPI | null = null
  private config: SyncConfig | null = null
  private status: SyncStatus = {
    lastSync: null,
    pendingChanges: 0,
    isSyncing: false,
    errors: [],
  }
  private syncTimer: NodeJS.Timeout | null = null
  private fileHashes: Map<string, string> = new Map()

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
    this.loadConfig()
  }

  private loadConfig() {
    try {
      const config = localStorage.getItem(STORAGE_KEYS.CONFIG)
      if (config) {
        this.config = JSON.parse(config)
        if (this.config?.syncInterval && this.config.syncInterval > 0) {
          this.startAutoSync()
        }
      }
    } catch (error) {
      console.error('加载同步配置失败:', error)
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config))
    } catch (error) {
      console.error('保存同步配置失败:', error)
    }
  }

  configure(config: Partial<SyncConfig>): void {
    this.config = {
      provider: 'local',
      syncInterval: 30,
      syncFolders: [],
      excludePatterns: ['node_modules', '.git', '*.log', '*.tmp'],
      ...this.config,
      ...config,
    }
    this.saveConfig()

    if (this.config.syncInterval > 0) {
      this.startAutoSync()
    } else {
      this.stopAutoSync()
    }
  }

  getConfig(): SyncConfig | null {
    return this.config
  }

  getStatus(): SyncStatus {
    return { ...this.status }
  }

  private startAutoSync() {
    this.stopAutoSync()

    if (!this.config || this.config.syncInterval <= 0) return

    this.syncTimer = setInterval(() => {
      this.sync()
    }, this.config.syncInterval * 60 * 1000)
  }

  private stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async sync(): Promise<{
    success: boolean
    uploaded: number
    downloaded: number
    conflicts: SyncItem[]
    errors: string[]
  }> {
    if (this.status.isSyncing) {
      return { success: false, uploaded: 0, downloaded: 0, conflicts: [], errors: ['同步正在进行中'] }
    }

    if (!this.config) {
      return { success: false, uploaded: 0, downloaded: 0, conflicts: [], errors: ['未配置同步'] }
    }

    this.status.isSyncing = true
    this.status.errors = []

    const result = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: [] as SyncItem[],
      errors: [] as string[],
    }

    try {
      const pendingItems = await this.detectChanges()
      
      for (const item of pendingItems) {
        try {
          switch (item.action) {
            case 'upload':
              await this.uploadFile(item.path)
              result.uploaded++
              break
            case 'download':
              await this.downloadFile(item.path)
              result.downloaded++
              break
            case 'conflict':
              result.conflicts.push(item)
              break
          }
        } catch (error) {
          result.errors.push(`${item.path}: ${error}`)
        }
      }

      this.status.lastSync = new Date()
      this.status.pendingChanges = result.conflicts.length

    } catch (error) {
      result.success = false
      result.errors.push(String(error))
    } finally {
      this.status.isSyncing = false
      this.status.errors = result.errors
    }

    return result
  }

  private async detectChanges(): Promise<SyncItem[]> {
    const changes: SyncItem[] = []

    if (!this.electronAPI || !this.config) return changes

    for (const folder of this.config.syncFolders) {
      try {
        const localFiles = await (this.electronAPI as any).listFilesRecursive?.(folder)
        const remoteFiles = await (this.electronAPI as any).listRemoteFiles?.(folder)

        const localMap = new Map(localFiles?.map((f: any) => [f.path, f]) || [])
        const remoteMap = new Map(remoteFiles?.map((f: any) => [f.path, f]) || [])

        for (const [path, local] of localMap) {
          const remote = remoteMap.get(path)
          
          if (!remote) {
            changes.push({
              path,
              type: (local as any).isDirectory ? 'folder' : 'file',
              action: 'upload',
              localModified: new Date((local as any).modifiedTime),
              size: (local as any).size,
            })
          } else if ((local as any).modifiedTime > (remote as any).modifiedTime) {
            if ((remote as any).modifiedTime > this.status.lastSync?.getTime()) {
              changes.push({
                path,
                type: 'file',
                action: 'conflict',
                localModified: new Date((local as any).modifiedTime),
                remoteModified: new Date((remote as any).modifiedTime),
                size: (local as any).size,
              })
            } else {
              changes.push({
                path,
                type: 'file',
                action: 'upload',
                localModified: new Date((local as any).modifiedTime),
                size: (local as any).size,
              })
            }
          }
        }

        for (const [path, remote] of remoteMap) {
          if (!localMap.has(path)) {
            changes.push({
              path,
              type: (remote as any).isDirectory ? 'folder' : 'file',
              action: 'download',
              remoteModified: new Date((remote as any).modifiedTime),
              size: (remote as any).size,
            })
          }
        }

      } catch (error) {
        console.error(`扫描文件夹失败: ${folder}`, error)
      }
    }

    return changes
  }

  private async uploadFile(path: string): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).uploadFile?.(path, this.config?.endpoint)
      return result?.success || false
    } catch (error) {
      console.error('上传失败:', error)
      return false
    }
  }

  private async downloadFile(path: string): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).downloadFile?.(path, this.config?.endpoint)
      return result?.success || false
    } catch (error) {
      console.error('下载失败:', error)
      return false
    }
  }

  async resolveConflict(path: string, resolution: 'local' | 'remote' | 'both'): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      switch (resolution) {
        case 'local':
          return await this.uploadFile(path)
        case 'remote':
          return await this.downloadFile(path)
        case 'both':
          const timestamp = Date.now()
          const ext = path.substring(path.lastIndexOf('.'))
          const basePath = path.substring(0, path.lastIndexOf('.'))
          const conflictPath = `${basePath}_conflict_${timestamp}${ext}`
          
          await (this.electronAPI as any).copyFile?.(path, conflictPath)
          return await this.downloadFile(path)
      }
    } catch (error) {
      console.error('解决冲突失败:', error)
      return false
    }
  }

  async createBackup(name?: string): Promise<BackupInfo | null> {
    if (!this.electronAPI || !this.config) return null

    try {
      const backupName = name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`
      const result = await (this.electronAPI as any).createBackup?.(backupName, this.config.syncFolders)
      
      if (result?.success) {
        return {
          id: result.id,
          name: backupName,
          createdAt: new Date(),
          size: result.size,
          items: result.items,
        }
      }
      return null
    } catch (error) {
      console.error('创建备份失败:', error)
      return null
    }
  }

  async restoreBackup(backupId: string): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).restoreBackup?.(backupId)
      return result?.success || false
    } catch (error) {
      console.error('恢复备份失败:', error)
      return false
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    if (!this.electronAPI) return []

    try {
      const backups = await (this.electronAPI as any).listBackups?.()
      return backups || []
    } catch (error) {
      console.error('获取备份列表失败:', error)
      return []
    }
  }

  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

export const cloudSync = new CloudSync()
export default cloudSync
