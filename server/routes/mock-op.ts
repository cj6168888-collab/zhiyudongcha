import { Router, type Request, type Response } from "express";
import {
  parseActionFromText,
  createSession,
  getSession,
  getUserSessions,
  updateSessionHeartbeat,
  closeSession,
  completeAction,
  getAccessibilityGuide,
  getNextAction,
  generateWebClickScript,
  generateAndroidAccessibilityAction,
  generatePyAutoGUIScript,
  dispatchAction,
  getSessionStats,
  expandTextVariants,
  type ScreenAction,
  type ExecutorCapabilities,
  type ActionResult,
} from "../services/mock-op-layer";
import { createServiceLogger } from "../lib/logger";

const logger = createServiceLogger("MockOp");
const router = Router();

router.post("/session", async (req: Request, res: Response) => {
  try {
    const { userId, deviceId, capabilities } = req.body;
    
    if (!userId || !deviceId || !capabilities) {
      return res.status(400).json({ 
        error: "缺少必要参数", 
        required: ["userId", "deviceId", "capabilities"] 
      });
    }
    
    const session = createSession(userId, deviceId, capabilities as ExecutorCapabilities);
    
    logger.info({ sessionId: session.sessionId, deviceId }, "执行器会话已创建");
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
    logger.error({ error }, "创建会话失败");
    res.status(500).json({ error: "创建会话失败" });
  }
});

router.get("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
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
    logger.error({ error }, "获取会话失败");
    res.status(500).json({ error: "获取会话失败" });
  }
});

router.get("/sessions/:userId", async (req: Request, res: Response) => {
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
    logger.error({ error }, "获取用户会话失败");
    res.status(500).json({ error: "获取用户会话失败" });
  }
});

router.post("/heartbeat/:sessionId", async (req: Request, res: Response) => {
  try {
    const success = updateSessionHeartbeat(req.params.sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    const session = getSession(req.params.sessionId);
    const nextAction = session ? getNextAction(req.params.sessionId) : null;
    
    res.json({
      success: true,
      timestamp: Date.now(),
      nextAction,
    });
  } catch (error) {
    logger.error({ error }, "心跳更新失败");
    res.status(500).json({ error: "心跳更新失败" });
  }
});

router.delete("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const success = closeSession(req.params.sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    logger.info({ sessionId: req.params.sessionId }, "会话已关闭");
    res.json({ success: true, message: "会话已关闭" });
  } catch (error) {
    logger.error({ error }, "关闭会话失败");
    res.status(500).json({ error: "关闭会话失败" });
  }
});

router.post("/parse", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "缺少文本内容" });
    }
    
    const actions = parseActionFromText(text);
    
    res.json({
      text,
      actions,
      count: actions.length,
      message: actions.length > 0 
        ? `识别到 ${actions.length} 个操作指令` 
        : "未识别到操作指令",
    });
  } catch (error) {
    logger.error({ error }, "解析指令失败");
    res.status(500).json({ error: "解析指令失败" });
  }
});

router.post("/dispatch", async (req: Request, res: Response) => {
  try {
    const { userId, actionText } = req.body;
    
    if (!userId || !actionText) {
      return res.status(400).json({ 
        error: "缺少必要参数",
        required: ["userId", "actionText"],
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
    logger.error({ error }, "派发指令失败");
    res.status(500).json({ error: "派发指令失败" });
  }
});

router.post("/action/complete", async (req: Request, res: Response) => {
  try {
    const { sessionId, actionId, result } = req.body;
    
    if (!sessionId || !actionId || !result) {
      return res.status(400).json({ 
        error: "缺少必要参数",
        required: ["sessionId", "actionId", "result"],
      });
    }
    
    const success = completeAction(sessionId, actionId, result as ActionResult);
    
    if (!success) {
      return res.status(404).json({ error: "操作不存在或会话已失效" });
    }
    
    res.json({ 
      success: true, 
      message: result.success ? "操作执行成功" : "操作执行失败",
    });
  } catch (error) {
    logger.error({ error }, "完成操作失败");
    res.status(500).json({ error: "完成操作失败" });
  }
});

router.get("/guide/:platform", async (req: Request, res: Response) => {
  try {
    const guide = getAccessibilityGuide(req.params.platform);
    res.json(guide);
  } catch (error) {
    logger.error({ error }, "获取权限指南失败");
    res.status(500).json({ error: "获取权限指南失败" });
  }
});

router.post("/script/web", async (req: Request, res: Response) => {
  try {
    const { target, fuzzyMatch = true } = req.body;
    
    if (!target) {
      return res.status(400).json({ error: "缺少目标元素 (target)" });
    }
    
    const script = generateWebClickScript(target, fuzzyMatch);
    const variants = expandTextVariants(target);
    
    res.json({
      target,
      variants,
      script,
      usage: "在浏览器控制台执行此脚本，或通过WebSocket发送到Web执行器",
    });
  } catch (error) {
    logger.error({ error }, "生成Web脚本失败");
    res.status(500).json({ error: "生成Web脚本失败" });
  }
});

router.post("/script/android", async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: "缺少操作定义 (action)" });
    }
    
    const androidAction = generateAndroidAccessibilityAction(action as ScreenAction);
    
    res.json({
      action: androidAction,
      usage: "通过WebSocket发送到Android Accessibility Service执行",
    });
  } catch (error) {
    logger.error({ error }, "生成Android脚本失败");
    res.status(500).json({ error: "生成Android脚本失败" });
  }
});

router.post("/script/pyautogui", async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: "缺少操作定义 (action)" });
    }
    
    const script = generatePyAutoGUIScript(action as ScreenAction);
    
    res.json({
      action: action,
      script,
      requirements: ["pyautogui", "pytesseract", "pillow"],
      usage: "在Python环境中执行此脚本，需要安装相关依赖",
    });
  } catch (error) {
    logger.error({ error }, "生成PyAutoGUI脚本失败");
    res.status(500).json({ error: "生成PyAutoGUI脚本失败" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = getSessionStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, "获取统计信息失败");
    res.status(500).json({ error: "获取统计信息失败" });
  }
});

router.post("/z4/execute-with-action", async (req: Request, res: Response) => {
  try {
    const { text, userId = 'default' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "缺少输入文本" });
    }
    
    const actions = parseActionFromText(text);
    
    if (actions.length > 0) {
      const dispatchResult = dispatchAction(userId, text);
      
      if (!dispatchResult.dispatched && dispatchResult.guide) {
        res.json({
          response: text,
          actions,
          actionDispatched: false,
          needsPermission: true,
          permissionGuide: dispatchResult.guide,
          message: dispatchResult.message,
        });
        return;
      }
      
      res.json({
        response: text,
        actions,
        actionDispatched: dispatchResult.dispatched,
        sessionId: dispatchResult.sessionId,
        message: dispatchResult.message,
      });
      return;
    }
    
    res.json({
      response: text,
      actions: [],
      actionDispatched: false,
      message: "无需执行屏幕操作",
    });
  } catch (error) {
    logger.error({ error }, "执行失败");
    res.status(500).json({ error: "执行失败" });
  }
});

logger.info("Mock-Op路由模块已加载");

export default router;
