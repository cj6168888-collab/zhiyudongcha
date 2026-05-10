interface KnowledgeFragment {
  id: string
  topic: string
  keyPoints: string[]
  source: string
  sourceType: 'document' | 'email' | 'meeting' | 'web' | 'chat'
  importance: number
  confidence: number
  tags: string[]
  createdAt: Date
}

interface RiskAlert {
  id: string
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: 'LEGAL' | 'FINANCIAL' | 'REPUTATION' | 'SECURITY' | 'COMPLIANCE'
  title: string
  description: string
  source: string
  detectedAt: Date
  reportedToMaster: boolean
  aiAnalysis: string
}

interface OpportunityInsight {
  id: string
  type: 'BUSINESS' | 'INNOVATION' | 'COST_SAVING' | 'PARTNERSHIP' | 'TREND'
  title: string
  description: string
  potentialValue: string
  source: string
  confidence: number
  learnedAt: Date
  absorbed: boolean
}

interface DataQualityReport {
  totalFiles: number
  textFilesOnly: number
  skippedLargeFiles: number
  verifiedData: number
  suspiciousData: number
  duplicateData: number
}

interface DreamSession {
  id: string
  startTime: Date
  endTime?: Date
  status: 'SLEEPING' | 'DREAMING' | 'AWAKE'
  tasksCompleted: string[]
  knowledgeDistilled: number
  risksDetected: number
  opportunitiesFound: number
  dataQuality: DataQualityReport
}

const STORAGE_KEYS = {
  KNOWLEDGE: 'xiaozhi-dream-knowledge',
  ALERTS: 'xiaozhi-dream-alerts',
  OPPORTUNITIES: 'xiaozhi-dream-opportunities',
  SESSIONS: 'xiaozhi-dream-sessions',
}

const SKIP_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.mp4', '.avi', '.mkv', '.mov', '.mp3', '.wav', '.flac', '.zip', '.rar', '.7z', '.exe', '.dll', '.iso']

const SENSITIVE_KEYWORDS = {
  LEGAL: ['诉讼', '违法', '法律', '起诉', '侵权', '合规', '违规', '处罚', '罚款'],
  FINANCIAL: ['亏损', '债务', '欠款', '破产', '资金链', '现金流', '坏账'],
  REPUTATION: ['丑闻', '曝光', '投诉', '差评', '举报', '泄露', '负面'],
  SECURITY: ['密码', '泄密', '攻击', '漏洞', '入侵', '黑客', '病毒'],
  COMPLIANCE: ['审计', '检查', '整改', '不合格', '违反'],
}

const OPPORTUNITY_KEYWORDS = {
  BUSINESS: ['商机', '合作', '订单', '客户', '需求', '项目', '投标'],
  INNOVATION: ['创新', '发明', '专利', '技术', '突破', '研发'],
  COST_SAVING: ['节约', '优化', '效率', '成本', '降低', '节省'],
  PARTNERSHIP: ['合资', '联盟', '战略', '伙伴', '协议'],
  TREND: ['趋势', '风口', '机遇', '增长', '市场'],
}

