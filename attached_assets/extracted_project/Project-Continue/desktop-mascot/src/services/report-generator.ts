// 智能报告生成器 - 小智工作汇报助手
// 陈先生出品 · cj6168888@Gmail.com

import { 
  documentPolicyEngine, 
  type DocumentSecurityLevel, 
  type AIProviderType,
  CHINA_AI_MODELS
} from './document-policy-engine'
import { 
  wordGenerator, 
  type WordDocument,
  type DocumentTemplate as WordTemplate,
  PRESET_STYLES,
  DOCUMENT_TEMPLATES
} from './word-generator'

interface AIModelConfig {
  provider: AIProviderType
  apiKey: string
  modelName?: string
  baseUrl?: string
  enabled: boolean
}

interface MaterialItem {
  id: string
  type: 'document' | 'data' | 'image' | 'chart' | 'note' | 'email' | 'meeting'
  title: string
  content: string
  source: string
  relevance: number // 0-100 相关度评分
  tags: string[]
  createdAt: Date
  preview?: string
  selected: boolean
}

interface ReportSection {
  id: string
  title: string
  type: 'summary' | 'progress' | 'achievement' | 'challenge' | 'plan' | 'data' | 'custom'
  content: string
  materials: string[] // MaterialItem ids
  charts?: ChartConfig[]
  images?: ImageConfig[]
  order: number
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'radar' | 'table'
  title: string
  data: any
  style?: Record<string, any>
}

interface ImageConfig {
  url: string
  caption?: string
  width?: number
  position: 'left' | 'center' | 'right'
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  sections: Omit<ReportSection, 'id' | 'content' | 'materials'>[]
  style: {
    theme: 'professional' | 'modern' | 'minimal' | 'corporate' | 'creative'
    primaryColor: string
    fontFamily: string
  }
}

interface GeneratedReport {
  id: string
  title: string
  type: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'project' | 'custom'
  sections: ReportSection[]
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'review' | 'final'
  exportFormats: ('docx' | 'pdf' | 'pptx' | 'html')[]
  securityLevel?: DocumentSecurityLevel
  documentTypeId?: string
  auditStatus?: 'pending' | 'in_review' | 'approved' | 'rejected'
  auditHistory?: { stage: string; reviewer: string; action: string; timestamp: Date; notes?: string }[]
}

interface PPTSlide {
  id: string
  layout: 'title' | 'content' | 'twoColumn' | 'image' | 'chart' | 'comparison' | 'summary'
  title?: string
  subtitle?: string
  content?: string[]
  images?: ImageConfig[]
  charts?: ChartConfig[]
  notes?: string
  animation?: 'fadeIn' | 'slideIn' | 'zoomIn' | 'none'
}

interface PPTPresentation {
  id: string
  title: string
  slides: PPTSlide[]
  theme: {
    name: string
    primaryColor: string
    secondaryColor: string
    fontFamily: string
    backgroundStyle: 'solid' | 'gradient' | 'image'
  }
  duration?: number // 估计时长(分钟)
}

interface VideoScript {
  id: string
  title: string
  scenes: {
    id: string
    narration: string
    visuals: string
    duration: number
    transition: 'cut' | 'fade' | 'dissolve' | 'slide'
  }[]
  totalDuration: number
  voiceStyle: 'professional' | 'friendly' | 'energetic'
  musicStyle?: string
}

const STORAGE_KEYS = {
  MODELS: 'xiaozhi-report-models',
  MATERIALS: 'xiaozhi-report-materials',
  REPORTS: 'xiaozhi-generated-reports',
  TEMPLATES: 'xiaozhi-report-templates',
}

