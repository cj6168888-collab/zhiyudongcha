/**
 * Z1 协议 - 智能 LLM 路由层 v2.1 (Phase 1.2 完整版)
 * 
 * 遵循 Z1 协议 v5.0.1-Bio-CN：
 * - 铁律1: API 密钥仅从 process.env 读取
 * - 铁律4: 离线兼容 (Ollama 本地模型)
 * - 四级路由: primary_brain -> vision_brain -> fast_brain -> offline
 * - HP 经济: 每次调用扣除相应 HP
 * 
 * Phase 1.2 新增：
 * - TaskClassifier 敏感词/隐私检测
 * - 路由决策日志
 * - 用户偏好配置
 * - <50ms 决策保证
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Z1LlmRouter');

import {
  providerRegistry,
  getAvailableProviders,
  type LLMProvider,
  type LLMProviderName,
  type LLMMessage,
  type LLMGenerateOptions,
  type LLMResponse,
} from './llm-providers';
import { 
  HP_COST_TABLE, 
  type HPCostType,
  type SensitivityLevel,
  type RoutingMode,
} from '@shared/schema';
import { taskClassifier, type ClassificationResult } from './task-classifier';
import { getDatabase } from '../db';
import { routingLogs, userRoutingPreferences } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface Z1RouterConfig {
  primaryBrain: LLMProviderName;
  visionBrain: LLMProviderName;
  fastBrain: LLMProviderName;
  offlineBrain: LLMProviderName;
  models?: {
    deepseek?: string;
    tongyi?: string;
    doubao?: string;
    ollama?: string;
  };
}

export interface Z1RoutingResult {
  response: LLMResponse | null;
  provider: LLMProviderName;
  hpCost: number;
  taskType: HPCostType;
  fallbackUsed: boolean;
  latencyMs: number;
  classification?: ClassificationResult;
  routingLogId?: string;
}

export interface Z1RoutingOptions {
  userId?: string;
  sessionId?: string;
  forceProvider?: LLMProviderName;
  forceOffline?: boolean;
  hpBalance?: number;
  routingMode?: RoutingMode;
  enableLogging?: boolean;
}

export type TaskIntent = 'CHAT' | 'CODE_GEN' | 'INTEL_ANALYSIS' | 'VISION' | 'IDLE_WAKE';

const DEFAULT_CONFIG: Z1RouterConfig = {
  primaryBrain: 'TONGYI',
  visionBrain: 'TONGYI',
  fastBrain: 'DOUBAO',
  offlineBrain: 'LOCAL_OLLAMA',
  models: {
    deepseek: 'deepseek-chat',
    tongyi: 'qwen-max',
    doubao: 'doubao-pro-32k',
    ollama: 'qwen:7b',
  },
};

let currentConfig: Z1RouterConfig = { ...DEFAULT_CONFIG };

export function configureZ1Router(config: Partial<Z1RouterConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  logger.info('[Z1Router] Configuration updated:', {
    primaryBrain: currentConfig.primaryBrain,
    visionBrain: currentConfig.visionBrain,
    fastBrain: currentConfig.fastBrain,
    offlineBrain: currentConfig.offlineBrain,
  });
}

export function getZ1RouterConfig(): Z1RouterConfig {
  return { ...currentConfig };
}

function getHPCost(taskType: TaskIntent): { type: HPCostType; cost: number } {
  switch (taskType) {
    case 'INTEL_ANALYSIS':
      return { type: 'INTEL_ANALYSIS', cost: HP_COST_TABLE.INTEL_ANALYSIS };
    case 'CODE_GEN':
      return { type: 'CODE_GEN', cost: HP_COST_TABLE.CODE_GEN };
    case 'VISION':
      return { type: 'VISION', cost: HP_COST_TABLE.VISION };
    case 'IDLE_WAKE':
      return { type: 'IDLE_WAKE', cost: HP_COST_TABLE.IDLE_WAKE };
    default:
      return { type: 'CHAT', cost: HP_COST_TABLE.CHAT };
  }
}

function selectBrainForClassification(
  classification: ClassificationResult,
  routingMode: RoutingMode = 'BALANCED'
): LLMProviderName {
  if (classification.shouldForceLocal) {
    return currentConfig.offlineBrain;
  }
  
  if (routingMode === 'PRIVACY_FIRST' && classification.sensitivityLevel !== 'LOW') {
    return currentConfig.offlineBrain;
  }
  
  if (routingMode === 'SPEED_FIRST') {
    return currentConfig.fastBrain;
  }
  
  switch (classification.taskType) {
    case 'INTEL_ANALYSIS':
    case 'CODE_GEN':
      return currentConfig.primaryBrain;
    case 'VISION':
      return currentConfig.visionBrain;
    case 'IDLE_WAKE':
    case 'CHAT':
      return currentConfig.fastBrain;
    default:
      return currentConfig.primaryBrain;
  }
}

function getModelForProvider(provider: LLMProviderName): string | undefined {
  switch (provider) {
    case 'DEEPSEEK':
      return currentConfig.models?.deepseek;
    case 'TONGYI':
      return currentConfig.models?.tongyi;
    case 'DOUBAO':
      return currentConfig.models?.doubao;
    case 'LOCAL_OLLAMA':
      return currentConfig.models?.ollama;
  }
}

async function getUserPreferences(userId?: string): Promise<{
  routingMode: RoutingMode;
  customKeywords: string[];
  blockedProviders: string[];
}> {
  if (!userId) {
    return { routingMode: 'BALANCED', customKeywords: [], blockedProviders: [] };
  }
  
  try {
    const prefs = await getDatabase().select().from(userRoutingPreferences).where(eq(userRoutingPreferences.userId, userId)).limit(1);
    if (prefs.length > 0) {
      return {
        routingMode: (prefs[0].routingMode as RoutingMode) || 'BALANCED',
        customKeywords: prefs[0].customSensitiveKeywords || [],
        blockedProviders: prefs[0].blockedProviders || [],
      };
    }
  } catch (error) {
    logger.info('[Z1Router] Failed to fetch user preferences:', error);
  }
  
  return { routingMode: 'BALANCED', customKeywords: [], blockedProviders: [] };
}

async function logRoutingDecision(
  classification: ClassificationResult,
  selectedProvider: LLMProviderName,
  selectedModel: string | undefined,
  result: Z1RoutingResult,
  options: Z1RoutingOptions,
  messagePreview: string
): Promise<string | undefined> {
  if (options.enableLogging === false) {
    return undefined;
  }
  
  try {
    const [log] = await getDatabase().insert(routingLogs).values({
      userId: options.userId,
      sessionId: options.sessionId,
      messagePreview: messagePreview.slice(0, 50),
      taskType: classification.taskType,
      sensitivityLevel: classification.sensitivityLevel,
      sensitiveCategories: classification.sensitiveCategories,
      selectedProvider,
      selectedModel,
      routingReason: classification.reason,
      fallbackUsed: result.fallbackUsed ? 1 : 0,
      fallbackChain: result.fallbackUsed ? [selectedProvider, result.provider] : undefined,
      classificationLatencyMs: classification.classificationTimeMs,
      routingLatencyMs: result.latencyMs - (classification.classificationTimeMs || 0),
      totalLatencyMs: result.latencyMs,
      hpCost: result.hpCost,
      hpBalanceAfter: options.hpBalance ? options.hpBalance - result.hpCost : undefined,
      userPreference: options.routingMode,
    }).returning({ id: routingLogs.id });
    
    return log?.id;
  } catch (error) {
    logger.info('[Z1Router] Failed to log routing decision:', error);
    return undefined;
  }
}

export async function routeZ1(
  messages: LLMMessage[],
  userMessage: string,
  options: Z1RoutingOptions = {}
): Promise<Z1RoutingResult> {
  const startTime = Date.now();
  
  const userPrefs = await getUserPreferences(options.userId);
  const routingMode = options.routingMode || userPrefs.routingMode;
  
  if (userPrefs.customKeywords.length > 0) {
    taskClassifier.setCustomKeywords(userPrefs.customKeywords);
  }
  
  const classification = taskClassifier.classify(userMessage, routingMode);
  const { type: taskType, cost: hpCost } = getHPCost(classification.taskType as TaskIntent);
  
  logger.info(`[Z1Router] Classification in ${classification.classificationTimeMs}ms:`, {
    taskType: classification.taskType,
    sensitivity: classification.sensitivityLevel,
    categories: classification.sensitiveCategories,
    forceLocal: classification.shouldForceLocal,
  });
  
  if (options.hpBalance !== undefined && options.hpBalance < hpCost) {
    const result: Z1RoutingResult = {
      response: {
        content: '爸爸，小智现在有点累了（HP不足），需要休息一下～',
        model: 'hp-guard',
      },
      provider: 'LOCAL_OLLAMA',
      hpCost: 0,
      taskType,
      fallbackUsed: false,
      latencyMs: Date.now() - startTime,
      classification,
    };
    await logRoutingDecision(classification, 'LOCAL_OLLAMA', undefined, result, options, userMessage);
    return result;
  }
  
  let selectedProvider: LLMProviderName;
  
  if (options.forceProvider) {
    selectedProvider = options.forceProvider;
  } else if (options.forceOffline || classification.shouldForceLocal) {
    selectedProvider = currentConfig.offlineBrain;
  } else {
    selectedProvider = selectBrainForClassification(classification, routingMode);
  }
  
  if (userPrefs.blockedProviders.includes(selectedProvider)) {
    selectedProvider = currentConfig.offlineBrain;
  }
  
  const fullMessages: LLMMessage[] = [
    ...messages,
    { role: 'user', content: userMessage },
  ];
  
  const attemptOrder: LLMProviderName[] = [
    selectedProvider,
    currentConfig.primaryBrain,
    currentConfig.fastBrain,
    currentConfig.offlineBrain,
  ].filter((p, i, arr) => 
    arr.indexOf(p) === i && !userPrefs.blockedProviders.includes(p)
  );
  
  let fallbackUsed = false;
  const selectedModel = getModelForProvider(selectedProvider);
  
  for (const providerName of attemptOrder) {
    const provider = providerRegistry[providerName];
    const available = await provider.isAvailable();
    
    if (!available) {
      logger.info(`[Z1Router] Provider ${providerName} not available, trying next...`);
      if (providerName === selectedProvider) fallbackUsed = true;
      continue;
    }
    
    const model = getModelForProvider(providerName);
    const response = await provider.chat(fullMessages, { model });
    
    if (response) {
      const totalLatency = Date.now() - startTime;
      logger.info(`[Z1Router] Success with ${providerName} (${model}) in ${totalLatency}ms`);
      
      const result: Z1RoutingResult = {
        response,
        provider: providerName,
        hpCost: fallbackUsed ? Math.floor(hpCost * 0.5) : hpCost,
        taskType,
        fallbackUsed,
        latencyMs: totalLatency,
        classification,
      };
      
      const logId = await logRoutingDecision(classification, selectedProvider, selectedModel, result, options, userMessage);
      result.routingLogId = logId;
      
      return result;
    }
    
    logger.info(`[Z1Router] Provider ${providerName} failed, trying next...`);
    fallbackUsed = true;
  }
  
  const result: Z1RoutingResult = {
    response: {
      content: '爸爸，所有的AI服务暂时都不可用，小智需要等一等～',
      model: 'all-failed',
    },
    provider: currentConfig.offlineBrain,
    hpCost: 0,
    taskType,
    fallbackUsed: true,
    latencyMs: Date.now() - startTime,
    classification,
  };
  
  await logRoutingDecision(classification, selectedProvider, selectedModel, result, options, userMessage);
  return result;
}

export async function *routeZ1Stream(
  messages: LLMMessage[],
  userMessage: string,
  options: Z1RoutingOptions = {}
): AsyncGenerator<{ chunk: string; provider: LLMProviderName }, void, unknown> {
  const userPrefs = await getUserPreferences(options.userId);
  const routingMode = options.routingMode || userPrefs.routingMode;
  
  if (userPrefs.customKeywords.length > 0) {
    taskClassifier.setCustomKeywords(userPrefs.customKeywords);
  }
  
  const classification = taskClassifier.classify(userMessage, routingMode);
  
  let selectedProvider: LLMProviderName;
  
  if (options.forceProvider) {
    selectedProvider = options.forceProvider;
  } else if (options.forceOffline || classification.shouldForceLocal) {
    selectedProvider = currentConfig.offlineBrain;
  } else {
    selectedProvider = selectBrainForClassification(classification, routingMode);
  }
  
  const fullMessages: LLMMessage[] = [
    ...messages,
    { role: 'user', content: userMessage },
  ];
  
  const attemptOrder: LLMProviderName[] = [
    selectedProvider,
    currentConfig.offlineBrain,
  ].filter((p, i, arr) => arr.indexOf(p) === i);
  
  for (const providerName of attemptOrder) {
    const provider = providerRegistry[providerName];
    const available = await provider.isAvailable();
    
    if (!available || !provider.chatStream) continue;
    
    const model = getModelForProvider(providerName);
    
    try {
      for await (const chunk of provider.chatStream(fullMessages, { model })) {
        yield { chunk, provider: providerName };
      }
      return;
    } catch (error) {
      logger.info(`[Z1Router] Stream failed for ${providerName}:`, error);
    }
  }
}

export async function getZ1Status(): Promise<{
  config: Z1RouterConfig;
  providers: Record<LLMProviderName, { available: boolean }>;
  recommended: LLMProviderName;
  sensitiveCategories: string[];
}> {
  const available = await getAvailableProviders();
  
  const providers: Record<LLMProviderName, { available: boolean }> = {
    DEEPSEEK: { available: available.includes('DEEPSEEK') },
    TONGYI: { available: available.includes('TONGYI') },
    DOUBAO: { available: available.includes('DOUBAO') },
    LOCAL_OLLAMA: { available: available.includes('LOCAL_OLLAMA') },
  };
  
  let recommended: LLMProviderName = 'TONGYI';
  if (providers.TONGYI.available) recommended = 'TONGYI';
  else if (providers.DEEPSEEK.available) recommended = 'DEEPSEEK';
  else if (providers.DOUBAO.available) recommended = 'DOUBAO';
  else if (providers.LOCAL_OLLAMA.available) recommended = 'LOCAL_OLLAMA';
  
  return {
    config: currentConfig,
    providers,
    recommended,
    sensitiveCategories: taskClassifier.getSensitiveCategories(),
  };
}

export async function getRoutingLogs(
  userId?: string,
  limit: number = 50
): Promise<any[]> {
  try {
    let query = getDatabase().select().from(routingLogs).limit(limit).orderBy(routingLogs.createdAt);
    if (userId) {
      return await getDatabase().select().from(routingLogs).where(eq(routingLogs.userId, userId)).limit(limit);
    }
    return await query;
  } catch (error) {
    logger.info('[Z1Router] Failed to fetch routing logs:', error);
    return [];
  }
}

export async function updateUserRoutingPreferences(
  userId: string,
  preferences: {
    routingMode?: RoutingMode;
    customSensitiveKeywords?: string[];
    preferredProvider?: LLMProviderName;
    blockedProviders?: string[];
    forceLocalForSensitive?: boolean;
  }
): Promise<boolean> {
  try {
    const existing = await getDatabase().select().from(userRoutingPreferences).where(eq(userRoutingPreferences.userId, userId)).limit(1);
    
    if (existing.length > 0) {
      await getDatabase().update(userRoutingPreferences)
        .set({
          routingMode: preferences.routingMode,
          customSensitiveKeywords: preferences.customSensitiveKeywords,
          preferredProvider: preferences.preferredProvider,
          blockedProviders: preferences.blockedProviders,
          forceLocalForSensitive: preferences.forceLocalForSensitive ? 1 : 0,
          updatedAt: new Date(),
        })
        .where(eq(userRoutingPreferences.userId, userId));
    } else {
      await getDatabase().insert(userRoutingPreferences).values({
        userId,
        routingMode: preferences.routingMode || 'BALANCED',
        customSensitiveKeywords: preferences.customSensitiveKeywords,
        preferredProvider: preferences.preferredProvider,
        blockedProviders: preferences.blockedProviders,
        forceLocalForSensitive: preferences.forceLocalForSensitive ? 1 : 0,
      });
    }
    
    return true;
  } catch (error) {
    logger.info('[Z1Router] Failed to update user preferences:', error);
    return false;
  }
}

logger.info('[Z1Router] 智能路由层 v2.1 已初始化 (Phase 1.2 完整版)');
