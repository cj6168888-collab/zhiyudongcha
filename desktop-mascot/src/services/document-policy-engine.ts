// 文档安全等级与知识边界规则引擎
// 陈先生出品 · cj6168888@Gmail.com

// ========== 文档安全等级 ==========
type DocumentSecurityLevel = 
  | 'CONFIDENTIAL'  // 机密级：合同、法律文件、核心商业机密
  | 'INTERNAL'      // 内部级：策划书、方案、内部报告
  | 'CONTROLLED'    // 受控级：工作汇报、进度报告、会议纪要
  | 'OPEN'          // 开放级：宣传材料、公开演讲、市场分析

// ========== 文档类型定义 ==========
interface DocumentTypeConfig {
  id: string
  name: string
  nameEn: string
  securityLevel: DocumentSecurityLevel
  description: string
  examples: string[]
  icon: string
}

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  // 机密级文档
  {
    id: 'contract',
    name: '合同协议',
    nameEn: 'Contract',
    securityLevel: 'CONFIDENTIAL',
    description: '具有法律效力的合同、协议、承诺书等',
    examples: ['采购合同', '销售合同', '保密协议', '劳动合同', '合作协议'],
    icon: '📜'
  },
  {
    id: 'legal',
    name: '法律文件',
    nameEn: 'Legal Document',
    securityLevel: 'CONFIDENTIAL',
    description: '涉及法律事务的文件',
    examples: ['诉讼材料', '法律意见书', '授权书', '公证材料'],
    icon: '⚖️'
  },
  {
    id: 'financial_report',
    name: '财务报表',
    nameEn: 'Financial Report',
    securityLevel: 'CONFIDENTIAL',
    description: '公司财务数据、审计报告',
    examples: ['资产负债表', '利润表', '现金流量表', '审计报告'],
    icon: '💰'
  },
  {
    id: 'trade_secret',
    name: '商业机密',
    nameEn: 'Trade Secret',
    securityLevel: 'CONFIDENTIAL',
    description: '核心技术、配方、客户名单等',
    examples: ['技术方案', '核心算法', '客户清单', '供应商名录', '定价策略'],
    icon: '🔐'
  },

  // 内部级文档
  {
    id: 'proposal',
    name: '策划方案',
    nameEn: 'Proposal',
    securityLevel: 'INTERNAL',
    description: '项目策划、营销方案等',
    examples: ['营销策划', '活动方案', '品牌策划', '产品策划'],
    icon: '💡'
  },
  {
    id: 'business_plan',
    name: '商业计划',
    nameEn: 'Business Plan',
    securityLevel: 'INTERNAL',
    description: '商业计划书、投资方案',
    examples: ['BP', '融资计划', '战略规划', '发展计划'],
    icon: '📊'
  },
  {
    id: 'internal_report',
    name: '内部报告',
    nameEn: 'Internal Report',
    securityLevel: 'INTERNAL',
    description: '仅供内部参考的分析报告',
    examples: ['竞品分析', '市场调研', '可行性分析', '风险评估'],
    icon: '📋'
  },
  {
    id: 'policy',
    name: '制度规范',
    nameEn: 'Policy',
    securityLevel: 'INTERNAL',
    description: '公司制度、流程规范',
    examples: ['员工手册', '操作规程', '管理制度', 'SOP'],
    icon: '📖'
  },

  // 受控级文档
  {
    id: 'work_report',
    name: '工作汇报',
    nameEn: 'Work Report',
    securityLevel: 'CONTROLLED',
    description: '日常工作汇报、周报月报',
    examples: ['周报', '月报', '季度汇报', '年度总结', '述职报告'],
    icon: '📝'
  },
  {
    id: 'meeting_minutes',
    name: '会议纪要',
    nameEn: 'Meeting Minutes',
    securityLevel: 'CONTROLLED',
    description: '会议记录、纪要',
    examples: ['例会纪要', '项目会议记录', '决策会议纪要'],
    icon: '🗓️'
  },
  {
    id: 'progress_report',
    name: '进度报告',
    nameEn: 'Progress Report',
    securityLevel: 'CONTROLLED',
    description: '项目进度、任务进展',
    examples: ['项目周报', '里程碑报告', '阶段性报告'],
    icon: '📈'
  },
  {
    id: 'technical_doc',
    name: '技术文档',
    nameEn: 'Technical Document',
    securityLevel: 'CONTROLLED',
    description: '技术说明、使用手册',
    examples: ['用户手册', 'API文档', '操作指南', '技术规格'],
    icon: '🔧'
  },

  // 开放级文档
  {
    id: 'marketing',
    name: '宣传材料',
    nameEn: 'Marketing Material',
    securityLevel: 'OPEN',
    description: '对外宣传、营销材料',
    examples: ['宣传册', '产品介绍', '公司简介', '新闻稿'],
    icon: '📢'
  },
  {
    id: 'speech',
    name: '演讲稿',
    nameEn: 'Speech',
    securityLevel: 'OPEN',
    description: '公开演讲、发言稿',
    examples: ['年会致辞', '发布会演讲', '培训讲义'],
    icon: '🎤'
  },
  {
    id: 'research',
    name: '研究报告',
    nameEn: 'Research Report',
    securityLevel: 'OPEN',
    description: '行业研究、趋势分析',
    examples: ['行业白皮书', '趋势报告', '市场分析'],
    icon: '🔬'
  },
]

