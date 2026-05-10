import type { Express, Request, Response } from "express";
import { WebSocket } from "ws";
import type { IStorage } from "../storage";
import type { RouteContext, RegisterRouteFn } from "./types";
import { requireMaster, auditAction } from "../middleware/auth";
import {
  mapIntentToCoordinate,
  generateADBCommand,
  getAvailableIntents,
  getAllMappings,
  addCustomMapping,
  batchMapIntents,
  generateAutomationSequence,
  type DeviceProfile,
  type AutomationScript,
} from "../services/intent-mapper";
import {
  updateScreenContent,
  getScreenState,
  forceAnalyze,
  deepAnalyze,
  getMonitorStats,
  updateMonitorConfig,
  getMonitorConfig,
  clearSession,
  addAnalysisListener,
  startVisionSniffing,
  stopVisionSniffing,
  getVisionSniffingStatus,
  getVisionSniffingStats,
  addAlertCallback,
  checkAndAlert,
} from "../services/screen-monitor";
import { chatWithDashScope, executeAvatarCommand } from "../services/dashscope";
import { recordConversation } from "../services/avatar-powers";

export const registerScreenRoutes: RegisterRouteFn = (
  app: Express,
  storage: IStorage,
  context: RouteContext
) => {
  const { z3Clients, chatHistories } = context;

  // ===== Z5: Intent-to-Coordinate Mapping (意图坐标映射) =====
  
  app.post("/api/intent/map", async (req, res) => {
    try {
      const { text, app: appName, device, useAbsoluteCoords = true } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "缺少必需的 text 参数" });
      }
      
      const result = mapIntentToCoordinate(text, {
        app: appName,
        device: device as DeviceProfile,
        useAbsoluteCoords,
      });
      
      const adbCommand = generateADBCommand(result);
      
      res.json({
        ...result,
        adbCommand,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Intent Mapper] Error:', error);
      res.status(500).json({ error: "意图映射失败" });
    }
  });

  app.post("/api/intent/batch", async (req, res) => {
    try {
      const { texts, app: appName, device, useAbsoluteCoords = true } = req.body;
      
      if (!texts || !Array.isArray(texts)) {
        return res.status(400).json({ error: "缺少必需的 texts 数组参数" });
      }
      
      const results = batchMapIntents(texts, {
        app: appName,
        device: device as DeviceProfile,
        useAbsoluteCoords,
      });
      
      const enrichedResults = results.map(result => ({
        ...result,
        adbCommand: generateADBCommand(result),
      }));
      
      res.json({
        results: enrichedResults,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Intent Mapper] Batch error:', error);
      res.status(500).json({ error: "批量意图映射失败" });
    }
  });

  app.post("/api/intent/sequence", async (req, res) => {
    try {
      const { script, app: appName, device } = req.body;
      
      if (!script || !script.name || !script.steps) {
        return res.status(400).json({ error: "缺少必需的 script 参数（需包含 name 和 steps）" });
      }
      
      const sequence = generateAutomationSequence(script as AutomationScript, {
        app: appName,
        device: device as DeviceProfile,
      });
      
      res.json({
        scriptName: script.name,
        totalSteps: sequence.length,
        sequence,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Intent Mapper] Sequence error:', error);
      res.status(500).json({ error: "自动化序列生成失败" });
    }
  });

  app.get("/api/intent/intents", async (req, res) => {
    try {
      const appName = req.query.app as string | undefined;
      const intents = getAvailableIntents(appName);
      res.json({ app: appName || 'general', intents, count: intents.length });
    } catch (error) {
      res.status(500).json({ error: "获取可用意图列表失败" });
    }
  });

  app.get("/api/intent/mappings", async (req, res) => {
    try {
      const appName = req.query.app as string | undefined;
      const mappings = getAllMappings(appName);
      res.json({ app: appName || 'general', mappings, count: mappings.length });
    } catch (error) {
      res.status(500).json({ error: "获取映射规则失败" });
    }
  });

  app.post("/api/intent/custom", requireMaster, async (req, res) => {
    try {
      const { app: appName, mapping } = req.body;
      
      if (!appName || !mapping || !mapping.intent || !mapping.keywords || !mapping.coordinate) {
        return res.status(400).json({ error: "缺少必需参数：app, mapping.intent, mapping.keywords, mapping.coordinate" });
      }
      
      addCustomMapping(appName, mapping);
      
      await auditAction('CUSTOM_MAPPING_ADDED', req.userRole || 'MASTER', 'intent_mapping', mapping.intent, { app: appName, mapping }, 'SUCCESS', req);
      
      res.status(201).json({
        success: true,
        message: `自定义映射「${mapping.intent}」已添加到 ${appName}`,
        mapping,
      });
    } catch (error) {
      res.status(500).json({ error: "添加自定义映射失败" });
    }
  });

  app.post("/api/avatar/chat-with-action", async (req, res) => {
    try {
      const { message, sessionId = 'default', app: appName, device } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      let history = chatHistories.get(sessionId) || [];
      
      const command = await chatWithDashScope(history, message, storage);
      const result = await executeAvatarCommand(command, storage);
      
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.message });
      recordConversation(message, result.message);
      
      if (history.length > 20) {
        history = history.slice(-20);
      }
      chatHistories.set(sessionId, history);
      
      const intentResult = mapIntentToCoordinate(message, {
        app: appName,
        device: device as DeviceProfile,
        useAbsoluteCoords: true,
      });
      
      const adbCommand = generateADBCommand(intentResult);
      
      res.json({
        chat: {
          success: result.success,
          message: result.message,
          command: { action: command.action, entity: command.entity },
          data: result.data,
        },
        action: intentResult.success ? {
          intent: intentResult.intent,
          coordinate: intentResult.coordinate,
          confidence: intentResult.confidence,
          description: intentResult.description,
          adbCommand,
        } : null,
        hasActionableIntent: intentResult.success,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Avatar] Chat with action error:', error);
      res.status(500).json({ success: false, message: "处理请求时出错" });
    }
  });

  // ===== Z5: Screen Monitor (屏幕监控服务) =====
  
  app.post("/api/screen/update", async (req, res) => {
    try {
      const { sessionId = 'default', content, source = 'manual', appContext } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "缺少屏幕内容 (content)" });
      }
      
      const result = await updateScreenContent(sessionId, {
        content,
        source,
        appContext,
        timestamp: Date.now(),
      });
      
      res.json({
        sessionId,
        changed: result.changed,
        analysis: result.analysis,
        message: result.changed 
          ? (result.analysis?.summary || '屏幕内容已更新')
          : '屏幕内容无变化',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Screen Monitor] Update error:', error);
      res.status(500).json({ error: "屏幕内容更新失败" });
    }
  });

  app.get("/api/screen/state/:sessionId", async (req, res) => {
    try {
      const state = getScreenState(req.params.sessionId);
      if (!state) {
        return res.status(404).json({ error: "会话不存在", sessionId: req.params.sessionId });
      }
      
      res.json({
        sessionId: req.params.sessionId,
        hasContent: !!state.lastContent,
        contentLength: state.lastContent?.length || 0,
        lastUpdateTime: state.lastUpdateTime,
        changeCount: state.changeCount,
        lastAnalysis: state.lastAnalysis,
        analysisInProgress: state.analysisInProgress,
      });
    } catch (error) {
      res.status(500).json({ error: "获取屏幕状态失败" });
    }
  });

  app.post("/api/screen/analyze/:sessionId", async (req, res) => {
    try {
      const analysis = await forceAnalyze(req.params.sessionId);
      
      if (!analysis) {
        return res.status(404).json({ 
          error: "无法分析：会话不存在或没有屏幕内容",
          sessionId: req.params.sessionId 
        });
      }
      
      res.json({
        sessionId: req.params.sessionId,
        analysis,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Screen Monitor] Analyze error:', error);
      res.status(500).json({ error: "屏幕分析失败" });
    }
  });

  app.post("/api/screen/deep-analyze/:sessionId", async (req, res) => {
    try {
      const result = await deepAnalyze(req.params.sessionId);
      
      res.json({
        sessionId: req.params.sessionId,
        message: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Screen Monitor] Deep analyze error:', error);
      res.status(500).json({ error: "AI深度分析失败" });
    }
  });

  app.get("/api/screen/stats", async (req, res) => {
    try {
      const stats = getMonitorStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取监控统计失败" });
    }
  });

  app.get("/api/screen/config", async (req, res) => {
    try {
      const config = getMonitorConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "获取配置失败" });
    }
  });

  app.patch("/api/screen/config", requireMaster, async (req, res) => {
    try {
      const newConfig = updateMonitorConfig(req.body);
      res.json({ success: true, config: newConfig });
    } catch (error) {
      res.status(500).json({ error: "更新配置失败" });
    }
  });

  app.delete("/api/screen/session/:sessionId", async (req, res) => {
    try {
      clearSession(req.params.sessionId);
      res.json({ success: true, message: `会话 ${req.params.sessionId} 已清除` });
    } catch (error) {
      res.status(500).json({ error: "清除会话失败" });
    }
  });

  // WebSocket广播屏幕分析结果
  addAnalysisListener((sessionId, analysis) => {
    const message = JSON.stringify({
      type: 'SCREEN_ANALYSIS',
      sessionId,
      analysis,
      timestamp: Date.now(),
    });
    
    z3Clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // Z3耳语流预警回调 - 通过WebSocket推送预警
  addAlertCallback((sessionId, alert) => {
    const message = JSON.stringify({
      type: 'Z3_WHISPER_ALERT',
      sessionId,
      alert,
      timestamp: Date.now(),
    });
    
    z3Clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    console.log(`[Z3 Whisper] Broadcast alert to ${z3Clients.size} clients`);
  });

  // ===== Vision Sniffing API =====
  
  app.post("/api/vision/start/:sessionId", requireMaster, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const mockCaptureCallback = async (): Promise<string> => {
        const state = getScreenState(sessionId);
        return state?.lastContent || '';
      };
      
      startVisionSniffing(sessionId, mockCaptureCallback);
      
      res.json({
        success: true,
        sessionId,
        message: `Vision Sniffing 已启动，会话 ${sessionId}`,
        status: getVisionSniffingStatus(sessionId),
      });
    } catch (error) {
      console.error('[Vision Sniffing] Start error:', error);
      res.status(500).json({ error: "启动 Vision Sniffing 失败" });
    }
  });

  app.post("/api/vision/stop/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      stopVisionSniffing(sessionId);
      
      res.json({
        success: true,
        sessionId,
        message: `Vision Sniffing 已停止，会话 ${sessionId}`,
      });
    } catch (error) {
      console.error('[Vision Sniffing] Stop error:', error);
      res.status(500).json({ error: "停止 Vision Sniffing 失败" });
    }
  });

  app.get("/api/vision/status/:sessionId", async (req, res) => {
    try {
      const status = getVisionSniffingStatus(req.params.sessionId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "获取状态失败" });
    }
  });

  app.get("/api/vision/stats", async (req, res) => {
    try {
      const stats = getVisionSniffingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取统计失败" });
    }
  });

  app.post("/api/vision/alert/:sessionId", async (req, res) => {
    try {
      const triggered = await checkAndAlert(req.params.sessionId);
      
      res.json({
        sessionId: req.params.sessionId,
        alertTriggered: triggered,
        message: triggered ? '预警已触发并推送至Z3耳语流' : '当前内容无需预警',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Vision Sniffing] Alert check error:', error);
      res.status(500).json({ error: "预警检查失败" });
    }
  });
};
