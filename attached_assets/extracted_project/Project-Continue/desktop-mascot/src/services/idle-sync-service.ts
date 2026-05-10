interface ElectronIdleAPI {
  getSystemIdleTime?: () => Promise<number>
  getNetworkUsage?: () => Promise<{ download: number; upload: number }>
  getCpuUsage?: () => Promise<number>
  onUserActivity?: (callback: () => void) => void
  scanDirectory?: (path: string, options?: any) => Promise<any[]>
  readFileContent?: (path: string, options?: any) => Promise<string>
}

interface SyncTask {
  id: string
  type: 'scan' | 'index' | 'upload'
  targetPath?: string
  fileId?: string
  priority: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  progress: number
  createdAt: Date
}

interface IdleConfig {
  minIdleTimeSeconds: number
  maxCpuUsagePercent: number
  maxNetworkUsageMbps: number
  checkIntervalMs: number
  pauseOnActivity: boolean
  workingHoursOnly: boolean
  workingHoursStart: number
  workingHoursEnd: number
}

interface SyncStats {
  totalFilesScanned: number
  totalFilesIndexed: number
  totalFilesUploaded: number
  totalSizeBytes: number
  lastSyncAt?: Date
  totalSyncTimeMs: number
  pauseCount: number
}

const DEFAULT_CONFIG: IdleConfig = {
  minIdleTimeSeconds: 120,
  maxCpuUsagePercent: 30,
  maxNetworkUsageMbps: 1,
  checkIntervalMs: 10000,
  pauseOnActivity: true,
  workingHoursOnly: false,
  workingHoursStart: 9,
  workingHoursEnd: 18,
}

const STORAGE_KEYS = {
  CONFIG: 'xiaozhi-idle-sync-config',
  STATS: 'xiaozhi-idle-sync-stats',
  QUEUE: 'xiaozhi-idle-sync-queue',
}

type SyncEventType = 'started' | 'paused' | 'resumed' | 'completed' | 'progress' | 'error'
type SyncEventCallback = (event: { type: SyncEventType; data?: any }) => void

class IdleSyncService {
  private electronAPI: ElectronIdleAPI | null = null
  private config: IdleConfig = DEFAULT_CONFIG
  private stats: SyncStats = {
    totalFilesScanned: 0,
    totalFilesIndexed: 0,
    totalFilesUploaded: 0,
    totalSizeBytes: 0,
    totalSyncTimeMs: 0,
    pauseCount: 0,
  }
  private taskQueue: SyncTask[] = []
  private isRunning = false
  private isPaused = false
  private checkInterval: NodeJS.Timeout | null = null
  private lastActivityTime = Date.now()
  private eventListeners: SyncEventCallback[] = []
  private currentTask: SyncTask | null = null

