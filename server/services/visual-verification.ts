/**
 * Project Unbound - Visual Verification (反馈确认闭环)
 * 
 * 功能：
 * 1. 操作前后截屏对比
 * 2. 智能变化检测
 * 3. 失败自动重试
 * 4. 错误报告与记录
 * 
 * 设计理念：
 * - 每次操作都有反馈确认
 * - 视觉验证优先于控件状态
 * - 多级重试策略
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('VisualVerification');

import { VisionAnalysis, ScreenCapture, DetectedObject, ScreenRegion } from './vision-trigger';

// ==================== 类型定义 ====================

export type VerificationResult = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'UNCERTAIN' | 'TIMEOUT';

export interface VerificationEvidence {
  beforeCapture?: ScreenCapture;
  afterCapture?: ScreenCapture;
  analysis?: VisionAnalysis;
  changeRegions: ScreenRegion[];
  confidence: number;
}

export interface VerificationReport {
  id: string;
  commandId: string;
  result: VerificationResult;
  evidence: VerificationEvidence;
  expectedChange?: ExpectedChange;
  actualChange?: DetectedChange;
  attempts: number;
  duration: number;
  timestamp: number;
  error?: string;
}

export interface ExpectedChange {
  type: 'ELEMENT_APPEAR' | 'ELEMENT_DISAPPEAR' | 'TEXT_CHANGE' | 'SCREEN_CHANGE' | 'ANY_CHANGE';
  target?: string;        // 期望变化的元素或文本
  region?: ScreenRegion;  // 期望变化的区域
  minConfidence?: number; // 最小置信度
}

export interface DetectedChange {
  hasChanged: boolean;
  changeScore: number;
  changedRegions: ScreenRegion[];
  newElements: DetectedObject[];
  removedElements: DetectedObject[];
  textChanges: TextChange[];
}

export interface TextChange {
  region: ScreenRegion;
  before: string;
  after: string;
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffMs: number;           // 基础退避时间
  backoffMultiplier: number;   // 退避倍数
  maxBackoffMs: number;        // 最大退避时间
  retryConditions: RetryCondition[];
}

export type RetryCondition = 
  | 'NO_CHANGE'        // 没有检测到变化
  | 'LOW_CONFIDENCE'   // 低置信度
  | 'TIMEOUT'          // 超时
  | 'ELEMENT_NOT_FOUND' // 元素未找到
  | 'ANY_FAILURE';     // 任何失败

export interface VerificationConfig {
  enabled: boolean;
  captureBeforeAction: boolean;
  captureAfterAction: boolean;
  waitAfterAction: number;     // 操作后等待时间 (ms)
  changeThreshold: number;     // 变化阈值 (0-1)
  minConfidence: number;       // 最小置信度
  timeout: number;             // 验证超时 (ms)
  retryStrategy: RetryStrategy;
  useVLLM: boolean;            // 是否使用视觉大模型验证
}

// ==================== 默认配置 ====================

const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  backoffMs: 500,
  backoffMultiplier: 1.5,
  maxBackoffMs: 5000,
  retryConditions: ['NO_CHANGE', 'TIMEOUT', 'ELEMENT_NOT_FOUND'],
};

const DEFAULT_CONFIG: VerificationConfig = {
  enabled: true,
  captureBeforeAction: true,
  captureAfterAction: true,
  waitAfterAction: 300,
  changeThreshold: 0.05,
  minConfidence: 0.7,
  timeout: 10000,
  retryStrategy: DEFAULT_RETRY_STRATEGY,
  useVLLM: false,
};

// ==================== 图像对比工具 ====================

interface ImageDiffResult {
  different: boolean;
  diffScore: number;
  diffRegions: ScreenRegion[];
  pixelDiffCount: number;
}

class ImageComparer {
  /**
   * 比较两张图像的差异 (简化实现)
   */
  static compare(before: string, after: string, threshold: number = 0.05): ImageDiffResult {
    // 简化实现：基于 base64 字符串比较
    // 实际生产环境应使用 Canvas 进行像素级比较
    
    if (!before || !after) {
      return {
        different: true,
        diffScore: 1.0,
        diffRegions: [],
        pixelDiffCount: 0,
      };
    }
    
    if (before === after) {
      return {
        different: false,
        diffScore: 0,
        diffRegions: [],
        pixelDiffCount: 0,
      };
    }
    
    // 计算长度差异
    const lenDiff = Math.abs(before.length - after.length) / Math.max(before.length, after.length);
    
    // 采样比较
    const sampleSize = Math.min(2000, before.length, after.length);
    let diffCount = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor((i / sampleSize) * Math.min(before.length, after.length));
      if (before[idx] !== after[idx]) {
        diffCount++;
      }
    }
    
    const sampleDiff = diffCount / sampleSize;
    const diffScore = Math.min(1.0, lenDiff + sampleDiff);
    
    return {
      different: diffScore > threshold,
      diffScore,
      diffRegions: diffScore > threshold ? [{ x: 0, y: 0, width: 100, height: 100 }] : [],
      pixelDiffCount: Math.floor(diffCount * 100),
    };
  }

  /**
   * 检测特定区域的变化
   */
  static compareRegion(
    before: string,
    after: string,
    region: ScreenRegion,
    threshold: number = 0.05
  ): ImageDiffResult {
    // 实际实现应裁剪图像区域后比较
    // 这里使用全图比较作为简化
    return this.compare(before, after, threshold);
  }

  /**
   * 找出变化最大的区域
   * 通过比较before和after图像的base64数据来检测实际变化
   */
  static findChangedRegions(before: string, after: string, gridSize: number = 4): ScreenRegion[] {
    const regions: ScreenRegion[] = [];
    
    // 默认分辨率，可根据实际图像调整
    const width = 1080;
    const height = 1920;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    
    // 通过比较整体图像差异来判断是否有变化
    const overallDiff = this.compare(before, after, 0.01);
    
    if (!overallDiff.different) {
      // 图像完全相同，没有变化区域
      return regions;
    }
    
    // 根据整体差异程度估算变化区域数量
    const changeRatio = overallDiff.diffScore;
    const estimatedChangedCells = Math.ceil(gridSize * gridSize * changeRatio);
    
    // 基于差异程度分配可能的变化区域（从中心向外扩散）
    const centerRow = Math.floor(gridSize / 2);
    const centerCol = Math.floor(gridSize / 2);
    
    const cellDistances: Array<{row: number; col: number; distance: number}> = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol);
        cellDistances.push({ row, col, distance });
      }
    }
    
    // 优先选择中心区域（通常是主要交互区域）
    cellDistances.sort((a, b) => a.distance - b.distance);
    
    for (let i = 0; i < Math.min(estimatedChangedCells, cellDistances.length); i++) {
      const { row, col } = cellDistances[i];
      regions.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
    }
    
    return regions;
  }
}

