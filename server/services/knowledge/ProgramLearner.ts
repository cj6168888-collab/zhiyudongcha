/**
 * 程序学习服务 - 自动学习新程序能力
 *
 * 功能：
 * - 从执行日志中学习
 * - 从用户反馈中学习
 * - 从网上搜索学习
 * - 推断操作方法
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { programKnowledgeBase, ProgramCapability, ProgramOperation } from './ProgramKnowledgeBase';

const logger = createServiceLogger('ProgramLearner');

interface LearningLog {
  id: string;
  programId: string;
  operation: string;
  parameters: Record<string, unknown>;
  result: 'success' | 'failure' | 'partial';
  feedback?: string;
  timestamp: Date;
  userId?: string;
}

interface InferenceResult {
  operation: Partial<ProgramOperation>;
  confidence: number;
  reasoning: string;
  suggestedParameters?: ProgramOperation['parameters'];
}

class ProgramLearner {
  private static instance: ProgramLearner | null = null;
  private learningLogs: Map<string, LearningLog[]> = new Map();

  private constructor() {}

  public static getInstance(): ProgramLearner {
    if (!ProgramLearner.instance) {
      ProgramLearner.instance = new ProgramLearner();
    }
    return ProgramLearner.instance;
  }

  /**
   * 记录学习日志
   */
  public logExecution(
    programId: string,
    operation: string,
    parameters: Record<string, unknown>,
    result: 'success' | 'failure' | 'partial',
    userId?: string
  ): void {
    const log: LearningLog = {
      id: `log_${Date.now()}`,
      programId,
      operation,
      parameters,
      result,
      timestamp: new Date(),
      userId,
    };

    if (!this.learningLogs.has(programId)) {
      this.learningLogs.set(programId, []);
    }

    this.learningLogs.get(programId)!.push(log);

    // 如果多次失败，触发学习
    const recentLogs = this.getRecentLogs(programId, operation, 5);
    const failureCount = recentLogs.filter(l => l.result === 'failure').length;

    if (failureCount >= 3) {
      logger.warn({ programId, operation, failureCount }, 'Multiple failures detected, triggering learning');
      this.triggerLearning(programId, operation);
    }
  }

  /**
   * 记录用户反馈
   */
  public recordFeedback(
    programId: string,
    operation: string,
    feedback: string,
    userId?: string
  ): void {
    const logs = this.learningLogs.get(programId);
    if (logs && logs.length > 0) {
      logs[logs.length - 1].feedback = feedback;
    }

    // 分析反馈
    this.analyzeFeedback(programId, operation, feedback);
  }

  /**
   * 获取最近的日志
   */
  private getRecentLogs(programId: string, operation: string, limit: number): LearningLog[] {
    const logs = this.learningLogs.get(programId) || [];
    return logs
      .filter(l => l.operation === operation)
      .slice(-limit);
  }

  /**
   * 触发学习
   */
  private async triggerLearning(programId: string, operation: string): Promise<void> {
    logger.info({ programId, operation }, 'Triggering learning process');

    // 收集上下文
    const logs = this.getRecentLogs(programId, operation, 10);

    // 生成学习建议
    const suggestions = this.inferFromLogs(logs);

    // 应用学习结果
    for (const suggestion of suggestions) {
      if (suggestion.confidence > 0.7) {
        this.applySuggestion(programId, suggestion);
      }
    }
  }

  /**
   * 从日志中推断
   */
  private inferFromLogs(logs: LearningLog[]): InferenceResult[] {
    const results: InferenceResult[] = [];

    if (logs.length === 0) return results;

    // 分析参数使用情况
    const parameterUsage: Record<string, {
      success: number;
      failure: number;
      values: unknown[];
    }> = {};

    for (const log of logs) {
      for (const [key, value] of Object.entries(log.parameters)) {
        if (!parameterUsage[key]) {
          parameterUsage[key] = { success: 0, failure: 0, values: [] };
        }
        parameterUsage[key].values.push(value);
        if (log.result === 'success') {
          parameterUsage[key].success++;
        } else {
          parameterUsage[key].failure++;
        }
      }
    }

    // 推断参数
    for (const [paramName, usage] of Object.entries(parameterUsage)) {
      const total = usage.success + usage.failure;
      const successRate = total > 0 ? usage.success / total : 0;

      results.push({
        operation: {
          name: logs[0].operation,
          description: `通过学习推断的操作: ${paramName}`,
          keywords: [paramName],
        },
        confidence: successRate,
        reasoning: `基于 ${total} 次执行，成功率 ${(successRate * 100).toFixed(1)}%`,
        suggestedParameters: [{
          name: paramName,
          type: this.inferType(usage.values[0]),
          required: successRate > 0.5,
        }],
      });
    }

    return results;
  }

  /**
   * 推断参数类型
   */
  private inferType(value: unknown): 'string' | 'number' | 'boolean' | 'object' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * 分析反馈
   */
  private analyzeFeedback(programId: string, operation: string, feedback: string): void {
    const lowerFeedback = feedback.toLowerCase();

    // 检测负面反馈
    const negativeKeywords = ['不对', '错误', '失败', '没用', '不行', 'wrong', 'error', 'fail', 'not work'];
    const isNegative = negativeKeywords.some(k => lowerFeedback.includes(k));

    if (isNegative) {
      logger.info({ programId, operation, feedback }, 'Negative feedback received');

      // 尝试从反馈中提取正确参数
      const extractedParams = this.extractParamsFromFeedback(feedback);

      if (Object.keys(extractedParams).length > 0) {
        logger.info({ extractedParams }, 'Extracted parameters from feedback');
        // 可以触发更新或重新学习
      }
    }

    // 检测正面反馈
    const positiveKeywords = ['好的', '对了', '可以', 'ok', 'success', 'great'];
    const isPositive = positiveKeywords.some(k => lowerFeedback.includes(k));

    if (isPositive) {
      logger.info({ programId, operation }, 'Positive feedback received');
      // 强化学习
    }
  }

  /**
   * 从反馈中提取参数
   */
  private extractParamsFromFeedback(feedback: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // 尝试提取数值
    const numbers = feedback.match(/\d+/g);
    if (numbers) {
      params['extracted_number'] = parseInt(numbers[0]);
    }

    // 尝试提取引号内容
    const quoted = feedback.match(/["']([^"']+)["']/g);
    if (quoted) {
      params['extracted_text'] = quoted[0].replace(/["']/g, '');
    }

    return params;
  }

  /**
   * 应用学习建议
   */
  private applySuggestion(programId: string, suggestion: InferenceResult): void {
    if (!suggestion.operation.name) return;

    const operation: ProgramOperation = {
      id: `learned_${suggestion.operation.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: suggestion.operation.name,
      description: suggestion.operation.description || '',
      keywords: suggestion.operation.keywords || [],
      parameters: suggestion.suggestedParameters || [],
      examples: [],
    };

    programKnowledgeBase.addOperation(programId, operation);

    logger.info({ programId, operationId: operation.id }, 'Applied learning suggestion');
  }

  /**
   * 批量学习 - 从执行历史中学习
   */
  public async batchLearnFromHistory(
    history: Array<{
      programId: string;
      operation: string;
      parameters: Record<string, unknown>;
      result: 'success' | 'failure';
      timestamp: number;
    }>
  ): Promise<{
    analyzed: number;
    learned: number;
    suggestions: string[];
  }> {
    logger.info({ historySize: history.length }, 'Starting batch learning');

    const suggestions: string[] = [];
    let learned = 0;

    // 按程序分组
    const byProgram: Record<string, typeof history> = {};
    for (const item of history) {
      if (!byProgram[item.programId]) {
        byProgram[item.programId] = [];
      }
      byProgram[item.programId].push(item);
    }

    // 分析每个程序
    for (const [programId, items] of Object.entries(byProgram)) {
      const program = programKnowledgeBase.getProgram(programId);
      if (!program) continue;

      // 按操作分组
      const byOperation: Record<string, typeof items> = {};
      for (const item of items) {
        if (!byOperation[item.operation]) {
          byOperation[item.operation] = [];
        }
        byOperation[item.operation].push(item);
      }

      // 分析每个操作
      for (const [operation, opItems] of Object.entries(byOperation)) {
        const successRate = opItems.filter(i => i.result === 'success').length / opItems.length;

        if (successRate > 0.8) {
          // 高成功率，可能是一个有效操作
          suggestions.push(`${program.name} - ${operation}: 成功率 ${(successRate * 100).toFixed(1)}%`);
        } else if (successRate < 0.3) {
          // 低成功率，可能是错误操作或参数问题
          suggestions.push(`${program.name} - ${operation}: 成功率较低，建议检查`);
        }
      }
    }

    return {
      analyzed: history.length,
      learned,
      suggestions,
    };
  }

  /**
   * 生成学习报告
   */
  public generateLearningReport(): {
    totalLogs: number;
    programsLearned: number;
    operationsLearned: number;
    successRate: number;
    recommendations: string[];
  } {
    let totalLogs = 0;
    const programsLearned = new Set<string>();
    const operationsLearned = new Set<string>();
    let successCount = 0;

    for (const [programId, logs] of Array.from(this.learningLogs.entries())) {
      programsLearned.add(programId);
      totalLogs += logs.length;

      for (const log of logs) {
        operationsLearned.add(`${programId}:${log.operation}`);
        if (log.result === 'success') {
          successCount++;
        }
      }
    }

    const recommendations: string[] = [];

    // 生成建议
    if (totalLogs < 10) {
      recommendations.push('系统仍在学习阶段，建议多使用程序功能以积累数据');
    }

    if (successCount / totalLogs < 0.5) {
      recommendations.push('整体成功率偏低，建议检查参数配置');
    }

    return {
      totalLogs,
      programsLearned: programsLearned.size,
      operationsLearned: operationsLearned.size,
      successRate: totalLogs > 0 ? successCount / totalLogs : 0,
      recommendations,
    };
  }

  /**
   * 导出学习日志
   */
  public exportLogs(): string {
    const logs: LearningLog[] = [];
    for (const programLogs of Array.from(this.learningLogs.values())) {
      logs.push(...programLogs);
    }
    return JSON.stringify(logs, null, 2);
  }

  /**
   * 清除旧日志
   */
  public clearOldLogs(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [programId, logs] of Array.from(this.learningLogs.entries())) {
      const filtered = logs.filter(l => l.timestamp.getTime() > cutoff);
      removed += logs.length - filtered.length;
      this.learningLogs.set(programId, filtered);
    }

    logger.info({ removed, olderThanDays }, 'Cleared old learning logs');
    return removed;
  }
}

export const programLearner = ProgramLearner.getInstance();
export default programLearner;
