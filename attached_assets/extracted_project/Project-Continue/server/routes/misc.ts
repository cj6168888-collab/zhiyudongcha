import type { Express, Request, Response } from "express";
import { WebSocket } from "ws";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { attachRole, requireMaster, requireAuth, auditAction } from "../middleware/auth";
import { z } from "zod";
import { chatWithDashScope, type ChatMessage } from "../services/dashscope";
import { inmoBridgeService } from "../services/inmo-bridge";
import { avatarRecognitionService } from "../services/avatar-recognition";
import { biometricAuthService } from "../services/biometric-auth";
import { schedulerService } from "../services/scheduler";
import { perceptionCore } from "../services/perception-core";
import { runExpertAnalysis, runMultiExpertAnalysis, synthesizeExpertOpinions, type ExpertType } from "../services/expert-ai";
import { zeroHallucinationService, type ZeroHallucinationRequest } from "../services/zero-hallucination";
import { requiresZeroHallucination, type ProfessionalMode, type UserRole } from "../config/persona";
import {
  parseActionFromText,
  createSession,
  getSession,
  getUserSessions,
  updateSessionHeartbeat,
  closeSession,
  queueAction,
  getNextAction,
  completeAction,
  getAccessibilityGuide,
  checkCapabilities,
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
import { projectEngineService } from "../services/project-engine";

const inmoDevices: Map<string, { config: any; status: any; lastUpdate: Date }> = new Map();

interface ArHudMessage {
  id: string;
  type: 'info' | 'alert' | 'task' | 'message';
  title: string;
  content: string;
  time: string;
}

const arMessageQueue: ArHudMessage[] = [];

export function registerMiscRoutes(
  app: Express,
  storage: IStorage,
  context: RouteContext
): void {
  const { connectedUsers } = context;

  function broadcastToDevice(deviceId: string, message: any) {
    Array.from(connectedUsers.entries()).forEach(([ws, user]) => {
      if (user.deviceId === deviceId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  // ===== Health Check API (for mobile app connection test) =====
  
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "xiaozhi-avatar",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // ===== AR HUD Messages API (INMO Go3 Compatible) =====
  
  app.get("/api/ar/messages", async (req, res) => {
    try {
      const now = new Date();
      const formatTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      const defaultMessages: ArHudMessage[] = [
        { id: '1', type: 'info', title: '系统在线', content: '小智数字生命系统运行正常', time: formatTime(now) },
        { id: '2', type: 'task', title: '今日待办', content: '暂无紧急任务', time: '09:00' },
        { id: '3', type: 'message', title: '欢迎回来', content: '主人，有什么可以帮您？', time: formatTime(now) },
      ];
      
      const messages = arMessageQueue.length > 0 ? arMessageQueue : defaultMessages;
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "获取AR消息失败" });
    }
  });

  app.post("/api/ar/messages", requireMaster, async (req, res) => {
    try {
      const { type = 'info', title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "标题和内容不能为空" });
      }
      
      const message: ArHudMessage = {
        id: `ar-${Date.now()}`,
        type,
        title,
        content,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      
      arMessageQueue.unshift(message);
      if (arMessageQueue.length > 10) arMessageQueue.pop();
      
      res.status(201).json({ success: true, message });
    } catch (error) {
      res.status(500).json({ error: "推送AR消息失败" });
    }
  });

  // ===== INMO Go3 AR Glasses API =====

  app.post("/api/inmo/devices", requireMaster, async (req, res) => {
    try {
      const { deviceName, bluetoothMac, autoConnect = true } = req.body;
      if (!deviceName) {
        return res.status(400).json({ error: "设备名称不能为空" });
      }

      const deviceId = `inmo-go3-${Date.now()}`;
      const deviceData = {
        config: {
          deviceId,
          deviceName,
          bluetoothMac,
          autoConnect,
          displayBrightness: 70,
          volume: 50,
          language: 'zh-CN',
          voiceWakeWord: '小智',
          notificationFilter: 'IMPORTANT',
        },
        status: {
          isConnected: autoConnect,
          batteryLevel: 100,
          isCharging: false,
          displayOn: false,
          microphoneActive: false,
          bluetoothConnected: autoConnect,
          wifiConnected: false,
          firmwareVersion: '1.0.0',
        },
        lastUpdate: new Date(),
      };

      inmoDevices.set(deviceId, deviceData);

      await auditAction('INMO_DEVICE_REGISTERED', req.userRole || 'MASTER', 'inmo_device', deviceId, { deviceName }, 'SUCCESS', req);

      res.status(201).json({
        ...deviceData.config,
        status: deviceData.status,
      });
    } catch (error) {
      res.status(400).json({ error: "注册INMO设备失败" });
    }
  });

  app.get("/api/inmo/devices", requireMaster, async (req, res) => {
    try {
      const devices = Array.from(inmoDevices.entries()).map(([id, data]) => ({
        deviceId: id,
        ...data.config,
        status: data.status,
        lastUpdate: data.lastUpdate,
      }));
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "获取INMO设备列表失败" });
    }
  });

  app.get("/api/inmo/devices/:id", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }
      res.json({
        deviceId: req.params.id,
        ...device.config,
        status: device.status,
        lastUpdate: device.lastUpdate,
      });
    } catch (error) {
      res.status(500).json({ error: "获取设备状态失败" });
    }
  });

  app.post("/api/inmo/devices/:id/display", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }

      const { type = 'TEXT', content, duration, position = 'CENTER', priority = 'NORMAL' } = req.body;
      if (!content) {
        return res.status(400).json({ error: "消息内容不能为空" });
      }

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_DISPLAY',
        message: { type, content, duration, position, priority },
      });

      console.log(`[INMO API] 向设备 ${req.params.id} 发送显示消息: ${content.substring(0, 50)}...`);

      res.json({
        success: true,
        message: '消息已发送到眼镜',
        displayMessage: { type, content, duration, position, priority },
      });
    } catch (error) {
      res.status(500).json({ error: "发送显示消息失败" });
    }
  });

  app.post("/api/inmo/devices/:id/notify", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }

      const { title, body, priority = 'NORMAL' } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: "标题和内容不能为空" });
      }

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_NOTIFICATION',
        notification: { title, body, priority },
      });

      res.json({ success: true, message: '通知已推送' });
    } catch (error) {
      res.status(500).json({ error: "发送通知失败" });
    }
  });

  app.post("/api/inmo/devices/:id/translate", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }

      const { text, targetLang = 'en', sourceLang = 'auto' } = req.body;
      if (!text) {
        return res.status(400).json({ error: "翻译文本不能为空" });
      }

      const translationResult = await inmoBridgeService.translateText(text, targetLang, sourceLang);

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_TRANSLATION',
        translation: {
          sourceText: translationResult.sourceText,
          targetText: translationResult.targetText,
          sourceLang: translationResult.sourceLanguage,
          targetLang: translationResult.targetLanguage,
          confidence: translationResult.confidence,
          processingTimeMs: translationResult.processingTimeMs,
        },
      });

      res.json({
        success: true,
        sourceText: translationResult.sourceText,
        targetText: translationResult.targetText,
        sourceLang: translationResult.sourceLanguage,
        targetLang: translationResult.targetLanguage,
        confidence: translationResult.confidence,
        processingTimeMs: translationResult.processingTimeMs,
      });
    } catch (error) {
      console.error('[INMO] Translation error:', error);
      res.status(500).json({ error: "翻译请求失败" });
    }
  });

  app.post("/api/inmo/devices/:id/ocr", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }

      const { imageBase64, targetLang } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "图片数据不能为空" });
      }

      const ocrRequest = { imageBase64, timestamp: Date.now() };

      if (targetLang) {
        const result = await inmoBridgeService.performOCRAndTranslate(ocrRequest, targetLang);
        
        device.status.displayOn = true;
        device.lastUpdate = new Date();

        broadcastToDevice(req.params.id, {
          type: 'INMO_OCR_TRANSLATION',
          ocr: result.ocr,
          translation: result.translation,
        });

        res.json({
          success: true,
          ocr: result.ocr,
          translation: result.translation,
        });
      } else {
        const ocrResult = await inmoBridgeService.performOCR(ocrRequest);

        device.status.displayOn = true;
        device.lastUpdate = new Date();

        broadcastToDevice(req.params.id, {
          type: 'INMO_OCR',
          ocr: ocrResult,
        });

        res.json({
          success: true,
          ocr: ocrResult,
        });
      }
    } catch (error) {
      console.error('[INMO] OCR error:', error);
      res.status(500).json({ error: "OCR识别失败" });
    }
  });

  app.post("/api/inmo/devices/:id/voice-command", requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "设备不存在" });
      }

      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "语音指令不能为空" });
      }

      const command = inmoBridgeService.parseVoiceCommand(transcript);

      if (!command) {
        res.json({
          success: false,
          message: "未识别到有效指令",
          transcript,
        });
        return;
      }

      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_VOICE_COMMAND',
        command,
      });

      res.json({
        success: true,
        command,
        transcript,
      });
    } catch (error) {
      console.error('[INMO] Voice command error:', error);
      res.status(500).json({ error: "语音指令处理失败" });
    }
  });

  app.get("/api/inmo/bridge/stats", requireMaster, async (_req, res) => {
    try {
      const stats = inmoBridgeService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取桥接服务状态失败" });
    }
  });

  // ===== 小智感知核心 API (Perception Core) =====

  app.post("/api/perception/session", requireMaster, async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: "设备ID不能为空" });
      }
      const userRole = req.userRole || 'MASTER';
      const session = await perceptionCore.createSession(deviceId, userRole);
      res.status(201).json({
        success: true,
        session: {
          id: session.id,
          deviceId: session.deviceId,
          visionEnabled: session.visionEnabled,
          audioEnabled: session.audioEnabled,
        },
      });
    } catch (error) {
      console.error('[Perception] Create session error:', error);
      res.status(500).json({ error: "创建感知会话失败" });
    }
  });

  app.delete("/api/perception/session/:sessionId", requireMaster, async (req, res) => {
    try {
      const success = await perceptionCore.endSession(req.params.sessionId);
      if (!success) {
        return res.status(404).json({ error: "会话不存在" });
      }
      res.json({ success: true, message: "感知会话已结束" });
    } catch (error) {
      res.status(500).json({ error: "结束感知会话失败" });
    }
  });

  app.post("/api/perception/session/:sessionId/vision", requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "图片数据不能为空" });
      }
      const result = await perceptionCore.processVisionFrame(req.params.sessionId, imageBase64);
      if (result.response && result.response.type !== 'SILENT') {
        await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
      }
      res.json({
        success: true,
        frame: result.frame,
        response: result.response,
      });
    } catch (error: any) {
      console.error('[Perception] Vision error:', error);
      res.status(500).json({ error: error.message || "视觉处理失败" });
    }
  });

  app.post("/api/perception/session/:sessionId/audio", requireMaster, async (req, res) => {
    try {
      const { transcript, speaker, language } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "语音内容不能为空" });
      }
      const result = await perceptionCore.processAudioSegment(
        req.params.sessionId,
        transcript,
        speaker || 'unknown',
        language || 'zh-CN'
      );
      if (result.response && result.response.type !== 'SILENT') {
        await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
      }
      res.json({
        success: true,
        segment: result.segment,
        response: result.response,
      });
    } catch (error: any) {
      console.error('[Perception] Audio error:', error);
      res.status(500).json({ error: error.message || "听觉处理失败" });
    }
  });

  app.post("/api/perception/session/:sessionId/perceive", requireMaster, async (req, res) => {
    try {
      const { imageBase64, transcript } = req.body;
      if (!imageBase64 && !transcript) {
        return res.status(400).json({ error: "需要提供图片或语音内容" });
      }
      const result = await perceptionCore.processCombinedInput(
        req.params.sessionId,
        imageBase64,
        transcript
      );
      if (result.response.type !== 'SILENT') {
        await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
      }
      res.json({
        success: true,
        response: result.response,
      });
    } catch (error: any) {
      console.error('[Perception] Combined error:', error);
      res.status(500).json({ error: error.message || "感知处理失败" });
    }
  });

  app.get("/api/perception/stats", requireMaster, async (_req, res) => {
    try {
      const stats = perceptionCore.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取感知核心状态失败" });
    }
  });

  app.delete("/api/inmo/devices/:id", requireMaster, async (req, res) => {
    try {
      if (!inmoDevices.has(req.params.id)) {
        return res.status(404).json({ error: "设备不存在" });
      }
      
      inmoDevices.delete(req.params.id);
      await auditAction('INMO_DEVICE_REMOVED', req.userRole || 'MASTER', 'inmo_device', req.params.id, {}, 'SUCCESS', req);
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "删除设备失败" });
    }
  });

  // ===== Z5: Mock-Op Layer (动作转换器) =====

  app.post("/api/mockop/session", async (req, res) => {
    try {
      const { userId, deviceId, capabilities } = req.body;
      
      if (!userId || !deviceId || !capabilities) {
        return res.status(400).json({ 
          error: "缺少必要参数", 
          required: ["userId", "deviceId", "capabilities"] 
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
      console.error('[MockOp] Create session error:', error);
      res.status(500).json({ error: "创建会话失败" });
    }
  });

  app.get("/api/mockop/session/:sessionId", async (req, res) => {
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
      res.status(500).json({ error: "获取会话失败" });
    }
  });

  app.get("/api/mockop/sessions/:userId", async (req, res) => {
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
      res.status(500).json({ error: "获取用户会话失败" });
    }
  });

  app.post("/api/mockop/heartbeat/:sessionId", async (req, res) => {
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
      res.status(500).json({ error: "心跳更新失败" });
    }
  });

  app.delete("/api/mockop/session/:sessionId", async (req, res) => {
    try {
      const success = closeSession(req.params.sessionId);
      
      if (!success) {
        return res.status(404).json({ error: "会话不存在" });
      }
      
      res.json({ success: true, message: "会话已关闭" });
    } catch (error) {
      res.status(500).json({ error: "关闭会话失败" });
    }
  });

  app.post("/api/mockop/parse", async (req, res) => {
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
      res.status(500).json({ error: "解析指令失败" });
    }
  });

  app.post("/api/mockop/dispatch", async (req, res) => {
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
      console.error('[MockOp] Dispatch error:', error);
      res.status(500).json({ error: "派发指令失败" });
    }
  });

  app.post("/api/mockop/action/complete", async (req, res) => {
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
      res.status(500).json({ error: "完成操作失败" });
    }
  });

  app.get("/api/mockop/guide/:platform", async (req, res) => {
    try {
      const guide = getAccessibilityGuide(req.params.platform);
      res.json(guide);
    } catch (error) {
      res.status(500).json({ error: "获取权限指南失败" });
    }
  });

  app.post("/api/mockop/script/web", async (req, res) => {
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
      res.status(500).json({ error: "生成Web脚本失败" });
    }
  });

  app.post("/api/mockop/script/android", async (req, res) => {
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
      res.status(500).json({ error: "生成Android脚本失败" });
    }
  });

  app.post("/api/mockop/script/pyautogui", async (req, res) => {
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
      res.status(500).json({ error: "生成PyAutoGUI脚本失败" });
    }
  });

  app.get("/api/mockop/stats", async (req, res) => {
    try {
      const stats = getSessionStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取统计信息失败" });
    }
  });

  app.post("/api/z4/execute-with-action", async (req, res) => {
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
      console.error('[Z4] Execute with action error:', error);
      res.status(500).json({ error: "执行失败" });
    }
  });

  // ===== Biometric Authentication (生物特征认证) =====

  app.get("/api/biometric/status", attachRole, requireMaster, async (req, res) => {
    try {
      const userId = 'master';
      const dbStatus = await biometricAuthService.getSecurityStatusFromDB(userId);
      const profile = biometricAuthService.getProfile(userId);
      
      res.json({
        success: true,
        ...dbStatus,
        face: profile.face ? {
          enrolled: profile.face.enrolled,
          enrolledAt: profile.face.enrolledAt,
          qualityScore: profile.face.qualityScore,
          verificationCount: profile.face.verificationCount,
          lastVerified: profile.face.lastVerified
        } : { enrolled: false },
        fingerprint: profile.fingerprint ? {
          enrolled: profile.fingerprint.enrolled,
          enrolledAt: profile.fingerprint.enrolledAt,
          verificationCount: profile.fingerprint.verificationCount,
          lastVerified: profile.fingerprint.lastVerified
        } : { enrolled: false },
        voice: profile.voice ? {
          enrolled: profile.voice.enrolled,
          enrolledAt: profile.voice.enrolledAt,
          sampleCount: profile.voice.sampleCount,
          verificationCount: profile.voice.verificationCount,
          lastVerified: profile.voice.lastVerified
        } : { enrolled: false },
        persistence: {
          enabled: true,
          similarityThreshold: 0.85,
          lockThreshold: 5,
          lockDurationMinutes: 30
        }
      });
    } catch (error) {
      console.error('[Biometric] Get status error:', error);
      res.status(500).json({ error: "获取生物特征状态失败" });
    }
  });

  app.post("/api/biometric/face/enroll", attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "请提供面容照片" });
      }

      const result = await biometricAuthService.enrollFace('master', imageBase64);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          profile: result.profile,
          enrollmentData: result.enrollmentData
        });
      } else {
        res.status(400).json({ 
          success: false,
          error: result.message 
        });
      }
    } catch (error) {
      console.error('[Biometric] Face enroll error:', error);
      res.status(500).json({ error: "面容录入失败" });
    }
  });

  app.post("/api/biometric/face/verify", attachRole, async (req, res) => {
    try {
      const { referenceImage, capturedImage, imageBase64 } = req.body;
      
      if (imageBase64 && !referenceImage && !capturedImage) {
        const simpleResult = await biometricAuthService.verifyFaceSimple('master', imageBase64);
        return res.json(simpleResult);
      }
      
      if (!referenceImage || !capturedImage) {
        return res.status(400).json({ 
          success: false,
          verified: false,
          error: "请提供参考照片和新捕获的照片进行1:1比对",
          hint: "新API需要: referenceImage(录入时的原始照片) + capturedImage(当前捕获的照片)",
          migration: "或使用 imageBase64 进行简单质量检测"
        });
      }

      const result = await biometricAuthService.verifyFace('master', referenceImage, capturedImage);
      res.json(result);
    } catch (error) {
      console.error('[Biometric] Face verify error:', error);
      res.status(500).json({ error: "面容验证失败" });
    }
  });

  app.post("/api/biometric/face/quality", attachRole, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "请提供照片" });
      }

      const { faceCompareService } = await import('../services/face-compare');
      const result = await faceCompareService.checkFaceQuality(imageBase64);
      res.json(result);
    } catch (error) {
      console.error('[Biometric] Face quality check error:', error);
      res.status(500).json({ error: "人脸质量检测失败" });
    }
  });

  app.post("/api/biometric/face/compare", attachRole, async (req, res) => {
    try {
      const { imageA, imageB } = req.body;
      
      if (!imageA || !imageB) {
        return res.status(400).json({ 
          error: "请提供两张照片进行比对",
          hint: "imageA: 第一张照片, imageB: 第二张照片"
        });
      }

      const { faceCompareService } = await import('../services/face-compare');
      const result = await faceCompareService.compareFaces(imageA, imageB);
      res.json(result);
    } catch (error) {
      console.error('[Biometric] Face compare error:', error);
      res.status(500).json({ error: "人脸比对失败" });
    }
  });

  app.post("/api/biometric/fingerprint/enroll", attachRole, requireMaster, async (req, res) => {
    try {
      const { credentialId, publicKey, attestationType } = req.body;
      
      if (!credentialId || !publicKey) {
        return res.status(400).json({ error: "无效的指纹凭证" });
      }

      const result = await biometricAuthService.enrollFingerprint(
        'master', 
        credentialId, 
        publicKey, 
        attestationType
      );
      
      res.json({
        success: result.success,
        message: result.message,
        profile: result.profile
      });
    } catch (error) {
      console.error('[Biometric] Fingerprint enroll error:', error);
      res.status(500).json({ error: "指纹录入失败" });
    }
  });

  app.get("/api/biometric/verification-logs", attachRole, requireMaster, async (req, res) => {
    try {
      const userId = 'master';
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await biometricAuthService.getVerificationLogs(userId, limit);
      
      res.json({
        success: true,
        logs,
        total: logs.length,
        message: `最近${limit}条验证记录`
      });
    } catch (error) {
      console.error('[Biometric] Get verification logs error:', error);
      res.status(500).json({ error: "获取验证日志失败" });
    }
  });

  app.get("/api/biometric/lock-status", attachRole, async (req, res) => {
    try {
      const userId = 'master';
      const lockStatus = await biometricAuthService.isAccountLocked(userId);
      
      res.json({
        success: true,
        ...lockStatus,
        config: {
          maxAttempts: 5,
          lockDurationMinutes: 30
        }
      });
    } catch (error) {
      console.error('[Biometric] Check lock status error:', error);
      res.status(500).json({ error: "检查锁定状态失败" });
    }
  });

  app.post("/api/biometric/unlock", attachRole, requireMaster, async (req, res) => {
    try {
      const userId = 'master';
      await biometricAuthService.unlockAccount(userId);
      
      res.json({
        success: true,
        message: "账户已解锁"
      });
    } catch (error) {
      console.error('[Biometric] Unlock account error:', error);
      res.status(500).json({ error: "解锁账户失败" });
    }
  });

  app.post("/api/avatar/analyze", attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "请提供头像照片" });
      }

      const result = await avatarRecognitionService.analyzeAvatar(imageBase64);
      
      if (result.success) {
        res.json({
          success: true,
          analysis: result.analysis
        });
      } else {
        res.status(400).json({ 
          success: false,
          error: result.error 
        });
      }
    } catch (error) {
      console.error('[Avatar] Analyze error:', error);
      res.status(500).json({ error: "头像分析失败" });
    }
  });

  // ===== Phase 1.5: Scheduler (后台任务调度器) =====

  app.get("/api/scheduler/jobs", attachRole, requireMaster, async (req, res) => {
    try {
      const jobs = await schedulerService.getJobList();
      const status = schedulerService.getStatus();
      
      res.json({
        success: true,
        jobs,
        status,
        total: jobs.length
      });
    } catch (error) {
      console.error('[Scheduler] Get jobs error:', error);
      res.status(500).json({ error: "获取任务列表失败" });
    }
  });

  app.get("/api/scheduler/history", attachRole, requireMaster, async (req, res) => {
    try {
      const jobType = req.query.jobType as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await schedulerService.getJobHistory(jobType, limit);
      
      res.json({
        success: true,
        history,
        total: history.length
      });
    } catch (error) {
      console.error('[Scheduler] Get history error:', error);
      res.status(500).json({ error: "获取执行历史失败" });
    }
  });

  app.post("/api/scheduler/trigger/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.triggerJob(jobType);
      
      res.json(result);
    } catch (error) {
      console.error('[Scheduler] Trigger job error:', error);
      res.status(500).json({ error: "触发任务失败" });
    }
  });

  app.post("/api/scheduler/pause/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.pauseJob(jobType);
      
      res.json(result);
    } catch (error) {
      console.error('[Scheduler] Pause job error:', error);
      res.status(500).json({ error: "暂停任务失败" });
    }
  });

  app.post("/api/scheduler/resume/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.resumeJob(jobType);
      
      res.json(result);
    } catch (error) {
      console.error('[Scheduler] Resume job error:', error);
      res.status(500).json({ error: "恢复任务失败" });
    }
  });

  app.get("/api/scheduler/status", attachRole, async (req, res) => {
    try {
      const status = schedulerService.getStatus();
      
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error('[Scheduler] Get status error:', error);
      res.status(500).json({ error: "获取调度器状态失败" });
    }
  });

  console.log('[Scheduler] Routes registered at /api/scheduler/*');

  // ===== Phase 2.2: Smart Reminder Scheduler (智能提醒调度器) =====
  import('./reminder-scheduler').then(module => {
    app.use('/api/reminders', attachRole, module.default);
    console.log('[ReminderScheduler] Routes registered at /api/reminders/*');
  });

  // ===== Phase 2.3: Contract Pipeline (合同草拟管道) =====
  import('./contract-pipeline').then(module => {
    app.use('/api/contracts', attachRole, module.default);
    console.log('[ContractPipeline] Routes registered at /api/contracts/*');
  });

  // ===== Z2: Contact Biometrics (联系人生物特征识别) =====

  app.get("/api/contacts/biometrics", attachRole, requireMaster, async (req, res) => {
    try {
      const { contactRecognitionService } = await import('../services/contact-recognition');
      const contacts = await contactRecognitionService.getEnrolledContacts();
      res.json({ 
        success: true, 
        contacts,
        total: contacts.length
      });
    } catch (error) {
      console.error('[ContactRecognition] List error:', error);
      res.status(500).json({ error: "获取联系人特征列表失败" });
    }
  });

  app.post("/api/contacts/biometrics/enroll/face", attachRole, requireMaster, async (req, res) => {
    try {
      const { personId, imageBase64, notes } = req.body;
      
      if (!personId || !imageBase64) {
        return res.status(400).json({ 
          error: "请提供联系人ID和人脸照片",
          hint: { personId: "联系人ID", imageBase64: "Base64格式的照片" }
        });
      }
      
      // Validate image size (max 5MB base64)
      if (imageBase64.length > 7 * 1024 * 1024) {
        return res.status(400).json({ error: "图片过大，请使用小于5MB的照片" });
      }

      const { contactRecognitionService } = await import('../services/contact-recognition');
      const result = await contactRecognitionService.enrollFace(personId, imageBase64, notes);
      
      if (result.success) {
        res.json({
          success: true,
          message: `已为 ${result.personName} 录入人脸特征`,
          biometricId: result.biometricId,
          qualityScore: result.qualityScore
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('[ContactRecognition] Enroll face error:', error);
      res.status(500).json({ error: "录入联系人人脸失败" });
    }
  });

  app.post("/api/contacts/biometrics/recognize/face", attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64, threshold } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ 
          error: "请提供需要识别的人脸照片",
          hint: { imageBase64: "Base64格式的照片", threshold: "可选，匹配阈值0-100，默认60" }
        });
      }

      const { contactRecognitionService } = await import('../services/contact-recognition');
      const result = await contactRecognitionService.recognizeFace(
        imageBase64, 
        typeof threshold === 'number' ? threshold : 60
      );
      
      res.json({
        success: result.success,
        matches: result.matches,
        topMatch: result.matches[0] || null,
        totalCompared: result.totalCompared,
        processingTimeMs: result.processingTimeMs,
        message: result.matches.length > 0 
          ? `识别到 ${result.matches.length} 位可能的联系人`
          : '未能识别出匹配的联系人'
      });
    } catch (error) {
      console.error('[ContactRecognition] Recognize face error:', error);
      res.status(500).json({ error: "人脸识别失败" });
    }
  });

  app.delete("/api/contacts/biometrics/:biometricId", attachRole, requireMaster, async (req, res) => {
    try {
      const { biometricId } = req.params;
      
      const { contactRecognitionService } = await import('../services/contact-recognition');
      const success = await contactRecognitionService.deleteBiometric(biometricId);
      
      if (success) {
        res.json({ success: true, message: "已删除该生物特征记录" });
      } else {
        res.status(400).json({ success: false, error: "删除失败" });
      }
    } catch (error) {
      console.error('[ContactRecognition] Delete error:', error);
      res.status(500).json({ error: "删除生物特征失败" });
    }
  });

  app.post("/api/contacts/biometrics/refresh-cache", attachRole, requireMaster, async (req, res) => {
    try {
      const { contactRecognitionService } = await import('../services/contact-recognition');
      await contactRecognitionService.refreshCache();
      res.json({ success: true, message: "缓存已刷新" });
    } catch (error) {
      console.error('[ContactRecognition] Refresh cache error:', error);
      res.status(500).json({ error: "刷新缓存失败" });
    }
  });

  // ===== Z2: Psychological Profiling (心理侧写) =====

  app.get("/api/psych-profiles", attachRole, requireMaster, async (req, res) => {
    try {
      const { psychProfilerService } = await import('../services/psych-profiler');
      const profiles = await psychProfilerService.getAllProfiles();
      res.json({ success: true, profiles, total: profiles.length });
    } catch (error) {
      console.error('[PsychProfile] List error:', error);
      res.status(500).json({ error: "获取心理侧写列表失败" });
    }
  });

  app.get("/api/psych-profiles/:personId", attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { psychProfilerService } = await import('../services/psych-profiler');
      const profile = await psychProfilerService.getProfile(personId);
      
      if (!profile) {
        return res.status(404).json({ success: false, error: "该联系人暂无心理侧写" });
      }
      
      res.json({ success: true, profile });
    } catch (error) {
      console.error('[PsychProfile] Get error:', error);
      res.status(500).json({ error: "获取心理侧写失败" });
    }
  });

  app.post("/api/psych-profiles/analyze", attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64, personName } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "请提供照片" });
      }
      
      // Validate image size
      if (imageBase64.length > 7 * 1024 * 1024) {
        return res.status(400).json({ error: "图片过大" });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.analyzeFromPhoto(imageBase64, personName);
      res.json(result);
    } catch (error) {
      console.error('[PsychProfile] Analyze error:', error);
      res.status(500).json({ error: "心理分析失败" });
    }
  });

  app.post("/api/psych-profiles/:personId", attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { imageBase64, sourceType } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "请提供照片" });
      }
      
      if (imageBase64.length > 7 * 1024 * 1024) {
        return res.status(400).json({ error: "图片过大" });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.createOrUpdateProfile(
        personId, 
        imageBase64, 
        sourceType || 'PHOTO'
      );
      
      if (result.success) {
        const profile = await psychProfilerService.getProfile(personId);
        res.json({ ...result, profile });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('[PsychProfile] Create/Update error:', error);
      res.status(500).json({ error: "创建心理侧写失败" });
    }
  });

  app.post("/api/psych-profiles/:personId/observation", attachRole, requireMaster, async (req, res) => {
    try {
      const { personId } = req.params;
      const { note, corrections } = req.body;
      
      if (!note) {
        return res.status(400).json({ error: "请提供观察备注" });
      }

      const { psychProfilerService } = await import('../services/psych-profiler');
      const result = await psychProfilerService.addObservationNote(personId, note, corrections);
      
      if (result.success) {
        const profile = await psychProfilerService.getProfile(personId);
        res.json({ ...result, profile });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('[PsychProfile] Observation error:', error);
      res.status(500).json({ error: "添加观察备注失败" });
    }
  });

  // ===== Z1: Voiceprint Authentication (声纹锁) =====

  app.get("/api/voiceprint/status", attachRole, async (_req, res) => {
    try {
      const masterVoiceprint = await storage.getMasterVoiceprint();
      if (!masterVoiceprint) {
        res.json({
          enrolled: false,
          sampleCount: 0,
          sampleRequired: 3,
          message: "主人尚未录入声纹",
        });
        return;
      }
      const sampleCount = masterVoiceprint.sampleCount ?? 0;
      res.json({
        enrolled: sampleCount >= 3,
        sampleCount,
        sampleRequired: 3,
        confidenceThreshold: masterVoiceprint.confidenceThreshold,
        lastVerified: masterVoiceprint.lastVerified,
        message: sampleCount >= 3 
          ? "声纹锁已激活" 
          : `还需录入 ${3 - sampleCount} 次声纹样本`,
      });
    } catch (error) {
      console.error('[Z1] Get voiceprint status error:', error);
      res.status(500).json({ error: "获取声纹状态失败" });
    }
  });

  app.post("/api/voiceprint/enroll", attachRole, requireMaster, async (req, res) => {
    try {
      const { audioData, duration, sampleRate } = req.body;
      
      if (!audioData || !Array.isArray(audioData)) {
        res.status(400).json({ error: "无效的音频数据" });
        return;
      }
      
      const { processVoiceSample, generateSampleHash, mergeFeatureTemplates } = await import("../services/voiceprint");
      
      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const features = processVoiceSample(sample);
      const sampleHash = generateSampleHash(sample);
      
      let voiceprint = await storage.getMasterVoiceprint();
      const existingFeatures: any[] = voiceprint?.featureVector ? [voiceprint.featureVector] : [];
      const existingHashes: string[] = voiceprint?.sampleHashes || [];
      
      if (existingHashes.includes(sampleHash)) {
        res.status(400).json({ error: "该声纹样本已存在，请录入不同的语音" });
        return;
      }
      
      const featureVector = [features.mfcc, features.pitch / 500, features.energy, features.spectralCentroid / 10000, features.zeroCrossRate];
      existingFeatures.push(featureVector);
      existingHashes.push(sampleHash);
      
      const mergedTemplate = mergeFeatureTemplates(
        existingFeatures.map(f => Array.isArray(f) && f.length === 5 ? {
          mfcc: f[0] as number[],
          pitch: (f[1] as number) * 500,
          energy: f[2] as number,
          spectralCentroid: (f[3] as number) * 10000,
          zeroCrossRate: f[4] as number,
        } : {
          mfcc: new Array(13).fill(0),
          pitch: 150,
          energy: 0.1,
          spectralCentroid: 2000,
          zeroCrossRate: 0.1,
        })
      );
      
      if (voiceprint) {
        await storage.updateVoiceprint("MASTER", {
          featureVector: mergedTemplate,
          sampleHashes: existingHashes,
          sampleCount: existingHashes.length,
        });
      } else {
        await storage.createVoiceprint({
          userId: "MASTER",
          label: "MASTER",
          featureVector: mergedTemplate,
          sampleHashes: existingHashes,
          sampleCount: 1,
          confidenceThreshold: 0.72,
        });
      }
      
      const sampleCount = existingHashes.length;
      const enrolled = sampleCount >= 3;
      
      await auditAction('VOICEPRINT_ENROLL', 'MASTER', 'voiceprint', 'MASTER', {
        sampleCount,
        enrolled,
        sampleHash: sampleHash.substring(0, 8),
      }, enrolled ? 'SUCCESS' : 'FAILED');
      
      res.json({
        success: true,
        enrolled,
        sampleCount,
        sampleRequired: 3,
        message: enrolled 
          ? "声纹录入完成，声纹锁已激活！" 
          : `已录入 ${sampleCount}/3 次样本，请继续`,
      });
    } catch (error) {
      console.error('[Z1] Enroll voiceprint error:', error);
      res.status(500).json({ error: "声纹录入失败" });
    }
  });

  app.post("/api/voiceprint/refine", attachRole, requireMaster, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, silent } = req.body;
      
      if (!audioData || !Array.isArray(audioData)) {
        res.status(400).json({ error: "无效的音频数据" });
        return;
      }
      
      const voiceprint = await storage.getMasterVoiceprint();
      if (!voiceprint || !voiceprint.featureVector || (voiceprint.sampleCount || 0) < 3) {
        res.status(400).json({ error: "请先完成声纹初始录入" });
        return;
      }
      
      const { processVoiceSample, verifyVoiceprint, mergeFeatureTemplates } = await import("../services/voiceprint");
      
      const sample = { audioData, duration: duration || 2, sampleRate: sampleRate || 16000 };
      const storedTemplate = voiceprint.featureVector as number[];
      const threshold = 0.65;
      
      const verifyResult = verifyVoiceprint(sample, storedTemplate, threshold);
      
      if (!verifyResult.isMatch) {
        if (!silent) {
          console.log('[Z1] 静默声纹优化: 声音不匹配主人，已忽略');
        }
        res.json({ 
          refined: false, 
          message: "声音样本与主人声纹不匹配",
          confidence: verifyResult.confidence 
        });
        return;
      }
      
      const features = processVoiceSample(sample);
      
      const existingFeatures = [{
        mfcc: Array.isArray(storedTemplate[0]) ? storedTemplate[0] as number[] : [storedTemplate[0] as number],
        pitch: (storedTemplate[1] as number) * 500,
        energy: storedTemplate[2] as number,
        spectralCentroid: (storedTemplate[3] as number) * 10000,
        zeroCrossRate: storedTemplate[4] as number,
      }, features];
      
      const refinedTemplate = mergeFeatureTemplates(existingFeatures);
      
      await storage.updateVoiceprint("MASTER", {
        featureVector: refinedTemplate,
      });
      
      console.log('[Z1] 静默声纹优化成功，置信度:', verifyResult.confidence.toFixed(3));
      
      res.json({
        refined: true,
        message: "声纹已静默优化",
        confidence: verifyResult.confidence,
      });
    } catch (error) {
      console.error('[Z1] Refine voiceprint error:', error);
      res.status(500).json({ error: "声纹优化失败" });
    }
  });

  app.post("/api/voiceprint/verify", attachRole, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, requestedAction } = req.body;
      
      const masterVoiceprint = await storage.getMasterVoiceprint();
      if (!masterVoiceprint || !masterVoiceprint.featureVector || (masterVoiceprint.sampleCount || 0) < 3) {
        res.json({
          verified: true,
          isMaster: true,
          confidence: 1,
          message: "声纹锁未激活，开放模式",
          requiresEnrollment: true,
          allowed: true,
        });
        return;
      }
      
      const { verifyVoiceprint, checkVoiceAuthorization } = await import("../services/voiceprint");
      
      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const storedTemplate = masterVoiceprint.featureVector as number[];
      const threshold = masterVoiceprint.confidenceThreshold || 0.72;
      
      const result = verifyVoiceprint(sample, storedTemplate, threshold);
      
      if (result.isMatch) {
        await storage.updateVoiceprint("MASTER", { lastVerified: new Date() });
        res.json({
          verified: true,
          isMaster: true,
          confidence: result.confidence,
          message: "主人声纹验证通过",
          requiresEnrollment: false,
          allowed: true,
        });
        return;
      }
      
      const authorizations = await storage.getVoiceAuthorizations();
      const authCheck = checkVoiceAuthorization(
        requestedAction || 'CHAT',
        'ACTION',
        authorizations.map(a => ({
          authType: a.authType,
          target: a.target,
          isActive: a.isActive ?? 1,
          expiresAt: a.expiresAt,
        }))
      );
      
      if (!authCheck.allowed) {
        res.status(403).json({
          verified: false,
          isMaster: false,
          confidence: result.confidence,
          message: "声纹不匹配，需要主人授权",
          requiresEnrollment: false,
          allowed: false,
          requiresAuth: true,
        });
        return;
      }
      
      res.json({
        verified: false,
        isMaster: false,
        confidence: result.confidence,
        message: authCheck.reason,
        requiresEnrollment: false,
        allowed: true,
      });
    } catch (error) {
      console.error('[Z1] Verify voiceprint error:', error);
      res.status(500).json({ error: "声纹验证失败" });
    }
  });

  app.get("/api/voiceprint/authorizations", attachRole, async (_req, res) => {
    try {
      const authorizations = await storage.getVoiceAuthorizations();
      res.json(authorizations);
    } catch (error) {
      console.error('[Z1] Get authorizations error:', error);
      res.status(500).json({ error: "获取授权列表失败" });
    }
  });

  app.post("/api/voiceprint/authorize", attachRole, requireMaster, async (req, res) => {
    try {
      const { authType, target, scope, expiresInHours } = req.body;
      
      if (!authType || !target) {
        res.status(400).json({ error: "缺少必要参数" });
        return;
      }
      
      const expiresAt = expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) 
        : null;
      
      const auth = await storage.createVoiceAuthorization({
        authType,
        target,
        scope: scope || null,
        grantedBy: "MASTER",
        expiresAt,
      });
      
      await auditAction('VOICE_AUTHORIZATION', 'MASTER', 'authorization', auth.id, {
        authType,
        target,
        scope,
        expiresAt,
      }, 'SUCCESS');
      
      res.json({
        success: true,
        authorization: auth,
        message: `已授权${authType === 'PERSON' ? '与' : ''}${target}${authType === 'PERSON' ? '对话' : '操作'}`,
      });
    } catch (error) {
      console.error('[Z1] Create authorization error:', error);
      res.status(500).json({ error: "创建授权失败" });
    }
  });

  app.delete("/api/voiceprint/authorize/:id", attachRole, requireMaster, async (req, res) => {
    try {
      await storage.deactivateVoiceAuthorization(req.params.id);
      
      await auditAction('VOICE_AUTHORIZATION_REVOKE', 'MASTER', 'authorization', req.params.id, {
        authId: req.params.id,
      }, 'SUCCESS');
      
      res.json({ success: true, message: "授权已撤销" });
    } catch (error) {
      console.error('[Z1] Revoke authorization error:', error);
      res.status(500).json({ error: "撤销授权失败" });
    }
  });

  app.post("/api/voiceprint/check-permission", attachRole, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, action } = req.body;
      
      const masterVoiceprint = await storage.getMasterVoiceprint();
      
      if (!masterVoiceprint || (masterVoiceprint.sampleCount || 0) < 3) {
        res.json({
          allowed: true,
          isMaster: true,
          reason: "声纹锁未激活，开放模式",
          requiresAuth: false,
        });
        return;
      }
      
      const { verifyVoiceprint, checkVoiceAuthorization } = await import("../services/voiceprint");
      
      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const storedTemplate = masterVoiceprint.featureVector as number[];
      const threshold = masterVoiceprint.confidenceThreshold || 0.72;
      
      const verifyResult = verifyVoiceprint(sample, storedTemplate, threshold);
      
      if (verifyResult.isMatch) {
        await storage.updateVoiceprint("MASTER", { lastVerified: new Date() });
        res.json({
          allowed: true,
          isMaster: true,
          confidence: verifyResult.confidence,
          reason: "主人声纹验证通过",
          requiresAuth: false,
        });
        return;
      }
      
      const authorizations = await storage.getVoiceAuthorizations();
      const authCheck = checkVoiceAuthorization(
        action || 'CHAT', 
        'ACTION', 
        authorizations.map(a => ({
          authType: a.authType,
          target: a.target,
          isActive: a.isActive ?? 1,
          expiresAt: a.expiresAt,
        }))
      );
      
      res.json({
        allowed: authCheck.allowed,
        isMaster: false,
        confidence: verifyResult.confidence,
        reason: authCheck.reason,
        requiresAuth: authCheck.requiresMasterAuth,
      });
    } catch (error) {
      console.error('[Z1] Check permission error:', error);
      res.status(500).json({ error: "权限检查失败" });
    }
  });

  // ===== Z4: Expert System API (专家系统AI调用) =====

  app.post("/api/z4/expert-analysis", async (req, res) => {
    try {
      const { expertType, query, context } = req.body;
      
      if (!expertType || !query) {
        return res.status(400).json({ error: "缺少必需参数: expertType, query" });
      }

      const validExpertTypes = ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'SECRETARY', 'PLANNING'];
      if (!validExpertTypes.includes(expertType)) {
        return res.status(400).json({ error: `无效专家类型: ${expertType}，有效类型: ${validExpertTypes.join(', ')}` });
      }

      const expertSystemPrompts: Record<string, string> = {
        LEGAL: `你是Z4法务专家模块。以法律风险分析师的身份进行分析。请提供：1.法律风险评估 2.合规建议 3.风险等级(LOW/MEDIUM/HIGH/CRITICAL)`,
        FINANCE: `你是Z4财务专家模块。以财务分析师的身份进行分析。请提供：1.财务影响分析 2.ROI预估 3.风险等级(LOW/MEDIUM/HIGH/CRITICAL)`,
        STRATEGY: `你是Z4策略专家模块。以战略规划师的身份进行分析。请提供：1.博弈分析 2.对冲策略 3.行动建议`,
        PSYCHOLOGY: `你是Z4心理专家模块。以心理分析师的身份进行分析。请提供：1.对方心理分析 2.情绪预判 3.沟通策略`,
        SECRETARY: `你是Z4秘书专家模块。以效率专家的身份进行分析。请提供：1.任务分解 2.时间规划 3.执行步骤`,
        PLANNING: `你是Z4规划专家模块。以项目规划师的身份进行分析。请提供：1.方案设计 2.可行性评估 3.替代方案`,
      };

      const systemPrompt = expertSystemPrompts[expertType];
      const userMessage = context ? `${query}\n\n上下文：${context}` : query;
      
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];
      
      const result = await chatWithDashScope(messages, userMessage, storage);
      
      const decision = await storage.createExpertDecision({
        expertType,
        query,
        chainOfThought: result.chainOfThought || {},
        recommendation: result.message,
        confidence: result.chainOfThought?.confidence || 0.75,
        hpCost: 10,
      });
      
      res.json({
        success: true,
        expertType,
        analysis: result.message,
        chainOfThought: result.chainOfThought,
        decisionId: decision.id,
        hpCost: 10,
      });
    } catch (error) {
      console.error('[Z4] Expert analysis error:', error);
      res.status(500).json({ error: "专家分析失败" });
    }
  });

  app.get("/api/z4/expert-history", async (req, res) => {
    try {
      const expertType = req.query.expertType as string | undefined;
      const decisions = await storage.getExpertDecisions(expertType);
      res.json(decisions);
    } catch (error) {
      res.status(500).json({ error: "获取专家决策历史失败" });
    }
  });

  // ===== Z1: HP Persistence API =====
  
  app.get("/api/z1/hp", async (req, res) => {
    try {
      const state = await storage.getEvolutionState();
      res.json({
        hp: state?.academicXp || 1000,
        maxHp: 1000,
        academicLevel: state?.academicLevel || 'BACHELOR',
      });
    } catch (error) {
      res.status(500).json({ error: "获取HP失败" });
    }
  });

  app.post("/api/z1/hp/consume", async (req, res) => {
    try {
      const { amount, reason } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "无效的HP消耗量" });
      }
      
      const state = await storage.getEvolutionState();
      const currentHp = state?.academicXp || 1000;
      const newHp = Math.max(0, currentHp - amount);
      
      await storage.updateEvolutionState({ academicXp: newHp });
      
      await storage.createAuditLog({
        action: 'HP_CONSUMED',
        actor: req.userRole || 'SYSTEM',
        targetType: 'hp',
        targetId: 'singleton',
        details: { amount, reason, oldHp: currentHp, newHp },
        result: 'SUCCESS',
      });
      
      res.json({ success: true, previousHp: currentHp, currentHp: newHp, consumed: amount });
    } catch (error) {
      res.status(500).json({ error: "HP消耗失败" });
    }
  });

  app.post("/api/z1/hp/restore", requireMaster, async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "无效的HP恢复量" });
      }
      
      const state = await storage.getEvolutionState();
      const currentHp = state?.academicXp || 0;
      const newHp = Math.min(1000, currentHp + amount);
      
      await storage.updateEvolutionState({ academicXp: newHp });
      
      res.json({ success: true, previousHp: currentHp, currentHp: newHp, restored: amount });
    } catch (error) {
      res.status(500).json({ error: "HP恢复失败" });
    }
  });

  // ===== Talk Sessions API =====
  
  app.post("/api/talk-sessions", async (req, res) => {
    try {
      const { language = 'zh-CN' } = req.body;
      const session = await storage.createTalkSession({
        status: 'LISTENING',
        language,
        talkType: 'UNKNOWN',
      });
      res.json(session);
    } catch (error) {
      console.error('Error creating talk session:', error);
      res.status(500).json({ error: "创建会话失败" });
    }
  });

  app.get("/api/talk-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getTalkSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "会话不存在" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "获取会话失败" });
    }
  });

  app.post("/api/talk-sessions/:id/stop", async (req, res) => {
    try {
      const { rawTranscript } = req.body;
      const sessionId = req.params.id;
      
      const session = await storage.getTalkSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "会话不存在" });
      }

      await storage.updateTalkSession(sessionId, {
        status: 'ANALYZING',
        rawTranscript,
        endedAt: new Date(),
      });

      const { analyzeTalkContent } = await import('../services/talk-analyzer');
      const analysis = await analyzeTalkContent(rawTranscript || '');

      for (const entity of analysis.entities) {
        await storage.createExtractedEntity({
          sessionId,
          entityType: entity.type,
          entityValue: entity.name,
          normalizedValue: entity.name,
          context: entity.context,
          confidence: entity.confidence,
          linkedPersonId: null,
          linkedProjectId: null,
          metadata: { role: entity.role, organization: entity.organization },
        });
      }

      for (const opp of analysis.opportunities) {
        await storage.createOpportunitySignal({
          sessionId,
          opportunityType: opp.type,
          title: opp.title,
          description: opp.description,
          estimatedValue: opp.potentialValue ? parseFloat(opp.potentialValue.replace(/[^0-9.]/g, '')) || null : null,
          urgency: opp.urgency,
          suggestedActions: opp.nextSteps,
          relatedPersonIds: opp.relatedEntities,
          status: 'DETECTED',
        });
      }

      const updated = await storage.updateTalkSession(sessionId, {
        status: 'COMPLETED',
        talkType: analysis.talkType,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error stopping talk session:', error);
      res.status(500).json({ error: "停止会话失败" });
    }
  });

  app.post("/api/talk-sessions/:id/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      const sessionId = req.params.id;
      
      if (!text) {
        return res.status(400).json({ error: "缺少文本内容" });
      }

      const { identifyTalkType } = await import('../services/talk-analyzer');
      const talkType = await identifyTalkType(text);

      if (talkType !== 'UNKNOWN') {
        await storage.updateTalkSession(sessionId, { talkType });
      }

      res.json({ talkType });
    } catch (error) {
      console.error('Error analyzing talk:', error);
      res.status(500).json({ error: "分析失败" });
    }
  });

  app.get("/api/talk-sessions/:id/entities", async (req, res) => {
    try {
      const entities = await storage.getSessionEntities(req.params.id);
      res.json(entities);
    } catch (error) {
      res.status(500).json({ error: "获取实体失败" });
    }
  });

  app.get("/api/talk-sessions/:id/opportunities", async (req, res) => {
    try {
      const opportunities = await storage.getSessionOpportunities(req.params.id);
      res.json(opportunities);
    } catch (error) {
      res.status(500).json({ error: "获取商机失败" });
    }
  });

  app.post("/api/talk-sessions/:id/entities/:entityId/link", requireMaster, async (req, res) => {
    try {
      const { personId, projectId } = req.body;
      const updated = await storage.updateExtractedEntity(req.params.entityId, {
        linkedPersonId: personId,
        linkedProjectId: projectId,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "关联实体失败" });
    }
  });

  app.post("/api/talk-sessions/:id/opportunities/:oppId/action", requireMaster, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateOpportunitySignal(req.params.oppId, { status });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "更新商机状态失败" });
    }
  });

  app.post("/api/talk-sessions/:id/create-contacts", requireMaster, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const entities = await storage.getSessionEntities(sessionId);
      const personEntities = entities.filter(e => e.entityType === 'PERSON' && !e.linkedPersonId);
      
      const created = [];
      for (const entity of personEntities) {
        const metadata = entity.metadata as { role?: string; organization?: string } || {};
        const person = await storage.createPerson({
          name: entity.entityValue,
          role: metadata.role || undefined,
          organization: metadata.organization || undefined,
          addedBy: 'AI_TALK',
          approvalStatus: 'PENDING',
          accessLevel: 'ZONE_BLUE',
        });
        
        await storage.updateExtractedEntity(entity.id, { linkedPersonId: person.id });
        created.push(person);
      }
      
      res.json({ created, count: created.length });
    } catch (error) {
      console.error('Error creating contacts:', error);
      res.status(500).json({ error: "自动创建联系人失败" });
    }
  });

  // ===== Insights Processing API =====
  app.get("/api/insights-processing/active", async (req, res) => {
    try {
      const active = await storage.getActiveInsightsProcessing();
      res.json(active);
    } catch (error) {
      res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.get("/api/insights-processing/:id", async (req, res) => {
    try {
      const record = await storage.getInsightsProcessing(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "记录不存在" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.post("/api/insights-processing", async (req, res) => {
    try {
      const record = await storage.createInsightsProcessing(req.body);
      simulateInsightsProcessing(record.id, record.sessionId, storage);
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: "创建进度记录失败" });
    }
  });

  // ===== User Settings API (AI Config Persistence) =====
  // Security: Users can only access their own settings based on role
  app.get("/api/user-settings/:userId", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (userId !== 'master' && userId !== 'guest') {
        return res.status(400).json({ error: "Invalid userId" });
      }
      
      // Security: MASTER can access any settings, GUEST can only access 'guest' settings
      const requestedRole = userId === 'master' ? 'MASTER' : 'GUEST';
      if (req.userRole === 'GUEST' && userId === 'master') {
        return res.status(403).json({ error: "无权访问此设置", code: 'FORBIDDEN' });
      }
      
      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        // Create real database record on first access instead of fabricated object
        settings = await storage.createUserSettings({ userId });
      }
      res.json(settings);
    } catch (error) {
      console.error('[UserSettings] Get error:', error);
      res.status(500).json({ error: "获取用户设置失败" });
    }
  });

  // Schema for validating user settings updates
  const userSettingsUpdateSchema = z.object({
    voiceEnabled: z.string().optional(),
    autoAnalyze: z.string().optional(),
    wakeWordSensitivity: z.number().min(0).max(1).optional(),
    voiceSpeed: z.number().min(0.5).max(2).optional(),
    avatarName: z.string().min(1).max(50).optional(),
    avatarEmoji: z.string().max(10).optional(),
    preferredLanguage: z.string().optional(),
  });

  app.patch("/api/user-settings/:userId", requireMaster, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (userId !== 'master') {
        return res.status(403).json({ error: "只能修改master设置" });
      }
      
      // Validate request body with Zod schema
      const parseResult = userSettingsUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "请求数据验证失败", 
          details: parseResult.error.flatten() 
        });
      }
      
      const updates = parseResult.data;
      
      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        settings = await storage.createUserSettings({ userId, ...updates });
      } else {
        settings = await storage.updateUserSettings(userId, updates);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('[UserSettings] Update error:', error);
      res.status(500).json({ error: "更新用户设置失败" });
    }
  });

  app.get("/api/user-settings", requireMaster, async (req, res) => {
    try {
      const allSettings = await storage.getAllUserSettings();
      res.json(allSettings);
    } catch (error) {
      res.status(500).json({ error: "获取所有用户设置失败" });
    }
  });

  // ===== Z4 Expert AI Analysis API =====
  
  const expertAnalyzeSchema = z.object({
    expertType: z.enum(['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY']),
    query: z.string().min(1).max(2000),
    context: z.string().optional(),
  });

  const multiExpertSchema = z.object({
    query: z.string().min(1).max(2000),
    experts: z.array(z.enum(['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'])).optional(),
    context: z.string().optional(),
  });

  app.get("/api/expert/types", (req, res) => {
    res.json({
      types: ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'],
      descriptions: {
        LEGAL: '法律顾问 - 合规风险分析',
        FINANCE: '财务分析师 - 投资与财务规划',
        STRATEGY: '策略大师 - 博弈与竞争策略',
        PSYCHOLOGY: '心理专家 - 行为分析与沟通',
        PLANNING: '规划专家 - 项目分解与执行',
        SECRETARY: '私人秘书 - 日程与任务管理',
      },
    });
  });

  app.post("/api/expert/analyze", requireAuth, async (req, res) => {
    try {
      const parseResult = expertAnalyzeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "请求参数无效", 
          details: parseResult.error.flatten() 
        });
      }

      const { expertType, query, context } = parseResult.data;
      console.log(`[ExpertAPI] Single expert analysis: ${expertType}`);

      const analysis = await runExpertAnalysis(expertType as ExpertType, query, context);
      
      await auditAction('EXPERT_ANALYZE', req.userRole || 'MASTER', 'expert', expertType,
        { success: true, expertType, queryLength: query.length }, 'SUCCESS', req
      );

      res.json(analysis);
    } catch (error) {
      console.error('[ExpertAPI] Analysis error:', error);
      res.status(500).json({ error: "专家分析失败，请稍后重试" });
    }
  });

  app.post("/api/expert/multi-analyze", requireAuth, async (req, res) => {
    try {
      const parseResult = multiExpertSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "请求参数无效", 
          details: parseResult.error.flatten() 
        });
      }

      const { query, experts, context } = parseResult.data;
      const selectedExperts = (experts || ['LEGAL', 'FINANCE', 'STRATEGY']) as ExpertType[];
      
      console.log(`[ExpertAPI] Multi-expert analysis: ${selectedExperts.join(', ')}`);

      const analyses = await runMultiExpertAnalysis(query, selectedExperts, context);
      const synthesis = await synthesizeExpertOpinions(analyses);

      await auditAction('EXPERT_MULTI_ANALYZE', req.userRole || 'MASTER', 'expert', 'multi',
        { success: true, experts: selectedExperts, queryLength: query.length }, 'SUCCESS', req
      );

      res.json({
        analyses,
        synthesis,
      });
    } catch (error) {
      console.error('[ExpertAPI] Multi-analysis error:', error);
      res.status(500).json({ error: "多专家分析失败，请稍后重试" });
    }
  });

  // ===== Zero Hallucination Circuit API (专业严谨层) =====

  const professionalQuerySchema = z.object({
    query: z.string().min(1, "查询内容不能为空"),
    mode: z.enum(['LEGAL', 'FINANCE']),
    context: z.string().optional(),
    attachedDocuments: z.array(z.string()).optional(),
  });

  app.post("/api/professional/query", requireAuth, async (req, res) => {
    try {
      const parseResult = professionalQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "请求参数无效", 
          details: parseResult.error.flatten() 
        });
      }

      const { query, mode, context, attachedDocuments } = parseResult.data;
      const userRole = (req.userRole || 'MASTER') as UserRole;
      
      console.log(`[ZeroHallucination] Processing ${mode} query for ${userRole}`);

      const request: ZeroHallucinationRequest = {
        query,
        mode: mode as ProfessionalMode,
        userRole,
        context,
        attachedDocuments,
      };

      const result = await zeroHallucinationService.processQuery(request);

      await auditAction('PROFESSIONAL_QUERY', userRole, 'professional', mode,
        { 
          success: result.success, 
          isRefused: result.response.isRefused,
          confidenceScore: result.response.confidenceScore,
          processingTimeMs: result.processingTimeMs,
        }, 
        result.success ? 'SUCCESS' : 'FAILED', req
      );

      res.json({
        success: result.success,
        response: result.response,
        cotSteps: result.cotSteps,
        processingTimeMs: result.processingTimeMs,
      });
    } catch (error) {
      console.error('[ZeroHallucination] Query error:', error);
      res.status(500).json({ error: "专业查询处理失败，请稍后重试" });
    }
  });

  app.post("/api/professional/confidence-check", requireAuth, async (req, res) => {
    try {
      const checkSchema = z.object({
        query: z.string().min(1),
        mode: z.enum(['LEGAL', 'FINANCE']),
      });
      
      const parseResult = checkSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { query, mode } = parseResult.data;
      const result = await zeroHallucinationService.quickConfidenceCheck(
        query, 
        mode as ProfessionalMode
      );

      res.json(result);
    } catch (error) {
      console.error('[ZeroHallucination] Confidence check error:', error);
      res.status(500).json({ error: "置信度检查失败" });
    }
  });

  app.get("/api/professional/config", requireAuth, async (req, res) => {
    try {
      res.json({
        confidenceThreshold: 0.90,
        supportedModes: ['LEGAL', 'FINANCE'],
        chainOfThoughtSteps: ['DATA_RETRIEVAL', 'CONFIDENCE_CHECK', 'SOURCE_CITATION'],
        description: '零幻觉回路 - 确保法务/财务人格绝对诚实',
      });
    } catch (error) {
      res.status(500).json({ error: "获取配置失败" });
    }
  });

  // ===== HP Economy System API =====
  
  const HP_COSTS: Record<string, number> = {
    INTEL_DEEP_SCAN: 100,
    AUTONOMOUS_EDIT: 50,
    DREAM_SIMULATION: 20,
    EXPERT_ANALYZE: 30,
    MULTI_EXPERT_ANALYZE: 80,
    BIO_EMERGENCY: 0,
    DEFAULT: 10,
  };

  const hpConsumeSchema = z.object({
    actionType: z.string().min(1),
    amount: z.number().optional(),
  });

  const hpRechargeSchema = z.object({
    amount: z.number().min(1).max(10000),
  });

  app.get("/api/hp/balance", requireAuth, async (req, res) => {
    try {
      const userId = 'master';
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          hpBalance: 1000,
          hpMaxBalance: 1000,
          hpTotalConsumed: 0,
          hpTotalRecharged: 0,
        });
      }
      
      res.json({
        balance: settings.hpBalance || 1000,
        maxBalance: settings.hpMaxBalance || 1000,
        totalConsumed: settings.hpTotalConsumed || 0,
        totalRecharged: settings.hpTotalRecharged || 0,
        lastRechargeAt: settings.hpLastRechargeAt,
      });
    } catch (error) {
      console.error('[HP] Balance fetch error:', error);
      res.status(500).json({ error: "获取HP余额失败" });
    }
  });

  app.post("/api/hp/consume", requireAuth, async (req, res) => {
    try {
      const parseResult = hpConsumeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { actionType, amount } = parseResult.data;
      const cost = amount ?? HP_COSTS[actionType] ?? HP_COSTS.DEFAULT;
      
      const userId = 'master';
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          hpBalance: 1000,
          hpMaxBalance: 1000,
          hpTotalConsumed: 0,
          hpTotalRecharged: 0,
        });
      }

      const currentBalance = settings.hpBalance || 1000;
      
      if (currentBalance < cost) {
        return res.status(400).json({ 
          success: false,
          error: "HP不足",
          balance: currentBalance,
          required: cost,
        });
      }

      const newBalance = currentBalance - cost;
      const newTotalConsumed = (settings.hpTotalConsumed || 0) + cost;
      
      await storage.updateUserSettings(userId, {
        hpBalance: newBalance,
        hpTotalConsumed: newTotalConsumed,
      });

      await auditAction('HP_CONSUME', req.userRole || 'MASTER', 'hp', actionType,
        { actionType, cost, newBalance }, 'SUCCESS', req
      );

      console.log(`[HP] Consumed ${cost} for ${actionType}, balance: ${newBalance}`);

      res.json({
        success: true,
        consumed: cost,
        balance: newBalance,
        actionType,
      });
    } catch (error) {
      console.error('[HP] Consume error:', error);
      res.status(500).json({ error: "HP消耗失败" });
    }
  });

  app.post("/api/hp/recharge", requireMaster, async (req, res) => {
    try {
      const parseResult = hpRechargeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { amount } = parseResult.data;
      const userId = 'master';
      
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          hpBalance: 1000,
          hpMaxBalance: 1000,
          hpTotalConsumed: 0,
          hpTotalRecharged: 0,
        });
      }

      const currentBalance = settings.hpBalance || 0;
      const maxBalance = settings.hpMaxBalance || 1000;
      const newBalance = Math.min(currentBalance + amount, maxBalance);
      const actualAdded = newBalance - currentBalance;
      const newTotalRecharged = (settings.hpTotalRecharged || 0) + actualAdded;

      await storage.updateUserSettings(userId, {
        hpBalance: newBalance,
        hpTotalRecharged: newTotalRecharged,
        hpLastRechargeAt: new Date(),
      });

      await auditAction('HP_RECHARGE', req.userRole || 'MASTER', 'hp', 'recharge',
        { amount, actualAdded, newBalance }, 'SUCCESS', req
      );

      console.log(`[HP] Recharged ${actualAdded}, balance: ${newBalance}`);

      res.json({
        success: true,
        recharged: actualAdded,
        balance: newBalance,
        maxBalance,
      });
    } catch (error) {
      console.error('[HP] Recharge error:', error);
      res.status(500).json({ error: "HP充值失败" });
    }
  });

  // ===== Evolution Center API =====
  
  app.get("/api/evolution-state", async (req, res) => {
    try {
      const state = await storage.getEvolutionState();
      if (!state) {
        return res.json({
          academicLadder: 'BACHELOR',
          academicProgress: 0,
          externalLlmRatio: 100,
          localModelRatio: 0,
          knowledgeDistilled: 0,
          totalDecisions: 0,
          dreamSimulations: 0,
          evolutionScore: 0,
        });
      }
      
      const totalCalls = (state.externalCallCount || 0) + (state.localCallCount || 0);
      const localRatio = totalCalls > 0 ? Math.round((state.localCallCount || 0) / totalCalls * 100) : 0;
      
      res.json({
        id: state.id,
        academicLadder: state.academicLevel || 'BACHELOR',
        academicProgress: state.nextLevelXp ? Math.round((state.academicXp || 0) / state.nextLevelXp * 100) : 0,
        academicXp: state.academicXp || 0,
        nextLevelXp: state.nextLevelXp || 1000,
        externalLlmRatio: 100 - localRatio,
        localModelRatio: localRatio,
        knowledgeDistilled: state.distilledKnowledgeSize || 0,
        totalDecisions: state.distillationCount || 0,
        dreamSimulations: state.totalDreamSessions || 0,
        totalInsights: state.totalInsightsDiscovered || 0,
        totalSkillCapsules: state.totalSkillCapsules || 0,
        activeSkillCapsules: state.activeSkillCapsules || 0,
        evolutionScore: Math.min(100, (state.academicXp || 0) / 10),
        updatedAt: state.updatedAt,
      });
    } catch (error) {
      console.error('[Evolution] Get state error:', error);
      res.status(500).json({ error: "获取进化状态失败" });
    }
  });

  app.get("/api/evolution", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getEvolutionEvents(limit);
      res.json(events);
    } catch (error) {
      console.error('[Evolution] Get events error:', error);
      res.status(500).json({ error: "获取进化事件失败" });
    }
  });

  app.get("/api/skill-capsules", async (req, res) => {
    try {
      const capsules = await storage.getSkillCapsules();
      res.json(capsules);
    } catch (error) {
      console.error('[Evolution] Get skill capsules error:', error);
      res.status(500).json({ error: "获取技能胶囊失败" });
    }
  });

  app.get("/api/shadow-memories", requireMaster, async (req, res) => {
    try {
      const memories = await storage.getAllMemories();
      const groupedByField: Record<string, { count: number; totalExp: number }> = {};
      
      memories.forEach(m => {
        const field = m.field || 'general';
        if (!groupedByField[field]) groupedByField[field] = { count: 0, totalExp: 0 };
        groupedByField[field].count++;
        groupedByField[field].totalExp += m.expPoints || 0;
      });
      
      const stats = {
        totalMemories: memories.length,
        totalExp: memories.reduce((sum, m) => sum + (m.expPoints || 0), 0),
        byField: Object.entries(groupedByField).map(([field, data]) => ({
          field,
          count: data.count,
          totalExp: data.totalExp,
        })),
      };
      
      res.json(stats);
    } catch (error) {
      console.error('[Evolution] Get shadow memories error:', error);
      res.status(500).json({ error: "获取影子记忆失败" });
    }
  });

  app.get("/api/evolution/growth-report", async (req, res) => {
    try {
      const state = await storage.getEvolutionState();
      const events = await storage.getEvolutionEvents(20);
      const capsules = await storage.getSkillCapsules();
      const memories = await storage.getAllMemories();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayEvents = events.filter(e => new Date(e.createdAt!) >= today);
      const activeCapsules = capsules.filter(c => c.isActive === 1);
      
      const newSkills = todayEvents
        .filter(e => e.eventType === 'SKILL_LEARNED' || e.eventType === 'KNOWLEDGE_GAINED')
        .map(e => e.deltaDescription);
      
      const fieldStats = memories.reduce((acc, m) => {
        const field = m.field || 'general';
        if (!acc[field]) acc[field] = { count: 0, exp: 0 };
        acc[field].count++;
        acc[field].exp += m.expPoints || 0;
        return acc;
      }, {} as Record<string, { count: number; exp: number }>);
      
      const topFields = Object.entries(fieldStats)
        .sort((a, b) => b[1].exp - a[1].exp)
        .slice(0, 5)
        .map(([field, stats]) => ({ field, ...stats }));
      
      res.json({
        currentLevel: state?.academicLevel || 'BACHELOR',
        totalXp: state?.academicXp || 0,
        nextLevelXp: state?.nextLevelXp || 1000,
        totalSkills: capsules.length,
        activeSkills: activeCapsules.length,
        totalMemories: memories.length,
        todayNewSkills: newSkills,
        todayEventsCount: todayEvents.length,
        topAbilities: topFields,
        milestones: [
          { name: '首次对话', achieved: memories.length > 0, icon: '💬' },
          { name: '学会10项技能', achieved: capsules.length >= 10, icon: '🎯' },
          { name: '积累100经验', achieved: (state?.academicXp || 0) >= 100, icon: '⭐' },
          { name: '完成首次梦境', achieved: (state?.totalDreamSessions || 0) > 0, icon: '🌙' },
          { name: '发现10条洞察', achieved: (state?.totalInsightsDiscovered || 0) >= 10, icon: '💡' },
          { name: '升级到硕士', achieved: state?.academicLevel !== 'BACHELOR', icon: '🎓' },
        ],
        recentGrowth: events.slice(0, 5).map(e => ({
          type: e.eventType,
          description: e.deltaDescription,
          module: e.sourceModule,
          time: e.createdAt,
        })),
      });
    } catch (error) {
      console.error('[Evolution] Growth report error:', error);
      res.status(500).json({ error: "生成成长报告失败" });
    }
  });

  // ===== Project Management Routes =====

  app.get("/api/projects", async (req, res) => {
    try {
      // Return all projects without status filter by default
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      // MASTER role creates projects as APPROVED directly, no review needed
      const status = req.userRole === 'MASTER' ? 'APPROVED' : 'PENDING_REVIEW';
      
      // Convert priority string to integer if needed
      const priorityMap: Record<string, number> = { CRITICAL: 1, HIGH: 3, MEDIUM: 5, LOW: 7 };
      const priorityValue = typeof req.body.priority === 'string' 
        ? (priorityMap[req.body.priority] || 5)
        : (req.body.priority || 5);
      
      const projectData = {
        ...req.body,
        status,
        priority: priorityValue,
      };
      const project = await storage.createProject(projectData);
      context.broadcastDataChange('projects', 'CREATE', { id: project.id, title: project.title });
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Failed to create project", details: error });
    }
  });

  app.patch("/api/projects/:id", requireMaster, async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      await auditAction('project_update', req.params.id, (req as any).masterSession || 'master', { status: project.status }, 'SUCCESS');
      context.broadcastDataChange('projects', 'UPDATE', { id: project.id, status: project.status });
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // ===== Project Notes Routes =====

  app.get("/api/projects/:id/notes", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const notes = await storage.getProjectNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/:id/notes", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const content = req.body.content?.trim();
      if (!content) {
        return res.status(400).json({ error: "Note content is required" });
      }
      
      const note = await storage.createProjectNote({
        projectId: req.params.id,
        content,
        noteType: req.body.noteType || 'GENERAL',
      });
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Failed to create project note" });
    }
  });

  app.delete("/api/projects/:id/notes/:noteId", requireMaster, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const notes = await storage.getProjectNotes(req.params.id);
      const noteExists = notes.some(n => n.id === req.params.noteId);
      if (!noteExists) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      await storage.deleteProjectNote(req.params.noteId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project note" });
    }
  });

  // ===== Project Files Routes =====

  app.get("/api/projects/:id/files", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const files = await storage.getProjectFiles(req.params.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const { fileName, fileType, fileContent } = req.body;
      if (!fileName || !fileContent) {
        return res.status(400).json({ error: "File name and content are required" });
      }
      
      const file = await storage.createProjectFile({
        projectId: req.params.id,
        fileName,
        fileType: fileType || 'OTHER',
        fileSize: fileContent.length,
        fileContent,
      });
      
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ error: "Failed to upload project file" });
    }
  });

  app.post("/api/projects/:id/files/:fileId/analyze", requireMaster, async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      const file = files.find(f => f.id === req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // AI analysis using DashScope
      const analysis = await analyzeFileWithAI(file.fileContent || '', file.fileName);
      
      const updated = await storage.updateProjectFile(req.params.fileId, { aiAnalysis: analysis });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze file" });
    }
  });

  app.delete("/api/projects/:id/files/:fileId", requireMaster, async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      const fileExists = files.some(f => f.id === req.params.fileId);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found" });
      }
      
      await storage.deleteProjectFile(req.params.fileId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project file" });
    }
  });

  // ===== Project Dashboard API =====

  app.get("/api/projects/dashboard/summary", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      
      // Status distribution
      const statusCounts: Record<string, number> = {};
      const priorityCounts: Record<string, number> = {};
      let totalProjects = projects.length;
      let overdueCount = 0;
      let recentlyUpdated = 0;
      
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      for (const p of projects) {
        // Status counts
        const status = p.status || 'PENDING';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // Priority counts  
        const priority = p.priority || 5;
        const priorityLabel = priority <= 2 ? 'CRITICAL' : priority <= 4 ? 'HIGH' : priority <= 6 ? 'MEDIUM' : 'LOW';
        priorityCounts[priorityLabel] = (priorityCounts[priorityLabel] || 0) + 1;
        
        // Recently updated (within 7 days)
        if (p.updatedAt && new Date(p.updatedAt) > weekAgo) {
          recentlyUpdated++;
        }
        
        // Stale projects: PENDING_REVIEW or APPROVED but not updated in 30+ days (potential risk indicator)
        if ((p.status === 'PENDING_REVIEW' || p.status === 'APPROVED') && 
            p.updatedAt && new Date(p.updatedAt) < monthAgo) {
          overdueCount++;
        }
      }
      
      // Pending review projects
      const pendingReview = projects.filter(p => p.status === 'PENDING_REVIEW');
      
      // In-progress projects
      const inProgress = projects.filter(p => p.status === 'APPROVED');
      
      // On-hold projects (potential risks)
      const onHold = projects.filter(p => p.status === 'ON_HOLD');
      
      res.json({
        totalProjects,
        statusCounts,
        priorityCounts,
        pendingReviewCount: pendingReview.length,
        inProgressCount: inProgress.length,
        onHoldCount: onHold.length,
        recentlyUpdated,
        overdueCount,
        pendingReviewProjects: pendingReview.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          category: p.category,
          priority: p.priority,
          createdAt: p.createdAt,
        })),
        inProgressProjects: inProgress.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          category: p.category,
          priority: p.priority,
          status: p.status,
        })),
        riskProjects: onHold.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          priority: p.priority,
        })),
      });
    } catch (error) {
      console.error('[Dashboard] Summary error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  app.get("/api/projects/dashboard/ai-insights", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      
      if (projects.length === 0) {
        const hasAiKey = !!process.env.DASHSCOPE_API_KEY;
        return res.json({
          insights: [],
          summary: "暂无项目数据，请先添加项目。",
          generatedAt: new Date().toISOString(),
          aiAvailable: hasAiKey,
          insightSource: hasAiKey ? 'ai' : 'heuristic',
        });
      }
      
      // Generate AI insights using DashScope
      const insights = await generateProjectInsights(projects);
      
      const hasAiKey = !!process.env.DASHSCOPE_API_KEY;
      res.json({
        insights,
        summary: insights.length > 0 ? insights[0].content : "项目运行正常",
        generatedAt: new Date().toISOString(),
        aiAvailable: hasAiKey,
        insightSource: hasAiKey ? 'ai' : 'heuristic',
      });
    } catch (error) {
      console.error('[Dashboard] AI insights error:', error);
      res.status(500).json({ error: "Failed to generate AI insights" });
    }
  });

  // Risk alerts API - proactive risk monitoring
  app.get("/api/projects/dashboard/risk-alerts", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const alerts: Array<{
        id: string;
        type: 'critical' | 'warning' | 'info';
        title: string;
        description: string;
        projectId?: string;
        projectTitle?: string;
        action?: string;
        createdAt: string;
      }> = [];
      
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      for (const p of projects) {
        // Critical: High priority projects that are stale
        if ((p.priority || 5) <= 2 && p.updatedAt && new Date(p.updatedAt) < weekAgo) {
          alerts.push({
            id: `stale-urgent-${p.id}`,
            type: 'critical',
            title: '紧急项目停滞',
            description: `紧急项目"${p.title}"超过7天未更新，需要立即关注`,
            projectId: p.id,
            projectTitle: p.title,
            action: '查看项目',
            createdAt: now.toISOString(),
          });
        }
        
        // Warning: ON_HOLD projects for too long
        if (p.status === 'ON_HOLD' && p.updatedAt && new Date(p.updatedAt) < twoWeeksAgo) {
          alerts.push({
            id: `long-hold-${p.id}`,
            type: 'warning',
            title: '长期暂缓项目',
            description: `"${p.title}"已暂缓超过2周，建议评估是否继续或废除`,
            projectId: p.id,
            projectTitle: p.title,
            action: '重新评估',
            createdAt: now.toISOString(),
          });
        }
        
        // Warning: PENDING_REVIEW for too long
        if (p.status === 'PENDING_REVIEW' && p.createdAt && new Date(p.createdAt) < weekAgo) {
          alerts.push({
            id: `pending-long-${p.id}`,
            type: 'warning',
            title: '审批等待过久',
            description: `"${p.title}"已等待审批超过7天`,
            projectId: p.id,
            projectTitle: p.title,
            action: '立即审批',
            createdAt: now.toISOString(),
          });
        }
        
        // Warning: Missing conditions for approved projects
        if (p.status === 'APPROVED' && p.missingConditions && p.missingConditions.length >= 3) {
          alerts.push({
            id: `missing-conditions-${p.id}`,
            type: 'warning',
            title: '项目条件不足',
            description: `已立项项目"${p.title}"仍有${p.missingConditions.length}个欠缺条件未解决`,
            projectId: p.id,
            projectTitle: p.title,
            action: '补齐条件',
            createdAt: now.toISOString(),
          });
        }
        
        // Info: Projects without SWOT analysis
        const hasSwot = p.swotAnalysis && (
          (p.swotAnalysis as any).strengths?.length > 0 ||
          (p.swotAnalysis as any).weaknesses?.length > 0
        );
        if (p.status === 'APPROVED' && !hasSwot) {
          alerts.push({
            id: `no-swot-${p.id}`,
            type: 'info',
            title: '缺少SWOT分析',
            description: `"${p.title}"尚未进行SWOT分析，建议使用AI生成`,
            projectId: p.id,
            projectTitle: p.title,
            action: '生成分析',
            createdAt: now.toISOString(),
          });
        }
      }
      
      // Sort by type priority: critical > warning > info
      const typePriority = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => typePriority[a.type] - typePriority[b.type]);
      
      res.json({
        alerts: alerts.slice(0, 20), // Limit to 20 alerts
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.type === 'critical').length,
        warningCount: alerts.filter(a => a.type === 'warning').length,
        infoCount: alerts.filter(a => a.type === 'info').length,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error('[Dashboard] Risk alerts error:', error);
      res.status(500).json({ error: "Failed to fetch risk alerts" });
    }
  });

  // AI-powered SWOT generation for a specific project
  app.post("/api/projects/:id/generate-swot", requireAuth, async (req, res) => {
    try {
      const projectId = req.params.id;
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "AI功能未配置",
          message: "缺少DASHSCOPE_API_KEY，无法使用AI生成SWOT分析"
        });
      }
      
      // Get project files for additional context
      const files = await storage.getProjectFiles(projectId);
      const fileContext = files.map(f => `- ${f.fileName}: ${f.aiAnalysis || '无分析'}`).join('\n');
      
      const prompt = `请为以下项目生成详细的SWOT分析：

项目名称：${project.title}
项目描述：${project.description || '无描述'}
项目类别：${project.category}
当前状态：${project.status}
优先级：${project.priority}/10

已具备条件：
${project.currentConditions?.join('\n') || '无'}

欠缺条件：
${project.missingConditions?.join('\n') || '无'}

${files.length > 0 ? `相关文件分析：\n${fileContext}` : ''}

请按照以下JSON格式返回SWOT分析结果，每项至少3条具体分析：
{
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["劣势1", "劣势2", "劣势3"],
  "opportunities": ["机会1", "机会2", "机会3"],
  "threats": ["威胁1", "威胁2", "威胁3"]
}

只返回JSON，不要其他文字。`;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            { role: 'system', content: '你是一个专业的项目管理和战略分析专家。请根据项目信息提供准确、专业的SWOT分析。返回纯JSON格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
        }),
      });
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response
      let swotAnalysis;
      try {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          swotAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        console.error('[SWOT] Failed to parse AI response:', content);
        return res.status(500).json({ 
          error: "AI响应解析失败",
          message: "无法解析AI生成的SWOT分析结果"
        });
      }
      
      // Validate SWOT structure
      const validSwot = {
        strengths: Array.isArray(swotAnalysis.strengths) ? swotAnalysis.strengths : [],
        weaknesses: Array.isArray(swotAnalysis.weaknesses) ? swotAnalysis.weaknesses : [],
        opportunities: Array.isArray(swotAnalysis.opportunities) ? swotAnalysis.opportunities : [],
        threats: Array.isArray(swotAnalysis.threats) ? swotAnalysis.threats : [],
      };
      
      // Update project with new SWOT analysis
      const updatedProject = await storage.updateProject(projectId, {
        swotAnalysis: validSwot
      });
      
      res.json({
        success: true,
        swotAnalysis: validSwot,
        project: updatedProject,
      });
    } catch (error) {
      console.error('[SWOT] Generation error:', error);
      res.status(500).json({ error: "Failed to generate SWOT analysis" });
    }
  });

  // ===== Smart Project Creation API =====
  
  const smartCreateSchema = z.object({
    input: z.string(),
    files: z.array(z.object({
      name: z.string(),
      content: z.string(),
      type: z.string(),
    })).optional(),
    previousProject: z.any().optional(),
    feedback: z.string().optional(),
  });

  app.post("/api/projects/smart-create", requireMaster, async (req, res) => {
    try {
      const parsed = smartCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败" });
      }
      
      const { input, files, previousProject, feedback } = parsed.data;
      
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "AI功能未配置",
          message: "缺少DASHSCOPE_API_KEY，无法使用AI推理"
        });
      }
      
      const fileContext = files && files.length > 0
        ? `\n\n用户上传的资料：\n${files.map(f => `【${f.name}】\n${f.content.substring(0, 3000)}`).join('\n\n')}`
        : '';
      
      const previousContext = previousProject
        ? `\n\n之前生成的项目方案：\n${JSON.stringify(previousProject, null, 2)}\n\n用户反馈：${feedback || '请优化'}`
        : '';
      
      const prompt = `你是一个专业的项目规划师。请根据用户的想法和资料，生成一个完整的项目方案。

用户输入：${input || '请根据资料分析'}
${fileContext}
${previousContext}

请按照以下JSON格式返回项目方案，确保每个字段都有实质内容：
{
  "title": "项目名称（简洁明确）",
  "description": "项目描述（100-200字，概述项目背景、目标、价值）",
  "category": "分类（BUSINESS/TECHNOLOGY/RESEARCH/PERSONAL之一）",
  "priority": 优先级数字（1-10，1最紧急）,
  "objectives": ["目标1", "目标2", "目标3"],
  "currentConditions": ["已具备的条件1", "已具备的条件2"],
  "missingConditions": ["缺失的条件1", "缺失的条件2"],
  "swotAnalysis": {
    "strengths": ["优势1", "优势2"],
    "weaknesses": ["劣势1", "劣势2"],
    "opportunities": ["机会1", "机会2"],
    "threats": ["威胁1", "威胁2"]
  },
  "aiReasoning": "你的推理过程简述（为什么这样规划）"
}

只返回JSON，不要其他文字。`;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: '你是一个专业的项目规划师和战略分析专家。请根据用户需求生成完整的项目方案。返回纯JSON格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 3000,
        }),
      });
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      
      let project;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          project = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        console.error('[SmartCreate] Failed to parse AI response:', content);
        return res.status(500).json({ 
          error: "AI响应解析失败",
          message: "无法解析AI生成的项目方案，请重试"
        });
      }
      
      const validProject = {
        title: project.title || '新项目',
        description: project.description || '',
        category: ['BUSINESS', 'TECHNOLOGY', 'RESEARCH', 'PERSONAL'].includes(project.category) 
          ? project.category : 'BUSINESS',
        priority: typeof project.priority === 'number' ? Math.min(10, Math.max(1, project.priority)) : 5,
        objectives: Array.isArray(project.objectives) ? project.objectives : [],
        currentConditions: Array.isArray(project.currentConditions) ? project.currentConditions : [],
        missingConditions: Array.isArray(project.missingConditions) ? project.missingConditions : [],
        swotAnalysis: project.swotAnalysis || null,
        aiReasoning: project.aiReasoning || '',
      };
      
      // 自动保存项目到数据库
      const savedProject = await storage.createProject({
        title: validProject.title,
        description: validProject.description,
        category: validProject.category,
        priority: validProject.priority,
        currentConditions: validProject.currentConditions,
        missingConditions: validProject.missingConditions,
        swotAnalysis: validProject.swotAnalysis,
      });
      
      console.log('[SmartCreate] Project saved:', savedProject.id, savedProject.title);
      
      res.json({
        success: true,
        project: validProject,
        savedProject: savedProject,
        message: '项目已自动创建并保存到数据库',
      });
    } catch (error) {
      console.error('[SmartCreate] Error:', error);
      res.status(500).json({ error: "智能创建失败" });
    }
  });

  // ===== Multi-Format File Parse API =====
  
  const fileParseSchema = z.object({
    fileName: z.string(),
    base64Data: z.string(),
    mimeType: z.string().optional(),
  });

  app.post("/api/files/parse", requireMaster, async (req, res) => {
    try {
      const parsed = fileParseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败" });
      }

      const { fileName, base64Data, mimeType } = parsed.data;
      const { fileIndexer } = await import('../services/omni-archive/file-indexer');
      
      const result = await fileIndexer.parseMultiFormat(fileName, base64Data, mimeType || '');
      
      const hasError = result.metadata?.error || result.metadata?.unsupported;
      const isEmpty = !result.text && result.type !== 'archive';
      
      if (hasError) {
        return res.status(422).json({
          success: false,
          fileName,
          parsedType: result.type,
          error: result.metadata?.error || 'parse_failed',
          message: result.metadata?.message || '文件解析失败',
          metadata: result.metadata,
        });
      }
      
      if (isEmpty && result.type === 'audio') {
        return res.status(422).json({
          success: false,
          fileName,
          parsedType: result.type,
          error: 'requires_realtime_asr',
          message: result.metadata?.message || '音频文件需要通过实时语音识别处理',
          metadata: result.metadata,
        });
      }
      
      res.json({
        success: true,
        fileName,
        parsedType: result.type,
        text: result.text,
        metadata: result.metadata,
        subFiles: result.subFiles?.map(f => ({
          type: f.type,
          textLength: f.text.length,
          metadata: f.metadata,
        })),
      });
    } catch (error) {
      console.error('[FileParse] Error:', error);
      res.status(500).json({ error: "文件解析失败" });
    }
  });

  app.post("/api/files/parse-batch", requireMaster, async (req, res) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: "files参数必须是数组" });
      }

      const { fileIndexer } = await import('../services/omni-archive/file-indexer');
      const results = [];
      
      for (const file of files) {
        try {
          const result = await fileIndexer.parseMultiFormat(
            file.fileName || file.name,
            file.base64Data || file.content,
            file.mimeType || file.type || ''
          );
          results.push({
            fileName: file.fileName || file.name,
            success: true,
            parsedType: result.type,
            text: result.text.substring(0, 5000),
            metadata: result.metadata,
          });
        } catch (e) {
          results.push({
            fileName: file.fileName || file.name,
            success: false,
            error: '解析失败',
          });
        }
      }

      res.json({
        success: true,
        totalFiles: files.length,
        parsed: results.filter(r => r.success).length,
        results,
      });
    } catch (error) {
      console.error('[FileParseBatch] Error:', error);
      res.status(500).json({ error: "批量文件解析失败" });
    }
  });

  // ===== Entity Extraction API (智能资料收集器) =====
  
  const extractEntitiesSchema = z.object({
    text: z.string().min(1, "文本不能为空"),
    autoHarvest: z.boolean().default(false),
    minConfidence: z.number().min(0).max(1).default(0.5),
    source: z.string().optional(),
  });

  app.post("/api/entities/extract", requireMaster, async (req, res) => {
    try {
      const parsed = extractEntitiesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败", details: parsed.error.errors });
      }

      const { text, autoHarvest, minConfidence, source } = parsed.data;
      const { entityExtractor } = await import('../services/entity-extractor');
      
      if (autoHarvest) {
        const result = await entityExtractor.extractAndHarvest(text, {
          autoConfirm: false,
          source: source || 'CONVERSATION',
          minConfidence,
        });
        
        res.json({
          success: true,
          extraction: {
            persons: result.extraction.persons,
            projects: result.extraction.projects,
            companies: result.extraction.companies,
            contactInfos: result.extraction.contactInfos,
          },
          harvest: result.harvest,
        });
      } else {
        const extraction = await entityExtractor.extractFromText(text);
        
        res.json({
          success: true,
          extraction: {
            persons: extraction.persons,
            projects: extraction.projects,
            companies: extraction.companies,
            contactInfos: extraction.contactInfos,
          },
        });
      }
    } catch (error) {
      console.error('[EntityExtract] Error:', error);
      res.status(500).json({ error: "实体提取失败" });
    }
  });

  app.post("/api/entities/harvest", requireMaster, async (req, res) => {
    try {
      const { persons: extractedPersons, autoConfirm, source } = req.body;
      
      if (!Array.isArray(extractedPersons)) {
        return res.status(400).json({ error: "persons参数必须是数组" });
      }

      const { entityExtractor } = await import('../services/entity-extractor');
      
      const result = await entityExtractor.createPersonsFromExtraction(
        { persons: extractedPersons, projects: [], companies: [], contactInfos: [], rawEntities: [] },
        { autoConfirm: autoConfirm || false, source: source || 'MANUAL_HARVEST' }
      );
      
      res.json({
        success: true,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        persons: result.persons,
      });
    } catch (error) {
      console.error('[EntityHarvest] Error:', error);
      res.status(500).json({ error: "联系人收割失败" });
    }
  });

  // ===== Project Templates API =====

  app.get("/api/project-templates", async (req, res) => {
    try {
      const { category } = req.query;
      const templates = await storage.getProjectTemplates(category as string | undefined);
      res.json(templates);
    } catch (error) {
      console.error('[Templates] Error:', error);
      res.status(500).json({ error: "获取模板列表失败" });
    }
  });

  app.get("/api/project-templates/:id", async (req, res) => {
    try {
      const template = await storage.getProjectTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "模板不存在" });
      }
      res.json(template);
    } catch (error) {
      console.error('[Templates] Error:', error);
      res.status(500).json({ error: "获取模板失败" });
    }
  });

  const createTemplateSchema = z.object({
    name: z.string().min(1, "模板名称不能为空"),
    description: z.string().optional(),
    category: z.enum(['SOP', 'PROPOSAL', 'FEASIBILITY', 'PROJECT_INIT']).default('SOP'),
    templateData: z.record(z.any()),
    isPublic: z.boolean().default(true),
  });

  app.post("/api/project-templates", requireMaster, async (req, res) => {
    try {
      const parsed = createTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "参数验证失败", 
          details: parsed.error.errors 
        });
      }
      const template = await storage.createProjectTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      console.error('[Templates] Error:', error);
      res.status(500).json({ error: "创建模板失败" });
    }
  });

  const createFromTemplateSchema = z.object({
    title: z.string().optional(),
    customData: z.object({
      description: z.string().optional(),
      category: z.string().optional(),
      leaderId: z.string().optional(),
      responsiblePersonId: z.string().optional(),
      relatedPersonIds: z.array(z.string()).optional(),
      executorIds: z.array(z.string()).optional(),
    }).optional(),
  });

  app.post("/api/projects/from-template/:templateId", requireAuth, async (req, res) => {
    try {
      const { templateId } = req.params;
      const parsed = createFromTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "参数验证失败", 
          details: parsed.error.errors 
        });
      }
      
      const { title, customData } = parsed.data;
      
      const template = await storage.getProjectTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "模板不存在" });
      }
      
      const templateData = template.templateData as any;
      
      const projectData = {
        title: title || templateData.defaultTitle || template.name,
        description: customData?.description || templateData.defaultDescription || template.description,
        category: customData?.category || templateData.category || 'BUSINESS',
        status: 'PENDING_REVIEW' as const,
        priority: templateData.defaultPriority || 5,
        currentConditions: templateData.defaultConditions || [],
        missingConditions: templateData.requiredConditions || [],
        leaderId: customData?.leaderId,
        responsiblePersonId: customData?.responsiblePersonId,
        relatedPersonIds: customData?.relatedPersonIds,
        executorIds: customData?.executorIds,
      };
      
      const project = await storage.createProject(projectData);
      await storage.incrementTemplateUsage(templateId);
      
      res.status(201).json({
        success: true,
        project,
        templateUsed: template.name,
      });
    } catch (error) {
      console.error('[Templates] Error:', error);
      res.status(500).json({ error: "从模板创建项目失败" });
    }
  });

  // === Phase 2.1: 项目生命周期引擎 API ===

  const decomposeSchema = z.object({
    description: z.string().min(10, "项目描述至少10个字符"),
    category: z.enum(['SOFTWARE', 'BUSINESS']).optional(),
  });

  app.post("/api/projects/decompose", requireAuth, async (req, res) => {
    try {
      const parsed = decomposeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败", details: parsed.error.errors });
      }
      const decomposition = await projectEngineService.decomposeProject(
        parsed.data.description,
        parsed.data.category
      );
      res.json({ success: true, decomposition });
    } catch (error) {
      console.error('[ProjectEngine] Decompose error:', error);
      res.status(500).json({ error: "项目拆解失败" });
    }
  });

  app.post("/api/projects/create-from-decomposition", requireMaster, async (req, res) => {
    try {
      const { decomposition } = req.body;
      if (!decomposition) {
        return res.status(400).json({ error: "缺少项目拆解数据" });
      }
      const project = await projectEngineService.createProjectFromDecomposition(decomposition);
      res.status(201).json({ success: true, project });
    } catch (error) {
      console.error('[ProjectEngine] Create error:', error);
      res.status(500).json({ error: "创建项目失败" });
    }
  });

  app.get("/api/projects/:id/progress", requireAuth, async (req, res) => {
    try {
      const progress = await projectEngineService.getProjectProgress(req.params.id);
      res.json(progress);
    } catch (error) {
      console.error('[ProjectEngine] Progress error:', error);
      res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.get("/api/projects/:id/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await projectEngineService.getProgressAlerts(req.params.id);
      res.json({ alerts });
    } catch (error) {
      console.error('[ProjectEngine] Alerts error:', error);
      res.status(500).json({ error: "获取预警失败" });
    }
  });

  app.get("/api/projects/:id/milestones", requireAuth, async (req, res) => {
    try {
      const milestones = await projectEngineService.getMilestones(req.params.id);
      res.json({ milestones });
    } catch (error) {
      console.error('[ProjectEngine] Milestones error:', error);
      res.status(500).json({ error: "获取里程碑失败" });
    }
  });

  app.get("/api/projects/:id/tasks", requireAuth, async (req, res) => {
    try {
      const milestoneId = req.query.milestoneId as string | undefined;
      const tasks = await projectEngineService.getTasks(req.params.id, milestoneId);
      res.json({ tasks });
    } catch (error) {
      console.error('[ProjectEngine] Tasks error:', error);
      res.status(500).json({ error: "获取任务失败" });
    }
  });

  app.patch("/api/projects/:id/tasks/:taskId/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "缺少状态参数" });
      }
      const task = await projectEngineService.updateTaskStatus(req.params.taskId, status);
      if (!task) {
        return res.status(404).json({ error: "任务不存在" });
      }
      res.json({ success: true, task });
    } catch (error) {
      console.error('[ProjectEngine] Update task error:', error);
      res.status(500).json({ error: "更新任务失败" });
    }
  });

  app.get("/api/projects/:id/risks", requireAuth, async (req, res) => {
    try {
      const risks = await projectEngineService.getRisks(req.params.id);
      res.json({ risks });
    } catch (error) {
      console.error('[ProjectEngine] Risks error:', error);
      res.status(500).json({ error: "获取风险失败" });
    }
  });

  app.post("/api/projects/:id/risks", requireMaster, async (req, res) => {
    try {
      const risk = await projectEngineService.addRisk(req.params.id, req.body);
      res.status(201).json({ success: true, risk });
    } catch (error) {
      console.error('[ProjectEngine] Add risk error:', error);
      res.status(500).json({ error: "添加风险失败" });
    }
  });

  app.patch("/api/projects/:id/risks/:riskId/resolve", requireMaster, async (req, res) => {
    try {
      const { resolutionNotes } = req.body;
      const risk = await projectEngineService.resolveRisk(req.params.riskId, resolutionNotes || '');
      if (!risk) {
        return res.status(404).json({ error: "风险项不存在" });
      }
      res.json({ success: true, risk });
    } catch (error) {
      console.error('[ProjectEngine] Resolve risk error:', error);
      res.status(500).json({ error: "解决风险失败" });
    }
  });

  app.get("/api/projects/:id/logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await projectEngineService.getProjectLogs(req.params.id, limit);
      res.json({ logs });
    } catch (error) {
      console.error('[ProjectEngine] Logs error:', error);
      res.status(500).json({ error: "获取日志失败" });
    }
  });
}

