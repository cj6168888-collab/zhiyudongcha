import type { Email, InsertCalendarEvent } from '@shared/schema';
import { calendarScheduler } from './calendar-scheduler';
import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface ExtractedTask {
  id?: string;
  source: 'email' | 'chat' | 'document' | 'voice';
  sourceId: string;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'reply' | 'meeting' | 'document' | 'payment' | 'call' | 'review' | 'follow_up' | 'other';
  suggestedDeadline: Date | null;
  deadlineSource: string | null;
  assignee: string | null;
  relatedContacts: string[];
  confidence: number;
  extractedAt: Date;
  status: 'pending' | 'confirmed' | 'scheduled' | 'completed' | 'dismissed';
}

export interface ExtractionResult {
  sourceType: string;
  sourceId: string;
  tasks: ExtractedTask[];
  summary: string;
  extractedAt: Date;
}

const TASK_EXTRACTION_PROMPT = `你是小智的任务提取专家模块。从以下内容中识别并提取待办任务。

【提取规则】
1. 识别明确的行动要求（"请于...前完成"、"麻烦处理"等）
2. 识别隐含的行动要求（问询需要回复、报价需要确认等）
3. 识别会议/通话请求
4. 识别付款/财务相关任务
5. 识别文档/材料提交要求

【输出格式】
{
  "tasks": [
    {
      "title": "任务简短标题（10字以内）",
      "description": "任务详细描述",
      "priority": "low/normal/high/urgent",
      "category": "reply/meeting/document/payment/call/review/follow_up/other",
      "suggestedDeadline": "YYYY-MM-DD或null",
      "deadlineSource": "截止日期来源说明或null",
      "assignee": "指定负责人或null",
      "relatedContacts": ["相关联系人"],
      "confidence": 0.0-1.0
    }
  ],
  "summary": "整体任务摘要（一句话）"
}

【内容来源】
类型: {sourceType}
发送者: {sender}
时间: {date}

【内容】
{content}`;

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
          { role: 'system', content: '你是专业的任务提取助手，擅长从文本中识别待办事项和行动要求。' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.2,
        max_tokens: 1500,
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
      console.error('[TaskExtractor] Failed to parse JSON:', e);
      return null;
    }
  }
  return null;
}

function parseDeadline(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  } catch (e) {}
  return null;
}

