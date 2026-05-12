/**
 * Hybrid Assistant API - 混合智能助手接口
 */

import { Router, Request, Response } from 'express';
import { hybridAssistant, SCENARIO_CATEGORIES } from '../services/assistant/HybridAssistant';
import type { DraftItem } from '../services/assistant/HybridAssistant';
import { authorizationManager } from '../services/assistant/AuthorizationManager';
import { AuthorizationType, AuthorizationScope } from '../services/assistant/AuthorizationManager';
import { conversationActionExecutor } from '../services/assistant/ConversationActionExecutor';
import { conversationExecutionEventRecorder } from '../services/assistant/ConversationExecutionEventRecorder';
import { perceptionGateway } from '../services/perception/PerceptionGateway';
import { conversationService } from '../services/conversation/ConversationService';
import { conversationProcessor } from '../services/conversation/ConversationProcessor';
import { avatarService } from '../services/AvatarService';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';
import { getDatabase } from '../db';
import { pendingActions } from '@shared/schema';
import { and, eq, gt } from 'drizzle-orm';

const router = Router();
const logger = createServiceLogger('HybridAssistantRoutes');

router.use(attachRole);

type AssistantHistoryRole = 'user' | 'assistant';

interface AssistantHistoryItem {
  id: string;
  role: AssistantHistoryRole;
  content: string;
  createdAt: Date;
}

const fallbackAssistantHistory: AssistantHistoryItem[] = [];
const FALLBACK_HISTORY_LIMIT = 100;

function normalizeHistoryLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function pushFallbackHistory(role: AssistantHistoryRole, content: string) {
  fallbackAssistantHistory.push({
    id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date(),
  });
  if (fallbackAssistantHistory.length > FALLBACK_HISTORY_LIMIT) {
    fallbackAssistantHistory.splice(0, fallbackAssistantHistory.length - FALLBACK_HISTORY_LIMIT);
  }
}

async function recordAssistantHistory(role: AssistantHistoryRole, content: string, intent?: string) {
  try {
    await avatarService.createChatMessage({
      role,
      content,
      intent,
      feedback: 0,
      isMemorized: 0,
      memoryWeight: 0,
    });
  } catch (error) {
    logger.warn({ err: error, role }, 'Avatar chat history unavailable; using in-memory fallback');
    pushFallbackHistory(role, content);
  }
}

async function loadAssistantHistory(limit: number): Promise<AssistantHistoryItem[]> {
  try {
    return (await avatarService.getRecentChatContext(limit)).map((item) => ({
      id: item.id,
      role: item.role as AssistantHistoryRole,
      content: item.content,
      createdAt: item.createdAt ?? new Date(),
    }));
  } catch (error) {
    logger.warn({ err: error }, 'Avatar chat history unavailable; reading in-memory fallback');
    return fallbackAssistantHistory.slice(-limit);
  }
}

function formatAuthorizedExecutionMessage(execution: {
  success: boolean;
  entityType?: string;
  entityData?: Record<string, unknown>;
  entityId?: string;
  errorMessage?: string;
}): string {
  if (!execution.success) {
    return `执行失败：${execution.errorMessage ?? '未知错误'}`;
  }

  if (execution.entityType === 'pc_task') {
    const detail = execution.entityData?.message ? `：${String(execution.entityData.message)}` : '';
    return `好的，PC 执行已完成${detail}`;
  }

  const entityLabel: Record<string, string> = {
    project: '项目',
    task: '任务',
    memory: '记忆',
  };
  const label = execution.entityType ? (entityLabel[execution.entityType] ?? execution.entityType) : '事项';
  return `好的，已完成：${label} 已创建`;
}

function assistantMessageWithExecutionSummary(message: string, execution?: {
  success: boolean;
  entityType?: string;
  entityData?: Record<string, unknown>;
  errorMessage?: string;
} | null) {
  if (!execution) return message;
  if (!execution.success) return `${message}\n\n执行失败：${execution.errorMessage ?? '未知错误'}`;
  if (execution.entityType === 'pc_task' && typeof execution.entityData?.message === 'string') {
    return `${message}\n\n${execution.entityData.message}`;
  }
  return message;
}

