/**
 * 声纹认证服务
 * 封装声纹录入、验证、授权管理业务逻辑
 */

import { createServiceLogger } from '../lib/logger';
import { userStorage } from '../storage/domains';
import type {
  Voiceprint,
  InsertVoiceprint,
  VoiceAuthorization,
  InsertVoiceAuthorization,
} from '@shared/schema';
import {
  processVoiceSample,
  generateSampleHash,
  mergeFeatureTemplates,
  verifyVoiceprint,
  checkVoiceAuthorization,
  type VoiceSample,
  type VerificationResult,
  type AuthorizationCheck,
  VOICEPRINT_CONFIG,
} from './voiceprint';
import { BusinessError, ErrorCode } from '../lib/errors';

const logger = createServiceLogger('VoiceAuthService');

export class VoiceAuthService {
  /**
   * 获取声纹状态
   */
  async getVoiceprintStatus(userId: string = 'MASTER'): Promise<{
    enrolled: boolean;
    sampleCount: number;
    sampleRequired: number;
    confidenceThreshold?: number;
    lastVerified?: Date;
    message: string;
  }> {
    const voiceprint = await userStorage.getMasterVoiceprint();
    if (!voiceprint) {
      return {
        enrolled: false,
        sampleCount: 0,
        sampleRequired: VOICEPRINT_CONFIG.sampleRequirement,
        message: '主人尚未录入声纹',
      };
    }
    
    const sampleCount = voiceprint.sampleCount ?? 0;
    const enrolled = sampleCount >= VOICEPRINT_CONFIG.sampleRequirement;
    
    return {
      enrolled,
      sampleCount,
      sampleRequired: VOICEPRINT_CONFIG.sampleRequirement,
      confidenceThreshold: voiceprint.confidenceThreshold ?? undefined,
      lastVerified: voiceprint.lastVerified ?? undefined,
      message: enrolled
        ? '声纹锁已激活'
        : `还需录入 ${VOICEPRINT_CONFIG.sampleRequirement - sampleCount} 次声纹样本`,
    };
  }

  /**
   * 录入声纹样本
   */
  async enrollVoiceprint(
    sample: VoiceSample,
    userId: string = 'MASTER'
  ): Promise<{
    success: boolean;
    enrolled: boolean;
    sampleCount: number;
    sampleRequired: number;
    message: string;
  }> {
    const features = processVoiceSample(sample);
    const sampleHash = generateSampleHash(sample);

    let voiceprint = await userStorage.getMasterVoiceprint();
    const existingFeatures: Array<number[] | unknown> = voiceprint?.featureVector ? [voiceprint.featureVector] : [];
    const existingHashes: string[] = voiceprint?.sampleHashes || [];

    if (existingHashes.includes(sampleHash)) {
      throw new BusinessError('该声纹样本已存在，请录入不同的语音', ErrorCode.CONFLICT, 400);
    }

    const featureVector = [
      features.mfcc,
      features.pitch / 500,
      features.energy,
      features.spectralCentroid / 10000,
      features.zeroCrossRate,
    ];
    existingFeatures.push(featureVector);
    existingHashes.push(sampleHash);

    const mergedTemplate = mergeFeatureTemplates(
      existingFeatures.map(f => Array.isArray(f) && f.length === 5 ? {
        mfcc: f[0] as number[],
        pitch: (f[1] as number) * 500,
        energy: f[2] as number,
        spectralCentroid: (f[3] as number) * 10000,
        zeroCrossRate: f[4] as number,
      } : {
        mfcc: new Array(13).fill(0),
        pitch: 150,
        energy: 0.1,
        spectralCentroid: 2000,
        zeroCrossRate: 0.1,
      })
    );

    if (voiceprint) {
      await userStorage.updateVoiceprint(userId, {
        featureVector: mergedTemplate,
        sampleHashes: existingHashes,
        sampleCount: existingHashes.length,
      });
    } else {
      await userStorage.createVoiceprint({
        userId,
        label: 'MASTER',
        featureVector: mergedTemplate,
        sampleHashes: existingHashes,
        sampleCount: 1,
        confidenceThreshold: VOICEPRINT_CONFIG.defaultThreshold,
      });
    }

    const sampleCount = existingHashes.length;
    const enrolled = sampleCount >= VOICEPRINT_CONFIG.sampleRequirement;

    return {
      success: true,
      enrolled,
      sampleCount,
      sampleRequired: VOICEPRINT_CONFIG.sampleRequirement,
      message: enrolled
        ? '声纹录入完成，声纹锁已激活！'
        : `已录入 ${sampleCount}/${VOICEPRINT_CONFIG.sampleRequirement} 次样本，请继续`,
    };
  }

  /**
   * 静默优化声纹
   */
  async refineVoiceprint(
    sample: VoiceSample,
    silent: boolean = true
  ): Promise<{
    refined: boolean;
    message: string;
    confidence?: number;
  }> {
    const voiceprint = await userStorage.getMasterVoiceprint();
    if (!voiceprint || !voiceprint.featureVector || (voiceprint.sampleCount || 0) < VOICEPRINT_CONFIG.sampleRequirement) {
      throw new BusinessError('请先完成声纹初始录入', ErrorCode.INVALID_STATE, 400);
    }

    const storedTemplate = voiceprint.featureVector as number[];
    const threshold = voiceprint.confidenceThreshold || VOICEPRINT_CONFIG.defaultThreshold;

    const verifyResult = verifyVoiceprint(sample, storedTemplate, threshold);

    if (!verifyResult.isMatch) {
      if (!silent) {
        logger.info('静默声纹优化: 声音不匹配主人，已忽略');
      }
      return {
        refined: false,
        message: '声音样本与主人声纹不匹配',
        confidence: verifyResult.confidence,
      };
    }

    const features = processVoiceSample(sample);

    const existingFeatures = [{
      mfcc: Array.isArray(storedTemplate[0]) ? storedTemplate[0] as number[] : [storedTemplate[0] as number],
      pitch: (storedTemplate[1] as number) * 500,
      energy: storedTemplate[2] as number,
      spectralCentroid: (storedTemplate[3] as number) * 10000,
      zeroCrossRate: storedTemplate[4] as number,
    }, features];

    const refinedTemplate = mergeFeatureTemplates(existingFeatures);

    await userStorage.updateVoiceprint('MASTER', {
      featureVector: refinedTemplate,
    });

    logger.info({ confidence: verifyResult.confidence.toFixed(3) }, '静默声纹优化成功');

    return {
      refined: true,
      message: '声纹已静默优化',
      confidence: verifyResult.confidence,
    };
  }

