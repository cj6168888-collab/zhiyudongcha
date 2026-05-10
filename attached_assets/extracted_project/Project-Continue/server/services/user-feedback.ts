/**
 * 小智 User Feedback System - 用户反馈与自我进化
 * 
 * 功能：
 * 1. 记录任务满意度
 * 2. 追踪成功/失败模式
 * 3. 驱动决策权重调整
 * 4. 生成进化报告
 */

import { db } from '../db';
import { auditLogs, shadowMemories, dailyReports } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { vectorMemory } from './vector-memory';

export type FeedbackType = 'rating' | 'thumbs' | 'correction' | 'comment';
export type FeedbackSentiment = 'positive' | 'negative' | 'neutral';

export interface FeedbackEntry {
  id: number;
  taskId: string;
  taskType: string;
  feedback: FeedbackType;
  value: number | string;
  sentiment: FeedbackSentiment;
  comment?: string;
  context?: Record<string, any>;
  createdAt: Date;
}

export interface TaskPerformance {
  taskType: string;
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  successRate: number;
  avgRating: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface EvolutionReport {
  period: string;
  overallSatisfaction: number;
  topPerformers: TaskPerformance[];
  needsImprovement: TaskPerformance[];
  learningHighlights: string[];
  recommendations: string[];
}

/**
 * 用户反馈服务
 */
class UserFeedbackService {
  private feedbackCache: FeedbackEntry[] = [];
  
  /**
   * 记录用户反馈
   */
  async recordFeedback(
    taskId: string,
    taskType: string,
    feedback: FeedbackType,
    value: number | string,
    comment?: string,
    context?: Record<string, any>
  ): Promise<number> {
    // 判断情感
    let sentiment: FeedbackSentiment = 'neutral';
    if (feedback === 'rating' && typeof value === 'number') {
      sentiment = value >= 4 ? 'positive' : value <= 2 ? 'negative' : 'neutral';
    } else if (feedback === 'thumbs') {
      sentiment = value === 'up' || value === 1 ? 'positive' : 'negative';
    } else if (comment) {
      // 简单情感分析
      const positiveWords = ['好', '棒', '喜欢', '满意', '完美', '厉害', 'great', 'good', 'love'];
      const negativeWords = ['差', '烂', '不好', '失望', '错误', 'bad', 'wrong', 'fail'];
      
      const lowerComment = comment.toLowerCase();
      const posCount = positiveWords.filter(w => lowerComment.includes(w)).length;
      const negCount = negativeWords.filter(w => lowerComment.includes(w)).length;
      
      sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';
    }
    
    try {
      // 记录到审计日志
      const [result] = await db.insert(auditLogs).values({
        action: 'user_feedback',
        entityType: 'task',
        entityId: taskId,
        details: JSON.stringify({
          taskType,
          feedback,
          value,
          sentiment,
          comment,
          context,
        }),
        outcome: sentiment === 'positive' ? 'success' : sentiment === 'negative' ? 'failure' : 'success',
      }).returning({ id: auditLogs.id });
      
      // 同步到向量记忆（用于学习）
      if (comment || sentiment !== 'neutral') {
        const memoryContent = `任务反馈 [${taskType}]: ${sentiment} - ${comment || value}`;
        await vectorMemory.storeMemory(memoryContent, 'learning', {
          taskId,
          taskType,
          sentiment,
          value,
        }, sentiment === 'positive' ? 1.2 : 0.8);
      }
      
      // 缓存
      this.feedbackCache.push({
        id: result.id,
        taskId,
        taskType,
        feedback,
        value,
        sentiment,
        comment,
        context,
        createdAt: new Date(),
      });
      
      console.log(`[Feedback] Recorded: ${taskType} -> ${sentiment}`);
      return result.id;
      
    } catch (error) {
      console.error('[Feedback] Failed to record:', error);
      throw error;
    }
  }
  
  /**
   * 快速点赞/点踩
   */
  async thumbsUpDown(
    taskId: string,
    taskType: string,
    isPositive: boolean,
    comment?: string
  ): Promise<number> {
    return this.recordFeedback(
      taskId,
      taskType,
      'thumbs',
      isPositive ? 'up' : 'down',
      comment
    );
  }
  
  /**
   * 评分（1-5星）
   */
  async rate(
    taskId: string,
    taskType: string,
    rating: number,
    comment?: string
  ): Promise<number> {
    const clampedRating = Math.max(1, Math.min(5, rating));
    return this.recordFeedback(
      taskId,
      taskType,
      'rating',
      clampedRating,
      comment
    );
  }
  
