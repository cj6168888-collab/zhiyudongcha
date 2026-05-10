declare global {
  interface Window {
    electronAPI?: {
      scanDirectory?: (path: string, options?: any) => Promise<any[]>
      readFileContent?: (path: string, options?: any) => Promise<string>
      openFile?: (path: string) => Promise<void>
      showInFolder?: (path: string) => Promise<void>
    }
  }
}

interface IndexedFile {
  id: string
  fileName: string
  filePath: string
  fileExtension: string
  fileSize: number
  category: string
  contentPreview?: string
  aiTags?: string[]
  aiSummary?: string
  aiKeywords?: string[]
  fileModifiedAt?: Date
  lastIndexedAt?: Date
  indexStatus: 'PENDING' | 'INDEXED' | 'FAILED' | 'OUTDATED'
  accessCount?: number
  lastAccessedAt?: Date
}

interface IndexDirectory {
  id: string
  directoryPath: string
  directoryName: string
  isRecursive: boolean
  isEnabled: boolean
  excludePatterns?: string[]
  includeExtensions?: string[]
  totalFiles: number
  indexedFiles: number
  lastScanAt?: Date
}

interface SearchResult {
  file: IndexedFile
  matchScore: number
  matchType: 'filename' | 'content' | 'tags' | 'semantic'
  highlightedText?: string
}

interface IndexStats {
  totalDirectories: number
  totalFiles: number
  indexedFiles: number
  pendingFiles: number
  failedFiles: number
  totalSizeBytes: number
  lastScanAt?: Date
}

const FILE_CATEGORIES: Record<string, string[]> = {
  '文档': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx', '.md', '.csv'],
  '图片': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.psd'],
  '视频': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  '音乐': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  '压缩包': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  '代码': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.sh', '.sql', '.go', '.rs', '.swift', '.kt'],
  '安装包': ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.apk'],
}

const STORAGE_KEYS = {
  DIRECTORIES: 'xiaozhi-index-directories',
  FILES: 'xiaozhi-indexed-files',
  STATS: 'xiaozhi-index-stats',
}

class FileIndexer {
  private electronAPI: typeof window.electronAPI | null = null
  private directories: IndexDirectory[] = []
  private indexedFiles: IndexedFile[] = []
  private isIndexing = false
  private indexProgress = 0

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const dirs = localStorage.getItem(STORAGE_KEYS.DIRECTORIES)
      const files = localStorage.getItem(STORAGE_KEYS.FILES)

