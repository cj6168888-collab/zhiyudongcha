/**
 * P5 — Dream Review Service（梦境复盘）
 * 每日跨对话复盘：聚合当天已完成 Conversation，通过 AI 发现
 * 遗漏任务、项目风险、关系信号、记忆冲突，生成候选项供用户确认。
 */
import { createServiceLogger } from '../../lib/logger';
import { getDatabase } from '../../db';
import { sql } from 'drizzle-orm';
import { AIProviderChain } from '../../lib/ai-provider';
import { conversationService } from '../conversation/ConversationService';

const logger = createServiceLogger('DreamReviewService');

const DREAM_REVIEW_SYSTEM_PROMPT = `你是一位专注于复盘分析的助理。用户会给你今天所有对话的摘要合集。

请从中发现：
1. missed_tasks: 对话中提及但未明确跟进的任务（对话里说了"要做X"却没有对应行动项）
2. project_risks: 影响项目/合作的风险信号（进度延误、分歧、潜在纠纷）
3. relationship_signals: 值得关注的人际变化（情绪异常、关系转变、新出现的重要联系人）
4. memory_conflicts: 今日内容与常识或已知信息的潜在矛盾

返回纯 JSON，格式：
{
  "summary": "今日复盘一句话摘要",
  "missed_tasks": [{"title": "...", "description": "...", "sourceHint": "..."}],
  "project_risks": [{"title": "...", "description": "..."}],
  "relationship_signals": [{"title": "...", "description": "..."}],
  "memory_conflicts": [{"title": "...", "description": "..."}]
}
空类返回空数组。不要输出任何解释文字。`;

export interface DreamReviewResult {
  conversationId: string;
  summary: string;
  missedTaskCount: number;
  projectRiskCount: number;
  relationshipSignalCount: number;
  memoryConflictCount: number;
  totalCandidates: number;
  sourcedFrom: number;
}

class DreamReviewService {
  private ai: AIProviderChain;

  constructor() {
    this.ai = new AIProviderChain();
  }

  /**
   * 运行复盘。date 默认为今天（UTC）。
   */
  async runReview(ownerId: string, date?: string): Promise<DreamReviewResult | null> {
    const db = getDatabase();
    if (!db) {
      logger.warn('DB unavailable, skipping dream review');
      return null;
    }

    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    logger.info('Dream review started', { ownerId, targetDate });

    // 1. 拉取当天所有已完成 Conversation（排除上次复盘本身）
    const rows = await db.execute(sql`
      SELECT c.id, c.title, c.summary, c.mode, c.source
      FROM conversations c
      WHERE c.owner_id = ${ownerId}
        AND c.status IN ('completed', 'review_pending')
        AND c.source != 'dream_review'
        AND c.started_at >= ${dayStart}::timestamptz
        AND c.started_at <= ${dayEnd}::timestamptz
      ORDER BY c.started_at ASC
      LIMIT 100
    `);

    const convRows = (rows.rows ?? []) as Array<{
      id: string; title: string | null; summary: string | null;
      mode: string | null; source: string;
    }>;

    if (convRows.length === 0) {
      logger.info('No conversations to review', { ownerId, targetDate });
      return null;
    }

    // 2. 为每条 Conversation 拼接片段文本
    const parts: string[] = [];
    for (const conv of convRows) {
      const segments = await conversationService.getSegments(conv.id);
      const transcript = segments
        .filter(s => s.text)
        .map(s => `  [${s.speaker ?? s.speakerType}]: ${s.text}`)
        .join('\n');

      const label = conv.title ?? conv.mode ?? conv.source;
      if (conv.summary) {
        parts.push(`=== ${label} ===\n摘要：${conv.summary}\n${transcript}`);
      } else if (transcript) {
        parts.push(`=== ${label} ===\n${transcript}`);
      }
    }

    const aggregatedText = parts.join('\n\n');
    if (!aggregatedText.trim()) {
      return null;
    }

    // 3. AI 提取洞察
    interface ReviewItem { title?: string; description?: string; sourceHint?: string; }
    let parsed: {
      summary?: string;
      missed_tasks?: ReviewItem[];
      project_risks?: ReviewItem[];
      relationship_signals?: ReviewItem[];
      memory_conflicts?: ReviewItem[];
    } = {};

    try {
      const result = await this.ai.complete({
        messages: [
          { role: 'system', content: DREAM_REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: aggregatedText.slice(0, 6000) },
        ],
        temperature: 0.2,
        maxTokens: 1500,
      });

      const raw = result.content.trim();
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      }
    } catch (err) {
      logger.warn('AI dream review failed, creating empty review', { ownerId, err });
    }