  /**
   * 获取任务类型表现
   */
  async getTaskPerformance(
    taskType: string,
    days: number = 30
  ): Promise<TaskPerformance> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    try {
      const logs = await db.select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.action, 'user_feedback'),
          gte(auditLogs.createdAt, since)
        ));
      
      // 过滤指定任务类型
      const relevantLogs = logs.filter(log => {
        try {
          const details = JSON.parse(log.details || '{}');
          return details.taskType === taskType;
        } catch {
          return false;
        }
      });
      
      const totalCount = relevantLogs.length;
      let positiveCount = 0;
      let negativeCount = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      
      for (const log of relevantLogs) {
        const details = JSON.parse(log.details || '{}');
        if (details.sentiment === 'positive') positiveCount++;
        if (details.sentiment === 'negative') negativeCount++;
        if (details.feedback === 'rating' && typeof details.value === 'number') {
          ratingSum += details.value;
          ratingCount++;
        }
      }
      
      const successRate = totalCount > 0 ? positiveCount / totalCount : 0;
      const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
      
      // 计算趋势（比较前半期和后半期）
      const midpoint = Math.floor(relevantLogs.length / 2);
      const firstHalf = relevantLogs.slice(0, midpoint);
      const secondHalf = relevantLogs.slice(midpoint);
      
      const firstPositive = firstHalf.filter(l => JSON.parse(l.details || '{}').sentiment === 'positive').length;
      const secondPositive = secondHalf.filter(l => JSON.parse(l.details || '{}').sentiment === 'positive').length;
      
      const firstRate = firstHalf.length > 0 ? firstPositive / firstHalf.length : 0;
      const secondRate = secondHalf.length > 0 ? secondPositive / secondHalf.length : 0;
      
      let trend: TaskPerformance['trend'] = 'stable';
      if (secondRate - firstRate > 0.1) trend = 'improving';
      if (firstRate - secondRate > 0.1) trend = 'declining';
      
      return {
        taskType,
        totalCount,
        positiveCount,
        negativeCount,
        successRate,
        avgRating,
        trend,
      };
      
    } catch (error) {
      console.error('[Feedback] Failed to get performance:', error);
      return {
        taskType,
        totalCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        successRate: 0,
        avgRating: 0,
        trend: 'stable',
      };
    }
  }
  
  /**
   * 获取所有任务类型表现
   */
  async getAllPerformance(days: number = 30): Promise<TaskPerformance[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    try {
      const logs = await db.select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.action, 'user_feedback'),
          gte(auditLogs.createdAt, since)
        ));
      
      // 按任务类型分组
      const taskTypes = new Set<string>();
      for (const log of logs) {
        try {
          const details = JSON.parse(log.details || '{}');
          if (details.taskType) taskTypes.add(details.taskType);
        } catch {}
      }
      
      const performances: TaskPerformance[] = [];
      for (const taskType of taskTypes) {
        const perf = await this.getTaskPerformance(taskType, days);
        performances.push(perf);
      }
      
      // 按成功率排序
      performances.sort((a, b) => b.successRate - a.successRate);
      
      return performances;
      
    } catch (error) {
      console.error('[Feedback] Failed to get all performance:', error);
      return [];
    }
  }
  
  /**
   * 生成进化报告
   */
  async generateEvolutionReport(days: number = 7): Promise<EvolutionReport> {
    const performances = await this.getAllPerformance(days);
    
    // 计算整体满意度
    let totalPositive = 0;
    let totalCount = 0;
    for (const perf of performances) {
      totalPositive += perf.positiveCount;
      totalCount += perf.totalCount;
    }
    const overallSatisfaction = totalCount > 0 ? totalPositive / totalCount : 0;
    
    // 找出表现最好和需要改进的任务
    const topPerformers = performances
      .filter(p => p.successRate >= 0.8 && p.totalCount >= 3)
      .slice(0, 3);
    
    const needsImprovement = performances
      .filter(p => p.successRate < 0.6 || p.trend === 'declining')
      .slice(0, 3);
    
    // 生成学习亮点
    const learningHighlights: string[] = [];
    for (const perf of topPerformers) {
      learningHighlights.push(`${perf.taskType} 表现优秀 (${(perf.successRate * 100).toFixed(0)}% 满意率)`);
    }
    
    // 生成建议
    const recommendations: string[] = [];
    for (const perf of needsImprovement) {
      if (perf.trend === 'declining') {
        recommendations.push(`${perf.taskType} 需要关注：表现呈下降趋势`);
      } else if (perf.successRate < 0.5) {
        recommendations.push(`${perf.taskType} 需要改进：满意率仅 ${(perf.successRate * 100).toFixed(0)}%`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('继续保持当前水平，爸爸对小智的表现很满意！');
    }
    
    const report: EvolutionReport = {
      period: `最近 ${days} 天`,
      overallSatisfaction,
      topPerformers,
      needsImprovement,
      learningHighlights,
      recommendations,
    };
    
    // 保存报告
    try {
      await db.insert(dailyReports).values({
        reportDate: new Date(),
        content: JSON.stringify(report),
        highlights: learningHighlights,
        pendingItems: recommendations,
        suggestions: recommendations,
        aiSummary: `小智进化报告：整体满意度 ${(overallSatisfaction * 100).toFixed(0)}%`,
      });
    } catch (error) {
      console.error('[Feedback] Failed to save report:', error);
    }
    
    return report;
  }
  
  /**
   * 获取改进建议
   */
  async getSuggestions(taskType?: string): Promise<string[]> {
    if (taskType) {
      const perf = await this.getTaskPerformance(taskType);
      const suggestions: string[] = [];
      
      if (perf.successRate < 0.7) {
        suggestions.push(`提高 ${taskType} 的准确性和响应质量`);
      }
      if (perf.avgRating < 4 && perf.avgRating > 0) {
        suggestions.push(`关注用户对 ${taskType} 的具体不满反馈`);
      }
      if (perf.trend === 'declining') {
        suggestions.push(`分析 ${taskType} 近期变化，找出下降原因`);
      }
      
      return suggestions.length > 0 ? suggestions : ['当前表现良好，继续保持'];
    }
    
    const report = await this.generateEvolutionReport(7);
    return report.recommendations;
  }
}

// 全局实例
export const userFeedback = new UserFeedbackService();

// 导出类
export { UserFeedbackService };