      if (dirs) this.directories = JSON.parse(dirs)
      if (files) this.indexedFiles = JSON.parse(files)
    } catch (error) {
      console.error('加载索引数据失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.DIRECTORIES, JSON.stringify(this.directories))
      localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(this.indexedFiles))
    } catch (error) {
      console.error('保存索引数据失败:', error)
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

  async addDirectory(directoryPath: string, options?: {
    isRecursive?: boolean
    excludePatterns?: string[]
    includeExtensions?: string[]
  }): Promise<IndexDirectory | null> {
    const existing = this.directories.find(d => d.directoryPath === directoryPath)
    if (existing) {
      console.log('目录已存在:', directoryPath)
      return existing
    }

    const dirName = directoryPath.split(/[/\\]/).pop() || directoryPath

    const newDir: IndexDirectory = {
      id: `dir_${Date.now()}`,
      directoryPath,
      directoryName: dirName,
      isRecursive: options?.isRecursive ?? true,
      isEnabled: true,
      excludePatterns: options?.excludePatterns || ['node_modules', '.git', '__pycache__', '.DS_Store'],
      includeExtensions: options?.includeExtensions,
      totalFiles: 0,
      indexedFiles: 0,
    }

    this.directories.push(newDir)
    this.saveToStorage()

    return newDir
  }

  async removeDirectory(directoryId: string): Promise<boolean> {
    const index = this.directories.findIndex(d => d.id === directoryId)
    if (index === -1) return false

    const dir = this.directories[index]
    this.indexedFiles = this.indexedFiles.filter(f => !f.filePath.startsWith(dir.directoryPath))
    this.directories.splice(index, 1)
    this.saveToStorage()

    return true
  }

  async scanDirectory(directoryId: string): Promise<number> {
    const dir = this.directories.find(d => d.id === directoryId)
    if (!dir) return 0

    if (!this.electronAPI) {
      console.error('需要在Electron环境中运行')
      return 0
    }

    try {
      this.isIndexing = true
      this.indexProgress = 0

      const files = await (this.electronAPI as any).scanDirectory?.(dir.directoryPath, {
        recursive: dir.isRecursive,
        excludePatterns: dir.excludePatterns,
        includeExtensions: dir.includeExtensions,
      })

      if (!files) return 0

      dir.totalFiles = files.length
      let indexed = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        this.indexProgress = Math.round((i / files.length) * 100)

        const existing = this.indexedFiles.find(f => f.filePath === file.path)
        
        if (existing) {
          if (existing.fileModifiedAt && file.modifiedTime > existing.fileModifiedAt.getTime()) {
            existing.indexStatus = 'OUTDATED'
          }
          indexed++
          continue
        }

        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
        const category = this.getFileCategory(file.name)

        const newFile: IndexedFile = {
          id: `file_${Date.now()}_${i}`,
          fileName: file.name,
          filePath: file.path,
          fileExtension: ext,
          fileSize: file.size,
          category,
          fileModifiedAt: new Date(file.modifiedTime),
          lastIndexedAt: new Date(),
          indexStatus: 'PENDING',
        }

        this.indexedFiles.push(newFile)
        indexed++
      }

      dir.indexedFiles = indexed
      dir.lastScanAt = new Date()
      
      this.saveToStorage()
      this.isIndexing = false
      this.indexProgress = 100

      return indexed
    } catch (error) {
      console.error('扫描目录失败:', error)
      this.isIndexing = false
      return 0
    }
  }

  async indexFileContent(fileId: string): Promise<boolean> {
    const file = this.indexedFiles.find(f => f.id === fileId)
    if (!file) return false

    if (!this.electronAPI) return false

    try {
      const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml', '.yaml', '.yml', '.sh', '.sql', '.csv']
      
      if (!textExts.includes(file.fileExtension)) {
        file.indexStatus = 'INDEXED'
        file.contentPreview = `[${file.category}文件，不支持内容预览]`
        this.saveToStorage()
        return true
      }

      const content = await (this.electronAPI as any).readFileContent?.(file.filePath, { maxSize: 50000 })
      
      if (content) {
        file.contentPreview = content.substring(0, 500)
        file.indexStatus = 'INDEXED'
        file.lastIndexedAt = new Date()

        const words = content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
        const wordFreq: Record<string, number> = {}
        words.forEach((w: string) => {
          wordFreq[w] = (wordFreq[w] || 0) + 1
        })
        
        file.aiKeywords = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word]) => word)
      } else {
        file.indexStatus = 'FAILED'
        file.contentPreview = '[无法读取文件内容]'
      }

      this.saveToStorage()
      return true
    } catch (error) {
      console.error('索引文件内容失败:', error)
      file.indexStatus = 'FAILED'
      this.saveToStorage()
      return false
    }
  }

  async indexAllPendingFiles(): Promise<number> {
    const pendingFiles = this.indexedFiles.filter(f => 
      f.indexStatus === 'PENDING' || f.indexStatus === 'OUTDATED'
    )

    let indexed = 0
    this.isIndexing = true

    for (let i = 0; i < pendingFiles.length; i++) {
      this.indexProgress = Math.round((i / pendingFiles.length) * 100)
      const success = await this.indexFileContent(pendingFiles[i].id)
      if (success) indexed++
    }

    this.isIndexing = false
    this.indexProgress = 100

    return indexed
  }

  search(query: string, options?: {
    category?: string
    searchType?: 'filename' | 'content' | 'all'
    limit?: number
  }): SearchResult[] {
    const results: SearchResult[] = []
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)
    const limit = options?.limit || 50
    const searchType = options?.searchType || 'all'

    for (const file of this.indexedFiles) {
      if (options?.category && file.category !== options.category) continue

      let maxScore = 0
      let matchType: SearchResult['matchType'] = 'filename'
      let highlightedText = ''

      if (searchType === 'filename' || searchType === 'all') {
        const filenameScore = this.calculateMatchScore(file.fileName.toLowerCase(), searchTerms)
        if (filenameScore > maxScore) {
          maxScore = filenameScore
          matchType = 'filename'
          highlightedText = file.fileName
        }
      }

      if ((searchType === 'content' || searchType === 'all') && file.contentPreview) {
        const contentScore = this.calculateMatchScore(file.contentPreview.toLowerCase(), searchTerms) * 0.8
        if (contentScore > maxScore) {
          maxScore = contentScore
          matchType = 'content'
          highlightedText = file.contentPreview.substring(0, 200)
        }
      }

      if (file.aiKeywords) {
        const keywordScore = this.calculateMatchScore(file.aiKeywords.join(' ').toLowerCase(), searchTerms) * 0.7
        if (keywordScore > maxScore) {
          maxScore = keywordScore
          matchType = 'tags'
          highlightedText = file.aiKeywords.join(', ')
        }
      }

      if (maxScore > 0) {
        results.push({
          file,
          matchScore: maxScore,
          matchType,
          highlightedText,
        })
      }
    }

    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
  }

  private calculateMatchScore(text: string, searchTerms: string[]): number {
    let score = 0
    let matchedTerms = 0

    for (const term of searchTerms) {
      if (text.includes(term)) {
        matchedTerms++
        if (text.startsWith(term)) score += 3
        else score += 1

        const occurrences = (text.match(new RegExp(term, 'g')) || []).length
        score += Math.min(occurrences * 0.5, 5)
      }
    }

    if (matchedTerms === 0) return 0
    return score * (matchedTerms / searchTerms.length)
  }

  async findSimilarFiles(fileId: string, limit = 10): Promise<IndexedFile[]> {
    const targetFile = this.indexedFiles.find(f => f.id === fileId)
    if (!targetFile) return []

    const similarFiles: { file: IndexedFile; score: number }[] = []

    for (const file of this.indexedFiles) {
      if (file.id === fileId) continue

      let score = 0

      if (file.category === targetFile.category) score += 2
      if (file.fileExtension === targetFile.fileExtension) score += 1

      if (targetFile.aiKeywords && file.aiKeywords) {
        const commonKeywords = targetFile.aiKeywords.filter(k => 
          file.aiKeywords?.includes(k)
        )
        score += commonKeywords.length * 0.5
      }

      const targetWords = targetFile.fileName.toLowerCase().split(/[-_.\s]/)
      const fileWords = file.fileName.toLowerCase().split(/[-_.\s]/)
      const commonWords = targetWords.filter(w => fileWords.includes(w) && w.length > 2)
      score += commonWords.length * 0.3

      if (score > 0) {
        similarFiles.push({ file, score })
      }
    }

    return similarFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.file)
  }

  getStats(): IndexStats {
    const stats: IndexStats = {
      totalDirectories: this.directories.filter(d => d.isEnabled).length,
      totalFiles: this.indexedFiles.length,
      indexedFiles: this.indexedFiles.filter(f => f.indexStatus === 'INDEXED').length,
      pendingFiles: this.indexedFiles.filter(f => f.indexStatus === 'PENDING' || f.indexStatus === 'OUTDATED').length,
      failedFiles: this.indexedFiles.filter(f => f.indexStatus === 'FAILED').length,
      totalSizeBytes: this.indexedFiles.reduce((sum, f) => sum + f.fileSize, 0),
    }

    const lastScans = this.directories
      .filter(d => d.lastScanAt)
      .map(d => new Date(d.lastScanAt!).getTime())
    
    if (lastScans.length > 0) {
      stats.lastScanAt = new Date(Math.max(...lastScans))
    }

    return stats
  }

  getDirectories(): IndexDirectory[] {
    return [...this.directories]
  }

  getFiles(options?: {
    category?: string
    status?: IndexedFile['indexStatus']
    limit?: number
    offset?: number
  }): IndexedFile[] {
    let files = [...this.indexedFiles]

    if (options?.category) {
      files = files.filter(f => f.category === options.category)
    }

    if (options?.status) {
      files = files.filter(f => f.indexStatus === options.status)
    }

    const offset = options?.offset || 0
    const limit = options?.limit || 100

    return files.slice(offset, offset + limit)
  }

  getFilesByCategory(): Record<string, number> {
    const counts: Record<string, number> = {}
    
    for (const file of this.indexedFiles) {
      counts[file.category] = (counts[file.category] || 0) + 1
    }
    
    return counts
  }

  async openFile(fileId: string): Promise<boolean> {
    const file = this.indexedFiles.find(f => f.id === fileId)
    if (!file || !this.electronAPI) return false

    try {
      await (this.electronAPI as any).openFile?.(file.filePath)
      
      file.accessCount = (file.accessCount || 0) + 1
      file.lastAccessedAt = new Date()
      this.saveToStorage()
      
      return true
    } catch (error) {
      console.error('打开文件失败:', error)
      return false
    }
  }

  async revealInExplorer(fileId: string): Promise<boolean> {
    const file = this.indexedFiles.find(f => f.id === fileId)
    if (!file || !this.electronAPI) return false

    try {
      await (this.electronAPI as any).showInFolder?.(file.filePath)
      return true
    } catch (error) {
      console.error('在文件管理器中显示失败:', error)
      return false
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

  getIndexProgress(): { isIndexing: boolean; progress: number } {
    return {
      isIndexing: this.isIndexing,
      progress: this.indexProgress,
    }
  }

  async quickSearch(query: string): Promise<string> {
    const results = this.search(query, { limit: 5 })
    
    if (results.length === 0) {
      return `没有找到与"${query}"相关的文件。`
    }

    let response = `找到 ${results.length} 个相关文件：\n\n`
    
    for (const result of results) {
      response += `📄 ${result.file.fileName}\n`
      response += `   📁 ${result.file.filePath}\n`
      response += `   🏷️ ${result.file.category} | ${this.formatSize(result.file.fileSize)}\n\n`
    }

    return response
  }

  async getKnowledgeAbout(topic: string): Promise<string> {
    const results = this.search(topic, { searchType: 'all', limit: 10 })
    
    if (results.length === 0) {
      return `主人，我还没有关于"${topic}"的知识呢。要不要添加一些相关文件让我学习？`
    }

    let knowledge = `关于"${topic}"，我在您的文件中找到了以下信息：\n\n`
    
    for (const result of results.slice(0, 5)) {
      if (result.file.contentPreview) {
        knowledge += `📄 **${result.file.fileName}**\n`
        knowledge += `${result.file.contentPreview.substring(0, 200)}...\n\n`
      }
    }

    knowledge += `\n共找到 ${results.length} 个相关文件，需要我详细介绍哪个吗？`
    
    return knowledge
  }
}

export const fileIndexer = new FileIndexer()
export default fileIndexer
