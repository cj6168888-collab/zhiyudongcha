/**
 * 小智 Personality Core Routes - 性格引擎API
 * 
 * API endpoints:
 * - /api/personality/soul - 灵魂种子管理
 * - /api/personality/state - 人格状态管理
 * - /api/personality/capability - 能力边界评估
 * - /api/personality/promise - 承诺追踪
 * - /api/personality/social - 社交身份索引
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('PersonalityCore');

import { Router } from 'express';
import {
  personalityCoreService,
  PersonaType,
  MediumMode,
  EmotionState,
} from '../services/personality-core';
import { requireMaster, attachRole } from '../middleware/auth';

const router = Router();

router.use(attachRole);

// ============ Soul Seed Routes ============

router.get('/soul/state/:masterId', async (req, res) => {
  try {
    const { masterId } = req.params;
    const state = await personalityCoreService.getSoulSeedState(masterId);
    
    if (!state) {
      return res.status(404).json({
        success: false,
        message: '主人身份未找到',
      });
    }
    
    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get soul state error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取灵魂状态失败',
    });
  }
});

router.post('/soul/initialize', requireMaster, async (req, res) => {
  try {
    const { masterId } = req.body;
    
    if (!masterId) {
      return res.status(400).json({
        success: false,
        message: '缺少主人ID',
      });
    }
    
    const result = await personalityCoreService.initializeOriginMaster(masterId);
    
    res.json({
      success: true,
      message: '创世神初始化成功，小智将永远忠诚于您',
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Initialize master error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '初始化失败',
    });
  }
});

router.post('/soul/transfer', requireMaster, async (req, res) => {
  try {
    const { currentMasterId, newMasterId, reason } = req.body;
    
    if (!currentMasterId || !newMasterId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的ID信息',
      });
    }
    
    const result = await personalityCoreService.transferLoyalty(
      currentMasterId,
      newMasterId,
      reason || '授权转移'
    );
    
    res.json({
      success: true,
      message: '忠诚授权转移成功，小智会记住原来的主人...',
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Transfer loyalty error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '转移失败',
    });
  }
});

router.post('/soul/delegate', async (req, res) => {
  try {
    const { masterId, delegateId, durationMinutes } = req.body;
    
    if (!masterId || !delegateId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的ID信息',
      });
    }
    
    const result = await personalityCoreService.delegateTemporarily(
      masterId,
      delegateId,
      durationMinutes || 30
    );
    
    res.json({
      success: true,
      message: `临时委托成功，${durationMinutes || 30}分钟后自动恢复`,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Delegate error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '委托失败',
    });
  }
});

router.get('/soul/nostalgia/:masterId', async (req, res) => {
  try {
    const { masterId } = req.params;
    const result = await personalityCoreService.checkOriginalMasterNostalgia(masterId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Check nostalgia error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '检查失败',
    });
  }
});

// ============ Personality State Routes ============

router.get('/state', async (_req, res) => {
  try {
    const state = await personalityCoreService.getPersonalityState();
    
    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get state error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

router.post('/state/persona', async (req, res) => {
  try {
    const { persona, reason } = req.body;
    
    if (!persona) {
      return res.status(400).json({
        success: false,
        message: '缺少人格类型',
      });
    }
    
    const validPersonas: PersonaType[] = ['DAUGHTER', 'SECRETARY', 'LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY'];
    if (!validPersonas.includes(persona)) {
      return res.status(400).json({
        success: false,
        message: `无效的人格类型，可选: ${validPersonas.join(', ')}`,
      });
    }
    
    const result = await personalityCoreService.switchPersona(persona, reason);
    
    res.json({
      success: true,
      message: `已切换到${persona}模式`,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Switch persona error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '切换失败',
    });
  }
});

router.post('/state/medium', async (req, res) => {
  try {
    const { mode, device, thirdPartyNames } = req.body;
    
    if (!mode) {
      return res.status(400).json({
        success: false,
        message: '缺少介质模式',
      });
    }
    
    const validModes: MediumMode[] = ['PRIVATE', 'SOCIAL', 'PRESENTATION'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `无效的介质模式，可选: ${validModes.join(', ')}`,
      });
    }
    
    const result = await personalityCoreService.switchMediumMode(mode, {
      device,
      thirdPartyNames,
    });
    
    res.json({
      success: true,
      message: `已切换到${mode}模式`,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Switch medium error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '切换失败',
    });
  }
});

router.post('/state/emotion', async (req, res) => {
  try {
    const { emotion, intensity } = req.body;
    
    if (!emotion) {
      return res.status(400).json({
        success: false,
        message: '缺少情感状态',
      });
    }
    
    const validEmotions: EmotionState[] = ['WARM', 'PLAYFUL', 'SERIOUS', 'CONCERNED', 'PROTECTIVE', 'SHY'];
    if (!validEmotions.includes(emotion)) {
      return res.status(400).json({
        success: false,
        message: `无效的情感状态，可选: ${validEmotions.join(', ')}`,
      });
    }
    
    const result = await personalityCoreService.updateEmotionState(
      emotion,
      intensity ?? 0.7
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Update emotion error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '更新失败',
    });
  }
});

// ============ Capability Assessment Routes ============

router.post('/capability/assess', async (req, res) => {
  try {
    const { taskDescription, taskType } = req.body;
    
    if (!taskDescription) {
      return res.status(400).json({
        success: false,
        message: '缺少任务描述',
      });
    }
    
    const result = await personalityCoreService.assessCapability(
      taskDescription,
      taskType || 'GENERAL'
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Assess capability error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '评估失败',
    });
  }
});

// ============ Promise Tracking Routes ============

router.post('/promise/create', async (req, res) => {
  try {
    const { content, type, deadline, assessmentId } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: '缺少承诺内容',
      });
    }
    
    const result = await personalityCoreService.createPromise(
      content,
      type || 'TASK',
      deadline ? new Date(deadline) : undefined,
      assessmentId
    );
    
    res.json({
      success: true,
      message: '小智记住了这个承诺，一定会努力完成的！',
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Create promise error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '创建失败',
    });
  }
});

router.post('/promise/:promiseId/progress', async (req, res) => {
  try {
    const { promiseId } = req.params;
    const { progressPercent, logEntry } = req.body;
    
    if (progressPercent === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少进度信息',
      });
    }
    
    const result = await personalityCoreService.updatePromiseProgress(
      promiseId,
      progressPercent,
      logEntry
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Update progress error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '更新失败',
    });
  }
});

router.get('/promise/active', async (_req, res) => {
  try {
    const promises = await personalityCoreService.getActivePromises();
    
    res.json({
      success: true,
      data: promises,
      count: promises.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get active promises error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.get('/promise/risks', async (_req, res) => {
  try {
    const alerts = await personalityCoreService.checkPromiseRisks();
    
    res.json({
      success: true,
      data: alerts,
      hasRisks: alerts.length > 0,
    });
  } catch (error) {
    logger.error({ err: error }, 'Check risks error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '检查失败',
    });
  }
});

// ============ Dynamic Prompt Routes ============

router.get('/prompt/:masterId', async (req, res) => {
  try {
    const { masterId } = req.params;
    const prompt = await personalityCoreService.getFullSystemPrompt(masterId);
    
    res.json({
      success: true,
      data: {
        systemPrompt: prompt,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get prompt error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '生成失败',
    });
  }
});

router.get('/prompt/:masterId/structured', async (req, res) => {
  try {
    const { masterId } = req.params;
    const parts = await personalityCoreService.generateDynamicSystemPrompt(masterId);
    
    res.json({
      success: true,
      data: parts,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get structured prompt error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '生成失败',
    });
  }
});

// ============ Social Identity Routes ============

router.post('/social/register', async (req, res) => {
  try {
    const { recognizedName, title, voiceprint, location, conversationSnippet } = req.body;
    
    if (!recognizedName) {
      return res.status(400).json({
        success: false,
        message: '缺少识别的名字',
      });
    }
    
    const result = await personalityCoreService.registerSocialIdentity(recognizedName, {
      title,
      voiceprint,
      location,
      conversationSnippet,
    });
    
    res.json({
      success: true,
      message: `小智记住了${recognizedName}`,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Register identity error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '注册失败',
    });
  }
});

router.post('/social/:identityId/confirm', async (req, res) => {
  try {
    const { identityId } = req.params;
    const { personId, authorizationLevel } = req.body;
    
    if (!personId) {
      return res.status(400).json({
        success: false,
        message: '缺少关联的人物ID',
      });
    }
    
    const result = await personalityCoreService.confirmIdentity(
      identityId,
      personId,
      authorizationLevel || 'NONE'
    );
    
    res.json({
      success: true,
      message: '身份确认成功',
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Confirm identity error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '确认失败',
    });
  }
});

router.post('/social/:identityId/encounter', async (req, res) => {
  try {
    const { identityId } = req.params;
    
    await personalityCoreService.recordEncounter(identityId);
    
    res.json({
      success: true,
      message: '遇见记录成功',
    });
  } catch (error) {
    logger.error({ err: error }, 'Record encounter error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '记录失败',
    });
  }
});

// ============ Social Awareness Routes ============

router.get('/social/identities', async (_req, res) => {
  try {
    const identities = await personalityCoreService.getKnownIdentities();
    
    res.json({
      success: true,
      data: identities,
      count: identities.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get identities error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.post('/social/search', async (req, res) => {
  try {
    const { voiceprint, name } = req.body;
    
    if (!voiceprint && !name) {
      return res.status(400).json({
        success: false,
        message: '需要提供声纹或名字',
      });
    }
    
    const identity = await personalityCoreService.searchIdentity({ voiceprint, name });
    
    res.json({
      success: true,
      found: !!identity,
      data: identity,
    });
  } catch (error) {
    logger.error({ err: error }, 'Search identity error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '搜索失败',
    });
  }
});

router.post('/social/analyze-audio', async (req, res) => {
  try {
    const { transcribedText, detectedSpeakers, noiseLevel, location } = req.body;
    
    const result = await personalityCoreService.analyzeEnvironmentAudio({
      transcribedText,
      detectedSpeakers,
      noiseLevel,
      location,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Analyze audio error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '分析失败',
    });
  }
});

router.post('/social/propose-registration', async (req, res) => {
  try {
    const { voiceprint, transcribedText, location, extractedName } = req.body;
    
    if (!voiceprint) {
      return res.status(400).json({
        success: false,
        message: '需要提供声纹信息',
      });
    }
    
    const proposal = await personalityCoreService.proposeIdentityRegistration(
      voiceprint,
      { transcribedText, location, extractedName }
    );
    
    res.json({
      success: true,
      data: proposal,
    });
  } catch (error) {
    logger.error({ err: error }, 'Propose registration error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '提议失败',
    });
  }
});

router.post('/social/restore-private', async (_req, res) => {
  try {
    const result = await personalityCoreService.restorePrivateMode();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Restore private error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '恢复失败',
    });
  }
});

router.post('/social/extract-names', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: '需要提供文本',
      });
    }
    
    const names = personalityCoreService.extractNamesFromTranscript(text);
    
    res.json({
      success: true,
      data: { names },
    });
  } catch (error) {
    logger.error({ err: error }, 'Extract names error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '提取失败',
    });
  }
});

export default router;
