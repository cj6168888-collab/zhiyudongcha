/**
 * 扣子(Coze) API 集成服务 - 增强版
 *
 * 提供对扣子AI平台的API调用能力
 * 支持文档处理、图像生成、数据分析等多种工作流
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from './logger';
const logger = createServiceLogger('CozeAPI');

export const COZE_API_BASE = 'https://api.coze.cn/v1';

/**
 * 扣子API配置
 */
export interface CozeConfig {
  apiKey: string;
  botId?: string;
  workflowId?: string;
}

/**
 * 扣子API请求选项
 */
export interface CozeRequestOptions {
  query?: string;
  files?: string[];
  workflowId?: string;
  parameters?: Record<string, any>;
}

/**
 * 扣子API响应
 */
export interface CozeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  usage?: {
    tokens: number;
    duration: number;
  };
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: 'document' | 'image' | 'data' | 'code' | 'business' | 'general';
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'file';
    required: boolean;
    default?: unknown;
    description?: string;
  }>;
  outputType?: string;
}

/**
 * 预设工作流注册表
 */
const WORKFLOW_REGISTRY: WorkflowDefinition[] = [
  // 文档处理
  {
    id: 'doc_format',
    name: '文档排版',
    description: '自动格式化文档，优化排版和样式',
    category: 'document',
    parameters: {
      content: { type: 'string', required: true, description: '文档内容' },
      style: { type: 'string', required: false, default: 'formal', description: '排版风格' },
    },
    outputType: 'text',
  },
  {
    id: 'doc_summary',
    name: '文档摘要',
    description: '提取文档核心要点，生成摘要',
    category: 'document',
    parameters: {
      content: { type: 'string', required: true },
      maxLength: { type: 'number', required: false, default: 200 },
    },
    outputType: 'text',
  },
  {
    id: 'doc_translate',
    name: '文档翻译',
    description: '高质量文档翻译',
    category: 'document',
    parameters: {
      content: { type: 'string', required: true },
      targetLang: { type: 'string', required: true },
    },
    outputType: 'text',
  },
  {
    id: 'doc_polish',
    name: '文章润色',
    description: '优化文章表达，提升可读性',
    category: 'document',
    parameters: {
      content: { type: 'string', required: true },
      style: { type: 'string', required: false, default: 'professional' },
    },
    outputType: 'text',
  },

  // 商业文档
  {
    id: 'report_generate',
    name: '报告生成',
    description: '生成各类商业报告',
    category: 'business',
    parameters: {
      type: { type: 'string', required: true, description: '报告类型' },
      data: { type: 'string', required: true },
      period: { type: 'string', required: false },
    },
    outputType: 'document',
  },
  {
    id: 'proposal_create',
    name: '方案撰写',
    description: '创建商业提案或项目方案',
    category: 'business',
    parameters: {
      topic: { type: 'string', required: true },
      audience: { type: 'string', required: false },
      requirements: { type: 'string', required: false },
    },
    outputType: 'document',
  },
  {
    id: 'contract_draft',
    name: '合同起草',
    description: '生成标准合同模板',
    category: 'business',
    parameters: {
      type: { type: 'string', required: true, description: '合同类型' },
      parties: { type: 'string', required: true },
      terms: { type: 'string', required: false },
    },
    outputType: 'document',
  },

  // PPT相关
  {
    id: 'ppt_outline',
    name: 'PPT大纲',
    description: '生成PPT演示大纲',
    category: 'document',
    parameters: {
      topic: { type: 'string', required: true },
      slides: { type: 'number', required: false, default: 10 },
      audience: { type: 'string', required: false },
    },
    outputType: 'json',
  },
  {
    id: 'ppt_content',
    name: 'PPT内容',
    description: '生成PPT每页详细内容',
    category: 'document',
    parameters: {
      outline: { type: 'string', required: true },
      slideIndex: { type: 'number', required: false },
    },
    outputType: 'json',
  },

  // 数据分析
  {
    id: 'data_analyze',
    name: '数据分析',
    description: '分析数据并生成洞察',
    category: 'data',
    parameters: {
      data: { type: 'string', required: true },
      question: { type: 'string', required: false },
    },
    outputType: 'json',
  },
  {
    id: 'chart_generate',
    name: '图表生成',
    description: '根据数据生成图表建议',
    category: 'data',
    parameters: {
      data: { type: 'string', required: true },
      chartType: { type: 'string', required: false },
    },
    outputType: 'json',
  },

  // 代码相关
  {
    id: 'code_review',
    name: '代码审查',
    description: '审查代码并提供改进建议',
    category: 'code',
    parameters: {
      code: { type: 'string', required: true },
      language: { type: 'string', required: false },
    },
    outputType: 'text',
  },
  {
    id: 'code_explain',
    name: '代码解释',
    description: '解释代码功能和逻辑',
    category: 'code',
    parameters: {
      code: { type: 'string', required: true },
      level: { type: 'string', required: false, default: 'beginner' },
    },
    outputType: 'text',
  },

  // 图像相关
  {
    id: 'image_desc',
    name: '图像描述',
    description: '描述图像内容',
    category: 'image',
    parameters: {
      imageUrl: { type: 'string', required: true },
      detail: { type: 'string', required: false, default: 'normal' },
    },
    outputType: 'text',
  },
  {
    id: 'ocr_extract',
    name: '文字识别',
    description: '从图像中提取文字',
    category: 'image',
    parameters: {
      imageUrl: { type: 'string', required: true },
    },
    outputType: 'text',
  },
];

