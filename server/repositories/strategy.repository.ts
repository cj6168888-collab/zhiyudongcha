import { eq, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  battleReports,
  opportunities,
  refinementRuns,
  strategyProposals,
  alignmentSignals,
  type BattleReport,
  type InsertBattleReport,
  type Opportunity,
  type InsertOpportunity,
  type RefinementRun,
  type InsertRefinementRun,
  type StrategyProposal,
  type InsertStrategyProposal,
  type AlignmentSignal,
  type InsertAlignmentSignal
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('StrategyRepository');

export class BattleReportRepository extends BaseRepository<BattleReport, InsertBattleReport> {
  constructor() {
    super('BattleReportRepository');
  }

  protected getTable() {
    return battleReports;
  }

  protected getIdColumn() {
    return battleReports.id;
  }

  async getRecent(limit?: number): Promise<BattleReport[]> {
    let query = this.db.select().from(battleReports).orderBy(desc(battleReports.createdAt));
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }
}

export class OpportunityRepository extends BaseRepository<Opportunity, InsertOpportunity> {
  constructor() {
    super('OpportunityRepository');
  }

  protected getTable() {
    return opportunities;
  }

  protected getIdColumn() {
    return opportunities.id;
  }

  async getAllByStatus(status?: string): Promise<Opportunity[]> {
    if (status) {
      return await this.db.select().from(opportunities)
        .where(eq(opportunities.status, status))
        .orderBy(sql`created_at DESC`);
    }
    return await this.db.select().from(opportunities).orderBy(sql`created_at DESC`);
  }

  async getActive(): Promise<Opportunity[]> {
    return await this.db.select().from(opportunities)
      .where(sql`${opportunities.status} IN ('new', 'qualified', 'in_progress')`)
      .orderBy(sql`created_at DESC`);
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const results = await this.db.update(opportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return results[0];
  }
}

export class RefinementRunRepository extends BaseRepository<RefinementRun, InsertRefinementRun> {
  constructor() {
    super('RefinementRunRepository');
  }

  protected getTable() {
    return refinementRuns;
  }

  protected getIdColumn() {
    return refinementRuns.id;
  }

  async getByOpportunityId(opportunityId: string): Promise<RefinementRun[]> {
    return await this.db.select().from(refinementRuns)
      .where(eq(refinementRuns.opportunityId, opportunityId))
      .orderBy(sql`created_at DESC`);
  }

  async getActive(): Promise<RefinementRun[]> {
    return await this.db.select().from(refinementRuns)
      .where(eq(refinementRuns.status, 'running'));
  }
}

export class StrategyProposalRepository extends BaseRepository<StrategyProposal, InsertStrategyProposal> {
  constructor() {
    super('StrategyProposalRepository');
  }

  protected getTable() {
    return strategyProposals;
  }

  protected getIdColumn() {
    return strategyProposals.id;
  }

  async getByOpportunityId(opportunityId: string): Promise<StrategyProposal[]> {
    return await this.db.select().from(strategyProposals)
      .where(eq(strategyProposals.opportunityId, opportunityId))
      .orderBy(sql`created_at DESC`);
  }

  async getPending(): Promise<StrategyProposal[]> {
    return await this.db.select().from(strategyProposals)
      .where(eq(strategyProposals.status, 'pending'))
      .orderBy(sql`created_at DESC`);
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertStrategyProposal>): Promise<StrategyProposal | undefined> {
    const results = await this.db.update(strategyProposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategyProposals.id, id))
      .returning();
    return results[0];
  }
}

export class AlignmentSignalRepository extends BaseRepository<AlignmentSignal, InsertAlignmentSignal> {
  constructor() {
    super('AlignmentSignalRepository');
  }

  protected getTable() {
    return alignmentSignals;
  }

  protected getIdColumn() {
    return alignmentSignals.id;
  }

  async getAllByProcessedStatus(processedForTraining?: boolean): Promise<AlignmentSignal[]> {
    if (processedForTraining !== undefined) {
      return await this.db.select().from(alignmentSignals)
        .where(sql`${alignmentSignals.processedForTraining} = ${processedForTraining ? 1 : 0}`)
        .orderBy(sql`created_at DESC`);
    }
    return await this.db.select().from(alignmentSignals).orderBy(sql`created_at DESC`);
  }

  async getUnprocessed(): Promise<AlignmentSignal[]> {
    return await this.db.select().from(alignmentSignals)
      .where(sql`${alignmentSignals.processedForTraining} = 0 OR ${alignmentSignals.processedForTraining} IS NULL`)
      .orderBy(sql`created_at DESC`);
  }
}

export const battleReportRepository = new BattleReportRepository();
export const opportunityRepository = new OpportunityRepository();
export const refinementRunRepository = new RefinementRunRepository();
export const strategyProposalRepository = new StrategyProposalRepository();
export const alignmentSignalRepository = new AlignmentSignalRepository();