  /**
   * 验证声纹
   */
  async verifyVoiceprint(
    sample: VoiceSample,
    requestedAction?: string
  ): Promise<{
    verified: boolean;
    isMaster: boolean;
    confidence: number;
    message: string;
    requiresEnrollment: boolean;
    allowed: boolean;
    requiresAuth?: boolean;
  }> {
    const masterVoiceprint = await userStorage.getMasterVoiceprint();
    if (!masterVoiceprint || !masterVoiceprint.featureVector || (masterVoiceprint.sampleCount || 0) < VOICEPRINT_CONFIG.sampleRequirement) {
      return {
        verified: true,
        isMaster: true,
        confidence: 1,
        message: '声纹锁未激活，开放模式',
        requiresEnrollment: true,
        allowed: true,
      };
    }

    const storedTemplate = masterVoiceprint.featureVector as number[];
    const threshold = masterVoiceprint.confidenceThreshold || VOICEPRINT_CONFIG.defaultThreshold;

    const result = verifyVoiceprint(sample, storedTemplate, threshold);

    if (result.isMatch) {
      await userStorage.updateVoiceprint('MASTER', { lastVerified: new Date() });
      return {
        verified: true,
        isMaster: true,
        confidence: result.confidence,
        message: '主人声纹验证通过',
        requiresEnrollment: false,
        allowed: true,
      };
    }

    const authorizations = await userStorage.getVoiceAuthorizations();
    const authCheck = checkVoiceAuthorization(
      requestedAction || 'CHAT',
      'ACTION',
      authorizations.map(a => ({
        authType: a.authType,
        target: a.target,
        isActive: a.isActive ?? 1,
        expiresAt: a.expiresAt,
      }))
    );

    if (!authCheck.allowed) {
      return {
        verified: false,
        isMaster: false,
        confidence: result.confidence,
        message: '声纹不匹配，需要主人授权',
        requiresEnrollment: false,
        allowed: false,
        requiresAuth: true,
      };
    }

    return {
      verified: false,
      isMaster: false,
      confidence: result.confidence,
      message: authCheck.reason,
      requiresEnrollment: false,
      allowed: true,
    };
  }

  /**
   * 检查权限
   */
  async checkPermission(
    sample: VoiceSample,
    action?: string
  ): Promise<{
    allowed: boolean;
    isMaster: boolean;
    confidence: number;
    reason: string;
    requiresAuth: boolean;
  }> {
    const masterVoiceprint = await userStorage.getMasterVoiceprint();
    if (!masterVoiceprint || (masterVoiceprint.sampleCount || 0) < VOICEPRINT_CONFIG.sampleRequirement) {
      return {
        allowed: true,
        isMaster: true,
        confidence: 1,
        reason: '声纹锁未激活，开放模式',
        requiresAuth: false,
      };
    }

    const storedTemplate = masterVoiceprint.featureVector as number[];
    const threshold = masterVoiceprint.confidenceThreshold || VOICEPRINT_CONFIG.defaultThreshold;

    const verifyResult = verifyVoiceprint(sample, storedTemplate, threshold);

    if (verifyResult.isMatch) {
      await userStorage.updateVoiceprint('MASTER', { lastVerified: new Date() });
      return {
        allowed: true,
        isMaster: true,
        confidence: verifyResult.confidence,
        reason: '主人声纹验证通过',
        requiresAuth: false,
      };
    }

    const authorizations = await userStorage.getVoiceAuthorizations();
    const authCheck = checkVoiceAuthorization(
      action || 'CHAT',
      'ACTION',
      authorizations.map(a => ({
        authType: a.authType,
        target: a.target,
        isActive: a.isActive ?? 1,
        expiresAt: a.expiresAt,
      }))
    );

    return {
      allowed: authCheck.allowed,
      isMaster: false,
      confidence: verifyResult.confidence,
      reason: authCheck.reason,
      requiresAuth: !authCheck.allowed,
    };
  }

  /**
   * 获取授权列表
   */
  async getAuthorizations(): Promise<VoiceAuthorization[]> {
    return await userStorage.getVoiceAuthorizations();
  }

  /**
   * 创建授权
   */
  async createAuthorization(data: InsertVoiceAuthorization): Promise<VoiceAuthorization> {
    return await userStorage.createVoiceAuthorization(data);
  }

  /**
   * 撤销授权
   */
  async deactivateAuthorization(id: string): Promise<boolean> {
    return await userStorage.deactivateVoiceAuthorization(id);
  }

  /**
   * 获取主声纹
   */
  async getMasterVoiceprint(): Promise<Voiceprint | undefined> {
    return await userStorage.getMasterVoiceprint();
  }
}

// 导出全局实例
export const voiceAuthService = new VoiceAuthService();