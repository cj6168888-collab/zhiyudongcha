import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireMaster, auditAction } from "../middleware/auth";
import {
  insertDownloadTaskSchema,
  insertComputeJobSchema,
  insertDreamLogSchema,
} from "@shared/schema";

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

let dreamSchedulerInterval: NodeJS.Timeout | null = null;
let dreamSchedulerConfig = {
  enabled: false,
  intervalHours: 24,
  lastTriggeredAt: null as Date | null,
  preferredDreamTypes: ['STRATEGY_OPTIMIZATION', 'RISK_ANALYSIS', 'MEMORY_CONSOLIDATION'],
};

async function simulateDownload(storage: IStorage, taskId: string) {
  const stages = [
    { status: "DOWNLOADING", progress: 25 },
    { status: "DOWNLOADING", progress: 50 },
    { status: "DOWNLOADING", progress: 75 },
    { status: "INDEXING", progress: 90 },
    { status: "COMPLETE", progress: 100, sandboxResult: "SAFE" },
  ];
  
  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await storage.updateDownloadTask(taskId, stage as any);
  }
}

async function simulateCompute(storage: IStorage, jobId: string) {
  const stages = [
    { status: "PROCESSING", progress: 20 },
    { status: "PROCESSING", progress: 50 },
    { status: "PROCESSING", progress: 80 },
    { status: "COMPLETE", progress: 100, processingTimeMs: Math.floor(Math.random() * 5000) + 2000 },
  ];
  
  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await storage.updateComputeJob(jobId, stage as any);
  }
}

async function callDreamAI(dreamType: string, context: string): Promise<any> {
  if (!DASHSCOPE_API_KEY) {
    console.log('[Dream] No API key, using fallback');
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
      console.error('[Dream] API error:', await response.text());
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
    console.error('[Dream] AI call failed:', e);
    return null;
  }
}

async function simulateDream(storage: IStorage, logId: string, dreamType?: string) {
  await new Promise(resolve => setTimeout(resolve, 500));
  await storage.updateDreamLog(logId, { status: "DREAMING" });
  
  const startTime = Date.now();
  const type = dreamType || 'STRATEGY_OPTIMIZATION';
  
  let aiInsights = await callDreamAI(type, `梦境类型: ${type}\n当前时间: ${new Date().toLocaleString('zh-CN')}`);
  
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
  
  await storage.updateDreamLog(logId, {
    status: "AWAKENED",
    simulationCount,
    decisionsOptimized,
    durationMs,
    patchesGenerated: aiInsights?.optimizations || ["optimize_z4_weights", "refine_stress_threshold"],
    insightsDiscovered: insights,
  });
  
  await storage.createEvolutionEvent({
    sourceModule: 'Z6_DREAM',
    eventType: 'HP_GAIN',
    previousValue: { hp: 0 },
    newValue: { hp: hpGained, simulationCount, decisionsOptimized, aiGenerated: !!aiInsights },
    deltaDescription: `梦境推演完成: 模拟${simulationCount}次, 优化${decisionsOptimized}个决策, 获得${hpGained}HP${aiInsights ? ' (AI生成)' : ''}`,
    triggeredBy: 'DREAM_ENGINE',
  });
  
  console.log(`[Dream] Completed: ${type}, AI: ${!!aiInsights}, duration: ${durationMs}ms`);
}

function createDreamInterval(storage: IStorage) {
  return setInterval(async () => {
    try {
      const randomType = dreamSchedulerConfig.preferredDreamTypes[
        Math.floor(Math.random() * dreamSchedulerConfig.preferredDreamTypes.length)
      ];
      
      const log = await storage.createDreamLog({ 
        dreamType: randomType, 
        simulationCount: 0, 
        decisionsOptimized: 0, 
        status: "SLEEPING" 
      });
      
      dreamSchedulerConfig.lastTriggeredAt = new Date();
      simulateDream(storage, log.id);
      
      console.log(`[DreamScheduler] Auto-triggered dream: ${randomType}, logId: ${log.id}`);
    } catch (err) {
      console.error('[DreamScheduler] Failed to trigger scheduled dream:', err);
    }
  }, dreamSchedulerConfig.intervalHours * 60 * 60 * 1000);
}

function restartDreamScheduler(storage: IStorage) {
  if (dreamSchedulerInterval) {
    clearInterval(dreamSchedulerInterval);
    dreamSchedulerInterval = null;
  }
  if (dreamSchedulerConfig.enabled) {
    dreamSchedulerInterval = createDreamInterval(storage);
    console.log(`[DreamScheduler] (Re)started with interval: ${dreamSchedulerConfig.intervalHours}h`);
  }
}

