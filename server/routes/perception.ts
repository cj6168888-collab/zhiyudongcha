import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireMaster } from '../middleware/auth';
import { perceptionCore } from '../services/perception-core';

const logger = createServiceLogger('PerceptionRoutes');

export function registerPerceptionRoutes(app: Express, _context: RouteContext): void {
  app.post('/api/perception/session', requireMaster, async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: '设备ID不能为空' });
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
      logger.error({ err: error }, 'Create perception session error');
      res.status(500).json({ error: '创建感知会话失败' });
    }
  });

  app.get('/api/perception/session/:id', requireMaster, async (req, res) => {
    try {
      const session = perceptionCore.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }
      res.json({
        id: session.id,
        deviceId: session.deviceId,
        visionEnabled: session.visionEnabled,
        audioEnabled: session.audioEnabled,
        isActive: session.isActive,
        lastActivity: session.lastActivity,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get perception session error');
      res.status(500).json({ error: '获取感知会话失败' });
    }
  });

  app.post('/api/perception/session/:id/frame', requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: '图像数据不能为空' });
      }

      const result = await perceptionCore.processVisionFrame(req.params.id, imageBase64);

      res.json({
        success: true,
        frame: result.frame,
        response: result.response,
      });
    } catch (error) {
      logger.error({ err: error }, 'Process frame error');
      res.status(500).json({ error: '处理帧数据失败' });
    }
  });

  app.post('/api/perception/session/:id/audio', requireMaster, async (req, res) => {
    try {
      const { transcript, speaker = 'unknown', language = 'zh-CN' } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: '转录文本不能为空' });
      }

      const result = await perceptionCore.processAudioSegment(
        req.params.id,
        transcript,
        speaker,
        language
      );

      res.json({
        success: true,
        segment: result.segment,
        response: result.response,
      });
    } catch (error) {
      logger.error({ err: error }, 'Process audio error');
      res.status(500).json({ error: '处理音频数据失败' });
    }
  });

  app.delete('/api/perception/session/:id', requireMaster, async (req, res) => {
    try {
      const success = await perceptionCore.endSession(req.params.id);
      if (!success) {
        return res.status(404).json({ error: '会话不存在' });
      }
      res.json({ success: true, message: '感知会话已关闭' });
    } catch (error) {
      logger.error({ err: error }, 'Close perception session error');
      res.status(500).json({ error: '关闭感知会话失败' });
    }
  });

  app.get('/api/perception/stats', requireMaster, async (_req, res) => {
    try {
      const activeSessions = (perceptionCore as Record<string, unknown>).sessions?.size || 0;
      res.json({
        activeSessions,
        visionEnabled: true,
        audioEnabled: true,
        status: 'operational',
      });
    } catch (error) {
      logger.error({ err: error }, 'Get perception stats error');
      res.status(500).json({ error: '获取感知统计失败' });
    }
  });

  logger.info('Perception routes registered');
}