// ========== 知识来源策略 ==========
interface KnowledgeSourcePolicy {
  level: DocumentSecurityLevel
  name: string
  allowedSources: KnowledgeSource[]
  blockedSources: KnowledgeSource[]
  requiresAudit: boolean
  auditType: 'none' | 'self' | 'peer' | 'legal' | 'executive'
  description: string
}

type KnowledgeSource = 
  | 'COMPANY_AUDITED'      // 公司已审核资料
  | 'COMPANY_INTERNAL'     // 公司内部资料（未审核）
  | 'INDUSTRY_STANDARD'    // 行业标准、规范
  | 'PUBLIC_TRUSTED'       // 可信公开来源（政府、权威机构）
  | 'PUBLIC_GENERAL'       // 一般公开来源
  | 'AI_KNOWLEDGE'         // AI模型内置知识
  | 'WEB_SEARCH'           // 网络搜索结果

const KNOWLEDGE_POLICIES: KnowledgeSourcePolicy[] = [
  {
    level: 'CONFIDENTIAL',
    name: '机密级知识策略',
    allowedSources: ['COMPANY_AUDITED'],
    blockedSources: ['COMPANY_INTERNAL', 'INDUSTRY_STANDARD', 'PUBLIC_TRUSTED', 'PUBLIC_GENERAL', 'AI_KNOWLEDGE', 'WEB_SEARCH'],
    requiresAudit: true,
    auditType: 'legal',
    description: '仅允许使用公司已审核资料，禁止任何外部知识，必须法务审核'
  },
  {
    level: 'INTERNAL',
    name: '内部级知识策略',
    allowedSources: ['COMPANY_AUDITED', 'COMPANY_INTERNAL', 'INDUSTRY_STANDARD'],
    blockedSources: ['PUBLIC_GENERAL', 'WEB_SEARCH'],
    requiresAudit: true,
    auditType: 'peer',
    description: '可使用公司资料和行业标准，不允许一般网络来源，需同事审核'
  },
  {
    level: 'CONTROLLED',
    name: '受控级知识策略',
    allowedSources: ['COMPANY_AUDITED', 'COMPANY_INTERNAL', 'INDUSTRY_STANDARD', 'PUBLIC_TRUSTED'],
    blockedSources: ['WEB_SEARCH'],
    requiresAudit: true,
    auditType: 'self',
    description: '可使用公司资料、行业标准和权威公开来源，需自我审核'
  },
  {
    level: 'OPEN',
    name: '开放级知识策略',
    allowedSources: ['COMPANY_AUDITED', 'COMPANY_INTERNAL', 'INDUSTRY_STANDARD', 'PUBLIC_TRUSTED', 'PUBLIC_GENERAL', 'AI_KNOWLEDGE', 'WEB_SEARCH'],
    blockedSources: [],
    requiresAudit: false,
    auditType: 'none',
    description: '可使用所有知识来源，建议自行检查准确性'
  },
]

