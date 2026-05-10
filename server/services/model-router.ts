/**
 * 小智 Model Router - 智能模型路由层
 * 
 * 功能：
 * 1. 自动选择最佳AI模型（本地 vs 云端）
 * 2. 支持Ollama本地模型和DashScope云端模型
 * 3. 智能降级：云端不可用时自动切换本地
 * 4. 任务分级：简单对话走本地，复杂分析走云端
 */

import { chatWithDashScope, checkLocalFastResponse, type ChatMessage } from './dashscope';
import { ollamaAdapter } from './ollama-adapter';
import type { IStorage } from '../storage';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ModelRouter');

// ===== 模型提供者类型 =====
export type ModelProvider = 'LOCAL' | 'CLOUD' | 'HYBRID' | 'MOBILE' | 'MOBILE_LOCAL' | 'SERVER' | 'SERVER_LOCAL' | 'AUTOGLM';

// ===== 任务类型 =====
export type TaskType = 'CHAT' | 'SCREEN_OPERATION' | 'COMPLEX_ANALYSIS' | 'EXPERT';

// ===== 服务器配置 =====
export interface ServerConfig {
  endpoint: string;            // 服务器Ollama API端点
  model: string;               // 运行的模型名称
  name?: string;               // 服务器名称
  gpuMemoryMB?: number;        // GPU显存(MB)
  ramMB?: number;              // 内存(MB)
  cpuCores?: number;           // CPU核心数
  maxConcurrent?: number;      // 最大并发请求数
  enabled?: boolean;           // 是否启用
  taskType?: TaskType;         // 专用任务类型（如AutoGLM用于屏幕操作）
}

// ===== AutoGLM屏幕操作配置 =====
export interface AutoGLMConfig {
  endpoint: string;            // AutoGLM服务端点
  model: string;               // 模型名称 (autoglm-9b)
  enabled: boolean;            // 是否启用
  gpuMemoryMB?: number;        // GPU显存要求 (~16GB)
}

let autoGLMConfig: AutoGLMConfig | null = null;

// 配置AutoGLM服务器
export function configureAutoGLM(config: AutoGLMConfig): void {
  autoGLMConfig = config;
  logger.info(`[ModelRouter] AutoGLM configured: ${config.endpoint} (${config.model})`);
}

// 获取AutoGLM配置
export function getAutoGLMConfig(): AutoGLMConfig | null {
  return autoGLMConfig;
}

// 检测是否为屏幕操作任务
export function isScreenOperationTask(message: string): boolean {
  const screenPatterns = [
    /打开.*app|打开.*应用|启动.*程序/i,
    /点击.*按钮|点击.*链接|点一下/i,
    /滑动.*屏幕|向.*滑|下拉|上滑/i,
    /输入.*文字|填写.*表单|写入/i,
    /截图|截屏|屏幕截图/i,
    /帮我.*操作.*手机|自动.*完成|自动化/i,
    /发送.*消息|回复.*微信|打开.*微信/i,
    /打电话|拨打.*电话|发短信/i,
    /设置.*闹钟|调.*音量|开.*蓝牙/i,
  ];
  
  return screenPatterns.some(pattern => pattern.test(message));
}

