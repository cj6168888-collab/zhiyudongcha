/**
 * Project Unbound - V-LLM Grounding (视觉大模型定位)
 * 
 * Z1 协议合规 - 严禁使用 OpenAI SDK，全面适配国产大模型
 * 
 * 功能：
 * 1. 使用视觉大模型识别屏幕元素
 * 2. 通过自然语言描述定位按钮/输入框
 * 3. 不依赖控件ID，只需"看到"就能操作
 * 4. 万能后备方案
 * 
 * 支持的模型（国产优先）：
 * - DashScope Qwen-VL-Plus/Max（通义千问视觉）
 * - Doubao-VL（豆包视觉，字节跳动）
 * - Local Ollama LLaVA（本地离线）
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('VllmGrounding');

import { DetectedObject, ScreenRegion } from './vision-trigger';

// ==================== 类型定义 ====================

export type VLLMProvider = 'DASHSCOPE' | 'DOUBAO' | 'OLLAMA' | 'MOCK';

export interface VLLMConfig {
  provider: VLLMProvider;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeout: number;
  maxRetries: number;
}

export interface GroundingRequest {
  image: string;                    // base64 编码的图像
  target: string;                   // 自然语言描述的目标
  context?: string;                 // 附加上下文
  multiple?: boolean;               // 是否返回多个结果
  preferredRegion?: ScreenRegion;   // 优先搜索区域
}

export interface GroundingResult {
  found: boolean;
  confidence: number;
  target: string;
  coordinates?: { x: number; y: number };
  boundingBox?: ScreenRegion;
  elementType?: 'button' | 'input' | 'text' | 'image' | 'icon' | 'link' | 'unknown';
  alternativeMatches?: GroundingMatch[];
  rawResponse?: string;
  provider: VLLMProvider;
  latencyMs: number;
}

export interface GroundingMatch {
  coordinates: { x: number; y: number };
  boundingBox: ScreenRegion;
  confidence: number;
  label: string;
}

export interface ScreenAnalysis {
  elements: AnalyzedElement[];
  layout: LayoutInfo;
  context: string;
  timestamp: number;
}

export interface AnalyzedElement {
  id: string;
  type: 'button' | 'input' | 'text' | 'image' | 'icon' | 'link' | 'container' | 'unknown';
  label: string;
  coordinates: { x: number; y: number };
  boundingBox: ScreenRegion;
  confidence: number;
  interactable: boolean;
  state?: 'enabled' | 'disabled' | 'selected' | 'focused';
}

export interface LayoutInfo {
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  hasNavBar: boolean;
  hasStatusBar: boolean;
  contentRegion: ScreenRegion;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIGS: Record<VLLMProvider, Partial<VLLMConfig>> = {
  DASHSCOPE: {
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    model: 'qwen-vl-plus',
    timeout: 30000,
    maxRetries: 2,
  },
  DOUBAO: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-vision-pro-32k',
    timeout: 30000,
    maxRetries: 2,
  },
  OLLAMA: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llava',
    timeout: 30000,
    maxRetries: 1,
  },
  MOCK: {
    timeout: 100,
    maxRetries: 0,
  },
};

// ==================== Prompt 模板 ====================

const GROUNDING_PROMPT_TEMPLATE = `你是一个专业的屏幕元素识别助手。
分析这张屏幕截图，找到用户描述的目标元素。

目标: {target}
{context}

请返回以下JSON格式的结果：
{
  "found": true/false,
  "confidence": 0-1的置信度,
  "x": 中心点X坐标(像素),
  "y": 中心点Y坐标(像素),
  "width": 元素宽度,
  "height": 元素高度,
  "type": "button/input/text/image/icon/link/unknown",
  "label": "元素上的文字或描述"
}

如果找不到目标，返回 {"found": false, "reason": "原因"}`;

const SCREEN_ANALYSIS_PROMPT = `分析这张屏幕截图，识别所有可交互的UI元素。

返回JSON格式：
{
  "elements": [
    {
      "id": "唯一标识",
      "type": "button/input/text/image/icon/link/container",
      "label": "元素文字或描述",
      "x": X坐标,
      "y": Y坐标,
      "width": 宽度,
      "height": 高度,
      "interactable": true/false,
      "state": "enabled/disabled/selected/focused"
    }
  ],
  "layout": {
    "orientation": "portrait/landscape",
    "hasNavBar": true/false,
    "hasStatusBar": true/false
  },
  "context": "对屏幕内容的简要描述"
}`;

// ==================== V-LLM 适配器 ====================

interface VLLMAdapter {
  analyze(image: string, prompt: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

class DashScopeAdapter implements VLLMAdapter {
  private config: VLLMConfig;

  constructor(config: VLLMConfig) {
    this.config = config;
  }

  async analyze(image: string, prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('DashScope API key not configured');
    }

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: `data:image/png;base64,${image}` },
                { text: prompt },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`DashScope API error: ${response.status}`);
    }

    const data = await response.json();
    return data.output?.choices?.[0]?.message?.content || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }
}

class DoubaoVLAdapter implements VLLMAdapter {
  private config: VLLMConfig;

  constructor(config: VLLMConfig) {
    this.config = config;
  }

  async analyze(image: string, prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Doubao API key not configured');
    }

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Doubao API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }
}

class OllamaAdapter implements VLLMAdapter {
  private config: VLLMConfig;

  constructor(config: VLLMConfig) {
    this.config = config;
  }

  async analyze(image: string, prompt: string): Promise<string> {
    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        images: [image],
        stream: false,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.config.endpoint!.replace('/generate', '/tags'), {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class MockAdapter implements VLLMAdapter {
  async analyze(image: string, prompt: string): Promise<string> {
    // 模拟响应
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 基于 prompt 生成模拟响应
    if (prompt.includes('目标:')) {
      return JSON.stringify({
        found: true,
        confidence: 0.85,
        x: 540,
        y: 960,
        width: 200,
        height: 50,
        type: 'button',
        label: '确认按钮',
      });
    }
    
    return JSON.stringify({
      elements: [
        { id: 'btn_1', type: 'button', label: '确认', x: 540, y: 960, width: 200, height: 50, interactable: true },
        { id: 'btn_2', type: 'button', label: '取消', x: 540, y: 1040, width: 200, height: 50, interactable: true },
      ],
      layout: { orientation: 'portrait', hasNavBar: true, hasStatusBar: true },
      context: '对话框页面，包含确认和取消按钮',
    });
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

// ==================== V-LLM Grounding 服务 ====================

class VLLMGroundingService {
  private config: VLLMConfig;
  private adapter: VLLMAdapter;
  private cache: Map<string, GroundingResult> = new Map();
  private cacheTimeout: number = 5000; // 缓存5秒

  constructor(config?: Partial<VLLMConfig>) {
    const provider = config?.provider ?? 'MOCK';
    this.config = {
      provider,
      ...DEFAULT_CONFIGS[provider],
      ...config,
    } as VLLMConfig;
    
    this.adapter = this.createAdapter();
  }

  private createAdapter(): VLLMAdapter {
    switch (this.config.provider) {
      case 'DASHSCOPE':
        return new DashScopeAdapter(this.config);
      case 'DOUBAO':
        return new DoubaoVLAdapter(this.config);
      case 'OLLAMA':
        return new OllamaAdapter(this.config);
      case 'MOCK':
      default:
        return new MockAdapter();
    }
  }

  /**
   * 设置 API Key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.adapter = this.createAdapter();
  }

  /**
   * 切换提供商
   * Z1 协议硬保护：拒绝 OPENAI provider
   */
  setProvider(provider: VLLMProvider | string, config?: Partial<VLLMConfig>): void {
    if (provider === 'OPENAI' || provider.toLowerCase().includes('openai')) {
      logger.error('[VLLMGrounding] Z1 协议违规：OPENAI provider 被禁止，使用 DASHSCOPE 替代');
      provider = 'DASHSCOPE';
    }
    
    const validProvider = provider as VLLMProvider;
    this.config = {
      ...this.config,
      provider: validProvider,
      ...DEFAULT_CONFIGS[validProvider],
      ...config,
    };
    this.adapter = this.createAdapter();
    logger.info(`[VLLMGrounding] Provider switched to: ${validProvider}`);
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    return this.adapter.isAvailable();
  }

  /**
   * 定位屏幕元素
   */
  async ground(request: GroundingRequest): Promise<GroundingResult> {
    const startTime = Date.now();
    
    // 检查缓存
    const cacheKey = `${request.target}_${request.image.substring(0, 100)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - startTime < this.cacheTimeout) {
      return { ...cached, latencyMs: 0 };
    }

    try {
      // 构建 prompt
      const prompt = GROUNDING_PROMPT_TEMPLATE
        .replace('{target}', request.target)
        .replace('{context}', request.context ? `上下文: ${request.context}` : '');

      // 调用模型
      const response = await this.adapter.analyze(request.image, prompt);
      
      // 解析响应
      const result = this.parseGroundingResponse(response, request.target, startTime);
      
      // 缓存结果
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      return {
        found: false,
        confidence: 0,
        target: request.target,
        rawResponse: error instanceof Error ? error.message : String(error),
        provider: this.config.provider,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 批量定位多个元素
   */
  async groundMultiple(
    image: string,
    targets: string[]
  ): Promise<Map<string, GroundingResult>> {
    const results = new Map<string, GroundingResult>();
    
    // 并行处理
    const promises = targets.map(target => 
      this.ground({ image, target }).then(result => ({ target, result }))
    );
    
    const settled = await Promise.allSettled(promises);
    
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.target, outcome.value.result);
      }
    }
    
    return results;
  }

  /**
   * 分析整个屏幕
   */
  async analyzeScreen(image: string): Promise<ScreenAnalysis> {
    const startTime = Date.now();
    
    try {
      const response = await this.adapter.analyze(image, SCREEN_ANALYSIS_PROMPT);
      return this.parseScreenAnalysis(response, startTime);
    } catch (error) {
      logger.error({ err: error }, 'Screen analysis failed');
      return {
        elements: [],
        layout: {
          screenWidth: 1080,
          screenHeight: 1920,
          orientation: 'portrait',
          hasNavBar: true,
          hasStatusBar: true,
          contentRegion: { x: 0, y: 0, width: 1080, height: 1920 },
        },
        context: 'Analysis failed',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 查找并点击元素
   */
  async findClickTarget(
    image: string,
    description: string
  ): Promise<{ x: number; y: number } | null> {
    const result = await this.ground({ image, target: description });
    
    if (result.found && result.coordinates) {
      return result.coordinates;
    }
    
    return null;
  }

  /**
   * 智能查找输入框
   */
  async findInputField(
    image: string,
    fieldDescription: string
  ): Promise<GroundingResult> {
    const result = await this.ground({
      image,
      target: fieldDescription,
      context: '这是一个输入框或文本域',
    });
    
    if (result.found && result.elementType !== 'input') {
      result.elementType = 'input';
    }
    
    return result;
  }

  private parseGroundingResponse(
    response: string,
    target: string,
    startTime: number
  ): GroundingResult {
    try {
      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      if (!data.found) {
        return {
          found: false,
          confidence: 0,
          target,
          rawResponse: response,
          provider: this.config.provider,
          latencyMs: Date.now() - startTime,
        };
      }
      
      return {
        found: true,
        confidence: data.confidence ?? 0.8,
        target,
        coordinates: { x: data.x, y: data.y },
        boundingBox: {
          x: data.x - (data.width ?? 100) / 2,
          y: data.y - (data.height ?? 50) / 2,
          width: data.width ?? 100,
          height: data.height ?? 50,
        },
        elementType: data.type ?? 'unknown',
        rawResponse: response,
        provider: this.config.provider,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ err: error }, 'Parse error');
      return {
        found: false,
        confidence: 0,
        target,
        rawResponse: response,
        provider: this.config.provider,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private parseScreenAnalysis(response: string, startTime: number): ScreenAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      interface ParsedElement {
        id?: string;
        type?: AnalyzedElement['type'];
        label?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        confidence?: number;
        interactable?: boolean;
        state?: AnalyzedElement['state'];
      }
      
      const elements: AnalyzedElement[] = (data.elements || []).map((e: ParsedElement, i: number) => ({
        id: e.id ?? `elem_${i}`,
        type: e.type ?? 'unknown',
        label: e.label ?? '',
        coordinates: { x: e.x ?? 0, y: e.y ?? 0 },
        boundingBox: {
          x: (e.x ?? 0) - (e.width ?? 100) / 2,
          y: (e.y ?? 0) - (e.height ?? 50) / 2,
          width: e.width ?? 100,
          height: e.height ?? 50,
        },
        confidence: e.confidence ?? 0.8,
        interactable: e.interactable ?? true,
        state: e.state,
      }));
      
      return {
        elements,
        layout: {
          screenWidth: 1080,
          screenHeight: 1920,
          orientation: data.layout?.orientation ?? 'portrait',
          hasNavBar: data.layout?.hasNavBar ?? true,
          hasStatusBar: data.layout?.hasStatusBar ?? true,
          contentRegion: { x: 0, y: 0, width: 1080, height: 1920 },
        },
        context: data.context ?? '',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error({ err: error }, 'Screen analysis parse error');
      return {
        elements: [],
        layout: {
          screenWidth: 1080,
          screenHeight: 1920,
          orientation: 'portrait',
          hasNavBar: true,
          hasStatusBar: true,
          contentRegion: { x: 0, y: 0, width: 1080, height: 1920 },
        },
        context: 'Parse failed',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取当前配置
   */
  getConfig(): VLLMConfig {
    return { ...this.config };
  }
}

// ==================== 任务会话追踪 (借鉴Fara-7B步骤效率) ====================

export interface TaskStep {
  id: string;
  action: string;
  target?: string;
  success: boolean;
  latencyMs: number;
  retries: number;
  screenshotHash?: string;
  timestamp: number;
}

export interface TaskSession {
  id: string;
  taskDescription: string;
  steps: TaskStep[];
  startTime: number;
  endTime?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  avgStepLatencyMs: number;
  efficiency: number;
}

class TaskSessionTracker {
  private sessions: Map<string, TaskSession> = new Map();
  private sessionHistory: TaskSession[] = [];
  private readonly EFFICIENCY_BASELINE = 20;
  
  startSession(taskDescription: string): TaskSession {
    const session: TaskSession = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskDescription,
      steps: [],
      startTime: Date.now(),
      status: 'RUNNING',
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      avgStepLatencyMs: 0,
      efficiency: 100,
    };
    
    this.sessions.set(session.id, session);
    logger.info(`[TaskSession] 开始任务: ${taskDescription} (${session.id})`);
    return session;
  }
  
  recordStep(
    sessionId: string,
    action: string,
    success: boolean,
    latencyMs: number,
    target?: string,
    retries: number = 0
  ): TaskStep | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const step: TaskStep = {
      id: `step_${session.steps.length + 1}`,
      action,
      target,
      success,
      latencyMs,
      retries,
      timestamp: Date.now(),
    };
    
    session.steps.push(step);
    session.totalSteps++;
    
    if (success) {
      session.successfulSteps++;
    } else {
      session.failedSteps++;
    }
    
    const totalLatency = session.steps.reduce((sum, s) => sum + s.latencyMs, 0);
    session.avgStepLatencyMs = Math.round(totalLatency / session.steps.length);
    
    session.efficiency = this.calculateEfficiency(session);
    
    logger.info(`[TaskSession] Step ${step.id}: ${action} - ${success ? '✓' : '✗'} (${latencyMs}ms, 效率: ${session.efficiency}%)`);
    return step;
  }
  
  private calculateEfficiency(session: TaskSession): number {
    if (session.totalSteps === 0) return 100;
    
    const successRate = session.successfulSteps / session.totalSteps;
    const stepPenalty = Math.max(0, 1 - (session.totalSteps - this.EFFICIENCY_BASELINE) / this.EFFICIENCY_BASELINE * 0.5);
    const retryPenalty = 1 - session.steps.reduce((sum, s) => sum + s.retries, 0) / (session.totalSteps * 3);
    
    return Math.round(successRate * stepPenalty * retryPenalty * 100);
  }
  
  completeSession(sessionId: string, success: boolean): TaskSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    session.status = success ? 'COMPLETED' : 'FAILED';
    session.endTime = Date.now();
    
    this.sessions.delete(sessionId);
    this.sessionHistory.push(session);
    
    const duration = session.endTime - session.startTime;
    logger.info(`[TaskSession] 任务${success ? '完成' : '失败'}: ${session.taskDescription}`);
    logger.info(`[TaskSession] 统计: ${session.totalSteps}步, ${session.successfulSteps}成功, 耗时${duration}ms, 效率${session.efficiency}%`);
    
    return session;
  }
  
  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'PAUSED';
    return true;
  }
  
  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'RUNNING';
    return true;
  }
  
  getSession(sessionId: string): TaskSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  getActiveSessions(): TaskSession[] {
    return Array.from(this.sessions.values());
  }
  
  getSessionHistory(limit: number = 50): TaskSession[] {
    return this.sessionHistory.slice(-limit);
  }
  
  getEfficiencyStats(): {
    avgEfficiency: number;
    avgStepsPerTask: number;
    avgLatencyPerStep: number;
    tasksCompleted: number;
    tasksFailed: number;
    bestEfficiency: number;
    worstEfficiency: number;
  } {
    if (this.sessionHistory.length === 0) {
      return {
        avgEfficiency: 100,
        avgStepsPerTask: 0,
        avgLatencyPerStep: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        bestEfficiency: 100,
        worstEfficiency: 100,
      };
    }
    
    const completed = this.sessionHistory.filter(s => s.status === 'COMPLETED');
    const failed = this.sessionHistory.filter(s => s.status === 'FAILED');
    
    const efficiencies = this.sessionHistory.map(s => s.efficiency);
    const avgEfficiency = Math.round(efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length);
    const avgSteps = Math.round(this.sessionHistory.reduce((sum, s) => sum + s.totalSteps, 0) / this.sessionHistory.length);
    const avgLatency = Math.round(this.sessionHistory.reduce((sum, s) => sum + s.avgStepLatencyMs, 0) / this.sessionHistory.length);
    
    return {
      avgEfficiency,
      avgStepsPerTask: avgSteps,
      avgLatencyPerStep: avgLatency,
      tasksCompleted: completed.length,
      tasksFailed: failed.length,
      bestEfficiency: Math.max(...efficiencies),
      worstEfficiency: Math.min(...efficiencies),
    };
  }
}

export const taskSessionTracker = new TaskSessionTracker();

// ==================== 导出 ====================

// 初始化服务 - 优先使用 DashScope（如果有 API Key）
const initVLLMGrounding = (): VLLMGroundingService => {
  const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  
  if (dashscopeApiKey) {
    logger.info('[VLLMGrounding] Initializing with DashScope provider');
    return new VLLMGroundingService({
      provider: 'DASHSCOPE',
      apiKey: dashscopeApiKey,
    });
  }
  
  // 检查是否有本地 Ollama
  logger.info('[VLLMGrounding] No API key found, using MOCK provider');
  return new VLLMGroundingService({
    provider: 'MOCK',
  });
};

export const vllmGrounding = initVLLMGrounding();
export { VLLMGroundingService };

export default vllmGrounding;