// ========== AI模型路由策略 ==========
interface AIModelPolicy {
  level: DocumentSecurityLevel
  allowedProviders: AIProviderType[]
  preferredProviders: AIProviderType[]
  requireLocalDeployment: boolean
  allowCloudAPI: boolean
  dataRetentionAllowed: boolean
  description: string
}

type AIProviderType = 
  // 国产模型 - 优先
  | 'qwen'           // 通义千问 (阿里)
  | 'ernie'          // 文心一言 (百度)
  | 'glm'            // 智谱GLM
  | 'moonshot'       // Kimi (月之暗面)
  | 'deepseek'       // DeepSeek (深度求索)
  | 'baichuan'       // 百川
  | 'minimax'        // MiniMax
  | 'yi'             // 零一万物
  | 'spark'          // 讯飞星火
  | 'hunyuan'        // 腾讯混元
  | 'doubao'         // 豆包 (字节)
  // 本地部署
  | 'ollama_local'   // 本地Ollama
  | 'vllm_local'     // 本地vLLM
  // 海外模型
  | 'openai'         // OpenAI
  | 'claude'         // Anthropic Claude
  | 'gemini'         // Google Gemini

const AI_MODEL_POLICIES: AIModelPolicy[] = [
  {
    level: 'CONFIDENTIAL',
    allowedProviders: ['ollama_local', 'vllm_local', 'qwen', 'glm'],
    preferredProviders: ['ollama_local', 'vllm_local'],
    requireLocalDeployment: true,
    allowCloudAPI: false,
    dataRetentionAllowed: false,
    description: '机密文档必须使用本地部署模型，禁止云端API，确保数据不出域'
  },
  {
    level: 'INTERNAL',
    allowedProviders: ['ollama_local', 'vllm_local', 'qwen', 'ernie', 'glm', 'deepseek', 'baichuan', 'moonshot'],
    preferredProviders: ['qwen', 'glm', 'deepseek'],
    requireLocalDeployment: false,
    allowCloudAPI: true,
    dataRetentionAllowed: false,
    description: '内部文档优先使用国产云模型，要求零数据保留'
  },
  {
    level: 'CONTROLLED',
    allowedProviders: ['ollama_local', 'vllm_local', 'qwen', 'ernie', 'glm', 'deepseek', 'baichuan', 'moonshot', 'minimax', 'yi', 'spark', 'hunyuan', 'doubao'],
    preferredProviders: ['qwen', 'deepseek', 'moonshot'],
    requireLocalDeployment: false,
    allowCloudAPI: true,
    dataRetentionAllowed: false,
    description: '受控文档可使用所有国产模型，建议脱敏处理'
  },
  {
    level: 'OPEN',
    allowedProviders: ['ollama_local', 'vllm_local', 'qwen', 'ernie', 'glm', 'deepseek', 'baichuan', 'moonshot', 'minimax', 'yi', 'spark', 'hunyuan', 'doubao', 'openai', 'claude', 'gemini'],
    preferredProviders: ['qwen', 'deepseek', 'openai'],
    requireLocalDeployment: false,
    allowCloudAPI: true,
    dataRetentionAllowed: true,
    description: '开放文档可使用所有模型，包括海外模型'
  },
]

