/**
 * 智语洞察 (Insight Listener) API 路由
 * 
 * 提供会话管理、转写处理、实体查询、提醒管理等功能
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('InsightListener');

import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RegisterRouteFn } from "./types";
import {
  insightListenerService,
  type ListeningMode,
  type FeedbackChannel,
} from "../services/insight-listener";
import { getErrorMessage } from '../lib/errors';

export const registerInsightListenerRoutes: RegisterRouteFn = (app, storage, context) => {
  
  // === 会话管理 ===
  
  app.post("/api/insight/session/start", async (req, res) => {
    try {
      const { userId, mode } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "缺少用户ID (userId)" });
      }
      
      const session = await insightListenerService.startSession(
        userId,
        mode as ListeningMode | undefined
      );
      
      res.status(201).json({
        success: true,
        message: `智语洞察会话已启动`,
        session,
      });
    } catch (error) {
      logger.error({ err: error }, '启动会话失败');
      res.status(500).json({ error: "启动智语洞察会话失败" });
    }
  });

  app.post("/api/insight/session/:sessionId/end", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await insightListenerService.endSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "会话不存在" });
      }
      
      res.json({
        success: true,
        message: "会话已结束",
        session,
      });
    } catch (error) {
      logger.error({ err: error }, '结束会话失败');
      res.status(500).json({ error: "结束会话失败" });
    }
  });

  app.get("/api/insight/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const summary = await insightListenerService.getSessionSummary(sessionId);
      
      if (!summary) {
        return res.status(404).json({ error: "会话不存在或获取失败" });
      }
      
      res.json(summary);
    } catch (error) {
      logger.error({ err: error }, '获取会话详情失败');
      res.status(500).json({ error: "获取会话详情失败" });
    }
  });

  app.get("/api/insight/session/active/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const session = insightListenerService.getActiveSession(userId);
      
      if (!session) {
        return res.json({ active: false, session: null });
      }
      
      res.json({ active: true, session });
    } catch (error) {
      logger.error({ err: error }, '获取活跃会话失败');
      res.status(500).json({ error: "获取活跃会话失败" });
    }
  });

  // === 转写处理 ===
  
  app.post("/api/insight/transcript", async (req, res) => {
    try {
      const { 
        sessionId, 
        speakerId, 
        speakerName, 
        isMaster = false, 
        text, 
        startTime, 
        endTime, 
        confidence = 0.9 
      } = req.body;
      
      if (!sessionId || !text) {
        return res.status(400).json({ error: "缺少会话ID或转写文本" });
      }
      
      const result = await insightListenerService.processTranscript(sessionId, {
        speakerId,
        speakerName,
        isMaster,
        text,
        startTime: startTime || Date.now() / 1000,
        endTime: endTime || Date.now() / 1000,
        confidence,
      });
      
      res.json({
        success: true,
        transcript: result.transcript,
        entities: result.entities,
        alerts: result.alerts,
        sceneChange: result.sceneChange,
      });
    } catch (error: unknown) {
      logger.error({ err: error }, '处理转写失败');
      res.status(500).json({ error: getErrorMessage(error) || "处理转写失败" });
    }
  });

  // === 反馈通道管理 ===
  
  app.post("/api/insight/feedback/channels", async (req, res) => {
    try {
      const { userId, channels } = req.body;
      
      if (!userId || !channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: "缺少用户ID或反馈通道配置" });
      }
      
      interface ChannelInput {
        type: FeedbackChannel['type'];
        available?: boolean;
        deviceId?: string;
        priority?: number;
      }
      
      const feedbackChannels: FeedbackChannel[] = channels.map((c: ChannelInput, index: number) => ({
        type: c.type,
        available: c.available !== false,
        deviceId: c.deviceId,
        priority: c.priority ?? index + 1,
      }));
      
      insightListenerService.registerFeedbackChannels(userId, feedbackChannels);
      
      res.json({
        success: true,
        message: "反馈通道已注册",
        channels: feedbackChannels,
      });
    } catch (error) {
      logger.error({ err: error }, '注册反馈通道失败');
      res.status(500).json({ error: "注册反馈通道失败" });
    }
  });

  // === 统计与清理 ===
  
  app.get("/api/insight/stats", async (req, res) => {
    try {
      const stats = insightListenerService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error({ err: error }, '获取统计失败');
      res.status(500).json({ error: "获取统计失败" });
    }
  });

  app.get("/api/insight/sessions/active", async (req, res) => {
    try {
      const sessions = insightListenerService.getAllActiveSessions();
      res.json({
        count: sessions.length,
        sessions,
      });
    } catch (error) {
      logger.error({ err: error }, '获取活跃会话列表失败');
      res.status(500).json({ error: "获取活跃会话列表失败" });
    }
  });

  app.get("/api/insight/sessions/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const sessions = await insightListenerService.getSessionHistory(limit, offset);
      res.json({
        sessions,
        hasMore: sessions.length === limit,
      });
    } catch (error) {
      logger.error({ err: error }, '获取历史会话失败');
      res.status(500).json({ error: "获取历史会话失败" });
    }
  });

  app.get("/api/insight/session/:sessionId/transcripts", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const transcripts = await insightListenerService.getSessionTranscripts(sessionId);
      res.json({ transcripts });
    } catch (error) {
      logger.error({ err: error }, '获取会话转写失败');
      res.status(500).json({ error: "获取会话转写失败" });
    }
  });

  app.get("/api/insight/session/:sessionId/entities", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const entities = await insightListenerService.getSessionEntities(sessionId);
      res.json({ entities });
    } catch (error) {
      logger.error({ err: error }, '获取会话实体失败');
      res.status(500).json({ error: "获取会话实体失败" });
    }
  });

  app.post("/api/insight/entity/:entityId/adopt", async (req, res) => {
    try {
      const { entityId } = req.params;
      const { targetType } = req.body; // 'person' | 'project'
      
      if (!targetType || !['person', 'project'].includes(targetType)) {
        return res.status(400).json({ error: "请指定目标类型: person 或 project" });
      }
      
      const result = await insightListenerService.adoptEntity(entityId, targetType, storage);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      logger.error({ err: error }, '采纳实体失败');
      res.status(500).json({ error: "采纳实体失败" });
    }
  });

  app.post("/api/insight/cleanup", async (req, res) => {
    try {
      const result = await insightListenerService.cleanupOldRecordings();
      
      res.json({
        success: true,
        message: `已清理 ${result.deletedCount} 个过期会话`,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, '清理过期数据失败');
      res.status(500).json({ error: "清理过期数据失败" });
    }
  });

  // === 场景模式 ===
  
  app.get("/api/insight/modes", async (req, res) => {
    try {
      res.json({
        modes: [
          { 
            id: 'MEETING', 
            name: '会议模式', 
            description: '正式会议场景，多人参与，有议程和决议',
            icon: 'users',
          },
          { 
            id: 'CONVERSATION', 
            name: '谈话模式', 
            description: '一对一或小组深度讨论',
            icon: 'message-circle',
          },
          { 
            id: 'CASUAL', 
            name: '闲谈模式', 
            description: '轻松的日常交流',
            icon: 'coffee',
          },
          { 
            id: 'NEGOTIATION', 
            name: '谈判模式', 
            description: '商务谈判，关注承诺、条款和分歧',
            icon: 'handshake',
          },
          { 
            id: 'SILENT', 
            name: '静默模式', 
            description: '暂停监听，保持后台待命',
            icon: 'volume-x',
          },
        ],
        feedbackPriority: [
          { type: 'EARPHONE', name: '蓝牙耳机耳语', priority: 1 },
          { type: 'WATCH', name: '智能手表震动', priority: 2 },
          { type: 'PHONE', name: '手机静音震动', priority: 3 },
        ],
        retentionDays: 10,
      });
    } catch (error) {
      res.status(500).json({ error: "获取模式配置失败" });
    }
  });
};
