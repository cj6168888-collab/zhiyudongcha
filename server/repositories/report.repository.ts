import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  dailyReports,
  type DailyReport, type InsertDailyReport
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ReportRepository');

export class DailyReportRepository extends BaseRepository<DailyReport, InsertDailyReport> {
  constructor() {
    super('DailyReport');
  }

  protected getTable() {
    return dailyReports;
  }

  protected getIdColumn() {
    return dailyReports.id;
  }

  async getRecent(limit: number = 30): Promise<DailyReport[]> {
    try {
      return await this.db.select().from(dailyReports)
        .orderBy(sql`report_date DESC`)
        .limit(limit);
    } catch (error) {
      logger.error({ err: error, limit }, 'getRecent failed');
      throw error;
    }
  }

  async getToday(): Promise<DailyReport | undefined> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [report] = await this.db.select().from(dailyReports)
        .where(sql`DATE(report_date) = DATE(${today})`);
      return report;
    } catch (error) {
      logger.error({ err: error }, 'getToday failed');
      throw error;
    }
  }
}

export const dailyReportRepository = new DailyReportRepository();
