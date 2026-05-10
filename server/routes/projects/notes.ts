import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireMaster } from "../../middleware/auth";
import { projectService } from "../../services/ProjectService";

const logger = createServiceLogger('ProjectNotes');

export function registerProjectNotesRoutes(app: Express, storage: IStorage): void {
  app.get("/api/projects/:id/notes", async (req, res) => {
    try {
      const notes = await projectService.getProjectNotes(req.params.id);
      return res.json(notes);
    } catch (error) {
      logger.error({ err: error }, '[Notes] List error');
      return res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/projects/:id/notes", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      const note = await projectService.createProjectNote({
        projectId: req.params.id,
        content,
        noteType: 'GENERAL',
      });
      logger.info({ noteId: note.id, projectId: req.params.id }, '[Notes] Created');
      return res.status(201).json(note);
    } catch (error) {
      logger.error({ err: error }, '[Notes] Create error');
      return res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.delete("/api/projects/:id/notes/:noteId", requireMaster, async (req, res) => {
    try {
      const success = await projectService.deleteProjectNote(req.params.noteId);
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      logger.info({ noteId: req.params.noteId }, '[Notes] Deleted');
      return res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, '[Notes] Delete error');
      return res.status(500).json({ error: "Failed to delete note" });
    }
  });

  logger.info('[ProjectNotes] Routes registered');
}