export class TaskExtractorService {
  async extractFromEmail(email: Email): Promise<ExtractionResult> {
    const prompt = TASK_EXTRACTION_PROMPT
      .replace('{sourceType}', '邮件')
      .replace('{sender}', `${email.fromName || ''} <${email.fromEmail || ''}>`)
      .replace('{date}', email.receivedAt?.toISOString() || '')
      .replace('{content}', `主题: ${email.subject || ''}\n\n${(email.bodyText || '').substring(0, 3000)}`);

    try {
      const response = await callDashScopeAPI(prompt);
      const parsed = parseJSONResponse(response);

      if (!parsed) {
        return this.createEmptyResult('email', email.id);
      }

      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        source: 'email' as const,
        sourceId: email.id,
        title: t.title || '未命名任务',
        description: t.description || '',
        priority: t.priority || 'normal',
        category: t.category || 'other',
        suggestedDeadline: parseDeadline(t.suggestedDeadline),
        deadlineSource: t.deadlineSource || null,
        assignee: t.assignee || null,
        relatedContacts: t.relatedContacts || [email.fromEmail].filter(Boolean),
        confidence: t.confidence || 0.8,
        extractedAt: new Date(),
        status: 'pending' as const,
      }));

      return {
        sourceType: 'email',
        sourceId: email.id,
        tasks,
        summary: parsed.summary || `从邮件"${email.subject}"中提取了${tasks.length}个任务`,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('[TaskExtractor] Email extraction failed:', error);
      return this.createEmptyResult('email', email.id);
    }
  }

  async extractFromText(
    text: string,
    sourceType: 'chat' | 'document' | 'voice',
    sourceId: string,
    sender?: string
  ): Promise<ExtractionResult> {
    const prompt = TASK_EXTRACTION_PROMPT
      .replace('{sourceType}', sourceType === 'chat' ? '聊天消息' : sourceType === 'document' ? '文档' : '语音转录')
      .replace('{sender}', sender || '未知')
      .replace('{date}', new Date().toISOString())
      .replace('{content}', text.substring(0, 3000));

    try {
      const response = await callDashScopeAPI(prompt);
      const parsed = parseJSONResponse(response);

      if (!parsed) {
        return this.createEmptyResult(sourceType, sourceId);
      }

      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        source: sourceType,
        sourceId,
        title: t.title || '未命名任务',
        description: t.description || '',
        priority: t.priority || 'normal',
        category: t.category || 'other',
        suggestedDeadline: parseDeadline(t.suggestedDeadline),
        deadlineSource: t.deadlineSource || null,
        assignee: t.assignee || null,
        relatedContacts: t.relatedContacts || [],
        confidence: t.confidence || 0.7,
        extractedAt: new Date(),
        status: 'pending' as const,
      }));

      return {
        sourceType,
        sourceId,
        tasks,
        summary: parsed.summary || `提取了${tasks.length}个任务`,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('[TaskExtractor] Text extraction failed:', error);
      return this.createEmptyResult(sourceType, sourceId);
    }
  }

  async extractAndCreateCalendarEvents(
    tasks: ExtractedTask[],
    userId: string = 'master'
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const result = { created: 0, skipped: 0, errors: [] as string[] };

    for (const task of tasks) {
      if (task.status !== 'pending') {
        result.skipped++;
        continue;
      }

      if (task.category === 'meeting' && task.suggestedDeadline) {
        try {
          const eventData: InsertCalendarEvent = {
            title: task.title,
            description: task.description,
            startTime: task.suggestedDeadline,
            endTime: new Date(task.suggestedDeadline.getTime() + 60 * 60 * 1000),
            eventType: 'MEETING',
            allDay: false,
            priority: task.priority === 'urgent' ? 'CRITICAL' : task.priority === 'high' ? 'HIGH' : 'NORMAL',
          };
          const { event, conflict } = await calendarScheduler.createEvent(eventData);
          if (event) {
            result.created++;
          } else if (conflict) {
            result.errors.push(`会议"${task.title}"与现有日程冲突`);
          }
        } catch (error) {
          result.errors.push(`创建会议"${task.title}"失败: ${error}`);
        }
      } else if (task.suggestedDeadline) {
        try {
          const eventData: InsertCalendarEvent = {
            title: `[待办] ${task.title}`,
            description: task.description,
            startTime: task.suggestedDeadline,
            endTime: task.suggestedDeadline,
            eventType: 'WORK',
            allDay: true,
            priority: task.priority === 'urgent' ? 'CRITICAL' : task.priority === 'high' ? 'HIGH' : 'NORMAL',
          };
          const { event, conflict } = await calendarScheduler.createEvent(eventData);
          if (event) {
            result.created++;
          } else if (conflict) {
            result.errors.push(`待办"${task.title}"与现有日程冲突`);
          }
        } catch (error) {
          result.errors.push(`创建待办"${task.title}"失败: ${error}`);
        }
      } else {
        result.skipped++;
      }
    }

    return result;
  }

  async batchExtractFromEmails(emails: Email[]): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    
    for (const email of emails) {
      try {
        const result = await this.extractFromEmail(email);
        results.push(result);
      } catch (error) {
        console.error(`[TaskExtractor] Failed to extract from email ${email.id}:`, error);
      }
    }
    
    return results;
  }

  generateTaskSummary(results: ExtractionResult[]): string {
    const allTasks = results.flatMap(r => r.tasks);
    
    if (allTasks.length === 0) {
      return '未发现需要处理的任务。';
    }

    const urgentTasks = allTasks.filter(t => t.priority === 'urgent');
    const highTasks = allTasks.filter(t => t.priority === 'high');
    const meetingTasks = allTasks.filter(t => t.category === 'meeting');
    const paymentTasks = allTasks.filter(t => t.category === 'payment');

    let summary = `📋 共发现 ${allTasks.length} 个待办任务\n`;
    
    if (urgentTasks.length > 0) {
      summary += `\n🔴 紧急任务 (${urgentTasks.length}):\n`;
      urgentTasks.forEach(t => {
        summary += `  • ${t.title}${t.suggestedDeadline ? ` (截止: ${t.suggestedDeadline.toLocaleDateString('zh-CN')})` : ''}\n`;
      });
    }
    
    if (highTasks.length > 0) {
      summary += `\n🟠 重要任务 (${highTasks.length}):\n`;
      highTasks.slice(0, 3).forEach(t => {
        summary += `  • ${t.title}\n`;
      });
      if (highTasks.length > 3) {
        summary += `  ...还有 ${highTasks.length - 3} 个\n`;
      }
    }
    
    if (meetingTasks.length > 0) {
      summary += `\n📅 会议安排 (${meetingTasks.length}):\n`;
      meetingTasks.slice(0, 2).forEach(t => {
        summary += `  • ${t.title}\n`;
      });
    }
    
    if (paymentTasks.length > 0) {
      summary += `\n💰 付款相关 (${paymentTasks.length}):\n`;
      paymentTasks.forEach(t => {
        summary += `  • ${t.title}\n`;
      });
    }

    return summary;
  }

  private createEmptyResult(sourceType: string, sourceId: string): ExtractionResult {
    return {
      sourceType,
      sourceId,
      tasks: [],
      summary: '未发现明确的待办任务',
      extractedAt: new Date(),
    };
  }
}

export const taskExtractor = new TaskExtractorService();