const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'weekly',
    name: '周工作汇报',
    description: '标准周报模板，包含工作进展、成果和下周计划',
    sections: [
      { title: '本周工作概述', type: 'summary', order: 1 },
      { title: '重点工作进展', type: 'progress', order: 2 },
      { title: '主要成果', type: 'achievement', order: 3 },
      { title: '遇到的问题', type: 'challenge', order: 4 },
      { title: '下周工作计划', type: 'plan', order: 5 },
    ],
    style: { theme: 'professional', primaryColor: '#1a365d', fontFamily: 'Microsoft YaHei' }
  },
  {
    id: 'monthly',
    name: '月度工作报告',
    description: '月度汇报模板，含数据分析和KPI达成情况',
    sections: [
      { title: '月度工作总结', type: 'summary', order: 1 },
      { title: 'KPI完成情况', type: 'data', order: 2 },
      { title: '重点项目进展', type: 'progress', order: 3 },
      { title: '核心成果展示', type: 'achievement', order: 4 },
      { title: '问题与改进', type: 'challenge', order: 5 },
      { title: '下月工作规划', type: 'plan', order: 6 },
    ],
    style: { theme: 'corporate', primaryColor: '#2c5282', fontFamily: 'Microsoft YaHei' }
  },
  {
    id: 'project',
    name: '项目进度汇报',
    description: '项目管理汇报，包含里程碑和风险分析',
    sections: [
      { title: '项目概况', type: 'summary', order: 1 },
      { title: '里程碑完成情况', type: 'progress', order: 2 },
      { title: '关键成果交付', type: 'achievement', order: 3 },
      { title: '风险与应对', type: 'challenge', order: 4 },
      { title: '资源需求', type: 'custom', order: 5 },
      { title: '后续计划', type: 'plan', order: 6 },
    ],
    style: { theme: 'modern', primaryColor: '#3182ce', fontFamily: 'Microsoft YaHei' }
  },
]

class ReportGenerator {
  private models: AIModelConfig[] = []
  private materials: MaterialItem[] = []
  private reports: GeneratedReport[] = []
  private templates: ReportTemplate[] = [...DEFAULT_TEMPLATES]
  private activeModel: AIModelConfig | null = null

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const m = localStorage.getItem(STORAGE_KEYS.MODELS)
      const mat = localStorage.getItem(STORAGE_KEYS.MATERIALS)
      const r = localStorage.getItem(STORAGE_KEYS.REPORTS)
      const t = localStorage.getItem(STORAGE_KEYS.TEMPLATES)

      if (m) this.models = JSON.parse(m)
      if (mat) this.materials = JSON.parse(mat)
      if (r) this.reports = JSON.parse(r)
      if (t) this.templates = [...DEFAULT_TEMPLATES, ...JSON.parse(t)]