// ============ 扣子API服务 ============

class CozeAPIService {
  private static instance: CozeAPIService | null = null;

  private apiKey: string = '';
  private defaultWorkflowId: string = '';
  private workflowOverrides: Record<string, string> = {};

  private constructor() {
    // 从环境变量读取配置
    this.apiKey = process.env.COZE_API_KEY || '';
    this.defaultWorkflowId = process.env.COZE_WORKFLOW_ID || '';

    // 读取工作流覆盖配置
    this.workflowOverrides = {
      format: process.env.COZE_WORKFLOW_FORMAT || '',
      polish: process.env.COZE_WORKFLOW_POLISH || '',
      translate: process.env.COZE_WORKFLOW_TRANSLATE || '',
      summarize: process.env.COZE_WORKFLOW_SUMMARIZE || '',
      ppt: process.env.COZE_WORKFLOW_PPT || '',
      report: process.env.COZE_WORKFLOW_REPORT || '',
    };

    if (this.apiKey) {
      logger.info('Coze API initialized from environment');
    } else {
      logger.warn('Coze API key not configured');
    }
  }

  public static getInstance(): CozeAPIService {
    if (!CozeAPIService.instance) {
      CozeAPIService.instance = new CozeAPIService();
    }
    return CozeAPIService.instance;
  }

  /**
   * 从用户设置更新配置
   */
  public updateFromSettings(settings: Record<string, string>): void {
    if (settings.cozeEnabled === 'true' && settings.cozeApiKey) {
      this.apiKey = settings.cozeApiKey;
    }
    if (settings.cozeWorkflowId) {
      this.defaultWorkflowId = settings.cozeWorkflowId;
    }

    // 更新工作流覆盖
    if (settings.cozeWorkflowDocFormat) this.workflowOverrides.format = settings.cozeWorkflowDocFormat;
    if (settings.cozeWorkflowDocPolish) this.workflowOverrides.polish = settings.cozeWorkflowDocPolish;
    if (settings.cozeWorkflowDocTranslate) this.workflowOverrides.translate = settings.cozeWorkflowDocTranslate;
    if (settings.cozeWorkflowDocSummarize) this.workflowOverrides.summarize = settings.cozeWorkflowDocSummarize;
    if (settings.cozeWorkflowPpt) this.workflowOverrides.ppt = settings.cozeWorkflowPpt;
    if (settings.cozeWorkflowReport) this.workflowOverrides.report = settings.cozeWorkflowReport;
    if (settings.cozeWorkflowCodeReview) this.workflowOverrides.codeReview = settings.cozeWorkflowCodeReview;

    logger.info({ hasApiKey: !!this.apiKey, workflows: Object.values(this.workflowOverrides).filter(Boolean).length }, 'Coze API updated from settings');
  }

  /**
   * 获取当前配置状态
   */
  public getConfig(): { configured: boolean; hasWorkflows: number } {
    const configured = !!this.apiKey;
    const hasWorkflows = Object.values(this.workflowOverrides).filter(Boolean).length;
    return { configured, hasWorkflows };
  }

  /**
   * 获取工作流ID
   */
  private getWorkflowId(key: string): string {
    return this.workflowOverrides[key] || this.defaultWorkflowId;
  }

  /**
   * 配置API密钥
   */
  public configure(config: CozeConfig): void {
    this.apiKey = config.apiKey || this.apiKey;
    this.defaultWorkflowId = config.workflowId || this.defaultWorkflowId;
    logger.info('Coze API configured');
  }

