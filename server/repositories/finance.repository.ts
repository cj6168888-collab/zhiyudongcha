import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  invoices, expenseReports,
  type Invoice, type InsertInvoice,
  type ExpenseReport, type InsertExpenseReport
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('FinanceRepository');

export class InvoiceRepository extends BaseRepository<Invoice, InsertInvoice> {
  constructor() {
    super('Invoice');
  }

  protected getTable() {
    return invoices;
  }

  protected getIdColumn() {
    return invoices.id;
  }

  async getAll(userId?: string, status?: string): Promise<Invoice[]> {
    try {
      if (userId && status) {
        return await this.db.select().from(invoices)
          .where(sql`${invoices.userId} = ${userId} AND ${invoices.status} = ${status}`)
          .orderBy(sql`created_at DESC`);
      } else if (userId) {
        return await this.db.select().from(invoices)
          .where(eq(invoices.userId, userId))
          .orderBy(sql`created_at DESC`);
      }
      return await this.db.select().from(invoices).orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, userId, status }, 'getAll failed');
      throw error;
    }
  }

  async getUnassigned(userId: string): Promise<Invoice[]> {
    try {
      return await this.db.select().from(invoices)
        .where(sql`${invoices.userId} = ${userId} AND ${invoices.expenseReportId} IS NULL`)
        .orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, userId }, 'getUnassigned failed');
      throw error;
    }
  }

  async getByExpenseReport(expenseReportId: string): Promise<Invoice[]> {
    try {
      return await this.db.select().from(invoices)
        .where(eq(invoices.expenseReportId, expenseReportId))
        .orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, expenseReportId }, 'getByExpenseReport failed');
      throw error;
    }
  }

  async clearExpenseReportLink(expenseReportId: string): Promise<void> {
    try {
      await this.db.update(invoices)
        .set({ expenseReportId: null })
        .where(eq(invoices.expenseReportId, expenseReportId));
    } catch (error) {
      logger.error({ err: error, expenseReportId }, 'clearExpenseReportLink failed');
      throw error;
    }
  }
}

export class ExpenseReportRepository extends BaseRepository<ExpenseReport, InsertExpenseReport> {
  constructor() {
    super('ExpenseReport');
  }

  protected getTable() {
    return expenseReports;
  }

  protected getIdColumn() {
    return expenseReports.id;
  }

  async getAll(userId?: string, status?: string): Promise<ExpenseReport[]> {
    try {
      if (userId && status) {
        return await this.db.select().from(expenseReports)
          .where(sql`${expenseReports.userId} = ${userId} AND ${expenseReports.status} = ${status}`)
          .orderBy(sql`created_at DESC`);
      } else if (userId) {
        return await this.db.select().from(expenseReports)
          .where(eq(expenseReports.userId, userId))
          .orderBy(sql`created_at DESC`);
      }
      return await this.db.select().from(expenseReports).orderBy(sql`created_at DESC`);
    } catch (error) {
      logger.error({ err: error, userId, status }, 'getAll failed');
      throw error;
    }
  }

  async getWithInvoices(id: string): Promise<{ report: ExpenseReport; invoices: Invoice[] } | undefined> {
    try {
      const [report] = await this.db.select().from(expenseReports).where(eq(expenseReports.id, id));
      if (!report) return undefined;
      
      const relatedInvoices = await this.db.select().from(invoices)
        .where(eq(invoices.expenseReportId, id))
        .orderBy(sql`created_at DESC`);
      
      return { report, invoices: relatedInvoices };
    } catch (error) {
      logger.error({ err: error, id }, 'getWithInvoices failed');
      throw error;
    }
  }

  async deleteWithCleanup(id: string): Promise<boolean> {
    try {
      await this.db.update(invoices)
        .set({ expenseReportId: null })
        .where(eq(invoices.expenseReportId, id));
      const result = await this.db.delete(expenseReports).where(eq(expenseReports.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error({ err: error, id }, 'deleteWithCleanup failed');
      throw error;
    }
  }
}

export const invoiceRepository = new InvoiceRepository();
export const expenseReportRepository = new ExpenseReportRepository();