router.get('/history', async (req: Request, res: Response) => {
  const limit = normalizeHistoryLimit(req.query.limit);
  const messages = await loadAssistantHistory(limit);
  res.json({
    success: true,
    messages: messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      timestamp: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString(),
    })),
  });
});

/**
 * GET /api/assistant/pending
 *
 * 查询当前用户仍在有效期内的待确认动作和草案摘要。
 * 只读状态接口，不执行任何动作。
 */
router.get('/pending', async (req: Request, res: Response) => {
  const emptySummary = { success: true, count: 0, pending: [], draft: [] };
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

  try {
    const db = getDatabase();
    const rowsById = new Map<string, {
      id: string;
      entryType: string;
      action: string | null;
      actionParams?: unknown;
      items?: unknown;
      expiresAt: Date;
      createdAt: Date;
    }>();

    const addRows = (rows: Array<{
      id: string;
      entryType: string;
      action: string | null;
      actionParams?: unknown;
      items?: unknown;
      expiresAt: Date;
      createdAt: Date;
    }>) => {
      for (const row of rows) {
        rowsById.set(row.id, row);
      }
    };

    addRows(conversationActionExecutor.listActive(userId));

    if (!db) {
      const rows = Array.from(rowsById.values());
      const pending = rows.filter((row) => row.entryType === 'pending');
      const draft = rows.filter((row) => row.entryType === 'draft');
      res.json({ success: true, count: rows.length, pending, draft });
      return;
    }

    const result = await db
      .select({
        id: pendingActions.id,
        entryType: pendingActions.entryType,
        action: pendingActions.action,
        actionParams: pendingActions.actionParams,
        items: pendingActions.items,
        expiresAt: pendingActions.expiresAt,
        createdAt: pendingActions.createdAt,
      })
      .from(pendingActions)
      .where(and(
        eq(pendingActions.userId, userId),
        gt(pendingActions.expiresAt, new Date()),
      ));
    addRows(Array.isArray(result) ? result : []);
    const rows = Array.from(rowsById.values()).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const pending = rows.filter((row) => row.entryType === 'pending');
    const draft = rows.filter((row) => row.entryType === 'draft');

    res.json({
      success: true,
      count: rows.length,
      pending,
      draft,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Assistant pending summary unavailable; returning empty summary');
    const rows = conversationActionExecutor.listActive(userId);
    if (rows.length === 0) {
      res.json(emptySummary);
      return;
    }
    res.json({
      success: true,
      count: rows.length,
      pending: rows.filter((row) => row.entryType === 'pending'),
      draft: rows.filter((row) => row.entryType === 'draft'),
    });
  }
});

/**
 * POST /api/assistant
 *
 * 核心入口：用户发送消息 → 小星响应
 *
 * 智能分发：
 * - 高频场景：路由直达（快）
 * - 中频场景：混合处理（准）
 * - 低频场景：AI 处理（灵活）
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, type = 'text', source = 'app' } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
      return;
    }

    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    logger.info({
      messageLength: message.length,
      source,
      userId
    }, 'User message received');

    // 构建用户消息
    const userMessage = {
      id: `msg_${Date.now()}`,
      content: message,
      type: type as 'text' | 'voice' | 'image',
      source: source as 'app' | 'wechat' | 'phone' | 'watch',
      timestamp: new Date(),
    };

    // 小星处理（传入 userId）
    const response = await hybridAssistant.processMessage(userMessage, userId);

    // 执行阶段
    let executionResult = null;
    if (response.action && response.type === 'execute') {
      executionResult = await conversationActionExecutor.execute(response, userId);
      if (executionResult) {
        logger.info({
          action: executionResult.action,
          success: executionResult.success,
          entityType: executionResult.entityType,
          entityId: executionResult.entityId,
        }, 'Conversation action executed');
        await conversationExecutionEventRecorder.record({
          response,
          execution: executionResult,
          userId,
          source: 'assistant_chat',
        });
      }
    } else if (response.action && response.type === 'confirm') {
      await conversationActionExecutor.storePending(response.id, response, userId);
      logger.info({ responseId: response.id, action: response.action }, 'Action pending user confirmation');
    } else if (response.type === 'draft' && Array.isArray(response.draftItems) && response.draftItems.length > 0) {
      await conversationActionExecutor.storeDraft(response.id, response.draftItems as DraftItem[], userId);
      logger.info({ responseId: response.id, itemCount: response.draftItems.length }, 'Draft stored pending user confirmation');
    }

    logger.info({
      responseId: response.id,
      handler: response.handler,
      category: response.category,
      type: response.type,
      action: response.action,
    }, 'Response generated');

    await recordAssistantHistory('user', message, response.category);
    await recordAssistantHistory(
      'assistant',
      assistantMessageWithExecutionSummary(response.message, executionResult),
      response.category,
    );

    // 异步记录 Conversation（不阻塞响应）
    const convMode = response.action ? 'task_request' : 'casual_chat';
    setImmediate(async () => {
      try {
        const conv = await perceptionGateway.start({ ownerId: userId, source: 'mobile', mode: convMode });
        await conversationService.appendSegment({ conversationId: conv.id, sequence: 1, segmentType: 'transcript', text: message, speaker: 'user', speakerType: 'user', source: 'mobile' });
        await conversationService.appendSegment({ conversationId: conv.id, sequence: 2, segmentType: 'transcript', text: response.message, speaker: 'navigator', speakerType: 'navigator', source: 'mobile' });
        await conversationService.finish(conv.id, userId);
        // task_request 模式：自动处理提取候选项，供用户在 Inbox 确认
        if (convMode === 'task_request') {
          await conversationProcessor.process(conv.id, userId);
        }
      } catch (_) { /* non-critical */ }
    });

    // 返回
    res.json({
      success: true,
      response,
      ...(executionResult ? { execution: executionResult } : {}),
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process message');
    res.status(500).json({
      success: false,
      error: '处理失败，请稍后重试',
    });
  }
});

