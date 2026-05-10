/**
 * Agent API Routes - 自主 Agent 服务接口
 *
 * 提供以下接口：
 * - POST /api/agent/execute - 执行 Agent 任务
 * - POST /api/agent/tasks - 创建任务
 * - GET /api/agent/tasks - 获取任务列表
 * - GET /api/agent/tasks/:id - 获取任务详情
 * - DELETE /api/agent/tasks/:id - 删除任务
 * - POST /api/agent/browser/profile - 创建浏览器配置
 * - POST /api/agent/browser/execute - 执行浏览器操作
 * - POST /api/agent/monitor - 创建监控任务
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { autonomousAgent, browserAgent, governmentFormService, websiteMonitorService } from '../services/agent';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('AgentRoutes');

// 中间件：附加用户角色
router.use(attachRole);

// ============ 浏览器配置 ============

/**
 * POST /api/agent/browser/profile
 * 创建浏览器配置文件
 */
router.post('/browser/profile', async (req: Request, res: Response) => {
  try {
    const { name, userAgent, proxy, cookies } = req.body;

    const profileId = await browserAgent.createProfile({
      name,
      userAgent,
      proxy,
      cookies,
    });

    res.json({ success: true, profileId });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create browser profile');
    res.status(500).json({ success: false, error: 'Failed to create profile' });
  }
});

/**
 * POST /api/agent/browser/execute
 * 执行浏览器操作
 */
router.post('/browser/execute', async (req: Request, res: Response) => {
  try {
    const { profileId, actions, screenshotEach } = req.body;

    const result = await browserAgent.executeActions(profileId, actions, { screenshotEach });

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute browser actions');
    res.status(500).json({ success: false, error: 'Failed to execute actions' });
  }
});

/**
 * GET /api/agent/browser/snapshot
 * 获取页面快照
 */
router.get('/browser/snapshot', async (req: Request, res: Response) => {
  try {
    const { profileId, url } = req.query;

    if (!profileId || !url) {
      res.status(400).json({ success: false, error: 'Missing profileId or url' });
      return;
    }

    const snapshot = await browserAgent.getPageSnapshot(profileId as string, url as string);

    res.json({ success: true, snapshot });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get page snapshot');
    res.status(500).json({ success: false, error: 'Failed to get snapshot' });
  }
});

/**
 * DELETE /api/agent/browser/profile/:id
 * 删除浏览器配置
 */