// ==================== 验证服务 ====================

type CaptureFunction = () => Promise<string>;

class VisualVerificationService {
  private config: VerificationConfig;
  private reports: Map<string, VerificationReport> = new Map();
  private captureFunction?: CaptureFunction;
  private vllmFunction?: (image: string, prompt: string) => Promise<string>;

  constructor(config?: Partial<VerificationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置截图函数
   */
  setCaptureFunction(fn: CaptureFunction): void {
    this.captureFunction = fn;
  }

  /**
   * 设置 V-LLM 函数
   */
  setVLLMFunction(fn: (image: string, prompt: string) => Promise<string>): void {
    this.vllmFunction = fn;
    this.config.useVLLM = true;
  }

  /**
   * 验证操作执行结果
   */
  async verify(
    commandId: string,
    beforeCapture: ScreenCapture | undefined,
    afterCapture: ScreenCapture | undefined,
    expectedChange?: ExpectedChange
  ): Promise<VerificationReport> {
    const startTime = Date.now();
    const reportId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let result: VerificationResult = 'UNCERTAIN';
    let confidence = 0;
    let actualChange: DetectedChange | undefined;
    let error: string | undefined;

    try {
      // 如果没有截图，无法验证
      if (!beforeCapture || !afterCapture) {
        result = 'UNCERTAIN';
        confidence = 0;
        error = 'Missing capture for verification';
      } else {
        // 执行图像对比
        const diffResult = ImageComparer.compare(
          beforeCapture.imageData,
          afterCapture.imageData,
          this.config.changeThreshold
        );

        actualChange = {
          hasChanged: diffResult.different,
          changeScore: diffResult.diffScore,
          changedRegions: diffResult.diffRegions,
          newElements: [],
          removedElements: [],
          textChanges: [],
        };

        // 根据期望变化判断结果
        if (expectedChange) {
          const verification = this.evaluateExpectedChange(expectedChange, actualChange);
          result = verification.result;
          confidence = verification.confidence;
        } else {
          // 没有期望变化，只要有变化就算成功
          result = diffResult.different ? 'SUCCESS' : 'FAILED';
          confidence = diffResult.different ? 0.8 : 0.3;
        }

        // 如果启用 V-LLM，进行深度验证
        if (this.config.useVLLM && this.vllmFunction && result !== 'SUCCESS') {
          const vllmResult = await this.vllmVerify(afterCapture.imageData, expectedChange);
          if (vllmResult.success) {
            result = 'SUCCESS';
            confidence = vllmResult.confidence;
          }
        }
      }
    } catch (err) {
      result = 'FAILED';
      error = err instanceof Error ? err.message : String(err);
    }

    const report: VerificationReport = {
      id: reportId,
      commandId,
      result,
      evidence: {
        beforeCapture,
        afterCapture,
        changeRegions: actualChange?.changedRegions ?? [],
        confidence,
      },
      expectedChange,
      actualChange,
      attempts: 1,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      error,
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * 带重试的验证
   */
  async verifyWithRetry(
    commandId: string,
    executeAction: () => Promise<void>,
    expectedChange?: ExpectedChange,
    customRetry?: Partial<RetryStrategy>
  ): Promise<VerificationReport> {
    const retryStrategy = { ...this.config.retryStrategy, ...customRetry };
    let attempt = 0;
    let lastReport: VerificationReport | undefined;
    let backoffMs = retryStrategy.backoffMs;

    while (attempt < retryStrategy.maxAttempts) {
      attempt++;

      // 执行前截图
      let beforeCapture: ScreenCapture | undefined;
      if (this.config.captureBeforeAction && this.captureFunction) {
        const imageData = await this.captureFunction();
        beforeCapture = {
          imageData,
          width: 1080,
          height: 1920,
          timestamp: Date.now(),
          source: 'screenshot',
        };
      }

      // 执行操作
      try {
        await executeAction();
      } catch (err) {
        logger.info(`[VisualVerification] Action failed: ${err}`);
      }

      // 等待操作生效
      await this.sleep(this.config.waitAfterAction);

      // 执行后截图
      let afterCapture: ScreenCapture | undefined;
      if (this.config.captureAfterAction && this.captureFunction) {
        const imageData = await this.captureFunction();
        afterCapture = {
          imageData,
          width: 1080,
          height: 1920,
          timestamp: Date.now(),
          source: 'screenshot',
        };
      }

      // 验证
      lastReport = await this.verify(commandId, beforeCapture, afterCapture, expectedChange);
      lastReport.attempts = attempt;

      // 检查是否成功
      if (lastReport.result === 'SUCCESS') {
        return lastReport;
      }

      // 检查是否应该重试
      const shouldRetry = this.shouldRetry(lastReport, retryStrategy);
      if (!shouldRetry || attempt >= retryStrategy.maxAttempts) {
        break;
      }

      // 退避
      logger.info(`[VisualVerification] Retrying in ${backoffMs}ms (attempt ${attempt}/${retryStrategy.maxAttempts})`);
      await this.sleep(backoffMs);
      backoffMs = Math.min(backoffMs * retryStrategy.backoffMultiplier, retryStrategy.maxBackoffMs);
    }

    return lastReport!;
  }

  private shouldRetry(report: VerificationReport, strategy: RetryStrategy): boolean {
    if (strategy.retryConditions.includes('ANY_FAILURE') && report.result !== 'SUCCESS') {
      return true;
    }

    if (strategy.retryConditions.includes('NO_CHANGE') && !report.actualChange?.hasChanged) {
      return true;
    }

    if (strategy.retryConditions.includes('LOW_CONFIDENCE') && report.evidence.confidence < this.config.minConfidence) {
      return true;
    }

    if (strategy.retryConditions.includes('TIMEOUT') && report.error?.includes('timeout')) {
      return true;
    }

    return false;
  }

  private evaluateExpectedChange(
    expected: ExpectedChange,
    actual: DetectedChange
  ): { result: VerificationResult; confidence: number } {
    const minConfidence = expected.minConfidence ?? this.config.minConfidence;

    switch (expected.type) {
      case 'ANY_CHANGE':
        if (actual.hasChanged) {
          return { result: 'SUCCESS', confidence: Math.min(actual.changeScore + 0.3, 1.0) };
        }
        return { result: 'FAILED', confidence: 0.2 };

      case 'SCREEN_CHANGE':
        if (actual.changeScore > this.config.changeThreshold) {
          return { result: 'SUCCESS', confidence: actual.changeScore };
        }
        return { result: 'FAILED', confidence: actual.changeScore };

      case 'ELEMENT_APPEAR':
      case 'ELEMENT_DISAPPEAR':
      case 'TEXT_CHANGE':
        // 需要更复杂的检测逻辑
        // 这里简化为基于变化分数判断
        if (actual.changeScore > 0.1) {
          return { result: 'PARTIAL', confidence: 0.5 };
        }
        return { result: 'UNCERTAIN', confidence: 0.3 };

      default:
        return { result: 'UNCERTAIN', confidence: 0.5 };
    }
  }

  private async vllmVerify(
    image: string,
    expectedChange?: ExpectedChange
  ): Promise<{ success: boolean; confidence: number }> {
    if (!this.vllmFunction) {
      return { success: false, confidence: 0 };
    }

    const prompt = expectedChange
      ? `分析这张屏幕截图，判断是否发生了以下变化：${JSON.stringify(expectedChange)}。回答 YES 或 NO，并给出置信度 (0-100)。`
      : `分析这张屏幕截图，判断是否有明显的界面变化或操作成功的迹象。回答 YES 或 NO，并给出置信度 (0-100)。`;

    try {
      const response = await this.vllmFunction(image, prompt);
      const hasYes = response.toUpperCase().includes('YES');
      const confidenceMatch = response.match(/(\d+)/);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.5;

      return { success: hasYes, confidence };
    } catch {
      return { success: false, confidence: 0 };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取验证报告
   */
  getReport(reportId: string): VerificationReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * 获取所有报告
   */
  getAllReports(): VerificationReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    success: number;
    failed: number;
    partial: number;
    uncertain: number;
    avgAttempts: number;
    avgDuration: number;
  } {
    const reports = this.getAllReports();
    const total = reports.length;
    
    if (total === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        partial: 0,
        uncertain: 0,
        avgAttempts: 0,
        avgDuration: 0,
      };
    }

    const success = reports.filter(r => r.result === 'SUCCESS').length;
    const failed = reports.filter(r => r.result === 'FAILED').length;
    const partial = reports.filter(r => r.result === 'PARTIAL').length;
    const uncertain = reports.filter(r => r.result === 'UNCERTAIN' || r.result === 'TIMEOUT').length;
    const avgAttempts = reports.reduce((sum, r) => sum + r.attempts, 0) / total;
    const avgDuration = reports.reduce((sum, r) => sum + r.duration, 0) / total;

    return { total, success, failed, partial, uncertain, avgAttempts, avgDuration };
  }

  /**
   * 清除历史报告
   */
  clearReports(olderThanMs?: number): number {
    if (!olderThanMs) {
      const count = this.reports.size;
      this.reports.clear();
      return count;
    }

    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;
    const entries = Array.from(this.reports.entries());
    
    for (const [id, report] of entries) {
      if (report.timestamp < cutoff) {
        this.reports.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}

// ==================== 导出 ====================

export const visualVerification = new VisualVerificationService();
export { VisualVerificationService, ImageComparer };
export { DEFAULT_CONFIG as DEFAULT_VERIFICATION_CONFIG, DEFAULT_RETRY_STRATEGY };

export default visualVerification;
