/**
 * Navigator-X 语义血缘引擎 (Semantic Bloodline Engine)
 *
 * 核心功能：
 * 1. 语义补全 - 将老板的模糊意图自动补全为完整执行方案
 * 2. KPI生成 - 自动生成考核指标
 * 3. 上下文关联 - 与历史数据关联，增强理解
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SemanticBloodline');

import { navigatorCore } from './navigator-core';

// ============ 类型定义 ============

export interface EnrichedIntent {
  enrichedText: string;
  background: string[];
  executionLogic: string[];
  kpis: KPI[];
  context: ContextLink[];
}

export interface KPI {
  id: string;
  metric: string;
  target: string;
  deadline?: number;
  weight: number;
}

export interface ContextLink {
  type: 'HISTORICAL' | 'RELATED' | 'SIMILAR';
  title: string;
  relevance: number;
  link: string;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [SemanticBloodline] ${message}`);
}

// ============ 语义血缘引擎类 ============

class SemanticBloodlineEngine {
  private intentCache: Map<string, EnrichedIntent> = new Map();
  private historicalIntents: EnrichedIntent[] = [];

  constructor() {
    log('语义血缘引擎已初始化');
  }

  /**
   * 语义补全
   * 将老板的原始输入转化为完整意图
   */
  async enrichIntent(rawInput: string): Promise<EnrichedIntent> {
    log(`开始语义补全: "${rawInput.slice(0, 50)}..."`);

    // 检查缓存
    const cacheKey = rawInput.slice(0, 100);
    if (this.intentCache.has(cacheKey)) {
      log('命中缓存，直接返回');
      return this.intentCache.get(cacheKey)!;
    }

    // 1. 意图识别
    const intentType = this.identifyIntentType(rawInput);

    // 2. 背景补全
    const background = await this.generateBackground(rawInput, intentType);

    // 3. 执行逻辑生成
    const executionLogic = this.generateExecutionLogic(rawInput, intentType);

    // 4. 上下文关联
    const context = await this.linkContext(rawInput);

    // 5. 组合完整意图
    const enrichedText = this.composeEnrichedIntent(rawInput, intentType, background, executionLogic);

    const enriched: EnrichedIntent = {
      enrichedText,
      background,
      executionLogic,
      kpis: [], // 稍后由generateKPIs填充
      context,
    };

    // 缓存结果
    this.intentCache.set(cacheKey, enriched);
    this.historicalIntents.push(enriched);

    log(`语义补全完成，生成 ${executionLogic.length} 条执行逻辑`);
    return enriched;
  }

  /**
   * 识别意图类型
   */
  private identifyIntentType(input: string): string {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('进军') || lowerInput.includes('开拓') || lowerInput.includes('进入')) {
      return 'MARKET_EXPANSION';
    }
    if (lowerInput.includes('优化') || lowerInput.includes('改进') || lowerInput.includes('提升')) {
      return 'OPTIMIZATION';
    }
    if (lowerInput.includes('发布') || lowerInput.includes('推出') || lowerInput.includes('上线')) {
      return 'LAUNCH';
    }
    if (lowerInput.includes('分析') || lowerInput.includes('调研') || lowerInput.includes('研究')) {
      return 'RESEARCH';
    }
    if (lowerInput.includes('招聘') || lowerInput.includes('团队') || lowerInput.includes('人员')) {
      return 'TEAM_BUILDING';
    }

    return 'GENERAL';
  }

  /**
   * 生成背景资料
   */
  private async generateBackground(input: string, intentType: string): Promise<string[]> {
    const backgrounds: string[] = [];

    // 基于意图类型添加背景
    switch (intentType) {
      case 'MARKET_EXPANSION':
        backgrounds.push('市场可行性分析');
        backgrounds.push('竞争格局研究');
        backgrounds.push('目标用户画像');
        backgrounds.push('资源配置评估');
        break;
      case 'OPTIMIZATION':
        backgrounds.push('现状诊断');
        backgrounds.push('瓶颈识别');
        backgrounds.push('优化方案对比');
        break;
      case 'LAUNCH':
        backgrounds.push('产品定位确认');
        backgrounds.push('营销策略制定');
        backgrounds.push('渠道铺设计划');
        break;
      case 'RESEARCH':
        backgrounds.push('研究框架搭建');
        backgrounds.push('数据采集方案');
        backgrounds.push('分析方法选择');
        break;
      case 'TEAM_BUILDING':
        backgrounds.push('人才画像');
        backgrounds.push('招聘渠道');
        backgrounds.push('团队文化匹配');
        break;
      default:
        backgrounds.push('执行计划制定');
        backgrounds.push('资源需求评估');
        backgrounds.push('风险预案准备');
    }

    // 添加上下文背景
    const fleet = navigatorCore.listFleets();
    if (fleet.length > 0) {
      backgrounds.push(`舰队成员数: ${fleet[0].members.length}`);
    }

    return backgrounds;
  }

  /**
   * 生成执行逻辑
   */
  private generateExecutionLogic(input: string, intentType: string): string[] {
    const steps: string[] = [];

    // 基础执行步骤
    steps.push('第一步：理解老板核心意图');
    steps.push('第二步：拆解为可执行子任务');
    steps.push('第三步：分配给相应节点端');
    steps.push('第四步：设置检查点和KPI');
    steps.push('第五步：实时监控执行进度');
    steps.push('第六步：完成后汇报汇总');

    return steps;
  }

  /**
   * 上下文关联
   */
  private async linkContext(input: string): Promise<ContextLink[]> {
    const links: ContextLink[] = [];

    // 查找相似的历史意图
    const similarIntents = this.historicalIntents
      .filter(h => this.calculateSimilarity(input, h.enrichedText) > 0.3)
      .slice(0, 3);

    for (const intent of similarIntents) {
      links.push({
        type: 'SIMILAR',
        title: intent.enrichedText.slice(0, 50),
        relevance: this.calculateSimilarity(input, intent.enrichedText),
        link: `历史案例参考`,
      });
    }

    return links;
  }

  /**
   * 计算相似度（简单实现）
   */
  private calculateSimilarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(''));
    const bWords = new Set(b.toLowerCase().split(''));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    return intersection.size / Math.max(aWords.size, bWords.size);
  }

  /**
   * 组合完整意图文本
   */
  private composeEnrichedIntent(
    rawInput: string,
    intentType: string,
    background: string[],
    executionLogic: string[]
  ): string {
    let result = `【原始灵感】${rawInput}\n\n`;
    result += `【意图类型】${intentType}\n\n`;
    result += `【背景资料】\n${background.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n`;
    result += `【执行逻辑】\n${executionLogic.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

    return result;
  }

  /**
   * 自动生成KPI
   */
  async generateKPIs(intent: {
    enrichedText: string;
    rawText: string;
    capturedAt: number;
  }): Promise<KPI[]> {
    const kpis: KPI[] = [];

    // 基于意图类型生成KPI
    const intentType = this.identifyIntentType(intent.rawText);

    switch (intentType) {
      case 'MARKET_EXPANSION':
        kpis.push({
          id: `kpi_${Date.now()}_1`,
          metric: '市场调研完成率',
          target: '100%',
          weight: 0.3,
        });
        kpis.push({
          id: `kpi_${Date.now()}_2`,
          metric: '方案提交时效',
          target: '3天内',
          deadline: intent.capturedAt + 3 * 24 * 60 * 60 * 1000,
          weight: 0.25,
        });
        kpis.push({
          id: `kpi_${Date.now()}_3`,
          metric: 'ROI预期',
          target: '≥15%',
          weight: 0.45,
        });
        break;
      case 'OPTIMIZATION':
        kpis.push({
          id: `kpi_${Date.now()}_1`,
          metric: '效率提升幅度',
          target: '≥20%',
          weight: 0.5,
        });
        kpis.push({
          id: `kpi_${Date.now()}_2`,
          metric: '成本降低幅度',
          target: '≥10%',
          weight: 0.3,
        });
        kpis.push({
          id: `kpi_${Date.now()}_3`,
          metric: '执行完成时间',
          target: '1周内',
          weight: 0.2,
        });
        break;
      default:
        kpis.push({
          id: `kpi_${Date.now()}_1`,
          metric: '任务完成率',
          target: '100%',
          weight: 0.6,
        });
        kpis.push({
          id: `kpi_${Date.now()}_2`,
          metric: '执行时效',
          target: '按时完成',
          weight: 0.4,
        });
    }

    log(`生成 ${kpis.length} 个KPI`);
    return kpis;
  }

  /**
   * 获取历史意图
   */
  getHistoricalIntents(limit: number = 20): EnrichedIntent[] {
    return this.historicalIntents.slice(-limit);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.intentCache.clear();
    log('语义血缘缓存已清除');
  }
}

// 导出单例
export const semanticBloodlineEngine = new SemanticBloodlineEngine();
logger.info('[SemanticBloodline] 语义血缘引擎已加载 (Navigator-X)');