// ========== 数据脱敏规则 ==========
interface DesensitizationRule {
  id: string
  name: string
  pattern: RegExp
  replacement: string
  appliesTo: DocumentSecurityLevel[]
  category: 'PII' | 'FINANCIAL' | 'CONTACT' | 'BUSINESS' | 'TECHNICAL'
}

const DESENSITIZATION_RULES: DesensitizationRule[] = [
  // 个人身份信息 (PII)
  {
    id: 'phone',
    name: '手机号码',
    pattern: /1[3-9]\d{9}/g,
    replacement: '1**********',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL', 'CONTROLLED'],
    category: 'PII'
  },
  {
    id: 'id_card',
    name: '身份证号',
    pattern: /\d{17}[\dXx]/g,
    replacement: '******************',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL', 'CONTROLLED'],
    category: 'PII'
  },
  {
    id: 'email',
    name: '邮箱地址',
    pattern: /[\w.-]+@[\w.-]+\.\w+/g,
    replacement: '***@***.***',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL'],
    category: 'CONTACT'
  },
  {
    id: 'bank_account',
    name: '银行账号',
    pattern: /\d{16,19}/g,
    replacement: '****************',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL', 'CONTROLLED'],
    category: 'FINANCIAL'
  },
  // 金融信息
  {
    id: 'amount_large',
    name: '大额金额',
    pattern: /[￥¥$]\s*\d{1,3}(,\d{3})*(\.\d{2})?万?亿?/g,
    replacement: '[金额已隐藏]',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL'],
    category: 'FINANCIAL'
  },
  // 商业信息
  {
    id: 'company_name',
    name: '公司全称',
    pattern: /[\u4e00-\u9fa5]+(?:有限|股份|集团|科技|网络|信息)公司/g,
    replacement: '[公司名称]',
    appliesTo: ['CONFIDENTIAL'],
    category: 'BUSINESS'
  },
  {
    id: 'contract_number',
    name: '合同编号',
    pattern: /(?:合同|协议|订单)(?:编号|号)[：:]\s*[\w-]+/g,
    replacement: '[合同编号已隐藏]',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL'],
    category: 'BUSINESS'
  },
  // 技术信息
  {
    id: 'ip_address',
    name: 'IP地址',
    pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    replacement: '***.***.***.***',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL', 'CONTROLLED'],
    category: 'TECHNICAL'
  },
  {
    id: 'api_key',
    name: 'API密钥',
    pattern: /(?:api[_-]?key|secret|token)[：:=]\s*[\w-]{20,}/gi,
    replacement: '[密钥已隐藏]',
    appliesTo: ['CONFIDENTIAL', 'INTERNAL', 'CONTROLLED'],
    category: 'TECHNICAL'
  },
]

// ========== 审核流程配置 ==========
interface AuditWorkflow {
  level: DocumentSecurityLevel
  stages: AuditStage[]
  maxDaysToComplete: number
  escalationRules: string[]
}

interface AuditStage {
  order: number
  name: string
  role: 'self' | 'peer' | 'manager' | 'legal' | 'executive' | 'compliance'
  required: boolean
  canSkip: boolean
  timeoutHours: number
}

