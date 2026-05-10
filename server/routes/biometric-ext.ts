import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { attachRole, requireMaster } from '../middleware/auth';
import { biometricAuthService } from '../services/biometric-auth';
import { avatarRecognitionService } from '../services/avatar-recognition';

const logger = createServiceLogger('BiometricExtRoutes');

export function registerBiometricExtRoutes(app: Express, _context: RouteContext): void {
  app.get('/api/biometric/status', attachRole, requireMaster, async (_req, res) => {
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
          lastVerified: profile.face.lastVerified,
        } : { enrolled: false },
        fingerprint: profile.fingerprint ? {
          enrolled: profile.fingerprint.enrolled,
          enrolledAt: profile.fingerprint.enrolledAt,
          verificationCount: profile.fingerprint.verificationCount,
          lastVerified: profile.fingerprint.lastVerified,
        } : { enrolled: false },
        voice: profile.voice ? {
          enrolled: profile.voice.enrolled,
          enrolledAt: profile.voice.enrolledAt,
          sampleCount: profile.voice.sampleCount,
          verificationCount: profile.voice.verificationCount,
          lastVerified: profile.voice.lastVerified,
        } : { enrolled: false },
        persistence: {
          enabled: true,
          similarityThreshold: 0.85,
          lockThreshold: 5,
          lockDurationMinutes: 30,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Get biometric status error');
      res.status(500).json({ error: '获取生物特征状态失败' });
    }
  });

  app.post('/api/biometric/face/enroll', attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: '请提供面容照片' });
      }

      const result = await biometricAuthService.enrollFace('master', imageBase64);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          profile: result.profile,
          enrollmentData: result.enrollmentData,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Face enroll error');
      res.status(500).json({ error: '面容录入失败' });
    }
  });

  app.post('/api/biometric/face/verify', attachRole, async (req, res) => {
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
          error: '请提供参考照片和新捕获的照片进行1:1比对',
          hint: '新API需要: referenceImage(录入时的原始照片) + capturedImage(当前捕获的照片)',
          migration: '或使用 imageBase64 进行简单质量检测',
        });
      }

      const result = await biometricAuthService.verifyFace('master', referenceImage, capturedImage);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Face verify error');
      res.status(500).json({ error: '面容验证失败' });
    }
  });

  app.post('/api/biometric/face/quality', attachRole, async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: '请提供照片' });
      }

      const { faceCompareService } = await import('../services/face-compare');
      const result = await faceCompareService.checkFaceQuality(imageBase64);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Face quality check error');
      res.status(500).json({ error: '人脸质量检测失败' });
    }
  });

  app.post('/api/biometric/face/compare', attachRole, async (req, res) => {
    try {
      const { imageA, imageB } = req.body;

      if (!imageA || !imageB) {
        return res.status(400).json({
          error: '请提供两张照片进行比对',
          hint: 'imageA: 第一张照片, imageB: 第二张照片',
        });
      }

      const { faceCompareService } = await import('../services/face-compare');
      const result = await faceCompareService.compareFaces(imageA, imageB);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Face compare error');
      res.status(500).json({ error: '人脸比对失败' });
    }
  });

  app.post('/api/biometric/fingerprint/enroll', attachRole, requireMaster, async (req, res) => {
    try {
      const { credentialId, publicKey, attestationType } = req.body;

      if (!credentialId || !publicKey) {
        return res.status(400).json({ error: '无效的指纹凭证' });
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
        profile: result.profile,
      });
    } catch (error) {
      logger.error({ err: error }, 'Fingerprint enroll error');
      res.status(500).json({ error: '指纹录入失败' });
    }
  });

  app.get('/api/biometric/verification-logs', attachRole, requireMaster, async (req, res) => {
    try {
      const userId = 'master';
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await biometricAuthService.getVerificationLogs(userId, limit);

      res.json({
        success: true,
        logs,
        total: logs.length,
        message: `最近${limit}条验证记录`,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get verification logs error');
      res.status(500).json({ error: '获取验证日志失败' });
    }
  });

  app.get('/api/biometric/lock-status', attachRole, async (_req, res) => {
    try {
      const userId = 'master';
      const lockStatus = await biometricAuthService.isAccountLocked(userId);

      res.json({
        success: true,
        ...lockStatus,
        config: {
          maxAttempts: 5,
          lockDurationMinutes: 30,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Check lock status error');
      res.status(500).json({ error: '检查锁定状态失败' });
    }
  });

  app.post('/api/biometric/unlock', attachRole, requireMaster, async (_req, res) => {
    try {
      const userId = 'master';
      await biometricAuthService.unlockAccount(userId);

      res.json({
        success: true,
        message: '账户已解锁',
      });
    } catch (error) {
      logger.error({ err: error }, 'Unlock account error');
      res.status(500).json({ error: '解锁账户失败' });
    }
  });

  app.post('/api/avatar/analyze', attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: '请提供头像照片' });
      }

      const result = await avatarRecognitionService.analyzeAvatar(imageBase64);

      if (result.success) {
        res.json({
          success: true,
          analysis: result.analysis,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Avatar analyze error');
      res.status(500).json({ error: '头像分析失败' });
    }
  });

  logger.info('Biometric ext routes registered');
}
