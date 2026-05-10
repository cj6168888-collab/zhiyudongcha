import { eq } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  teamMembers,
  type TeamMember, type InsertTeamMember
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('TeamRepository');

export class TeamMemberRepository extends BaseRepository<TeamMember, InsertTeamMember> {
  constructor() {
    super('TeamMember');
  }

  protected getTable() {
    return teamMembers;
  }

  protected getIdColumn() {
    return teamMembers.id;
  }

  async getAll(isActive?: boolean): Promise<TeamMember[]> {
    try {
      if (isActive !== undefined) {
        return await this.db.select().from(teamMembers).where(eq(teamMembers.isActive, isActive));
      }
      return await this.db.select().from(teamMembers);
    } catch (error) {
      logger.error({ err: error, isActive }, 'getAll failed');
      throw error;
    }
  }

  async getActive(): Promise<TeamMember[]> {
    try {
      return await this.db.select().from(teamMembers).where(eq(teamMembers.isActive, true));
    } catch (error) {
      logger.error({ err: error }, 'getActive failed');
      throw error;
    }
  }
}

export const teamMemberRepository = new TeamMemberRepository();
