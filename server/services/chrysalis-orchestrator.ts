/**
 * 小智 Chrysalis Orchestrator - 化蝶计划总调度器
 * Project Chrysalis (化蝶计划) - 自我进化闭环
 *
 * 功能：
 * 1. 协调所有进化模块的运行
 * 2. 管理进化周期调度
 * 3. 监控进化状态和效果
 * 4. 生成综合进化报告
 *
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ChrysalisOrchestrator');

import { failureCollector, FailureStats } from './failure-collector';
import { retrospectionEngine, RetrospectionSession } from './retrospection-engine';
import { logicFinetuner, FineTuneResult } from './logic-finetuner';
import { visionEvolver, VisionEvolutionResult } from './vision-evolver';
import { selfCoder, SelfCodingSession } from './self-coder';
import { morningGift, MorningGiftContent } from './morning-gift';
import { pluginSystem, PluginStats } from './plugin-system';
import { getDatabase } from '../db';
import { evolutionState, evolutionEvents } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export type ChrysalisPhase =
  | 'IDLE'
  | 'COLLECTING'
  | 'RETROSPECTING'
  | 'FINETUNING'
  | 'VISION_EVOLVING'
  | 'SELF_CODING'
  | 'GENERATING_GIFT'
  | 'COMPLETED';

export interface ChrysalisStatus {
  phase: ChrysalisPhase;
  isNightCycleActive: boolean;
  lastCycleStart?: Date;
  lastCycleEnd?: Date;
  nextScheduledCycle?: Date;

  failureStats: FailureStats | null;
  pluginStats: PluginStats | null;

  totalEvolutionCycles: number;
  totalKnowledgeGained: number;
  totalPatchesDeployed: number;
  totalPluginsCreated: number;

  currentSessionProgress: number;
}

export interface ChrysalisCycleResult {
  cycleId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;

  phasesCompleted: ChrysalisPhase[];

  failuresCollected: number;
  retrospectionResult?: RetrospectionSession;
  fineTuneResult?: FineTuneResult;
  visionResult?: VisionEvolutionResult;
  selfCodingResult?: SelfCodingSession;
  morningGift?: MorningGiftContent;

  overallSuccessRate: number;
  evolutionScore: number;
}

class ChrysalisOrchestratorService {
  private currentPhase: ChrysalisPhase = 'IDLE';
  private isNightCycleActive: boolean = false;
  private lastCycleStart?: Date;
  private lastCycleEnd?: Date;
  private cycleCount: number = 0;

  private readonly NIGHT_CYCLE_HOURS = [2, 3, 4, 5];
  private cycleCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startScheduler();
  }

  private startScheduler(): void {
    this.cycleCheckInterval = setInterval(() => {
      this.checkAndStartNightCycle();
    }, 15 * 60 * 1000);

    logger.info('[Chrysalis] 调度器已启动');
  }

  private async checkAndStartNightCycle(): Promise<void> {
    const hour = new Date().getHours();

    if (this.NIGHT_CYCLE_HOURS.includes(hour) && !this.isNightCycleActive) {
      logger.info('[Chrysalis] 检测到夜间时段，启动进化周期...');
      this.runFullCycle().catch(err => {
        logger.error({ err }, '[Chrysalis] 夜间周期错误');
      });
    }
  }

  async runFullCycle(): Promise<ChrysalisCycleResult> {
    if (this.isNightCycleActive) {
      throw new Error('进化周期已在运行中');
    }

    this.isNightCycleActive = true;
    this.lastCycleStart = new Date();
    this.cycleCount++;

    const cycleId = `chrysalis_${Date.now()}`;
    const phasesCompleted: ChrysalisPhase[] = [];

    logger.info(`[Chrysalis] 开始完整进化周期: ${cycleId}`);

    const result: Partial<ChrysalisCycleResult> = {
      cycleId,
      startTime: this.lastCycleStart,
      phasesCompleted: [],
    };

    try {
      this.currentPhase = 'COLLECTING';
      logger.info('[Chrysalis] Phase 1: 失败标签收集');
      const chatFailures = await failureCollector.scanChatHistoryForFailures();
      const auditFailures = await failureCollector.scanAuditLogsForFailures();
      result.failuresCollected = chatFailures + auditFailures;
      phasesCompleted.push('COLLECTING');

      this.currentPhase = 'RETROSPECTING';
      logger.info('[Chrysalis] Phase 2: 复盘引擎');
      result.retrospectionResult = await retrospectionEngine.startRetrospection();
      phasesCompleted.push('RETROSPECTING');

      this.currentPhase = 'FINETUNING';
      logger.info('[Chrysalis] Phase 3: 逻辑微调');
      result.fineTuneResult = await logicFinetuner.analyzeConversations(1);
      phasesCompleted.push('FINETUNING');

      this.currentPhase = 'VISION_EVOLVING';
      logger.info('[Chrysalis] Phase 4: 视觉进化');
      result.visionResult = await visionEvolver.evolve();
      phasesCompleted.push('VISION_EVOLVING');

      this.currentPhase = 'SELF_CODING';
      logger.info('[Chrysalis] Phase 5: 代码自迭代');
      result.selfCodingResult = await selfCoder.startSelfCodingCycle();
      phasesCompleted.push('SELF_CODING');

      this.currentPhase = 'GENERATING_GIFT';
      logger.info('[Chrysalis] Phase 6: 生成晨间礼物');
      result.morningGift = await morningGift.generateMorningGift();
      phasesCompleted.push('GENERATING_GIFT');

      this.currentPhase = 'COMPLETED';
      phasesCompleted.push('COMPLETED');

      await this.updateEvolutionState(result);

      await this.recordCycleCompletion(result as ChrysalisCycleResult);

    } catch (error) {
      logger.error({ err: error }, '[Chrysalis] 进化周期出错');
      // 重新抛出错误以便上层处理
      throw error;
    } finally {
      this.isNightCycleActive = false;
      this.lastCycleEnd = new Date();
      this.currentPhase = 'IDLE';
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - this.lastCycleStart.getTime();

    const fullResult: ChrysalisCycleResult = {
      ...result as ChrysalisCycleResult,
      endTime,
      durationMs,
      phasesCompleted,
      overallSuccessRate: this.calculateSuccessRate(phasesCompleted),
      evolutionScore: this.calculateEvolutionScore(result),
    };

    logger.info(`[Chrysalis] 进化周期完成: ${cycleId}, 耗时${durationMs}ms`);

    return fullResult;
  }

  private calculateSuccessRate(phases: ChrysalisPhase[]): number {
    const totalPhases = 6;
    return phases.length / totalPhases;
  }

  private calculateEvolutionScore(result: Partial<ChrysalisCycleResult>): number {
    let score = 0;

    if (result.failuresCollected) {
      score += Math.min(result.failuresCollected * 2, 20);
    }

    if (result.retrospectionResult) {
      score += result.retrospectionResult.failuresProcessed * 3;
      score += result.retrospectionResult.knowledgeGenerated * 5;
    }

    if (result.fineTuneResult) {
      score += result.fineTuneResult.tacticsLearned.length * 10;
      score += result.fineTuneResult.trapsIdentified.length * 8;
    }

    if (result.visionResult) {
      score += result.visionResult.patternsLearned * 10;
    }

    if (result.selfCodingResult) {
      score += result.selfCodingResult.patchesDeployed * 15;
    }

    return Math.min(score, 100);
  }

  private async updateEvolutionState(result: Partial<ChrysalisCycleResult>): Promise<void> {
    const xpGained = this.calculateEvolutionScore(result);

    await getDatabase().update(evolutionState)
      .set({
        academicXp: sql`${evolutionState.academicXp} + ${xpGained}`,
        totalDreamSessions: sql`${evolutionState.totalDreamSessions} + 1`,
        totalInsightsDiscovered: sql`${evolutionState.totalInsightsDiscovered} + ${
          result.retrospectionResult?.insightsDiscovered.length || 0
        }`,
        distillationCount: sql`${evolutionState.distillationCount} + ${
          result.fineTuneResult?.ragUpdates || 0
        }`,
        updatedAt: new Date(),
      })
      .where(eq(evolutionState.id, 'singleton'));
  }

  private async recordCycleCompletion(result: ChrysalisCycleResult): Promise<void> {
    const pluginsCreated = result.selfCodingResult?.pluginsCreated || [];

    await getDatabase().insert(evolutionEvents).values({
      sourceModule: 'chrysalis_orchestrator',
      eventType: 'FULL_EVOLUTION_CYCLE',
      newValue: {
        cycleId: result.cycleId,
        durationMs: result.durationMs,
        phasesCompleted: result.phasesCompleted.length,
        evolutionScore: result.evolutionScore,
        failuresProcessed: result.retrospectionResult?.failuresProcessed || 0,
        knowledgeGained: result.fineTuneResult?.ragUpdates || 0,
        patchesDeployed: result.selfCodingResult?.patchesDeployed || 0,
        pluginMode: result.selfCodingResult?.pluginMode || false,
        pluginsCreated: pluginsCreated,
      } as any,
      deltaDescription: result.selfCodingResult?.pluginMode
        ? `完整进化周期完成(插件模式)，创建${pluginsCreated.length}个LogicPackage，进化分数: ${result.evolutionScore}`
        : `完整进化周期完成，进化分数: ${result.evolutionScore}`,
      triggeredBy: 'chrysalis_scheduler',
    });
  }

  async getStatus(): Promise<ChrysalisStatus> {
    const failureStats = await failureCollector.getStats();
    const pluginStats = await pluginSystem.getStats();

    const state = await getDatabase().select()
      .from(evolutionState)
      .where(eq(evolutionState.id, 'singleton'))
      .limit(1);

    return {
      phase: this.currentPhase,
      isNightCycleActive: this.isNightCycleActive,
      lastCycleStart: this.lastCycleStart,
      lastCycleEnd: this.lastCycleEnd,
      nextScheduledCycle: this.getNextScheduledTime(),
      failureStats,
      pluginStats,
      totalEvolutionCycles: state[0]?.totalDreamSessions || 0,
      totalKnowledgeGained: state[0]?.distilledKnowledgeSize || 0,
      totalPatchesDeployed: 0,
      totalPluginsCreated: pluginStats.totalPlugins,
      currentSessionProgress: this.calculateCurrentProgress(),
    };
  }

  private getNextScheduledTime(): Date {
    const now = new Date();
    const nextRun = new Date(now);

    const currentHour = now.getHours();

    if (currentHour < this.NIGHT_CYCLE_HOURS[0]) {
      nextRun.setHours(this.NIGHT_CYCLE_HOURS[0], 0, 0, 0);
    } else if (currentHour >= this.NIGHT_CYCLE_HOURS[this.NIGHT_CYCLE_HOURS.length - 1]) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(this.NIGHT_CYCLE_HOURS[0], 0, 0, 0);
    } else {
      const nextHour = this.NIGHT_CYCLE_HOURS.find(h => h > currentHour);
      if (nextHour) {
        nextRun.setHours(nextHour, 0, 0, 0);
      }
    }

    return nextRun;
  }

  private calculateCurrentProgress(): number {
    const phaseProgress: Record<ChrysalisPhase, number> = {
      'IDLE': 0,
      'COLLECTING': 15,
      'RETROSPECTING': 30,
      'FINETUNING': 50,
      'VISION_EVOLVING': 65,
      'SELF_CODING': 80,
      'GENERATING_GIFT': 95,
      'COMPLETED': 100,
    };

    return phaseProgress[this.currentPhase] || 0;
  }

  async runPartialCycle(phases: ChrysalisPhase[]): Promise<Partial<ChrysalisCycleResult>> {
    logger.info(`[Chrysalis] 运行部分周期: ${phases.join(', ')}`);

    const result: Partial<ChrysalisCycleResult> = {
      cycleId: `partial_${Date.now()}`,
      startTime: new Date(),
      phasesCompleted: [],
    };

    for (const phase of phases) {
      try {
        switch (phase) {
          case 'COLLECTING':
            const chatFailures = await failureCollector.scanChatHistoryForFailures();
            const auditFailures = await failureCollector.scanAuditLogsForFailures();
            result.failuresCollected = chatFailures + auditFailures;
            break;
          case 'RETROSPECTING':
            result.retrospectionResult = await retrospectionEngine.startRetrospection();
            break;
          case 'FINETUNING':
            result.fineTuneResult = await logicFinetuner.analyzeConversations(1);
            break;
          case 'VISION_EVOLVING':
            result.visionResult = await visionEvolver.evolve();
            break;
          case 'SELF_CODING':
            result.selfCodingResult = await selfCoder.startSelfCodingCycle();
            break;
          case 'GENERATING_GIFT':
            result.morningGift = await morningGift.generateMorningGift();
            break;
        }
        result.phasesCompleted?.push(phase);
    } catch (error) {
      logger.error({ err: error, phase }, '[Chrysalis] Phase 失败');
      // 继续处理其他阶段，不中断整个周期
    }
  }

  // 如果有阶段失败，记录警告
  if (result.phasesCompleted?.length !== phases.length) {
    logger.warn(`[Chrysalis] 部分周期失败: 预期 ${phases.length} 个阶段, 完成 ${result.phasesCompleted?.length || 0} 个`);
  }

    result.endTime = new Date();
    result.durationMs = result.endTime.getTime() - (result.startTime?.getTime() || 0);

    return result;
  }

  stopScheduler(): void {
    if (this.cycleCheckInterval) {
      clearInterval(this.cycleCheckInterval);
      logger.info('[Chrysalis] 调度器已停止');
    }
  }
}

export const chrysalisOrchestrator = new ChrysalisOrchestratorService();

export { ChrysalisOrchestratorService };
