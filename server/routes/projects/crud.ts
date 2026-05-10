import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireMaster } from "../../middleware/auth";
import { projectService } from "../../services/ProjectService";

const logger = createServiceLogger('ProjectCRUD');

export function registerProjectCrudRoutes(app: Express, storage: IStorage): void {
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await projectService.getProjects();
      return res.json(projects);
    } catch (error) {
      logger.error({ err: error }, '[Projects] List error');
      return res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await projectService.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      return res.json(project);
    } catch (error) {
      logger.error({ err: error }, '[Projects] Get error');
      return res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", requireMaster, async (req, res) => {
    try {
      const project = await projectService.createProject(req.body);
      logger.info({ projectId: project.id }, '[Projects] Created');
      return res.status(201).json(project);
    } catch (error) {
      logger.error({ err: error }, '[Projects] Create error');
      return res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", requireMaster, async (req, res) => {
    try {
      const project = await projectService.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      return res.json(project);
    } catch (error) {
      logger.error({ err: error }, '[Projects] Update error');
      return res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.patch("/api/projects/:id/status", requireMaster, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const project = await projectService.updateProjectStatus(req.params.id, status);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      logger.info({ projectId: req.params.id, status }, '[Projects] Status updated');
      return res.json(project);
    } catch (error) {
      logger.error({ err: error }, '[Projects] Status update error');
      return res.status(500).json({ error: "Failed to update project status" });
    }
  });

  logger.info('[ProjectCRUD] Routes registered');
}
