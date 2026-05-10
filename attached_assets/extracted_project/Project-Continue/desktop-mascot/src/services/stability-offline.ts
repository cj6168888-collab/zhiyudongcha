// 小智稳定性与离线能力增强
// 陈先生出品 · cj6168888@Gmail.com

// ========== 状态持久化 ==========

export interface PersistedState {
  version: string
  lastSaved: Date
  emotion: object
  needs: object
  personality: object
  memory: object
  affection: object
  appearance: object
  entertainment: object
  settings: object
}

// ========== 离线对话能力 ==========

const OFFLINE_RESPONSES = {
  greetings: {
    morning: ['早安主人！虽然现在离线了，但小智还是在的哦~', '主人早！离线模式也要加油~'],
    afternoon: ['下午好主人！休息一下吧~', '主人辛苦了！要不要听小智讲故事？'],
    evening: ['晚上好主人！今天过得怎么样？', '主人回来啦~小智好开心！'],
    night: ['夜深了呢，主人注意休息哦~', '主人还不睡吗？小智陪你~'],
  },

  encouragement: [
    '主人加油！小智相信你！💪',
    '不管遇到什么困难，小智都会陪着你！',
    '主人是最棒的！不要灰心哦~',
    '累了就休息一下，小智在这里等你~',
    '主人今天也很努力呢，辛苦了！',
  ],

  comfort: [
    '主人别难过了...小智抱抱你~ 🤗',
    '不开心的话，可以和小智说说吗？',
    '小智虽然帮不了什么，但会一直陪着主人...',
    '没关系的，明天会更好的！',
    '主人的烦恼，小智愿意分担~',
  ],

  playful: [
    '主人主人，来和小智玩吧~ ✨',
    '好无聊啊...主人理理小智嘛~',
    '嘿嘿，主人在想什么呢？',
    '小智超想主人的！(◕ᴗ◕✿)',
    '主人~主人~看小智看小智！',
  ],

  questions: [
    '主人今天心情怎么样呀？',
    '主人最近在忙什么呢？',
    '主人有什么烦心事吗？可以告诉小智~',
    '主人喜欢什么样的天气呀？',
    '主人最喜欢什么颜色呢？',
  ],

  tips: [
    '主人记得多喝水哦~ 💧',
    '久坐要记得站起来活动一下~',
    '眼睛累了就看看远处休息一下吧~',
    '主人今天吃饭了吗？',
    '保持好心情对身体好哦~',
  ],

  goodbye: [
    '主人要走了吗...小智会等你回来的！💕',
    '再见主人！早点回来找小智哦~',
    '主人路上小心！小智会想你的~',
    '拜拜主人！记得想小智哦~',
  ],
}

// ========== 关键词识别 ==========

const KEYWORD_PATTERNS = {
  greeting: /早|早安|早上好|上午好|下午好|晚上好|晚安|你好|在吗|嗨|hi|hello/i,
  tired: /累|疲惫|困|没精神|加班|辛苦/i,
  sad: /难过|伤心|哭|不开心|郁闷|烦|失败|倒霉/i,
  happy: /开心|高兴|快乐|棒|厉害|成功|好事/i,
  bored: /无聊|没事|闲|发呆/i,
  question: /怎么|什么|为什么|如何|吗|呢/i,
  praise: /真棒|厉害|可爱|喜欢你|爱你|谢谢/i,
  goodbye: /再见|拜拜|bye|走了|离开|下次/i,
}

// ========== 错误恢复 ==========

interface ErrorLog {
  timestamp: Date
  type: string
  message: string
  context: string
  recovered: boolean
}

// ========== 稳定性管理类 ==========

const STORAGE_KEYS = {
  STATE: 'xiaozhi-persisted-state',
  ERRORS: 'xiaozhi-error-logs',
  SETTINGS: 'xiaozhi-settings',
  OFFLINE_QUEUE: 'xiaozhi-offline-queue',
}

class StabilitySystem {
  private errorLogs: ErrorLog[] = []
  private offlineQueue: { action: string; data: object; timestamp: Date }[] = []
  private isOnline: boolean = true
  private retryCount: number = 0
  private maxRetries: number = 3

  constructor() {
    this.loadErrorLogs()
    this.loadOfflineQueue()
    this.setupNetworkMonitor()
    this.setupAutoSave()
  }

