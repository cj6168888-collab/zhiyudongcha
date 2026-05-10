import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import {
  parseActionFromText,
  createSession,
  getSession,
  getUserSessions,
  updateSessionHeartbeat,
  closeSession,
  getNextAction,
  completeAction,
  getAccessibilityGuide,
  generateWebClickScript,
  generateAndroidAccessibilityAction,
  generatePyAutoGUIScript,
  dispatchAction,
  getSessionStats,
  expandTextVariants,
  type ScreenAction,
  type ExecutorCapabilities,
  type ActionResult,
} from '../services/mock-op-layer';

const logger = createServiceLogger('MockOpRoutes');

export function registerMockOpRoutes(app: Express, _context: RouteContext): void {
  app.post('/api/mockop/session', async (req, res) => {
    try {
      const { userId, deviceId, capabilities } = req.body;

      if (!userId || !deviceId || !capabilities) {
        return res.status(400).json({
          error: '缺少必要参数',
          required: ['userId', 'deviceId', 'capabilities'],
        });
      }

      const session = createSession(userId, deviceId, capabilities as ExecutorCapabilities);

      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          deviceId: session.deviceId,
          connected: session.connected,
        },
        message: `执行器会话已创建，设备: ${deviceId}`,
      });
    } catch (error) {
      logger.error({ err: error }, 'Create session error');
      res.status(500).json({ error: '创建会话失败' });
    }
  });

  app.get('/api/mockop/session/:sessionId', async (req, res) => {
    try {
      const session = getSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({
        sessionId: session.sessionId,
        userId: session.userId,
        deviceId: session.deviceId,
        capabilities: session.capabilities,
        connected: session.connected,
        pendingActions: session.pendingActions.length,
        executedActions: session.executedActions.length,
        lastHeartbeat: session.lastHeartbeat,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get session error');
      res.status(500).json({ error: '获取会话失败' });
    }
  });

  app.get('/api/mockop/sessions/:userId', async (req, res) => {
    try {
      const sessions = getUserSessions(req.params.userId);

      res.json({
        userId: req.params.userId,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          deviceId: s.deviceId,
          platform: s.capabilities.platform,
          connected: s.connected,
          pendingActions: s.pendingActions.length,
        })),
        count: sessions.length,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get user sessions error');
      res.status(500).json({ error: '获取用户会话失败' });
    }
  });

  app.post('/api/mockop/heartbeat/:sessionId', async (req, res) => {
    try {
      const success = updateSessionHeartbeat(req.params.sessionId);

      if (!success) {
        return res.status(404).json({ error: '会话不存在' });
      }

      const session = getSession(req.params.sessionId);
      const nextAction = session ? getNextAction(req.params.sessionId) : null;

      res.json({
        success: true,
        timestamp: Date.now(),
        nextAction,
      });
    } catch (error) {
      logger.error({ err: error }, 'Heartbeat update error');
      res.status(500).json({ error: '心跳更新失败' });
    }
  });

  app.delete('/api/mockop/session/:sessionId', async (req, res) => {
    try {
      const success = closeSession(req.params.sessionId);

      if (!success) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({ success: true, message: '会话已关闭' });
    } catch (error) {
      logger.error({ err: error }, 'Close session error');
      res.status(500).json({ error: '关闭会话失败' });
    }
  });

  app.post('/api/mockop/parse', async (req, res) => {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少文本内容' });
      }

      const actions = parseActionFromText(text);

      res.json({
        text,
        actions,
        count: actions.length,
        message: actions.length > 0
          ? `识别到 ${actions.length} 个操作指令`
          : '未识别到操作指令',
      });
    } catch (error) {
      logger.error({ err: error }, 'Parse action error');
      res.status(500).json({ error: '解析指令失败' });
    }
  });

  app.post('/api/mockop/dispatch', async (req, res) => {
    try {
      const { userId, actionText } = req.body;

      if (!userId || !actionText) {
        return res.status(400).json({
          error: '缺少必要参数',
          required: ['userId', 'actionText'],
        });
      }

      const result = dispatchAction(userId, actionText);

      if (!result.dispatched && result.guide) {
        return res.status(200).json({
          ...result,
          needsPermission: true,
          permissionGuide: result.guide,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Dispatch error');
      res.status(500).json({ error: '派发指令失败' });
    }
  });

  app.post('/api/mockop/action/complete', async (req, res) => {
    try {
      const { sessionId, actionId, result } = req.body;

      if (!sessionId || !actionId || !result) {
        return res.status(400).json({
          error: '缺少必要参数',
          required: ['sessionId', 'actionId', 'result'],
        });
      }

      const success = completeAction(sessionId, actionId, result as ActionResult);

      if (!success) {
        return res.status(404).json({ error: '操作不存在或会话已失效' });
      }

      res.json({
        success: true,
        message: result.success ? '操作执行成功' : '操作执行失败',
      });
    } catch (error) {
      logger.error({ err: error }, 'Complete action error');
      res.status(500).json({ error: '完成操作失败' });
    }
  });

  app.get('/api/mockop/guide/:platform', async (req, res) => {
    try {
      const guide = getAccessibilityGuide(req.params.platform);
      res.json(guide);
    } catch (error) {
      logger.error({ err: error }, 'Get guide error');
      res.status(500).json({ error: '获取权限指南失败' });
    }
  });

  app.post('/api/mockop/script/web', async (req, res) => {
    try {
      const { target, fuzzyMatch = true } = req.body;

      if (!target) {
        return res.status(400).json({ error: '缺少目标元素 (target)' });
      }

      const script = generateWebClickScript(target, fuzzyMatch);
      const variants = expandTextVariants(target);

      res.json({
        target,
        variants,
        script,
        usage: '在浏览器控制台执行此脚本，或通过WebSocket发送到Web执行器',
      });
    } catch (error) {
      logger.error({ err: error }, 'Generate web script error');
      res.status(500).json({ error: '生成Web脚本失败' });
    }
  });

  app.post('/api/mockop/script/android', async (req, res) => {
    try {
      const { action } = req.body;

      if (!action) {
        return res.status(400).json({ error: '缺少操作定义 (action)' });
      }

      const androidAction = generateAndroidAccessibilityAction(action as ScreenAction);

      res.json({
        action: androidAction,
        usage: '通过WebSocket发送到Android Accessibility Service执行',
      });
    } catch (error) {
      logger.error({ err: error }, 'Generate android script error');
      res.status(500).json({ error: '生成Android脚本失败' });
    }
  });

  app.post('/api/mockop/script/pyautogui', async (req, res) => {
    try {
      const { action } = req.body;

      if (!action) {
        return res.status(400).json({ error: '缺少操作定义 (action)' });
      }

      const script = generatePyAutoGUIScript(action as ScreenAction);

      res.json({
        action: action,
        script,
        requirements: ['pyautogui', 'pytesseract', 'pillow'],
        usage: '在Python环境中执行此脚本，需要安装相关依赖',
      });
    } catch (error) {
      logger.error({ err: error }, 'Generate pyautogui script error');
      res.status(500).json({ error: '生成PyAutoGUI脚本失败' });
    }
  });

  app.get('/api/mockop/stats', async (_req, res) => {
    try {
      const stats = getSessionStats();
      res.json(stats);
    } catch (error) {
      logger.error({ err: error }, 'Get stats error');
      res.status(500).json({ error: '获取统计信息失败' });
    }
  });

  app.post('/api/z4/execute-with-action', async (req, res) => {
    try {
      const { text, userId = 'default' } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少输入文本' });
      }

      const actions = parseActionFromText(text);

      if (actions.length > 0) {
        const dispatchResult = dispatchAction(userId, text);

        if (!dispatchResult.dispatched && dispatchResult.guide) {
          return res.json({
            response: text,
            actions,
            dispatched: false,
            guide: dispatchResult.guide,
            message: '需要配置执行器权限',
          });
        }

        const executorCount = (dispatchResult as Record<string, unknown>).executorCount || 0;
        return res.json({
          response: text,
          actions,
          dispatched: dispatchResult.dispatched,
          executorCount,
          message: dispatchResult.dispatched
            ? `已派发 ${actions.length} 个操作到 ${executorCount} 个执行器`
            : '未找到可用执行器',
        });
      }

      res.json({
        response: text,
        actions: [],
        message: '未识别到操作指令',
      });
    } catch (error) {
      logger.error({ err: error }, 'Execute with action error');
      res.status(500).json({ error: '执行失败' });
    }
  });

  logger.info('MockOp routes registered');
}