const AUDIT_WORKFLOWS: AuditWorkflow[] = [
  {
    level: 'CONFIDENTIAL',
    stages: [
      { order: 1, name: '自我检查', role: 'self', required: true, canSkip: false, timeoutHours: 24 },
      { order: 2, name: '法务审核', role: 'legal', required: true, canSkip: false, timeoutHours: 72 },
      { order: 3, name: '高管审批', role: 'executive', required: true, canSkip: false, timeoutHours: 48 },
    ],
    maxDaysToComplete: 7,
    escalationRules: ['超时自动上报', '敏感词触发加急审核', '金额超限需额外审批']
  },
  {
    level: 'INTERNAL',
    stages: [
      { order: 1, name: '自我检查', role: 'self', required: true, canSkip: false, timeoutHours: 12 },
      { order: 2, name: '同事审核', role: 'peer', required: true, canSkip: false, timeoutHours: 48 },
      { order: 3, name: '主管审批', role: 'manager', required: false, canSkip: true, timeoutHours: 24 },
    ],
    maxDaysToComplete: 5,
    escalationRules: ['涉及财务需主管审批', '对外发布需额外审核']
  },
  {
    level: 'CONTROLLED',
    stages: [
      { order: 1, name: '自我检查', role: 'self', required: true, canSkip: false, timeoutHours: 4 },
      { order: 2, name: 'AI合规检查', role: 'compliance', required: true, canSkip: false, timeoutHours: 1 },
    ],
    maxDaysToComplete: 2,
    escalationRules: ['AI检测到敏感信息需人工复核']
  },
  {
    level: 'OPEN',
    stages: [
      { order: 1, name: '自我检查', role: 'self', required: true, canSkip: true, timeoutHours: 2 },
    ],
    maxDaysToComplete: 1,
    escalationRules: []
  },
]

// ========== 国产AI模型配置 ==========
interface ChinaAIModelConfig {
  provider: AIProviderType
  name: string
  company: string
  apiEndpoint: string
  models: { id: string; name: string; contextLength: number }[]
  authHeader: string
  features: string[]
  dataRetentionDays: number
  complianceCerts: string[]
}

