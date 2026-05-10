import { createServiceLogger } from '../../lib/logger';
import { storage } from '../../storage';
import type { EvolutionEvent } from '@shared/schema';

const logger = createServiceLogger('ConversationExecutionReflectionService');

export interface ConversationExecutionReflection {
  total: number;
  succeeded: number;
  failed: number;
  actionCounts: Record<string, number>;
  failureReasons: string[];
  patterns: string[];
  learnings: string[];
  recommendations: string[];
}

function getActionFromEvent(event: EvolutionEvent): string {
  const data = event.newValue as Record<string, unknown> | null;
  return typeof data?.action === 'string' ? data.action : 'unknown';
}

function getFailureReasonFromEvent(event: EvolutionEvent): string | null {
  const data = event.newValue as Record<string, unknown> | null;
  return typeof data?.errorMessage === 'string' && data.errorMessage
    ? data.errorMessage
    : null;
}

export class ConversationExecutionReflectionService {
  async reflectForDate(targetDate: Date, nextDay?: Date): Promise<ConversationExecutionReflection> {
    const endDate = nextDay ?? new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    try {
      const events = await storage.getEvolutionEvents(300);
      const executionEvents = events.filter((event) => {
        if (!event.createdAt) return false;
        const createdAt = new Date(event.createdAt);
        return createdAt >= targetDate
          && createdAt < endDate
          && event.sourceModule === 'HybridAssistant'
          && event.eventType.startsWith('ASSISTANT_EXECUTION_');
      });

      return this.summarize(executionEvents);
    } catch (err) {
      logger.warn({ err }, 'Failed to reflect conversation execution events');
      return this.empty();
    }
  }

  summarize(events: EvolutionEvent[]): ConversationExecutionReflection {
    if (events.length === 0) return this.empty();

    const actionCounts: Record<string, number> = {};
    const failureReasons: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const event of events) {
      const action = getActionFromEvent(event);
      actionCounts[action] = (actionCounts[action] || 0) + 1;

      if (event.eventType === 'ASSISTANT_EXECUTION_SUCCEEDED') {
        succeeded++;
      } else if (event.eventType === 'ASSISTANT_EXECUTION_FAILED') {
        failed++;
        const reason = getFailureReasonFromEvent(event);
        if (reason) failureReasons.push(reason);
      }
    }

    const topAction = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const patterns = [
      `对话执行闭环运行 ${events.length} 次，成功 ${succeeded} 次，失败 ${failed} 次`,
    ];
    if (topAction && topAction !== 'unknown') {
      patterns.push(`最高频对话动作是 ${topAction}`);
    }
    if (failed > 0) {
      patterns.push('存在对话执行失败，需要复盘错误原因和降级路径');
    }

    const learnings = [
      succeeded > 0
        ? '对话结果可以转化为项目、任务或记忆等结构化资产'
        : '今日没有成功的对话执行样本',
    ];
    if (failed > 0) {
      learnings.push(`今日有 ${failed} 次对话执行失败，需纳入失败样本`);
    }

    const recommendations = failed > 0
      ? ['优先检查失败动作的参数完整性、权限判断和存储写入路径']
      : ['继续扩大对话执行样本，观察哪些动作最常被主人使用'];

    return {
      total: events.length,
      succeeded,
      failed,
      actionCounts,
      failureReasons,
      patterns,
      learnings,
      recommendations,
    };
  }

  private empty(): ConversationExecutionReflection {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      actionCounts: {},
      failureReasons: [],
      patterns: [],
      learnings: [],
      recommendations: [],
    };
  }
}

export const conversationExecutionReflectionService = new ConversationExecutionReflectionService();