    const summary = parsed.summary ?? `${targetDate} 复盘（${convRows.length} 条对话）`;

    // 4. 创建复盘 Conversation
    const reviewConv = await conversationService.create({
      ownerId,
      source: 'dream_review',
      mode: 'reflection',
      title: `梦境复盘 — ${targetDate}`,
    });

    await conversationService.appendSegment({
      conversationId: reviewConv.id,
      sequence: 1,
      segmentType: 'import_note',
      text: `复盘范围：${targetDate}，共 ${convRows.length} 条对话`,
      speaker: 'system',
      speakerType: 'system',
      source: 'dream_review',
    });

    await conversationService.finish(reviewConv.id, ownerId);

    // 5. 写入候选项
    let totalCandidates = 0;

    const addCandidates = async (
      items: ReviewItem[] | undefined,
      candidateType: string,
    ) => {
      for (const item of items ?? []) {
        try {
          await conversationService.addCandidate({
            conversationId: reviewConv.id,
            candidateType,
            content: {
              title: item.title ?? '待确认',
              description: item.description ?? '',
              sourceHint: item.sourceHint ?? '',
              source: 'dream_review',
              reviewDate: targetDate,
            },
            confidence: 0.7,
            riskLevel: candidateType === 'project_risk' ? 'medium' : 'low',
          });
          totalCandidates++;
        } catch (err) {
          logger.warn('addCandidate failed', { candidateType, err });
        }
      }
    };

    await addCandidates(parsed.missed_tasks, 'task');
    await addCandidates(parsed.project_risks, 'project_risk');
    await addCandidates(parsed.relationship_signals, 'relationship_signal');
    await addCandidates(parsed.memory_conflicts, 'memory_conflict');

    // 更新摘要
    await db.execute(sql`
      UPDATE conversations
      SET summary = ${summary}, updated_at = now()
      WHERE id = ${reviewConv.id}
    `);

    logger.info('Dream review completed', {
      ownerId,
      conversationId: reviewConv.id,
      totalCandidates,
      sourcedFrom: convRows.length,
    });

    return {
      conversationId: reviewConv.id,
      summary,
      missedTaskCount: (parsed.missed_tasks ?? []).length,
      projectRiskCount: (parsed.project_risks ?? []).length,
      relationshipSignalCount: (parsed.relationship_signals ?? []).length,
      memoryConflictCount: (parsed.memory_conflicts ?? []).length,
      totalCandidates,
      sourcedFrom: convRows.length,
    };
  }

  async getLatestReview(ownerId: string) {
    const db = getDatabase();
    if (!db) return null;
    try {
      const rows = await db.execute(sql`
        SELECT id, title, summary, started_at, created_at
        FROM conversations
        WHERE owner_id = ${ownerId}
          AND source = 'dream_review'
        ORDER BY started_at DESC
        LIMIT 1
      `);
      return (rows.rows ?? [])[0] ?? null;
    } catch (err) {
      logger.error('getLatestReview failed', { err });
      return null;
    }
  }

  async getReviewHistory(ownerId: string, limit = 10) {
    const db = getDatabase();
    if (!db) return [];
    try {
      const rows = await db.execute(sql`
        SELECT id, title, summary, started_at, created_at
        FROM conversations
        WHERE owner_id = ${ownerId}
          AND source = 'dream_review'
        ORDER BY started_at DESC
        LIMIT ${limit}
      `);
      return rows.rows ?? [];
    } catch (err) {
      logger.error('getReviewHistory failed', { err });
      return [];
    }
  }
}

export const dreamReviewService = new DreamReviewService();
