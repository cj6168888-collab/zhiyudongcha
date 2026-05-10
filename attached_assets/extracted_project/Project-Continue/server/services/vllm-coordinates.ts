/**
 * 小智 V-LLM Coordinates - 视觉大模型坐标定位
 * 
 * 功能：
 * 1. 调用视觉大模型分析屏幕截图
 * 2. 返回动态点击坐标（不再依赖固定映射）
 * 3. 支持多种V-LLM后端（DashScope Qwen-VL, GPT-4V, 本地模型）
 */

import { chatWithDashScope, type ChatMessage } from './dashscope';
import { getModulePrompt } from '../config/persona';

export type VLLMProvider = 'QWEN_VL' | 'GPT4V' | 'LOCAL' | 'OLLAMA';

export interface VLLMConfig {
  provider: VLLMProvider;
  localEndpoint?: string;
  maxRetries: number;
  timeout: number;
}

export interface CoordinateRequest {
  imageBase64: string;
  instruction: string;      // 例如："找到发送按钮的位置"
  screenWidth: number;
  screenHeight: number;
  context?: string;         // 当前APP上下文
}

export interface CoordinateResult {
  success: boolean;
  x: number;
  y: number;
  confidence: number;
  elementDescription: string;
  action: 'tap' | 'long_press' | 'swipe' | 'double_tap';
  alternativeCoordinates?: Array<{ x: number; y: number; description: string }>;
  reasoning?: string;
  provider: VLLMProvider;
  latencyMs: number;
}

const DEFAULT_CONFIG: VLLMConfig = {
  provider: 'QWEN_VL',
  maxRetries: 2,
  timeout: 30000,
};

/**
 * 构建视觉定位提示词
 */
function buildCoordinatePrompt(request: CoordinateRequest): string {
  return `你是小智的视觉定位模块。分析这张手机屏幕截图，找到用户想要操作的元素位置。

**任务**：${request.instruction}

**屏幕尺寸**：${request.screenWidth} x ${request.screenHeight}

**要求**：
1. 精确定位目标元素的中心点坐标
2. 坐标必须在屏幕范围内
3. 如果有多个可能的目标，列出所有候选

**输出格式（严格JSON）**：
{
  "found": true/false,
  "x": 像素坐标,
  "y": 像素坐标,
  "confidence": 0.0-1.0,
  "element": "元素描述",
  "action": "tap/long_press/swipe/double_tap",
  "alternatives": [{"x": 坐标, "y": 坐标, "description": "描述"}],
  "reasoning": "定位理由"
}`;
}

/**
 * 解析V-LLM返回的坐标
 */
function parseCoordinateResponse(
  response: string,
  request: CoordinateRequest
): Partial<CoordinateResult> {
  try {
    // 尝试提取JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    // 验证坐标范围
    const x = Math.max(0, Math.min(request.screenWidth, data.x || 0));
    const y = Math.max(0, Math.min(request.screenHeight, data.y || 0));
    
    return {
      success: data.found === true,
      x,
      y,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      elementDescription: data.element || '未知元素',
      action: data.action || 'tap',
      alternativeCoordinates: data.alternatives || [],
      reasoning: data.reasoning,
    };
  } catch (error) {
    console.error('[V-LLM] Failed to parse response:', error);
    
    // 尝试从文本中提取坐标
    const coordMatch = response.match(/[xX]\s*[:=]?\s*(\d+).*[yY]\s*[:=]?\s*(\d+)/);
    if (coordMatch) {
      return {
        success: true,
        x: parseInt(coordMatch[1]),
        y: parseInt(coordMatch[2]),
        confidence: 0.3,
        elementDescription: '从文本提取的坐标',
        action: 'tap',
      };
    }
    
    return {
      success: false,
      x: 0,
      y: 0,
      confidence: 0,
      elementDescription: '解析失败',
    };
  }
}

/**
 * V-LLM坐标定位服务
 */
class VLLMCoordinateService {
  private config: VLLMConfig;
  
