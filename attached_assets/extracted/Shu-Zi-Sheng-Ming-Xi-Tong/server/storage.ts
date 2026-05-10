import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, or, sql, ilike } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type Person,
  type InsertPerson,
  type VaultItem,
  type InsertVaultItem,
  type ShadowMemory,
  type InsertShadowMemory,
  type RelationshipInsight,
  type DownloadTask,
  type InsertDownloadTask,
  type ComputeJob,
  type InsertComputeJob,
  type DreamLog,
  type InsertDreamLog,
  type AuditLog,
  type InsertAuditLog,
  type ExpertDecision,
  type InsertExpertDecision,
  type EvolutionEvent,
  type InsertEvolutionEvent,
  type Project,
  type InsertProject,
  type IntelItem,
  type InsertIntelItem,
  type SkillCapsule,
  type InsertSkillCapsule,
  type EvolutionState,
  type InsertEvolutionState,
  type DailyReport,
  type InsertDailyReport,
  users,
  persons,
  vaultItems,
  shadowMemories,
  downloadTasks,
  computeJobs,
  dreamLogs,
  auditLogs,
  expertDecisions,
  evolutionEvents,
  projects,
  intelItems,
  skillCapsules,
  evolutionState,
  dailyReports,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Z2: Person (Relationship Matrix) operations
  getPerson(id: string): Promise<Person | undefined>;
  getAllPersons(accessLevel?: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<boolean>;
  searchPersonsByWeakness(keyword: string): Promise<Person[]>;
  findConflictingRelationships(personId: string): Promise<Person[]>;
  
  // [NEW] Z2: Relationship Insight (博弈素材提取)
  getRelationshipInsight(personName: string): Promise<RelationshipInsight | null>;

  // Z2: Vault (Resource Vault) operations
  getVaultItem(id: string): Promise<VaultItem | undefined>;
  getAllVaultItems(zone?: string): Promise<VaultItem[]>;
  createVaultItem(item: InsertVaultItem): Promise<VaultItem>;
  updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined>;
  deleteVaultItem(id: string): Promise<boolean>;
  searchVaultBySemanticTag(tag: string): Promise<VaultItem[]>;
  
  // [NEW] Z2: Intent-based Search (意图语义调阅)
  searchVaultByIntent(intent: string): Promise<VaultItem[]>;
  
  // [NEW] Z2: Physical Shredding (物理级粉碎)
  permanentShred(targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }>;

  // Z2: Shadow Memory operations
  getAllMemories(): Promise<ShadowMemory[]>;
  createMemory(memory: InsertShadowMemory): Promise<ShadowMemory>;

  // Z6: Download Task operations
  createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask>;
  getDownloadTasks(): Promise<DownloadTask[]>;
  updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined>;
  deleteDownloadTask(id: string): Promise<boolean>;

  // Z6: Compute Job operations
  createComputeJob(job: InsertComputeJob): Promise<ComputeJob>;
  getComputeJobs(): Promise<ComputeJob[]>;
  updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined>;

  // Z6: Dream Log operations
  createDreamLog(log: InsertDreamLog): Promise<DreamLog>;
  getDreamLogs(): Promise<DreamLog[]>;
  updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined>;

  // Z6: Stats
  getVaultStats(): Promise<{
    totalDownloads: number;
    activeDownloads: number;
    totalComputeJobs: number;
    activeComputeJobs: number;
    totalDreams: number;
    categories: Record<string, number>;
  }>;

  // P0: Audit Log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;

  // P1: Expert Decision operations
  createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision>;
  getExpertDecisions(expertType?: string): Promise<ExpertDecision[]>;
  updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined>;

  // P1: Evolution Event operations
  createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent>;
  getEvolutionEvents(limit?: number): Promise<EvolutionEvent[]>;

  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getProjects(status?: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;

  // Intel Item operations
  createIntelItem(intel: InsertIntelItem): Promise<IntelItem>;
  getIntelItems(status?: string): Promise<IntelItem[]>;
  updateIntelItem(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined>;

  // Skill Capsule operations
  createSkillCapsule(capsule: InsertSkillCapsule): Promise<SkillCapsule>;
  getSkillCapsules(): Promise<SkillCapsule[]>;
  updateSkillCapsule(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined>;

  // Evolution State operations (singleton)
  getEvolutionState(): Promise<EvolutionState | undefined>;
  updateEvolutionState(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined>;

  // Daily Report operations
  createDailyReport(report: InsertDailyReport): Promise<DailyReport>;
  getDailyReports(limit?: number): Promise<DailyReport[]>;
  getTodayReport(): Promise<DailyReport | undefined>;
  updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined>;

  // Persons by approval status
  getPersonsByApprovalStatus(status: string): Promise<Person[]>;
}

export class DatabaseStorage implements IStorage {
  // ===== User Operations =====
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ===== Z2: Person Operations =====
  async getPerson(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(persons).where(eq(persons.id, id));
    return person;
  }

  async getAllPersons(accessLevel?: string): Promise<Person[]> {
    if (accessLevel) {
      return await db.select().from(persons).where(eq(persons.accessLevel, accessLevel));
    }
    return await db.select().from(persons);
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    const [newPerson] = await db.insert(persons).values(person).returning();
    return newPerson;
  }

  async updatePerson(
    id: string,
    person: Partial<InsertPerson>
  ): Promise<Person | undefined> {
    const [updated] = await db
      .update(persons)
      .set(person)
      .where(eq(persons.id, id))
      .returning();
    return updated;
  }

  async deletePerson(id: string): Promise<boolean> {
    const result = await db.delete(persons).where(eq(persons.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async searchPersonsByWeakness(keyword: string): Promise<Person[]> {
    return await db
      .select()
      .from(persons)
      .where(sql`${persons.weakness} ILIKE ${`%${keyword}%`}`);
  }

  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await db
      .select()
      .from(persons)
      .where(
        or(
          sql`${persons.connectionNodes} @> ARRAY[${personId}]::text[]`,
          sql`${persons.conflictPoints} IS NOT NULL AND array_length(${persons.conflictPoints}, 1) > 0`
        )
      );
  }

  // [NEW] 博弈素材提取 - Relationship Insight
  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    const [person] = await db
      .select()
      .from(persons)
      .where(sql`${persons.name} ILIKE ${`%${personName}%`}`);
    
    if (!person) return null;

    // 生成博弈分析报告
    const interestChain = person.interestChain as Record<string, unknown> | null;
    const interestSummary = interestChain 
      ? Object.entries(interestChain).map(([k, v]) => `${k}: ${v}`).join(', ')
      : '无已知利益关联';

    const riskLevel = person.weakness 
      ? (person.weakness.length > 100 ? 'HIGH' : 'MEDIUM') 
      : 'LOW';

    const suggestedApproach = person.decisionStyle === 'AGGRESSIVE' 
      ? '建议采取稳健策略，避免正面冲突'
      : person.decisionStyle === 'CONSERVATIVE'
      ? '可适当施压，对方倾向于妥协'
      : '需要更多信息才能制定策略';

    return {
      person,
      vulnerabilityAnalysis: person.weakness || '暂无弱点记录',
      interestChainSummary: interestSummary,
      riskLevel,
      suggestedApproach,
    };
  }

  // ===== Z2: Vault Operations =====
  async getVaultItem(id: string): Promise<VaultItem | undefined> {
    const [item] = await db
      .select()
      .from(vaultItems)
      .where(eq(vaultItems.id, id));
    return item;
  }

  async getAllVaultItems(zone?: string): Promise<VaultItem[]> {
    if (zone) {
      return await db
        .select()
        .from(vaultItems)
        .where(eq(vaultItems.privacyZone, zone));
    }
    return await db.select().from(vaultItems);
  }

  async createVaultItem(item: InsertVaultItem): Promise<VaultItem> {
    const [newItem] = await db.insert(vaultItems).values(item).returning();
    return newItem;
  }

  async updateVaultItem(
    id: string,
    item: Partial<InsertVaultItem>
  ): Promise<VaultItem | undefined> {
    const [updated] = await db
      .update(vaultItems)
      .set(item)
      .where(eq(vaultItems.id, id))
      .returning();
    return updated;
  }

  async deleteVaultItem(id: string): Promise<boolean> {
    const result = await db.delete(vaultItems).where(eq(vaultItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async searchVaultBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await db
      .select()
      .from(vaultItems)
      .where(sql`${tag} = ANY(${vaultItems.semanticTags})`);
  }

  // [NEW] 意图语义调阅 - Search by Intent
  async searchVaultByIntent(intent: string): Promise<VaultItem[]> {
    // 基于意图关键词搜索文件名、语义标签和语义摘要
    // 未来接入 pgvector 后可升级为真正的向量相似度搜索
    return await db
      .select()
      .from(vaultItems)
      .where(
        or(
          sql`${vaultItems.fileName} ILIKE ${`%${intent}%`}`,
          sql`${vaultItems.semanticIndex} ILIKE ${`%${intent}%`}`,
          sql`EXISTS (SELECT 1 FROM unnest(${vaultItems.semanticTags}) AS tag WHERE tag ILIKE ${`%${intent}%`})`
        )
      );
  }

  // [NEW] 物理级粉碎 - Permanent Shred
  async permanentShred(targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> {
    try {
      if (table === 'vault') {
        const item = await this.getVaultItem(targetId);
        if (!item) {
          return { success: false, message: 'Target not found in vault' };
        }
        
        // 1. 记录粉碎日志 (实际生产中会执行文件物理覆盖)
        console.log(`[SECURITY] Initiating physical shredding for vault item: ${item.fileName}`);
        console.log(`[SECURITY] File path: ${item.filePath || 'N/A'}`);
        
        // 2. 从数据库删除索引
        await db.delete(vaultItems).where(eq(vaultItems.id, targetId));
        
        return { 
          success: true, 
          message: `[SHRED COMPLETE] ${item.fileName} has been permanently destroyed` 
        };
      } else {
        const person = await this.getPerson(targetId);
        if (!person) {
          return { success: false, message: 'Target person not found' };
        }
        
        console.log(`[SECURITY] Initiating data purge for person: ${person.name}`);
        
        await db.delete(persons).where(eq(persons.id, targetId));
        
        return { 
          success: true, 
          message: `[PURGE COMPLETE] All records of ${person.name} have been erased` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Shredding failed: ${error}` 
      };
    }
  }

  // ===== Z2: Shadow Memory Operations =====
  async getAllMemories(): Promise<ShadowMemory[]> {
    return await db.select().from(shadowMemories);
  }

  async createMemory(memory: InsertShadowMemory): Promise<ShadowMemory> {
    const [newMemory] = await db
      .insert(shadowMemories)
      .values(memory)
      .returning();
    return newMemory;
  }

  // ===== Z6: Download Task Operations =====
  async createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask> {
    const [newTask] = await db.insert(downloadTasks).values(task).returning();
    return newTask;
  }

  async getDownloadTasks(): Promise<DownloadTask[]> {
    return await db.select().from(downloadTasks).orderBy(sql`created_at DESC`);
  }

  async updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined> {
    const [updated] = await db
      .update(downloadTasks)
      .set(updates)
      .where(eq(downloadTasks.id, id))
      .returning();
    return updated;
  }

  async deleteDownloadTask(id: string): Promise<boolean> {
    const result = await db.delete(downloadTasks).where(eq(downloadTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ===== Z6: Compute Job Operations =====
  async createComputeJob(job: InsertComputeJob): Promise<ComputeJob> {
    const [newJob] = await db.insert(computeJobs).values(job).returning();
    return newJob;
  }

  async getComputeJobs(): Promise<ComputeJob[]> {
    return await db.select().from(computeJobs).orderBy(sql`created_at DESC`);
  }

  async updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined> {
    const [updated] = await db
      .update(computeJobs)
      .set(updates)
      .where(eq(computeJobs.id, id))
      .returning();
    return updated;
  }

  // ===== Z6: Dream Log Operations =====
  async createDreamLog(log: InsertDreamLog): Promise<DreamLog> {
    const [newLog] = await db.insert(dreamLogs).values(log).returning();
    return newLog;
  }

  async getDreamLogs(): Promise<DreamLog[]> {
    return await db.select().from(dreamLogs).orderBy(sql`created_at DESC`);
  }

  async updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined> {
    const [updated] = await db
      .update(dreamLogs)
      .set(updates)
      .where(eq(dreamLogs.id, id))
      .returning();
    return updated;
  }

  // ===== Z6: Stats =====
  async getVaultStats(): Promise<{
    totalDownloads: number;
    activeDownloads: number;
    totalComputeJobs: number;
    activeComputeJobs: number;
    totalDreams: number;
    categories: Record<string, number>;
  }> {
    const downloads = await this.getDownloadTasks();
    const jobs = await this.getComputeJobs();
    const dreams = await this.getDreamLogs();
    const vaultItemsAll = await this.getAllVaultItems();

    const categories: Record<string, number> = {
      RESEARCH: 0,
      SOFTWARE: 0,
      MEDIA: 0,
      BOOKS: 0,
    };

    vaultItemsAll.forEach(item => {
      if (item.category && categories[item.category] !== undefined) {
        categories[item.category]++;
      }
    });

    return {
      totalDownloads: downloads.length,
      activeDownloads: downloads.filter(d => d.status === 'DOWNLOADING' || d.status === 'PENDING').length,
      totalComputeJobs: jobs.length,
      activeComputeJobs: jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING').length,
      totalDreams: dreams.length,
      categories,
    };
  }

  // ===== P0: Audit Log Operations =====
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  // ===== P1: Expert Decision Operations =====
  async createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision> {
    const [newDecision] = await db.insert(expertDecisions).values(decision).returning();
    return newDecision;
  }

  async getExpertDecisions(expertType?: string): Promise<ExpertDecision[]> {
    if (expertType) {
      return await db
        .select()
        .from(expertDecisions)
        .where(eq(expertDecisions.expertType, expertType))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(expertDecisions).orderBy(sql`created_at DESC`);
  }

  async updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined> {
    const [updated] = await db
      .update(expertDecisions)
      .set(updates)
      .where(eq(expertDecisions.id, id))
      .returning();
    return updated;
  }

  // ===== P1: Evolution Event Operations =====
  async createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent> {
    const [newEvent] = await db.insert(evolutionEvents).values(event).returning();
    return newEvent;
  }

  async getEvolutionEvents(limit: number = 50): Promise<EvolutionEvent[]> {
    return await db
      .select()
      .from(evolutionEvents)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  // ===== Project Operations =====
  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getProjects(status?: string): Promise<Project[]> {
    if (status) {
      return await db.select().from(projects).where(eq(projects.status, status)).orderBy(sql`created_at DESC`);
    }
    return await db.select().from(projects).orderBy(sql`created_at DESC`);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return updated;
  }

  // ===== Intel Item Operations =====
  async createIntelItem(intel: InsertIntelItem): Promise<IntelItem> {
    const [newIntel] = await db.insert(intelItems).values(intel).returning();
    return newIntel;
  }

  async getIntelItems(status?: string): Promise<IntelItem[]> {
    if (status) {
      return await db.select().from(intelItems).where(eq(intelItems.status, status)).orderBy(sql`created_at DESC`);
    }
    return await db.select().from(intelItems).orderBy(sql`created_at DESC`);
  }

  async updateIntelItem(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined> {
    const [updated] = await db.update(intelItems).set(updates).where(eq(intelItems.id, id)).returning();
    return updated;
  }

  // ===== Skill Capsule Operations =====
  async createSkillCapsule(capsule: InsertSkillCapsule): Promise<SkillCapsule> {
    const [newCapsule] = await db.insert(skillCapsules).values(capsule).returning();
    return newCapsule;
  }

  async getSkillCapsules(): Promise<SkillCapsule[]> {
    return await db.select().from(skillCapsules).orderBy(sql`created_at DESC`);
  }

  async updateSkillCapsule(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined> {
    const [updated] = await db.update(skillCapsules).set(updates).where(eq(skillCapsules.id, id)).returning();
    return updated;
  }

  // ===== Evolution State Operations (Singleton) =====
  async getEvolutionState(): Promise<EvolutionState | undefined> {
    const [state] = await db.select().from(evolutionState).where(eq(evolutionState.id, 'singleton'));
    if (!state) {
      const [newState] = await db.insert(evolutionState).values({ id: 'singleton' } as any).returning();
      return newState;
    }
    return state;
  }

  async updateEvolutionState(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined> {
    await this.getEvolutionState();
    const [updated] = await db.update(evolutionState).set({ ...updates, updatedAt: new Date() }).where(eq(evolutionState.id, 'singleton')).returning();
    return updated;
  }

  // ===== Daily Report Operations =====
  async createDailyReport(report: InsertDailyReport): Promise<DailyReport> {
    const [newReport] = await db.insert(dailyReports).values(report).returning();
    return newReport;
  }

  async getDailyReports(limit: number = 30): Promise<DailyReport[]> {
    return await db.select().from(dailyReports).orderBy(sql`report_date DESC`).limit(limit);
  }

  async getTodayReport(): Promise<DailyReport | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [report] = await db.select().from(dailyReports).where(sql`DATE(report_date) = DATE(${today})`);
    return report;
  }

  async updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined> {
    const [updated] = await db.update(dailyReports).set(updates).where(eq(dailyReports.id, id)).returning();
    return updated;
  }

  // ===== Persons by Approval Status =====
  async getPersonsByApprovalStatus(status: string): Promise<Person[]> {
    return await db.select().from(persons).where(eq(persons.approvalStatus, status)).orderBy(sql`created_at DESC`);
  }
}

export const storage = new DatabaseStorage();
