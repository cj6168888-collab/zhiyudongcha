import { Router, type Request, type Response } from "express";
import { attachRole, requireMaster } from "../middleware/auth";
import { schedulerService } from "../services/scheduler";
import { createServiceLogger } from "../lib/logger";

const logger = createServiceLogger("SchedulerRoutes");
const router = Router();

router.get("/jobs", attachRole, requireMaster, async (_req: Request, res: Response) => {
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
    logger.error({ error }, "获取任务列表失败");
    res.status(500).json({ error: "获取任务列表失败" });
  }
});

router.get("/history", attachRole, requireMaster, async (req: Request, res: Response) => {
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
    logger.error({ error }, "获取执行历史失败");
    res.status(500).json({ error: "获取执行历史失败" });
  }
});

router.post("/trigger/:jobType", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { jobType } = req.params;
    const result = await schedulerService.triggerJob(jobType);
    
    logger.info({ jobType }, "任务已触发");
    res.json(result);
  } catch (error) {
    logger.error({ error }, "触发任务失败");
    res.status(500).json({ error: "触发任务失败" });
  }
});

router.post("/pause/:jobType", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { jobType } = req.params;
    const result = await schedulerService.pauseJob(jobType);
    
    logger.info({ jobType }, "任务已暂停");
    res.json(result);
  } catch (error) {
    logger.error({ error }, "暂停任务失败");
    res.status(500).json({ error: "暂停任务失败" });
  }
});

router.post("/resume/:jobType", attachRole, requireMaster, async (req: Request, res: Response) => {
  try {
    const { jobType } = req.params;
    const result = await schedulerService.resumeJob(jobType);
    
    logger.info({ jobType }, "任务已恢复");
    res.json(result);
  } catch (error) {
    logger.error({ error }, "恢复任务失败");
    res.status(500).json({ error: "恢复任务失败" });
  }
});

router.get("/status", attachRole, async (_req: Request, res: Response) => {
  try {
    const status = schedulerService.getStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error({ error }, "获取调度器状态失败");
    res.status(500).json({ error: "获取调度器状态失败" });
  }
});

logger.info("Scheduler路由模块已加载");

export default router;
