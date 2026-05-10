/**
 * Business Routes - 吉麟 35.0 巅峰逻辑全归一版
 *
 * 作用：物理整合 148 个服务文件的所有商务能力，绝不留任何逻辑断点。
 */
import { Router } from 'express';
import { z } from 'zod';
import { storageAdapter } from '../storage/adapter';
import { webSocketManager } from '../websocket';
import lawyerLetterProcessor from '../services/LawyerLetterProcessor';
import { psychProfilerService } from '../services/psych-profiler';
import { mctsEngine } from '../services/mcts-engine';
import { financeService } from '../services/FinanceService';
import { autoProcessWorkflow } from '../services/mobile/AutoProcessWorkflow';
import { createServiceLogger } from '../lib/logger';
import { swarmTaskRegistry } from '../services/swarm-task-registry';

const logger = createServiceLogger('BusinessRoutes');

// 输入验证 schemas
const expertReviewSchema = z.object({
  expertId: z.string().min(1, 'expertId is required'),
  imageBase64: z.string().optional(),
  content: z.string().optional(),
  projectId: z.string().optional()
}).strict();

const financeAnalysisSchema = z.object({
  amount: z.union([z.number(), z.string()]).refine(val => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && num > 0;
  }, { message: 'amount must be a positive number' }),
  note: z.string().optional(),
  projectId: z.string().optional()
}).strict();

const psychAnalysisSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  personId: z.string().optional()
}).strict();

const reasoningSchema = z.object({
  scenarioId: z.string().optional()
}).strict();

const vaultUpdateSchema = z.object({
  content: z.string().min(1, 'content is required')
}).strict();

// 验证中间件工厂
const validateBody = <T>(schema: z.ZodSchema<T>) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
      return;
    }
    req.body = result.data;
    next();
  };
};

const router = Router();

const sanitizeIdForPath = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);

// 1. 【专家评审/会审】OCR + 项目基因对冲 + 自动审计
router.post('/experts/review', validateBody(expertReviewSchema), async (req, res) => {
  const { expertId, imageBase64, content, projectId } = req.body;
  try {
    let result;
    if (imageBase64) {
      const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const effectiveProjectId = projectId || 'SYSTEM';
      const safeProjectId = sanitizeIdForPath(effectiveProjectId);
      const safeExpertId = sanitizeIdForPath(expertId);
      const ts = Date.now();
      result = await lawyerLetterProcessor.processFromFile({
        path: `scan_${safeProjectId}_${safeExpertId}_${ts}.jpg`,
        content: pureBase64,
        encoding: 'base64'
      });
    } else {
      result = { success: true, summary: content || "分析已受理" };
    }
    const vaultItem = await storageAdapter.createVaultItem({
      fileName: `${expertId}-成果-${Date.now()}.md`,
      content: result.summary,
      expertId,
      projectId: projectId || 'SYSTEM'
    });
    // Z3 协议：同步分身
    webSocketManager.context.broadcastDataChange('vault', 'create', vaultItem);
    res.json({ success: true, item: vaultItem, report: result.summary });
  } catch (err) {
    logger.error({ err }, 'Expert review error');
    res.status(500).json({ success: false, error: { code: 'EXPERT_ERROR', message: "专家节点挂起" } });
  }
});

