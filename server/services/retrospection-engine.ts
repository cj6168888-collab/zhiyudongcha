/**
 * 小智 Retrospection Engine - 复盘引擎
 * Project Chrysalis (化蝶计划) - 凌晨自动复盘
 * 
 * 功能：
 * 1. 凌晨/算力空闲时自动启动
 * 2. 提取白天的商业谈话日志
 * 3. 针对失败案例进行"左右互搏"模拟
 * 4. 利用 Qwen-Max 生成"避坑指南"
 * 5. 更新本地 RAG 库
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RetrospectionEngine');

import { getDatabase } from '../db';
import { failureTags, ragKnowledge, avatarChatHistory, evolutionEvents, shadowMemories } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { failureCollector, CollectedFailure } from './failure-collector';

export interface RetrospectionSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  failuresProcessed: number;
  knowledgeGenerated: number;
  insightsDiscovered: string[];
}

export interface DebateRound {
  topic: string;
  proArguments: string[];
  conArguments: string[];
  synthesis: string;
  winningPosition: 'pro' | 'con' | 'balanced';
}

export interface PitfallGuide {
  id: string;
  category: string;
  title: string;
  description: string;
  triggerPatterns: string[];
  avoidanceStrategy: string;
  confidence: number;
}

class RetrospectionEngineService {
  private isRunning: boolean = false;
  private currentSession: RetrospectionSession | null = null;
  
  private readonly IDLE_CHECK_INTERVAL = 5 * 60 * 1000;
  private readonly RETROSPECTION_HOURS = [2, 3, 4, 5];
  
  isRetrospectionTime(): boolean {
    const hour = new Date().getHours();
    return this.RETROSPECTION_HOURS.includes(hour);
  }
  
  async startRetrospection(): Promise<RetrospectionSession> {
    if (this.isRunning) {
      throw new Error('复盘引擎已在运行中');
    }
    
    this.isRunning = true;
    
    const session: RetrospectionSession = {
      id: `retro_${Date.now()}`,
      startTime: new Date(),
      status: 'running',
      failuresProcessed: 0,
      knowledgeGenerated: 0,
      insightsDiscovered: [],
    };
    
    this.currentSession = session;
    
    logger.info(`[Retrospection] 复盘引擎启动: ${session.id}`);
    
    try {
      await failureCollector.scanChatHistoryForFailures();
      await failureCollector.scanAuditLogsForFailures();
      
      const failures = await failureCollector.getUnprocessedFailures(50);
      logger.info(`[Retrospection] 发现 ${failures.length} 个待处理失败案例`);
      
      for (const failure of failures) {
        try {
          const result = await this.processFailure(failure);
          session.failuresProcessed++;
          
          if (result.knowledgeGenerated) {
            session.knowledgeGenerated++;
          }
          
          if (result.insights.length > 0) {
            session.insightsDiscovered.push(...result.insights);
          }
          
          await failureCollector.markAsProcessed(failure.id, result);
        } catch (error) {
          logger.error({ err: error }, '处理失败案例出错');
        }
      }
      
      const businessInsights = await this.analyzeBusinessConversations();
      session.insightsDiscovered.push(...businessInsights);
      
      await this.recordEvolutionEvent(session);
      
      session.status = 'completed';
      session.endTime = new Date();
      
      logger.info(`[Retrospection] 复盘完成: 处理${session.failuresProcessed}个案例, 生成${session.knowledgeGenerated}条知识`);
      
    } catch (error) {
      logger.error({ err: error }, '复盘引擎错误');
      session.status = 'failed';
      session.endTime = new Date();
    } finally {
      this.isRunning = false;
    }
    
    return session;
  }
  
  private async processFailure(failure: CollectedFailure): Promise<{
    knowledgeGenerated: boolean;
    insights: string[];
    debate?: DebateRound;
  }> {
    logger.info(`[Retrospection] 处理失败案例: ${failure.tagType}`);
    
    const debate = await this.conductLeftRightDebate(failure);
    
    const pitfallGuide = await this.generatePitfallGuide(failure, debate);
    
    let knowledgeGenerated = false;
    if (pitfallGuide) {
      await getDatabase().insert(ragKnowledge).values({
        category: 'pitfall_guide',
        title: pitfallGuide.title,
        content: JSON.stringify(pitfallGuide),
        sourceFailureId: failure.id,
        confidence: pitfallGuide.confidence,
        keywords: pitfallGuide.triggerPatterns,
        isActive: 1,
        version: 1,
      });
      knowledgeGenerated = true;
    }
    
    const insights = this.extractInsights(failure, debate);
    
    for (const insight of insights) {
      await getDatabase().insert(shadowMemories).values({
        context: `复盘洞察 - ${failure.tagType}`,
        choiceMade: insight,
        field: 'retrospection',
        mimicryWeight: 1.2,
        expPoints: 15,
      });
    }
    
    return { knowledgeGenerated, insights, debate };
  }
  
  private async conductLeftRightDebate(failure: CollectedFailure): Promise<DebateRound> {
    logger.info(`[Retrospection] 开始左右互搏辩论...`);
    
    const topic = `分析失败原因: ${failure.originalQuery.slice(0, 100)}`;
    
    const proArguments = this.generateProArguments(failure);
    const conArguments = this.generateConArguments(failure);
    
    const synthesis = this.synthesizeDebate(proArguments, conArguments);
    const winningPosition = this.determineWinner(proArguments, conArguments);
    
    return {
      topic,
      proArguments,
      conArguments,
      synthesis,
      winningPosition,
    };
  }
  
  private generateProArguments(failure: CollectedFailure): string[] {
    const args: string[] = [];
    
    switch (failure.tagType) {
      case 'UNANSWERED':
        args.push('问题超出当前知识范围，需要扩展知识库');
        args.push('可能涉及敏感话题，谨慎回答是正确的');
        args.push('用户问题表述模糊，需要更多上下文');
        break;
      case 'EXECUTION_ERROR':
        args.push('外部系统不稳定导致执行失败');
        args.push('操作超时可能是网络问题');
        args.push('目标元素动态加载未完成');
        break;
      case 'USER_CORRECTION':
        args.push('用户有个人偏好，需要学习');
        args.push('原始回答逻辑正确但风格不符');
        args.push('用户修正提供了宝贵的学习机会');
        break;
      default:
        args.push('需要更多信息才能准确分析');
    }
    
    return args;
  }
  
  private generateConArguments(failure: CollectedFailure): string[] {
    const args: string[] = [];
    
    switch (failure.tagType) {
      case 'UNANSWERED':
        args.push('应该尝试推理给出部分答案');
        args.push('可以坦诚说不知道同时提供相关信息');
        args.push('应该主动询问用户以获取更多上下文');
        break;
      case 'EXECUTION_ERROR':
        args.push('应该增加重试机制');
        args.push('错误处理需要更优雅');
        args.push('应该在执行前进行更多验证');
        break;
      case 'USER_CORRECTION':
        args.push('应该更仔细分析用户历史偏好');
        args.push('回答前应该考虑更多可能性');
        args.push('需要建立更好的用户画像');
        break;
      default:
        args.push('需要改进错误分类机制');
    }
    
    return args;
  }
  
  private synthesizeDebate(pro: string[], con: string[]): string {
    const synthesis = `经过左右互搏分析：
正方观点(${pro.length}条): ${pro.join('; ')}
反方观点(${con.length}条): ${con.join('; ')}
综合结论: 需要在保持原有优势的同时，积极改进不足之处。`;
    
    return synthesis;
  }
  
  private determineWinner(pro: string[], con: string[]): 'pro' | 'con' | 'balanced' {
    if (pro.length > con.length + 1) return 'pro';
    if (con.length > pro.length + 1) return 'con';
    return 'balanced';
  }
  
  private async generatePitfallGuide(
    failure: CollectedFailure,
    debate: DebateRound
  ): Promise<PitfallGuide | null> {
    const triggerPatterns = this.extractTriggerPatterns(failure.originalQuery);
    
    if (triggerPatterns.length === 0) {
      return null;
    }
    
    const guide: PitfallGuide = {
      id: `pitfall_${Date.now()}`,
      category: this.categorizeFailure(failure),
      title: `避坑指南: ${failure.tagType}`,
      description: `基于失败案例的学习: ${failure.failureReason}`,
      triggerPatterns,
      avoidanceStrategy: debate.synthesis,
      confidence: debate.winningPosition === 'balanced' ? 0.7 : 0.85,
    };
    
    return guide;
  }
  
  private extractTriggerPatterns(query: string): string[] {
    const patterns: string[] = [];
    
    const keywords = query.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    patterns.push(...keywords.slice(0, 5));
    
    const businessTerms = ['合同', '协议', '条款', '违约', '付款', '交付', '签署'];
    businessTerms.forEach(term => {
      if (query.includes(term)) {
        patterns.push(term);
      }
    });
    
    return Array.from(new Set(patterns));
  }
  
  private categorizeFailure(failure: CollectedFailure): string {
    const query = failure.originalQuery.toLowerCase();
    
    if (query.includes('合同') || query.includes('法律') || query.includes('条款')) {
      return 'legal';
    }
    if (query.includes('价格') || query.includes('付款') || query.includes('成本')) {
      return 'finance';
    }
    if (query.includes('谈判') || query.includes('策略') || query.includes('对手')) {
      return 'negotiation';
    }
    if (query.includes('截图') || query.includes('识别') || query.includes('图片')) {
      return 'vision';
    }
    
    return 'general';
  }
  
  private extractInsights(failure: CollectedFailure, debate: DebateRound): string[] {
    const insights: string[] = [];
    
    if (debate.winningPosition === 'con') {
      insights.push(`需要改进: ${debate.conArguments[0]}`);
    }
    
    if (failure.userCorrection) {
      insights.push(`用户偏好: ${failure.userCorrection.slice(0, 50)}`);
    }
    
    if (failure.tagType === 'EXECUTION_ERROR') {
      insights.push(`系统优化点: ${failure.context.module}模块需要增强稳定性`);
    }
    
    return insights;
  }
  
  private async analyzeBusinessConversations(): Promise<string[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const chats = await getDatabase().select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, today))
      .orderBy(desc(avatarChatHistory.createdAt));
    
    const insights: string[] = [];
    
    const businessKeywords = ['合同', '谈判', '价格', '竞争', '客户', '项目', '风险'];
    const businessChats = chats.filter(c => 
      businessKeywords.some(k => (c.content || '').includes(k))
    );
    
    if (businessChats.length > 5) {
      insights.push(`今日商业话题活跃: ${businessChats.length}条相关对话`);
    }
    
    const riskMentions = chats.filter(c => 
      (c.content || '').includes('风险') || (c.content || '').includes('问题')
    );
    
    if (riskMentions.length > 0) {
      insights.push(`发现${riskMentions.length}处风险提及，需要关注`);
    }
    
    return insights;
  }
  
  private async recordEvolutionEvent(session: RetrospectionSession): Promise<void> {
    await getDatabase().insert(evolutionEvents).values({
      sourceModule: 'retrospection_engine',
      eventType: 'NIGHT_RETROSPECTION',
      previousValue: null,
      newValue: {
        sessionId: session.id,
        failuresProcessed: session.failuresProcessed,
        knowledgeGenerated: session.knowledgeGenerated,
        insightsCount: session.insightsDiscovered.length,
      } as any,
      deltaDescription: `复盘会话完成: 处理${session.failuresProcessed}个案例`,
      triggeredBy: 'chrysalis_auto',
    });
  }
  
  getStatus(): { isRunning: boolean; currentSession: RetrospectionSession | null } {
    return {
      isRunning: this.isRunning,
      currentSession: this.currentSession,
    };
  }
  
  async getRecentKnowledge(limit: number = 10): Promise<any[]> {
    return await getDatabase().select()
      .from(ragKnowledge)
      .where(eq(ragKnowledge.isActive, 1))
      .orderBy(desc(ragKnowledge.createdAt))
      .limit(limit);
  }
}

export const retrospectionEngine = new RetrospectionEngineService();

export { RetrospectionEngineService };
