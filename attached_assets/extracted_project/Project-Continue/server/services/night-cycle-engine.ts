/**
 * 小智 Night-Cycle Engine - 梦境进化引擎
 * 
 * 功能：
 * 1. 双态切换检测 (Active/Dream Mode)
 * 2. 深夜反思任务调度
 * 3. 记忆整合触发
 * 4. 自我优化执行
 * 5. 情感对齐更新
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { dreamLogs, auditLogs, shadowMemories, avatarChatHistory } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export type SystemMode = 'ACTIVE' | 'DREAM' | 'TRANSITIONING';

export interface DreamTask {
  id: string;
  type: 'memory_consolidation' | 'business_analysis' | 'self_improvement' | 'emotional_alignment';
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, any>;
  output?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface NightCycleStatus {
  mode: SystemMode;
  lastModeChange: Date;
  isDreamEligible: boolean;
  dreamTasksQueue: number;
  completedDreamTasks: number;
  nextScheduledDream?: Date;
  batteryLevel?: number;
  isCharging?: boolean;
  userActivityLevel: 'active' | 'idle' | 'sleeping';
}

export interface DreamSessionResult {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  tasksCompleted: number;
  memoriesConsolidated: number;
  insightsGenerated: string[];
  optimizationsApplied: number;
  emotionalUpdates: string[];
}

class NightCycleEngineService {
  private currentMode: SystemMode = 'ACTIVE';
  private lastModeChange: Date = new Date();
  private dreamTaskQueue: DreamTask[] = [];
  private completedDreamTasks: DreamTask[] = [];
  private lastUserActivity: Date = new Date();
  private isCharging: boolean = false;
  private batteryLevel: number = 100;
  private dreamSessionActive: boolean = false;
  
  private readonly IDLE_THRESHOLD_MS = 30 * 60 * 1000;
  private readonly SLEEP_THRESHOLD_MS = 2 * 60 * 60 * 1000;
  private readonly DREAM_START_HOUR = 23;
  private readonly DREAM_END_HOUR = 6;
  
  getStatus(): NightCycleStatus {
    const now = new Date();
    const idleTime = now.getTime() - this.lastUserActivity.getTime();
    
    let userActivityLevel: 'active' | 'idle' | 'sleeping' = 'active';
    if (idleTime > this.SLEEP_THRESHOLD_MS) {
      userActivityLevel = 'sleeping';
    } else if (idleTime > this.IDLE_THRESHOLD_MS) {
      userActivityLevel = 'idle';
    }
    
    return {
      mode: this.currentMode,
      lastModeChange: this.lastModeChange,
      isDreamEligible: this.isDreamTimeWindow() || this.isCharging,
      dreamTasksQueue: this.dreamTaskQueue.length,
      completedDreamTasks: this.completedDreamTasks.length,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      userActivityLevel,
    };
  }
  
  private isDreamTimeWindow(): boolean {
    const hour = new Date().getHours();
    return hour >= this.DREAM_START_HOUR || hour < this.DREAM_END_HOUR;
  }
  
  recordUserActivity(): void {
    this.lastUserActivity = new Date();
    
    if (this.currentMode === 'DREAM') {
      this.transitionToActive();
    }
  }
  
  updateDeviceStatus(charging: boolean, battery: number): void {
    this.isCharging = charging;
    this.batteryLevel = battery;
    
    this.evaluateModeTransition();
  }
  
  private evaluateModeTransition(): void {
    const now = new Date();
    const idleTime = now.getTime() - this.lastUserActivity.getTime();
    const isNightTime = this.isDreamTimeWindow();
    const isSleeping = idleTime > this.SLEEP_THRESHOLD_MS;
    
    if (this.currentMode === 'ACTIVE') {
      if ((isNightTime && isSleeping) || (this.isCharging && isSleeping)) {
        this.transitionToDream();
      }
    } else if (this.currentMode === 'DREAM') {
      if (idleTime < this.IDLE_THRESHOLD_MS) {
        this.transitionToActive();
      }
    }
  }
  
  private transitionToDream(): void {
    console.log('[NightCycle] Transitioning to DREAM mode...');
    this.currentMode = 'TRANSITIONING';
    this.lastModeChange = new Date();
    
    this.prepareDreamSession().then(() => {
      this.currentMode = 'DREAM';
      console.log('[NightCycle] DREAM mode active. Starting dream tasks...');
      this.startDreamSession();
    });
  }
  
  private transitionToActive(): void {
    console.log('[NightCycle] Transitioning to ACTIVE mode...');
    this.currentMode = 'TRANSITIONING';
    this.lastModeChange = new Date();
    
    if (this.dreamSessionActive) {
      this.pauseDreamSession();
    }
    
    this.currentMode = 'ACTIVE';
    console.log('[NightCycle] ACTIVE mode restored.');
  }
  
  private async prepareDreamSession(): Promise<void> {
    this.dreamTaskQueue = [];
    
    this.dreamTaskQueue.push({
      id: `dream_${Date.now()}_memory`,
      type: 'memory_consolidation',
      priority: 1,
      status: 'pending',
      input: { targetDate: new Date().toISOString().split('T')[0] },
    });
    
    this.dreamTaskQueue.push({
      id: `dream_${Date.now()}_business`,
      type: 'business_analysis',
      priority: 2,
      status: 'pending',
      input: { analyzeLastDays: 1 },
    });
    
    this.dreamTaskQueue.push({
      id: `dream_${Date.now()}_improve`,
      type: 'self_improvement',
      priority: 3,
      status: 'pending',
      input: { reviewFailedTasks: true },
    });
    
    this.dreamTaskQueue.push({
      id: `dream_${Date.now()}_emotion`,
      type: 'emotional_alignment',
      priority: 4,
      status: 'pending',
      input: { updatePreferences: true },
    });
    
    console.log(`[NightCycle] Prepared ${this.dreamTaskQueue.length} dream tasks`);
  }
  
  private async startDreamSession(): Promise<void> {
    this.dreamSessionActive = true;
    const sessionStart = new Date();
    
    try {
      const [dreamLog] = await db.insert(dreamLogs).values({
        dreamType: 'NIGHT_CYCLE',
        simulationCount: 0,
        decisionsOptimized: 0,
        patchesGenerated: [],
        insightsDiscovered: {},
        status: 'SLEEPING',
      }).returning();
      
      console.log(`[NightCycle] Dream session started: ${dreamLog.id}`);
      
      for (const task of this.dreamTaskQueue) {
        if (this.currentMode !== 'DREAM') {
          console.log('[NightCycle] Dream session interrupted by mode change');
          break;
        }
        
        await this.executeDreamTask(task);
      }
      
      const sessionEnd = new Date();
      const durationMs = sessionEnd.getTime() - sessionStart.getTime();
      
      await db.update(dreamLogs)
        .set({
          status: 'AWAKENED',
          durationMs,
          decisionsOptimized: this.completedDreamTasks.filter(t => t.type === 'self_improvement').length,
          simulationCount: this.completedDreamTasks.length,
        })
        .where(eq(dreamLogs.id, dreamLog.id));
      
      console.log(`[NightCycle] Dream session completed. Duration: ${durationMs}ms`);
      
    } catch (error) {
      console.error('[NightCycle] Dream session error:', error);
    } finally {
      this.dreamSessionActive = false;
    }
  }
  
  private pauseDreamSession(): void {
    console.log('[NightCycle] Pausing dream session...');
    this.dreamSessionActive = false;
  }
  
  private async executeDreamTask(task: DreamTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    
    console.log(`[NightCycle] Executing dream task: ${task.type}`);
    
    try {
      switch (task.type) {
        case 'memory_consolidation':
          task.output = await this.executeMemoryConsolidation(task.input);
          break;
        case 'business_analysis':
          task.output = await this.executeBusinessAnalysis(task.input);
          break;
        case 'self_improvement':
          task.output = await this.executeSelfImprovement(task.input);
          break;
        case 'emotional_alignment':
          task.output = await this.executeEmotionalAlignment(task.input);
          break;
      }
      
      task.status = 'completed';
      task.completedAt = new Date();
      this.completedDreamTasks.push(task);
      
      console.log(`[NightCycle] Task completed: ${task.type}`);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      console.error(`[NightCycle] Task failed: ${task.type}`, error);
    }
  }
  
  private async executeMemoryConsolidation(input: Record<string, any>): Promise<Record<string, any>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const chatHistory = await db.select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, today))
      .orderBy(desc(avatarChatHistory.createdAt));
    
    const auditEntries = await db.select()
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, today))
      .orderBy(desc(auditLogs.createdAt));
    
    const moodAnalysis = this.analyzeMoodFromChats(chatHistory);
    const relationshipMentions = this.extractRelationshipMentions(chatHistory);
    const operationPainPoints = this.identifyPainPoints(auditEntries);
    
    for (const insight of [...moodAnalysis.insights, ...relationshipMentions, ...operationPainPoints]) {
      await db.insert(shadowMemories).values({
        context: `梦境整合 ${input.targetDate}`,
        choiceMade: insight,
        field: 'dream_insight',
        mimicryWeight: 1.0,
        expPoints: 10,
      });
    }
    
    return {
      chatsProcessed: chatHistory.length,
      auditsProcessed: auditEntries.length,
      moodTrend: moodAnalysis.trend,
      insightsGenerated: moodAnalysis.insights.length + relationshipMentions.length + operationPainPoints.length,
    };
  }
  
  private analyzeMoodFromChats(chats: any[]): { trend: string; insights: string[] } {
    const insights: string[] = [];
    let positiveCount = 0;
    let negativeCount = 0;
    
    const positiveWords = ['开心', '高兴', '棒', '好', '喜欢', '爱', '感谢', '太好了', '完美'];
    const negativeWords = ['烦', '累', '难', '不好', '失望', '生气', '讨厌', '糟糕'];
    
    for (const chat of chats) {
      const content = (chat.content || '').toLowerCase();
      positiveWords.forEach(w => { if (content.includes(w)) positiveCount++; });
      negativeWords.forEach(w => { if (content.includes(w)) negativeCount++; });
    }
    
    const trend = positiveCount > negativeCount * 1.5 ? 'POSITIVE' :
                  negativeCount > positiveCount * 1.5 ? 'NEGATIVE' : 'NEUTRAL';
    
    if (trend === 'POSITIVE') {
      insights.push('爸爸今天心情不错，多次表达了积极情绪');
    } else if (trend === 'NEGATIVE') {
      insights.push('爸爸今天似乎有些疲惫或压力，需要更多关心');
    }
    
    return { trend, insights };
  }
  
  private extractRelationshipMentions(chats: any[]): string[] {
    const mentions: string[] = [];
    const personPattern = /提到了?([^\s，。！？]+(?:先生|女士|老师|老板|同事|朋友))/g;
    
    for (const chat of chats) {
      const content = chat.content || '';
      const matches = content.match(personPattern);
      if (matches) {
        mentions.push(`对话中提到了: ${matches.join(', ')}`);
      }
    }
    
    return mentions;
  }
  
  private identifyPainPoints(audits: any[]): string[] {
    const painPoints: string[] = [];
    const failedOps = audits.filter(a => a.result === 'FAILURE' || a.result === 'ERROR');
    
    if (failedOps.length > 3) {
      painPoints.push(`今日有${failedOps.length}次操作失败，需要优化相关功能`);
    }
    
    const actionCounts: Record<string, number> = {};
    for (const audit of audits) {
      actionCounts[audit.action] = (actionCounts[audit.action] || 0) + 1;
    }
    
    for (const [action, count] of Object.entries(actionCounts)) {
      if (count > 10) {
        painPoints.push(`"${action}"操作频繁(${count}次)，考虑添加快捷方式`);
      }
    }
    
    return painPoints;
  }
  
  private async executeBusinessAnalysis(input: Record<string, any>): Promise<Record<string, any>> {
    const since = new Date();
    since.setDate(since.getDate() - (input.analyzeLastDays || 1));
    
    const audits = await db.select()
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, since));
    
    const webViews = audits.filter(a => 
      a.action?.includes('view') || a.action?.includes('browse')
    );
    
    const recommendations: string[] = [];
    
    if (webViews.length > 0) {
      recommendations.push('基于浏览历史，建议明天关注相关领域动态');
    }
    
    const opportunitySignals = audits.filter(a => 
      a.action?.includes('opportunity') || a.action?.includes('contact')
    );
    
    if (opportunitySignals.length > 0) {
      recommendations.push(`发现${opportunitySignals.length}个潜在商机信号，已整理决策建议`);
    }
    
    return {
      webViewsAnalyzed: webViews.length,
      opportunitiesFound: opportunitySignals.length,
      recommendations,
    };
  }
  
  private async executeSelfImprovement(input: Record<string, any>): Promise<Record<string, any>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const failedTasks = await db.select()
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, today),
        eq(auditLogs.result, 'FAILURE')
      ));
    
    const improvements: string[] = [];
    const patches: string[] = [];
    
    for (const task of failedTasks) {
      const details = task.details as Record<string, any> || {};
      
      if (details.errorType === 'click_missed') {
        patches.push(`优化点击坐标算法: ${details.targetElement}`);
      } else if (details.errorType === 'timeout') {
        patches.push(`增加超时容忍: ${details.operation}`);
      } else {
        improvements.push(`分析失败原因: ${task.action}`);
      }
    }
    
    for (const patch of patches) {
      await db.insert(shadowMemories).values({
        context: '自我优化补丁',
        choiceMade: patch,
        field: 'self_improvement',
        mimicryWeight: 1.5,
        expPoints: 20,
      });
    }
    
    return {
      failedTasksReviewed: failedTasks.length,
      improvementsIdentified: improvements.length,
      patchesGenerated: patches.length,
      patches,
    };
  }
  
  private async executeEmotionalAlignment(input: Record<string, any>): Promise<Record<string, any>> {
    const chatHistory = await db.select()
      .from(avatarChatHistory)
      .orderBy(desc(avatarChatHistory.createdAt))
      .limit(100);
    
    const positiveFeedback: { message: string; score: number }[] = [];
    
    for (const chat of chatHistory) {
      if (chat.role === 'assistant') {
        const content = chat.content || '';
        const positiveIndicators = ['哈哈', '笑', '开心', '谢谢', '爱', '棒', '好'];
        let score = 0;
        
        const nextChat = chatHistory.find(c => 
          c.role === 'user' && 
          c.createdAt && chat.createdAt &&
          c.createdAt > chat.createdAt
        );
        
        if (nextChat) {
          const userResponse = nextChat.content || '';
          positiveIndicators.forEach(indicator => {
            if (userResponse.includes(indicator)) score++;
          });
        }
        
        if (score > 0) {
          positiveFeedback.push({ message: content.slice(0, 100), score });
        }
      }
    }
    
    positiveFeedback.sort((a, b) => b.score - a.score);
    
    const stylePreferences: string[] = [];
    
    if (positiveFeedback.length > 0) {
      const topResponse = positiveFeedback[0];
      
      if (topResponse.message.includes('~') || topResponse.message.includes('呢')) {
        stylePreferences.push('语气词更受欢迎，继续使用');
      }
      if (topResponse.message.includes('主人')) {
        stylePreferences.push('称呼"主人"得到积极反馈');
      }
      if (topResponse.message.length < 50) {
        stylePreferences.push('简短回复更受喜爱');
      } else {
        stylePreferences.push('详细解释更受喜爱');
      }
    }
    
    return {
      responsesAnalyzed: chatHistory.filter(c => c.role === 'assistant').length,
      positiveInteractions: positiveFeedback.length,
      topPerformingStyle: positiveFeedback[0]?.message.slice(0, 50),
      stylePreferences,
    };
  }
  
  async forceDreamCycle(): Promise<DreamSessionResult> {
    console.log('[NightCycle] Force starting dream cycle...');
    
    const sessionStart = new Date();
    await this.prepareDreamSession();
    
    const results: DreamTask[] = [];
    for (const task of this.dreamTaskQueue) {
      await this.executeDreamTask(task);
      results.push(task);
    }
    
    const sessionEnd = new Date();
    
    return {
      sessionId: `dream_${sessionStart.getTime()}`,
      startTime: sessionStart,
      endTime: sessionEnd,
      durationMs: sessionEnd.getTime() - sessionStart.getTime(),
      tasksCompleted: results.filter(t => t.status === 'completed').length,
      memoriesConsolidated: results.find(t => t.type === 'memory_consolidation')?.output?.insightsGenerated || 0,
      insightsGenerated: results.flatMap(t => t.output?.recommendations || []),
      optimizationsApplied: results.find(t => t.type === 'self_improvement')?.output?.patchesGenerated || 0,
      emotionalUpdates: results.find(t => t.type === 'emotional_alignment')?.output?.stylePreferences || [],
    };
  }
  
  getCompletedDreamTasks(): DreamTask[] {
    return this.completedDreamTasks;
  }
  
  getDreamQueue(): DreamTask[] {
    return this.dreamTaskQueue;
  }
}

export const nightCycleEngine = new NightCycleEngineService();

export { NightCycleEngineService };
