/**
 * 小智多专家协同编排器 (Expert Orchestrator)
 * Navigator-X v1.0 - 五大专家席位系统
 *
 * 功能：
 * 1. 问题分类器 - 智能判断需要哪些专家
 * 2. 专家调度器 - 并行调用多专家 + 多模型路由
 * 3. 结果仲裁器 - 整合各专家意见，解决冲突
 * 4. 贡献度追踪 - 记录专家参与和表现
 * 5. 专业能力 - 扩展的专家专业能力（Navigator-X新增）
 *
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ExpertOrchestrator');

import {
  runExpertAnalysis,
  runMultiExpertAnalysis,
  type ExpertType,
  type ExpertAnalysis
} from './expert-ai';
import { getDatabase } from '../db';
import { expertDecisions } from '@shared/schema';
import { desc } from 'drizzle-orm';

// Navigator-X: 专家能力扩展
export interface ExpertCapabilities {
  // 法务专家能力
  trapClauseDetection?: boolean;      // 陷阱条款识别
  negotiationStrategy?: boolean;      // 谈判辩论策略
  contractRiskScoring?: boolean;     // 合同风险评分

  // 财务专家能力
  breakevenAnalysis?: boolean;        // 盈亏平衡分析
  cashflowWarning?: boolean;         // 资金流预警
  anomalyExpenditureDetection?: boolean;  // 异常支出检测

  // 战略专家能力
  businessClosureGeneration?: boolean;  // 商业闭环方案生成
  industryDataAnalysis?: boolean;     // 行业数据分析

  // 心理专家能力
  teamMoraleCurve?: boolean;         // 团队士气曲线
  employeeStatusWarning?: boolean;   // 员工状态预警

  // 秘书专家能力
  fuzzyCommandExecution?: boolean;   // 模糊口令执行
  scheduleHedging?: boolean;         // 日程智能对冲
  etiquetteReminder?: boolean;       // 礼仪提醒
}

// Navigator-X: 多模型路由映射
const EXPERT_MODEL_MAP: Record<ExpertType, { provider: string; model: string; capabilities: ExpertCapabilities }> = {
  LEGAL: {
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    capabilities: {
      trapClauseDetection: true,
      negotiationStrategy: true,
      contractRiskScoring: true,
    }
  },
  FINANCE: {
    provider: 'deepseek',
    model: 'deepseek-v3',
    capabilities: {
      breakevenAnalysis: true,
      cashflowWarning: true,
      anomalyExpenditureDetection: true,
    }
  },
  STRATEGY: {
    provider: 'openai',
    model: 'gpt-4o',
    capabilities: {
      businessClosureGeneration: true,
      industryDataAnalysis: true,
    }
  },
  PSYCHOLOGY: {
    provider: 'claude',
    model: 'claude-3-5-haiku',
    capabilities: {
      teamMoraleCurve: true,
      employeeStatusWarning: true,
    }
  },
  PLANNING: {
    provider: 'deepseek',
    model: 'deepseek-v3',
    capabilities: {
      businessClosureGeneration: true,
    }
  },
  SECRETARY: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    capabilities: {
      fuzzyCommandExecution: true,
      scheduleHedging: true,
      etiquetteReminder: true,
    }
  },
};

// Navigator-X: 获取专家模型配置
export function getExpertModelConfig(expert: ExpertType): { provider: string; model: string; capabilities: ExpertCapabilities } {
  return EXPERT_MODEL_MAP[expert] || {
    provider: 'openai',
    model: 'gpt-4o-mini',
    capabilities: {}
  };
}

// Navigator-X: 获取所有专家能力概览
export function getExpertCapabilitiesOverview(): Record<ExpertType, ExpertCapabilities> {
  const overview: Partial<Record<ExpertType, ExpertCapabilities>> = {};
  for (const expert of Object.keys(EXPERT_MODEL_MAP) as ExpertType[]) {
    overview[expert] = EXPERT_MODEL_MAP[expert].capabilities;
  }
  return overview as Record<ExpertType, ExpertCapabilities>;
}

export interface QuestionClassification {
  primaryDomain: ExpertType;
  requiredExperts: ExpertType[];
  optionalExperts: ExpertType[];
  complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'HIGHLY_COMPLEX';
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  keywords: string[];
  reasoning: string;
}

export interface ExpertContribution {
  expert: ExpertType;
  weight: number;
  relevance: number;
  confidence: number;
  keyInsights: string[];
}

export interface ArbitrationResult {
  finalAnswer: string;
  consensus: boolean;
  conflictResolution?: string;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  overallConfidence: number;
  actionPlan: string[];
  expertContributions: ExpertContribution[];
  processingTimeMs: number;
}

export interface SwarmSession {
  id: string;
  query: string;
  classification: QuestionClassification;
  analyses: ExpertAnalysis[];
  arbitration: ArbitrationResult;
  createdAt: Date;
}

const DOMAIN_KEYWORDS: Record<ExpertType, string[]> = {
  LEGAL: ['法律', '合同', '诉讼', '仲裁', '违约', '劳动', '竞业', '知识产权', '侵权', '赔偿', '法规', '条款', '权益', '合规', '起诉', '胜诉', '败诉', '证据', '时效'],
  FINANCE: ['财务', '税务', '投资', '融资', '股权', '估值', '成本', '利润', '现金流', '报表', '审计', '节税', '增值税', '所得税', '发票', '账务', '资产', '负债', '收入', '支出'],
  STRATEGY: ['战略', '竞争', '市场', '定位', '博弈', '谈判', '合作', '并购', '扩张', '转型', '风险', '机会', '优势', '劣势', '威胁', 'SWOT', '路径', '决策'],
  PSYCHOLOGY: ['心理', '情绪', '压力', '焦虑', '沟通', '关系', '冲突', '动机', '行为', '性格', '团队', '领导', '激励', '信任', '理解', '共情'],
  PLANNING: ['计划', '项目', '任务', '进度', '里程碑', '资源', '排期', '优先级', '时间管理', '目标', '执行', '跟踪', '复盘', '调整'],
  SECRETARY: ['安排', '日程', '会议', '提醒', '记录', '整理', '汇报', '协调', '跟进', '文件', '邮件', '通讯', '联系'],
};

const COMPLEXITY_THRESHOLDS = {
  SIMPLE: 1,
  MODERATE: 2,
  COMPLEX: 3,
  HIGHLY_COMPLEX: 4,
};

class ExpertOrchestratorService {
  private sessionHistory: Map<string, SwarmSession> = new Map();
  private expertStats: Map<ExpertType, { calls: number; avgTime: number; avgConfidence: number }> = new Map();

  constructor() {
    const experts: ExpertType[] = ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'];
    experts.forEach(expert => {
      this.expertStats.set(expert, { calls: 0, avgTime: 0, avgConfidence: 0 });
    });
    logger.info('[ExpertOrchestrator] 五脑合一领航者系统已启动');
  }

  classifyQuestion(query: string): QuestionClassification {
    const lowerQuery = query.toLowerCase();
    const matchedDomains: { expert: ExpertType; score: number; keywords: string[] }[] = [];

    for (const [expert, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const matched = keywords.filter(kw => lowerQuery.includes(kw));
      if (matched.length > 0) {
        matchedDomains.push({
          expert: expert as ExpertType,
          score: matched.length,
          keywords: matched,
        });
      }
    }

    matchedDomains.sort((a, b) => b.score - a.score);

    const allKeywords = matchedDomains.flatMap(d => d.keywords);
    const uniqueKeywords = Array.from(new Set(allKeywords));

    let complexity: QuestionClassification['complexity'] = 'SIMPLE';
    const expertCount = matchedDomains.length;
    if (expertCount >= COMPLEXITY_THRESHOLDS.HIGHLY_COMPLEX) {
      complexity = 'HIGHLY_COMPLEX';
    } else if (expertCount >= COMPLEXITY_THRESHOLDS.COMPLEX) {
      complexity = 'COMPLEX';
    } else if (expertCount >= COMPLEXITY_THRESHOLDS.MODERATE) {
      complexity = 'MODERATE';
    }

    const urgentKeywords = ['紧急', '马上', '立刻', '今天', '急需', '尽快'];
    const hasUrgent = urgentKeywords.some(kw => lowerQuery.includes(kw));

    const requiredExperts = matchedDomains.slice(0, 3).map(d => d.expert);
    const optionalExperts = matchedDomains.slice(3).map(d => d.expert);

    if (requiredExperts.length === 0) {
      requiredExperts.push('SECRETARY');
    }

    const primaryDomain = requiredExperts[0];

    let reasoning = `问题涉及${requiredExperts.map(e => this.getExpertName(e)).join('、')}领域`;
    if (optionalExperts.length > 0) {
      reasoning += `，可选咨询${optionalExperts.map(e => this.getExpertName(e)).join('、')}`;
    }

    return {
      primaryDomain,
      requiredExperts,
      optionalExperts,
      complexity,
      urgency: hasUrgent ? 'URGENT' : 'NORMAL',
      keywords: uniqueKeywords,
      reasoning,
    };
  }

  async orchestrateSwarm(
    query: string,
    context?: string,
    options?: {
      forceExperts?: ExpertType[];
      maxExperts?: number;
      includeOptional?: boolean;
    }
  ): Promise<SwarmSession> {
    const startTime = Date.now();
    const sessionId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    logger.info(`[ExpertOrchestrator] 启动领航者会话: ${sessionId}`);

    const classification = this.classifyQuestion(query);
    logger.info(`[ExpertOrchestrator] 问题分类: ${classification.complexity}, 主领域: ${classification.primaryDomain}`);

    let expertsToCall = options?.forceExperts || classification.requiredExperts;

    if (options?.includeOptional && classification.optionalExperts.length > 0) {
      expertsToCall = [...expertsToCall, ...classification.optionalExperts];
    }

    if (options?.maxExperts && expertsToCall.length > options.maxExperts) {
      expertsToCall = expertsToCall.slice(0, options.maxExperts);
    }

    logger.info(`[ExpertOrchestrator] 调用专家: ${expertsToCall.join(', ')}`);

    const analyses = await runMultiExpertAnalysis(query, expertsToCall, context);

    for (const analysis of analyses) {
      this.updateExpertStats(analysis);
    }

    const arbitration = this.arbitrateResults(analyses, classification);

    const session: SwarmSession = {
      id: sessionId,
      query,
      classification,
      analyses,
      arbitration: {
        ...arbitration,
        processingTimeMs: Date.now() - startTime,
      },
      createdAt: new Date(),
    };

    this.sessionHistory.set(sessionId, session);

    await this.persistDecision(session);

    logger.info(`[ExpertOrchestrator] 领航者会话完成: ${Date.now() - startTime}ms`);

    return session;
  }

  private arbitrateResults(
    analyses: ExpertAnalysis[],
    classification: QuestionClassification
  ): Omit<ArbitrationResult, 'processingTimeMs'> {
    if (analyses.length === 0) {
      return {
        finalAnswer: '无法获取专家分析结果',
        consensus: false,
        overallRisk: 'HIGH',
        overallConfidence: 0,
        actionPlan: ['请稍后重试'],
        expertContributions: [],
      };
    }

    const contributions: ExpertContribution[] = analyses.map(analysis => {
      const isPrimary = analysis.expert === classification.primaryDomain;
      const avgConfidence = analysis.chainOfThought.reduce((sum, step) => sum + step.confidence, 0)
        / Math.max(1, analysis.chainOfThought.length);

      return {
        expert: analysis.expert,
        weight: isPrimary ? 1.5 : 1.0,
        relevance: isPrimary ? 1.0 : 0.8,
        confidence: avgConfidence,
        keyInsights: analysis.recommendations.slice(0, 2),
      };
    });

    const riskLevels = analyses.map(a => a.riskLevel);
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxRiskIndex = Math.max(...riskLevels.map(r => riskOrder.indexOf(r)));
    const overallRisk = riskOrder[maxRiskIndex] as ArbitrationResult['overallRisk'];

    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    const overallConfidence = contributions.reduce((sum, c) => sum + c.confidence * c.weight, 0) / totalWeight;

    const uniqueRisks = new Set(riskLevels);
    const consensus = uniqueRisks.size <= 2;

    let conflictResolution: string | undefined;
    if (!consensus) {
      const riskCounts: Record<string, number> = {};
      riskLevels.forEach(r => { riskCounts[r] = (riskCounts[r] || 0) + 1; });
      conflictResolution = `专家意见存在分歧（风险评估：${Object.entries(riskCounts).map(([k, v]) => `${k}=${v}票`).join(', ')}），采用最高风险等级作为最终判断`;
    }

    const verdictParts = analyses.map(a => {
      const expertName = this.getExpertName(a.expert);
      return `【${expertName}观点】\n${a.finalVerdict}`;
    });

    const allRecommendations = analyses.flatMap(a => a.recommendations);
    const recommendationCounts: Map<string, number> = new Map();
    allRecommendations.forEach(r => {
      recommendationCounts.set(r, (recommendationCounts.get(r) || 0) + 1);
    });

    const sortedRecommendations = Array.from(recommendationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([rec]) => rec);

    const finalAnswer = this.generateFinalAnswer(analyses, classification, overallRisk);

    return {
      finalAnswer,
      consensus,
      conflictResolution,
      overallRisk,
      overallConfidence: Math.round(overallConfidence),
      actionPlan: sortedRecommendations,
      expertContributions: contributions,
    };
  }

  private generateFinalAnswer(
    analyses: ExpertAnalysis[],
    classification: QuestionClassification,
    overallRisk: string
  ): string {
    const primaryAnalysis = analyses.find(a => a.expert === classification.primaryDomain);
    const otherAnalyses = analyses.filter(a => a.expert !== classification.primaryDomain);

    let answer = '';

    if (primaryAnalysis) {
      answer += `## ${this.getExpertName(primaryAnalysis.expert)}分析\n\n`;
      answer += `${primaryAnalysis.finalVerdict}\n\n`;
    }

    if (otherAnalyses.length > 0) {
      answer += `## 其他专家补充\n\n`;
      otherAnalyses.forEach(a => {
        answer += `**${this.getExpertName(a.expert)}**：${a.finalVerdict.slice(0, 150)}...\n\n`;
      });
    }

    answer += `## 综合风险评估\n\n`;
    answer += `整体风险等级：**${overallRisk}**\n`;

    return answer;
  }

  private getExpertName(expert: ExpertType): string {
    const names: Record<ExpertType, string> = {
      LEGAL: '法务专家',
      FINANCE: '财务专家',
      STRATEGY: '战略专家',
      PSYCHOLOGY: '心理专家',
      PLANNING: '规划专家',
      SECRETARY: '秘书助理',
    };
    return names[expert] || expert;
  }

  private updateExpertStats(analysis: ExpertAnalysis): void {
    const stats = this.expertStats.get(analysis.expert);
    if (stats) {
      const avgConfidence = analysis.chainOfThought.reduce((sum, step) => sum + step.confidence, 0)
        / Math.max(1, analysis.chainOfThought.length);

      const newCalls = stats.calls + 1;
      stats.avgTime = (stats.avgTime * stats.calls + analysis.executionTimeMs) / newCalls;
      stats.avgConfidence = (stats.avgConfidence * stats.calls + avgConfidence) / newCalls;
      stats.calls = newCalls;

      this.expertStats.set(analysis.expert, stats);
    }
  }

  private async persistDecision(session: SwarmSession): Promise<void> {
    try {
      for (const analysis of session.analyses) {
        const avgConfidence = analysis.chainOfThought.reduce((sum, step) => sum + step.confidence, 0)
          / Math.max(1, analysis.chainOfThought.length);

        await getDatabase().insert(expertDecisions).values({
          expertType: analysis.expert,
          query: session.query.slice(0, 500),
          chainOfThought: {
            steps: analysis.chainOfThought,
            verdict: analysis.finalVerdict,
            riskLevel: analysis.riskLevel,
            executionTimeMs: analysis.executionTimeMs,
          },
          recommendation: analysis.recommendations.join('\n'),
          confidence: avgConfidence / 100,
          hpCost: Math.ceil(analysis.executionTimeMs / 1000),
        });
      }
    } catch (error) {
      logger.error({ err: error }, '[ExpertOrchestrator] 持久化决策失败');
    }
  }

  getExpertStats(): Record<ExpertType, { calls: number; avgTime: number; avgConfidence: number }> {
    const result: Record<string, { calls: number; avgTime: number; avgConfidence: number }> = {};
    for (const [expert, stats] of Array.from(this.expertStats.entries())) {
      result[expert] = {
        calls: stats.calls,
        avgTime: Math.round(stats.avgTime),
        avgConfidence: Math.round(stats.avgConfidence),
      };
    }
    return result as Record<ExpertType, { calls: number; avgTime: number; avgConfidence: number }>;
  }

  getSessionHistory(limit: number = 20): SwarmSession[] {
    return Array.from(this.sessionHistory.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  getSession(sessionId: string): SwarmSession | undefined {
    return this.sessionHistory.get(sessionId);
  }

  async getRecentDecisions(limit: number = 20): Promise<any[]> {
    try {
      return await getDatabase().select()
        .from(expertDecisions)
        .orderBy(desc(expertDecisions.createdAt))
        .limit(limit);
    } catch (error) {
      logger.error({ err: error }, '[ExpertOrchestrator] 获取决策历史失败');
      return [];
    }
  }
}

export const expertOrchestrator = new ExpertOrchestratorService();
export default expertOrchestrator;