      this.activeModel = this.models.find(m => m.enabled) || null
    } catch (e) {
      console.error('加载报告生成器数据失败:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.MODELS, JSON.stringify(this.models))
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(this.materials))
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports))
      const customTemplates = this.templates.filter(t => !DEFAULT_TEMPLATES.find(d => d.id === t.id))
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(customTemplates))
    } catch (e) {
      console.error('保存报告生成器数据失败:', e)
    }
  }

  // ========== AI模型管理 ==========

  addModel(config: AIModelConfig): void {
    const existing = this.models.findIndex(m => m.provider === config.provider)
    if (existing >= 0) {
      this.models[existing] = config
    } else {
      this.models.push(config)
    }
    if (config.enabled) {
      this.activeModel = config
    }
    this.saveToStorage()
  }

  removeModel(provider: string): void {
    this.models = this.models.filter(m => m.provider !== provider)
    if (this.activeModel?.provider === provider) {
      this.activeModel = this.models.find(m => m.enabled) || null
    }
    this.saveToStorage()
  }

  setActiveModel(provider: string): void {
    const model = this.models.find(m => m.provider === provider)
    if (model) {
      this.models.forEach(m => m.enabled = m.provider === provider)
      this.activeModel = model
      this.saveToStorage()
    }
  }

  getModels(): AIModelConfig[] {
    return this.models.map(m => ({ ...m, apiKey: m.apiKey ? '***已配置***' : '' }))
  }

  private async callAI(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.activeModel) {
      throw new Error('请先配置AI模型API')
    }

    const { provider, apiKey, modelName, baseUrl } = this.activeModel

    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(prompt, systemPrompt, apiKey, modelName, baseUrl)
        case 'qwen':
          return await this.callDashScope(prompt, systemPrompt, apiKey, modelName)
        case 'claude':
          return await this.callClaude(prompt, systemPrompt, apiKey, modelName)
        case 'moonshot':
          return await this.callMoonshot(prompt, systemPrompt, apiKey, modelName)
        case 'deepseek':
          return await this.callDeepSeek(prompt, systemPrompt, apiKey, modelName)
        case 'glm':
          return await this.callZhipu(prompt, systemPrompt, apiKey, modelName)
        case 'ernie':
          return await this.callErnie(prompt, systemPrompt, apiKey, modelName)
        case 'baichuan':
          return await this.callBaichuan(prompt, systemPrompt, apiKey, modelName)
        case 'minimax':
          return await this.callMinimax(prompt, systemPrompt, apiKey, modelName)
        case 'yi':
          return await this.callYi(prompt, systemPrompt, apiKey, modelName)
        case 'spark':
          return await this.callSpark(prompt, systemPrompt, apiKey, modelName)
        case 'hunyuan':
          return await this.callHunyuan(prompt, systemPrompt, apiKey, modelName)
        case 'doubao':
          return await this.callDoubao(prompt, systemPrompt, apiKey, modelName)
        case 'ollama_local':
        case 'vllm_local':
          return await this.callLocalModel(prompt, systemPrompt, modelName, baseUrl)
        default:
          return await this.callOpenAICompatible(prompt, systemPrompt, apiKey, modelName, baseUrl || '')
      }
    } catch (error) {
      console.error(`AI调用失败 (${provider}):`, error)
      throw error
    }
  }

  private async callOpenAI(prompt: string, system: string | undefined, apiKey: string, model?: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callDashScope(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen-max',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callClaude(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 
        'x-api-key': apiKey, 
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: system || '',
        messages: [{ role: 'user', content: prompt }],
      })
    })
    const data = await response.json()
    return data.content?.[0]?.text || ''
  }

  private async callMoonshot(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'moonshot-v1-8k',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callDeepSeek(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callZhipu(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'glm-4',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callOpenAICompatible(prompt: string, system: string | undefined, apiKey: string, model?: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl}/v1/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'default',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callErnie(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/' + (model || 'ernie-4.0-8k'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.result || ''
  }

  private async callBaichuan(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.baichuan-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'Baichuan4',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callMinimax(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'abab6.5s-chat',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callYi(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://api.lingyiwanwu.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'yi-large',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callSpark(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://spark-api-open.xf-yun.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'generalv3.5',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callHunyuan(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://hunyuan.tencentcloudapi.com', {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json', 'X-TC-Action': 'ChatCompletions' },
      body: JSON.stringify({
        Model: model || 'hunyuan-pro',
        Messages: [
          ...(system ? [{ Role: 'system', Content: system }] : []),
          { Role: 'user', Content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.Response?.Choices?.[0]?.Message?.Content || ''
  }

  private async callDoubao(prompt: string, system: string | undefined, apiKey: string, model?: string): Promise<string> {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'doubao-pro-32k',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  private async callLocalModel(prompt: string, system: string | undefined, model?: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl || 'http://localhost:11434'}/api/chat`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen2.5:7b',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        stream: false,
      })
    })
    const data = await response.json()
    return data.message?.content || ''
  }

  // ========== 策略引擎集成 ==========

  validateDocumentSecurity(content: string, documentTypeId: string): {
    valid: boolean
    level: DocumentSecurityLevel
    warnings: string[]
    allowedModels: AIProviderType[]
    desensitizedContent: string
  } {
    const validation = documentPolicyEngine.validateDocument(content, documentTypeId)
    const aiPolicy = documentPolicyEngine.getAIModelPolicy(validation.level)
    const { result: desensitizedContent } = documentPolicyEngine.desensitize(content, validation.level)

    return {
      valid: validation.valid,
      level: validation.level,
      warnings: validation.warnings,
      allowedModels: aiPolicy.allowedProviders,
      desensitizedContent,
    }
  }

  getDocumentTypes() {
    return documentPolicyEngine.getDocumentTypes()
  }

  getSecurityLevelInfo(level: DocumentSecurityLevel) {
    return documentPolicyEngine.getSecurityLevelInfo(level)
  }

  getRecommendedModelsForLevel(level: DocumentSecurityLevel) {
    return documentPolicyEngine.getRecommendedModels(level)
  }

  getChinaAIModels() {
    return CHINA_AI_MODELS
  }

  // ========== 素材管理 ==========

  addMaterial(item: Omit<MaterialItem, 'id' | 'relevance' | 'selected'>): MaterialItem {
    const material: MaterialItem = {
      ...item,
      id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      relevance: 0,
      selected: false,
    }
    this.materials.push(material)
    this.saveToStorage()
    return material
  }

  importMaterialsFromKnowledge(knowledge: Array<{topic: string, keyPoints: string[], source: string, tags: string[]}>): MaterialItem[] {
    const imported: MaterialItem[] = []
    for (const k of knowledge) {
      const material = this.addMaterial({
        type: 'note',
        title: k.topic,
        content: k.keyPoints.join('\n'),
        source: k.source,
        tags: k.tags,
        createdAt: new Date(),
        preview: k.keyPoints[0] || '',
      })
      imported.push(material)
    }
    return imported
  }

  async recommendMaterials(topic: string, reportType: string): Promise<MaterialItem[]> {
    const keywords = topic.toLowerCase().split(/\s+/)
    
    const scored = this.materials.map(mat => {
      let score = 0
      const searchText = `${mat.title} ${mat.content} ${mat.tags.join(' ')}`.toLowerCase()
      
      for (const kw of keywords) {
        if (searchText.includes(kw)) score += 20
      }
      
      // 时间相关度 - 最近7天加分
      const daysSince = (Date.now() - new Date(mat.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince <= 7) score += 30
      else if (daysSince <= 30) score += 15
      
      // 类型匹配
      if (reportType === 'project' && mat.type === 'document') score += 10
      if (reportType === 'weekly' && mat.type === 'meeting') score += 10
      if (mat.type === 'data') score += 15
      
      return { ...mat, relevance: Math.min(100, score) }
    })

    return scored
      .filter(m => m.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20)
  }

  selectMaterial(id: string, selected: boolean): void {
    const mat = this.materials.find(m => m.id === id)
    if (mat) {
      mat.selected = selected
      this.saveToStorage()
    }
  }

  getSelectedMaterials(): MaterialItem[] {
    return this.materials.filter(m => m.selected)
  }

  clearSelection(): void {
    this.materials.forEach(m => m.selected = false)
    this.saveToStorage()
  }

  // ========== 报告生成 ==========

  async generateReport(params: {
    title: string
    type: GeneratedReport['type']
    templateId?: string
    customSections?: ReportSection[]
    materials?: MaterialItem[]
    additionalContext?: string
    documentTypeId?: string // 文档类型，用于安全策略
  }): Promise<GeneratedReport> {
    const template = this.templates.find(t => t.id === params.templateId) || this.templates[0]
    const materials = params.materials || this.getSelectedMaterials()
    
    // 确定文档类型和安全等级
    const docTypeId = params.documentTypeId || 'work_report' // 默认为工作汇报(受控级)
    const securityLevel = documentPolicyEngine.getSecurityLevel(docTypeId)
    const aiPolicy = documentPolicyEngine.getAIModelPolicy(securityLevel)
    const levelInfo = documentPolicyEngine.getSecurityLevelInfo(securityLevel)

    // 验证当前模型是否被允许
    if (this.activeModel) {
      const isAllowed = documentPolicyEngine.isModelAllowed(this.activeModel.provider, securityLevel)
      if (!isAllowed) {
        // 尝试切换到推荐的模型
        const recommendedModels = documentPolicyEngine.getRecommendedModels(securityLevel)
        const fallbackModel = this.models.find(m => 
          recommendedModels.some(r => r.provider === m.provider)
        )
        if (fallbackModel) {
          console.warn(`[安全策略] ${levelInfo.name}文档不允许使用${this.activeModel.provider}，已切换至${fallbackModel.provider}`)
          this.activeModel = fallbackModel
        } else if (securityLevel === 'CONFIDENTIAL' && !aiPolicy.allowCloudAPI) {
          throw new Error(`[安全策略] 机密级文档必须使用本地部署模型，请先配置Ollama或vLLM本地模型`)
        } else {
          throw new Error(`[安全策略] ${levelInfo.name}文档禁止使用${this.activeModel.provider}模型，请配置允许的模型：${aiPolicy.allowedProviders.join('、')}`)
        }
      }
    }

    // 对素材内容进行脱敏处理
    const desensitizedMaterials = materials.map(m => {
      const { result, masked } = documentPolicyEngine.desensitize(m.content, securityLevel)
      if (masked.length > 0) {
        console.log(`[脱敏处理] ${m.title}: ${masked.map(x => `${x.rule}(${x.count}处)`).join('、')}`)
      }
      return { ...m, content: result }
    })

    const systemPrompt = `你是一位专业的商务写作专家，擅长撰写各类工作汇报。
请根据提供的素材和要求，生成一份严谨、专业、条理清晰的工作汇报。
要求：
1. 语言正式、专业
2. 数据准确，有理有据
3. 结构清晰，重点突出
4. 适当使用项目符号和编号
5. 避免口语化表达
6. 注意：素材中的敏感信息已做脱敏处理，请在输出中保持脱敏状态`

    const sections: ReportSection[] = []

    for (const sectionDef of template.sections) {
      const relevantMaterials = desensitizedMaterials.filter(m => {
        if (sectionDef.type === 'data' && m.type === 'data') return true
        if (sectionDef.type === 'progress' && ['document', 'meeting'].includes(m.type)) return true
        if (sectionDef.type === 'achievement' && m.tags.some(t => ['成果', '完成', '达成'].includes(t))) return true
        return true
      })

      const prompt = `请根据以下素材，撰写"${sectionDef.title}"部分的内容。

报告标题：${params.title}
报告类型：${params.type === 'weekly' ? '周报' : params.type === 'monthly' ? '月报' : params.type === 'project' ? '项目汇报' : '工作汇报'}
安全等级：${levelInfo.name}
${params.additionalContext ? `补充说明：${params.additionalContext}` : ''}

参考素材：
${relevantMaterials.map(m => `【${m.title}】\n${m.content}`).join('\n\n')}

请直接输出该部分的内容，不需要标题。使用Markdown格式。`

      try {
        const content = await this.callAI(prompt, systemPrompt)
        sections.push({
          id: `sec_${Date.now()}_${sectionDef.order}`,
          title: sectionDef.title,
          type: sectionDef.type,
          content,
          materials: relevantMaterials.map(m => m.id),
          order: sectionDef.order,
        })
      } catch (error) {
        sections.push({
          id: `sec_${Date.now()}_${sectionDef.order}`,
          title: sectionDef.title,
          type: sectionDef.type,
          content: `[生成失败，请手动编辑]`,
          materials: [],
          order: sectionDef.order,
        })
      }
    }

    const report: GeneratedReport = {
      id: `report_${Date.now()}`,
      title: params.title,
      type: params.type,
      sections,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      exportFormats: ['docx', 'pdf'],
      securityLevel, // 记录安全等级
      documentTypeId: docTypeId, // 记录文档类型
    } as GeneratedReport

    this.reports.push(report)
    this.saveToStorage()
    return report
  }

  updateReportSection(reportId: string, sectionId: string, content: string): void {
    const report = this.reports.find(r => r.id === reportId)
    if (report) {
      const section = report.sections.find(s => s.id === sectionId)
      if (section) {
        section.content = content
        report.updatedAt = new Date()
        this.saveToStorage()
      }
    }
  }

  // ========== PPT生成 ==========

  async generatePPT(report: GeneratedReport): Promise<PPTPresentation> {
    const slides: PPTSlide[] = []

    // 封面页
    slides.push({
      id: `slide_cover`,
      layout: 'title',
      title: report.title,
      subtitle: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      animation: 'fadeIn',
    })

    // 目录页
    slides.push({
      id: `slide_toc`,
      layout: 'content',
      title: '目录',
      content: report.sections.map((s, i) => `${i + 1}. ${s.title}`),
      animation: 'slideIn',
    })

    // 内容页
    for (const section of report.sections) {
      const contentPoints = section.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 6)

      slides.push({
        id: `slide_${section.id}`,
        layout: section.type === 'data' ? 'chart' : 'content',
        title: section.title,
        content: contentPoints,
        notes: section.content,
        animation: 'slideIn',
      })
    }

    // 结束页
    slides.push({
      id: `slide_end`,
      layout: 'title',
      title: '谢谢！',
      subtitle: '欢迎提问',
      animation: 'zoomIn',
    })

    const ppt: PPTPresentation = {
      id: `ppt_${Date.now()}`,
      title: report.title,
      slides,
      theme: {
        name: 'Professional',
        primaryColor: '#1a365d',
        secondaryColor: '#3182ce',
        fontFamily: 'Microsoft YaHei',
        backgroundStyle: 'gradient',
      },
      duration: slides.length * 2,
    }

    return ppt
  }

  async enhancePPTWithAI(ppt: PPTPresentation): Promise<PPTPresentation> {
    const systemPrompt = `你是一位专业的PPT设计师。请优化每页PPT的内容，使其更加精炼、有力、适合演示。
每个要点应控制在15字以内，每页不超过5个要点。`

    const enhancedSlides: PPTSlide[] = []
    for (const slide of ppt.slides) {
      if (slide.content && slide.content.length > 0) {
        try {
          const prompt = `标题：${slide.title}
原始内容：
${slide.content.join('\n')}

请优化为适合PPT展示的精炼要点，每点不超过15字，最多5点。直接输出要点，每行一个。`
          const enhanced = await this.callAI(prompt, systemPrompt)
          enhancedSlides.push({
            ...slide,
            content: enhanced.split('\n').filter(l => l.trim()).slice(0, 5),
          })
        } catch {
          enhancedSlides.push(slide)
        }
      } else {
        enhancedSlides.push(slide)
      }
    }

    return { ...ppt, slides: enhancedSlides }
  }

  // ========== 视频脚本生成 ==========

  async generateVideoScript(report: GeneratedReport, style: VideoScript['voiceStyle'] = 'professional'): Promise<VideoScript> {
    const systemPrompt = `你是一位专业的商务视频脚本撰写专家。
请根据工作汇报内容，撰写适合视频演示的脚本。
要求：
1. 语言自然流畅，适合朗读
2. 每个场景配有画面描述建议
3. 控制每个场景时长在30-60秒
4. ${style === 'professional' ? '语调正式专业' : style === 'friendly' ? '语调亲切友好' : '语调充满活力'}`

    const prompt = `请根据以下工作汇报内容，生成视频脚本。

报告标题：${report.title}

内容：
${report.sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n')}

请输出JSON格式的场景列表：
[
  {
    "narration": "旁白文字",
    "visuals": "画面描述",
    "duration": 秒数
  }
]`

    try {
      const response = await this.callAI(prompt, systemPrompt)
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      const scenes = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      const script: VideoScript = {
        id: `video_${Date.now()}`,
        title: report.title,
        scenes: scenes.map((s: any, i: number) => ({
          id: `scene_${i}`,
          narration: s.narration || '',
          visuals: s.visuals || '',
          duration: s.duration || 30,
          transition: i === 0 ? 'fade' : 'dissolve',
        })),
        totalDuration: scenes.reduce((sum: number, s: any) => sum + (s.duration || 30), 0),
        voiceStyle: style,
      }

      return script
    } catch (error) {
      console.error('生成视频脚本失败:', error)
      return {
        id: `video_${Date.now()}`,
        title: report.title,
        scenes: report.sections.map((s, i) => ({
          id: `scene_${i}`,
          narration: s.content.substring(0, 200),
          visuals: `展示${s.title}相关内容`,
          duration: 30,
          transition: 'dissolve',
        })),
        totalDuration: report.sections.length * 30,
        voiceStyle: style,
      }
    }
  }

  // ========== 导出功能 ==========

  exportToMarkdown(report: GeneratedReport): string {
    let md = `# ${report.title}\n\n`
    md += `> 生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}\n\n`
    
    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      md += `## ${section.title}\n\n${section.content}\n\n`
    }

    return md
  }

  exportToHTML(report: GeneratedReport, style?: ReportTemplate['style']): string {
    const theme = style || { theme: 'professional', primaryColor: '#1a365d', fontFamily: 'Microsoft YaHei' }
    
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: ${theme.fontFamily}, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: ${theme.primaryColor}; border-bottom: 2px solid ${theme.primaryColor}; padding-bottom: 10px; }
    h2 { color: ${theme.primaryColor}; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    ul, ol { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p class="meta">生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}</p>
`

    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      html += `  <h2>${section.title}</h2>\n`
      html += `  <div>${section.content.replace(/\n/g, '<br>')}</div>\n`
    }

    html += `</body></html>`
    return html
  }

  getReports(): GeneratedReport[] {
    return this.reports
  }

  getReport(id: string): GeneratedReport | undefined {
    return this.reports.find(r => r.id === id)
  }

  deleteReport(id: string): void {
    this.reports = this.reports.filter(r => r.id !== id)
    this.saveToStorage()
  }

  getTemplates(): ReportTemplate[] {
    return this.templates
  }

  // ========== Word文档导出 ==========

  exportToWord(report: GeneratedReport, options?: {
    template?: string
    includeWatermark?: boolean
    watermarkText?: string
    headerText?: string
    footerText?: string
  }): { document: WordDocument; html: string; xml: string } {
    const doc = wordGenerator.createDocument({
      title: report.title,
      author: '小智助手',
      subject: `${report.type}报告`
    })

    if (options?.includeWatermark && options?.watermarkText) {
      wordGenerator.setWatermark(options.watermarkText, { opacity: 0.2 })
    }

    if (options?.headerText) {
      wordGenerator.setHeader(options.headerText)
    }

    if (options?.footerText) {
      wordGenerator.setFooter(options.footerText)
    }

    wordGenerator.addHeading(report.title, 1)
    wordGenerator.addParagraph(
      `生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`,
      { paragraph: { alignment: 'right' } }
    )

    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      wordGenerator.addHeading(section.title, 2)
      
      const lines = section.content.split('\n').filter(l => l.trim())
      for (const line of lines) {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          continue
        }
        wordGenerator.addParagraph(line)
      }

      const bulletItems = lines.filter(l => l.startsWith('- ') || l.startsWith('• '))
      if (bulletItems.length > 0) {
        wordGenerator.addList(bulletItems.map(i => i.replace(/^[-•]\s*/, '')), 'bullet')
      }

      if (section.charts && section.charts.length > 0) {
        for (const chart of section.charts) {
          if (chart.type === 'table' && Array.isArray(chart.data)) {
            wordGenerator.addTable(chart.data, {
              hasHeader: true,
              headerStyle: { 
                font: PRESET_STYLES.tableHeader.font, 
                backgroundColor: PRESET_STYLES.tableHeader.cell.backgroundColor 
              }
            })
          }
        }
      }
    }

    const document = wordGenerator.getDocument()!
    const html = wordGenerator.exportToHTML()
    const { xml } = wordGenerator.exportToDocxData()

    return { document, html, xml: xml || '' }
  }

  exportToWordFromTemplate(templateId: string, data: Record<string, string>): { document: WordDocument; html: string; xml: string } {
    const doc = wordGenerator.fillTemplate(templateId, data)
    const html = wordGenerator.exportToHTML()
    const { xml } = wordGenerator.exportToDocxData()
    return { document: doc, html, xml: xml || '' }
  }

  getWordTemplates(): WordTemplate[] {
    return DOCUMENT_TEMPLATES
  }

  getWordPresetStyles() {
    return PRESET_STYLES
  }
}

export const reportGenerator = new ReportGenerator()
export type { 
  AIModelConfig, 
  MaterialItem, 
  ReportSection, 
  GeneratedReport, 
  ReportTemplate,
  PPTSlide,
  PPTPresentation,
  VideoScript,
  ChartConfig,
  ImageConfig
}
