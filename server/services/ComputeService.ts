import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';
import { evolutionService } from './EvolutionService';
import type { 
  DownloadTask, InsertDownloadTask, 
  ComputeJob, InsertComputeJob,
  DreamLog, InsertDreamLog,
  EvolutionEvent, InsertEvolutionEvent
} from '@shared/schema';

const logger = createServiceLogger('ComputeService');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const DREAM_TYPE_PROMPTS: Record<string, string> = {
  STRATEGY_OPTIMIZATION: `你是一个战略优化梦境引擎。基于用户的决策历史和当前形势，进行策略推演和优化建议。
    
输出JSON格式：
{
  "topRisk": "识别出的最大风险",
  "suggestedAction": "建议的行动",
  "confidence": 0.85,
  "insights": ["洞察1", "洞察2", "洞察3"],
  "scenarios": [{"name": "场景名", "probability": 0.3, "outcome": "结果"}],
  "optimizations": ["优化建议1", "优化建议2"]
}`,
  
  RISK_ANALYSIS: `你是一个风险分析梦境引擎。识别潜在风险因素，评估影响程度，提供预警和对策。

输出JSON格式：
{
  "topRisk": "最高优先级风险",
  "riskLevel": "HIGH/MEDIUM/LOW",
  "suggestedAction": "风险缓解措施",
  "confidence": 0.8,
  "riskFactors": [{"factor": "风险因素", "severity": 8, "mitigation": "对策"}],
  "earlyWarnings": ["预警信号1", "预警信号2"]
}`,

  MEMORY_CONSOLIDATION: `你是一个记忆整合梦境引擎。整理和优化用户的知识结构，发现隐藏的关联和模式。

输出JSON格式：
{
  "topRisk": "需要关注的知识盲区",
  "suggestedAction": "学习建议",
  "confidence": 0.75,
  "consolidatedPatterns": ["发现的模式1", "发现的模式2"],
  "newConnections": [{"from": "概念A", "to": "概念B", "insight": "关联洞察"}],
  "learningPriorities": ["优先学习1", "优先学习2"]
}`,

  RELATIONSHIP_MAPPING: `你是一个关系网络梦境引擎。分析人际关系网络，发现隐藏的利益链接和影响路径。

输出JSON格式：
{
  "topRisk": "关系网络中的薄弱环节",
  "suggestedAction": "关系维护建议",
  "confidence": 0.82,
  "networkInsights": ["网络洞察1", "网络洞察2"],
  "hiddenConnections": [{"person": "人物", "influence": "影响力", "opportunity": "机会"}],
  "priorities": ["优先联系1", "优先联系2"]
}`,
};

export class ComputeService {
  // ===== 下载任务管理 =====
  
  /**
   * 获取所有下载任务
   */
  async getDownloadTasks(): Promise<DownloadTask[]> {
    return await storage.getDownloadTasks();
  }

  /**
   * 创建下载任务
   */
  async createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask> {
    const created = await storage.createDownloadTask(task);
    logger.info({ taskId: created.id, url: created.url, category: created.category }, '下载任务创建成功');
    return created;
  }

  /**
   * 更新下载任务
   */
  async updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined> {
    const updated = await storage.updateDownloadTask(id, updates);
    if (updated) {
      logger.debug({ taskId: id, status: updates.status, progress: updates.progress }, '下载任务更新成功');
    }
    return updated;
  }

  /**
   * 删除下载任务
   */
  async deleteDownloadTask(id: string): Promise<boolean> {
    const success = await storage.deleteDownloadTask(id);
    logger.debug({ taskId: id }, success ? '下载任务删除成功' : '下载任务删除失败');
    return success;
  }

  // ===== 计算任务管理 =====
  
  /**
   * 获取所有计算任务
   */
  async getComputeJobs(): Promise<ComputeJob[]> {
    return await storage.getComputeJobs();
  }

  /**
   * 创建计算任务
   */
  async createComputeJob(job: InsertComputeJob): Promise<ComputeJob> {
    const created = await storage.createComputeJob(job);
    logger.info({ jobId: created.id, jobType: created.jobType, priority: created.priority }, '计算任务创建成功');
    return created;
  }

  /**
   * 更新计算任务
   */
  async updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined> {
    const updated = await storage.updateComputeJob(id, updates);
    if (updated) {
      logger.debug({ jobId: id, status: updates.status, progress: updates.progress }, '计算任务更新成功');
    }
    return updated;
  }

  // ===== 梦境日志管理 =====
  
  /**
   * 获取所有梦境日志
   */
  async getDreamLogs(): Promise<DreamLog[]> {
    return await storage.getDreamLogs();
  }

