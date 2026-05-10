import { Router, type Request, type Response } from "express";
import { attachRole, requireMaster } from "../middleware/auth";
import { biometricAuthService } from "../services/biometric-auth";
import { avatarRecognitionService } from "../services/avatar-recognition";
import { createServiceLogger } from "../lib/logger";

const logger = createServiceLogger("Biometric");
const router = Router();

router.get("/status", attachRole, requireMaster, async (_req: Request, res: Response) => {
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
    logger.error({ error }, "获取生物特征状态失败");
    res.status(500).json({ error: "获取生物特征状态失败" });
  }
});

router.post("/face/enroll", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "请提供面容照片" });
    }

    const result = await biometricAuthService.enrollFace('master', imageBase64);
    
    if (result.success) {
      logger.info({ userId: 'master' }, "面容录入成功");
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
    logger.error({ error }, "面容录入失败");
    res.status(500).json({ error: "面容录入失败" });
  }
});

router.post("/face/verify", attachRole, async (req: Request, res: Response) => {
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
    logger.error({ error }, "面容验证失败");
    res.status(500).json({ error: "面容验证失败" });
  }
});

router.post("/face/quality", attachRole, async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "请提供照片" });
    }

    const { faceCompareService } = await import('../services/face-compare');
    const result = await faceCompareService.checkFaceQuality(imageBase64);
    res.json(result);
  } catch (error) {
    logger.error({ error }, "人脸质量检测失败");
    res.status(500).json({ error: "人脸质量检测失败" });
  }
});

router.post("/face/compare", attachRole, async (req: Request, res: Response) => {
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
    logger.error({ error }, "人脸比对失败");
    res.status(500).json({ error: "人脸比对失败" });
  }
});

router.post("/fingerprint/enroll", attachRole, requireMaster, async (req: Request, res: Response) => {
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
    
    logger.info({ userId: 'master' }, "指纹录入成功");
    res.json({
      success: result.success,
      message: result.message,
      profile: result.profile
    });
  } catch (error) {
    logger.error({ error }, "指纹录入失败");
    res.status(500).json({ error: "指纹录入失败" });
  }
});

router.get("/verification-logs", attachRole, requireMaster, async (req: Request, res: Response) => {
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
    logger.error({ error }, "获取验证日志失败");
    res.status(500).json({ error: "获取验证日志失败" });
  }
});

router.get("/lock-status", attachRole, async (_req: Request, res: Response) => {
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
    logger.error({ error }, "检查锁定状态失败");
    res.status(500).json({ error: "检查锁定状态失败" });
  }
});

router.post("/unlock", attachRole, requireMaster, async (_req: Request, res: Response) => {
  try {
    const userId = 'master';
    await biometricAuthService.unlockAccount(userId);
    
    logger.info({ userId }, "账户已解锁");
    res.json({
      success: true,
      message: "账户已解锁"
    });
  } catch (error) {
    logger.error({ error }, "解锁账户失败");
    res.status(500).json({ error: "解锁账户失败" });
  }
});

router.post("/avatar/analyze", attachRole, requireMaster, async (req: Request, res: Response) => {
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
    logger.error({ error }, "头像分析失败");
    res.status(500).json({ error: "头像分析失败" });
  }
});

router.get("/contacts", attachRole, requireMaster, async (_req: Request, res: Response) => {
  try {
    const { contactRecognitionService } = await import('../services/contact-recognition');
    const contacts = await contactRecognitionService.getEnrolledContacts();
    res.json({ 
      success: true,
      contacts,
      total: contacts.length
    });
  } catch (error) {
    logger.error({ error }, "获取联系人生物特征失败");
    res.status(500).json({ error: "获取联系人生物特征失败" });
  }
});

router.post("/contacts/enroll/face", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { personId, imageBase64, notes } = req.body;
    
    if (!personId || !imageBase64) {
      return res.status(400).json({ 
        error: "请提供联系人ID和人脸照片",
        hint: { personId: "联系人ID", imageBase64: "Base64格式的照片" }
      });
    }
    
    if (imageBase64.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: "图片过大，请使用小于5MB的照片" });
    }
    
    const { contactRecognitionService } = await import('../services/contact-recognition');
    const result = await contactRecognitionService.enrollFace(personId, imageBase64, notes);
    
    if (result.success) {
      logger.info({ personId }, "联系人面容录入成功");
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
    logger.error({ error }, "联系人面容录入失败");
    res.status(500).json({ error: "录入联系人人脸失败" });
  }
});

router.post("/contacts/recognize/face", attachRole, requireMaster, async (req: Request, res: Response) => {
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
    logger.error({ error }, "人脸识别失败");
    res.status(500).json({ error: "人脸识别失败" });
  }
});

router.delete("/contacts/:biometricId", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { contactRecognitionService } = await import('../services/contact-recognition');
    const success = await contactRecognitionService.deleteBiometric(req.params.biometricId);
    
    if (success) {
      logger.info({ biometricId: req.params.biometricId }, "生物特征已删除");
      res.json({ success: true, message: "已删除该生物特征记录" });
    } else {
      res.status(400).json({ success: false, error: "删除失败" });
    }
  } catch (error) {
    logger.error({ error }, "删除生物特征失败");
    res.status(500).json({ error: "删除生物特征失败" });
  }
});

router.post("/contacts/refresh-cache", attachRole, requireMaster, async (_req: Request, res: Response) => {
  try {
    const { contactRecognitionService } = await import('../services/contact-recognition');
    await contactRecognitionService.refreshCache();
    
    logger.info("生物特征缓存已刷新");
    res.json({ success: true, message: "缓存已刷新" });
  } catch (error) {
    logger.error({ error }, "刷新缓存失败");
    res.status(500).json({ error: "刷新缓存失败" });
  }
});

logger.info("Biometric路由模块已加载");

export default router;