class DreamProcessor {
  private knowledge: KnowledgeFragment[] = []
  private alerts: RiskAlert[] = []
  private opportunities: OpportunityInsight[] = []
  private sessions: DreamSession[] = []
  private currentSession: DreamSession | null = null
  private _isProcessing = false

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const k = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE)
      const a = localStorage.getItem(STORAGE_KEYS.ALERTS)
      const o = localStorage.getItem(STORAGE_KEYS.OPPORTUNITIES)
      const s = localStorage.getItem(STORAGE_KEYS.SESSIONS)

      if (k) this.knowledge = JSON.parse(k)
      if (a) this.alerts = JSON.parse(a)
      if (o) this.opportunities = JSON.parse(o)
      if (s) this.sessions = JSON.parse(s)
    } catch (e) {
      console.error('加载梦境数据失败:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(this.knowledge))
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(this.alerts))
      localStorage.setItem(STORAGE_KEYS.OPPORTUNITIES, JSON.stringify(this.opportunities))
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions))
    } catch (e) {
      console.error('保存梦境数据失败:', e)
    }
  }

  shouldSkipFile(fileName: string, fileSize: number): boolean {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (SKIP_EXTENSIONS.includes(ext)) return true
    if (fileSize > 10 * 1024 * 1024) return true
    return false
  }

  async startDreamSession(): Promise<DreamSession> {
    if (this.currentSession) {
      return this.currentSession
    }

    this.currentSession = {
      id: `dream_${Date.now()}`,
      startTime: new Date(),
      status: 'SLEEPING',
      tasksCompleted: [],
      knowledgeDistilled: 0,
      risksDetected: 0,
      opportunitiesFound: 0,
      dataQuality: {
        totalFiles: 0,
        textFilesOnly: 0,
        skippedLargeFiles: 0,
        verifiedData: 0,
        suspiciousData: 0,
        duplicateData: 0,
      },
    }

    this.sessions.push(this.currentSession)
    this.saveToStorage()

    console.log('🌙 小智进入梦境...')
    return this.currentSession
  }

  async endDreamSession(): Promise<DreamSession | null> {
    if (!this.currentSession) return null

    this.currentSession.endTime = new Date()
    this.currentSession.status = 'AWAKE'
    this.saveToStorage()

    const session = this.currentSession
    this.currentSession = null

    console.log('☀️ 小智从梦境中醒来')
    return session
  }

  distillKnowledge(content: string, source: string, sourceType: KnowledgeFragment['sourceType']): KnowledgeFragment | null {
    if (!content || content.length < 50) return null

    const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 10)
    if (sentences.length === 0) return null

    const keyPoints = this.extractKeyPoints(sentences)
    if (keyPoints.length === 0) return null

    const topic = this.inferTopic(keyPoints)
    const tags = this.extractTags(content)
    const importance = this.calculateImportance(content, keyPoints)

    const fragment: KnowledgeFragment = {
      id: `kf_${Date.now()}`,
      topic,
      keyPoints,
      source,
      sourceType,
      importance,
      confidence: 0.8,
      tags,
      createdAt: new Date(),
    }

    const duplicate = this.knowledge.find(k => 
      k.topic === topic && 
      k.keyPoints.some(kp => keyPoints.includes(kp))
    )

    if (!duplicate) {
      this.knowledge.push(fragment)
      if (this.currentSession) {
        this.currentSession.knowledgeDistilled++
      }
      this.saveToStorage()
      return fragment
    }

    return null
  }

  private extractKeyPoints(sentences: string[]): string[] {
    const scored = sentences.map(s => ({
      text: s.trim(),
      score: this.scoreSentence(s),
    }))

    return scored
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.text)
  }

  private scoreSentence(sentence: string): number {
    let score = 0

    if (sentence.includes('重要') || sentence.includes('关键')) score += 0.3
    if (sentence.includes('必须') || sentence.includes('应该')) score += 0.2
    if (sentence.includes('结论') || sentence.includes('总结')) score += 0.3
    if (/\d+%/.test(sentence) || /\d+万/.test(sentence)) score += 0.2
    if (sentence.length > 20 && sentence.length < 100) score += 0.2

    const fluffWords = ['的话', '其实', '然后', '就是说', '嗯', '那个']
    if (fluffWords.some(w => sentence.includes(w))) score -= 0.2

    return Math.max(0, Math.min(1, score))
  }

  private inferTopic(keyPoints: string[]): string {
    const words: Record<string, number> = {}
    
    for (const point of keyPoints) {
      const w = point.split(/[\s,，。、]/).filter(w => w.length >= 2)
      w.forEach(word => {
        words[word] = (words[word] || 0) + 1
      })
    }

    const sorted = Object.entries(words).sort((a, b) => b[1] - a[1])
    return sorted.slice(0, 3).map(([w]) => w).join(' - ') || '未分类'
  }

  private extractTags(content: string): string[] {
    const tags: string[] = []
    
    for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
      if (keywords.some(k => content.includes(k))) {
        tags.push(category)
      }
    }

    for (const [category, keywords] of Object.entries(OPPORTUNITY_KEYWORDS)) {
      if (keywords.some(k => content.includes(k))) {
        tags.push(`机会:${category}`)
      }
    }

    return [...new Set(tags)]
  }

  private calculateImportance(content: string, keyPoints: string[]): number {
    let importance = 0.5

    if (keyPoints.length >= 3) importance += 0.1
    if (content.length > 500) importance += 0.1
    
    for (const keywords of Object.values(SENSITIVE_KEYWORDS)) {
      if (keywords.some(k => content.includes(k))) {
        importance += 0.15
        break
      }
    }

    for (const keywords of Object.values(OPPORTUNITY_KEYWORDS)) {
      if (keywords.some(k => content.includes(k))) {
        importance += 0.1
        break
      }
    }

    return Math.min(1, importance)
  }

  detectRisks(content: string, source: string): RiskAlert | null {
    let detectedCategory: RiskAlert['category'] | null = null
    let matchedKeywords: string[] = []

    for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
      const matches = keywords.filter(k => content.includes(k))
      if (matches.length > 0) {
        detectedCategory = category as RiskAlert['category']
        matchedKeywords = matches
        break
      }
    }

    if (!detectedCategory) return null

    const level = this.assessRiskLevel(content, matchedKeywords)

    const alert: RiskAlert = {
      id: `risk_${Date.now()}`,
      level,
      category: detectedCategory,
      title: `检测到${detectedCategory}相关风险`,
      description: `在 ${source} 中发现关键词: ${matchedKeywords.join(', ')}`,
      source,
      detectedAt: new Date(),
      reportedToMaster: false,
      aiAnalysis: this.generateRiskAnalysis(content, detectedCategory, matchedKeywords),
    }

    this.alerts.push(alert)
    if (this.currentSession) {
      this.currentSession.risksDetected++
    }
    this.saveToStorage()

    console.log(`⚠️ 风险预警: ${alert.title}`)
    return alert
  }

  private assessRiskLevel(_content: string, keywords: string[]): RiskAlert['level'] {
    if (keywords.length >= 3) return 'CRITICAL'
    if (keywords.length >= 2) return 'HIGH'
    
    const urgentWords = ['紧急', '立即', '马上', '严重']
    if (urgentWords.some(w => content.includes(w))) return 'HIGH'

    return keywords.length > 0 ? 'MEDIUM' : 'LOW'
  }

  private generateRiskAnalysis(content: string, category: string, keywords: string[]): string {
    const analyses: Record<string, string> = {
      LEGAL: '建议立即咨询法务部门，评估法律风险和合规性',
      FINANCIAL: '建议关注资金状况，必要时进行财务审计',
      REPUTATION: '建议制定公关预案，监控舆情动向',
      SECURITY: '建议加强安全防护，检查系统漏洞',
      COMPLIANCE: '建议进行合规自查，准备应对措施',
    }
    return analyses[category] || '建议进一步调查分析'
  }

  detectOpportunities(content: string, source: string): OpportunityInsight | null {
    let detectedType: OpportunityInsight['type'] | null = null
    let matchedKeywords: string[] = []

    for (const [type, keywords] of Object.entries(OPPORTUNITY_KEYWORDS)) {
      const matches = keywords.filter(k => content.includes(k))
      if (matches.length > 0) {
        detectedType = type as OpportunityInsight['type']
        matchedKeywords = matches
        break
      }
    }

    if (!detectedType) return null

    const opportunity: OpportunityInsight = {
      id: `opp_${Date.now()}`,
      type: detectedType,
      title: `发现${detectedType}相关机会`,
      description: `在 ${source} 中发现: ${matchedKeywords.join(', ')}`,
      potentialValue: this.estimatePotentialValue(detectedType, content),
      source,
      confidence: 0.7,
      learnedAt: new Date(),
      absorbed: false,
    }

    this.opportunities.push(opportunity)
    if (this.currentSession) {
      this.currentSession.opportunitiesFound++
    }
    this.saveToStorage()

    console.log(`💡 机会洞察: ${opportunity.title}`)
    return opportunity
  }

  private estimatePotentialValue(type: string, _content: string): string {
    const values: Record<string, string> = {
      BUSINESS: '可能带来新业务增长',
      INNOVATION: '可能产生技术突破',
      COST_SAVING: '可能降低运营成本',
      PARTNERSHIP: '可能扩大合作网络',
      TREND: '可能把握市场先机',
    }
    return values[type] || '价值待评估'
  }

  verifyDataQuality(content: string, _source: string): { isValid: boolean; reason: string } {
    if (!content || content.trim().length < 10) {
      return { isValid: false, reason: '内容过短，无实质信息' }
    }

    const repeatPattern = /(.{10,})\1{2,}/
    if (repeatPattern.test(content)) {
      return { isValid: false, reason: '检测到大量重复内容' }
    }

    const gibberishPattern = /[a-zA-Z]{20,}|[\u4e00-\u9fa5]{50,}(?![\u3002\uff0c\uff1f\uff01])/
    if (gibberishPattern.test(content)) {
      return { isValid: false, reason: '疑似乱码或无意义内容' }
    }

    if (this.currentSession) {
      this.currentSession.dataQuality.verifiedData++
    }

    return { isValid: true, reason: '数据质量检查通过' }
  }

  async processFile(fileName: string, content: string, fileSize: number): Promise<{
    skipped: boolean
    knowledge?: KnowledgeFragment
    risk?: RiskAlert
    opportunity?: OpportunityInsight
    quality: { isValid: boolean; reason: string }
  }> {
    if (this.shouldSkipFile(fileName, fileSize)) {
      if (this.currentSession) {
        this.currentSession.dataQuality.skippedLargeFiles++
      }
      return { 
        skipped: true, 
        quality: { isValid: false, reason: '跳过大型媒体文件' } 
      }
    }

    if (this.currentSession) {
      this.currentSession.dataQuality.textFilesOnly++
    }

    const quality = this.verifyDataQuality(content, fileName)
    if (!quality.isValid) {
      if (this.currentSession) {
        this.currentSession.dataQuality.suspiciousData++
      }
      return { skipped: false, quality }
    }

    const knowledge = this.distillKnowledge(content, fileName, 'document')
    const risk = this.detectRisks(content, fileName)
    const opportunity = this.detectOpportunities(content, fileName)

    return { skipped: false, knowledge: knowledge || undefined, risk: risk || undefined, opportunity: opportunity || undefined, quality }
  }

  getUnreportedAlerts(): RiskAlert[] {
    return this.alerts.filter(a => !a.reportedToMaster && a.level !== 'LOW')
  }

  markAlertReported(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.reportedToMaster = true
      this.saveToStorage()
      return true
    }
    return false
  }

  absorbOpportunity(opportunityId: string): boolean {
    const opp = this.opportunities.find(o => o.id === opportunityId)
    if (opp) {
      opp.absorbed = true
      this.saveToStorage()
      return true
    }
    return false
  }

  getKnowledgeByTopic(topic: string): KnowledgeFragment[] {
    return this.knowledge.filter(k => 
      k.topic.includes(topic) || k.tags.some(t => t.includes(topic))
    )
  }

  getDreamReport(): string {
    const lastSession = this.sessions[this.sessions.length - 1]
    const unreportedAlerts = this.getUnreportedAlerts()
    const newOpportunities = this.opportunities.filter(o => !o.absorbed).slice(-5)

    let report = '🌙 **小智梦境报告**\n\n'

    if (lastSession) {
      report += `📅 最近梦境: ${new Date(lastSession.startTime).toLocaleString()}\n`
      report += `📚 知识提炼: ${lastSession.knowledgeDistilled} 条\n`
      report += `⚠️ 风险检测: ${lastSession.risksDetected} 个\n`
      report += `💡 机会发现: ${lastSession.opportunitiesFound} 个\n\n`
    }

    if (unreportedAlerts.length > 0) {
      report += '🚨 **待汇报的风险预警**\n'
      for (const alert of unreportedAlerts.slice(0, 3)) {
        report += `• [${alert.level}] ${alert.title}\n`
        report += `  ${alert.aiAnalysis}\n\n`
      }
    }

    if (newOpportunities.length > 0) {
      report += '💎 **发现的新机会**\n'
      for (const opp of newOpportunities) {
        report += `• ${opp.title}\n`
        report += `  ${opp.potentialValue}\n\n`
      }
    }

    report += `\n📊 知识库: ${this.knowledge.length} 条知识碎片`

    return report
  }

  getStats() {
    return {
      totalKnowledge: this.knowledge.length,
      totalAlerts: this.alerts.length,
      unreportedAlerts: this.getUnreportedAlerts().length,
      totalOpportunities: this.opportunities.length,
      absorbedOpportunities: this.opportunities.filter(o => o.absorbed).length,
      totalSessions: this.sessions.length,
    }
  }
}

export const dreamProcessor = new DreamProcessor()
export default dreamProcessor
