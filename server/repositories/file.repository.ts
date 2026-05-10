import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  generatedFiles,
  type GeneratedFile, InsertGeneratedFile
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('FileRepository');

export class GeneratedFileRepository extends BaseRepository<GeneratedFile, InsertGeneratedFile> {
  constructor() {
    super('GeneratedFile');
  }

  protected getTable() {
    return generatedFiles;
  }

  protected getIdColumn() {
    return generatedFiles.id;
  }

  async getByProject(projectId: string): Promise<GeneratedFile[]> {
    try {
      return await this.db.select().from(generatedFiles)
        .where(eq(generatedFiles.relatedProjectId, projectId))
        .orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, projectId }, 'getByProject failed');
      throw error;
    }
  }

  async getByReport(reportId: string): Promise<GeneratedFile[]> {
    try {
      return await this.db.select().from(generatedFiles)
        .where(eq(generatedFiles.relatedReportId, reportId))
        .orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, reportId }, 'getByReport failed');
      throw error;
    }
  }

  async getAll(projectId?: string): Promise<GeneratedFile[]> {
    try {
      if (projectId) {
        return await this.getByProject(projectId);
      }
      return await this.db.select().from(generatedFiles).orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, projectId }, 'getAll failed');
      throw error;
    }
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertGeneratedFile>): Promise<GeneratedFile | undefined> {
    try {
      const [updated] = await this.db.update(generatedFiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(generatedFiles.id, id))
        .returning();
      return updated;
    } catch (error) {
      logger.error({ err: error, id }, 'updateWithTimestamp failed');
      throw error;
    }
  }
}

export const generatedFileRepository = new GeneratedFileRepository();
