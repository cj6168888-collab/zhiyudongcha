import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireAuth, requireMaster } from "../../middleware/auth";
import { z } from "zod";
import { projectEngineService } from '../../services/project-engine';

const logger = createServiceLogger('ProjectEngine');

const decomposeSchema = z.object({
  description: z.string().min(10, "项目描述至少10个字符"),
  category: z.enum(['SOFTWARE', 'BUSINESS']).optional(),
});

export function registerProjectEngineRoutes(app: Express, _storage: IStorage): void {
  app.post("/api/projects/decompose", requireAuth, async (req, res) => {
    try {
      const parsed = decomposeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败", details: parsed.error.errors });
      }
      const decomposition = await projectEngineService.decomposeProject(
        parsed.data.description,
        parsed.data.category
      );
      return res.json({ success: true, decomposition });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Decompose error');
      return res.status(500).json({ error: "项目拆解失败" });
    }
  });

  app.post("/api/projects/create-from-decomposition", requireMaster, async (req, res) => {
    try {
      const { decomposition } = req.body;
      if (!decomposition) {
        return res.status(400).json({ error: "缺少项目拆解数据" });
      }
      const project = await projectEngineService.createProjectFromDecomposition(decomposition);
      return res.status(201).json({ success: true, project });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Create error');
      return res.status(500).json({ error: "创建项目失败" });
    }
  });

  app.get("/api/projects/:id/progress", requireAuth, async (req, res) => {
    try {
      const progress = await projectEngineService.getProjectProgress(req.params.id);
      return res.json(progress);
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Progress error');
      return res.status(500).json({ error: "获取进度失败" });
    }
  });

  app.get("/api/projects/:id/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await projectEngineService.getProgressAlerts(req.params.id);
      return res.json({ alerts });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Alerts error');
      return res.status(500).json({ error: "获取预警失败" });
    }
  });

  app.get("/api/projects/:id/milestones", requireAuth, async (req, res) => {
    try {
      const milestones = await projectEngineService.getMilestones(req.params.id);
      return res.json({ milestones });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Milestones error');
      return res.status(500).json({ error: "获取里程碑失败" });
    }
  });

  app.get("/api/projects/:id/tasks", requireAuth, async (req, res) => {
    try {
      const milestoneId = req.query.milestoneId as string | undefined;
      const tasks = await projectEngineService.getTasks(req.params.id, milestoneId);
      return res.json({ tasks });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Tasks error');
      return res.status(500).json({ error: "获取任务失败" });
    }
  });

  app.patch("/api/projects/:id/tasks/:taskId/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "缺少状态参数" });
      }
      const task = await projectEngineService.updateTaskStatus(req.params.taskId, status);
      if (!task) {
        return res.status(404).json({ error: "任务不存在" });
      }
      return res.json({ success: true, task });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Update task error');
      return res.status(500).json({ error: "更新任务失败" });
    }
  });

  app.get("/api/projects/:id/risks", requireAuth, async (req, res) => {
    try {
      const risks = await projectEngineService.getRisks(req.params.id);
      return res.json({ risks });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Risks error');
      return res.status(500).json({ error: "获取风险失败" });
    }
  });

  app.post("/api/projects/:id/risks", requireMaster, async (req, res) => {
    try {
      const risk = await projectEngineService.addRisk(req.params.id, req.body);
      return res.status(201).json({ success: true, risk });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Add risk error');
      return res.status(500).json({ error: "添加风险失败" });
    }
  });

  app.patch("/api/projects/:id/risks/:riskId/resolve", requireMaster, async (req, res) => {
    try {
      const { resolutionNotes } = req.body;
      const risk = await projectEngineService.resolveRisk(req.params.riskId, resolutionNotes || '');
      if (!risk) {
        return res.status(404).json({ error: "风险项不存在" });
      }
      return res.json({ success: true, risk });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Resolve risk error');
      return res.status(500).json({ error: "解决风险失败" });
    }
  });

  app.get("/api/projects/:id/logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await projectEngineService.getProjectLogs(req.params.id, limit);
      return res.json({ logs });
    } catch (error) {
      logger.error({ err: error }, '[ProjectEngine] Logs error');
      return res.status(500).json({ error: "获取日志失败" });
    }
  });

  logger.info('[ProjectEngine] Routes registered');
}