  constructor() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      this.electronAPI = (window as any).electronAPI as ElectronIdleAPI
    }
    this.loadFromStorage()
    this.setupActivityListener()
  }

  private loadFromStorage() {
    try {
      const config = localStorage.getItem(STORAGE_KEYS.CONFIG)
      const stats = localStorage.getItem(STORAGE_KEYS.STATS)
      const queue = localStorage.getItem(STORAGE_KEYS.QUEUE)

      if (config) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(config) }
      if (stats) this.stats = JSON.parse(stats)
      if (queue) this.taskQueue = JSON.parse(queue)
    } catch (error) {
      console.error('加载同步配置失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config))
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats))
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.taskQueue))
    } catch (error) {
      console.error('保存同步配置失败:', error)
    }
  }

  private setupActivityListener() {
    if (typeof window !== 'undefined') {
      const updateActivity = () => {
        this.lastActivityTime = Date.now()
        if (this.isRunning && !this.isPaused && this.config.pauseOnActivity) {
          this.pauseSync('检测到用户活动')
        }
      }

      window.addEventListener('mousemove', updateActivity)
      window.addEventListener('keydown', updateActivity)
      window.addEventListener('click', updateActivity)
      window.addEventListener('scroll', updateActivity)

      if (this.electronAPI?.onUserActivity) {
        this.electronAPI.onUserActivity(updateActivity)
      }
    }
  }

  private emit(type: SyncEventType, data?: any) {
    this.eventListeners.forEach(cb => cb({ type, data }))
  }

  on(callback: SyncEventCallback) {
    this.eventListeners.push(callback)
    return () => {
      const index = this.eventListeners.indexOf(callback)
      if (index > -1) this.eventListeners.splice(index, 1)
    }
  }

  async checkIdleStatus(): Promise<{
    isIdle: boolean
    idleTimeSeconds: number
    cpuUsage: number
    networkUsage: { download: number; upload: number }
    reason?: string
  }> {
    const result = {
      isIdle: false,
      idleTimeSeconds: 0,
      cpuUsage: 0,
      networkUsage: { download: 0, upload: 0 },
      reason: '',
    }

    const timeSinceActivity = (Date.now() - this.lastActivityTime) / 1000
    result.idleTimeSeconds = timeSinceActivity

    if (this.electronAPI?.getSystemIdleTime) {
      try {
        const systemIdleTime = await this.electronAPI.getSystemIdleTime()
        result.idleTimeSeconds = Math.max(timeSinceActivity, systemIdleTime)
      } catch (e) {
        console.error('获取系统空闲时间失败:', e)
      }
    }

    if (result.idleTimeSeconds < this.config.minIdleTimeSeconds) {
      result.reason = `空闲时间不足 (${Math.round(result.idleTimeSeconds)}s < ${this.config.minIdleTimeSeconds}s)`
      return result
    }

    if (this.electronAPI?.getCpuUsage) {
      try {
        result.cpuUsage = await this.electronAPI.getCpuUsage()
        if (result.cpuUsage > this.config.maxCpuUsagePercent) {
          result.reason = `CPU使用率过高 (${result.cpuUsage.toFixed(1)}% > ${this.config.maxCpuUsagePercent}%)`
          return result
        }
      } catch (e) {
        console.error('获取CPU使用率失败:', e)
      }
    }

    if (this.electronAPI?.getNetworkUsage) {
      try {
        result.networkUsage = await this.electronAPI.getNetworkUsage()
        const totalMbps = (result.networkUsage.download + result.networkUsage.upload) / 1024 / 1024
        if (totalMbps > this.config.maxNetworkUsageMbps) {
          result.reason = `网络使用率过高 (${totalMbps.toFixed(2)} Mbps > ${this.config.maxNetworkUsageMbps} Mbps)`
          return result
        }
      } catch (e) {
        console.error('获取网络使用率失败:', e)
      }
    }

    if (this.config.workingHoursOnly) {
      const hour = new Date().getHours()
      if (hour < this.config.workingHoursStart || hour >= this.config.workingHoursEnd) {
        result.reason = `不在工作时间段 (${this.config.workingHoursStart}:00 - ${this.config.workingHoursEnd}:00)`
        return result
      }
    }

    result.isIdle = true
    return result
  }

  async start() {
    if (this.isRunning) {
      console.log('同步服务已在运行')
      return
    }

    this.isRunning = true
    this.isPaused = false
    this.emit('started')
    console.log('🌙 小智后台同步服务已启动，等待电脑空闲...')

    this.checkInterval = setInterval(async () => {
      await this.runSyncCycle()
    }, this.config.checkIntervalMs)

    await this.runSyncCycle()
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
    this.isPaused = false
    this.saveToStorage()
    console.log('同步服务已停止')
  }

  private async runSyncCycle() {
    if (!this.isRunning || this.isPaused) return

    const idleStatus = await this.checkIdleStatus()

    if (!idleStatus.isIdle) {
      if (this.currentTask) {
        this.pauseSync(idleStatus.reason || '系统繁忙')
      }
      return
    }

    if (this.isPaused) {
      this.resumeSync()
    }

    await this.processNextTask()
  }

  private pauseSync(reason: string) {
    if (this.isPaused) return

    this.isPaused = true
    this.stats.pauseCount++
    this.saveToStorage()

    if (this.currentTask) {
      this.currentTask.status = 'paused'
    }

    this.emit('paused', { reason })
    console.log(`⏸️ 同步已暂停: ${reason}`)
  }

  private resumeSync() {
    if (!this.isPaused) return

    this.isPaused = false

    if (this.currentTask) {
      this.currentTask.status = 'running'
    }

    this.emit('resumed')
    console.log('▶️ 同步已恢复')
  }

  private async processNextTask() {
    if (this.currentTask && this.currentTask.status === 'running') {
      return
    }

    const pendingTask = this.taskQueue.find(t => 
      t.status === 'pending' || t.status === 'paused'
    )

    if (!pendingTask) {
      return
    }

    this.currentTask = pendingTask
    pendingTask.status = 'running'
    const startTime = Date.now()

    try {
      switch (pendingTask.type) {
        case 'scan':
          await this.executeScanTask(pendingTask)
          break
        case 'index':
          await this.executeIndexTask(pendingTask)
          break
        case 'upload':
          await this.executeUploadTask(pendingTask)
          break
      }

      pendingTask.status = 'completed'
      pendingTask.progress = 100
      this.stats.totalSyncTimeMs += Date.now() - startTime

      this.emit('completed', { task: pendingTask })
    } catch (error) {
      console.error('任务执行失败:', error)
      pendingTask.status = 'failed'
      this.emit('error', { task: pendingTask, error })
    }

    this.currentTask = null
    this.saveToStorage()
  }

  private async executeScanTask(task: SyncTask) {
    if (!task.targetPath || !this.electronAPI?.scanDirectory) {
      throw new Error('无法执行扫描任务')
    }

    const files = await this.electronAPI.scanDirectory(task.targetPath, {
      recursive: true,
      excludePatterns: ['node_modules', '.git', '__pycache__', '.DS_Store', 'Thumbs.db'],
    })

    if (!files) return

    for (let i = 0; i < files.length; i++) {
      if (this.isPaused) break

      task.progress = Math.round((i / files.length) * 100)
      this.emit('progress', { task, current: i, total: files.length })

      this.addTask({
        type: 'index',
        fileId: files[i].path,
        priority: 5,
      })

      this.stats.totalFilesScanned++

      if (i % 10 === 0) {
        const idleStatus = await this.checkIdleStatus()
        if (!idleStatus.isIdle) {
          this.pauseSync(idleStatus.reason || '系统繁忙')
          break
        }
      }
    }

    this.saveToStorage()
  }

  private async executeIndexTask(task: SyncTask) {
    if (!task.fileId || !this.electronAPI?.readFileContent) {
      throw new Error('无法执行索引任务')
    }

    const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.java', '.doc', '.docx', '.pdf']
    const ext = task.fileId.substring(task.fileId.lastIndexOf('.')).toLowerCase()

    if (textExts.includes(ext)) {
      try {
        await this.electronAPI.readFileContent(task.fileId, { maxSize: 50000 })
        this.stats.totalFilesIndexed++
      } catch (e) {
        console.error('索引文件失败:', task.fileId, e)
      }
    }

    task.progress = 100
    this.saveToStorage()
  }

  private async executeUploadTask(task: SyncTask) {
    task.progress = 100
    this.stats.totalFilesUploaded++
    this.saveToStorage()
  }

  addTask(taskInfo: { type: SyncTask['type']; targetPath?: string; fileId?: string; priority?: number }) {
    const task: SyncTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskInfo.type,
      targetPath: taskInfo.targetPath,
      fileId: taskInfo.fileId,
      priority: taskInfo.priority || 5,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    }

    this.taskQueue.push(task)
    this.taskQueue.sort((a, b) => b.priority - a.priority)
    this.saveToStorage()

    return task.id
  }

  addDirectoryToSync(directoryPath: string, priority = 5) {
    return this.addTask({
      type: 'scan',
      targetPath: directoryPath,
      priority,
    })
  }

  updateConfig(newConfig: Partial<IdleConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.saveToStorage()
  }

  getConfig(): IdleConfig {
    return { ...this.config }
  }

  getStats(): SyncStats {
    return { ...this.stats }
  }

  getStatus(): {
    isRunning: boolean
    isPaused: boolean
    currentTask: SyncTask | null
    pendingTasks: number
    completedTasks: number
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentTask: this.currentTask,
      pendingTasks: this.taskQueue.filter(t => t.status === 'pending' || t.status === 'paused').length,
      completedTasks: this.taskQueue.filter(t => t.status === 'completed').length,
    }
  }

  clearCompletedTasks() {
    this.taskQueue = this.taskQueue.filter(t => t.status !== 'completed')
    this.saveToStorage()
  }

  getStatusMessage(): string {
    const status = this.getStatus()
    const stats = this.getStats()

    if (!status.isRunning) {
      return '💤 后台同步服务未启动'
    }

    if (status.isPaused) {
      return '⏸️ 同步已暂停，等待电脑空闲...'
    }

    if (status.currentTask) {
      const task = status.currentTask
      return `🔄 正在${task.type === 'scan' ? '扫描' : task.type === 'index' ? '索引' : '上传'}... (${task.progress}%)`
    }

    if (status.pendingTasks > 0) {
      return `📋 待处理任务: ${status.pendingTasks} 个`
    }

    return `✅ 同步完成！已处理 ${stats.totalFilesScanned} 个文件`
  }
}

export const idleSyncService = new IdleSyncService()
export default idleSyncService
