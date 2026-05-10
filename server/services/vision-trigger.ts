/**
 * 小智 Vision Trigger - 视觉初判服务
 * 
 * 功能：
 * 1. 轻量级屏幕变化检测（基于图像差异）
 * 2. 为 YOLOv8/MobileNet 预留接口
 * 3. 智能决定是否需要调用视觉大模型
 * 
 * 设计理念：
 * - 本地先做粗筛，节省云端调用
 * - 只有检测到重要变化才触发深度分析
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('VisionTrigger');

export type VisionModelType = 'SIMPLE' | 'YOLO' | 'MOBILENET' | 'VLLM';

export interface VisionConfig {
  changeThreshold: number;      // 变化阈值 (0-1)
  minChangeArea: number;        // 最小变化区域 (像素)
  checkInterval: number;        // 检测间隔 (ms)
  localModelEndpoint?: string;  // 本地视觉模型API
  preferredModel: VisionModelType;
}

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: ScreenRegion;
  category: 'button' | 'text' | 'input' | 'image' | 'icon' | 'unknown';
}

export interface VisionAnalysis {
  hasChanged: boolean;
  changeScore: number;
  changedRegions: ScreenRegion[];
  detectedObjects: DetectedObject[];
  suggestDeepAnalysis: boolean;
  timestamp: number;
  provider: VisionModelType;
  latencyMs: number;
}

export interface ScreenCapture {
  imageData: string;  // base64 encoded
  width: number;
  height: number;
  timestamp: number;
  source: 'screenshot' | 'camera' | 'manual';
}

const DEFAULT_CONFIG: VisionConfig = {
  changeThreshold: 0.1,
  minChangeArea: 1000,
  checkInterval: 2000,
  preferredModel: 'SIMPLE',
};

class VisionTriggerService {
  private config: VisionConfig;
  private lastCapture: ScreenCapture | null = null;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private localModelAvailable: boolean = false;
  
  constructor(config?: Partial<VisionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.checkLocalModelAvailability();
  }
  
  /**
   * 检查本地视觉模型是否可用
   */
  private async checkLocalModelAvailability(): Promise<void> {
    if (!this.config.localModelEndpoint) {
      this.localModelAvailable = false;
      return;
    }
    
    try {
      const response = await fetch(`${this.config.localModelEndpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      this.localModelAvailable = response.ok;
      logger.info(`[VisionTrigger] Local model: ${this.localModelAvailable ? 'ONLINE' : 'OFFLINE'}`);
    } catch {
      this.localModelAvailable = false;
    }
  }
  
  /**
   * 简单的图像差异检测（基于像素采样）
   * 这是轻量级实现，不需要机器学习模型
   */
  private simpleImageDiff(
    oldImage: string,
    newImage: string
  ): { changeScore: number; changedRegions: ScreenRegion[] } {
    // 简化实现：比较base64字符串长度和部分内容
    // 实际生产环境应使用Canvas进行像素级比较
    
    if (!oldImage || !newImage) {
      return { changeScore: 1.0, changedRegions: [] };
    }
    
    // 计算字符串差异作为粗略估计
    const lenDiff = Math.abs(oldImage.length - newImage.length) / Math.max(oldImage.length, newImage.length);
    
    // 采样比较
    const sampleSize = Math.min(1000, oldImage.length, newImage.length);
    let diffCount = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor((i / sampleSize) * oldImage.length);
      if (oldImage[idx] !== newImage[idx]) {
        diffCount++;
      }
    }
    
    const sampleDiff = diffCount / sampleSize;
    const changeScore = Math.min(1.0, lenDiff + sampleDiff);
    
    return {
      changeScore,
      changedRegions: changeScore > this.config.changeThreshold 
        ? [{ x: 0, y: 0, width: 1080, height: 2400 }]  // 整屏变化
        : [],
    };
  }
  
  /**
   * 调用本地YOLO/MobileNet模型
   */
  private async detectWithLocalModel(
    imageData: string
  ): Promise<DetectedObject[]> {
    if (!this.localModelAvailable || !this.config.localModelEndpoint) {
      return [];
    }
    
    try {
      const response = await fetch(`${this.config.localModelEndpoint}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          model: this.config.preferredModel.toLowerCase(),
          confidence_threshold: 0.5,
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`Detection failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      interface DetectionResult {
        label: string;
        confidence: number;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        bbox?: [number, number, number, number];
      }
      
      return (data.detections || []).map((det: DetectionResult) => ({
        label: det.label,
        confidence: det.confidence,
        bbox: {
          x: det.x || det.bbox?.[0] || 0,
          y: det.y || det.bbox?.[1] || 0,
          width: det.width || det.bbox?.[2] || 0,
          height: det.height || det.bbox?.[3] || 0,
        },
        category: this.categorizeLabel(det.label),
      }));
    } catch (error) {
      logger.error({ error }, 'Local model detection failed');
      return [];
    }
  }
  
  /**
   * 将检测标签分类
   */
  private categorizeLabel(label: string): DetectedObject['category'] {
    const lowerLabel = label.toLowerCase();
    
    if (lowerLabel.includes('button') || lowerLabel.includes('btn')) {
      return 'button';
    }
    if (lowerLabel.includes('text') || lowerLabel.includes('label')) {
      return 'text';
    }
    if (lowerLabel.includes('input') || lowerLabel.includes('textbox') || lowerLabel.includes('field')) {
      return 'input';
    }
    if (lowerLabel.includes('image') || lowerLabel.includes('photo') || lowerLabel.includes('picture')) {
      return 'image';
    }
    if (lowerLabel.includes('icon')) {
      return 'icon';
    }
    
    return 'unknown';
  }
  
  /**
   * 分析屏幕截图
   */
  async analyzeCapture(capture: ScreenCapture): Promise<VisionAnalysis> {
    const startTime = Date.now();
    
    // 1. 简单差异检测
    const { changeScore, changedRegions } = this.simpleImageDiff(
      this.lastCapture?.imageData || '',
      capture.imageData
    );
    
    const hasChanged = changeScore > this.config.changeThreshold;
    
    // 2. 如果有变化且本地模型可用，进行对象检测
    let detectedObjects: DetectedObject[] = [];
    let provider: VisionModelType = 'SIMPLE';
    
    if (hasChanged && this.localModelAvailable) {
      detectedObjects = await this.detectWithLocalModel(capture.imageData);
      provider = this.config.preferredModel;
    }
    
    // 3. 判断是否需要深度分析
    const suggestDeepAnalysis = 
      hasChanged && 
      (changeScore > 0.3 || 
       detectedObjects.some(obj => 
         obj.category === 'button' || 
         obj.category === 'input' ||
         obj.label.toLowerCase().includes('confirm') ||
         obj.label.toLowerCase().includes('pay')
       ));
    
    // 4. 更新缓存
    this.lastCapture = capture;
    
    const latencyMs = Date.now() - startTime;
    
    return {
      hasChanged,
      changeScore,
      changedRegions,
      detectedObjects,
      suggestDeepAnalysis,
      timestamp: capture.timestamp,
      provider,
      latencyMs,
    };
  }
  
  /**
   * 快速检查是否有变化（不做深度分析）
   */
  quickCheck(newImageData: string): boolean {
    if (!this.lastCapture) {
      return true;
    }
    
    const { changeScore } = this.simpleImageDiff(
      this.lastCapture.imageData,
      newImageData
    );
    
    return changeScore > this.config.changeThreshold;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<VisionConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.localModelEndpoint) {
      this.checkLocalModelAvailability();
    }
  }
  
  /**
   * 获取服务状态
   */
  getStatus(): {
    localModelAvailable: boolean;
    preferredModel: VisionModelType;
    isMonitoring: boolean;
    lastCaptureTime: number | null;
  } {
    return {
      localModelAvailable: this.localModelAvailable,
      preferredModel: this.config.preferredModel,
      isMonitoring: this.isMonitoring,
      lastCaptureTime: this.lastCapture?.timestamp || null,
    };
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.lastCapture = null;
  }
}

// 全局实例
export const visionTrigger = new VisionTriggerService();

// 导出类供自定义实例
export { VisionTriggerService };