export function registerZ6ComputeRoutes(app: Express, storage: IStorage) {
  
  app.get("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const tasks = await storage.getDownloadTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch download tasks" });
    }
  });

  app.post("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const { url, category } = req.body;
      if (!url || !category) {
        return res.status(400).json({ error: "Missing url or category" });
      }
      
      const task = await storage.createDownloadTask({ url, category, status: "PENDING", progress: 0 });
      await auditAction('DOWNLOAD_CREATED', req.userRole || 'MASTER', 'download_task', task.id, { url, category }, 'SUCCESS', req);
      simulateDownload(storage, task.id);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to create download task", details: error });
    }
  });

  app.delete("/api/z6/downloads/:id", requireMaster, async (req, res) => {
    try {
      const success = await storage.deleteDownloadTask(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Download task not found" });
      }
      await auditAction('DOWNLOAD_DELETED', req.userRole || 'MASTER', 'download_task', req.params.id, {}, 'SUCCESS', req);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete download task" });
    }
  });

  app.get("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const jobs = await storage.getComputeJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compute jobs" });
    }
  });

  app.post("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const { jobType, inputPayload, priority } = req.body;
      if (!jobType) {
        return res.status(400).json({ error: "Missing jobType" });
      }
      
      const job = await storage.createComputeJob({
        jobType,
        inputPayload: inputPayload || {},
        priority: priority || 5,
        status: "QUEUED",
        progress: 0,
        sourceDevice: "Z5_MOBILE",
      });
      
      await auditAction('COMPUTE_JOB_CREATED', req.userRole || 'MASTER', 'compute_job', job.id, { jobType, priority }, 'SUCCESS', req);
      simulateCompute(storage, job.id);
      res.status(201).json(job);
    } catch (error) {
      res.status(400).json({ error: "Failed to create compute job", details: error });
    }
  });

  app.get("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const logs = await storage.getDreamLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dream logs" });
    }
  });

  app.post("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const { dreamType } = req.body;
      if (!dreamType) {
        return res.status(400).json({ error: "Missing dreamType" });
      }
      
      await auditAction('DREAM_INITIATED', req.userRole || 'MASTER', 'dream_log', 'new', { dreamType }, 'SUCCESS', req);
      
      const log = await storage.createDreamLog({ dreamType, simulationCount: 0, decisionsOptimized: 0, status: "SLEEPING" });
      simulateDream(storage, log.id);
      res.status(201).json(log);
    } catch (error) {
      res.status(400).json({ error: "Failed to initiate dream", details: error });
    }
  });

  app.get("/api/z6/dream/scheduler", requireMaster, async (req, res) => {
    try {
      const nextTrigger = dreamSchedulerConfig.enabled && dreamSchedulerConfig.lastTriggeredAt
        ? new Date(dreamSchedulerConfig.lastTriggeredAt.getTime() + dreamSchedulerConfig.intervalHours * 60 * 60 * 1000)
        : null;
      
      res.json({
        ...dreamSchedulerConfig,
        nextScheduledAt: nextTrigger,
        status: dreamSchedulerInterval ? 'active' : 'stopped',
        warning: '注意: 调度器配置在服务重启后会丢失',
      });
    } catch (error) {
      res.status(500).json({ error: "获取调度器状态失败" });
    }
  });

  app.post("/api/z6/dream/scheduler", requireMaster, async (req, res) => {
    try {
      const { enabled, intervalHours, preferredDreamTypes } = req.body;
      const needsRestart = (typeof intervalHours === 'number' && intervalHours !== dreamSchedulerConfig.intervalHours);
      
      if (typeof enabled === 'boolean') {
        dreamSchedulerConfig.enabled = enabled;
      }
      if (typeof intervalHours === 'number' && intervalHours >= 1) {
        dreamSchedulerConfig.intervalHours = intervalHours;
      }
      if (Array.isArray(preferredDreamTypes)) {
        dreamSchedulerConfig.preferredDreamTypes = preferredDreamTypes;
      }

      if (dreamSchedulerConfig.enabled) {
        if (!dreamSchedulerInterval || needsRestart) {
          restartDreamScheduler(storage);
        }
      } else if (dreamSchedulerInterval) {
        clearInterval(dreamSchedulerInterval);
        dreamSchedulerInterval = null;
        console.log('[DreamScheduler] Stopped');
      }

      await auditAction('DREAM_SCHEDULER_CONFIGURED', req.userRole || 'MASTER', 'dream_scheduler', 'config', 
        { enabled: dreamSchedulerConfig.enabled, intervalHours: dreamSchedulerConfig.intervalHours }, 
        'SUCCESS', req);

      res.json({
        success: true,
        ...dreamSchedulerConfig,
        status: dreamSchedulerInterval ? 'active' : 'stopped',
        warning: '注意: 调度器配置在服务重启后会丢失',
      });
    } catch (error) {
      res.status(500).json({ error: "配置调度器失败" });
    }
  });

  app.post("/api/z6/dream/trigger-now", requireMaster, async (req, res) => {
    try {
      const { dreamType } = req.body;
      const type = dreamType || dreamSchedulerConfig.preferredDreamTypes[0] || 'STRATEGY_OPTIMIZATION';
      
      const log = await storage.createDreamLog({ 
        dreamType: type, 
        simulationCount: 0, 
        decisionsOptimized: 0, 
        status: "SLEEPING" 
      });
      
      dreamSchedulerConfig.lastTriggeredAt = new Date();
      simulateDream(storage, log.id);
      
      await auditAction('DREAM_MANUAL_TRIGGER', req.userRole || 'MASTER', 'dream_log', log.id, 
        { dreamType: type }, 'SUCCESS', req);

      res.json({
        success: true,
        logId: log.id,
        dreamType: type,
        message: '梦境推演已启动',
      });
    } catch (error) {
      res.status(500).json({ error: "触发梦境失败" });
    }
  });

  app.get("/api/z6/stats", requireMaster, async (req, res) => {
    try {
      const stats = await storage.getVaultStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault stats" });
    }
  });
}
