import { eq, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  talkSessions,
  conversationSegments,
  extractedEntities,
  opportunitySignals,
  inspirations,
  insightsProcessing,
  type TalkSession,
  type InsertTalkSession,
  type ConversationSegment,
  type InsertConversationSegment,
  type ExtractedEntity,
  type InsertExtractedEntity,
  type OpportunitySignal,
  type InsertOpportunitySignal,
  type Inspiration,
  type InsertInspiration,
  type InsightsProcessing,
  type InsertInsightsProcessing
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('InsightRepository');

export class TalkSessionRepository extends BaseRepository<TalkSession, InsertTalkSession> {
  constructor() {
    super('TalkSessionRepository');
  }

  protected getTable() {
    return talkSessions;
  }

  protected getIdColumn() {
    return talkSessions.id;
  }

  async getRecent(limit: number = 50): Promise<TalkSession[]> {
    return await this.db.select().from(talkSessions)
      .orderBy(sql`started_at DESC`)
      .limit(limit);
  }
}

export class ConversationSegmentRepository extends BaseRepository<ConversationSegment, InsertConversationSegment> {
  constructor() {
    super('ConversationSegmentRepository');
  }

  protected getTable() {
    return conversationSegments;
  }

  protected getIdColumn() {
    return conversationSegments.id;
  }

  async getBySessionId(sessionId: string): Promise<ConversationSegment[]> {
    return await this.db.select().from(conversationSegments)
      .where(eq(conversationSegments.sessionId, sessionId))
      .orderBy(sql`timestamp ASC`);
  }
}

export class ExtractedEntityRepository extends BaseRepository<ExtractedEntity, InsertExtractedEntity> {
  constructor() {
    super('ExtractedEntityRepository');
  }

  protected getTable() {
    return extractedEntities;
  }

  protected getIdColumn() {
    return extractedEntities.id;
  }

  async getBySessionId(sessionId: string): Promise<ExtractedEntity[]> {
    return await this.db.select().from(extractedEntities)
      .where(eq(extractedEntities.sessionId, sessionId));
  }
}

export class OpportunitySignalRepository extends BaseRepository<OpportunitySignal, InsertOpportunitySignal> {
  constructor() {
    super('OpportunitySignalRepository');
  }

  protected getTable() {
    return opportunitySignals;
  }

  protected getIdColumn() {
    return opportunitySignals.id;
  }

  async getBySessionId(sessionId: string): Promise<OpportunitySignal[]> {
    return await this.db.select().from(opportunitySignals)
      .where(eq(opportunitySignals.sessionId, sessionId));
  }
}

export class InspirationRepository extends BaseRepository<Inspiration, InsertInspiration> {
  constructor() {
    super('InspirationRepository');
  }

  protected getTable() {
    return inspirations;
  }

  protected getIdColumn() {
    return inspirations.id;
  }

  async getAllFiltered(source?: string, status?: string): Promise<Inspiration[]> {
    let query = this.db.select().from(inspirations);
    
    if (source && status) {
      return await query.where(sql`${inspirations.source} = ${source} AND ${inspirations.status} = ${status}`)
        .orderBy(sql`created_at DESC`);
    } else if (source) {
      return await query.where(eq(inspirations.source, source)).orderBy(sql`created_at DESC`);
    } else if (status) {
      return await query.where(eq(inspirations.status, status)).orderBy(sql`created_at DESC`);
    }
    return await query.orderBy(sql`created_at DESC`);
  }

  async getActive(): Promise<Inspiration[]> {
    return await this.db.select().from(inspirations)
      .where(sql`${inspirations.status} IN ('new', 'pending', 'in_progress')`)
      .orderBy(sql`created_at DESC`);
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertInspiration>): Promise<Inspiration | undefined> {
    const results = await this.db.update(inspirations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inspirations.id, id))
      .returning();
    return results[0];
  }
}

export class InsightsProcessingRepository extends BaseRepository<InsightsProcessing, InsertInsightsProcessing> {
  constructor() {
    super('InsightsProcessingRepository');
  }

  protected getTable() {
    return insightsProcessing;
  }

  protected getIdColumn() {
    return insightsProcessing.id;
  }

  async getBySessionId(sessionId: string): Promise<InsightsProcessing | undefined> {
    const results = await this.db.select().from(insightsProcessing)
      .where(eq(insightsProcessing.sessionId, sessionId))
      .limit(1);
    return results[0];
  }

  async getActive(): Promise<InsightsProcessing[]> {
    return await this.db.select().from(insightsProcessing)
      .where(sql`${insightsProcessing.status} NOT IN ('COMPLETE', 'FAILED')`)
      .orderBy(sql`started_at DESC`);
  }
}

export const talkSessionRepository = new TalkSessionRepository();
export const conversationSegmentRepository = new ConversationSegmentRepository();
export const extractedEntityRepository = new ExtractedEntityRepository();
export const opportunitySignalRepository = new OpportunitySignalRepository();
export const inspirationRepository = new InspirationRepository();
export const insightsProcessingRepository = new InsightsProcessingRepository();
