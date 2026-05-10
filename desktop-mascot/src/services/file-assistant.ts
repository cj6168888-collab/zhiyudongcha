interface FileInfo {
  name: string
  path: string
  size: number
  type: string
  modifiedTime: number
}

interface OrganizeResult {
  moved: number
  categories: Record<string, string[]>
}

const FILE_CATEGORIES: Record<string, string[]> = {
  '文档': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
  '图片': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
  '视频': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  '音乐': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  '压缩包': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  '代码': ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.json', '.xml'],
  '安装包': ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.apk'],
  '其他': [],
}

class FileAssistant {
  private electronAPI: typeof window.electronAPI | null = null

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  getFileCategory(filename: string): string {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    
    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
      if (extensions.includes(ext)) {
        return category
      }
    }
    
    return '其他'
  }

  async analyzeDesktop(): Promise<{
    totalFiles: number
    categories: Record<string, number>
    suggestions: string[]
  }> {
    const result = {
      totalFiles: 0,
      categories: {} as Record<string, number>,
      suggestions: [] as string[],
    }

    if (!this.electronAPI) {
      result.suggestions.push('需要在桌面应用中运行才能分析文件')
      return result
    }

    try {
      const files = await (this.electronAPI as any).listDesktopFiles?.()
      
      if (!files || files.length === 0) {
        result.suggestions.push('桌面很干净呢！继续保持~')
        return result
      }

      result.totalFiles = files.length

      for (const file of files) {
        const category = this.getFileCategory(file.name)
        result.categories[category] = (result.categories[category] || 0) + 1
      }

      if (result.totalFiles > 20) {
        result.suggestions.push(`桌面有${result.totalFiles}个文件，建议整理一下哦~`)
      }

      const docCount = result.categories['文档'] || 0
      if (docCount > 10) {
        result.suggestions.push(`发现${docCount}个文档，要帮你整理到文档文件夹吗？`)
      }

      const imageCount = result.categories['图片'] || 0
      if (imageCount > 5) {
        result.suggestions.push(`有${imageCount}张图片散落在桌面，整理一下会更整洁~`)
      }

    } catch (error) {
      console.error('分析桌面失败:', error)
      result.suggestions.push('分析桌面时遇到了问题')
    }

    return result
  }

  async organizeDesktop(): Promise<OrganizeResult> {
    const result: OrganizeResult = {
      moved: 0,
      categories: {},
    }

    if (!this.electronAPI) {
      console.error('需要在Electron环境中运行')
      return result
    }

    try {
      const organized = await (this.electronAPI as any).organizeDesktop?.()
      
      if (organized) {
        result.moved = organized.moved
        result.categories = organized.categories
      }
    } catch (error) {
      console.error('整理桌面失败:', error)
    }

    return result
  }

  async findDuplicates(directory?: string): Promise<{
    groups: { hash: string; files: FileInfo[] }[]
    totalDuplicates: number
    potentialSavings: number
  }> {
    const result = {
      groups: [] as { hash: string; files: FileInfo[] }[],
      totalDuplicates: 0,
      potentialSavings: 0,
    }

    if (!this.electronAPI) {
      return result
    }

    try {
      const duplicates = await (this.electronAPI as any).findDuplicates?.(directory)
      
      if (duplicates) {
        result.groups = duplicates.groups
        result.totalDuplicates = duplicates.totalDuplicates
        result.potentialSavings = duplicates.potentialSavings
      }
    } catch (error) {
      console.error('查找重复文件失败:', error)
    }

    return result
  }

  async findLargeFiles(minSizeMB = 100): Promise<FileInfo[]> {
    if (!this.electronAPI) {
      return []
    }

    try {
      const files = await (this.electronAPI as any).findLargeFiles?.(minSizeMB)
      return files || []
    } catch (error) {
      console.error('查找大文件失败:', error)
      return []
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
}

export const fileAssistant = new FileAssistant()
export default fileAssistant
