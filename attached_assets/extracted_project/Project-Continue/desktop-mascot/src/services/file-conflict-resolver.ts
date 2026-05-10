interface FileInfo {
  id: string
  fileName: string
  filePath: string
  contentHash?: string
  fileSize: number
  ownerAvatarId?: string
  visibilityScope?: 'PERSONAL' | 'TEAM_SHARED' | 'EXECUTIVE_ONLY'
}

interface ConflictInfo {
  id: string
  type: 'SAME_NAME_DIFF_CONTENT' | 'SAME_CONTENT_DIFF_NAME' | 'SIMILAR_CONTENT' | 'VERSION_DIVERGE'
  fileA: FileInfo
  fileB: FileInfo
  similarityScore: number
  status: 'PENDING' | 'AUTO_RESOLVED' | 'MANUAL_RESOLVED' | 'IGNORED'
  aiRecommendation?: string
  resolution?: 'KEEP_A' | 'KEEP_B' | 'KEEP_BOTH' | 'MERGE' | 'RENAME'
}

interface ConflictResolutionResult {
  success: boolean
  action: string
  message: string
}

const STORAGE_KEY = 'xiaozhi-file-conflicts'

class FileConflictResolver {
  private conflicts: ConflictInfo[] = []

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) this.conflicts = JSON.parse(data)
    } catch (e) {
      console.error('加载冲突数据失败:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conflicts))
    } catch (e) {
      console.error('保存冲突数据失败:', e)
    }
  }

  simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  calculateSimilarity(textA: string, textB: string): number {
    if (textA === textB) return 1.0
    if (!textA || !textB) return 0

    const wordsA = new Set(textA.toLowerCase().split(/\s+/))
    const wordsB = new Set(textB.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])
    
    return intersection.size / union.size
  }

  detectConflict(fileA: FileInfo, fileB: FileInfo, contentA?: string, contentB?: string): ConflictInfo | null {
    if (fileA.id === fileB.id) return null

    const sameHash = fileA.contentHash && fileB.contentHash && fileA.contentHash === fileB.contentHash
    const sameName = fileA.fileName.toLowerCase() === fileB.fileName.toLowerCase()
    
    let conflictType: ConflictInfo['type'] | null = null
    let similarityScore = 0

    if (sameName && !sameHash) {
      conflictType = 'SAME_NAME_DIFF_CONTENT'
      similarityScore = contentA && contentB ? this.calculateSimilarity(contentA, contentB) : 0
    } else if (!sameName && sameHash) {
      conflictType = 'SAME_CONTENT_DIFF_NAME'
      similarityScore = 1.0
    } else if (contentA && contentB) {
      similarityScore = this.calculateSimilarity(contentA, contentB)
      if (similarityScore > 0.7 && similarityScore < 1.0) {
        conflictType = 'SIMILAR_CONTENT'
      }
    }

    if (!conflictType) return null

    const conflict: ConflictInfo = {
      id: `conflict_${Date.now()}`,
      type: conflictType,
      fileA,
      fileB,
      similarityScore,
      status: 'PENDING',
      aiRecommendation: this.generateRecommendation(conflictType, fileA, fileB, similarityScore),
    }

    this.conflicts.push(conflict)
    this.saveToStorage()

    return conflict
  }

  private generateRecommendation(
    type: ConflictInfo['type'],
    fileA: FileInfo,
    fileB: FileInfo,
    similarity: number
  ): string {
    switch (type) {
      case 'SAME_NAME_DIFF_CONTENT':
        if (similarity > 0.9) {
          return '文件内容非常相似，建议保留较新的版本'
        }
        return '同名文件内容不同，建议重命名其中一个或保留两者'

      case 'SAME_CONTENT_DIFF_NAME':
        return '文件内容完全相同，建议删除重复文件，保留一个即可'

      case 'SIMILAR_CONTENT':
        return `文件相似度${(similarity * 100).toFixed(0)}%，可能是不同版本，建议对比后决定`

      case 'VERSION_DIVERGE':
        return '文件版本分叉，建议合并或选择一个版本'

      default:
        return '需要人工判断如何处理此冲突'
    }
  }

  async resolveConflict(conflictId: string, resolution: ConflictInfo['resolution']): Promise<ConflictResolutionResult> {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (!conflict) {
      return { success: false, action: 'none', message: '未找到冲突记录' }
    }

    conflict.resolution = resolution
    conflict.status = 'MANUAL_RESOLVED'

    let action = ''
    let message = ''

    switch (resolution) {
      case 'KEEP_A':
        action = 'keep_file_a'
        message = `保留 ${conflict.fileA.fileName}，可删除 ${conflict.fileB.fileName}`
        break

      case 'KEEP_B':
        action = 'keep_file_b'
        message = `保留 ${conflict.fileB.fileName}，可删除 ${conflict.fileA.fileName}`
        break

      case 'KEEP_BOTH':
        action = 'keep_both'
        message = '保留两个文件'
        break

      case 'MERGE':
        action = 'merge'
        message = '已标记为需要合并，请手动合并内容'
        break

      case 'RENAME':
        const newName = `${conflict.fileB.fileName.replace(/(\.[^.]+)$/, '_副本$1')}`
        action = 'rename'
        message = `建议将 ${conflict.fileB.fileName} 重命名为 ${newName}`
        break
    }

    this.saveToStorage()

    return { success: true, action, message }
  }

  autoResolve(conflictId: string): ConflictResolutionResult {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (!conflict) {
      return { success: false, action: 'none', message: '未找到冲突记录' }
    }

    let resolution: ConflictInfo['resolution'] = 'KEEP_BOTH'

    switch (conflict.type) {
      case 'SAME_CONTENT_DIFF_NAME':
        resolution = 'KEEP_A'
        break

      case 'SAME_NAME_DIFF_CONTENT':
        if (conflict.similarityScore > 0.95) {
          resolution = 'KEEP_A'
        } else {
          resolution = 'RENAME'
        }
        break

      case 'SIMILAR_CONTENT':
        resolution = 'KEEP_BOTH'
        break
    }

    conflict.resolution = resolution
    conflict.status = 'AUTO_RESOLVED'
    this.saveToStorage()

    return {
      success: true,
      action: `auto_${resolution.toLowerCase()}`,
      message: `自动解决：${this.generateRecommendation(conflict.type, conflict.fileA, conflict.fileB, conflict.similarityScore)}`,
    }
  }

  getPendingConflicts(): ConflictInfo[] {
    return this.conflicts.filter(c => c.status === 'PENDING')
  }

  getAllConflicts(): ConflictInfo[] {
    return [...this.conflicts]
  }

  ignoreConflict(conflictId: string): boolean {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (conflict) {
      conflict.status = 'IGNORED'
      this.saveToStorage()
      return true
    }
    return false
  }

  clearResolved(): number {
    const before = this.conflicts.length
    this.conflicts = this.conflicts.filter(c => c.status === 'PENDING')
    this.saveToStorage()
    return before - this.conflicts.length
  }

  getConflictSummary(): string {
    const pending = this.getPendingConflicts()
    if (pending.length === 0) {
      return '✅ 没有文件冲突需要处理'
    }

    let summary = `⚠️ 发现 ${pending.length} 个文件冲突：\n\n`
    
    for (const c of pending.slice(0, 5)) {
      summary += `• ${c.fileA.fileName} ↔ ${c.fileB.fileName}\n`
      summary += `  类型: ${this.getConflictTypeName(c.type)}\n`
      summary += `  建议: ${c.aiRecommendation}\n\n`
    }

    if (pending.length > 5) {
      summary += `还有 ${pending.length - 5} 个冲突...\n`
    }

    return summary
  }

  private getConflictTypeName(type: ConflictInfo['type']): string {
    const names: Record<ConflictInfo['type'], string> = {
      'SAME_NAME_DIFF_CONTENT': '同名不同内容',
      'SAME_CONTENT_DIFF_NAME': '同内容不同名',
      'SIMILAR_CONTENT': '内容相似',
      'VERSION_DIVERGE': '版本分叉',
    }
    return names[type] || type
  }
}

export const fileConflictResolver = new FileConflictResolver()
export default fileConflictResolver
