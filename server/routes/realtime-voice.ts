/**
 * 实时语音对话 API 路由 - Phase 8.1
 * 
 * HTTP端点:
 * - GET /api/realtime-voice/stats - 获取服务统计
 * - GET /api/realtime-voice/sessions - 获取活跃会话列表
 * - GET /api/realtime-voice/voices - 获取可用音色
 * 
 * WebSocket端点:
 * - /ws/realtime-voice - 实时语音对话连接
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RealtimeVoice');

import type { Express } from 'express';
import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { realtimeVoiceService, type RealtimeSessionConfig } from '../services/realtime-voice';
import { getVoiceProfiles, getVoicesByAge } from '../services/voice-synthesis';
import type { RegisterRouteFn } from './types';

let wss: WebSocketServer | null = null;

export const registerRealtimeVoiceRoutes: RegisterRouteFn = (app, storage, context) => {
  
  // 获取服务统计
  app.get('/api/realtime-voice/stats', async (req, res) => {
    try {
      const stats = realtimeVoiceService.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '8.1',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 获取活跃会话列表
  app.get('/api/realtime-voice/sessions', async (req, res) => {
    try {
      const sessions = realtimeVoiceService.getActiveSessions();
      res.json({
        sessions: sessions.map(s => ({
          id: s.id,
          userId: s.userId,
          state: s.state,
          startTime: s.startTime,
          lastActivityTime: s.lastActivityTime,
          conversationLength: s.conversationHistory.length,
          metrics: s.metrics,
        })),
        count: sessions.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取会话列表失败' });
    }
  });

  // 获取推荐的实时对话音色
  app.get('/api/realtime-voice/voices', async (req, res) => {
    try {
      // 优先推荐童声和年轻女声
      const childVoices = getVoicesByAge('child');
      const allProfiles = getVoiceProfiles();
      
      const recommendedVoices = [
        ...childVoices,
        ...allProfiles.filter(v => 
          v.category === '社交陪伴' || 
          v.category === '陪伴闲聊' ||
          v.category === '语音助手'
        ),
      ];

      // 去重
      const uniqueVoices = Array.from(
        new Map(recommendedVoices.map(v => [v.id, v])).values()
      );

      res.json({
        voices: uniqueVoices,
        count: uniqueVoices.length,
        defaultVoice: 'longhuhu_v3', // 童声作为默认
        recommendation: '推荐使用童声"龙呼呼"获得最佳小智体验',
      });
    } catch (error) {
      res.status(500).json({ error: '获取音色列表失败' });
    }
  });

  // 获取会话详情
  app.get('/api/realtime-voice/session/:sessionId', async (req, res) => {
    try {
      const session = realtimeVoiceService.getSession(req.params.sessionId);
      
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({
        id: session.id,
        userId: session.userId,
        state: session.state,
        startTime: session.startTime,
        lastActivityTime: session.lastActivityTime,
        vadConfig: session.vadConfig,
        voiceId: session.config.voiceId,
        conversationHistory: session.conversationHistory,
        metrics: session.metrics,
      });
    } catch (error) {
      res.status(500).json({ error: '获取会话详情失败' });
    }
  });

  // 手动发送文本消息（调试用）
  app.post('/api/realtime-voice/send-text', async (req, res) => {
    try {
      const { sessionId, text } = req.body;
      
      if (!sessionId || !text) {
        return res.status(400).json({ error: '缺少 sessionId 或 text' });
      }

      const session = realtimeVoiceService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      // 直接触发TTS
      await realtimeVoiceService.streamTTS(session, text);

      res.json({
        success: true,
        message: '文本已发送到TTS',
        sessionId,
        text,
      });
    } catch (error) {
      res.status(500).json({ error: '发送失败' });
    }
  });

  // VAD配置端点
  app.get('/api/realtime-voice/vad-presets', async (req, res) => {
    try {
      res.json({
        presets: {
          sensitive: {
            name: '高灵敏度',
            description: '适合安静环境，快速响应',
            energyThreshold: 0.01,
            silenceTimeout: 1000,
            speechMinDuration: 200,
            prerollDuration: 150,
          },
          normal: {
            name: '标准',
            description: '适合一般环境',
            energyThreshold: 0.02,
            silenceTimeout: 1500,
            speechMinDuration: 300,
            prerollDuration: 200,
          },
          noisy: {
            name: '嘈杂环境',
            description: '适合有背景噪音的环境',
            energyThreshold: 0.05,
            silenceTimeout: 2000,
            speechMinDuration: 500,
            prerollDuration: 300,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: '获取VAD预设失败' });
    }
  });

  logger.info('[RealtimeVoice] HTTP路由已注册 /api/realtime-voice/*');
};

// WebSocket服务器初始化
export function initRealtimeVoiceWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/realtime-voice',
  });

  wss.on('connection', (ws: WebSocket, req) => {
    logger.info('[RealtimeVoice] 新的WebSocket连接');
    
    // 从查询参数获取用户配置
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId') || 'anonymous';
    const voiceId = url.searchParams.get('voiceId') || undefined;

    const config: RealtimeSessionConfig = {
      userId,
      voiceId,
      autoReconnect: true,
    };

    // 创建会话
    const session = realtimeVoiceService.createSession(ws, config);

    // 处理消息
    ws.on('message', (data: Buffer) => {
      realtimeVoiceService.handleClientMessage(ws, data);
    });

    // 处理关闭
    ws.on('close', () => {
      logger.info('[RealtimeVoice] WebSocket连接关闭');
      realtimeVoiceService.closeSession(ws);
    });

    // 处理错误
    ws.on('error', (error) => {
      logger.error({ error: error.message }, 'WebSocket错误');
      realtimeVoiceService.closeSession(ws);
    });

    // 发送心跳
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  logger.info('[RealtimeVoice] WebSocket服务已启动 /ws/realtime-voice');
  
  return wss;
}

export function getRealtimeVoiceWSS(): WebSocketServer | null {
  return wss;
}
