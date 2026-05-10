/**
 * P5 — Morning Briefing Service（晨间建议）
 * 从最新梦境复盘的候选项生成"醒来建议"，满足阶段五验收标准：
 * 今天最重要的事、昨天遗漏、项目风险、建议行动。
 */
import { createServiceLogger } from '../../lib/logger';
import { dreamReviewService } from './DreamReviewService';
import { conversationService } from '../conversation/ConversationService';

const logger = createServiceLogger('MorningBriefingService');

export interface MorningBriefingItem {
  type: 'task' | 'project_risk' | 'relationship_signal' | 'memory_conflict';
  title: string;
  description: string;
}

export interface MorningBriefing {
  ownerId: string;
  reviewDate: string;
  generatedAt: string;
  reviewSummary: string;
  topItems: MorningBriefingItem[];
  suggestedActions: string[];
  totalPending: number;
}

const TYPE_ORDER: MorningBriefingItem['type'][] = [
  'task',
  'project_risk',
  'relationship_signal',
  'memory_conflict',
];

const ACTION_PREFIX: Record<MorningBriefingItem['type'], string> = {
  task: '处理遗漏任务',
  project_risk: '关注项目风险',
  relationship_signal: '留意关系变化',
  memory_conflict: '确认记忆冲突',
};

class MorningBriefingService {
  /**
   * 为指定用户生成晨间建议。
   * 如果没有复盘记录或复盘没有候选项，返回 null。
   */
  async generateBriefing(ownerId: string): Promise<MorningBriefing | null> {
    try {
      const review = await dreamReviewService.getLatestReview(ownerId);
      if (!review) {
        logger.info('No dream review found for morning briefing', { ownerId });
        return null;
      }

      const reviewRow = review as { id: string; started_at: string; summary?: string | null };
      const reviewId = reviewRow.id;
      const reviewDate = reviewRow.started_at.slice(0, 10);
      const reviewSummary = reviewRow.summary ?? `${reviewDate} 复盘`;

      const allCandidates = await conversationService.getCandidates(reviewId);
      const pending = allCandidates.filter((c) => c.status === 'pending');

      if (pending.length === 0) {
        logger.info('Dream review has no pending candidates', { ownerId, reviewId });
        return null;
      }

      // 按类型优先级收集，每类最多 3 条
      const topItems: MorningBriefingItem[] = [];
      for (const type of TYPE_ORDER) {
        const items = pending
          .filter((c) => c.candidateType === type)
          .slice(0, 3)
          .map((c) => ({
            type,
            title: ((c.content as { title?: string; description?: string }).title) ?? '待确认',
            description: ((c.content as { title?: string; description?: string }).description) ?? '',
          }));
        topItems.push(...items);
      }

      const suggestedActions = topItems
        .slice(0, 5)
        .map((item) => `${ACTION_PREFIX[item.type]}：${item.title}`);

      return {
        ownerId,
        reviewDate,
        generatedAt: new Date().toISOString(),
        reviewSummary,
        topItems,
        suggestedActions,
        totalPending: pending.length,
      };
    } catch (err) {
      logger.error('generateBriefing failed', { ownerId, err });
      return null;
    }
  }
}

export const morningBriefingService = new MorningBriefingService();
