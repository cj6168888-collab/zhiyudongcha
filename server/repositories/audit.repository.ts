import { eq, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  auditLogs,
  expertDecisions,
  evolutionEvents,
  killSwitchLogs,
  loyaltyEvents,
  type AuditLog,
  type InsertAuditLog,
  type ExpertDecision,
  type InsertExpertDecision,
  type EvolutionEvent,
  type InsertEvolutionEvent,
  type KillSwitchLog,
  type InsertKillSwitchLog,
  type LoyaltyEvent,
  type InsertLoyaltyEvent
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('AuditRepository');

export class AuditLogRepository extends BaseRepository<AuditLog, InsertAuditLog> {
  constructor() {
    super('AuditLogRepository');
  }

  protected getTable() {
    return auditLogs;
  }

  protected getIdColumn() {
    return auditLogs.id;
  }

  async getRecent(limit: number = 100): Promise<AuditLog[]> {
    return await this.db.select().from(auditLogs)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }
}

export class ExpertDecisionRepository extends BaseRepository<ExpertDecision, InsertExpertDecision> {
  constructor() {
    super('ExpertDecisionRepository');
  }

  protected getTable() {
    return expertDecisions;
  }

  protected getIdColumn() {
    return expertDecisions.id;
  }

  async getByExpertType(expertType?: string): Promise<ExpertDecision[]> {
    if (expertType) {
      return await this.db.select().from(expertDecisions).where(eq(expertDecisions.expertType, expertType));
    }
    return await this.db.select().from(expertDecisions);
  }
}

export class EvolutionEventRepository extends BaseRepository<EvolutionEvent, InsertEvolutionEvent> {
  constructor() {
    super('EvolutionEventRepository');
  }

  protected getTable() {
    return evolutionEvents;
  }

  protected getIdColumn() {
    return evolutionEvents.id;
  }

  async getRecent(limit: number = 50): Promise<EvolutionEvent[]> {
    return await this.db.select().from(evolutionEvents)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }
}

export class KillSwitchLogRepository extends BaseRepository<KillSwitchLog, InsertKillSwitchLog> {
  constructor() {
    super('KillSwitchLogRepository');
  }

  protected getTable() {
    return killSwitchLogs;
  }

  protected getIdColumn() {
    return killSwitchLogs.id;
  }

  async getRecent(limit?: number): Promise<KillSwitchLog[]> {
    let query = this.db.select().from(killSwitchLogs).orderBy(sql`triggered_at DESC`);
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }
}

export class LoyaltyEventRepository extends BaseRepository<LoyaltyEvent, InsertLoyaltyEvent> {
  constructor() {
    super('LoyaltyEventRepository');
  }

  protected getTable() {
    return loyaltyEvents;
  }

  protected getIdColumn() {
    return loyaltyEvents.id;
  }

  async getByMemberId(memberId: string): Promise<LoyaltyEvent[]> {
    return await this.db.select().from(loyaltyEvents)
      .where(eq(loyaltyEvents.memberId, memberId));
  }

  async getAllByStatus(status?: string): Promise<LoyaltyEvent[]> {
    if (status) {
      return await this.db.select().from(loyaltyEvents).where(eq(loyaltyEvents.status, status));
    }
    return await this.db.select().from(loyaltyEvents);
  }
}

export const auditLogRepository = new AuditLogRepository();
export const expertDecisionRepository = new ExpertDecisionRepository();
export const evolutionEventRepository = new EvolutionEventRepository();
export const killSwitchLogRepository = new KillSwitchLogRepository();
export const loyaltyEventRepository = new LoyaltyEventRepository();
