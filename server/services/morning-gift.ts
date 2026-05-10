/**
 * 小智 Morning Gift - 晨间礼物生成器
 * Project Chrysalis (化蝶计划) - 进化成果展示
 * 
 * 功能：
 * 1. 生成每日晨间报告
 * 2. 展示昨夜的进化成果
 * 3. 列出商业机会和潜在风险
 * 4. 准备今日谈判的"秘密武器"
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('MorningGift');

import { getDatabase } from '../db';
import { 
  morningGifts, evolutionEvents, ragKnowledge, codePatches,
  failureTags, shadowMemories, avatarChatHistory, intelItems
} from '@shared/schema';
import { eq, desc, and, gte, sql, count } from 'drizzle-orm';

export interface MorningGiftContent {
  id: string;
  date: Date;
  
  greeting: string;
  evolutionSummary: string;
  performanceBoost: string;
  
  opportunities: OpportunityItem[];
  risks: RiskItem[];
  secretWeapons: SecretWeapon[];
  
  todayFocus: string[];
  preparedActions: PreparedAction[];
  
  newCapabilities: string[];
}

export interface OpportunityItem {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  mitigation: string;
}

export interface SecretWeapon {
  id: string;
  name: string;
  description: string;
  usageScenario: string;
  effectiveness: number;
}

export interface PreparedAction {
  id: string;
  action: string;
  target: string;
  priority: number;
  estimatedImpact: string;
}

class MorningGiftService {
  async generateMorningGift(): Promise<MorningGiftContent> {
    logger.info('[MorningGift] 生成晨间礼物...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const evolutionData = await this.collectEvolutionData(yesterday, today);
    const opportunities = await this.identifyOpportunities();
    const risks = await this.identifyRisks();
    const secretWeapons = await this.prepareSecretWeapons();
    const todayFocus = await this.determineTodayFocus();
    const preparedActions = await this.generatePreparedActions();
    
    const greeting = this.generateGreeting(evolutionData);
    const evolutionSummary = this.generateEvolutionSummary(evolutionData);
    const performanceBoost = this.calculatePerformanceBoost(evolutionData);
    
    const gift: MorningGiftContent = {
      id: `gift_${Date.now()}`,
      date: today,
      greeting,
      evolutionSummary,
      performanceBoost,
      opportunities,
      risks,
      secretWeapons,
      todayFocus,
      preparedActions,
      newCapabilities: evolutionData.newCapabilities,
    };
    
    await this.saveMorningGift(gift);
    
    logger.info('[MorningGift] 晨间礼物生成完成');
    
    return gift;
  }
  
  private async collectEvolutionData(from: Date, to: Date): Promise<{
    eventsCount: number;
    failuresProcessed: number;
    knowledgeGained: number;
    patchesDeployed: number;
    newCapabilities: string[];
  }> {
    const events = await getDatabase().select()
      .from(evolutionEvents)
      .where(and(
        gte(evolutionEvents.createdAt, from),
        sql`${evolutionEvents.createdAt} < ${to.toISOString()}`
      ));
    
    const processedFailures = await getDatabase().select({ count: count() })
      .from(failureTags)
      .where(and(
        eq(failureTags.isProcessed, 1),
        gte(failureTags.processedAt, from)
      ));
    
    const newKnowledge = await getDatabase().select({ count: count() })
      .from(ragKnowledge)
      .where(gte(ragKnowledge.createdAt, from));
    
    const deployedPatches = await getDatabase().select({ count: count() })
      .from(codePatches)
      .where(and(
        eq(codePatches.isDeployed, 1),
        gte(codePatches.appliedAt, from)
      ));
    
    const newCapabilities: string[] = [];
    
    for (const event of events) {
      const newValue = event.newValue as Record<string, any> || {};
      if (newValue.newCapabilities) {
        newCapabilities.push(...newValue.newCapabilities);
      }
      if (event.deltaDescription) {
        newCapabilities.push(event.deltaDescription);
      }
    }
    
    return {
      eventsCount: events.length,
      failuresProcessed: processedFailures[0]?.count || 0,
      knowledgeGained: newKnowledge[0]?.count || 0,
      patchesDeployed: deployedPatches[0]?.count || 0,
      newCapabilities: Array.from(new Set(newCapabilities)).slice(0, 5),
    };
  }
  
  private async identifyOpportunities(): Promise<OpportunityItem[]> {
    const opportunities: OpportunityItem[] = [];
    
    const recentChats = await getDatabase().select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy(desc(avatarChatHistory.createdAt))
      .limit(100);
    
    const opportunityKeywords = ['合作', '项目', '投资', '机会', '意向', '需求'];
    
    for (const chat of recentChats) {
      const content = chat.content || '';
      const hasOpportunity = opportunityKeywords.some(k => content.includes(k));
      
      if (hasOpportunity && chat.role === 'user') {
        opportunities.push({
          id: `opp_${chat.id}`,
          title: '潜在商业机会',
          description: content.slice(0, 100),
          source: '对话分析',
          priority: 'medium',
          suggestedAction: '跟进了解详情',
        });
      }
    }
    
    const pendingIntel = await getDatabase().select()
      .from(intelItems)
      .where(eq(intelItems.status, 'PENDING'))
      .limit(5);
    
    for (const intel of pendingIntel) {
      opportunities.push({
        id: `opp_intel_${intel.id}`,
        title: intel.title,
        description: intel.content || '',
        source: intel.source || '情报收集',
        priority: intel.riskLevel === 'HIGH' ? 'high' : 'medium',
        suggestedAction: intel.aiRecommendation || '需要进一步分析',
      });
    }
    
    return opportunities.slice(0, 5);
  }
  
  private async identifyRisks(): Promise<RiskItem[]> {
    const risks: RiskItem[] = [];
    
    const unprocessedFailures = await getDatabase().select({ count: count() })
      .from(failureTags)
      .where(eq(failureTags.isProcessed, 0));
    
    const failureCount = unprocessedFailures[0]?.count || 0;
    
    if (failureCount > 10) {
      risks.push({
        id: 'risk_failures',
        title: '待处理失败案例积压',
        description: `有${failureCount}个失败案例待处理`,
        severity: failureCount > 20 ? 'critical' : 'warning',
        mitigation: '建议今晚运行完整复盘周期',
      });
    }
    
    const recentChats = await getDatabase().select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
    
    const riskKeywords = ['风险', '问题', '困难', '担心', '违约', '损失'];
    const riskMentions = recentChats.filter(c => 
      riskKeywords.some(k => (c.content || '').includes(k))
    );
    
    if (riskMentions.length > 3) {
      risks.push({
        id: 'risk_mentions',
        title: '对话中多次提及风险',
        description: `昨日对话中有${riskMentions.length}处风险相关讨论`,
        severity: 'warning',
        mitigation: '建议详细review这些对话内容',
      });
    }
    
    return risks;
  }
  
  private async prepareSecretWeapons(): Promise<SecretWeapon[]> {
    const weapons: SecretWeapon[] = [];
    
    const recentKnowledge = await getDatabase().select()
      .from(ragKnowledge)
      .where(eq(ragKnowledge.category, 'negotiation_tactic'))
      .orderBy(desc(ragKnowledge.createdAt))
      .limit(3);
    
    for (const knowledge of recentKnowledge) {
      const content = typeof knowledge.content === 'string' 
        ? JSON.parse(knowledge.content) 
        : knowledge.content;
      
      weapons.push({
        id: `weapon_${knowledge.id}`,
        name: knowledge.title,
        description: content.description || '新学习的谈判策略',
        usageScenario: content.triggerPhrases?.join(', ') || '商业谈判场景',
        effectiveness: knowledge.confidence || 0.7,
      });
    }
    
    const trapKnowledge = await getDatabase().select()
      .from(ragKnowledge)
      .where(eq(ragKnowledge.category, 'logic_trap'))
      .orderBy(desc(ragKnowledge.createdAt))
      .limit(2);
    
    for (const trap of trapKnowledge) {
      weapons.push({
        id: `weapon_trap_${trap.id}`,
        name: `反制: ${trap.title}`,
        description: '识别并反制对方的逻辑陷阱',
        usageScenario: '当对方使用类似策略时',
        effectiveness: 0.8,
      });
    }
    
    return weapons;
  }
  
  private async determineTodayFocus(): Promise<string[]> {
    const focus: string[] = [];
    
    const risks = await this.identifyRisks();
    if (risks.some(r => r.severity === 'critical')) {
      focus.push('处理紧急风险事项');
    }
    
    const opportunities = await this.identifyOpportunities();
    if (opportunities.some(o => o.priority === 'high')) {
      focus.push('跟进高优先级商业机会');
    }
    
    focus.push('保持高效沟通');
    focus.push('记录重要决策');
    
    return focus.slice(0, 4);
  }
  
  private async generatePreparedActions(): Promise<PreparedAction[]> {
    const actions: PreparedAction[] = [];
    
    const opportunities = await this.identifyOpportunities();
    
    for (const opp of opportunities.slice(0, 3)) {
      actions.push({
        id: `action_${opp.id}`,
        action: opp.suggestedAction,
        target: opp.title,
        priority: opp.priority === 'high' ? 1 : opp.priority === 'medium' ? 2 : 3,
        estimatedImpact: '推进商业进展',
      });
    }
    
    return actions;
  }
  
  private generateGreeting(evolutionData: { eventsCount: number; failuresProcessed: number; knowledgeGained: number; patchesDeployed: number; newCapabilities: string[] }): string {
    const hour = new Date().getHours();
    let timeGreeting = '早安';
    
    if (hour >= 5 && hour < 9) {
      timeGreeting = '早安';
    } else if (hour >= 9 && hour < 12) {
      timeGreeting = '上午好';
    } else if (hour >= 12 && hour < 14) {
      timeGreeting = '中午好';
    } else if (hour >= 14 && hour < 18) {
      timeGreeting = '下午好';
    } else {
      timeGreeting = '晚上好';
    }
    
    if (evolutionData.eventsCount > 0) {
      return `${timeGreeting}，爸爸！昨晚我复盘了${evolutionData.failuresProcessed}个案例，学到了新东西呢~`;
    }
    
    return `${timeGreeting}，爸爸！新的一天开始了，我已经准备好为您服务~`;
  }
  
  private generateEvolutionSummary(evolutionData: { eventsCount: number; failuresProcessed: number; knowledgeGained: number; patchesDeployed: number; newCapabilities: string[] }): string {
    const parts: string[] = [];
    
    if (evolutionData.failuresProcessed > 0) {
      parts.push(`复盘了${evolutionData.failuresProcessed}个失败案例`);
    }
    
    if (evolutionData.knowledgeGained > 0) {
      parts.push(`新增${evolutionData.knowledgeGained}条知识`);
    }
    
    if (evolutionData.patchesDeployed > 0) {
      parts.push(`优化了${evolutionData.patchesDeployed}处代码`);
    }
    
    if (parts.length === 0) {
      return '昨晚系统运行平稳，各项功能正常。';
    }
    
    return `昨晚的成长：${parts.join('，')}。`;
  }
  
  private calculatePerformanceBoost(evolutionData: { eventsCount: number; failuresProcessed: number; knowledgeGained: number; patchesDeployed: number; newCapabilities: string[] }): string {
    const boost = evolutionData.patchesDeployed * 5 + evolutionData.knowledgeGained * 2;
    
    if (boost > 0) {
      return `预计今日处理效率提升${boost}%`;
    }
    
    return '系统状态良好';
  }
  
  private async saveMorningGift(gift: MorningGiftContent): Promise<void> {
    await getDatabase().insert(morningGifts).values({
      giftDate: gift.date,
      evolutionSummary: gift.evolutionSummary,
      evolutionDetails: {
        greeting: gift.greeting,
        performanceBoost: gift.performanceBoost,
      } as Record<string, unknown>,
      opportunities: gift.opportunities as unknown,
      risks: gift.risks as unknown,
      secretWeapons: gift.secretWeapons as unknown,
      todayFocus: gift.todayFocus,
      preparedActions: gift.preparedActions as unknown,
      performanceBoost: gift.performanceBoost,
      newCapabilities: gift.newCapabilities,
      isRead: 0,
    });
  }
  
  async getTodayGift(): Promise<MorningGiftContent | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const gifts = await getDatabase().select()
      .from(morningGifts)
      .where(gte(morningGifts.giftDate, today))
      .orderBy(desc(morningGifts.createdAt))
      .limit(1);
    
    if (gifts.length === 0) {
      return null;
    }
    
    const gift = gifts[0];
    const details = gift.evolutionDetails as Record<string, any> || {};
    
    return {
      id: gift.id,
      date: gift.giftDate,
      greeting: details.greeting || '',
      evolutionSummary: gift.evolutionSummary || '',
      performanceBoost: gift.performanceBoost || '',
      opportunities: (gift.opportunities as OpportunityItem[]) || [],
      risks: (gift.risks as RiskItem[]) || [],
      secretWeapons: (gift.secretWeapons as SecretWeapon[]) || [],
      todayFocus: gift.todayFocus || [],
      preparedActions: (gift.preparedActions as PreparedAction[]) || [],
      newCapabilities: gift.newCapabilities || [],
    };
  }
  
  async markAsRead(giftId: string): Promise<void> {
    await getDatabase().update(morningGifts)
      .set({
        isRead: 1,
        readAt: new Date(),
      })
      .where(eq(morningGifts.id, giftId));
  }
  
  async getRecentGifts(limit: number = 7): Promise<any[]> {
    return await getDatabase().select()
      .from(morningGifts)
      .orderBy(desc(morningGifts.giftDate))
      .limit(limit);
  }
}

export const morningGift = new MorningGiftService();

export { MorningGiftService };
