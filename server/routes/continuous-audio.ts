/**
 * 免唤醒持续监听 WebSocket 路由
 * 
 * 处理来自Android App的持续音频流
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { continuousAudioService } from '../services/continuous-audio';
import { WebSocketServer, WebSocket } from 'ws';

const logger = createServiceLogger('ContinuousListeningRoutes');

const router = Router();

const startListeningSchema = z.object({
  userId: z.string(),
  deviceId: z.string(),
  source: z.enum(['MOBILE', 'GLASSES', 'PC', 'UNKNOWN']).optional(),
  enrollMaster: z.boolean().optional(),
});

/**
 * POST /api/continuous/listen/start
 * 开始持续监听
 */
router.post('/listen/start', async (req: Request, res: Response) => {
  try {
    const body = startListeningSchema.parse(req.body);
    
    const session = await continuousAudioService.createSession(
      body.userId,
      body.deviceId,
      body.source || 'MOBILE'
    );
    
    logger.info({ userId: body.userId, deviceId: body.deviceId }, '持续监听已启动');
    
    res.json({
      success: true,
      sessionId: session.id,
      message: '持续监听已启动',
      instructions: {
        websocket: `ws://host/api/continuous/ws/${session.id}`,
        audioFormat: {
          sampleRate: 16000,
          channels: 1,
          format: 'pcm16bit',
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, '启动持续监听失败');
    res.status(500).json({
      success: false,
      error: '启动失败',
    });
  }
});

/**
 * POST /api/continuous/listen/:sessionId/stop
 * 停止持续监听
 */
router.post('/listen/:sessionId/stop', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await continuousAudioService.endSession(sessionId);
    
    logger.info({ sessionId }, '持续监听已停止');
    
    res.json({
      success: true,
      message: '持续监听已停止',
    });
  } catch (error) {
    logger.error({ err: error }, '停止持续监听失败');
    res.status(500).json({
      success: false,
      error: '停止失败',
    });
  }
});

/**
 * GET /api/continuous/sessions
 * 获取所有活跃会话
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = continuousAudioService.getActiveSessions();
    
    res.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        deviceId: s.deviceId,
        source: s.source,
        startTime: s.startTime,
        isActive: s.isActive,
        masterVoiceEnrolled: s.masterVoiceEnrolled,
        totalAudioProcessed: s.totalAudioProcessed,
        commandCount: s.commandCount,
        conversationCount: s.conversationCount,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, '获取会话列表失败');
    res.status(500).json({
      success: false,
      error: '获取失败',
    });
  }
});

/**
 * GET /api/continuous/sessions/:sessionId/stats
 * 获取会话统计
 */
router.get('/sessions/:sessionId/stats', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = continuousAudioService.getSessionStats(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
      });
    }
    
    res.json({
      success: true,
      session,
    });
  } catch (error) {
    logger.error({ err: error }, '获取会话统计失败');
    res.status(500).json({
      success: false,
      error: '获取失败',
    });
  }
});

/**
 * WebSocket 端点
 * ws://host/api/continuous/ws/:sessionId
 * 
 * 消息格式:
 * - 客户端发送: { type: 'AUDIO', data: <base64 audio> }
 * - 服务端发送: { type: 'INTENT', intent: <intent type>, text: <recognized text> }
 *               { type: 'COMMAND', command: <command to execute> }
 *               { type: 'ERROR', message: <error message> }
 */

export function setupContinuousAudioWebSocket(wss: WebSocketServer) {
  const wsPath = '/api/continuous/ws';
  
  logger.info({ path: wsPath }, '注册持续监听WebSocket');
  
  wss.on('connection', (ws, req) => {
    const url = req.url || '';
    const match = url.match(/\/api\/continuous\/ws\/([^?]+)/);
    
    if (!match) {
      ws.close(4001, 'Invalid path');
      return;
    }
    
    const sessionId = match[1];
    const session = continuousAudioService.getSessionStats(sessionId);
    
    if (!session) {
      ws.close(4002, 'Session not found');
      return;
    }
    
    logger.info({ sessionId, deviceId: session.deviceId }, '客户端连接持续监听');
    
    let audioBuffer: Buffer[] = [];
    let lastActivity = Date.now();
    
    // 发送连接成功
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      sessionId,
      message: '持续监听已连接',
    }));
    
    // 处理客户端消息
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        lastActivity = Date.now();
        
        switch (message.type) {
          case 'AUDIO':
            // 接收音频数据
            if (message.data) {
              const audioBufferChunk = Buffer.from(message.data, 'base64');
              audioBuffer.push(audioBufferChunk);
              
              // 批量处理音频
              if (audioBuffer.length >= 10) {
                const fullAudio = Buffer.concat(audioBuffer);
                audioBuffer = [];
                
                const intent = await continuousAudioService.processAudio(sessionId, fullAudio);
                
                if (intent) {
                  // 发送意图结果给客户端
                  ws.send(JSON.stringify({
                    type: 'INTENT',
                    intent: intent.type,
                    confidence: intent.confidence,
                    text: intent.text,
                    needsResponse: intent.needsResponse,
                    shouldRecord: intent.shouldRecord,
                    masterSpeaking: intent.masterSpeaking,
                  }));
                  
                  // 如果是命令，发送命令执行请求
                  if (intent.type === 'VOICE_COMMAND' && intent.text) {
                    ws.send(JSON.stringify({
                      type: 'COMMAND',
                      command: intent.text,
                      text: intent.text,
                    }));
                  }
                }
              }
            }
            break;
            
          case 'PING':
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            break;
            
          default:
            logger.warn({ type: message.type }, '未知的消息类型');
        }
        
      } catch (error) {
        logger.error({ err: error }, '处理音频消息失败');
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: '处理失败',
        }));
      }
    });
    
    // 心跳检测
    const heartbeat = setInterval(() => {
      if (Date.now() - lastActivity > 30000) {
        logger.warn({ sessionId }, '客户端超时断开');
        ws.close(4003, 'Timeout');
      } else {
        ws.send(JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() }));
      }
    }, 10000);
    
    ws.on('close', () => {
      clearInterval(heartbeat);
      logger.info({ sessionId }, '客户端断开持续监听');
    });
    
    ws.on('error', (error) => {
      logger.error({ err: error, sessionId }, 'WebSocket错误');
    });
  });
}

export default router;