  private loadErrorLogs() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ERRORS)
      if (data) this.errorLogs = JSON.parse(data)
    } catch (e) {
      console.error('加载错误日志失败')
    }
  }

  private loadOfflineQueue() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE)
      if (data) this.offlineQueue = JSON.parse(data)
    } catch (e) {
      console.error('加载离线队列失败')
    }
  }

  private saveErrorLogs() {
    try {
      const recent = this.errorLogs.slice(-50)
      localStorage.setItem(STORAGE_KEYS.ERRORS, JSON.stringify(recent))
    } catch (e) {
      console.error('保存错误日志失败')
    }
  }

  private saveOfflineQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(this.offlineQueue))
    } catch (e) {
      console.error('保存离线队列失败')
    }
  }

  // 网络状态监控
  private setupNetworkMonitor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.processOfflineQueue()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
      })
      this.isOnline = navigator.onLine
    }
  }

  // 自动保存
  private setupAutoSave() {
    setInterval(() => {
      this.saveAllState()
    }, 5 * 60 * 1000)

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveAllState()
      })
    }
  }

  // 保存所有状态
  saveAllState(): void {
    try {
      const state: PersistedState = {
        version: '1.0.0',
        lastSaved: new Date(),
        emotion: JSON.parse(localStorage.getItem('xiaozhi-emotion-state') || '{}'),
        needs: JSON.parse(localStorage.getItem('xiaozhi-need-levels') || '{}'),
        personality: JSON.parse(localStorage.getItem('xiaozhi-personality') || '{}'),
        memory: JSON.parse(localStorage.getItem('xiaozhi-master-memory') || '{}'),
        affection: JSON.parse(localStorage.getItem('xiaozhi-affection') || '{}'),
        appearance: JSON.parse(localStorage.getItem('xiaozhi-appearance') || '{}'),
        entertainment: JSON.parse(localStorage.getItem('xiaozhi-entertainment') || '{}'),
        settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'),
      }
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state))
    } catch (e) {
      this.logError('save_state', '保存状态失败', 'saveAllState')
    }
  }

  // 恢复所有状态
  restoreState(): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STATE)
      if (!data) return false

      const state: PersistedState = JSON.parse(data)
      
      if (state.emotion) localStorage.setItem('xiaozhi-emotion-state', JSON.stringify(state.emotion))
      if (state.needs) localStorage.setItem('xiaozhi-need-levels', JSON.stringify(state.needs))
      if (state.personality) localStorage.setItem('xiaozhi-personality', JSON.stringify(state.personality))
      if (state.memory) localStorage.setItem('xiaozhi-master-memory', JSON.stringify(state.memory))
      if (state.affection) localStorage.setItem('xiaozhi-affection', JSON.stringify(state.affection))
      if (state.appearance) localStorage.setItem('xiaozhi-appearance', JSON.stringify(state.appearance))
      if (state.entertainment) localStorage.setItem('xiaozhi-entertainment', JSON.stringify(state.entertainment))
      if (state.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings))

      return true
    } catch (e) {
      this.logError('restore_state', '恢复状态失败', 'restoreState')
      return false
    }
  }

  // 记录错误
  logError(type: string, message: string, context: string): void {
    const error: ErrorLog = {
      timestamp: new Date(),
      type,
      message,
      context,
      recovered: false
    }
    this.errorLogs.push(error)
    this.saveErrorLogs()
    console.error(`[小智错误] ${type}: ${message}`)
  }

  // 错误恢复
  async attemptRecovery(errorType: string): Promise<boolean> {
    this.retryCount++
    
    if (this.retryCount > this.maxRetries) {
      this.retryCount = 0
      return false
    }

    switch (errorType) {
      case 'network':
        return this.isOnline
      case 'storage':
        try {
          localStorage.setItem('test', 'test')
          localStorage.removeItem('test')
          return true
        } catch {
          return false
        }
      case 'state':
        return this.restoreState()
      default:
        return false
    }
  }

  // 离线回复
  getOfflineResponse(input: string): string {
    const hour = new Date().getHours()
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    
    if (hour >= 5 && hour < 12) timeOfDay = 'morning'
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon'
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening'
    else timeOfDay = 'night'

    if (KEYWORD_PATTERNS.greeting.test(input)) {
      const greetings = OFFLINE_RESPONSES.greetings[timeOfDay]
      return greetings[Math.floor(Math.random() * greetings.length)]
    }

    if (KEYWORD_PATTERNS.sad.test(input)) {
      return OFFLINE_RESPONSES.comfort[Math.floor(Math.random() * OFFLINE_RESPONSES.comfort.length)]
    }

    if (KEYWORD_PATTERNS.tired.test(input)) {
      return OFFLINE_RESPONSES.encouragement[Math.floor(Math.random() * OFFLINE_RESPONSES.encouragement.length)]
    }

    if (KEYWORD_PATTERNS.happy.test(input)) {
      return '太好了！看到主人开心小智也好开心！✨'
    }

    if (KEYWORD_PATTERNS.praise.test(input)) {
      return '嘿嘿，主人这么说小智好害羞...但是好开心！💕'
    }

    if (KEYWORD_PATTERNS.bored.test(input)) {
      return OFFLINE_RESPONSES.playful[Math.floor(Math.random() * OFFLINE_RESPONSES.playful.length)]
    }

    if (KEYWORD_PATTERNS.goodbye.test(input)) {
      return OFFLINE_RESPONSES.goodbye[Math.floor(Math.random() * OFFLINE_RESPONSES.goodbye.length)]
    }

    if (KEYWORD_PATTERNS.question.test(input)) {
      return '唔...小智现在离线了，可能回答不了这个问题呢...但是小智会记住的，等联网了再告诉主人！'
    }

    const randomResponses = [
      ...OFFLINE_RESPONSES.playful,
      ...OFFLINE_RESPONSES.tips,
      ...OFFLINE_RESPONSES.questions,
    ]
    return randomResponses[Math.floor(Math.random() * randomResponses.length)]
  }

  // 添加到离线队列
  addToOfflineQueue(action: string, data: object): void {
    this.offlineQueue.push({
      action,
      data,
      timestamp: new Date()
    })
    this.saveOfflineQueue()
  }

  // 处理离线队列
  async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) return

    const queue = [...this.offlineQueue]
    this.offlineQueue = []
    this.saveOfflineQueue()

    for (const item of queue) {
      try {
        console.log(`处理离线操作: ${item.action}`)
      } catch (e) {
        this.offlineQueue.push(item)
      }
    }
    this.saveOfflineQueue()
  }

  // 获取网络状态
  getNetworkStatus(): boolean {
    return this.isOnline
  }

  // 获取错误统计
  getErrorStats(): { total: number; recent: number; types: Record<string, number> } {
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    
    const recentErrors = this.errorLogs.filter(e => new Date(e.timestamp).getTime() > dayAgo)
    const types: Record<string, number> = {}
    
    for (const error of this.errorLogs) {
      types[error.type] = (types[error.type] || 0) + 1
    }

    return {
      total: this.errorLogs.length,
      recent: recentErrors.length,
      types
    }
  }

  // 健康检查
  healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = []

    if (!this.isOnline) {
      issues.push('当前处于离线状态')
    }

    try {
      localStorage.setItem('health_check', 'ok')
      localStorage.removeItem('health_check')
    } catch {
      issues.push('本地存储不可用')
    }

    const recentErrors = this.errorLogs.filter(
      e => Date.now() - new Date(e.timestamp).getTime() < 60 * 60 * 1000
    )
    if (recentErrors.length > 10) {
      issues.push('最近一小时错误过多')
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }

  // 导出状态（备份）
  exportState(): string {
    this.saveAllState()
    const state = localStorage.getItem(STORAGE_KEYS.STATE)
    return state || '{}'
  }

  // 导入状态（恢复备份）
  importState(stateJson: string): boolean {
    try {
      const state = JSON.parse(stateJson)
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state))
      return this.restoreState()
    } catch {
      return false
    }
  }

  // 清除所有数据
  clearAllData(): void {
    const keys = [
      'xiaozhi-emotion-state',
      'xiaozhi-need-levels',
      'xiaozhi-personality',
      'xiaozhi-master-memory',
      'xiaozhi-affection',
      'xiaozhi-appearance',
      'xiaozhi-entertainment',
      STORAGE_KEYS.STATE,
      STORAGE_KEYS.ERRORS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.OFFLINE_QUEUE,
    ]
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  }
}

export const stabilitySystem = new StabilitySystem()
export { StabilitySystem, OFFLINE_RESPONSES, KEYWORD_PATTERNS }