/**
 * GET /api/assistant/intents
 *
 * 查看支持的意图分类
 */
router.get('/intents', (req: Request, res: Response) => {
  const intents = Object.entries(SCENARIO_CATEGORIES).map(([key, category]) => ({
    id: key,
    name: category.name,
    frequency: category.frequency,
    handler: category.handler,
    examples: category.examples.slice(0, 3),
  }));

  res.json({
    success: true,
    intents,
    summary: {
      high: intents.filter(i => i.frequency === 'high').length,
      medium: intents.filter(i => i.frequency === 'medium').length,
      low: intents.filter(i => i.frequency === 'low').length,
    },
  });
});

/**
 * GET /api/assistant/permissions
 *
 * 查看权限配置
 */
router.get('/permissions', (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
  const config = authorizationManager.getUserConfig(userId);

  res.json({
    success: true,
    config: {
      amountThresholds: config.amountThresholds,
      trustLevel: config.trustLevel,
    },
    levels: {
      auto: {
        label: '自动执行',
        description: '无需确认，直接执行',
      },
      confirm: {
        label: '确认执行',
        description: '显示确认信息，用户确认后执行',
      },
      authorize: {
        label: '授权执行',
        description: '需要用户输入密码或进行二次验证',
      },
      deny: {
        label: '禁止执行',
        description: '无法执行，需要用户在 App 中操作',
      },
    },
    thresholds: {
      payment: {
        auto: `0-${config.amountThresholds.auto}元`,
        confirm: `${config.amountThresholds.auto}-${config.amountThresholds.confirm}元`,
        authorize: `${config.amountThresholds.confirm}元以上`,
        deny: '特殊情况',
      },
    },
  });
});

/**
 * PUT /api/assistant/permissions/thresholds
 *
 * 更新金额阈值
 */
