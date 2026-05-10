import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  intelItems,
  skillCapsules,
  evolutionState,
  type IntelItem,
  type InsertIntelItem,
  type SkillCapsule,
  type InsertSkillCapsule,
  type EvolutionState,
  type InsertEvolutionState,
} from "@shared/schema";

export class IntelItemRepository extends BaseRepository<IntelItem, InsertIntelItem> {
  constructor() {
    super('IntelItemRepository');
  }

  protected getTable() {
    return intelItems;
  }

  protected getIdColumn() {
    return intelItems.id;
  }

  override async create(intel: InsertIntelItem): Promise<IntelItem> {
    const [created] = await this.db.insert(intelItems).values(intel).returning();
    return created;
  }

  async getAll(status?: string): Promise<IntelItem[]> {
    if (status) {
      return await this.db
        .select()
        .from(intelItems)
        .where(eq(intelItems.status, status))
        .orderBy(sql`created_at DESC`);
    }
    return await this.db.select().from(intelItems).orderBy(sql`created_at DESC`);
  }

  override async update(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined> {
    const [updated] = await this.db
      .update(intelItems)
      .set(updates)
      .where(eq(intelItems.id, id))
      .returning();
    return updated;
  }

  async getByCategory(category: string): Promise<IntelItem[]> {
    return await this.db
      .select()
      .from(intelItems)
      .where(eq(intelItems.category, category))
      .orderBy(sql`created_at DESC`);
  }
}

export class SkillCapsuleRepository extends BaseRepository<SkillCapsule, InsertSkillCapsule> {
  constructor() {
    super('SkillCapsuleRepository');
  }

  protected getTable() {
    return skillCapsules;
  }

  protected getIdColumn() {
    return skillCapsules.id;
  }

  override async create(capsule: InsertSkillCapsule): Promise<SkillCapsule> {
    const [created] = await this.db.insert(skillCapsules).values(capsule).returning();
    return created;
  }

  async getAll(): Promise<SkillCapsule[]> {
    return await this.db.select().from(skillCapsules).orderBy(sql`created_at DESC`);
  }

  override async update(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined> {
    const [updated] = await this.db
      .update(skillCapsules)
      .set(updates)
      .where(eq(skillCapsules.id, id))
      .returning();
    return updated;
  }

}

export class EvolutionStateRepository extends BaseRepository<EvolutionState, InsertEvolutionState> {
  constructor() {
    super('EvolutionStateRepository');
  }

  protected getTable() {
    return evolutionState;
  }

  protected getIdColumn() {
    return evolutionState.id;
  }

  async getSingleton(): Promise<EvolutionState | undefined> {
    const [state] = await this.db.select().from(evolutionState).where(eq(evolutionState.id, 'singleton'));
    if (!state) {
      const [newState] = await this.db.insert(evolutionState).values({ id: 'singleton' } as any).returning();
      return newState;
    }
    return state;
  }

  async updateSingleton(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined> {
    await this.getSingleton();
    const [updated] = await this.db
      .update(evolutionState)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(evolutionState.id, 'singleton'))
      .returning();
    return updated;
  }
}

export const intelItemRepository = new IntelItemRepository();
export const skillCapsuleRepository = new SkillCapsuleRepository();
export const evolutionStateRepository = new EvolutionStateRepository();
