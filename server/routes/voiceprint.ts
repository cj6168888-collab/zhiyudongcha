import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { attachRole, requireMaster, auditAction } from '../middleware/auth';
import { voiceAuthService } from '../services/VoiceAuthService';

const logger = createServiceLogger('VoiceprintRoutes');

export function registerVoiceprintRoutes(app: Express, context: RouteContext): void {
  const { storage } = context;

  app.get('/api/voiceprint/status', attachRole, async (_req, res) => {
    try {
      const status = await voiceAuthService.getVoiceprintStatus();
      res.json(status);
    } catch (error) {
      logger.error({ err: error }, 'Get voiceprint status error');
      res.status(500).json({ error: '获取声纹状态失败' });
    }
  });

  app.post('/api/voiceprint/enroll', attachRole, requireMaster, async (req, res) => {
    try {
      const { audioData, duration, sampleRate } = req.body;

      if (!audioData || !Array.isArray(audioData)) {
        return res.status(400).json({ error: '无效的音频数据' });
      }

      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const result = await voiceAuthService.enrollVoiceprint(sample);

      // TODO: 重新添加审计日志，需要从voiceAuthService中获取sampleHash
      // 暂时保留原审计逻辑但使用storage（稍后优化）
      const { generateSampleHash } = await import('../services/voiceprint');
      const sampleHash = generateSampleHash(sample);
      
      await auditAction('VOICEPRINT_ENROLL', 'MASTER', 'voiceprint', 'MASTER', {
        sampleCount: result.sampleCount,
        enrolled: result.enrolled,
        sampleHash: sampleHash.substring(0, 8),
      }, result.enrolled ? 'SUCCESS' : 'FAILED');

      return res.json({
        success: true,
        enrolled: result.enrolled,
        sampleCount: result.sampleCount,
        sampleRequired: result.sampleRequired,
        message: result.message,
      });
    } catch (error) {
      logger.error({ err: error }, 'Enroll voiceprint error');
      if (error instanceof Error && error.message.includes('该声纹样本已存在')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: '声纹录入失败' });
    }
  });

  app.post('/api/voiceprint/refine', attachRole, requireMaster, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, silent = true } = req.body;

      if (!audioData || !Array.isArray(audioData)) {
        return res.status(400).json({ error: '无效的音频数据' });
      }

      const sample = { audioData, duration: duration || 2, sampleRate: sampleRate || 16000 };
      const result = await voiceAuthService.refineVoiceprint(sample, silent);

      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Refine voiceprint error');
      if (error instanceof Error && error.message.includes('请先完成声纹初始录入')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: '声纹优化失败' });
    }
  });

  app.post('/api/voiceprint/verify', attachRole, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, requestedAction } = req.body;

      if (!audioData || !Array.isArray(audioData)) {
        return res.status(400).json({ error: '无效的音频数据' });
      }

      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const result = await voiceAuthService.verifyVoiceprint(sample, requestedAction);

      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Verify voiceprint error');
      return res.status(500).json({ error: '声纹验证失败' });
    }
  });

  app.get('/api/voiceprint/authorizations', attachRole, async (_req, res) => {
    try {
      const authorizations = await voiceAuthService.getAuthorizations();
      return res.json(authorizations);
    } catch (error) {
      logger.error({ err: error }, 'Get authorizations error');
      return res.status(500).json({ error: '获取授权列表失败' });
    }
  });

  app.post('/api/voiceprint/authorize', attachRole, requireMaster, async (req, res) => {
    try {
      const { authType, target, scope, expiresInHours } = req.body;

      if (!authType || !target) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null;

      const auth = await voiceAuthService.createAuthorization({
        authType,
        target,
        scope: scope || null,
        grantedBy: 'MASTER',
        expiresAt,
      });

      await auditAction('VOICE_AUTHORIZATION', 'MASTER', 'authorization', auth.id, {
        authType,
        target,
        scope,
        expiresAt,
      }, 'SUCCESS');

      return res.json({
        success: true,
        authorization: auth,
        message: `已授权${authType === 'PERSON' ? '与' : ''}${target}${authType === 'PERSON' ? '对话' : '操作'}`,
      });
    } catch (error) {
      logger.error({ err: error }, 'Create authorization error');
      return res.status(500).json({ error: '创建授权失败' });
    }
  });

  app.delete('/api/voiceprint/authorize/:id', attachRole, requireMaster, async (req, res) => {
    try {
      await voiceAuthService.deactivateAuthorization(req.params.id);

      await auditAction('VOICE_AUTHORIZATION_REVOKE', 'MASTER', 'authorization', req.params.id, {
        authId: req.params.id,
      }, 'SUCCESS');

      return res.json({ success: true, message: '授权已撤销' });
    } catch (error) {
      logger.error({ err: error }, 'Revoke authorization error');
      return res.status(500).json({ error: '撤销授权失败' });
    }
  });

  app.post('/api/voiceprint/check-permission', attachRole, async (req, res) => {
    try {
      const { audioData, duration, sampleRate, action } = req.body;

      if (!audioData || !Array.isArray(audioData)) {
        return res.status(400).json({ error: '无效的音频数据' });
      }

      const sample = { audioData, duration, sampleRate: sampleRate || 16000 };
      const result = await voiceAuthService.checkPermission(sample, action);

      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Check permission error');
      return res.status(500).json({ error: '权限检查失败' });
    }
  });

  logger.info('Voiceprint routes registered');
}
