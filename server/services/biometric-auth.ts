/**
 * Biometric Authentication Service (生物特征认证) - Phase 1.4 持久化版本
 * 
 * 统一的生物特征认证模块：
 * 1. 面容识别 - 使用 Qwen-VL 双图比对（图片存储在客户端）
 * 2. 指纹识别 - 使用 Web Authentication API
 * 3. 声纹识别 - 使用现有 voiceprint 服务
 * 
 * Phase 1.4 增强：
 * - 数据库持久化存储
 * - 跨设备验证支持
 * - 余弦相似度阈值 0.85
 * - 验证失败锁定机制
 * 
 * 安全设计：
 * - 服务端不存储原始人脸图片
 * - 客户端加密存储参考图片
 * - 每次验证需同时传入参考图和新图进行比对
 */

import { faceCompareService, type FaceCompareResult, type FaceQualityResult } from './face-compare';
import { getDatabase } from '../db';
import { createServiceLogger } from '../lib/logger';

import { 
  biometricProfiles, 
  biometricVerificationLogs,
  type BiometricProfile as DBBiometricProfile,
  type InsertBiometricProfile,
  type InsertBiometricVerificationLog,
} from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

const logger = createServiceLogger('BiometricAuth');

export type BiometricType = 'FACE' | 'FINGERPRINT' | 'VOICE';

export interface BiometricProfile {
  userId: string;
  face?: FaceProfile;
  fingerprint?: FingerprintProfile;
  voice?: VoiceProfile;
  lastUpdated: string;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
}

export interface FaceProfile {
  enrolled: boolean;
  enrolledAt?: string;
  featureHash?: string;
  qualityScore: number;
  verificationCount: number;
  lastVerified?: string;
}

export interface FingerprintProfile {
  enrolled: boolean;
  enrolledAt?: string;
  credentialId?: string;
  publicKey?: string;
  attestationType?: string;
  verificationCount: number;
  lastVerified?: string;
}

export interface VoiceProfile {
  enrolled: boolean;
  enrolledAt?: string;
  sampleCount: number;
  confidenceThreshold: number;
  verificationCount: number;
  lastVerified?: string;
}

export interface BiometricEnrollResult {
  success: boolean;
  type: BiometricType;
  message: string;
  profile?: Partial<BiometricProfile>;
  enrollmentData?: {
    featureHash: string;
    qualityScore: number;
    storeOnClient: boolean;
  };
}

export interface BiometricVerifyResult {
  success: boolean;
  verified: boolean;
  type: BiometricType;
  confidence: number;
  message: string;
  details?: {
    similarityScore?: number;
    livenessWarning?: string;
    qualityIssues?: string[];
  };
}

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.85;

const memoryCache = new Map<string, BiometricProfile>();

class BiometricAuthService {
  constructor() {
    logger.info('[BiometricAuth] 生物特征认证服务已初始化 (Phase 1.4 持久化版)');
    logger.info('[BiometricAuth] 支持: 面容识别(Qwen-VL双图比对)、指纹识别、声纹识别');
    logger.info('[BiometricAuth] 数据库持久化: 已启用');
    logger.info('[BiometricAuth] 验证失败锁定: 5次失败锁定30分钟');
  }