const CHINA_AI_MODELS: ChinaAIModelConfig[] = [
  {
    provider: 'qwen',
    name: '通义千问',
    company: '阿里云',
    apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: [
      { id: 'qwen-max', name: '通义千问Max', contextLength: 32000 },
      { id: 'qwen-plus', name: '通义千问Plus', contextLength: 131072 },
      { id: 'qwen-turbo', name: '通义千问Turbo', contextLength: 131072 },
      { id: 'qwen-long', name: '通义千问Long', contextLength: 10000000 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['长文本', '代码生成', '数学推理', '多轮对话'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级', 'ISO27001']
  },
  {
    provider: 'ernie',
    name: '文心一言',
    company: '百度',
    apiEndpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    models: [
      { id: 'ernie-4.0-8k', name: 'ERNIE 4.0', contextLength: 8192 },
      { id: 'ernie-3.5-128k', name: 'ERNIE 3.5', contextLength: 128000 },
      { id: 'ernie-speed-128k', name: 'ERNIE Speed', contextLength: 128000 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['中文理解', '知识问答', '文案创作', '代码生成'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级', 'SOC2']
  },
  {
    provider: 'glm',
    name: '智谱GLM',
    company: '智谱AI',
    apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4-Plus', contextLength: 128000 },
      { id: 'glm-4', name: 'GLM-4', contextLength: 128000 },
      { id: 'glm-4-long', name: 'GLM-4-Long', contextLength: 1000000 },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', contextLength: 128000 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['长文本', '代码生成', '数学', '多模态'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    company: '深度求索',
    apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextLength: 64000 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', contextLength: 64000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextLength: 64000 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['代码生成', '数学推理', '长文本', '性价比高'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'moonshot',
    name: 'Kimi',
    company: '月之暗面',
    apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
    models: [
      { id: 'moonshot-v1-8k', name: 'Kimi 8K', contextLength: 8192 },
      { id: 'moonshot-v1-32k', name: 'Kimi 32K', contextLength: 32768 },
      { id: 'moonshot-v1-128k', name: 'Kimi 128K', contextLength: 131072 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['超长文本', '文档分析', '联网搜索'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'baichuan',
    name: '百川',
    company: '百川智能',
    apiEndpoint: 'https://api.baichuan-ai.com/v1/chat/completions',
    models: [
      { id: 'Baichuan4', name: '百川4', contextLength: 32768 },
      { id: 'Baichuan3-Turbo-128k', name: '百川3 Turbo', contextLength: 131072 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['中文理解', '知识问答', '代码生成'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'minimax',
    name: 'MiniMax',
    company: 'MiniMax',
    apiEndpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    models: [
      { id: 'abab6.5s-chat', name: 'ABAB 6.5s', contextLength: 245760 },
      { id: 'abab6.5g-chat', name: 'ABAB 6.5g', contextLength: 8192 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['语音合成', '多模态', '长文本'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'yi',
    name: '零一万物',
    company: '零一万物',
    apiEndpoint: 'https://api.lingyiwanwu.com/v1/chat/completions',
    models: [
      { id: 'yi-large', name: 'Yi-Large', contextLength: 32768 },
      { id: 'yi-medium', name: 'Yi-Medium', contextLength: 16384 },
      { id: 'yi-spark', name: 'Yi-Spark', contextLength: 16384 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['多语言', '代码生成', '推理'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
  {
    provider: 'spark',
    name: '讯飞星火',
    company: '科大讯飞',
    apiEndpoint: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    models: [
      { id: 'generalv3.5', name: '星火3.5', contextLength: 8192 },
      { id: 'max-32k', name: '星火Max 32K', contextLength: 32768 },
      { id: '4.0Ultra', name: '星火4.0 Ultra', contextLength: 8192 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['语音识别', '多模态', '教育场景'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级', 'ISO27001']
  },
  {
    provider: 'hunyuan',
    name: '腾讯混元',
    company: '腾讯',
    apiEndpoint: 'https://hunyuan.tencentcloudapi.com',
    models: [
      { id: 'hunyuan-pro', name: '混元Pro', contextLength: 32768 },
      { id: 'hunyuan-standard', name: '混元Standard', contextLength: 32768 },
      { id: 'hunyuan-lite', name: '混元Lite', contextLength: 32768 },
    ],
    authHeader: 'Authorization: TC3-HMAC-SHA256',
    features: ['中文理解', '代码生成', '多轮对话'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级', 'ISO27001', 'SOC2']
  },
  {
    provider: 'doubao',
    name: '豆包',
    company: '字节跳动',
    apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: [
      { id: 'doubao-pro-32k', name: '豆包Pro 32K', contextLength: 32768 },
      { id: 'doubao-pro-128k', name: '豆包Pro 128K', contextLength: 131072 },
      { id: 'doubao-lite-32k', name: '豆包Lite', contextLength: 32768 },
    ],
    authHeader: 'Authorization: Bearer',
    features: ['多模态', '长文本', '代码生成'],
    dataRetentionDays: 0,
    complianceCerts: ['等保三级']
  },
]

// ========== 策略引擎类 ==========
class DocumentPolicyEngine {
  getDocumentTypes(): DocumentTypeConfig[] {
    return DOCUMENT_TYPES
  }

  getDocumentType(id: string): DocumentTypeConfig | undefined {
    return DOCUMENT_TYPES.find(t => t.id === id)
  }

  getSecurityLevel(documentTypeId: string): DocumentSecurityLevel {
    const docType = DOCUMENT_TYPES.find(t => t.id === documentTypeId)
    return docType?.securityLevel || 'CONTROLLED'
  }

  getKnowledgePolicy(level: DocumentSecurityLevel): KnowledgeSourcePolicy {
    return KNOWLEDGE_POLICIES.find(p => p.level === level) || KNOWLEDGE_POLICIES[2]
  }

  getAIModelPolicy(level: DocumentSecurityLevel): AIModelPolicy {
    return AI_MODEL_POLICIES.find(p => p.level === level) || AI_MODEL_POLICIES[2]
  }

  getAuditWorkflow(level: DocumentSecurityLevel): AuditWorkflow {
    return AUDIT_WORKFLOWS.find(w => w.level === level) || AUDIT_WORKFLOWS[2]
  }

  getChinaAIModels(): ChinaAIModelConfig[] {
    return CHINA_AI_MODELS
  }

  getRecommendedModels(level: DocumentSecurityLevel): ChinaAIModelConfig[] {
    const policy = this.getAIModelPolicy(level)
    return CHINA_AI_MODELS.filter(m => policy.preferredProviders.includes(m.provider))
  }

  getAllowedModels(level: DocumentSecurityLevel): ChinaAIModelConfig[] {
    const policy = this.getAIModelPolicy(level)
    return CHINA_AI_MODELS.filter(m => policy.allowedProviders.includes(m.provider))
  }

  isModelAllowed(provider: AIProviderType, level: DocumentSecurityLevel): boolean {
    const policy = this.getAIModelPolicy(level)
    return policy.allowedProviders.includes(provider)
  }

  isKnowledgeSourceAllowed(source: KnowledgeSource, level: DocumentSecurityLevel): boolean {
    const policy = this.getKnowledgePolicy(level)
    return policy.allowedSources.includes(source)
  }

  desensitize(content: string, level: DocumentSecurityLevel): { result: string; masked: { rule: string; count: number }[] } {
    let result = content
    const masked: { rule: string; count: number }[] = []

    for (const rule of DESENSITIZATION_RULES) {
      if (rule.appliesTo.includes(level)) {
        const matches = content.match(rule.pattern)
        if (matches && matches.length > 0) {
          result = result.replace(rule.pattern, rule.replacement)
          masked.push({ rule: rule.name, count: matches.length })
        }
      }
    }

    return { result, masked }
  }

  validateDocument(content: string, documentTypeId: string): {
    valid: boolean
    level: DocumentSecurityLevel
    warnings: string[]
    blockedSources: KnowledgeSource[]
    requiredAudit: AuditStage[]
  } {
    const level = this.getSecurityLevel(documentTypeId)
    const knowledgePolicy = this.getKnowledgePolicy(level)
    const auditWorkflow = this.getAuditWorkflow(level)
    const warnings: string[] = []

    // 检查是否包含敏感信息
    const { masked } = this.desensitize(content, level)
    if (masked.length > 0) {
      warnings.push(`检测到敏感信息：${masked.map(m => `${m.rule}(${m.count}处)`).join('、')}`)
    }

    // 检查是否需要审核
    const requiredAudit = auditWorkflow.stages.filter(s => s.required)

    return {
      valid: true,
      level,
      warnings,
      blockedSources: knowledgePolicy.blockedSources,
      requiredAudit,
    }
  }

  getSecurityLevelInfo(level: DocumentSecurityLevel): {
    name: string
    color: string
    icon: string
    description: string
  } {
    const info: Record<DocumentSecurityLevel, { name: string; color: string; icon: string; description: string }> = {
      'CONFIDENTIAL': {
        name: '机密级',
        color: '#dc2626',
        icon: '🔴',
        description: '最高安全等级，仅限本地处理，必须法务审核'
      },
      'INTERNAL': {
        name: '内部级',
        color: '#f59e0b',
        icon: '🟠',
        description: '内部使用，限国产云模型，需同事审核'
      },
      'CONTROLLED': {
        name: '受控级',
        color: '#3b82f6',
        icon: '🔵',
        description: '受控使用，需脱敏处理，自我审核'
      },
      'OPEN': {
        name: '开放级',
        color: '#22c55e',
        icon: '🟢',
        description: '可公开使用，无特殊限制'
      },
    }
    return info[level]
  }
}

export const documentPolicyEngine = new DocumentPolicyEngine()
export {
  DOCUMENT_TYPES,
  KNOWLEDGE_POLICIES,
  AI_MODEL_POLICIES,
  AUDIT_WORKFLOWS,
  CHINA_AI_MODELS,
  DESENSITIZATION_RULES,
}
export type {
  DocumentSecurityLevel,
  DocumentTypeConfig,
  KnowledgeSource,
  KnowledgeSourcePolicy,
  AIProviderType,
  AIModelPolicy,
  ChinaAIModelConfig,
  DesensitizationRule,
  AuditWorkflow,
  AuditStage,
}