  /**
   * 创建梦境日志
   */
  async createDreamLog(log: InsertDreamLog): Promise<DreamLog> {
    const created = await storage.createDreamLog(log);
    logger.info({ logId: created.id, dreamType: created.dreamType, status: created.status }, '梦境日志创建成功');
    return created;
  }

  /**
   * 更新梦境日志
   */
  async updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined> {
    const updated = await storage.updateDreamLog(id, updates);
    if (updated) {
      logger.debug({ logId: id, status: updates.status, simulationCount: updates.simulationCount }, '梦境日志更新成功');
    }
    return updated;
  }

  /**
   * 获取保险库统计
   */
  async getVaultStats(): Promise<any> {
    return await storage.getVaultStats();
  }

  /**
   * 创建进化事件
   */
  async createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent> {
    const created = await storage.createEvolutionEvent(event);
    logger.debug({ eventId: created.id, eventType: created.eventType, sourceModule: created.sourceModule }, '进化事件创建成功');
    return created;
  }

  /**
   * 模拟下载过程
   */
  async simulateDownload(taskId: string): Promise<void> {
    const stages = [
      { status: "DOWNLOADING" as const, progress: 25 },
      { status: "DOWNLOADING" as const, progress: 50 },
      { status: "DOWNLOADING" as const, progress: 75 },
      { status: "INDEXING" as const, progress: 90 },
      { status: "COMPLETE" as const, progress: 100, sandboxResult: "SAFE" },
    ];
    
    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await this.updateDownloadTask(taskId, stage);
    }
  }

  /**
   * 模拟计算过程
   */
  async simulateCompute(jobId: string): Promise<void> {
    const stages = [
      { status: "PROCESSING" as const, progress: 20 },
      { status: "PROCESSING" as const, progress: 50 },
      { status: "PROCESSING" as const, progress: 80 },
      { status: "COMPLETE" as const, progress: 100, processingTimeMs: Math.floor(Math.random() * 5000) + 2000 },
    ];
    
    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.updateComputeJob(jobId, stage);
    }
  }

  /**
   * 调用梦境AI分析
   */
  private async callDreamAI(dreamType: string, context: string): Promise<any> {
    if (!DASHSCOPE_API_KEY) {
      logger.info('[Dream] No API key, using fallback');
      return null;
    }

    const systemPrompt = DREAM_TYPE_PROMPTS[dreamType] || DREAM_TYPE_PROMPTS.STRATEGY_OPTIMIZATION;
    
    try {
      const response = await fetch(DASHSCOPE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请基于以下上下文进行梦境推演分析：\n${context || '系统日常运行状态良好，无特殊事件'}` }
          ],
          temperature: 0.8,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        logger.error({ error: await response.text() }, 'Dream API error');
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { topRisk: content.slice(0, 100), suggestedAction: '继续观察', confidence: 0.6 };
    } catch (e) {
      logger.error({ error: e }, 'Dream AI call failed');
      return null;
    }
  }

  /**
   * 模拟梦境过程
   */
  async simulateDream(logId: string, dreamType?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.updateDreamLog(logId, { status: "DREAMING" });
    
    const startTime = Date.now();
    const type = dreamType || 'STRATEGY_OPTIMIZATION';
    
    let aiInsights = await this.callDreamAI(type, `梦境类型: ${type}\n当前时间: ${new Date().toLocaleString('zh-CN')}`);
    
    const simulationCount = Math.floor(Math.random() * 100000) + 10000;
    const decisionsOptimized = Math.floor(simulationCount * 0.05);
    const hpGained = Math.floor(decisionsOptimized * 0.1);
    
    const insights = aiInsights || {
      topRisk: "市场波动风险",
      suggestedAction: "增加对冲头寸",
      confidence: 0.87,
    };
    insights.hpBonus = hpGained;
    insights.aiGenerated = !!aiInsights;
    
    const durationMs = Date.now() - startTime;
    
    await this.updateDreamLog(logId, {
      status: "AWAKENED",
      simulationCount,
      decisionsOptimized,
      durationMs,
      patchesGenerated: aiInsights?.optimizations || ["optimize_z4_weights", "refine_stress_threshold"],
      insightsDiscovered: insights,
    });
    
    await this.createEvolutionEvent({
      sourceModule: 'Z6_DREAM',
      eventType: 'HP_GAIN',
      previousValue: { hp: 0 },
      newValue: { hp: hpGained, simulationCount, decisionsOptimized, aiGenerated: !!aiInsights },
      deltaDescription: `梦境推演完成: 模拟${simulationCount}次, 优化${decisionsOptimized}个决策, 获得${hpGained}HP${aiInsights ? ' (AI生成)' : ''}`,
      triggeredBy: 'DREAM_ENGINE',
    });
    
    logger.info(`[Dream] Completed: ${type}, AI: ${!!aiInsights}, duration: ${durationMs}ms`);
  }
}

export const computeService = new ComputeService();