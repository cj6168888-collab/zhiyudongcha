/**
 * Feedback Logger - 自主进化逻辑核心组件
 * 
 * 遵循灵魂核心协议第2条：失败是生长的养料
 * 
 * 功能：
 * 1. 捕获所有执行失败
 * 2. 保存失败截图和上下文
 * 3. 标记为"深夜梦境"复盘素材
 * 4. 为自主进化提供学习数据
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

export type FailureCategory = 
  | 'PERMISSION_DENIED'    // 权限被拒绝
  | 'ELEMENT_NOT_FOUND'    // 元素未找到
  | 'APP_SANDBOX'          // APP沙盒限制
  | 'NETWORK_ERROR'        // 网络错误
  | 'TIMEOUT'              // 超时
  | 'VISUAL_MISMATCH'      // 视觉不匹配
  | 'EXECUTION_BLOCKED'    // 执行被阻止
  | 'UNEXPECTED_STATE'     // 意外状态
  | 'UNKNOWN';             // 未知错误

export interface FailureRecord {
  id: string;
  timestamp: Date;
  category: FailureCategory;
  
  // 执行上下文
  actionType: string;
  actionTarget: string;
  actionParams: Record<string, any>;
  
  // 失败详情
  errorMessage: string;
  errorStack?: string;
  
  // 视觉证据
  screenshotBefore?: string;
  screenshotAfter?: string;
  screenshotDiff?: number;
  
  // 设备信息
  deviceId: string;
  deviceType: string;
  channel: string;
  
  // 复盘标记
  dreamReviewStatus: 'PENDING' | 'REVIEWED' | 'LEARNED' | 'DISMISSED';
  dreamInsights?: string;
  
  // 重试信息
  attemptNumber: number;
  maxAttempts: number;
  willRetry: boolean;
  
  // 关联数据
  sessionId?: string;
  commandId?: string;
}

export interface LearningInsight {
  id: string;
  sourceFailures: string[];  // FailureRecord IDs
  pattern: string;           // 识别出的模式
  solution: string;          // 学习到的解决方案
  confidence: number;        // 置信度
  appliedCount: number;      // 应用次数
  successRate: number;       // 成功率
  createdAt: Date;
  updatedAt: Date;
}

class FeedbackLoggerService {
  private failures: Map<string, FailureRecord> = new Map();
  private insights: Map<string, LearningInsight> = new Map();
  private pendingDreamReview: string[] = [];  // 待复盘的失败ID列表
  
  constructor() {
    console.log('[FeedbackLogger] 自主进化日志系统已初始化');
  }
  
  /**
   * 记录执行失败
   */
  logFailure(params: {
    actionType: string;
    actionTarget: string;
    actionParams: Record<string, any>;
    errorMessage: string;
    errorStack?: string;
    screenshotBefore?: string;
    screenshotAfter?: string;
    deviceId: string;
    deviceType: string;
    channel: string;
    attemptNumber: number;
    maxAttempts: number;
    sessionId?: string;
    commandId?: string;
  }): FailureRecord {
    const id = `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const category = this.categorizeFailure(params.errorMessage);
    
    const record: FailureRecord = {
      id,
      timestamp: new Date(),
      category,
      actionType: params.actionType,
      actionTarget: params.actionTarget,
      actionParams: params.actionParams,
      errorMessage: params.errorMessage,
      errorStack: params.errorStack,
      screenshotBefore: params.screenshotBefore,
      screenshotAfter: params.screenshotAfter,
      deviceId: params.deviceId,
      deviceType: params.deviceType,
      channel: params.channel,
      dreamReviewStatus: 'PENDING',
      attemptNumber: params.attemptNumber,
      maxAttempts: params.maxAttempts,
      willRetry: params.attemptNumber < params.maxAttempts,
      sessionId: params.sessionId,
      commandId: params.commandId,
    };
    
    this.failures.set(id, record);
    this.pendingDreamReview.push(id);
    
    console.log(`[FeedbackLogger] 失败已记录: ${category} - ${params.actionType} @ ${params.actionTarget}`);
    console.log(`[FeedbackLogger] 待复盘素材: ${this.pendingDreamReview.length} 条`);
    
    // 检查是否有可应用的学习洞察
    this.tryApplyLearning(record);
    
    return record;
  }
  
  /**
   * 分类失败类型
   */
  private categorizeFailure(errorMessage: string): FailureCategory {
    const msg = errorMessage.toLowerCase();
    
    if (msg.includes('permission') || msg.includes('denied') || msg.includes('权限')) {
      return 'PERMISSION_DENIED';
    }
    if (msg.includes('not found') || msg.includes('找不到') || msg.includes('no such element')) {
      return 'ELEMENT_NOT_FOUND';
    }
    if (msg.includes('sandbox') || msg.includes('沙盒') || msg.includes('restricted')) {
      return 'APP_SANDBOX';
    }
    if (msg.includes('network') || msg.includes('connection') || msg.includes('网络')) {
      return 'NETWORK_ERROR';
    }
    if (msg.includes('timeout') || msg.includes('超时') || msg.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (msg.includes('visual') || msg.includes('mismatch') || msg.includes('not match')) {
      return 'VISUAL_MISMATCH';
    }
    if (msg.includes('blocked') || msg.includes('阻止') || msg.includes('intercepted')) {
      return 'EXECUTION_BLOCKED';
    }
    if (msg.includes('unexpected') || msg.includes('state') || msg.includes('状态')) {
      return 'UNEXPECTED_STATE';
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * 尝试应用已学习的洞察
   */
  private tryApplyLearning(failure: FailureRecord): LearningInsight | null {
    for (const insight of this.insights.values()) {
      // 简化匹配：检查是否是类似的失败模式
      if (insight.pattern.includes(failure.category) && insight.confidence > 0.7) {
        console.log(`[FeedbackLogger] 发现可应用的学习洞察: ${insight.solution}`);
        return insight;
      }
    }
    return null;
  }
  
  /**
   * 获取待复盘的失败记录（用于深夜梦境）
   */
  getPendingDreamReview(): FailureRecord[] {
    return this.pendingDreamReview
      .map(id => this.failures.get(id))
      .filter((r): r is FailureRecord => r !== undefined);
  }
  
  /**
   * 完成梦境复盘
   */
  completeDreamReview(failureId: string, insights: string): void {
    const failure = this.failures.get(failureId);
    if (failure) {
      failure.dreamReviewStatus = 'REVIEWED';
      failure.dreamInsights = insights;
      
      // 从待复盘列表移除
      const idx = this.pendingDreamReview.indexOf(failureId);
      if (idx > -1) {
        this.pendingDreamReview.splice(idx, 1);
      }
      
      console.log(`[FeedbackLogger] 梦境复盘完成: ${failureId}`);
    }
  }
  
  /**
   * 添加学习洞察
   */
  addLearningInsight(params: {
    sourceFailures: string[];
    pattern: string;
    solution: string;
    confidence: number;
  }): LearningInsight {
    const id = `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insight: LearningInsight = {
      id,
      sourceFailures: params.sourceFailures,
      pattern: params.pattern,
      solution: params.solution,
      confidence: params.confidence,
      appliedCount: 0,
      successRate: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.insights.set(id, insight);
    
    // 更新相关失败记录状态
    for (const failureId of params.sourceFailures) {
      const failure = this.failures.get(failureId);
      if (failure) {
        failure.dreamReviewStatus = 'LEARNED';
      }
    }
    
    console.log(`[FeedbackLogger] 新学习洞察已添加: ${params.pattern}`);
    return insight;
  }
  
  /**
   * 获取失败统计
   */
  getFailureStats(): {
    total: number;
    byCategory: Record<FailureCategory, number>;
    pendingReview: number;
    learned: number;
  } {
    const stats = {
      total: this.failures.size,
      byCategory: {} as Record<FailureCategory, number>,
      pendingReview: this.pendingDreamReview.length,
      learned: 0,
    };
    
    for (const failure of this.failures.values()) {
      stats.byCategory[failure.category] = (stats.byCategory[failure.category] || 0) + 1;
      if (failure.dreamReviewStatus === 'LEARNED') {
        stats.learned++;
      }
    }
    
    return stats;
  }
  
  /**
   * 获取学习进度报告
   */
  getLearningReport(): {
    totalFailures: number;
    pendingReview: number;
    insightsLearned: number;
    topPatterns: { pattern: string; count: number }[];
    evolutionScore: number;  // 0-100 进化分数
  } {
    const stats = this.getFailureStats();
    
    // 计算进化分数
    const learnRate = stats.total > 0 ? stats.learned / stats.total : 0;
    const insightRate = this.insights.size > 0 ? 1 : 0;
    const evolutionScore = Math.round((learnRate * 70 + insightRate * 30) * 100);
    
    // 统计失败模式
    const patternCounts = new Map<string, number>();
    for (const failure of this.failures.values()) {
      patternCounts.set(
        failure.category,
        (patternCounts.get(failure.category) || 0) + 1
      );
    }
    
    const topPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalFailures: stats.total,
      pendingReview: stats.pendingReview,
      insightsLearned: this.insights.size,
      topPatterns,
      evolutionScore,
    };
  }
  
  /**
   * 建议视觉后备方案（边界穿透逻辑）
   */
  suggestVisualFallback(failure: FailureRecord): {
    shouldFallback: boolean;
    reason: string;
    action: string;
  } {
    // 这些类型的失败应该尝试视觉后备
    const visualFallbackCategories: FailureCategory[] = [
      'PERMISSION_DENIED',
      'APP_SANDBOX',
      'ELEMENT_NOT_FOUND',
      'EXECUTION_BLOCKED',
    ];
    
    if (visualFallbackCategories.includes(failure.category)) {
      return {
        shouldFallback: true,
        reason: `${failure.category} 失败，建议切换到视觉识别模式`,
        action: 'USE_VLLM_GROUNDING',
      };
    }
    
    return {
      shouldFallback: false,
      reason: '当前失败类型不适合视觉后备',
      action: 'CONTINUE_RETRY',
    };
  }
}

// 导出单例
export const feedbackLogger = new FeedbackLoggerService();
export default feedbackLogger;
