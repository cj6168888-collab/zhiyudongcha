/**
 * 流式语音合成 API 路由 - Phase 8.2
 * 
 * HTTP端点:
 * - POST /api/tts/stream - 开始流式合成
 * - POST /api/tts/synthesize - 一次性合成
 * - GET /api/tts/session/:id - 获取会话状态
 * - DELETE /api/tts/session/:id - 中断/关闭会话
 * - GET /api/tts/stats - 服务统计
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('StreamingTts');

import type { Express, Request, Response } from 'express';
import { streamingTTSService, type StreamingTTSConfig, type TTSChunk } from '../services/streaming-tts';
import type { RegisterRouteFn } from './types';

export const registerStreamingTTSRoutes: RegisterRouteFn = (app, storage, context) => {

  // 开始流式合成（SSE）
  app.post('/api/tts/stream', async (req: Request, res: Response) => {
    try {
      const { text, config } = req.body as { text: string; config?: Partial<StreamingTTSConfig> };

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: '缺少必要参数: text' });
      }

      // 设置SSE头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const session = streamingTTSService.createSession(config);
      
      // 发送会话信息
      res.write(`data: ${JSON.stringify({ type: 'session_created', sessionId: session.id })}\n\n`);

      let closed = false;
      req.on('close', () => {
        closed = true;
        streamingTTSService.abort(session.id);
      });

      try {
        await streamingTTSService.synthesizeStream(session.id, text, (chunk: TTSChunk) => {
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', ...chunk })}\n\n`);
          }
        });

        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'complete', sessionId: session.id })}\n\n`);
        }
      } catch (error) {
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : '合成失败' })}\n\n`);
        }
      } finally {
        streamingTTSService.closeSession(session.id);
        res.end();
      }

    } catch (error) {
      res.status(500).json({ error: '流式合成失败' });
    }
  });

  // 一次性合成
  app.post('/api/tts/synthesize', async (req: Request, res: Response) => {
    try {
      const { text, config, returnBase64 } = req.body as { 
        text: string; 
        config?: Partial<StreamingTTSConfig>;
        returnBase64?: boolean;
      };

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: '缺少必要参数: text' });
      }

      const audioBuffer = await streamingTTSService.synthesize(text, config);

      if (returnBase64) {
        res.json({
          success: true,
          audio: audioBuffer.toString('base64'),
          format: config?.format || 'mp3',
          size: audioBuffer.length,
        });
      } else {
        res.setHeader('Content-Type', config?.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.send(audioBuffer);
      }

    } catch (error) {
      res.status(500).json({ 
        error: '合成失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取会话状态
  app.get('/api/tts/session/:id', async (req: Request, res: Response) => {
    try {
      const session = streamingTTSService.getSession(req.params.id);

      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({
        id: session.id,
        status: session.status,
        config: session.config,
        currentIndex: session.currentIndex,
        totalSentences: session.totalSentences,
        chunksCompleted: session.chunks.length,
        startTime: session.startTime,
        duration: Date.now() - session.startTime,
        error: session.error,
      });

    } catch (error) {
      res.status(500).json({ error: '获取会话状态失败' });
    }
  });

  // 中断/关闭会话
  app.delete('/api/tts/session/:id', async (req: Request, res: Response) => {
    try {
      const session = streamingTTSService.getSession(req.params.id);

      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      const wasActive = session.status === 'synthesizing';
      streamingTTSService.abort(req.params.id);
      streamingTTSService.closeSession(req.params.id);

      res.json({
        success: true,
        sessionId: req.params.id,
        wasActive,
        message: wasActive ? '会话已中断并关闭' : '会话已关闭',
      });

    } catch (error) {
      res.status(500).json({ error: '关闭会话失败' });
    }
  });

  // 服务统计
  app.get('/api/tts/stats', async (req: Request, res: Response) => {
    try {
      const stats = streamingTTSService.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '8.2',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 快速测试端点
  app.post('/api/tts/test', async (req: Request, res: Response) => {
    try {
      const { text, voiceId } = req.body;
      const testText = text || '你好爸爸，小智在这里！';
      
      const session = streamingTTSService.createSession({
        voiceId: voiceId || 'longhuhu_v3',
      });

      const chunks: TTSChunk[] = [];
      await streamingTTSService.synthesizeStream(session.id, testText, chunk => {
        chunks.push(chunk);
      });

      streamingTTSService.closeSession(session.id);

      res.json({
        success: true,
        text: testText,
        chunks: chunks.length,
        totalDuration: chunks.reduce((sum, c) => sum + c.duration, 0),
        audioSamples: chunks.slice(0, 2).map(c => ({
          index: c.index,
          text: c.text,
          audioPreview: c.audioBase64.slice(0, 50) + '...',
        })),
      });

    } catch (error) {
      res.status(500).json({ 
        error: '测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  logger.info('[StreamingTTS] HTTP路由已注册 /api/tts/*');
};