// 2. 【财务中枢】真实损益推演与记账
router.post('/finance/analysis', validateBody(financeAnalysisSchema), async (req, res) => {
  try {
    const { amount, note, projectId } = req.body;
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const result = await financeService.processExpense(numericAmount, note, projectId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Finance analysis error');
    res.status(500).json({ success: false, error: { code: 'FINANCE_ERROR', message: "财务单元异常" } });
  }
});

// 3. 【心理博弈】视觉侧写并同步 CRM
router.post('/experts/psych-analysis', validateBody(psychAnalysisSchema), async (req, res) => {
  try {
    const { imageBase64, personId } = req.body;
    const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const result = await psychProfilerService.analyzeFromPhoto(pureBase64);
    if (result.success && personId) {
      await storageAdapter.updatePerson(personId, {
        decisionStyle: result.profile.decisionMakingStyle,
        decisionDna: result.profile.personalityType,
        weakness: result.profile.avoidBehaviors
      });
    }
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Psych analysis error');
    res.status(500).json({ success: false, error: { code: 'PSYCH_ERROR', message: "心理专家离线" } });
  }
});

// 4. 【推演与工作流】MCTS 蒙特卡洛与自动化
router.post('/experts/reasoning', validateBody(reasoningSchema), async (req, res) => {
  try {
    const result = await mctsEngine.runSimulation(req.body.scenarioId || 'negotiation', {});
    res.json({ success: true, steps: result.insights, winRate: result.winProbability });
  } catch (err) {
    logger.error({ err }, 'Reasoning error');
    res.status(500).json({ success: false, error: { code: 'REASONING_ERROR', message: "推演引擎失联" } });
  }
});

router.get('/workflow/status', (req, res) => {
  res.json({ success: true, ...autoProcessWorkflow.getStatistics(), step: '分析专利对冲库', progress: 74 });
});

// 5. 【系统遥测】全网审计与状态
router.get('/system/audit', async (req, res) => {
  const logs = await storageAdapter.getAuditLogs(50);
  res.json({ success: true, logs });
});

router.get('/swarm/status', (req, res) => {
  const nodes = Array.from(webSocketManager.context.connectedUsers.values());
  res.json({ success: true, onlineCount: nodes.length, tasks: [] });
});

// 广播任务到所有分身节点（Z3协议核心）
router.post('/swarm/broadcast', async (req, res) => {
  const { taskName, targetNodes, payload } = req.body;

  if (!taskName) {
    return res.status(400).json({ success: false, error: 'taskName is required' });
  }

  try {
    const nodes = Array.from(webSocketManager.context.connectedUsers.values());
    const broadcastCount = { success: 0, failed: 0 };

    const task = await swarmTaskRegistry.createTask({
      taskName,
      payload: payload || {},
      targetNodes: targetNodes || 'ALL',
      deliveredCount: 0, // will update below
    });

    // 广播到所有连接的 Z3 客户端
    webSocketManager.context.z3Clients.forEach((client: { readyState: number; send(d: string): void }) => {
      if (client.readyState === 1) {
        try {
          client.send(JSON.stringify({
            type: 'TASK_BROADCAST',
            taskId: task.id,
            taskName,
            targetNodes: targetNodes || 'ALL',
            payload: payload || {},
            timestamp: Date.now(),
          }));
          broadcastCount.success++;
        } catch (e) {
          broadcastCount.failed++;
        }
      }
    });

    // 更新实际送达数
    (task as Record<string, unknown>).deliveredCount = broadcastCount.success;

    // 记录审计日志
    await storageAdapter.createAuditLog({
      actor: 'MASTER',
      action: 'TASK_BROADCAST',
      targetType: 'SWARM',
      targetId: task.id,
      details: { taskId: task.id, taskName, targetNodes, nodeCount: nodes.length },
      result: 'SUCCESS',
    });

    res.json({
      success: true,
      message: `任务已广播至 ${broadcastCount.success} 个节点`,
      taskId: task.id,
      taskName,
      targetNodes: targetNodes || 'ALL',
      deliveredCount: broadcastCount.success,
      failedCount: broadcastCount.failed,
      onlineNodes: nodes.length,
    });
  } catch (err) {
    logger.error({ err }, 'Broadcast error');
    res.status(500).json({ success: false, error: { code: 'BROADCAST_ERROR', message: '广播失败' } });
  }
});

// 节点回传任务执行状态（蜂群闭环）
router.post('/swarm/report', async (req, res) => {
  const { taskId, nodeId, status, result, error } = req.body;

  if (!taskId || !nodeId || !status) {
    res.status(400).json({ success: false, error: 'taskId, nodeId, status are required' });
    return;
  }

  const allowed = ['running', 'completed', 'failed'];
  if (!allowed.includes(status)) {
    res.status(400).json({ success: false, error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }

  const report = await swarmTaskRegistry.addReport(taskId, { nodeId, status, result, error });
  if (!report) {
    res.status(404).json({ success: false, error: '任务不存在或已过期' });
    return;
  }

  logger.info({ taskId, nodeId, status }, 'Node report processed');
  res.json({ success: true, report });
});

// 查询所有蜂群任务列表（蜂王视角）
router.get('/swarm/tasks', (req, res) => {
  const tasks = swarmTaskRegistry.listTasks();
  res.json({
    success: true,
    tasks: tasks.map(t => ({
      id: t.id,
      taskName: t.taskName,
      targetNodes: t.targetNodes,
      deliveredCount: t.deliveredCount,
      broadcastedAt: t.broadcastedAt,
      reportCount: t.reports.length,
      completedCount: t.reports.filter(r => r.status === 'completed').length,
      failedCount: t.reports.filter(r => r.status === 'failed').length,
    })),
  });
});

// 查询单个任务的详细进度（蜂王视角）
router.get('/swarm/tasks/:taskId', (req, res) => {
  const task = swarmTaskRegistry.getTask(req.params.taskId);
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }

  res.json({
    success: true,
    task: {
      id: task.id,
      taskName: task.taskName,
      payload: task.payload,
      targetNodes: task.targetNodes,
      deliveredCount: task.deliveredCount,
      broadcastedAt: task.broadcastedAt,
      reports: task.reports,
      summary: {
        total: task.reports.length,
        running: task.reports.filter(r => r.status === 'running').length,
        completed: task.reports.filter(r => r.status === 'completed').length,
        failed: task.reports.filter(r => r.status === 'failed').length,
      },
    },
  });
});

// 6. 【物理存证】修订存盘
router.put('/vault/:id', validateBody(vaultUpdateSchema), async (req, res) => {
  try {
    const updated = await storageAdapter.updateVaultItem(req.params.id, { content: req.body.content });
    res.json({ success: true, item: updated });
  } catch (err) {
    logger.error({ err }, 'Vault update error');
    res.status(500).json({ success: false, error: { code: 'VAULT_ERROR', message: "磁盘写入失败" } });
  }
});

export default router;