router.delete('/browser/profile/:id', async (req: Request, res: Response) => {
  try {
    await browserAgent.deleteProfile(req.params.id);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete browser profile');
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
});

// ============ 政府网站表单 ============

/**
 * POST /api/agent/gov/register
 * 注册政府网站配置
 */
router.post('/gov/register', async (req: Request, res: Response) => {
  try {
    const website = req.body;

    governmentFormService.registerWebsite(website);

    res.json({ success: true, message: 'Website registered' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to register website');
    res.status(500).json({ success: false, error: 'Failed to register website' });
  }
});

/**
 * POST /api/agent/gov/credential
 * 设置网站登录凭证
 */
router.post('/gov/credential', async (req: Request, res: Response) => {
  try {
    const { websiteId, username, password } = req.body;

    governmentFormService.setCredential(websiteId, username, password);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to set credential');
    res.status(500).json({ success: false, error: 'Failed to set credential' });
  }
});

/**
 * POST /api/agent/gov/company
 * 设置公司信息
 */
router.post('/gov/company', async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'master';
    const companyInfo = req.body;

    governmentFormService.setCompanyInfo(userId, companyInfo);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to set company info');
    res.status(500).json({ success: false, error: 'Failed to set company info' });
  }
});

/**
 * POST /api/agent/gov/apply
 * 执行申报流程
 */
router.post('/gov/apply', async (req: Request, res: Response) => {
  try {
    const { websiteId, profileId } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'master';

    const result = await governmentFormService.executeApplication(websiteId, profileId, userId);

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute application');
    res.status(500).json({ success: false, error: 'Failed to execute application' });
  }
});

/**
 * GET /api/agent/gov/websites
 * 获取已注册网站列表
 */
router.get('/gov/websites', async (req: Request, res: Response) => {
  try {
    const websites = governmentFormService.getRegisteredWebsites();

    res.json({ success: true, websites });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get websites');
    res.status(500).json({ success: false, error: 'Failed to get websites' });
  }
});

// ============ 网站监控 ============

/**
 * POST /api/agent/monitor
 * 创建监控任务
 */
router.post('/monitor', async (req: Request, res: Response) => {
  try {
    const config = req.body;

    websiteMonitorService.addMonitorConfig(config);

    res.json({ success: true, configId: config.id });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create monitor');
    res.status(500).json({ success: false, error: 'Failed to create monitor' });
  }
});

/**
 * POST /api/agent/monitor/check
 * 手动触发监控检查
 */
router.post('/monitor/check', async (req: Request, res: Response) => {
  try {
    const { configId } = req.body;

    const result = await websiteMonitorService.triggerCheck(configId);

    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger check');
    res.status(500).json({ success: false, error: 'Failed to trigger check' });
  }
});

/**
 * GET /api/agent/monitor/:id
 * 获取监控状态
 */
router.get('/monitor/:id', async (req: Request, res: Response) => {
  try {
    const status = websiteMonitorService.getMonitorStatus(req.params.id);

    res.json({ success: true, status });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get monitor status');
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/agent/monitor/:id
 * 删除监控任务
 */
router.delete('/monitor/:id', async (req: Request, res: Response) => {
  try {
    websiteMonitorService.deleteConfig(req.params.id);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete monitor');
    res.status(500).json({ success: false, error: 'Failed to delete monitor' });
  }
});

// ============ Agent 任务 ============

/**
 * POST /api/agent/tasks
 * 创建 Agent 任务
 */
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'master';
    const taskData = req.body;

    const taskId = await autonomousAgent.createTask({
      ...taskData,
      createdBy: userId,
    });

    res.json({ success: true, taskId });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create task');
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

/**
 * GET /api/agent/tasks
 * 获取任务列表
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = autonomousAgent.getTasks();

    res.json({ success: true, tasks });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get tasks');
    res.status(500).json({ success: false, error: 'Failed to get tasks' });
  }
});

/**
 * GET /api/agent/tasks/:id
 * 获取任务详情
 */
router.get('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const tasks = autonomousAgent.getTasks();
    const task = tasks.find(t => t.id === req.params.id);

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const history = autonomousAgent.getExecutionHistory(req.params.id);

    res.json({ success: true, task, history });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get task');
    res.status(500).json({ success: false, error: 'Failed to get task' });
  }
});

/**
 * POST /api/agent/tasks/:id/execute
 * 执行任务
 */
router.post('/tasks/:id/execute', async (req: Request, res: Response) => {
  try {
    const { context, options } = req.body;

    const result = await autonomousAgent.executeTask(req.params.id, context, options);

    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute task');
    res.status(500).json({ success: false, error: 'Failed to execute task' });
  }
});

/**
 * DELETE /api/agent/tasks/:id
 * 删除任务
 */
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    await autonomousAgent.deleteTask(req.params.id);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete task');
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

// ============ 语音指令 ============

/**
 * POST /api/agent/voice
 * 处理语音指令
 */
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'master';

    // 这里应该调用语音处理服务
    // const result = await processVoiceCommand(command, userId);

    res.json({
      success: true,
      message: '语音指令已接收，正在处理...',
      // result
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to process voice command');
    res.status(500).json({ success: false, error: 'Failed to process voice command' });
  }
});

// ============ 状态 ============

/**
 * GET /api/agent/stats
 * 获取 Agent 统计信息
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const browserStats = browserAgent.getStats();
    const tasks = autonomousAgent.getTasks();
    const monitors = websiteMonitorService.getAllConfigs();

    res.json({
      success: true,
      stats: {
        browser: browserStats,
        tasks: {
          total: tasks.length,
          scheduled: tasks.filter(t => t.type === 'scheduled').length,
          running: tasks.filter(t => t.type === 'continuous').length,
        },
        monitors: {
          total: monitors.length,
          active: monitors.filter(m => m.enabled).length,
        },
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get stats');
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
