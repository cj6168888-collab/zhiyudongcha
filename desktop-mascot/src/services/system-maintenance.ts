interface SystemInfo {
  platform: string
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  uptime: number
}

interface CleanupResult {
  freedSpace: number
  itemsCleaned: number
  details: string[]
}

interface SystemHealth {
  score: number
  issues: string[]
  suggestions: string[]
}

class SystemMaintenance {
  private electronAPI: typeof window.electronAPI | null = null

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  async getSystemInfo(): Promise<SystemInfo | null> {
    if (!this.electronAPI) {
      return null
    }

    try {
      const info = await (this.electronAPI as any).getSystemInfo?.()
      return info
    } catch (error) {
      console.error('获取系统信息失败:', error)
      return null
    }
  }

  async cleanTempFiles(): Promise<CleanupResult> {
    const result: CleanupResult = {
      freedSpace: 0,
      itemsCleaned: 0,
      details: [],
    }

    if (!this.electronAPI) {
      result.details.push('需要在桌面应用中运行')
      return result
    }

    try {
      const cleanup = await (this.electronAPI as any).cleanTempFiles?.()
      
      if (cleanup) {
        result.freedSpace = cleanup.freedSpace
        result.itemsCleaned = cleanup.itemsCleaned
        result.details = cleanup.details
      }
    } catch (error) {
      console.error('清理临时文件失败:', error)
      result.details.push('清理过程中遇到错误')
    }

    return result
  }

  async cleanBrowserCache(): Promise<CleanupResult> {
    const result: CleanupResult = {
      freedSpace: 0,
      itemsCleaned: 0,
      details: [],
    }

    if (!this.electronAPI) {
      return result
    }

    try {
      const cleanup = await (this.electronAPI as any).cleanBrowserCache?.()
      
      if (cleanup) {
        result.freedSpace = cleanup.freedSpace
        result.itemsCleaned = cleanup.itemsCleaned
        result.details = cleanup.details
      }
    } catch (error) {
      console.error('清理浏览器缓存失败:', error)
    }

    return result
  }

  async emptyRecycleBin(): Promise<CleanupResult> {
    const result: CleanupResult = {
      freedSpace: 0,
      itemsCleaned: 0,
      details: [],
    }

    if (!this.electronAPI) {
      return result
    }

    try {
      const cleanup = await (this.electronAPI as any).emptyRecycleBin?.()
      
      if (cleanup) {
        result.freedSpace = cleanup.freedSpace
        result.itemsCleaned = cleanup.itemsCleaned
        result.details = cleanup.details
      }
    } catch (error) {
      console.error('清空回收站失败:', error)
    }

    return result
  }

  async checkHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      score: 100,
      issues: [],
      suggestions: [],
    }

    const info = await this.getSystemInfo()
    
    if (!info) {
      health.score = 0
      health.issues.push('无法获取系统信息')
      return health
    }

    if (info.cpuUsage > 80) {
      health.score -= 20
      health.issues.push(`CPU使用率过高: ${info.cpuUsage.toFixed(1)}%`)
      health.suggestions.push('建议关闭一些不必要的程序')
    } else if (info.cpuUsage > 60) {
      health.score -= 10
      health.suggestions.push('CPU使用率较高，注意不要运行太多程序')
    }

    if (info.memoryUsage > 85) {
      health.score -= 20
      health.issues.push(`内存使用率过高: ${info.memoryUsage.toFixed(1)}%`)
      health.suggestions.push('建议关闭一些占用内存大的程序，或者考虑升级内存')
    } else if (info.memoryUsage > 70) {
      health.score -= 10
      health.suggestions.push('内存使用率较高')
    }

    if (info.diskUsage > 90) {
      health.score -= 25
      health.issues.push(`磁盘空间不足: 已使用${info.diskUsage.toFixed(1)}%`)
      health.suggestions.push('建议清理磁盘空间，删除不需要的文件')
    } else if (info.diskUsage > 80) {
      health.score -= 10
      health.suggestions.push('磁盘空间开始紧张，建议定期清理')
    }

    if (info.uptime > 7 * 24 * 60 * 60) {
      health.score -= 5
      health.suggestions.push('电脑已经运行超过7天了，建议重启一下')
    }

    if (health.score === 100) {
      health.suggestions.push('系统状态良好！继续保持~')
    }

    return health
  }

  async performQuickCleanup(): Promise<{
    total: CleanupResult
    breakdown: {
      temp: CleanupResult
      browser: CleanupResult
      recycle: CleanupResult
    }
  }> {
    const [temp, browser, recycle] = await Promise.all([
      this.cleanTempFiles(),
      this.cleanBrowserCache(),
      this.emptyRecycleBin(),
    ])

    const total: CleanupResult = {
      freedSpace: temp.freedSpace + browser.freedSpace + recycle.freedSpace,
      itemsCleaned: temp.itemsCleaned + browser.itemsCleaned + recycle.itemsCleaned,
      details: [...temp.details, ...browser.details, ...recycle.details],
    }

    return {
      total,
      breakdown: { temp, browser, recycle },
    }
  }

  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)

    return parts.join('') || '刚刚启动'
  }
}

export const systemMaintenance = new SystemMaintenance()
export default systemMaintenance