  async getProfileFromDB(userId: string): Promise<DBBiometricProfile | null> {
    try {
      const result = await getDatabase().select().from(biometricProfiles).where(eq(biometricProfiles.userId, userId)).limit(1);
      return result[0] || null;
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] DB read error');
      return null;
    }
  }

  async createProfileInDB(userId: string): Promise<DBBiometricProfile | null> {
    try {
      const result = await getDatabase().insert(biometricProfiles).values({
        userId,
        securityLevel: 'LOW',
      }).returning();
      return result[0] || null;
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] DB create error');
      return null;
    }
  }

  async getOrCreateProfile(userId: string): Promise<DBBiometricProfile | null> {
    let profile = await this.getProfileFromDB(userId);
    if (!profile) {
      profile = await this.createProfileInDB(userId);
    }
    return profile;
  }

  async isAccountLocked(userId: string): Promise<{ locked: boolean; remainingMs?: number }> {
    const profile = await this.getProfileFromDB(userId);
    if (!profile || !profile.lockedUntil) {
      return { locked: false };
    }
    
    const now = new Date();
    const lockExpiry = new Date(profile.lockedUntil);
    
    if (now < lockExpiry) {
      return { locked: true, remainingMs: lockExpiry.getTime() - now.getTime() };
    }
    
    await getDatabase().update(biometricProfiles)
      .set({ lockedUntil: null, failedAttemptCount: 0 })
      .where(eq(biometricProfiles.userId, userId));
    
    return { locked: false };
  }

  async recordVerificationAttempt(
    userId: string,
    type: BiometricType,
    success: boolean,
    confidenceScore: number,
    details?: { deviceId?: string; ipAddress?: string; failureReason?: string; livenessCheckPassed?: boolean; spoofingDetected?: boolean }
  ): Promise<void> {
    try {
      await getDatabase().insert(biometricVerificationLogs).values({
        userId,
        verificationType: type,
        success,
        confidenceScore,
        similarityScore: confidenceScore,
        failureReason: details?.failureReason,
        deviceId: details?.deviceId,
        ipAddress: details?.ipAddress,
        livenessCheckPassed: details?.livenessCheckPassed,
        spoofingDetected: details?.spoofingDetected || false,
      });

      if (success) {
        await getDatabase().update(biometricProfiles)
          .set({
            failedAttemptCount: 0,
            successfulVerifications: sql`${biometricProfiles.successfulVerifications} + 1`,
            totalVerificationCount: sql`${biometricProfiles.totalVerificationCount} + 1`,
            lastVerifiedAt: new Date(),
            lastVerificationType: type,
            updatedAt: new Date(),
          })
          .where(eq(biometricProfiles.userId, userId));
      } else {
        const profile = await this.getProfileFromDB(userId);
        const newFailedCount = (profile?.failedAttemptCount || 0) + 1;
        
        const updates: Record<string, any> = {
          failedAttemptCount: newFailedCount,
          failedVerifications: sql`${biometricProfiles.failedVerifications} + 1`,
          totalVerificationCount: sql`${biometricProfiles.totalVerificationCount} + 1`,
          updatedAt: new Date(),
        };

        if (newFailedCount >= LOCK_THRESHOLD) {
          updates.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          logger.info({ userId, lockedUntil: updates.lockedUntil }, '账户已锁定');
        }

        await getDatabase().update(biometricProfiles)
          .set(updates)
          .where(eq(biometricProfiles.userId, userId));
      }
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Record verification error');
    }
  }

  getProfile(userId: string): BiometricProfile {
    if (!memoryCache.has(userId)) {
      memoryCache.set(userId, {
        userId,
        lastUpdated: new Date().toISOString(),
        securityLevel: 'LOW'
      });
    }
    return memoryCache.get(userId)!;
  }

  calculateSecurityLevel(profile: BiometricProfile): 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM' {
    let enrolledCount = 0;
    if (profile.face?.enrolled) enrolledCount++;
    if (profile.fingerprint?.enrolled) enrolledCount++;
    if (profile.voice?.enrolled) enrolledCount++;

    if (enrolledCount === 0) return 'LOW';
    if (enrolledCount === 1) return 'MEDIUM';
    if (enrolledCount === 2) return 'HIGH';
    return 'MAXIMUM';
  }

  /**
   * 面容录入 - 验证图片质量，持久化到数据库
   * 客户端需要自行安全存储参考图片
   */
  async enrollFace(userId: string, imageBase64: string, deviceId?: string): Promise<BiometricEnrollResult> {
    try {
      const qualityResult = await faceCompareService.checkFaceQuality(imageBase64);
      
      if (!qualityResult.success) {
        return {
          success: false,
          type: 'FACE',
          message: '面容检测失败：' + qualityResult.issues.join('、')
        };
      }

      if (!qualityResult.hasFace) {
        return {
          success: false,
          type: 'FACE',
          message: '未检测到人脸，请确保人脸清晰可见'
        };
      }

      if (qualityResult.quality === 'LOW') {
        return {
          success: false,
          type: 'FACE',
          message: '图片质量过低：' + qualityResult.issues.join('、') + 
                   '。建议：' + qualityResult.suggestions.join('、')
        };
      }

      const featureHash = faceCompareService.generateSecureHash(imageBase64);
      const qualityScore = qualityResult.quality === 'HIGH' ? 0.95 : 0.75;

      let dbProfile = await this.getOrCreateProfile(userId);
      
      if (dbProfile) {
        const currentDevices = dbProfile.enrolledDevices || [];
        const updatedDevices = deviceId && !currentDevices.includes(deviceId) 
          ? [...currentDevices, deviceId] 
          : currentDevices;

        await getDatabase().update(biometricProfiles)
          .set({
            faceFeatureHash: featureHash,
            faceQualityScore: qualityScore,
            faceEnrolledAt: new Date(),
            faceSampleCount: (dbProfile.faceSampleCount || 0) + 1,
            securityLevel: this.calculateDBSecurityLevel(true, !!dbProfile.voiceEnrolledAt, !!dbProfile.fingerprintEnrolledAt),
            enrolledDevices: updatedDevices,
            updatedAt: new Date(),
          })
          .where(eq(biometricProfiles.userId, userId));
      }

      const profile = this.getProfile(userId);
      profile.face = {
        enrolled: true,
        enrolledAt: new Date().toISOString(),
        featureHash,
        qualityScore: qualityScore * 100,
        verificationCount: 0
      };
      profile.securityLevel = this.calculateSecurityLevel(profile);
      profile.lastUpdated = new Date().toISOString();

      logger.info({ userId, quality: qualityResult.quality }, '面容录入成功');

      return {
        success: true,
        type: 'FACE',
        message: '面容录入成功！数据已安全存储，支持跨设备验证。',
        profile: {
          face: profile.face,
          securityLevel: profile.securityLevel
        },
        enrollmentData: {
          featureHash,
          qualityScore: qualityScore * 100,
          storeOnClient: true
        }
      };
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Face enrollment error');
      return {
        success: false,
        type: 'FACE',
        message: '面容录入失败'
      };
    }
  }

  calculateDBSecurityLevel(hasFace: boolean, hasVoice: boolean, hasFingerprint: boolean): string {
    let count = 0;
    if (hasFace) count++;
    if (hasVoice) count++;
    if (hasFingerprint) count++;
    
    if (count === 0) return 'LOW';
    if (count === 1) return 'MEDIUM';
    if (count === 2) return 'HIGH';
    return 'MAXIMUM';
  }

  /**
   * 面容验证 - 比对参考图和新捕获的图片 (Phase 1.4 增强版)
   * 需要同时传入客户端存储的参考图和新图
   * 支持跨设备验证、锁定机制
   */
  async verifyFace(
    userId: string, 
    referenceImage: string, 
    capturedImage: string,
    deviceId?: string
  ): Promise<BiometricVerifyResult> {
    const lockStatus = await this.isAccountLocked(userId);
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil((lockStatus.remainingMs || 0) / 60000);
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: `账户已锁定，请在 ${remainingMinutes} 分钟后重试`
      };
    }

    const dbProfile = await this.getProfileFromDB(userId);
    
    if (!dbProfile?.faceFeatureHash) {
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '未录入面容信息，请先进行面容录入'
      };
    }

    const referenceHash = faceCompareService.generateSecureHash(referenceImage);
    if (referenceHash !== dbProfile.faceFeatureHash) {
      await this.recordVerificationAttempt(userId, 'FACE', false, 0, {
        deviceId,
        failureReason: 'reference_mismatch'
      });
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '参考图片不匹配，请使用录入时的原始照片'
      };
    }

    try {
      const compareResult = await faceCompareService.compareFaces(referenceImage, capturedImage);
      
      if (!compareResult.success) {
        await this.recordVerificationAttempt(userId, 'FACE', false, 0, {
          deviceId,
          failureReason: 'compare_failed'
        });
        return {
          success: false,
          verified: false,
          type: 'FACE',
          confidence: 0,
          message: '面容比对失败：' + (compareResult.error || '未知错误')
        };
      }

      const similarityScore = compareResult.similarityScore / 100;
      const verified = compareResult.isSamePerson && similarityScore >= SIMILARITY_THRESHOLD;

      await this.recordVerificationAttempt(userId, 'FACE', verified, similarityScore, {
        deviceId,
        failureReason: verified ? undefined : 'low_similarity',
        livenessCheckPassed: !compareResult.analysis.livenessWarning,
        spoofingDetected: !!compareResult.analysis.livenessWarning,
      });

      logger.info({
        userId,
        isSamePerson: compareResult.isSamePerson,
        confidence: compareResult.confidence,
        similarityScore: compareResult.similarityScore,
        threshold: SIMILARITY_THRESHOLD * 100
      }, '面容验证完成');

      return {
        success: true,
        verified,
        type: 'FACE',
        confidence: compareResult.confidence,
        message: verified 
          ? '面容验证通过，欢迎回来爸爸～' 
          : `面容验证失败，相似度: ${compareResult.similarityScore}% (需要 ${SIMILARITY_THRESHOLD * 100}%)`,
        details: {
          similarityScore: compareResult.similarityScore,
          livenessWarning: compareResult.analysis.livenessWarning,
          qualityIssues: []
        }
      };
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Face verify error');
      await this.recordVerificationAttempt(userId, 'FACE', false, 0, {
        deviceId,
        failureReason: 'exception'
      });
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '面容验证出错'
      };
    }
  }

  /**
   * 单图面容验证（简化版）- 仅检查图片质量
   * 用于无参考图时的基本验证
   */
  async verifyFaceSimple(userId: string, imageBase64: string): Promise<BiometricVerifyResult> {
    const profile = this.getProfile(userId);
    
    if (!profile.face?.enrolled) {
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '未录入面容信息，请先进行面容录入'
      };
    }

    try {
      const qualityResult = await faceCompareService.checkFaceQuality(imageBase64);
      
      if (!qualityResult.success || !qualityResult.hasFace) {
        return {
          success: false,
          verified: false,
          type: 'FACE',
          confidence: 0,
          message: '未检测到有效人脸'
        };
      }

      return {
        success: true,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '请同时提供录入时的参考照片进行1:1比对验证',
        details: {
          qualityIssues: qualityResult.issues
        }
      };
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Face simple verify error');
      return {
        success: false,
        verified: false,
        type: 'FACE',
        confidence: 0,
        message: '面容检测出错'
      };
    }
  }

  async enrollFingerprint(
    userId: string, 
    credentialId: string, 
    publicKey: string,
    attestationType: string = 'none'
  ): Promise<BiometricEnrollResult> {
    try {
      const profile = this.getProfile(userId);
      profile.fingerprint = {
        enrolled: true,
        enrolledAt: new Date().toISOString(),
        credentialId,
        publicKey,
        attestationType,
        verificationCount: 0
      };
      profile.securityLevel = this.calculateSecurityLevel(profile);
      profile.lastUpdated = new Date().toISOString();

      logger.info({ value: userId }, '[BiometricAuth] 指纹录入成功');

      return {
        success: true,
        type: 'FINGERPRINT',
        message: '指纹录入成功，生物锁已激活～',
        profile: {
          fingerprint: profile.fingerprint,
          securityLevel: profile.securityLevel
        }
      };
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Fingerprint enrollment error');
      return {
        success: false,
        type: 'FINGERPRINT',
        message: '指纹录入失败'
      };
    }
  }

  async enrollVoice(userId: string, sampleCount: number, confidenceThreshold: number): Promise<BiometricEnrollResult> {
    try {
      const profile = this.getProfile(userId);
      profile.voice = {
        enrolled: sampleCount >= 3,
        enrolledAt: new Date().toISOString(),
        sampleCount,
        confidenceThreshold,
        verificationCount: 0
      };
      profile.securityLevel = this.calculateSecurityLevel(profile);
      profile.lastUpdated = new Date().toISOString();

      logger.info({ value: userId, sampleCount }, '[BiometricAuth] 声纹状态更新');

      return {
        success: true,
        type: 'VOICE',
        message: sampleCount >= 3 ? '声纹录入成功，声纹锁已激活～' : `还需录入 ${3 - sampleCount} 次声纹样本`,
        profile: {
          voice: profile.voice,
          securityLevel: profile.securityLevel
        }
      };
    } catch (error) {
      logger.error({ err: error }, '[BiometricAuth] Voice enrollment error');
      return {
        success: false,
        type: 'VOICE',
        message: '声纹录入失败'
      };
    }
  }

  getSecurityStatus(userId: string): {
    securityLevel: string;
    enrolledMethods: BiometricType[];
    recommendations: string[];
  } {
    const profile = this.getProfile(userId);
    const enrolled: BiometricType[] = [];
    const recommendations: string[] = [];

    if (profile.face?.enrolled) {
      enrolled.push('FACE');
    } else {
      recommendations.push('录入面容以启用面容解锁');
    }

    if (profile.fingerprint?.enrolled) {
      enrolled.push('FINGERPRINT');
    } else {
      recommendations.push('录入指纹以启用快速解锁');
    }

    if (profile.voice?.enrolled) {
      enrolled.push('VOICE');
    } else {
      recommendations.push('录入声纹以启用语音解锁');
    }

    return {
      securityLevel: profile.securityLevel,
      enrolledMethods: enrolled,
      recommendations
    };
  }

  async getSecurityStatusFromDB(userId: string): Promise<{
    securityLevel: string;
    enrolledMethods: BiometricType[];
    recommendations: string[];
    verificationStats: {
      total: number;
      successful: number;
      failed: number;
      lastVerified?: Date;
    };
    lockStatus: { locked: boolean; remainingMs?: number };
  }> {
    const dbProfile = await this.getProfileFromDB(userId);
    const lockStatus = await this.isAccountLocked(userId);
    
    const enrolled: BiometricType[] = [];
    const recommendations: string[] = [];

    if (dbProfile?.faceEnrolledAt) {
      enrolled.push('FACE');
    } else {
      recommendations.push('录入面容以启用面容解锁');
    }

    if (dbProfile?.fingerprintEnrolledAt) {
      enrolled.push('FINGERPRINT');
    } else {
      recommendations.push('录入指纹以启用快速解锁');
    }

    if (dbProfile?.voiceEnrolledAt) {
      enrolled.push('VOICE');
    } else {
      recommendations.push('录入声纹以启用语音解锁');
    }

    return {
      securityLevel: dbProfile?.securityLevel || 'LOW',
      enrolledMethods: enrolled,
      recommendations,
      verificationStats: {
        total: dbProfile?.totalVerificationCount || 0,
        successful: dbProfile?.successfulVerifications || 0,
        failed: dbProfile?.failedVerifications || 0,
        lastVerified: dbProfile?.lastVerifiedAt || undefined,
      },
      lockStatus,
    };
  }

  async getVerificationLogs(userId: string, limit: number = 20): Promise<Array<{
    id: string;
    biometricType: string;
    success: boolean;
    similarity: number | null;
    deviceId: string | null;
    failureReason: string | null;
    createdAt: Date;
  }>> {
    const logs = await db
      .select()
      .from(biometricVerificationLogs)
      .where(eq(biometricVerificationLogs.userId, userId))
      .orderBy(desc(biometricVerificationLogs.createdAt))
      .limit(limit);

    return logs.map(log => ({
      id: log.id,
      biometricType: log.verificationType,
      success: log.success,
      similarity: log.similarityScore ?? null,
      deviceId: log.deviceId,
      failureReason: log.failureReason,
      createdAt: log.createdAt ?? new Date(),
    }));
  }

  async unlockAccount(userId: string): Promise<void> {
    await db
      .update(biometricProfiles)
      .set({
        failedAttemptCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(biometricProfiles.userId, userId));

    logger.info(`[BiometricAuth] 账户已手动解锁: ${userId}`);
  }
}

export const biometricAuthService = new BiometricAuthService();
