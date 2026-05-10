import { eq, sql, or } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { persons, type Person, type InsertPerson } from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('PersonRepository');

export interface RelationshipInsight {
  person: Person;
  vulnerabilityAnalysis: string;
  interestChainSummary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedApproach: string;
}

export class PersonRepository extends BaseRepository<Person, InsertPerson> {
  constructor() {
    super('PersonRepository');
  }

  protected getTable() {
    return persons;
  }

  protected getIdColumn() {
    return persons.id;
  }

  async getAllByAccessLevel(accessLevel?: string): Promise<Person[]> {
    if (accessLevel) {
      return await this.db.select().from(persons).where(eq(persons.accessLevel, accessLevel));
    }
    return await this.db.select().from(persons);
  }

  async searchByWeakness(keyword: string): Promise<Person[]> {
    return await this.db.select().from(persons).where(
      sql`${persons.weakness} ILIKE ${`%${keyword}%`}`
    );
  }

  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await this.db.select().from(persons).where(
      or(
        sql`${persons.connectionNodes} @> ARRAY[${personId}]::text[]`,
        sql`${persons.conflictPoints} IS NOT NULL AND array_length(${persons.conflictPoints}, 1) > 0`
      )
    );
  }

  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    const results = await this.db.select().from(persons).where(
      sql`${persons.name} ILIKE ${`%${personName}%`}`
    ).limit(1);
    
    const person = results[0];
    if (!person) return null;

    const interestChain = person.interestChain as Record<string, unknown> | null;
    const interestSummary = interestChain 
      ? Object.entries(interestChain).map(([k, v]) => `${k}: ${v}`).join(', ')
      : '无已知利益关联';

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = person.weakness 
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

  async getByApprovalStatus(status: string): Promise<Person[]> {
    return await this.db.select().from(persons).where(eq(persons.approvalStatus, status));
  }

  async searchByName(name: string): Promise<Person[]> {
    return await this.db.select().from(persons).where(
      sql`${persons.name} ILIKE ${`%${name}%`}`
    );
  }

  async getByOrganization(organization: string): Promise<Person[]> {
    return await this.db.select().from(persons).where(eq(persons.organization, organization));
  }

  async updateBondStrength(id: string, strength: number): Promise<Person | undefined> {
    return await this.update(id, { bondStrength: strength } as Partial<InsertPerson>);
  }

  async updateLastInteraction(id: string): Promise<Person | undefined> {
    return await this.update(id, { lastInteraction: new Date() } as Partial<InsertPerson>);
  }
}

export const personRepository = new PersonRepository();
