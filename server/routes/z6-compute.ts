import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Z6Compute');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireMaster, auditAction } from "../middleware/auth";
import { computeService } from '../services/ComputeService';
import {
  insertDownloadTaskSchema,
  insertComputeJobSchema,
  insertDreamLogSchema,
} from "@shared/schema";



let dreamSchedulerInterval: NodeJS.Timeout | null = null;
let dreamSchedulerConfig = {
  enabled: false,
  intervalHours: 24,
  lastTriggeredAt: null as Date | null,
  preferredDreamTypes: ['STRATEGY_OPTIMIZATION', 'RISK_ANALYSIS', 'MEMORY_CONSOLIDATION'],
};





function createDreamInterval() {
  return setInterval(async () => {
    try {
      const randomType = dreamSchedulerConfig.preferredDreamTypes[
        Math.floor(Math.random() * dreamSchedulerConfig.preferredDreamTypes.length)
      ];
      
      const log = await computeService.createDreamLog({ 
        dreamType: randomType, 
        simulationCount: 0, 
        decisionsOptimized: 0, 
        status: "SLEEPING" 
      });
      
      dreamSchedulerConfig.lastTriggeredAt = new Date();
      computeService.simulateDream(log.id);
      
      logger.info(`[DreamScheduler] Auto-triggered dream: ${randomType}, logId: ${log.id}`);
    } catch (err) {
      logger.error({ error: err }, 'DreamScheduler failed to trigger scheduled dream');
    }
  }, dreamSchedulerConfig.intervalHours * 60 * 60 * 1000);
}

function restartDreamScheduler() {
  if (dreamSchedulerInterval) {
    clearInterval(dreamSchedulerInterval);
    dreamSchedulerInterval = null;
  }
  if (dreamSchedulerConfig.enabled) {
    dreamSchedulerInterval = createDreamInterval();
    logger.info(`[DreamScheduler] (Re)started with interval: ${dreamSchedulerConfig.intervalHours}h`);
  }
}

export function registerZ6ComputeRoutes(app: Express, storage: IStorage) {
  
  app.get("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const tasks = await computeService.getDownloadTasks();
      return res.json(tasks);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch download tasks" });
    }
  });

  app.post("/api/z6/downloads", requireMaster, async (req, res) => {
    try {
      const { url, category } = req.body;
      if (!url || !category) {
        return res.status(400).json({ error: "Missing url or category" });
      }
      
      const task = await computeService.createDownloadTask({ url, category, status: "PENDING", progress: 0 });
      await auditAction('DOWNLOAD_CREATED', req.userRole || 'MASTER', 'download_task', task.id, { url, category }, 'SUCCESS', req);
      computeService.simulateDownload(task.id);
      return res.status(201).json(task);
    } catch (error) {
      return res.status(400).json({ error: "Failed to create download task", details: error });
    }
  });

  app.delete("/api/z6/downloads/:id", requireMaster, async (req, res) => {
    try {
      const success = await computeService.deleteDownloadTask(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Download task not found" });
      }
      await auditAction('DOWNLOAD_DELETED', req.userRole || 'MASTER', 'download_task', req.params.id, {}, 'SUCCESS', req);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete download task" });
    }
  });

  app.get("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const jobs = await computeService.getComputeJobs();
      return res.json(jobs);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch compute jobs" });
    }
  });

  app.post("/api/z6/compute", requireMaster, async (req, res) => {
    try {
      const { jobType, inputPayload, priority } = req.body;
      if (!jobType) {
        return res.status(400).json({ error: "Missing jobType" });
      }
      
      const job = await computeService.createComputeJob({
        jobType,
        inputPayload: inputPayload || {},
        priority: priority || 5,
        status: "QUEUED",
        progress: 0,
        sourceDevice: "Z5_MOBILE",
      });
      
      await auditAction('COMPUTE_JOB_CREATED', req.userRole || 'MASTER', 'compute_job', job.id, { jobType, priority }, 'SUCCESS', req);
      computeService.simulateCompute(job.id);
      return res.status(201).json(job);
    } catch (error) {
      return res.status(400).json({ error: "Failed to create compute job", details: error });
    }
  });

  app.get("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const logs = await computeService.getDreamLogs();
      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch dream logs" });
    }
  });

  app.post("/api/z6/dream", requireMaster, async (req, res) => {
    try {
      const { dreamType } = req.body;
      if (!dreamType) {
        return res.status(400).json({ error: "Missing dreamType" });
      }
      
      await auditAction('DREAM_INITIATED', req.userRole || 'MASTER', 'dream_log', 'new', { dreamType }, 'SUCCESS', req);
      
      const log = await computeService.createDreamLog({ dreamType, simulationCount: 0, decisionsOptimized: 0, status: "SLEEPING" });
      computeService.simulateDream(log.id);
      return res.status(201).json(log);
    } catch (error) {
      return res.status(400).json({ error: "Failed to initiate dream", details: error });
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
          restartDreamScheduler();
        }
      } else if (dreamSchedulerInterval) {
        clearInterval(dreamSchedulerInterval);
        dreamSchedulerInterval = null;
        logger.info('[DreamScheduler] Stopped');
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
      
      const log = await computeService.createDreamLog({ 
        dreamType: type, 
        simulationCount: 0, 
        decisionsOptimized: 0, 
        status: "SLEEPING" 
      });
      
      dreamSchedulerConfig.lastTriggeredAt = new Date();
      computeService.simulateDream(log.id, type);
      
      await auditAction('DREAM_MANUAL_TRIGGER', req.userRole || 'MASTER', 'dream_log', log.id, 
        { dreamType: type }, 'SUCCESS', req);

      return res.json({
        success: true,
        logId: log.id,
        dreamType: type,
        message: '梦境推演已启动',
      });
    } catch (error) {
      return res.status(500).json({ error: "触发梦境失败" });
    }
  });

  app.get("/api/z6/stats", requireMaster, async (req, res) => {
    try {
      const stats = await computeService.getVaultStats();
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch vault stats" });
    }
  });
}