  /**
   * 检查是否已配置
   */
  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * 调用扣子工作流
   */
  public async callWorkflow(
    workflowId: string,
    input: Record<string, any>
  ): Promise<CozeResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: '扣子API未配置，请设置 COZE_API_KEY 环境变量',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${COZE_API_BASE}/workflows/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          parameters: input,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        logger.info({ workflowId, duration: Date.now() - startTime }, 'Workflow called successfully');
        return {
          success: true,
          data: data.data,
          usage: {
            tokens: data.usage?.total_tokens || 0,
            duration: Date.now() - startTime,
          },
        };
      } else {
        logger.error({ status: response.status, data }, 'Workflow call failed');
        return {
          success: false,
          error: data.message || '调用失败',
        };
      }
    } catch (error) {
      logger.error({ err: error }, 'Workflow call error');
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 文档排版
   */
  public async formatDocument(content: string): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('format') || this.defaultWorkflowId;

    if (!workflowId) {
      return {
        success: true,
        data: {
          formatted: content,
          message: '扣子工作流未配置，已保留原格式',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      content,
      task: 'format',
    });
  }

  /**
   * 内容润色
   */
  public async polishContent(content: string, style?: 'formal' | 'casual' | 'professional'): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('polish') || this.defaultWorkflowId;

    if (!workflowId) {
      return {
        success: true,
        data: {
          polished: content,
          message: '扣子工作流未配置，已保留原内容',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      content,
      task: 'polish',
      style: style || 'professional',
    });
  }

  /**
   * 翻译
   */
  public async translate(content: string, targetLang: string = '中文'): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('translate');

    if (!workflowId) {
      return {
        success: true,
        data: {
          translated: content,
          targetLang,
          message: '扣子工作流未配置，已返回原文',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      content,
      task: 'translate',
      target_lang: targetLang,
    });
  }

  /**
   * 总结
   */
  public async summarize(content: string, maxLength?: number): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('summarize');

    if (!workflowId) {
      return {
        success: true,
        data: {
          summary: content.substring(0, maxLength || 200),
          message: '扣子工作流未配置，已截取前200字符',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      content,
      task: 'summarize',
      max_length: maxLength,
    });
  }

  /**
   * 问答
   */
  public async ask(question: string, context?: string): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('qa');

    if (!workflowId) {
      return {
        success: false,
        error: '扣子问答工作流未配置',
      };
    }

    return this.callWorkflow(workflowId, {
      question,
      context: context || '',
    });
  }

  /**
   * 通用聊天
   */
  public async chat(message: string): Promise<CozeResponse> {
    const botId = process.env.COZE_BOT_ID;

    if (!botId || !this.apiKey) {
      return {
        success: false,
        error: '扣子Bot未配置',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${COZE_API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          bot_id: botId,
          user_id: 'xiaozhi-assistant',
          query: message,
          stream: false,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        logger.info({ duration: Date.now() - startTime }, 'Chat completed');
        return {
          success: true,
          data: {
            response: data.messages?.[0]?.content || '',
            conversationId: data.conversation_id,
          },
          usage: {
            tokens: data.usage?.total_tokens || 0,
            duration: Date.now() - startTime,
          },
        };
      } else {
        logger.error({ status: response.status, data }, 'Chat failed');
        return {
          success: false,
          error: data.message || '聊天失败',
        };
      }
    } catch (error) {
      logger.error({ err: error }, 'Chat error');
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // ============ 增强功能 ============

  /**
   * 获取工作流列表
   */
  public getWorkflows(): WorkflowDefinition[] {
    return WORKFLOW_REGISTRY;
  }

  /**
   * 获取指定分类的工作流
   */
  public getWorkflowsByCategory(category: WorkflowDefinition['category']): WorkflowDefinition[] {
    return WORKFLOW_REGISTRY.filter(w => w.category === category);
  }

  /**
   * 获取工作流详情
   */
  public getWorkflow(id: string): WorkflowDefinition | undefined {
    return WORKFLOW_REGISTRY.find(w => w.id === id);
  }

  /**
   * 智能调用 - 根据内容自动选择工作流
   */
  public async smartCall(content: string, context?: Record<string, any>): Promise<CozeResponse> {
    // 分析内容类型
    const contentType = this.analyzeContentType(content);

    switch (contentType) {
      case 'document':
        return this.formatDocument(content);
      case 'code':
        return this.callWorkflow('code_review', { code: content, ...context });
      case 'data':
        return this.callWorkflow('data_analyze', { data: content, ...context });
      default:
        return this.chat(content);
    }
  }

  /**
   * 分析内容类型
   */
  private analyzeContentType(content: string): 'document' | 'code' | 'data' | 'image' | 'general' {
    const lowerContent = content.toLowerCase();

    // 代码特征
    const codePatterns = [
      /^(function|const|let|var|class|import|export|def|public|private)/m,
      /[{}\[\]();]/,
      /=>/,
      /\.\w+\(/,
    ];

    // 数据特征
    const dataPatterns = [
      /^[\d\s,.+-]+$/m,
      /^\d+,\d+,\d+$/m,
    ];

    // 图片特征
    const imagePatterns = [
      /\.(jpg|jpeg|png|gif|webp|bmp)/i,
      /^data:image\//,
      /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)/i,
    ];

    if (codePatterns.some(p => p.test(content))) return 'code';
    if (dataPatterns.some(p => p.test(content))) return 'data';
    if (imagePatterns.some(p => p.test(content))) return 'image';

    return 'document';
  }

  /**
   * 批量处理
   */
  public async batchProcess(
    items: Array<{ workflow: string; input: Record<string, any> }>
  ): Promise<Array<CozeResponse>> {
    const results: Array<CozeResponse> = [];

    for (const item of items) {
      const result = await this.callWorkflow(item.workflow, item.input);
      results.push(result);
    }

    return results;
  }

  /**
   * PPT内容生成
   */
  public async generatePPTContent(
    topic: string,
    slides: number = 10,
    audience?: string
  ): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('ppt');

    if (!workflowId) {
      // 返回PPT大纲结构
      const outline = this.generatePPTFallback(topic, slides);
      return {
        success: true,
        data: {
          outline,
          message: '扣子工作流未配置，使用本地生成',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      topic,
      slides,
      audience: audience || 'general',
    });
  }

  /**
   * PPT大纲后备生成
   */
  private generatePPTFallback(topic: string, slides: number): object[] {
    const outline = [];

    // 封面
    outline.push({
      type: 'cover',
      title: topic,
      subtitle: new Date().toLocaleDateString('zh-CN'),
    });

    // 目录
    outline.push({
      type: 'toc',
      title: '目录',
    });

    // 内容页
    for (let i = 0; i < slides - 4; i++) {
      outline.push({
        type: 'content',
        title: `第${i + 1}部分`,
        bullets: ['要点1', '要点2', '要点3'],
      });
    }

    // 总结
    outline.push({
      type: 'summary',
      title: '总结',
      keyPoints: ['核心要点回顾'],
    });

    // 结束页
    outline.push({
      type: 'end',
      title: '谢谢',
    });

    return outline;
  }

  /**
   * 商业报告生成
   */
  public async generateBusinessReport(
    type: 'monthly' | 'quarterly' | 'annual' | 'project' | 'custom',
    data: Record<string, any>,
    period?: string
  ): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('report');

    const reportTypes = {
      monthly: '月度工作报告',
      quarterly: '季度工作报告',
      annual: '年度工作报告',
      project: '项目进展报告',
      custom: '自定义报告',
    };

    if (!workflowId) {
      // 返回报告模板
      return {
        success: true,
        data: {
          report: {
            type: reportTypes[type],
            period: period || new Date().toISOString().slice(0, 7),
            sections: [
              { title: '概述', content: '在此添加概述内容...' },
              { title: '主要成果', content: '在此添加成果...' },
              { title: '数据分析', content: JSON.stringify(data) },
              { title: '问题与挑战', content: '在此添加问题...' },
              { title: '下阶段计划', content: '在此添加计划...' },
            ],
          },
          message: '扣子工作流未配置，使用本地生成',
        },
      };
    }

    return this.callWorkflow(workflowId, {
      type: reportTypes[type],
      data: JSON.stringify(data),
      period,
    });
  }

  /**
   * 智能问答
   */
  public async intelligentQA(
    question: string,
    options?: {
      category?: string;
      context?: string;
      history?: Array<{ q: string; a: string }>;
    }
  ): Promise<CozeResponse> {
    const workflowId = this.getWorkflowId('qa');

    if (!workflowId) {
      return {
        success: true,
        data: {
          answer: `关于"${question}"，我需要更多信息才能准确回答。请提供更多上下文或具体细节。`,
          suggestions: [
            '您可以尝试更具体地描述您的问题',
            '提供相关的背景信息会有助于获得更准确的答案',
          ],
        },
      };
    }

    return this.callWorkflow(workflowId, {
      question,
      category: options?.category,
      context: options?.context,
      history: options?.history,
    });
  }
}

// 导出实例
const cozeAPI = CozeAPIService.getInstance();

// 便捷函数
async function callCozeAPI(
  action: 'format' | 'polish' | 'translate' | 'summarize' | 'chat',
  content: string,
  options?: Record<string, unknown>
): Promise<CozeResponse> {
  switch (action) {
    case 'format':
      return cozeAPI.formatDocument(content);
    case 'polish':
      return cozeAPI.polishContent(content, options?.style);
    case 'translate':
      return cozeAPI.translate(content, options?.targetLang);
    case 'summarize':
      return cozeAPI.summarize(content, options?.maxLength);
    case 'chat':
      return cozeAPI.chat(content);
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// 导出
export { cozeAPI, callCozeAPI };
export default cozeAPI;