router.put('/permissions/thresholds', (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
    const { auto, confirm } = req.body;

    if (typeof auto !== 'number' || typeof confirm !== 'number') {
      res.status(400).json({ success: false, error: '需要提供 auto 和 confirm 数值' });
      return;
    }

    authorizationManager.setAmountThresholds(userId, auto, confirm);

    res.json({
      success: true,
      message: `金额阈值已更新：自动 ¥${auto}，确认 ¥${confirm}`,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

/**
 * GET /api/assistant/authorizations
 *
 * 查看用户的授权列表
 */
router.get('/authorizations', (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
  const auths = authorizationManager.getUserAuthorizations(userId);

  res.json({
    success: true,
    authorizations: auths,
    report: authorizationManager.generateAuthReport(userId),
  });
});

/**
 * DELETE /api/assistant/authorizations/:id
 *
 * 撤销授权
 */
router.delete('/authorizations/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
    const { id } = req.params;

    const success = authorizationManager.revokeAuthorization(userId, id);

    if (success) {
      res.json({
        success: true,
        message: '授权已撤销',
      });
    } else {
      res.status(404).json({
        success: false,
        error: '授权不存在',
      });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: '撤销失败' });
  }
});

/**
 * POST /api/assistant/draft/update
 *
 * 用户在移动端修改草案条目后，保存回 pending_actions，随后确认执行使用修改后的版本。
 */
router.post('/draft/update', async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
    const { responseId, items } = req.body;
    if (!responseId) {
      res.status(400).json({ success: false, error: 'responseId is required' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'items must be a non-empty array' });
      return;
    }

    const updatedDraft = await conversationActionExecutor.updateDraftByResponseId(responseId, items, userId);
    if (!updatedDraft) {
      res.status(404).json({ success: false, error: '草案不存在或已过期' });
      return;
    }

    logger.info({ responseId, itemCount: updatedDraft.items?.length ?? 0 }, 'Draft updated');
    res.json({ success: true, draft: updatedDraft });
  } catch (error) {
    logger.error({ err: error }, 'Draft update failed');
    res.status(500).json({ success: false, error: '草案保存失败' });
  }
});

/**
 * POST /api/assistant/draft/confirm
 *
 * 用户确认草案后执行所有条目
 */
router.post('/draft/confirm', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.body;
    if (!responseId) {
      res.status(400).json({ success: false, error: 'responseId is required' });
      return;
    }
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    const executions = await conversationActionExecutor.executeDraftByResponseId(responseId, userId);
    if (!executions) {
      res.status(404).json({ success: false, error: '草案不存在或已过期' });
      return;
    }

    for (const execution of executions) {
      if (execution.success) {
        await conversationExecutionEventRecorder.record({
          response: {
            id: responseId,
            handler: 'ai',
            type: 'draft' as AssistantResponse['type'],
            message: '草案确认执行',
            action: execution.action,
          },
          execution,
          userId,
          source: 'assistant_draft',
        });
      }
    }

    logger.info({ responseId, count: executions.length }, 'Draft confirmed and executed');
    const failed = executions.filter((execution) => !execution.success).length;
    await recordAssistantHistory(
      'assistant',
      failed > 0
        ? `草案执行有失败项：已完成 ${executions.length - failed} 项，${failed} 项失败。`
        : `草案执行完成：已完成全部 ${executions.length} 项。`,
    );
    res.json({ success: true, executions });
  } catch (error) {
    logger.error({ err: error }, 'Draft confirm failed');
    res.status(500).json({ success: false, error: '草案执行失败' });
  }
});

/**
 * POST /api/assistant/authorize
 *
 * 用户授权确认
 */
router.post('/authorize', async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
    const { responseId, action, modifications } = req.body;

    logger.info({ responseId, action, userId }, 'Authorization received');

    let message = '';
    let executionResult = null;

    switch (action) {
      case 'approve_once':
        // 取出暂存的 pending action 并执行
        if (responseId) {
          executionResult = await conversationActionExecutor.executeByResponseId(responseId, userId);
          if (executionResult) {
            message = formatAuthorizedExecutionMessage(executionResult);
          } else {
            message = '好的，正在处理...';
          }
        } else {
          message = '好的，正在执行...';
        }
        break;
      case 'approve_permanent':
        authorizationManager.addPermanentAuthorization(userId, {
          type: AuthorizationType.AUTO,
          scope: AuthorizationScope.PERMANENT,
          operation: '*',
          conditions: {},
        });
        if (responseId) {
          executionResult = await conversationActionExecutor.executeByResponseId(responseId, userId);
        }
        message = '好的，以后这类事我直接处理，不用再来问您了';
        break;
      case 'approve_by_type':
        authorizationManager.addPermanentAuthorization(userId, {
          type: AuthorizationType.AUTO,
          scope: AuthorizationScope.BY_TYPE,
          operation: '*',
          conditions: { maxAmount: 1000 },
        });
        if (responseId) {
          executionResult = await conversationActionExecutor.executeByResponseId(responseId, userId);
        }
        message = '好的，已设置类似操作的授权额度';
        break;
      case 'deny':
        if (responseId) {
          await conversationActionExecutor.discardByResponseId(responseId, userId);
        }
        message = '好的，已取消';
        break;
      case 'modify':
        message = '收到，请告诉我怎么改';
        break;
      default:
        message = '好的';
    }

    if (executionResult) {
      logger.info({
        responseId,
        action: executionResult.action,
        success: executionResult.success,
        entityId: executionResult.entityId,
      }, 'Authorized action executed');
      await conversationExecutionEventRecorder.record({
        response: {
          id: responseId || 'unknown_authorization',
          handler: 'ai',
          type: 'confirm',
          message,
          action: executionResult.action,
        },
        execution: executionResult,
        userId,
        source: 'assistant_authorize',
      });
    }

    await recordAssistantHistory('assistant', assistantMessageWithExecutionSummary(message, executionResult));

    res.json({
      success: true,
      message,
      ...(executionResult ? { execution: executionResult } : {}),
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '授权处理失败' });
  }
});

