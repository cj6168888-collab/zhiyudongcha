import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { createServiceLogger } from '../lib/logger';
import { attachRole, requireMaster } from "../middleware/auth";
import { schedulerService } from "../services/scheduler";

const logger = createServiceLogger('SchedulerRoutes');

export function registerSchedulerRoutes(
  app: Express,
  _storage: IStorage,
  _context: RouteContext
): void {

  app.get("/api/scheduler/jobs", attachRole, requireMaster, async (req, res) => {
    try {
      const jobs = await schedulerService.getJobList();
      const status = schedulerService.getStatus();
      
      res.json({
        success: true,
        jobs,
        status,
        total: jobs.length
      });
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Get jobs error');
      res.status(500).json({ error: "获取任务列表失败" });
    }
  });

  app.get("/api/scheduler/history", attachRole, requireMaster, async (req, res) => {
    try {
      const jobType = req.query.jobType as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await schedulerService.getJobHistory(jobType, limit);
      
      res.json({
        success: true,
        history,
        total: history.length
      });
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Get history error');
      res.status(500).json({ error: "获取执行历史失败" });
    }
  });

  app.post("/api/scheduler/trigger/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.triggerJob(jobType);
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Trigger job error');
      res.status(500).json({ error: "触发任务失败" });
    }
  });

  app.post("/api/scheduler/pause/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.pauseJob(jobType);
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Pause job error');
      res.status(500).json({ error: "暂停任务失败" });
    }
  });

  app.post("/api/scheduler/resume/:jobType", attachRole, requireMaster, async (req, res) => {
    try {
      const { jobType } = req.params;
      const result = await schedulerService.resumeJob(jobType);
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Resume job error');
      res.status(500).json({ error: "恢复任务失败" });
    }
  });

  app.get("/api/scheduler/status", attachRole, async (req, res) => {
    try {
      const status = schedulerService.getStatus();
      
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      logger.error({ err: error }, '[Scheduler] Get status error');
      res.status(500).json({ error: "获取调度器状态失败" });
    }
  });

  logger.info('[Scheduler] Routes registered at /api/scheduler/*');
}