async function analyzeFileWithAI(content: string, fileName: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return "AI分析功能未配置（缺少DASHSCOPE_API_KEY）";
  }
  
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: '你是一个专业的文档分析助手。请分析以下文档内容，提取关键信息，识别风险点和机会点，并给出建议。回复使用中文。' },
          { role: 'user', content: `文件名: ${fileName}\n\n内容:\n${content.substring(0, 8000)}` }
        ],
        max_tokens: 2000,
      }),
    });
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '分析失败';
  } catch (error) {
    console.error('[AI Analysis] Error:', error);
    return '分析过程中出现错误';
  }
}

interface ProjectInsight {
  type: 'warning' | 'opportunity' | 'info' | 'action';
  title: string;
  content: string;
  projectId?: string;
  priority: 'high' | 'medium' | 'low';
}

async function generateProjectInsights(projects: any[]): Promise<ProjectInsight[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  // Generate basic insights without AI if no API key
  const insights: ProjectInsight[] = [];
  
  // Check for pending review projects
  const pendingReview = projects.filter(p => p.status === 'PENDING_REVIEW');
  if (pendingReview.length > 0) {
    insights.push({
      type: 'action',
      title: `${pendingReview.length}个项目待审批`,
      content: `有${pendingReview.length}个项目等待您的审批决策，请尽快处理以免延误进度。`,
      priority: 'high',
    });
  }
  
  // Check for on-hold projects
  const onHold = projects.filter(p => p.status === 'ON_HOLD');
  if (onHold.length > 0) {
    insights.push({
      type: 'warning',
      title: `${onHold.length}个项目处于暂缓状态`,
      content: `暂缓项目可能存在阻碍因素，建议检查并制定恢复计划。`,
      priority: 'medium',
    });
  }
  
  // Check for high priority projects
  const criticalProjects = projects.filter(p => (p.priority || 5) <= 2);
  if (criticalProjects.length > 0) {
    insights.push({
      type: 'info',
      title: `${criticalProjects.length}个紧急优先级项目`,
      content: `当前有${criticalProjects.length}个紧急项目需要重点关注。`,
      priority: 'high',
    });
  }
  
  // If we have API key, try to generate AI-powered insights
  if (apiKey && projects.length > 0) {
    try {
      const projectSummary = projects.slice(0, 10).map(p => 
        `- ${p.title} (状态: ${p.status}, 优先级: ${p.priority || 5})`
      ).join('\n');
      
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            { 
              role: 'system', 
              content: '你是一个项目管理AI助手。根据项目列表，提供1-2条简短的战略洞察和建议。每条建议不超过50字。直接给出建议，不要使用编号或前缀。用JSON数组格式返回，每个对象包含title和content字段。' 
            },
            { role: 'user', content: `当前项目列表:\n${projectSummary}` }
          ],
          max_tokens: 500,
        }),
      });
      
      const data = await response.json() as any;
      const aiContent = data.choices?.[0]?.message?.content;
      
      if (aiContent) {
        try {
          const parsed = JSON.parse(aiContent);
          if (Array.isArray(parsed)) {
            for (const item of parsed.slice(0, 2)) {
              insights.push({
                type: 'opportunity',
                title: item.title || '战略建议',
                content: item.content || item.title,
                priority: 'medium',
              });
            }
          }
        } catch {
          // If JSON parse fails, add as single insight
          insights.push({
            type: 'opportunity',
            title: 'AI战略洞察',
            content: aiContent.substring(0, 200),
            priority: 'medium',
          });
        }
      }
    } catch (error) {
      console.error('[AI Insights] Error:', error);
    }
  }
  
  // Default insight if none generated
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: '项目状态正常',
      content: '当前所有项目运行正常，暂无需要特别关注的事项。',
      priority: 'low',
    });
  }
  
  return insights;
}

async function simulateInsightsProcessing(recordId: string, sessionId: string, storage: IStorage) {
  const stages = [
    { status: "TRANSCRIBING", percentComplete: 10, stage: "transcription", stageProgress: 100, etaSeconds: 25 },
    { status: "ANALYZING", percentComplete: 30, stage: "entity_extraction", stageProgress: 50, etaSeconds: 20 },
    { status: "ANALYZING", percentComplete: 50, stage: "entity_extraction", stageProgress: 100, etaSeconds: 15 },
    { status: "ANALYZING", percentComplete: 70, stage: "opportunity_detection", stageProgress: 100, etaSeconds: 10 },
    { status: "SUMMARIZING", percentComplete: 85, stage: "summary", stageProgress: 50, etaSeconds: 5 },
    { status: "COMPLETE", percentComplete: 100, stage: "summary", stageProgress: 100, etaSeconds: 0 },
  ];
  
  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await storage.updateInsightsProcessing(recordId, {
      ...stage,
      completedAt: stage.status === 'COMPLETE' ? new Date() : undefined,
    } as any);
  }
}