/**
 * POST /api/assistant/pending/discard
 *
 * 用户取消恢复出的 pending/draft 条目时，前后端都清理同一条暂存记录。
 */
router.post('/pending/discard', async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';
    const { responseId } = req.body;
    if (!responseId) {
      res.status(400).json({ success: false, error: 'responseId is required' });
      return;
    }

    const discarded = await conversationActionExecutor.discardByResponseId(responseId, userId);
    res.json({ success: true, discarded });
  } catch (error) {
    logger.error({ err: error }, 'Pending discard failed');
    res.status(500).json({ success: false, error: '取消失败' });
  }
});

/**
 * POST /api/assistant/demo
 *
 * 演示各种场景
 */
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    const scenarios: Record<string, string> = {
      // 高频场景
      'calendar': '明天上午10点开会',
      'alarm': '半小时后提醒我开会',
      'note': '记一下，牛奶没有了',
      'navigation': '导航到北京西站',
      'search': '今天天气怎么样',
      'call': '给张三打电话',
      'media': '播放音乐',

      // 中频场景
      'meeting': '明天上午要开周会，给团队总结下上周工作',
      'booking': '帮我订个酒店',
      'trip': '帮我安排下周的出差',
      'recommend': '附近有什么好吃的',

      // 低频场景
      'emotion': '最近好累',
      'summary': '帮我总结下这周的工作',
      'writing': '帮我写一封邮件',
      'chat': '讲个笑话',

      // 授权命令
      'auth_permanent': '以后订餐这种事都交给你了',
      'auth_once': '这次的事交给你处理了',
    };

    const message = scenarios[scenario];

    if (!message) {
      res.status(400).json({
        success: false,
        error: '未知场景',
        available: Object.keys(scenarios),
      });
      return;
    }

    const response = await hybridAssistant.processMessage({
      id: `demo_${Date.now()}`,
      content: message,
      type: 'text',
      source: 'app',
      timestamp: new Date(),
    }, userId);

    res.json({
      success: true,
      scenario,
      message,
      category: SCENARIO_CATEGORIES[scenario]?.name || '授权',
      handler: response.handler,
      response,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '演示失败' });
  }
});

/**
 * POST /api/assistant/batch
 *
 * 批量测试
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { scenarios = [] } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    const results = [];

    for (const scenario of scenarios) {
      const response = await hybridAssistant.processMessage({
        id: `batch_${Date.now()}_${Math.random()}`,
        content: scenario,
        type: 'text',
        source: 'app',
        timestamp: new Date(),
      }, userId);

      results.push({
        input: scenario,
        handler: response.handler,
        category: response.category,
        type: response.type,
        message: response.message.substring(0, 100),
      });
    }

    res.json({
      success: true,
      results,
      summary: {
        direct: results.filter(r => r.handler === 'direct').length,
        hybrid: results.filter(r => r.handler === 'hybrid').length,
        ai: results.filter(r => r.handler === 'ai').length,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '批量测试失败' });
  }
});

export default router;