  constructor(config?: Partial<VLLMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 使用Qwen-VL定位坐标
   */
  private async locateWithQwenVL(request: CoordinateRequest): Promise<string> {
    const prompt = buildCoordinatePrompt(request);
    
    // 构建带图片的消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是精确的视觉定位AI，专门分析手机屏幕截图并返回点击坐标。',
      },
    ];
    
    // 注意：实际调用需要DashScope支持多模态
    // 这里先用纯文本模拟，实际实现需要base64图片
    const imagePrompt = `[屏幕截图已附加]\n\n${prompt}`;
    
    const result = await chatWithDashScope(messages, imagePrompt);
    return result.message;
  }
  
  /**
   * 使用本地Ollama视觉模型
   */
  private async locateWithOllama(request: CoordinateRequest): Promise<string> {
    const endpoint = this.config.localEndpoint || 'http://localhost:11434/api/generate';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',  // 或其他视觉模型
        prompt: buildCoordinatePrompt(request),
        images: [request.imageBase64],
        stream: false,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response || '';
  }
  
  /**
   * 定位屏幕元素坐标
   */
  async locateElement(request: CoordinateRequest): Promise<CoordinateResult> {
    const startTime = Date.now();
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        let response: string;
        
        switch (this.config.provider) {
          case 'QWEN_VL':
            response = await this.locateWithQwenVL(request);
            break;
          case 'OLLAMA':
          case 'LOCAL':
            response = await this.locateWithOllama(request);
            break;
          default:
            response = await this.locateWithQwenVL(request);
        }
        
        const parsed = parseCoordinateResponse(response, request);
        const latencyMs = Date.now() - startTime;
        
        console.log(`[V-LLM] Located element in ${latencyMs}ms: (${parsed.x}, ${parsed.y})`);
        
        return {
          success: parsed.success || false,
          x: parsed.x || 0,
          y: parsed.y || 0,
          confidence: parsed.confidence || 0,
          elementDescription: parsed.elementDescription || '',
          action: parsed.action || 'tap',
          alternativeCoordinates: parsed.alternativeCoordinates,
          reasoning: parsed.reasoning,
          provider: this.config.provider,
          latencyMs,
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.log(`[V-LLM] Attempt ${attempt + 1} failed: ${lastError.message}`);
        
        if (attempt < this.config.maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    
    return {
      success: false,
      x: 0,
      y: 0,
      confidence: 0,
      elementDescription: `定位失败: ${lastError?.message}`,
      action: 'tap',
      provider: this.config.provider,
      latencyMs: Date.now() - startTime,
    };
  }
  
  /**
   * 批量定位多个元素
   */
  async locateMultiple(
    imageBase64: string,
    instructions: string[],
    screenWidth: number,
    screenHeight: number
  ): Promise<CoordinateResult[]> {
    const results = await Promise.all(
      instructions.map(instruction =>
        this.locateElement({
          imageBase64,
          instruction,
          screenWidth,
          screenHeight,
        })
      )
    );
    
    return results;
  }
  
  /**
   * 智能定位：结合意图映射和V-LLM
   */
  async smartLocate(
    imageBase64: string,
    userIntent: string,
    screenWidth: number,
    screenHeight: number,
    fallbackCoordinate?: { x: number; y: number }
  ): Promise<CoordinateResult> {
    // 先尝试V-LLM精确定位
    const vllmResult = await this.locateElement({
      imageBase64,
      instruction: userIntent,
      screenWidth,
      screenHeight,
    });
    
    // 如果V-LLM成功且置信度高，使用其结果
    if (vllmResult.success && vllmResult.confidence > 0.7) {
      return vllmResult;
    }
    
    // 如果有降级坐标且V-LLM失败，使用降级坐标
    if (fallbackCoordinate && !vllmResult.success) {
      return {
        ...vllmResult,
        success: true,
        x: fallbackCoordinate.x,
        y: fallbackCoordinate.y,
        confidence: 0.5,
        elementDescription: '使用固定映射坐标（V-LLM降级）',
      };
    }
    
    return vllmResult;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<VLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取服务状态
   */
  getStatus(): VLLMConfig {
    return { ...this.config };
  }
}

// 全局实例
export const vllmCoordinates = new VLLMCoordinateService();

// 导出类
export { VLLMCoordinateService };
