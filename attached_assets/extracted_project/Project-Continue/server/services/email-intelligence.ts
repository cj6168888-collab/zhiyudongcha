import type { Email } from '@shared/schema';
import { storage } from '../storage';
import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface EmailAnalysis {
  emailId: string;
  surfaceIntent: string;
  hiddenIntent: string | null;
  urgencyLevel: 'low' | 'normal' | 'high' | 'urgent';
  emotionalTone: string;
  keyPoints: string[];
  suggestedResponses: SuggestedResponse[];
  actionItems: ActionItem[];
  riskAssessment: RiskAssessment | null;
  attachmentClassification: AttachmentClassification[];
  relationshipContext: string | null;
  analyzedAt: Date;
}

export interface SuggestedResponse {
  type: 'accept' | 'decline' | 'negotiate' | 'delay' | 'clarify';
  label: string;
  script: string;
  tone: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ActionItem {
  description: string;
  deadline: string | null;
  priority: 'low' | 'normal' | 'high';
  category: 'reply' | 'task' | 'meeting' | 'document' | 'payment' | 'other';
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
}

export interface AttachmentClassification {
  filename: string;
  type: 'invoice' | 'contract' | 'quotation' | 'report' | 'image' | 'document' | 'other';
  suggestedName: string;
  suggestedFolder: string;
}

const EMAIL_ANALYSIS_PROMPT = `你是小智的邮件分析专家模块。分析以下邮件，提供深度洞察。

【分析维度】
1. 表面意图：邮件明确表达的目的
2. 潜在意图：发送者可能隐藏的真实目的（如果有）
3. 情绪基调：发送者的情绪状态
4. 关键要点：邮件中的核心信息（最多5条）
5. 建议回复：根据不同策略提供2-3种回复话术
6. 待办事项：需要采取的行动
7. 风险评估：是否存在潜在风险

【输出格式】
请以JSON格式输出分析结果：
{
  "surfaceIntent": "表面意图描述",
  "hiddenIntent": "潜在意图（没有则为null）",
  "urgencyLevel": "low/normal/high/urgent",
  "emotionalTone": "情绪描述",
  "keyPoints": ["要点1", "要点2"],
  "suggestedResponses": [
    {
      "type": "accept/decline/negotiate/delay/clarify",
      "label": "策略名称",
      "script": "具体回复话术",
      "tone": "语气描述",
      "riskLevel": "low/medium/high"
    }
  ],
  "actionItems": [
    {
      "description": "待办描述",
      "deadline": "截止日期或null",
      "priority": "low/normal/high",
      "category": "reply/task/meeting/document/payment/other"
    }
  ],
  "riskAssessment": {
    "level": "low/medium/high",
    "factors": ["风险因素"],
    "recommendations": ["建议措施"]
  }
}

【邮件内容】
发件人: {from}
收件人: {to}
主题: {subject}
时间: {date}

{body}`;

const ATTACHMENT_ANALYSIS_PROMPT = `分析以下附件列表，判断每个附件的类型并建议重命名和归档位置。

【附件分类规则】
- invoice: 发票、税单
- contract: 合同、协议
- quotation: 报价单、价格表
- report: 报告、汇报
- image: 图片、截图
- document: 其他文档

【输出格式】
{
  "attachments": [
    {
      "filename": "原文件名",
      "type": "类型",
      "suggestedName": "建议的新文件名（包含日期和关键信息）",
      "suggestedFolder": "建议存放目录"
    }
  ]
}

【附件列表】
{attachments}

【邮件上下文】
主题: {subject}
发件人: {from}`;

async function callDashScopeAPI(prompt: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured');
  }

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: '你是专业的邮件分析助手，擅长识别邮件意图和提供应对策略。' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.3,
        max_tokens: 2000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DashScope API error: ${error}`);
  }

  const data = await response.json();
  return data.output?.choices?.[0]?.message?.content || '';
}

function parseJSONResponse(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[EmailIntelligence] Failed to parse JSON:', e);
      return null;
    }
  }
  return null;
}

export class EmailIntelligenceService {
  private analysisCache: Map<string, EmailAnalysis> = new Map();

  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    const cacheKey = email.id;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const prompt = EMAIL_ANALYSIS_PROMPT
      .replace('{from}', `${email.fromName} <${email.fromEmail}>`)
      .replace('{to}', email.toEmails?.join(', ') || '')
      .replace('{subject}', email.subject || '')
      .replace('{date}', email.receivedAt?.toISOString() || '')
      .replace('{body}', (email.bodyText || '').substring(0, 3000));

    try {
      const response = await callDashScopeAPI(prompt);
      const parsed = parseJSONResponse(response);

      if (!parsed) {
        return this.createFallbackAnalysis(email);
      }

      const analysis: EmailAnalysis = {
        emailId: email.id,
        surfaceIntent: parsed.surfaceIntent || '一般沟通',
        hiddenIntent: parsed.hiddenIntent || null,
        urgencyLevel: parsed.urgencyLevel || 'normal',
        emotionalTone: parsed.emotionalTone || '中性',
        keyPoints: parsed.keyPoints || [],
        suggestedResponses: (parsed.suggestedResponses || []).map((r: any) => ({
          type: r.type || 'clarify',
          label: r.label || '回复',
          script: r.script || '',
          tone: r.tone || '礼貌',
          riskLevel: r.riskLevel || 'low',
        })),
        actionItems: (parsed.actionItems || []).map((a: any) => ({
          description: a.description || '',
          deadline: a.deadline || null,
          priority: a.priority || 'normal',
          category: a.category || 'other',
        })),
        riskAssessment: parsed.riskAssessment || null,
        attachmentClassification: [],
        relationshipContext: null,
        analyzedAt: new Date(),
      };

      if (email.hasAttachments) {
        const attachments = await storage.getEmailAttachments(email.id);
        if (attachments.length > 0) {
          analysis.attachmentClassification = await this.classifyAttachments(
            attachments.map(a => a.filename),
            email.subject || '',
            email.fromEmail || ''
          );
        }
      }

      this.analysisCache.set(cacheKey, analysis);
      return analysis;
    } catch (error) {
      console.error('[EmailIntelligence] Analysis failed:', error);
      return this.createFallbackAnalysis(email);
    }
  }

  async classifyAttachments(
    filenames: string[],
    subject: string,
    fromEmail: string
  ): Promise<AttachmentClassification[]> {
    if (filenames.length === 0) return [];

    const prompt = ATTACHMENT_ANALYSIS_PROMPT
      .replace('{attachments}', filenames.map((f, i) => `${i + 1}. ${f}`).join('\n'))
      .replace('{subject}', subject)
      .replace('{from}', fromEmail);

    try {
      const response = await callDashScopeAPI(prompt);
      const parsed = parseJSONResponse(response);

      if (parsed?.attachments) {
        return parsed.attachments.map((a: any) => ({
          filename: a.filename || '',
          type: a.type || 'other',
          suggestedName: a.suggestedName || a.filename,
          suggestedFolder: a.suggestedFolder || '其他',
        }));
      }
    } catch (error) {
      console.error('[EmailIntelligence] Attachment classification failed:', error);
    }

    return filenames.map(f => ({
      filename: f,
      type: this.guessAttachmentType(f),
      suggestedName: f,
      suggestedFolder: '未分类',
    }));
  }

  private guessAttachmentType(filename: string): AttachmentClassification['type'] {
    const lower = filename.toLowerCase();
    if (lower.includes('发票') || lower.includes('invoice')) return 'invoice';
    if (lower.includes('合同') || lower.includes('contract')) return 'contract';
    if (lower.includes('报价') || lower.includes('quote')) return 'quotation';
    if (lower.includes('报告') || lower.includes('report')) return 'report';
    if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(lower)) return 'image';
    return 'document';
  }

  private createFallbackAnalysis(email: Email): EmailAnalysis {
    return {
      emailId: email.id,
      surfaceIntent: '一般沟通邮件',
      hiddenIntent: null,
      urgencyLevel: email.importance as any || 'normal',
      emotionalTone: '中性',
      keyPoints: [],
      suggestedResponses: [{
        type: 'clarify',
        label: '礼貌回复',
        script: `感谢您的邮件。关于"${email.subject}"，我会尽快回复您。`,
        tone: '礼貌专业',
        riskLevel: 'low',
      }],
      actionItems: [{
        description: '回复此邮件',
        deadline: null,
        priority: 'normal',
        category: 'reply',
      }],
      riskAssessment: null,
      attachmentClassification: [],
      relationshipContext: null,
      analyzedAt: new Date(),
    };
  }

  async generateQuickInsight(email: Email): Promise<string> {
    const analysis = await this.analyzeEmail(email);
    
    let insight = `📧 ${email.subject}\n`;
    insight += `发件人: ${email.fromName || email.fromEmail}\n\n`;
    
    insight += `【意图分析】\n`;
    insight += `表面: ${analysis.surfaceIntent}\n`;
    if (analysis.hiddenIntent) {
      insight += `⚠️ 潜台词: ${analysis.hiddenIntent}\n`;
    }
    
    if (analysis.keyPoints.length > 0) {
      insight += `\n【关键要点】\n`;
      analysis.keyPoints.forEach((p, i) => {
        insight += `${i + 1}. ${p}\n`;
      });
    }
    
    if (analysis.suggestedResponses.length > 0) {
      insight += `\n【建议回复】\n`;
      analysis.suggestedResponses.slice(0, 2).forEach(r => {
        insight += `• ${r.label}: "${r.script.substring(0, 50)}..."\n`;
      });
    }
    
    if (analysis.riskAssessment && analysis.riskAssessment.level !== 'low') {
      insight += `\n⚠️ 风险提示: ${analysis.riskAssessment.factors.join(', ')}\n`;
    }
    
    return insight;
  }

  async batchAnalyze(emails: Email[]): Promise<Map<string, EmailAnalysis>> {
    const results = new Map<string, EmailAnalysis>();
    
    for (const email of emails) {
      try {
        const analysis = await this.analyzeEmail(email);
        results.set(email.id, analysis);
      } catch (error) {
        console.error(`[EmailIntelligence] Failed to analyze email ${email.id}:`, error);
      }
    }
    
    return results;
  }

  clearCache(emailId?: string): void {
    if (emailId) {
      this.analysisCache.delete(emailId);
    } else {
      this.analysisCache.clear();
    }
  }
}

export const emailIntelligence = new EmailIntelligenceService();
