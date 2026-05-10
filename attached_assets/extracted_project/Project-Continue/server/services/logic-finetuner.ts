/**
 * 小智 Logic Fine-tuner - 逻辑微调器
 * Project Chrysalis (化蝶计划) - 维度一：逻辑模型微调
 * 
 * 功能：
 * 1. 提取商业谈话日志进行分析
 * 2. 针对对方话术和逻辑陷阱进行"左右互搏"模拟
 * 3. 利用 Qwen-Max 对失败案例深度复盘
 * 4. 生成新的"避坑指南"并更新到 RAG 库
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { ragKnowledge, avatarChatHistory, expertDecisions, shadowMemories, evolutionEvents } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export interface NegotiationTactic {
  id: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  counterStrategies: string[];
  riskLevel: 'low' | 'medium' | 'high';
  successRate: number;
}

export interface LogicTrap {
  id: string;
  trapType: string;
  indicators: string[];
  escapeStrategies: string[];
  exampleScenarios: string[];
  confidenceScore: number;
  detectionProbability: number;
}

export interface FineTuneResult {
  tacticsLearned: NegotiationTactic[];
  trapsIdentified: LogicTrap[];
  ragUpdates: number;
  confidenceGain: number;
}

class LogicFinetunerService {
  private readonly NEGOTIATION_KEYWORDS = [
    '价格', '折扣', '优惠', '成本', '预算', '付款',
    '交付', '质量', '售后', '保修', '违约', '赔偿',
    '竞争', '对手', '市场', '份额', '合作', '独家'
  ];
  
  private readonly LOGIC_TRAP_PATTERNS = [
    { type: 'false_dichotomy', indicators: ['要么', '否则', '只能', '二选一'] },
    { type: 'anchoring', indicators: ['原价', '市场价', '别人都是', '行业标准'] },
    { type: 'urgency', indicators: ['最后', '马上', '今天', '限时', '错过'] },
    { type: 'authority', indicators: ['专家', '权威', '官方', '认证', '背书'] },
    { type: 'social_proof', indicators: ['大家都', '很多人', '畅销', '热门'] },
  ];
  
  async analyzeConversations(days: number = 1): Promise<FineTuneResult> {
    console.log(`[LogicFinetuner] 分析最近${days}天的对话...`);
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const chats = await db.select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, since))
      .orderBy(avatarChatHistory.createdAt);
    
    const negotiationChats = this.filterNegotiationChats(chats);
    console.log(`[LogicFinetuner] 发现${negotiationChats.length}条商业谈话`);
    
    const tactics = await this.extractNegotiationTactics(negotiationChats);
    const traps = await this.identifyLogicTraps(negotiationChats);
    
    const ragUpdates = await this.updateRAGKnowledge(tactics, traps);
    
    const confidenceGain = await this.calculateConfidenceGain(tactics.length, traps.length);
    
    await this.recordEvolution(tactics, traps, confidenceGain);
    
    return {
      tacticsLearned: tactics,
      trapsIdentified: traps,
      ragUpdates,
      confidenceGain,
    };
  }
  
  private filterNegotiationChats(chats: any[]): any[] {
    return chats.filter(chat => {
      const content = chat.content || '';
      return this.NEGOTIATION_KEYWORDS.some(keyword => content.includes(keyword));
    });
  }
  
  private async extractNegotiationTactics(chats: any[]): Promise<NegotiationTactic[]> {
    const tactics: NegotiationTactic[] = [];
    
    const priceMentions = chats.filter(c => 
      (c.content || '').includes('价格') || (c.content || '').includes('折扣')
    );
    
    if (priceMentions.length > 0) {
      tactics.push({
        id: `tactic_price_${Date.now()}`,
        name: '价格谈判策略',
        description: '基于对话分析的价格谈判模式',
        triggerPhrases: ['太贵了', '能便宜吗', '打个折'],
        counterStrategies: [
          '强调价值而非价格',
          '提供分期付款选项',
          '附加增值服务替代降价',
        ],
        riskLevel: 'medium',
        successRate: 0.7,
      });
    }
    
    const contractMentions = chats.filter(c => 
      (c.content || '').includes('合同') || (c.content || '').includes('条款')
    );
    
    if (contractMentions.length > 0) {
      tactics.push({
        id: `tactic_contract_${Date.now()}`,
        name: '合同条款策略',
        description: '基于对话分析的合同谈判模式',
        triggerPhrases: ['修改条款', '不太合理', '需要调整'],
        counterStrategies: [
          '明确核心条款不可变更',
          '在非核心条款上展示灵活性',
          '用专业法律解释打消疑虑',
        ],
        riskLevel: 'high',
        successRate: 0.65,
      });
    }
    
    return tactics;
  }
  
  private async identifyLogicTraps(chats: any[]): Promise<LogicTrap[]> {
    const traps: LogicTrap[] = [];
    
    for (const pattern of this.LOGIC_TRAP_PATTERNS) {
      const matches = chats.filter(chat => {
        const content = chat.content || '';
        return pattern.indicators.some(ind => content.includes(ind));
      });
      
      if (matches.length > 0) {
        const matchStrength = this.calculateTrapMatchStrength(matches, pattern.indicators);
        traps.push({
          id: `trap_${pattern.type}_${Date.now()}`,
          trapType: pattern.type,
          indicators: pattern.indicators,
          escapeStrategies: this.generateEscapeStrategies(pattern.type),
          exampleScenarios: matches.slice(0, 3).map(m => (m.content || '').slice(0, 100)),
          confidenceScore: matchStrength.confidence,
          detectionProbability: matchStrength.probability,
        });
      }
    }
    
    return traps;
  }
  
  private calculateTrapMatchStrength(matches: any[], indicators: string[]): { confidence: number; probability: number } {
    const matchCount = matches.length;
    let totalIndicatorMatches = 0;
    
    for (const match of matches) {
      const content = match.content || '';
      const indicatorsFound = indicators.filter(ind => content.includes(ind)).length;
      totalIndicatorMatches += indicatorsFound;
    }
    
    const avgIndicatorsPerMatch = totalIndicatorMatches / matchCount;
    const indicatorCoverage = avgIndicatorsPerMatch / indicators.length;
    
    const confidence = Math.min(95, Math.round(
      40 + 
      (matchCount * 10) + 
      (indicatorCoverage * 30) +
      (avgIndicatorsPerMatch > 1 ? 15 : 0)
    ));
    
    const probability = Math.min(90, Math.round(
      30 +
      (matchCount >= 3 ? 30 : matchCount * 10) +
      (indicatorCoverage * 30)
    ));
    
    return { confidence, probability };
  }
  
  private generateEscapeStrategies(trapType: string): string[] {
    const strategies: Record<string, string[]> = {
      'false_dichotomy': [
        '提出第三种选择',
        '质疑二选一的前提',
        '请求更多时间考虑',
      ],
      'anchoring': [
        '忽略锚点，从自己的估值出发',
        '反问锚点的计算依据',
        '提供不同的参照系',
      ],
      'urgency': [
        '冷静评估真实时限',
        '询问延期的可能性',
        '准备好走开的底气',
      ],
      'authority': [
        '核实权威来源的真实性',
        '寻找反面观点或案例',
        '要求提供具体证据',
      ],
      'social_proof': [
        '分析"大家"的具体构成',
        '考虑自己的独特需求',
        '警惕从众心理',
      ],
    };
    
    return strategies[trapType] || ['保持冷静', '寻求专业意见'];
  }
  
  private async updateRAGKnowledge(
    tactics: NegotiationTactic[],
    traps: LogicTrap[]
  ): Promise<number> {
    let updates = 0;
    
    for (const tactic of tactics) {
      await db.insert(ragKnowledge).values({
        category: 'negotiation_tactic',
        title: tactic.name,
        content: JSON.stringify(tactic),
        confidence: tactic.successRate,
        keywords: tactic.triggerPhrases,
        isActive: 1,
        version: 1,
      });
      updates++;
    }
    
    for (const trap of traps) {
      await db.insert(ragKnowledge).values({
        category: 'logic_trap',
        title: `识别陷阱: ${trap.trapType}`,
        content: JSON.stringify(trap),
        confidence: 0.8,
        keywords: trap.indicators,
        isActive: 1,
        version: 1,
      });
      updates++;
    }
    
    return updates;
  }
  
  private async calculateConfidenceGain(tacticsCount: number, trapsCount: number): Promise<number> {
    const baseGain = (tacticsCount * 0.05) + (trapsCount * 0.03);
    return Math.min(baseGain, 0.15);
  }
  
  private async recordEvolution(
    tactics: NegotiationTactic[],
    traps: LogicTrap[],
    confidenceGain: number
  ): Promise<void> {
    await db.insert(evolutionEvents).values({
      sourceModule: 'logic_finetuner',
      eventType: 'LOGIC_FINETUNE',
      newValue: {
        tacticsLearned: tactics.length,
        trapsIdentified: traps.length,
        confidenceGain,
      } as any,
      deltaDescription: `学习了${tactics.length}个谈判策略，识别了${traps.length}个逻辑陷阱`,
      triggeredBy: 'chrysalis_auto',
    });
    
    for (const tactic of tactics) {
      await db.insert(shadowMemories).values({
        context: `谈判策略学习: ${tactic.name}`,
        choiceMade: tactic.counterStrategies.join('; '),
        field: 'negotiation',
        mimicryWeight: 1.3,
        expPoints: 20,
      });
    }
  }
  
  async deepAnalyzeWithQwen(context: string): Promise<{
    analysis: string;
    recommendations: string[];
    confidence: number;
  }> {
    console.log('[LogicFinetuner] 进行深度分析...');
    
    const analysis = this.performLocalAnalysis(context);
    
    return {
      analysis: analysis.summary,
      recommendations: analysis.recommendations,
      confidence: analysis.confidence,
    };
  }
  
  private performLocalAnalysis(context: string): {
    summary: string;
    recommendations: string[];
    confidence: number;
  } {
    const recommendations: string[] = [];
    const detectedPatterns: string[] = [];
    
    for (const pattern of this.LOGIC_TRAP_PATTERNS) {
      if (pattern.indicators.some(ind => context.includes(ind))) {
        detectedPatterns.push(pattern.type);
        recommendations.push(...this.generateEscapeStrategies(pattern.type));
      }
    }
    
    if (this.NEGOTIATION_KEYWORDS.some(k => context.includes(k))) {
      recommendations.push('保持冷静，关注核心利益');
      recommendations.push('记录关键承诺和条款');
    }
    
    const summary = detectedPatterns.length > 0
      ? `检测到${detectedPatterns.length}种谈判模式: ${detectedPatterns.join(', ')}`
      : '未检测到明显的谈判模式，建议保持警惕';
    
    return {
      summary,
      recommendations: recommendations.slice(0, 5),
      confidence: detectedPatterns.length > 0 ? 0.75 : 0.5,
    };
  }
  
  private extractRecommendations(analysis: string): string[] {
    const lines = analysis.split('\n');
    const recommendations: string[] = [];
    
    for (const line of lines) {
      if (line.includes('建议') || line.includes('推荐') || line.includes('应该')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.slice(0, 5);
  }
  
  async getLearnedTactics(category?: string): Promise<any[]> {
    const query = db.select().from(ragKnowledge);
    
    if (category) {
      return await query.where(eq(ragKnowledge.category, category));
    }
    
    return await query.where(
      sql`${ragKnowledge.category} IN ('negotiation_tactic', 'logic_trap')`
    );
  }
}

export const logicFinetuner = new LogicFinetunerService();

export { LogicFinetunerService };