// 调用AutoGLM进行屏幕操作
export async function callAutoGLM(
  instruction: string,
  screenshot?: string,
  context?: Record<string, unknown>
): Promise<{
  success: boolean;
  action?: {
    type: string;
    target?: { x: number; y: number };
    text?: string;
  };
  explanation?: string;
  error?: string;
}> {
  if (!autoGLMConfig || !autoGLMConfig.enabled) {
    return { success: false, error: 'AutoGLM未配置或未启用' };
  }
  
  try {
    const response = await fetch(`${autoGLMConfig.endpoint}/v1/screen/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: autoGLMConfig.model,
        instruction,
        screenshot,
        context,
      }),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      return { success: false, error: `AutoGLM返回错误: ${response.status}` };
    }
    
    return await response.json();
  } catch (error) {
    logger.error({ err: error }, '[AutoGLM] Error');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

export interface ModelConfig {
  provider: ModelProvider;
  localEndpoint?: string;      // Ollama API endpoint, e.g., http://localhost:11434
  localModel?: string;         // 本地模型名称, e.g., qwen:7b, phi3:mini
  cloudModel?: string;         // 云端模型名称
  maxLocalTokens?: number;     // 本地模型最大处理token数
  fallbackToCloud?: boolean;   // 本地失败时是否降级到云端
  preferLocal?: boolean;       // 优先使用本地模型
  // 移动端配置
  mobileDeviceId?: string;     // 优先使用的移动设备ID
  privacyMode?: boolean;       // 隐私模式：强制本地/移动设备处理
  preferMobile?: boolean;      // 优先使用移动设备
  // 服务器配置
  serverConfig?: ServerConfig; // GPU服务器配置
  preferServer?: boolean;      // 复杂任务优先使用服务器
}

export interface ModelResponse {
  message: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  tokensUsed?: number;
  fallbackUsed?: boolean;
  chainOfThought?: Record<string, unknown>;
}

export interface TaskComplexity {
  level: 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
  score: number;
  reason: string;
}

// ===== 默认配置 =====
const DEFAULT_CONFIG: ModelConfig = {
  provider: 'HYBRID',
  localEndpoint: 'http://localhost:11434',
  localModel: 'qwen:7b',
  cloudModel: 'qwen-turbo',
  maxLocalTokens: 2048,
  fallbackToCloud: true,
  preferLocal: true,
  privacyMode: false,
  preferMobile: false,
  preferServer: true, // 复杂任务优先使用服务器
};

// ===== 服务器配置存储 =====
let serverConfigs: ServerConfig[] = [];

// 添加服务器配置
export function addServerConfig(config: ServerConfig): void {
  const existingIndex = serverConfigs.findIndex(s => s.endpoint === config.endpoint);
  if (existingIndex >= 0) {
    serverConfigs[existingIndex] = { ...config, enabled: config.enabled ?? true };
  } else {
    serverConfigs.push({ ...config, enabled: config.enabled ?? true });
  }
  logger.info(`[ModelRouter] Server configured: ${config.name || config.endpoint} (${config.model})`);
  if (config.gpuMemoryMB) {
    logger.info(`[ModelRouter] GPU: ${config.gpuMemoryMB}MB, RAM: ${config.ramMB}MB`);
  }
}

// 移除服务器配置
export function removeServerConfig(endpoint: string): boolean {
  const index = serverConfigs.findIndex(s => s.endpoint === endpoint);
  if (index >= 0) {
    serverConfigs.splice(index, 1);
    return true;
  }
  return false;
}

// 获取所有服务器配置
export function getServerConfigs(): ServerConfig[] {
  return [...serverConfigs];
}

// 获取可用的服务器（已启用）
export function getAvailableServers(): ServerConfig[] {
  return serverConfigs.filter(s => s.enabled !== false);
}

// 检查服务器健康状态
export async function checkServerHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 调用服务器模型
export async function callServerModel(
  messages: ChatMessage[],
  userMessage: string,
  server: ServerConfig
): Promise<ModelResponse | null> {
  const startTime = Date.now();
  
  try {
    const ollamaMessages = [
      ...messages.map(m => ({ 
        role: m.role as 'system' | 'user' | 'assistant', 
        content: m.content 
      })),
      { role: 'user' as const, content: userMessage },
    ];
    
    const response = await fetch(`${server.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: server.model,
        messages: ollamaMessages,
        stream: false,
        options: {
          num_ctx: 8192, // 大模型可以用更大的context
        },
      }),
      signal: AbortSignal.timeout(120000), // 2分钟超时
    });
    
    if (!response.ok) {
      logger.info(`[ModelRouter] Server ${server.endpoint} returned ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    
    return {
      message: result.message?.content || '',
      provider: 'SERVER',
      model: server.model,
      latencyMs: Date.now() - startTime,
      tokensUsed: result.eval_count,
    };
  } catch (error) {
    logger.info(`[ModelRouter] Server error (${server.endpoint}): ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// 选择最佳服务器
export function selectBestServer(complexity: TaskComplexity): ServerConfig | null {
  const available = getAvailableServers();
  if (available.length === 0) return null;
  
  // 按GPU显存排序，复杂任务选择显存最大的
  if (complexity.level === 'COMPLEX') {
    available.sort((a, b) => (b.gpuMemoryMB || 0) - (a.gpuMemoryMB || 0));
  }
  
  return available[0];
}

// ===== 任务复杂度分析 =====
export function analyzeTaskComplexity(message: string, context?: string): TaskComplexity {
  const lowerMessage = message.toLowerCase();
  const totalLength = message.length + (context?.length || 0);
  
  // 简单任务特征
  const simplePatterns = [
    /^(早|早安|晚安|你好|嗨|hi|hello|谢谢|好的|嗯|行)/i,
    /^(在吗|在不在|小智|智智)/i,
    /^.{1,20}$/,  // 非常短的消息
  ];
  
  for (const pattern of simplePatterns) {
    if (pattern.test(message.trim())) {
      return {
        level: 'SIMPLE',
        score: 0.1,
        reason: '简单问候或确认',
      };
    }
  }
  
  // 复杂任务特征
  const complexPatterns = [
    /分析|评估|对比|综合|策略|规划|方案|建议/,
    /法律|财务|合同|投资|风险/,
    /为什么|怎么.*才能|如何.*最好/,
    /帮我.*写|生成.*报告|总结.*内容/,
  ];
  
  let complexScore = 0;
  for (const pattern of complexPatterns) {
    if (pattern.test(message)) {
      complexScore += 0.2;
    }
  }
  
  // 长度因素
  if (totalLength > 500) complexScore += 0.2;
  if (totalLength > 1000) complexScore += 0.2;
  
  if (complexScore >= 0.6) {
    return {
      level: 'COMPLEX',
      score: Math.min(complexScore, 1),
      reason: '需要深度分析或专业知识',
    };
  }
  
  return {
    level: 'MEDIUM',
    score: 0.3 + complexScore,
    reason: '一般对话或信息查询',
  };
}

// ===== 本地模型调用 (使用Ollama适配器) =====
export async function callLocalModel(
  messages: ChatMessage[],
  userMessage: string,
  config: ModelConfig
): Promise<ModelResponse | null> {
  const startTime = Date.now();
  
  try {
    const ollamaMessages = [
      ...messages.map(m => ({ 
        role: m.role as 'system' | 'user' | 'assistant', 
        content: m.content 
      })),
      { role: 'user' as const, content: userMessage },
    ];
    
    const result = await ollamaAdapter.chat(ollamaMessages, {
      model: config.localModel,
      numCtx: config.maxLocalTokens || 2048,
    });
    
    if (!result) {
      logger.info('[ModelRouter] Local model returned no result');
      return null;
    }
    
    return {
      message: result.message?.content || '',
      provider: 'LOCAL',
      model: config.localModel || 'ollama',
      latencyMs: Date.now() - startTime,
      tokensUsed: result.evalCount,
    };
  } catch (error) {
    logger.info(`[ModelRouter] Local model error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

// ===== 检查本地模型可用性 =====
export async function checkLocalModelHealth(config: ModelConfig): Promise<boolean> {
  return ollamaAdapter.checkHealth();
}

// ===== 智能路由主函数 =====
export async function routeToModel(
  messages: ChatMessage[],
  userMessage: string,
  storage: IStorage,
  customConfig?: Partial<ModelConfig>
): Promise<ModelResponse> {
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  const startTime = Date.now();
  
  // 1. 首先检查本地快速响应
  const localFast = checkLocalFastResponse(userMessage);
  if (localFast.canHandle && localFast.response) {
    logger.info(`[ModelRouter] Using local fast response for: ${localFast.category}`);
    return {
      message: localFast.response,
      provider: 'LOCAL',
      model: 'local-fast-response',
      latencyMs: Date.now() - startTime,
    };
  }
  
  // 2. 检查是否为屏幕操作任务，优先路由到AutoGLM
  if (isScreenOperationTask(userMessage) && autoGLMConfig?.enabled) {
    logger.info('[ModelRouter] Detected screen operation task, routing to AutoGLM');
    return {
      message: '[SCREEN_OPERATION] 此任务需要屏幕操作，请调用callAutoGLM接口执行',
      provider: 'AUTOGLM',
      model: autoGLMConfig.model,
      latencyMs: Date.now() - startTime,
    };
  }
  
  // 3. 分析任务复杂度
  const complexity = analyzeTaskComplexity(userMessage);
  logger.info(`[ModelRouter] Task complexity: ${complexity.level} (${complexity.score.toFixed(2)}) - ${complexity.reason}`);
  
  // 4. 复杂任务优先尝试GPU服务器 (Fara-7B本地优先策略)
  // 隐私模式下跳过服务器，MEDIUM任务走本地优先路径
  const shouldTryServer = config.preferServer 
    && !config.privacyMode 
    && complexity.level === 'COMPLEX';  // 只有COMPLEX任务尝试服务器
    
  if (shouldTryServer) {
    const bestServer = selectBestServer(complexity);
    if (bestServer) {
      logger.info(`[ModelRouter] Routing COMPLEX task to GPU server: ${bestServer.name || bestServer.endpoint}`);
      const serverResponse = await callServerModel(messages, userMessage, bestServer);
      if (serverResponse) {
        logger.info(`[ModelRouter] Server responded in ${serverResponse.latencyMs}ms (${bestServer.model})`);
        return serverResponse;
      }
      logger.info('[ModelRouter] Server unavailable, falling back to local-first path...');
    }
  }
  
  // 4. 根据复杂度和配置选择模型
  let useLocal = false;
  
  if (config.provider === 'LOCAL' || config.provider === 'SERVER_LOCAL') {
    useLocal = true;
  } else if (config.provider === 'CLOUD') {
    useLocal = false;
  } else if (config.provider === 'SERVER') {
    // 强制使用服务器，但已经在上面尝试过了
    useLocal = false;
  } else {
    // HYBRID 模式：智能选择 (借鉴Fara-7B本地优先策略)
    // 本地7B模型已能处理大多数常规任务
    if (complexity.level === 'SIMPLE') {
      useLocal = true;  // 简单任务必走本地
    } else if (complexity.level === 'MEDIUM') {
      // 中等复杂度：本地优先，除非明确需要专家分析
      useLocal = config.preferLocal !== false;
    } else if (complexity.level === 'COMPLEX') {
      // 复杂任务：尝试云端，但本地可作为后备
      useLocal = config.privacyMode || false;
    }
  }
  
  // 5. 尝试本地模型
  if (useLocal) {
    const localResponse = await callLocalModel(messages, userMessage, config);
    if (localResponse) {
      logger.info(`[ModelRouter] Local model responded in ${localResponse.latencyMs}ms`);
      return localResponse;
    }
    
    // 本地失败，检查是否需要降级
    if (!config.fallbackToCloud) {
      return {
        message: '抱歉爸爸，本地模型暂时无法响应，请稍后再试～',
        provider: 'LOCAL',
        model: 'fallback',
        latencyMs: Date.now() - startTime,
        fallbackUsed: true,
      };
    }
    
    logger.info('[ModelRouter] Falling back to cloud model');
  }
  
  // 6. 使用云端模型
  try {
    const cloudResult = await chatWithDashScope(messages, userMessage, storage);
    
    return {
      message: cloudResult.message,
      provider: 'CLOUD',
      model: config.cloudModel || 'qwen-turbo',
      latencyMs: Date.now() - startTime,
      chainOfThought: cloudResult.chainOfThought,
      fallbackUsed: useLocal, // 如果原本想用本地但降级了
    };
  } catch (error) {
    logger.error({ err: error }, '[ModelRouter] Cloud model error');
    
    // 云端也失败了，尝试服务器或本地
    const fallbackServer = selectBestServer(complexity);
    if (fallbackServer) {
      const serverResponse = await callServerModel(messages, userMessage, fallbackServer);
      if (serverResponse) {
        return { ...serverResponse, fallbackUsed: true };
      }
    }
    
    if (!useLocal && config.fallbackToCloud) {
      const localResponse = await callLocalModel(messages, userMessage, config);
      if (localResponse) {
        return { ...localResponse, fallbackUsed: true };
      }
    }
    
    return {
      message: '爸爸，我现在有点累，让我休息一下再回答你好吗？',
      provider: 'CLOUD',
      model: 'fallback',
      latencyMs: Date.now() - startTime,
      fallbackUsed: true,
    };
  }
}

// ===== 获取当前模型状态 =====
export async function getModelStatus(config?: Partial<ModelConfig>): Promise<{
  localAvailable: boolean;
  cloudAvailable: boolean;
  serversAvailable: number;
  servers: Array<{ endpoint: string; name?: string; model: string; healthy: boolean; gpuMemoryMB?: number }>;
  localModel?: string;
  cloudModel?: string;
  preferredProvider: ModelProvider;
}> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const localAvailable = await checkLocalModelHealth(mergedConfig);
  
  // 简单检查云端可用性（检查API key是否存在）
  const cloudAvailable = !!process.env.DASHSCOPE_API_KEY;
  
  // 检查所有服务器状态
  const serverList = getAvailableServers();
  const serverStatus = await Promise.all(
    serverList.map(async (s) => ({
      endpoint: s.endpoint,
      name: s.name,
      model: s.model,
      healthy: await checkServerHealth(s.endpoint),
      gpuMemoryMB: s.gpuMemoryMB,
    }))
  );
  const healthyServers = serverStatus.filter(s => s.healthy);
  
  let preferredProvider: ModelProvider = 'CLOUD';
  if (healthyServers.length > 0) {
    preferredProvider = 'SERVER';
  } else if (localAvailable && cloudAvailable) {
    preferredProvider = mergedConfig.preferLocal ? 'LOCAL' : 'CLOUD';
  } else if (localAvailable) {
    preferredProvider = 'LOCAL';
  } else if (cloudAvailable) {
    preferredProvider = 'CLOUD';
  }
  
  return {
    localAvailable,
    cloudAvailable,
    serversAvailable: healthyServers.length,
    servers: serverStatus,
    localModel: mergedConfig.localModel,
    cloudModel: mergedConfig.cloudModel,
    preferredProvider,
  };
}
