import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  downloadTasks,
  computeJobs,
  type DownloadTask,
  type InsertDownloadTask,
  type ComputeJob,
  type InsertComputeJob,
} from "@shared/schema";

export class DownloadTaskRepository extends BaseRepository<DownloadTask, InsertDownloadTask> {
  constructor() {
    super('DownloadTaskRepository');
  }

  protected getTable() {
    return downloadTasks;
  }

  protected getIdColumn() {
    return downloadTasks.id;
  }

  override async create(task: InsertDownloadTask): Promise<DownloadTask> {
    const [created] = await this.db.insert(downloadTasks).values(task).returning();
    return created;
  }

  async getAll(): Promise<DownloadTask[]> {
    return await this.db.select().from(downloadTasks).orderBy(sql`created_at DESC`);
  }

  override async update(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined> {
    const [updated] = await this.db
      .update(downloadTasks)
      .set(updates)
      .where(eq(downloadTasks.id, id))
      .returning();
    return updated;
  }

  override async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(downloadTasks).where(eq(downloadTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getByStatus(status: string): Promise<DownloadTask[]> {
    return await this.db
      .select()
      .from(downloadTasks)
      .where(eq(downloadTasks.status, status))
      .orderBy(sql`created_at DESC`);
  }

  async getActive(): Promise<DownloadTask[]> {
    return await this.db
      .select()
      .from(downloadTasks)
      .where(sql`${downloadTasks.status} IN ('PENDING', 'DOWNLOADING')`)
      .orderBy(sql`created_at DESC`);
  }
}

export class ComputeJobRepository extends BaseRepository<ComputeJob, InsertComputeJob> {
  constructor() {
    super('ComputeJobRepository');
  }

  protected getTable() {
    return computeJobs;
  }

  protected getIdColumn() {
    return computeJobs.id;
  }

  override async create(job: InsertComputeJob): Promise<ComputeJob> {
    const [created] = await this.db.insert(computeJobs).values(job).returning();
    return created;
  }

  async getAll(): Promise<ComputeJob[]> {
    return await this.db.select().from(computeJobs).orderBy(sql`created_at DESC`);
  }

  override async update(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined> {
    const [updated] = await this.db
      .update(computeJobs)
      .set(updates)
      .where(eq(computeJobs.id, id))
      .returning();
    return updated;
  }

  async getByStatus(status: string): Promise<ComputeJob[]> {
    return await this.db
      .select()
      .from(computeJobs)
      .where(eq(computeJobs.status, status))
      .orderBy(sql`created_at DESC`);
  }

  async getActive(): Promise<ComputeJob[]> {
    return await this.db
      .select()
      .from(computeJobs)
      .where(sql`${computeJobs.status} IN ('PENDING', 'RUNNING')`)
      .orderBy(sql`created_at DESC`);
  }
}

export const downloadTaskRepository = new DownloadTaskRepository();
export const computeJobRepository = new ComputeJobRepository();
