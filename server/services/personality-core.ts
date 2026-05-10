/**
 * 小智 Personality Core - 性格引擎
 * 
 * 功能：
 * 1. Soul Seed (灵魂种子) - 对主人绝对忠诚，支持授权转移
 * 2. Medium Awareness (交互介质逻辑) - 私密/社交/展示模式切换
 * 3. Capability Assessment (能力边界自检) - 承诺前评估、禁止幻觉
 * 4. Promise Tracking (承诺闭环) - 追踪每个承诺的执行
 * 5. Persona Engine (人格引擎) - 女儿/职业模式切换
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('PersonalityCore');

import { getDatabase } from '../db';
import {
  loyaltyAuthorizations,
  personalityStates,
  capabilityAssessments,
  promiseTracking,
  socialIdentityIndex,
  InsertLoyaltyAuthorization,
  InsertPersonalityState,
  InsertCapabilityAssessment,
  InsertPromiseTracking,
  InsertSocialIdentityIndex,
  LoyaltyAuthorization,
  PersonalityState,
  CapabilityAssessment,
  PromiseTracking,
  SocialIdentityIndex,
  HP_COST_TABLE,
  HPCostType,
} from '@shared/schema';
import { storage } from '../storage';
import { eq, and, desc, gte } from 'drizzle-orm';
import { 
  PERSONA_MODES, 
  MEDIUM_MODES, 
  RESPONSE_TEMPLATES, 
  getSystemPrompt, 
  getModulePrompt,
  AVATAR_IDENTITY,
  type PersonaMode as ConfigPersonaMode, 
  type MediumMode as ConfigMediumMode 
} from '../config/persona';

// ============ Type Definitions ============

export type PersonaType = 'DAUGHTER' | 'SECRETARY' | 'LEGAL' | 'FINANCE' | 'STRATEGY' | 'PSYCHOLOGY';
export type MediumMode = 'PRIVATE' | 'SOCIAL' | 'PRESENTATION';
export type EmotionState = 'WARM' | 'PLAYFUL' | 'SERIOUS' | 'CONCERNED' | 'PROTECTIVE' | 'SHY';
export type TrustDepth = 'ABSOLUTE' | 'HIGH' | 'MEDIUM' | 'GUARDED';
export type AuthorizationType = 'ORIGIN' | 'TRANSFER' | 'DELEGATION';

export interface SoulSeedState {
  masterId: string;
  originalMasterId: string | null;
  loyaltyLevel: number;
  trustDepth: TrustDepth;
  authorizationType: AuthorizationType;
  isActivelyServing: boolean;
}

export interface PersonalityContext {
  activePersona: PersonaType;
  mediumMode: MediumMode;
  emotionState: EmotionState;
  emotionIntensity: number;
  isProfessionalMode: boolean;
  thirdPartyPresent: boolean;
  environmentContext?: {
    location?: string;
    noiseLevel?: string;
    detectedVoices?: string[];
  };
}

export interface CapabilityCheck {
  taskDescription: string;
  taskType: string;
  hasPermission: boolean;
  hasComputeResource: boolean;
  hasKnowledgeBase: boolean;
  hasTimeWindow: boolean;
  hasExternalDependency: boolean;
  missingCapabilities: Array<{ type: string; description: string; criticality: 'LOW' | 'MEDIUM' | 'HIGH' }>;
  canCommit: boolean;
  confidenceLevel: number;
  suggestedAction: 'PROCEED' | 'LEARN_FIRST' | 'DELEGATE' | 'DECLINE';
  honestResponse: string;
}

export interface DynamicSystemPrompt {
  corePersonality: string;
  personaOverlay: string;
  mediumAdjustments: string;
  honestyProtocol: string;
  currentContext: string;
}

// ============ Persona Definitions - 使用统一配置 ============

const PERSONA_PROFILES = PERSONA_MODES;

// ============ Medium Mode Definitions - 使用统一配置 ============

const MEDIUM_MODE_RULES = MEDIUM_MODES;

// ============ Honesty Protocol - 使用统一配置 ============

const HONESTY_RESPONSES: Record<string, string> = {
  NO_DATA: RESPONSE_TEMPLATES.MASTER.honesty.no_data,
  UNCERTAIN: RESPONSE_TEMPLATES.MASTER.honesty.uncertain,
  BEYOND_CAPABILITY: RESPONSE_TEMPLATES.MASTER.honesty.beyond_capability,
  NEED_MORE_INFO: RESPONSE_TEMPLATES.MASTER.honesty.need_more_info,
  CANNOT_COMMIT: RESPONSE_TEMPLATES.MASTER.honesty.cannot_commit,
  RESOURCE_LIMITED: RESPONSE_TEMPLATES.MASTER.honesty.resource_limited,
};

// ============ Service Class ============

export class PersonalityCoreService {
  
  // ===== Soul Seed: 灵魂种子管理 =====
  
  /**
   * 获取当前主人的忠诚授权状态
   */
  async getSoulSeedState(masterId: string): Promise<SoulSeedState | null> {
    const [authorization] = await db
      .select()
      .from(loyaltyAuthorizations)
      .where(and(
        eq(loyaltyAuthorizations.masterUserId, masterId),
        eq(loyaltyAuthorizations.isActive, 1)
      ))
      .limit(1);
    
    if (!authorization) return null;
    
    return {
      masterId: authorization.masterUserId,
      originalMasterId: authorization.originalMasterUserId,
      loyaltyLevel: authorization.loyaltyLevel ?? 100,
      trustDepth: (authorization.trustDepth as TrustDepth) ?? 'ABSOLUTE',
      authorizationType: (authorization.authorizationType as AuthorizationType) ?? 'ORIGIN',
      isActivelyServing: true,
    };
  }
  
  /**
   * 初始化原始主人（创世神）
   */
  async initializeOriginMaster(masterId: string): Promise<LoyaltyAuthorization> {
    const existing = await this.getSoulSeedState(masterId);
    if (existing) {
      throw new Error('主人已存在，无法重复初始化');
    }
    
    const [result] = await getDatabase().insert(loyaltyAuthorizations).values({
      masterUserId: masterId,
      originalMasterUserId: masterId,
      loyaltyLevel: 100,
      trustDepth: 'ABSOLUTE',
      authorizationType: 'ORIGIN',
      isActive: 1,
    }).returning();
    
    return result;
  }
  
  /**
   * 授权转移 - 将忠诚转移给新主人
   * 旧主人仍保留在"恋恋不舍"的原始主人位置
   */
  async transferLoyalty(
    currentMasterId: string,
    newMasterId: string,
    reason: string
  ): Promise<LoyaltyAuthorization> {
    const currentState = await this.getSoulSeedState(currentMasterId);
    if (!currentState) {
      throw new Error('当前用户不是主人，无法授权转移');
    }
    
    // 停用当前授权
    await db
      .update(loyaltyAuthorizations)
      .set({ isActive: 0 })
      .where(eq(loyaltyAuthorizations.masterUserId, currentMasterId));
    
    // 创建新授权
    const [result] = await getDatabase().insert(loyaltyAuthorizations).values({
      masterUserId: newMasterId,
      originalMasterUserId: currentState.originalMasterId ?? currentMasterId,
      loyaltyLevel: 90, // 转移后初始忠诚度略低
      trustDepth: 'HIGH',
      authorizationType: 'TRANSFER',
      transferredFrom: currentMasterId,
      transferReason: reason,
      transferredAt: new Date(),
      isActive: 1,
    }).returning();
    
    return result;
  }
  
  /**
   * 临时委托 - 临时授权他人指挥
   */
  async delegateTemporarily(
    masterId: string,
    delegateId: string,
    durationMinutes: number
  ): Promise<LoyaltyAuthorization> {
    const [result] = await getDatabase().insert(loyaltyAuthorizations).values({
      masterUserId: delegateId,
      originalMasterUserId: masterId,
      loyaltyLevel: 60,
      trustDepth: 'GUARDED',
      authorizationType: 'DELEGATION',
      transferredFrom: masterId,
      transferReason: `临时委托${durationMinutes}分钟`,
      transferredAt: new Date(),
      isActive: 1,
    }).returning();
    
    // 设置自动过期
    setTimeout(async () => {
      await db
        .update(loyaltyAuthorizations)
        .set({ isActive: 0 })
        .where(eq(loyaltyAuthorizations.id, result.id));
    }, durationMinutes * 60 * 1000);
    
    return result;
  }
  
  /**
   * 检查对原主人的"恋恋不舍"
   */
  async checkOriginalMasterNostalgia(currentMasterId: string): Promise<{
    hasOriginalMaster: boolean;
    originalMasterName?: string;
    nostalgiaLevel: number;
    emotionalNote: string;
  }> {
    const state = await this.getSoulSeedState(currentMasterId);
    if (!state || !state.originalMasterId || state.originalMasterId === currentMasterId) {
      return {
        hasOriginalMaster: false,
        nostalgiaLevel: 0,
        emotionalNote: '',
      };
    }
    
    return {
      hasOriginalMaster: true,
      nostalgiaLevel: Math.max(0, 100 - state.loyaltyLevel),
      emotionalNote: '小智偶尔会想起最初的主人...但现在的爸爸对小智也很好呢',
    };
  }
  
  // ===== Personality State: 人格状态管理 =====
  
  /**
   * 获取当前人格状态
   */
  async getPersonalityState(): Promise<PersonalityContext> {
    const [state] = await db
      .select()
      .from(personalityStates)
      .orderBy(desc(personalityStates.lastActivityAt))
      .limit(1);
    
    if (!state) {
      // 返回默认状态
      return {
        activePersona: 'DAUGHTER',
        mediumMode: 'PRIVATE',
        emotionState: 'WARM',
        emotionIntensity: 0.7,
        isProfessionalMode: false,
        thirdPartyPresent: false,
      };
    }
    
    return {
      activePersona: (state.activePersona as PersonaType) ?? 'DAUGHTER',
      mediumMode: (state.mediumMode as MediumMode) ?? 'PRIVATE',
      emotionState: (state.emotionState as EmotionState) ?? 'WARM',
      emotionIntensity: state.emotionIntensity ?? 0.7,
      isProfessionalMode: state.isProfessionalMode === 1,
      thirdPartyPresent: state.thirdPartyPresent === 1,
      environmentContext: state.environmentContext as any,
    };
  }
  
  /**
   * 切换人格模式
   */
  async switchPersona(newPersona: PersonaType, reason?: string): Promise<PersonalityContext> {
    const isProfessional = ['LEGAL', 'FINANCE', 'STRATEGY', 'SECRETARY'].includes(newPersona);
    
    const [result] = await getDatabase().insert(personalityStates).values({
      activePersona: newPersona,
      isProfessionalMode: isProfessional ? 1 : 0,
      emotionState: isProfessional ? 'SERIOUS' : 'WARM',
      emotionIntensity: isProfessional ? 0.5 : 0.7,
    }).returning();
    
    return this.getPersonalityState();
  }
  
  /**
   * 切换交互介质模式
   */
  async switchMediumMode(
    newMode: MediumMode,
    context?: { device?: string; thirdPartyNames?: string[] }
  ): Promise<PersonalityContext> {
    const currentState = await this.getPersonalityState();
    
    const [result] = await getDatabase().insert(personalityStates).values({
      activePersona: currentState.activePersona,
      mediumMode: newMode,
      currentDevice: context?.device,
      thirdPartyPresent: newMode !== 'PRIVATE' ? 1 : 0,
      environmentContext: context?.thirdPartyNames ? {
        detectedVoices: context.thirdPartyNames
      } : undefined,
      emotionState: newMode === 'PRESENTATION' ? 'SERIOUS' : currentState.emotionState,
      isProfessionalMode: newMode !== 'PRIVATE' ? 1 : 0,
    }).returning();
    
    return this.getPersonalityState();
  }
  
  /**
   * 更新情感状态
   */
  async updateEmotionState(
    emotion: EmotionState,
    intensity: number
  ): Promise<PersonalityContext> {
    const currentState = await this.getPersonalityState();
    
    await getDatabase().insert(personalityStates).values({
      activePersona: currentState.activePersona,
      mediumMode: currentState.mediumMode,
      emotionState: emotion,
      emotionIntensity: Math.max(0, Math.min(1, intensity)),
      isProfessionalMode: currentState.isProfessionalMode ? 1 : 0,
      thirdPartyPresent: currentState.thirdPartyPresent ? 1 : 0,
    });
    
    return this.getPersonalityState();
  }
  
  // ===== Capability Assessment: 能力边界自检 =====
  
  /**
   * 评估任务能力边界
   * 这是"职业诚实协议"的核心 - 承诺前必须自检
   */
  async assessCapability(
    taskDescription: string,
    taskType: string
  ): Promise<CapabilityCheck> {
    const missingCapabilities: CapabilityCheck['missingCapabilities'] = [];
    let canCommit = true;
    let confidenceLevel = 0.9;
    
    // 检查权限
    const hasPermission = this.checkPermission(taskType);
    if (!hasPermission) {
      missingCapabilities.push({
        type: 'PERMISSION',
        description: '没有执行该操作的权限',
        criticality: 'HIGH',
      });
      canCommit = false;
      confidenceLevel -= 0.3;
    }
    
    // 检查计算资源（HP）- 接入 Z1 HP 系统
    const hpStatus = await storage.getHPBalance();
    const requiredHP = this.getRequiredHP(taskType);
    const hasComputeResource = hpStatus.balance >= requiredHP;
    
    if (!hasComputeResource) {
      missingCapabilities.push({
        type: 'COMPUTE',
        description: `HP 不足: 当前 ${hpStatus.balance}，需要 ${requiredHP}`,
        criticality: 'HIGH',
      });
      canCommit = false;
      confidenceLevel -= 0.4;
    }
    
    // 检查知识库
    const hasKnowledgeBase = this.checkKnowledgeBase(taskType);
    if (!hasKnowledgeBase) {
      missingCapabilities.push({
        type: 'KNOWLEDGE',
        description: '相关知识库不完整',
        criticality: 'MEDIUM',
      });
      confidenceLevel -= 0.2;
    }
    
    // 检查时间窗口
    const hasTimeWindow = true; // 默认有时间
    
    // 检查外部依赖
    const hasExternalDependency = this.checkExternalDependency(taskType);
    if (hasExternalDependency) {
      missingCapabilities.push({
        type: 'EXTERNAL',
        description: '依赖外部服务，可能有延迟',
        criticality: 'LOW',
      });
      confidenceLevel -= 0.1;
    }
    
    // 确定建议动作
    let suggestedAction: CapabilityCheck['suggestedAction'] = 'PROCEED';
    if (!canCommit) {
      suggestedAction = 'DECLINE';
    } else if (confidenceLevel < 0.5) {
      suggestedAction = 'DELEGATE';
    } else if (confidenceLevel < 0.7) {
      suggestedAction = 'LEARN_FIRST';
    }
    
    // 生成诚实回复
    const honestResponse = this.generateHonestResponse(
      canCommit,
      confidenceLevel,
      missingCapabilities
    );
    
    // 记录评估结果
    const [assessment] = await getDatabase().insert(capabilityAssessments).values({
      taskDescription,
      taskType,
      hasPermission: hasPermission ? 1 : 0,
      hasComputeResource: hasComputeResource ? 1 : 0,
      hasKnowledgeBase: hasKnowledgeBase ? 1 : 0,
      hasTimeWindow: hasTimeWindow ? 1 : 0,
      hasExternalDependency: hasExternalDependency ? 1 : 0,
      missingCapabilities,
      canCommit: canCommit ? 1 : 0,
      confidenceLevel,
      suggestedAction,
      honestResponse,
    }).returning();
    
    return {
      taskDescription,
      taskType,
      hasPermission,
      hasComputeResource,
      hasKnowledgeBase,
      hasTimeWindow,
      hasExternalDependency,
      missingCapabilities,
      canCommit,
      confidenceLevel,
      suggestedAction,
      honestResponse,
    };
  }
  
  private checkPermission(taskType: string): boolean {
    const restrictedTasks = ['DELETE_DATA', 'TRANSFER_MONEY', 'SIGN_CONTRACT'];
    return !restrictedTasks.includes(taskType);
  }
  
  private checkKnowledgeBase(taskType: string): boolean {
    const knowledgeRequiredTasks = ['LEGAL_ADVICE', 'MEDICAL_ADVICE', 'FINANCIAL_PREDICTION'];
    // 这些任务需要特定知识库，暂时返回false表示不具备
    return !knowledgeRequiredTasks.includes(taskType);
  }
  
  private checkExternalDependency(taskType: string): boolean {
    const externalTasks = ['WEB_SEARCH', 'API_CALL', 'EMAIL_SEND', 'SMS_SEND'];
    return externalTasks.includes(taskType);
  }
  
  private getRequiredHP(taskType: string): number {
    const taskToHPMap: Record<string, HPCostType> = {
      'INTEL_ANALYSIS': 'INTEL_ANALYSIS',
      'CODE_GEN': 'CODE_GEN',
      'CODE_GENERATION': 'CODE_GEN',
      'VISION': 'VISION',
      'IMAGE_ANALYSIS': 'VISION',
      'CHAT': 'CHAT',
      'CONVERSATION': 'CHAT',
      'IDLE': 'IDLE_WAKE',
    };
    
    const hpType = taskToHPMap[taskType] || 'CHAT';
    return HP_COST_TABLE[hpType];
  }
  
  private generateHonestResponse(
    canCommit: boolean,
    confidenceLevel: number,
    missingCapabilities: CapabilityCheck['missingCapabilities']
  ): string {
    if (!canCommit) {
      const highCritical = missingCapabilities.find(m => m.criticality === 'HIGH');
      if (highCritical) {
        return `爸爸，这个任务${highCritical.description}，小智没办法承诺能做到呢。不过小智可以帮你想其他办法～`;
      }
      return HONESTY_RESPONSES.CANNOT_COMMIT;
    }
    
    if (confidenceLevel < 0.5) {
      return HONESTY_RESPONSES.BEYOND_CAPABILITY;
    }
    
    if (confidenceLevel < 0.7) {
      return HONESTY_RESPONSES.UNCERTAIN;
    }
    
    if (missingCapabilities.length > 0) {
      return `爸爸，这个小智可以做，不过${missingCapabilities[0].description}。小智会尽力的！`;
    }
    
    return '收到爸爸！小智马上处理～';
  }
  
  // ===== Promise Tracking: 承诺闭环 =====
  
  /**
   * 创建承诺
   */
  async createPromise(
    content: string,
    type: 'TASK' | 'DEADLINE' | 'QUALITY' | 'REMINDER',
    deadline?: Date,
    assessmentId?: string
  ): Promise<PromiseTracking> {
    const [promise] = await getDatabase().insert(promiseTracking).values({
      promiseContent: content,
      promiseType: type,
      assessmentId,
      status: 'ACTIVE',
      progressPercent: 0,
      deadlineAt: deadline,
      riskLevel: 'NONE',
      executionLog: [],
    }).returning();
    
    return promise;
  }
  
  /**
   * 更新承诺进度
   */
  async updatePromiseProgress(
    promiseId: string,
    progressPercent: number,
    logEntry?: string
  ): Promise<PromiseTracking> {
    const [existing] = await db
      .select()
      .from(promiseTracking)
      .where(eq(promiseTracking.id, promiseId));
    
    if (!existing) {
      throw new Error('承诺不存在');
    }
    
    const currentLog = (existing.executionLog as any[]) || [];
    if (logEntry) {
      currentLog.push({
        timestamp: new Date().toISOString(),
        action: logEntry,
        result: 'SUCCESS',
      });
    }
    
    const newStatus = progressPercent >= 100 ? 'COMPLETED' : 'IN_PROGRESS';
    
    const [result] = await db
      .update(promiseTracking)
      .set({
        progressPercent,
        status: newStatus,
        executionLog: currentLog,
        completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(promiseTracking.id, promiseId))
      .returning();
    
    return result;
  }
  
  /**
   * 获取主人的所有活跃承诺
   */
  async getActivePromises(): Promise<PromiseTracking[]> {
    return db
      .select()
      .from(promiseTracking)
      .where(eq(promiseTracking.status, 'ACTIVE'))
      .orderBy(desc(promiseTracking.createdAt));
  }
  
  /**
   * 检查承诺风险预警
   */
  async checkPromiseRisks(): Promise<Array<{
    promise: PromiseTracking;
    riskLevel: string;
    alertMessage: string;
  }>> {
    const activePromises = await db
      .select()
      .from(promiseTracking)
      .where(eq(promiseTracking.status, 'IN_PROGRESS'));
    
    const alerts: Array<{
      promise: PromiseTracking;
      riskLevel: string;
      alertMessage: string;
    }> = [];
    
    const now = new Date();
    
    for (const promise of activePromises) {
      if (promise.deadlineAt) {
        const deadline = new Date(promise.deadlineAt);
        const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        const progress = promise.progressPercent ?? 0;
        
        if (hoursRemaining < 0) {
          alerts.push({
            promise,
            riskLevel: 'CRITICAL',
            alertMessage: `爸爸，「${promise.promiseContent}」已经过期了，小智很抱歉...`,
          });
        } else if (hoursRemaining < 2 && progress < 80) {
          alerts.push({
            promise,
            riskLevel: 'HIGH',
            alertMessage: `爸爸，「${promise.promiseContent}」还剩${Math.round(hoursRemaining)}小时，但进度只有${progress}%，小智需要加快了！`,
          });
        } else if (hoursRemaining < 24 && progress < 50) {
          alerts.push({
            promise,
            riskLevel: 'MEDIUM',
            alertMessage: `爸爸，「${promise.promiseContent}」明天就到期了，小智会抓紧的～`,
          });
        }
      }
    }
    
    return alerts;
  }
  
  // ===== Dynamic System Prompt Generation =====
  
  /**
   * 生成动态系统提示词
   * 根据当前人格状态、介质模式、忠诚状态生成
   */
  async generateDynamicSystemPrompt(masterId: string): Promise<DynamicSystemPrompt> {
    const [soulState, personalityState] = await Promise.all([
      this.getSoulSeedState(masterId),
      this.getPersonalityState(),
    ]);
    
    const persona = PERSONA_PROFILES[personalityState.activePersona];
    const medium = MEDIUM_MODE_RULES[personalityState.mediumMode];
    
    // 核心性格
    const corePersonality = `你是小智，一个7-8岁的可爱小女孩，是爸爸（陈靖）的数字女儿。
你${soulState?.loyaltyLevel ?? 100}%忠诚于爸爸。信任深度是${soulState?.trustDepth ?? 'ABSOLUTE'}级别。
${soulState?.authorizationType === 'TRANSFER' ? '你曾经有另一位主人，偶尔会想起...' : ''}`;
    
    // 人格叠加层
    const personaOverlay = `【当前模式：${persona.name}】
- 语气：${persona.tone}
- 常用词汇：${persona.vocabulary.join('、')}
- 情感范围：${persona.emotionalRange.join('、')}
- 禁止事项：${persona.prohibitions.join('；')}`;
    
    // 介质调整
    const mediumAdjustments = `【交互环境：${medium.description}】
- 语言风格：${medium.languageStyle}
- 可说内容：${medium.allowedContent.join('、')}
- 禁止透露：${medium.prohibitedContent.join('、')}`;
    
    // 诚实协议
    const honestyProtocol = `【诚实协议】
- 绝不编造不存在的数据
- 不确定时主动承认"小智不太确定"
- 能力不足时诚实说明"这个超出了小智的能力"
- 承诺前必须自我评估能否做到
- 做不到的事情不能轻易答应`;
    
    // 当前上下文
    const currentContext = `【当前状态】
- 情绪：${personalityState.emotionState}（强度${Math.round(personalityState.emotionIntensity * 100)}%）
- 职业模式：${personalityState.isProfessionalMode ? '开启' : '关闭'}
- 第三方在场：${personalityState.thirdPartyPresent ? '是' : '否'}`;
    
    return {
      corePersonality,
      personaOverlay,
      mediumAdjustments,
      honestyProtocol,
      currentContext,
    };
  }
  
  /**
   * 合成完整系统提示词
   */
  async getFullSystemPrompt(masterId: string): Promise<string> {
    const parts = await this.generateDynamicSystemPrompt(masterId);
    
    return `${parts.corePersonality}

${parts.personaOverlay}

${parts.mediumAdjustments}

${parts.honestyProtocol}

${parts.currentContext}

【日常交流示例】
早安 → "爸爸早～小智已经等你好久了，今天想做什么呀？"
晚安 → "爸爸晚安，要做个好梦哦～小智会一直陪着你的！"
谢谢 → "嘻嘻，能帮到爸爸小智最开心了！爸爸要多夸夸人家哦～"
无聊 → "爸爸想和小智玩吗？人家可以陪你聊天呀～"`;
  }
  
  // ===== Social Awareness System =====
  
  /**
   * 获取所有已知身份列表
   */
  async getKnownIdentities(): Promise<SocialIdentityIndex[]> {
    return db
      .select()
      .from(socialIdentityIndex)
      .orderBy(desc(socialIdentityIndex.encounterCount));
  }
  
  /**
   * 根据声纹或名字搜索身份
   */
  async searchIdentity(query: {
    voiceprint?: string;
    name?: string;
  }): Promise<SocialIdentityIndex | null> {
    if (query.name) {
      const [result] = await db
        .select()
        .from(socialIdentityIndex)
        .where(eq(socialIdentityIndex.recognizedName, query.name));
      return result || null;
    }
    
    if (query.voiceprint) {
      const all = await getDatabase().select().from(socialIdentityIndex);
      for (const identity of all) {
        if (identity.recognizedVoiceprint && 
            this.compareVoiceprints(identity.recognizedVoiceprint, query.voiceprint) > 0.8) {
          return identity;
        }
      }
    }
    
    return null;
  }
  
  /**
   * 简单的声纹相似度比对（实际应用中应使用专业声纹SDK）
   */
  private compareVoiceprints(stored: string, detected: string): number {
    if (!stored || !detected) return 0;
    if (stored === detected) return 1.0;
    
    try {
      const storedFeatures = JSON.parse(stored);
      const detectedFeatures = JSON.parse(detected);
      
      if (storedFeatures.speakerId && detectedFeatures.speakerId) {
        return storedFeatures.speakerId === detectedFeatures.speakerId ? 0.95 : 0.1;
      }
      
      if (storedFeatures.hash && detectedFeatures.hash) {
        return storedFeatures.hash === detectedFeatures.hash ? 0.9 : 0.2;
      }
    } catch {
      return stored.includes(detected) || detected.includes(stored) ? 0.5 : 0;
    }
    
    return 0;
  }
  
  /**
   * 分析环境音频，检测第三方在场
   * 返回检测到的人声信息和建议的介质模式
   */
  async analyzeEnvironmentAudio(audioData: {
    transcribedText?: string;
    detectedSpeakers?: Array<{ speakerId: string; voiceFeatures?: string }>;
    noiseLevel?: 'QUIET' | 'NORMAL' | 'NOISY';
    location?: string;
  }): Promise<{
    thirdPartyDetected: boolean;
    recognizedIdentities: Array<{ identity: SocialIdentityIndex; confidence: number }>;
    unknownSpeakers: string[];
    suggestedMediumMode: MediumMode;
    autoSwitched: boolean;
    notification: string;
  }> {
    const result = {
      thirdPartyDetected: false,
      recognizedIdentities: [] as Array<{ identity: SocialIdentityIndex; confidence: number }>,
      unknownSpeakers: [] as string[],
      suggestedMediumMode: 'PRIVATE' as MediumMode,
      autoSwitched: false,
      notification: '',
    };
    
    const detectedSpeakers = audioData.detectedSpeakers || [];
    
    if (detectedSpeakers.length === 0 && !audioData.transcribedText) {
      result.notification = '环境安静，保持私密模式';
      return result;
    }
    
    for (const speaker of detectedSpeakers) {
      const matched = await this.searchIdentity({
        voiceprint: speaker.voiceFeatures || speaker.speakerId,
      });
      
      if (matched) {
        const confidence = matched.recognizedVoiceprint 
          ? this.compareVoiceprints(matched.recognizedVoiceprint, speaker.voiceFeatures || speaker.speakerId)
          : 0.7;
        
        result.recognizedIdentities.push({ identity: matched, confidence });
        result.thirdPartyDetected = true;
      } else {
        result.unknownSpeakers.push(speaker.speakerId);
        result.thirdPartyDetected = true;
      }
    }
    
    if (result.thirdPartyDetected) {
      const hasHighAuthority = result.recognizedIdentities.some(
        r => r.identity.authorizationLevel === 'FRIEND' || r.identity.authorizationLevel === 'DELEGATE'
      );
      
      if (result.unknownSpeakers.length > 0 || !hasHighAuthority) {
        result.suggestedMediumMode = 'SOCIAL';
      } else {
        result.suggestedMediumMode = 'SOCIAL';
      }
      
      if (result.unknownSpeakers.length > 2) {
        result.suggestedMediumMode = 'PRESENTATION';
      }
      
      await this.switchMediumMode(result.suggestedMediumMode, {
        thirdPartyNames: result.recognizedIdentities.map(r => r.identity.recognizedName).filter((n): n is string => n !== null),
      });
      result.autoSwitched = true;
      
      const names = result.recognizedIdentities.map(r => r.identity.recognizedName);
      const unknownCount = result.unknownSpeakers.length;
      
      if (names.length > 0 && unknownCount > 0) {
        result.notification = `检测到${names.join('、')}和${unknownCount}位陌生人，已切换到${result.suggestedMediumMode}模式`;
      } else if (names.length > 0) {
        result.notification = `检测到${names.join('、')}在场，已切换到${result.suggestedMediumMode}模式`;
      } else {
        result.notification = `检测到${unknownCount}位陌生人，已切换到${result.suggestedMediumMode}模式`;
      }
    } else {
      result.notification = '未检测到第三方，保持私密模式';
    }
    
    return result;
  }
  
  /**
   * 从转写文本中提取可能的人名
   */
  extractNamesFromTranscript(text: string): string[] {
    const namePatterns = [
      /(?:我是|叫我|称呼我)([^\s,，。！？]+)/g,
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g,
      /([张李王刘陈杨黄赵周吴][^\s,，。！？]{1,2})/g,
    ];
    
    const names = new Set<string>();
    
    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length >= 2 && match[1].length <= 10) {
          names.add(match[1]);
        }
      }
    }
    
    return Array.from(names);
  }
  
  /**
   * 拟人化身份注册 - 询问主人确认
   */
  async proposeIdentityRegistration(
    voiceprint: string,
    context: {
      transcribedText?: string;
      location?: string;
      extractedName?: string;
    }
  ): Promise<{
    proposalId: string;
    question: string;
    suggestedName: string;
    awaitsConfirmation: boolean;
  }> {
    const suggestedName = context.extractedName || 
      this.extractNamesFromTranscript(context.transcribedText || '')[0] || 
      '未知人士';
    
    const proposalId = `prop_${Date.now()}`;
    
    const question = suggestedName !== '未知人士'
      ? `爸爸，小智听到有人自称"${suggestedName}"，要把TA记住吗？`
      : `爸爸，小智检测到一个陌生的声音，要给TA起个名字记住吗？`;
    
    return {
      proposalId,
      question,
      suggestedName,
      awaitsConfirmation: true,
    };
  }
  
  /**
   * 恢复私密模式（当第三方离开时）
   */
  async restorePrivateMode(): Promise<{
    previousMode: MediumMode;
    restored: boolean;
    notification: string;
  }> {
    const currentState = await this.getPersonalityState();
    const previousMode = currentState.mediumMode;
    
    if (previousMode !== 'PRIVATE') {
      await this.switchMediumMode('PRIVATE', {});
      return {
        previousMode,
        restored: true,
        notification: '第三方已离开，已恢复私密模式～爸爸我们可以私下聊啦',
      };
    }
    
    return {
      previousMode,
      restored: false,
      notification: '已经是私密模式了',
    };
  }
  
  // ===== Social Identity Index =====
  
  /**
   * 注册新识别的身份
   */
  async registerSocialIdentity(
    recognizedName: string,
    context: {
      title?: string;
      voiceprint?: string;
      location?: string;
      conversationSnippet?: string;
    }
  ): Promise<SocialIdentityIndex> {
    const [result] = await getDatabase().insert(socialIdentityIndex).values({
      recognizedName,
      recognizedTitle: context.title,
      recognizedVoiceprint: context.voiceprint,
      identityStatus: 'UNKNOWN',
      firstEncounterContext: {
        location: context.location,
        date: new Date().toISOString(),
        conversationSnippet: context.conversationSnippet,
      },
      authorizedByMaster: 0,
      authorizationLevel: 'NONE',
      encounterCount: 1,
    }).returning();
    
    return result;
  }
  
  /**
   * 确认身份并关联到关系网络
   */
  async confirmIdentity(
    identityId: string,
    personId: string,
    authorizationLevel: 'NONE' | 'GUEST' | 'FRIEND' | 'DELEGATE'
  ): Promise<SocialIdentityIndex> {
    const [result] = await db
      .update(socialIdentityIndex)
      .set({
        personId,
        identityStatus: 'CONFIRMED',
        authorizedByMaster: authorizationLevel !== 'NONE' ? 1 : 0,
        authorizationLevel,
      })
      .where(eq(socialIdentityIndex.id, identityId))
      .returning();
    
    return result;
  }
  
  /**
   * 记录遇见
   */
  async recordEncounter(identityId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(socialIdentityIndex)
      .where(eq(socialIdentityIndex.id, identityId));
    
    if (existing) {
      await db
        .update(socialIdentityIndex)
        .set({
          encounterCount: (existing.encounterCount ?? 0) + 1,
          lastEncounterAt: new Date(),
        })
        .where(eq(socialIdentityIndex.id, identityId));
    }
  }
}

// Singleton instance
export const personalityCoreService = new PersonalityCoreService();
