interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

interface ResearchNote {
  id: string
  title: string
  content: string
  sources: string[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface KnowledgeEntry {
  id: string
  topic: string
  content: string
  relatedTopics: string[]
  sources: string[]
  createdAt: Date
}

const STORAGE_KEYS = {
  NOTES: 'xiaozhi-research-notes',
  KNOWLEDGE: 'xiaozhi-knowledge-base',
}

class ResearchAssistant {
  private electronAPI: typeof window.electronAPI | null = null
  private notes: ResearchNote[] = []
  private knowledgeBase: KnowledgeEntry[] = []

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const notes = localStorage.getItem(STORAGE_KEYS.NOTES)
      const knowledge = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE)

      if (notes) this.notes = JSON.parse(notes)
      if (knowledge) this.knowledgeBase = JSON.parse(knowledge)
    } catch (error) {
      console.error('加载研究数据失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(this.notes))
      localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(this.knowledgeBase))
    } catch (error) {
      console.error('保存研究数据失败:', error)
    }
  }

  async webSearch(query: string, maxResults = 10): Promise<SearchResult[]> {
    if (!this.electronAPI) {
      return []
    }

    try {
      const results = await (this.electronAPI as any).webSearch?.(query, maxResults)
      return results || []
    } catch (error) {
      console.error('网络搜索失败:', error)
      return []
    }
  }

  async fetchWebPage(url: string): Promise<{ title: string; content: string } | null> {
    if (!this.electronAPI) return null

    try {
      const page = await (this.electronAPI as any).fetchWebPage?.(url)
      return page
    } catch (error) {
      console.error('获取网页失败:', error)
      return null
    }
  }

  async summarizeWebPage(url: string): Promise<string> {
    const page = await this.fetchWebPage(url)
    if (!page) return '无法获取网页内容'

    if (!this.electronAPI) return page.content.substring(0, 500)

    try {
      const summary = await (this.electronAPI as any).aiSummarize?.(page.content, 300)
      return summary || page.content.substring(0, 500)
    } catch (error) {
      return page.content.substring(0, 500)
    }
  }

  async researchTopic(topic: string): Promise<{
    summary: string
    sources: SearchResult[]
    keyPoints: string[]
  }> {
    const results = await this.webSearch(topic, 5)
    
    let combinedContent = ''
    const sources: SearchResult[] = []

    for (const result of results) {
      const page = await this.fetchWebPage(result.url)
      if (page) {
        combinedContent += page.content.substring(0, 2000) + '\n\n'
        sources.push(result)
      }
    }

    let summary = combinedContent.substring(0, 1000)
    let keyPoints: string[] = []

    if (this.electronAPI) {
      try {
        summary = await (this.electronAPI as any).aiSummarize?.(combinedContent, 500) || summary
        keyPoints = await (this.electronAPI as any).aiExtractKeyPoints?.(combinedContent) || []
      } catch (error) {
        console.error('AI处理失败:', error)
      }
    }

    return { summary, sources, keyPoints }
  }

  createNote(note: Omit<ResearchNote, 'id' | 'createdAt' | 'updatedAt'>): ResearchNote {
    const newNote: ResearchNote = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.notes.push(newNote)
    this.saveToStorage()

    return newNote
  }

  updateNote(id: string, updates: Partial<ResearchNote>): boolean {
    const note = this.notes.find(n => n.id === id)
    if (!note) return false

    Object.assign(note, updates, { updatedAt: new Date() })
    this.saveToStorage()

    return true
  }

  deleteNote(id: string): boolean {
    const index = this.notes.findIndex(n => n.id === id)
    if (index === -1) return false

    this.notes.splice(index, 1)
    this.saveToStorage()

    return true
  }

  getNotes(filter?: { tag?: string; search?: string }): ResearchNote[] {
    let result = [...this.notes]

    if (filter?.tag) {
      result = result.filter(n => n.tags.includes(filter.tag!))
    }

    if (filter?.search) {
      const query = filter.search.toLowerCase()
      result = result.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
      )
    }

    return result.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  addToKnowledgeBase(entry: Omit<KnowledgeEntry, 'id' | 'createdAt'>): KnowledgeEntry {
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: `kb-${Date.now()}`,
      createdAt: new Date(),
    }

    this.knowledgeBase.push(newEntry)
    this.saveToStorage()

    return newEntry
  }

  searchKnowledge(query: string): KnowledgeEntry[] {
    const lowerQuery = query.toLowerCase()
    
    return this.knowledgeBase.filter(entry =>
      entry.topic.toLowerCase().includes(lowerQuery) ||
      entry.content.toLowerCase().includes(lowerQuery) ||
      entry.relatedTopics.some(t => t.toLowerCase().includes(lowerQuery))
    )
  }

  async generateReport(topic: string, sections: string[]): Promise<string> {
    const research = await this.researchTopic(topic)
    
    let report = `# ${topic}\n\n`
    report += `## 摘要\n${research.summary}\n\n`
    
    if (research.keyPoints.length > 0) {
      report += `## 要点\n`
      research.keyPoints.forEach(point => {
        report += `- ${point}\n`
      })
      report += '\n'
    }

    for (const section of sections) {
      const sectionResearch = await this.researchTopic(`${topic} ${section}`)
      report += `## ${section}\n${sectionResearch.summary}\n\n`
    }

    report += `## 参考来源\n`
    research.sources.forEach((source, i) => {
      report += `${i + 1}. [${source.title}](${source.url})\n`
    })

    return report
  }

  async clipWebContent(url: string, selection?: string): Promise<ResearchNote | null> {
    const page = await this.fetchWebPage(url)
    if (!page) return null

    const content = selection || page.content.substring(0, 2000)

    const note = this.createNote({
      title: page.title,
      content,
      sources: [url],
      tags: ['网页剪藏'],
    })

    return note
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>()
    
    for (const note of this.notes) {
      note.tags.forEach(tag => tagSet.add(tag))
    }

    return Array.from(tagSet).sort()
  }

  exportNotes(format: 'markdown' | 'json' = 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(this.notes, null, 2)
    }

    let markdown = '# 研究笔记\n\n'
    
    for (const note of this.notes) {
      markdown += `## ${note.title}\n\n`
      markdown += `${note.content}\n\n`
      if (note.sources.length > 0) {
        markdown += `**来源**: ${note.sources.join(', ')}\n\n`
      }
      if (note.tags.length > 0) {
        markdown += `**标签**: ${note.tags.join(', ')}\n\n`
      }
      markdown += `---\n\n`
    }

    return markdown
  }
}

export const researchAssistant = new ResearchAssistant()
export default researchAssistant
