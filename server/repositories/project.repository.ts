import { eq, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  projects, 
  projectNotes,
  projectFiles,
  projectTemplates,
  type Project, 
  type InsertProject,
  type ProjectNote,
  type InsertProjectNote,
  type ProjectFile,
  type InsertProjectFile,
  type ProjectTemplate,
  type InsertProjectTemplate
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ProjectRepository');

export class ProjectRepository extends BaseRepository<Project, InsertProject> {
  constructor() {
    super('ProjectRepository');
  }

  protected getTable() {
    return projects;
  }

  protected getIdColumn() {
    return projects.id;
  }

  async getAllByStatus(status?: string): Promise<Project[]> {
    if (status) {
      return await this.db.select().from(projects)
        .where(eq(projects.status, status))
        .orderBy(sql`created_at DESC`);
    }
    return await this.db.select().from(projects).orderBy(sql`created_at DESC`);
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const results = await this.db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return results[0];
  }
}

export class ProjectNoteRepository extends BaseRepository<ProjectNote, InsertProjectNote> {
  constructor() {
    super('ProjectNoteRepository');
  }

  protected getTable() {
    return projectNotes;
  }

  protected getIdColumn() {
    return projectNotes.id;
  }

  async getByProjectId(projectId: string): Promise<ProjectNote[]> {
    return await this.db.select().from(projectNotes)
      .where(eq(projectNotes.projectId, projectId))
      .orderBy(sql`created_at DESC`);
  }
}

export class ProjectFileRepository extends BaseRepository<ProjectFile, InsertProjectFile> {
  constructor() {
    super('ProjectFileRepository');
  }

  protected getTable() {
    return projectFiles;
  }

  protected getIdColumn() {
    return projectFiles.id;
  }

  async getByProjectId(projectId: string): Promise<ProjectFile[]> {
    return await this.db.select().from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(sql`uploaded_at DESC`);
  }
}

export class ProjectTemplateRepository extends BaseRepository<ProjectTemplate, InsertProjectTemplate> {
  constructor() {
    super('ProjectTemplateRepository');
  }

  protected getTable() {
    return projectTemplates;
  }

  protected getIdColumn() {
    return projectTemplates.id;
  }

  async getByCategory(category?: string): Promise<ProjectTemplate[]> {
    if (category) {
      return await this.db.select().from(projectTemplates)
        .where(eq(projectTemplates.category, category))
        .orderBy(sql`usage_count DESC`);
    }
    return await this.db.select().from(projectTemplates).orderBy(sql`usage_count DESC`);
  }

  async incrementUsage(id: string): Promise<ProjectTemplate | undefined> {
    const template = await this.findById(id);
    if (!template) return undefined;
    
    const results = await this.db.update(projectTemplates)
      .set({ usageCount: (template.usageCount || 0) + 1 })
      .where(eq(projectTemplates.id, id))
      .returning();
    return results[0];
  }
}

export const projectRepository = new ProjectRepository();
export const projectNoteRepository = new ProjectNoteRepository();
export const projectFileRepository = new ProjectFileRepository();
export const projectTemplateRepository = new ProjectTemplateRepository();
