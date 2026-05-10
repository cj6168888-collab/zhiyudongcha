import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireAuth, requireMaster } from "../../middleware/auth";
import { analyzeFileWithAI } from './ai-helpers';
import { projectService } from "../../services/ProjectService";

const logger = createServiceLogger('ProjectFiles');

export function registerProjectFilesRoutes(app: Express, storage: IStorage): void {
  app.get("/api/projects/:id/files", requireAuth, async (req, res) => {
    try {
      const files = await projectService.getProjectFiles(req.params.id);
      return res.json(files);
    } catch (error) {
      logger.error({ err: error }, '[Files] List error');
      return res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/projects/:id/files", requireAuth, async (req, res) => {
    try {
      const { fileName, fileType, content } = req.body;
      if (!fileName || !content) {
        return res.status(400).json({ error: "fileName and content are required" });
      }
      const file = await projectService.createProjectFile({
        projectId: req.params.id,
        fileName,
        fileType: fileType || 'text/plain',
        fileContent: content,
      });
      logger.info({ fileId: file.id, projectId: req.params.id }, '[Files] Created');
      return res.status(201).json(file);
    } catch (error) {
      logger.error({ err: error }, '[Files] Create error');
      return res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.post("/api/projects/:id/files/:fileId/analyze", requireMaster, async (req, res) => {
    try {
      const files = await projectService.getProjectFiles(req.params.id);
      const file = files.find(f => f.id === req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      const analysis = await analyzeFileWithAI(file.fileContent || '', file.fileName);
      const updated = await projectService.updateProjectFile(req.params.fileId, { aiAnalysis: analysis });
      logger.info({ fileId: req.params.fileId }, '[Files] AI analyzed');
      return res.json({ success: true, analysis, file: updated });
    } catch (error) {
      logger.error({ err: error }, '[Files] Analyze error');
      return res.status(500).json({ error: "Failed to analyze file" });
    }
  });

  app.delete("/api/projects/:id/files/:fileId", requireMaster, async (req, res) => {
    try {
      const success = await projectService.deleteProjectFile(req.params.fileId);
      if (!success) {
        return res.status(404).json({ error: "File not found" });
      }
      logger.info({ fileId: req.params.fileId }, '[Files] Deleted');
      return res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, '[Files] Delete error');
      return res.status(500).json({ error: "Failed to delete file" });
    }
  });

  logger.info('[ProjectFiles] Routes registered');
}
