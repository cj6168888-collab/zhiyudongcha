/**
 * 视觉识别服务 - VisionRecognitionService
 *
 * 提供屏幕分析、UI元素识别、视觉定位功能
 * 集成 OmniParser 和 V-LLM 进行屏幕理解
 */

import { createServiceLogger } from '../../lib/logger';
import { chatWithDashScope, type ChatMessage } from '../dashscope';
import deviceConnectionService from './DeviceConnectionService';
import mobileExecutorService from './MobileExecutorService';
import type {
  ScreenCapture,
  UIElement,
  OperationError,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('VisionRecognition');

interface AnalyzeScreenOptions {
  includeElements?: boolean;
  includeText?: boolean;
  includeLayout?: boolean;
  customPrompt?: string;
}

interface ElementQuery {
  text?: string;
  type?: string;
  clickable?: boolean;
  editable?: boolean;
  scrollable?: boolean;
  visible?: boolean;
}

interface VisionModelConfig {
  provider: 'QWEN_VL' | 'GPT4V' | 'OLLAMA' | 'LOCAL';
  model?: string;
  apiKey?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ScreenAnalysis {
  capture: ScreenCapture;
  elements?: UIElement[];
  textContent?: string;
  layout?: {
    type: 'PORTRAIT' | 'LANDSCAPE';
    hasStatusBar: boolean;
    hasNavigationBar: boolean;
    safeAreas: { top: number; bottom: number; left: number; right: number };
  };
  summary?: string;
  suggestions?: string[];
  timestamp: number;
}

const DEFAULT_VISION_CONFIG: VisionModelConfig = {
  provider: 'QWEN_VL',
  model: 'qwen-vl-max',
  temperature: 0.1,
  maxTokens: 2000,
};

class VisionRecognitionService {
  private config: VisionModelConfig;
  private elementCache: Map<string, { elements: UIElement[]; timestamp: number }> = new Map();
  private analysisCache: Map<string, { result: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5000;
  private analysisCacheTimeout = 30000; // 分析结果缓存30秒
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(config: Partial<VisionModelConfig> = {}) {
    this.config = { ...DEFAULT_VISION_CONFIG, ...config };
  }

  /**
   * 带重试的异步执行辅助方法
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries,
    delay: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ attempt, error: lastError.message }, 'Retry attempt failed');

        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  }

  /**
   * 获取缓存的分析结果
   */
  private getCachedAnalysis(cacheKey: string): unknown | null {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.analysisCacheTimeout) {
      logger.info({ cacheKey }, 'Using cached analysis result');
      return cached.result;
    }
    return null;
  }

  /**
   * 缓存分析结果
   */
  private cacheAnalysis(cacheKey: string, result: unknown): void {
    this.analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // 限制缓存大小
    if (this.analysisCache.size > 100) {
      const oldestKey = this.analysisCache.keys().next().value;
      if (oldestKey) {
        this.analysisCache.delete(oldestKey);
      }
    }
  }

  /**
   * 直接从Base64图片提取文字（不依赖设备截屏）
   * 修复: processFromScreenshot 方法虽然接收了 imageBase64 参数，但未实际使用
   */
  async analyzeBase64Image(
    base64Data: string,
    options: {
      includeElements?: boolean;
      includeText?: boolean;
      customPrompt?: string;
    } = {}
  ): Promise<ScreenAnalysis> {
    // 清理Base64数据，移除data:image/xxx;base64,前缀
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // 将Base64转换为屏幕捕获对象
    const capture: ScreenCapture = {
      data: cleanBase64,
      width: 0,  // 无法从Base64获取尺寸，设为0
      height: 0,
      timestamp: Date.now(),
      format: 'jpeg'
    };

    const result: ScreenAnalysis = {
      capture,
      timestamp: Date.now(),
    };

    // 尝试使用视觉AI模型提取文字内容
    if (options.includeText !== false) {
      try {
        result.textContent = await this.extractTextFromBase64(cleanBase64, options.customPrompt);
      } catch (error) {
        logger.error({ error }, 'Failed to extract text from base64 image');
        result.textContent = undefined;
      }
    }

    logger.info({
      hasText: !!result.textContent,
      textLength: result.textContent?.length || 0,
    }, 'Base64 image analyzed');

    return result;
  }

  /**
   * 使用视觉模型从Base64图片提取文字
   */
  private async extractTextFromBase64(base64Data: string, customPrompt?: string): Promise<string> {
    if (this.config.provider === 'LOCAL') {
      return 'Local vision model not configured';
    }

    const prompt = customPrompt || `请仔细识别这张图片中的所有文字内容，包括：
1. 文档标题
2. 收件人/发件人信息
3. 日期和编号
4. 正文内容
5. 签名和落款

请按原文逐字识别，不要遗漏任何文字信息。`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { image: base64Data, type: 'image_url' },
            { text: prompt, type: 'text' }
          ]
        }
      ];

      const response = await chatWithDashScope(
        messages,
        this.config.model || 'qwen-vl-max',
        {
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }
      );

      return response;
    } catch (error) {
      logger.error({ error }, 'Failed to extract text via vision model');
      throw error;
    }
  }

  /**
   * 传统的OCR文字识别（备用方案，不依赖视觉模型）
   */
  async recognizeTextFromBase64(base64Data: string): Promise<{ text: string; confidence: number }> {
    // 方案1: 尝试使用 Tesseract.js（需要安装）
    // 方案2: 调用第三方OCR API
    // 这里先返回占位实现
    logger.warn('OCR recognition requires external OCR service integration');
    return { text: '', confidence: 0 };
  }

  async analyzeScreen(deviceId: string, options: AnalyzeScreenOptions = {}): Promise<ScreenAnalysis> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'screenCapture');
    if (validationError) {
      throw validationError;
    }

    const capture = await mobileExecutorService.takeScreenshot(deviceId);

    const result: ScreenAnalysis = {
      capture,
      timestamp: Date.now(),
    };

    if (options.includeElements !== false) {
      try {
        const elementsResponse = await deviceConnectionService.sendRequest<{ elements: UIElement[] }>(
          deviceId,
          'ELEMENTS',
          {},
          15000
        );
        result.elements = elementsResponse.elements;

        this.elementCache.set(deviceId, {
          elements: elementsResponse.elements,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.warn({ deviceId, error }, 'Failed to get UI elements');
      }
    }

    if (options.includeText !== false && result.elements) {
      result.textContent = this.extractTextContent(result.elements);
    }

    if (options.includeLayout !== false) {
      result.layout = this.analyzeLayout(result.capture, result.elements);
    }

    if (options.customPrompt || this.config.provider !== 'LOCAL') {
      try {
        result.summary = await this.generateScreenSummary(capture, options.customPrompt);

        if (result.elements) {
          result.suggestions = this.generateSuggestions(result.elements);
        }
      } catch (error) {
        logger.warn({ deviceId, error }, 'Failed to generate AI summary');
      }
    }

    logger.info({
      deviceId,
      elements: result.elements?.length || 0,
      hasSummary: !!result.summary,
    }, 'Screen analyzed');

    return result;
  }

  async findElements(deviceId: string, query: ElementQuery): Promise<UIElement[]> {
    const cached = this.elementCache.get(deviceId);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return this.filterElements(cached.elements, query);
    }

    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'screenCapture');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ elements: UIElement[] }>(
        deviceId,
        'ELEMENTS',
        query,
        15000
      );

      const elements = result.elements || [];

      this.elementCache.set(deviceId, {
        elements,
        timestamp: Date.now(),
      });

      return elements;
    } catch (error) {
      logger.error({ deviceId, query, error }, 'Failed to find elements');
      throw createError(
        ERROR_CODES.ACTION_FAILED,
        'Failed to find UI elements',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private filterElements(elements: UIElement[], query: ElementQuery): UIElement[] {
    return elements.filter(element => {
      if (query.text && !element.text.toLowerCase().includes(query.text.toLowerCase())) {
        return false;
      }
      if (query.type && element.type !== query.type) {
        return false;
      }
      if (query.clickable !== undefined && element.clickable !== query.clickable) {
        return false;
      }
      if (query.editable !== undefined && element.editable !== query.editable) {
        return false;
      }
      if (query.scrollable !== undefined && element.scrollable !== query.scrollable) {
        return false;
      }
      if (query.visible !== undefined && element.visible !== query.visible) {
        return false;
      }
      return true;
    });
  }

  async clickElement(deviceId: string, elementQuery: ElementQuery): Promise<{ success: boolean; element?: UIElement }> {
    const elements = await this.findElements(deviceId, elementQuery);

    if (elements.length === 0) {
      return { success: false };
    }

    const element = elements[0];
    const centerX = Math.round((element.bounds.left + element.bounds.right) / 2);
    const centerY = Math.round((element.bounds.top + element.bounds.bottom) / 2);

    const result = await mobileExecutorService.click(deviceId, centerX, centerY);

    return {
      success: result.success,
      element,
    };
  }

  async findTextOnScreen(deviceId: string, text: string): Promise<{
    found: boolean;
    elements: Array<{ element: UIElement; confidence: number }>;
  }> {
    const allElements = await this.findElements(deviceId, {});

    const matched: Array<{ element: UIElement; confidence: number }> = [];

    for (const element of allElements) {
      if (element.text.toLowerCase().includes(text.toLowerCase())) {
        const confidence = this.calculateTextMatchConfidence(element.text, text);
        matched.push({ element, confidence });
      }
    }

    matched.sort((a, b) => b.confidence - a.confidence);

    return {
      found: matched.length > 0,
      elements: matched,
    };
  }

  private calculateTextMatchConfidence(actual: string, expected: string): number {
    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();

    if (actualLower === expectedLower) return 1.0;
    if (actualLower.includes(expectedLower)) return 0.9;

    const levenshteinDistance = this.levenshtein(actualLower, expectedLower);
    const maxLength = Math.max(actualLower.length, expectedLower.length);

    return Math.max(0, 1 - (levenshteinDistance / maxLength));
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private extractTextContent(elements: UIElement[]): string {
    const textElements = elements.filter(e => e.text && e.text.trim().length > 0);
    return textElements.map(e => e.text.trim()).join('\n');
  }

  private analyzeLayout(
    capture: ScreenCapture,
    elements?: UIElement[]
  ): ScreenAnalysis['layout'] {
    const isPortrait = capture.height > capture.width;

    let hasStatusBar = false;
    let hasNavigationBar = false;

    if (elements) {
      const topElements = elements.filter(e => e.bounds.top < 50);
      const bottomElements = elements.filter(e => e.bounds.bottom > capture.height - 50);

      hasStatusBar = topElements.some(e =>
        e.type === 'TEXT_VIEW' || e.type === 'IMAGE_VIEW'
      );
      hasNavigationBar = bottomElements.some(e =>
        e.text?.toLowerCase().includes('navigation') ||
        e.contentDescription?.toLowerCase().includes('back') ||
        e.contentDescription?.toLowerCase().includes('home')
      );
    }

    return {
      type: isPortrait ? 'PORTRAIT' : 'LANDSCAPE',
      hasStatusBar,
      hasNavigationBar,
      safeAreas: {
        top: hasStatusBar ? 25 : 0,
        bottom: hasNavigationBar ? 25 : 0,
        left: 0,
        right: 0,
      },
    };
  }

  private async generateScreenSummary(capture: ScreenCapture, customPrompt?: string): Promise<string> {
    if (this.config.provider === 'LOCAL') {
      return 'Local vision model not configured';
    }

    const prompt = customPrompt || `请分析这张手机屏幕截图，描述：
1. 屏幕的主要内容
2. 主要的交互元素（按钮、输入框等）
3. 当前应用或页面类型
4. 用户可能的操作意图

请用简洁的中文描述。`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { image: capture.data, type: 'image_url' },
            { text: prompt, type: 'text' }
          ]
        }
      ];

      const response = await chatWithDashScope(
        messages,
        this.config.model || 'qwen-vl-max',
        {
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }
      );

      return response;
    } catch (error) {
      logger.error({ error }, 'Failed to generate screen summary');
      return '屏幕分析失败';
    }
  }

  private generateSuggestions(elements: UIElement[]): string[] {
    const suggestions: string[] = [];

    const buttons = elements.filter(e => e.clickable && e.type === 'BUTTON');
    if (buttons.length > 0) {
      suggestions.push(`发现 ${buttons.length} 个可点击按钮`);
    }

    const inputs = elements.filter(e => e.editable);
    if (inputs.length > 0) {
      suggestions.push(`发现 ${inputs.length} 个可编辑输入框`);
    }

    const scrollable = elements.filter(e => e.scrollable);
    if (scrollable.length > 0) {
      suggestions.push('页面可以滚动');
    }

    const dialogs = elements.filter(e => e.type === 'DIALOG');
    if (dialogs.length > 0) {
      suggestions.push('检测到对话框或弹窗');
    }

    return suggestions;
  }

  clearCache(deviceId?: string): void {
    if (deviceId) {
      this.elementCache.delete(deviceId);
    } else {
      this.elementCache.clear();
    }
    logger.info({ deviceId }, 'Vision cache cleared');
  }

  setConfig(config: Partial<VisionModelConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Vision config updated');
  }

  getConfig(): VisionModelConfig {
    return { ...this.config };
  }
}

export const visionRecognitionService = new VisionRecognitionService();
export default visionRecognitionService;
