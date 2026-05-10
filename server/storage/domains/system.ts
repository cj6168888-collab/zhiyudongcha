import { auditLogRepository, expertDecisionRepository, evolutionEventRepository, dailyReportRepository, avatarChatHistoryRepository, avatarUserPreferencesRepository } from '../../repositories';
import type { AuditLog, ExpertDecision, EvolutionEvent, DailyReport, InsertAuditLog, InsertExpertDecision, InsertEvolutionEvent, InsertDailyReport, AvatarChatHistory, InsertAvatarChatHistory, AvatarUserPreferences, InsertAvatarUserPreferences } from '@shared/schema';

export interface ISystemStorage {
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  
  createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision>;
  getExpertDecisions(expertType?: string): Promise<ExpertDecision[]>;
  updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined>;
  
  createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent>;
  getEvolutionEvents(limit?: number): Promise<EvolutionEvent[]>;
  
  createDailyReport(report: InsertDailyReport): Promise<DailyReport>;
  getDailyReports(limit?: number): Promise<DailyReport[]>;
  getTodayReport(): Promise<DailyReport | undefined>;
  updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined>;
  
  // Avatar chat and preferences
  createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory>;
  getChatHistory(limit?: number): Promise<AvatarChatHistory[]>;
  getRecentChatContext(limit?: number): Promise<AvatarChatHistory[]>;
  updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined>;
  getMemorizedChats(): Promise<AvatarChatHistory[]>;
  getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined>;
  updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined>;
}

export class SystemStorage implements ISystemStorage {
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    return await auditLogRepository.create(log);
  }

  async getAuditLogs(limit?: number): Promise<AuditLog[]> {
    return await auditLogRepository.getRecent(limit || 100);
  }
  
  async createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision> {
    return await expertDecisionRepository.create(decision);
  }

  async getExpertDecisions(expertType?: string): Promise<ExpertDecision[]> {
    return await expertDecisionRepository.getByExpertType(expertType);
  }

  async updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined> {
    return await expertDecisionRepository.update(id, updates);
  }
  
  async createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent> {
    return await evolutionEventRepository.create(event);
  }

  async getEvolutionEvents(limit?: number): Promise<EvolutionEvent[]> {
    return await evolutionEventRepository.getRecent(limit || 50);
  }
  
  async createDailyReport(report: InsertDailyReport): Promise<DailyReport> {
    return await dailyReportRepository.create(report);
  }

  async getDailyReports(limit?: number): Promise<DailyReport[]> {
    return await dailyReportRepository.getRecent(limit || 30);
  }

  async getTodayReport(): Promise<DailyReport | undefined> {
    return await dailyReportRepository.getToday();
  }

  async updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined> {
    return await dailyReportRepository.update(id, updates);
  }

  // Avatar chat and preferences implementation
  async createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory> {
    return await avatarChatHistoryRepository.create(message);
  }

  async getChatHistory(limit?: number): Promise<AvatarChatHistory[]> {
    return await avatarChatHistoryRepository.getHistory(limit || 100);
  }

  async getRecentChatContext(limit?: number): Promise<AvatarChatHistory[]> {
    return await avatarChatHistoryRepository.getRecentContext(limit || 10);
  }

  async updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined> {
    return await avatarChatHistoryRepository.updateFeedback(id, feedback, note);
  }

  async getMemorizedChats(): Promise<AvatarChatHistory[]> {
    return await avatarChatHistoryRepository.getMemorized();
  }

  async getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined> {
    return await avatarUserPreferencesRepository.get();
  }

  async updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined> {
    return await avatarUserPreferencesRepository.upsert(updates);
  }
}

export const systemStorage = new SystemStorage();
