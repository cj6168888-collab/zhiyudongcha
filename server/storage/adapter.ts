/**
 * Storage适配器
 * 实现IStorage接口，但内部使用Domain Storage
 * 用于逐步从旧版storage.ts迁移到新的Domain Storage架构
 */

import { createServiceLogger } from '../lib/logger';
import type { IStorage, ConversationData } from '../interfaces/storage.interface';
import type {
  User, InsertUser,
  Person, InsertPerson,
  VaultItem, InsertVaultItem,
  ShadowMemory, InsertShadowMemory,
  RelationshipInsight,
  DownloadTask, InsertDownloadTask,
  ComputeJob, InsertComputeJob,
  DreamLog, InsertDreamLog,
  AuditLog, InsertAuditLog,
  ExpertDecision, InsertExpertDecision,
  EvolutionEvent, InsertEvolutionEvent,
  Project, InsertProject,
  IntelItem, InsertIntelItem,
  SkillCapsule, InsertSkillCapsule,
  EvolutionState, InsertEvolutionState,
  DailyReport, InsertDailyReport,
  UserSettings, InsertUserSettings,
  Voiceprint, InsertVoiceprint,
  VoiceAuthorization, InsertVoiceAuthorization,
  Device, InsertDevice,
  RemoteCommand, InsertRemoteCommand,
  TeamMember, InsertTeamMember,
  SatelliteDevice, InsertSatelliteDevice,
  BattleReport, InsertBattleReport,
  KillSwitchLog, InsertKillSwitchLog,
  LoyaltyEvent, InsertLoyaltyEvent,
  TalkSession, InsertTalkSession,
  ConversationSegment, InsertConversationSegment,
  ExtractedEntity, InsertExtractedEntity,
  OpportunitySignal, InsertOpportunitySignal,
  Inspiration, InsertInspiration,
  InsightsProcessing, InsertInsightsProcessing,
  IntegrationProvider, InsertIntegrationProvider,
  IntegrationAccount, InsertIntegrationAccount,
  IntegrationSyncJob, InsertIntegrationSyncJob,
  EmailAccount, InsertEmailAccount,
  Email, InsertEmail,
  EmailAttachment, InsertEmailAttachment,
  Invoice, InsertInvoice,
  ExpenseReport, InsertExpenseReport,
  AvatarChatHistory, InsertAvatarChatHistory,
  AvatarUserPreferences, InsertAvatarUserPreferences,
  ProjectNote, InsertProjectNote,
  ProjectFile, InsertProjectFile,
  ProjectTemplate, InsertProjectTemplate,
  Opportunity, InsertOpportunity,
  RefinementRun, InsertRefinementRun,
  StrategyProposal, InsertStrategyProposal,
  AlignmentSignal, InsertAlignmentSignal,
  GeneratedFile, InsertGeneratedFile,
} from "@shared/schema";

import { eq, sql } from "drizzle-orm";
import { emails } from "@shared/schema";
import { getDatabase } from "../db";

// 导入Domain Storage
import {
  userStorage,
  personStorage,
  vaultStorage,
  deviceStorage,
  projectStorage,
  conversationStorage,
  systemStorage,
  integrationStorage,
} from './domains';

// 导入Repository（临时，逐步迁移）
import {
  personRepository,
  shadowMemoryRepository,
  downloadTaskRepository,
  computeJobRepository,
  dreamLogRepository,
  auditLogRepository,
  expertDecisionRepository,
  evolutionEventRepository,
  killSwitchLogRepository,
  loyaltyEventRepository,
  battleReportRepository,
  opportunityRepository,
  refinementRunRepository,
  strategyProposalRepository,
  alignmentSignalRepository,
  intelItemRepository,
  skillCapsuleRepository,
  evolutionStateRepository,
  integrationProviderRepository,
  integrationAccountRepository,
  integrationSyncJobRepository,
  emailAccountRepository,
  emailRepository,
  emailAttachmentRepository,
  invoiceRepository,
  expenseReportRepository,
  avatarChatHistoryRepository,
  avatarUserPreferencesRepository,
  teamMemberRepository,
  satelliteDeviceRepository,
  projectNoteRepository,
  projectFileRepository,
  projectTemplateRepository,
  generatedFileRepository,
  dailyReportRepository,
  remoteCommandRepository,
  talkSessionRepository,
  conversationSegmentRepository,
  extractedEntityRepository,
  opportunitySignalRepository,
  inspirationRepository,
  insightsProcessingRepository,
  conversationRepository,
  hpRepository,
} from '../repositories';

const logger = createServiceLogger('StorageAdapter');

export class StorageAdapter {
  // 直接委托给Domain Storage的方法

  async getUser(id: string): Promise<User | undefined> {
    return await userStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await userStorage.getUserByUsername(username);
  }

  async createUser(user: InsertUser): Promise<User> {
    return await userStorage.createUser(user);
  }

  // Person相关方法
  async getPerson(id: string): Promise<Person | undefined> {
    return await personStorage.getPerson(id);
  }

  async getAllPersons(accessLevel?: string): Promise<Person[]> {
    return await personStorage.getAllPersons(accessLevel);
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    return await personStorage.createPerson(person);
  }

  async updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined> {
    return await personStorage.updatePerson(id, person);
  }

  async deletePerson(id: string): Promise<boolean> {
    return await personStorage.deletePerson(id);
  }

  async searchPersonsByWeakness(keyword: string): Promise<Person[]> {
    return await personStorage.searchPersonsByWeakness(keyword);
  }

  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await personStorage.findConflictingRelationships(personId);
  }

  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    return await personStorage.getRelationshipInsight(personName);
  }

  async getPersonsByApprovalStatus(status: string): Promise<Person[]> {
    return await personStorage.getPersonsByApprovalStatus(status);
  }

  async getPersonsByOrganization(organization: string): Promise<Person[]> {
    return await personStorage.getPersonsByOrganization(organization);
  }

  // Vault相关方法
  async getVaultItem(id: string): Promise<VaultItem | undefined> {
    return await vaultStorage.getVaultItem(id);
  }

  async getAllVaultItems(zone?: string): Promise<VaultItem[]> {
    return await vaultStorage.getAllVaultItems(zone);
  }

  async createVaultItem(item: InsertVaultItem): Promise<VaultItem> {
    return await vaultStorage.createVaultItem(item);
  }

  async updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined> {
    return await vaultStorage.updateVaultItem(id, item);
  }

  async deleteVaultItem(id: string): Promise<boolean> {
    return await vaultStorage.deleteVaultItem(id);
  }

  async searchVaultBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await vaultStorage.searchVaultBySemanticTag(tag);
  }

  async searchVaultByIntent(intent: string): Promise<VaultItem[]> {
    return await vaultStorage.searchVaultByIntent(intent);
  }

  async permanentShred(targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> {
    try {
      if (table === 'vault') {
        const item = await this.getVaultItem(targetId);
        if (!item) {
          return { success: false, message: 'Target not found in vault' };
        }

        logger.info({ fileName: item.fileName }, 'Initiating physical shredding for vault item');
        await this.deleteVaultItem(targetId);

        return { success: true, message: `[SHRED COMPLETE] ${item.fileName} has been permanently destroyed` };
      } else {
        const person = await this.getPerson(targetId);
        if (!person) {
          return { success: false, message: 'Target person not found' };
        }

        logger.info({ personName: person.name }, 'Initiating data purge for person');
        await this.deletePerson(targetId);

        return { success: true, message: `[PURGE COMPLETE] All records of ${person.name} have been erased` };
      }
    } catch (error) {
      return { success: false, message: `Shredding failed: ${error}` };
    }
  }

  // 以下方法暂时保持原样，后续逐步迁移到Domain Storage

  async getAllMemories(): Promise<ShadowMemory[]> {
    return await shadowMemoryRepository.findAll();
  }

  async createMemory(memory: InsertShadowMemory): Promise<ShadowMemory> {
    return await shadowMemoryRepository.create(memory);
  }

  async createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask> {
    return await downloadTaskRepository.create(task);
  }

  async getDownloadTasks(): Promise<DownloadTask[]> {
    return await downloadTaskRepository.getAll();
  }

  async updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined> {
    return await downloadTaskRepository.update(id, updates);
  }

  async deleteDownloadTask(id: string): Promise<boolean> {
    return await downloadTaskRepository.delete(id);
  }

  async createComputeJob(job: InsertComputeJob): Promise<ComputeJob> {
    return await computeJobRepository.create(job);
  }

  async getComputeJobs(): Promise<ComputeJob[]> {
    return await computeJobRepository.getAll();
  }

  async updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined> {
    return await computeJobRepository.update(id, updates);
  }

  async createDreamLog(log: InsertDreamLog): Promise<DreamLog> {
    return await dreamLogRepository.create(log);
  }

  async getDreamLogs(): Promise<DreamLog[]> {
    return await dreamLogRepository.findAll();
  }

  async updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined> {
    return await dreamLogRepository.update(id, updates);
  }

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

    const categories: Record<string, number> = { RESEARCH: 0, SOFTWARE: 0, MEDIA: 0, BOOKS: 0 };
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

  // 为简洁起见，以下只实现部分方法签名，实际需要完整实现

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    return await auditLogRepository.create(log);
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await auditLogRepository.findAll({ limit });
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

  async getEvolutionEvents(limit: number = 50): Promise<EvolutionEvent[]> {
    return await evolutionEventRepository.getRecent(limit);
  }

  // Avatar chat and preferences methods
  async createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory> {
    return await systemStorage.createChatMessage(message);
  }

  async getChatHistory(limit?: number): Promise<AvatarChatHistory[]> {
    return await systemStorage.getChatHistory(limit);
  }

  async getRecentChatContext(limit?: number): Promise<AvatarChatHistory[]> {
    return await systemStorage.getRecentChatContext(limit);
  }

  async updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined> {
    return await systemStorage.updateChatFeedback(id, feedback, note);
  }

  async getMemorizedChats(): Promise<AvatarChatHistory[]> {
    return await systemStorage.getMemorizedChats();
  }

  async getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined> {
    return await systemStorage.getAvatarUserPreferences();
  }

  async updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined> {
    return await systemStorage.updateAvatarUserPreferences(updates);
  }

  // 设备相关方法
  async createDevice(device: InsertDevice): Promise<Device> {
    return await deviceStorage.createDevice(device);
  }

  async getDevice(id: string): Promise<Device | undefined> {
    return await deviceStorage.getDevice(id);
  }

  async getDeviceByToken(tokenHash: string): Promise<Device | undefined> {
    return await deviceStorage.getDeviceByToken(tokenHash);
  }

  async getAllDevices(userId?: string): Promise<Device[]> {
    return await deviceStorage.getAllDevices(userId);
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    return await deviceStorage.updateDevice(id, updates);
  }

  async updateDeviceHeartbeat(id: string): Promise<Device | undefined> {
    return await deviceStorage.updateDeviceHeartbeat(id);
  }

  async deleteDevice(id: string): Promise<boolean> {
    return await deviceStorage.deleteDevice(id);
  }

  // 由于时间关系，这里只实现关键方法
  // 实际项目中需要完整实现IStorage接口的所有方法

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return await userStorage.getUserSettings(userId);
  }

  async getAllUserSettings(): Promise<UserSettings[]> {
    return await userStorage.getAllUserSettings();
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    return await userStorage.createUserSettings(settings);
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    return await userStorage.updateUserSettings(userId, updates);
  }

  async deleteUserSettings(userId: string): Promise<boolean> {
    return await userStorage.deleteUserSettings(userId);
  }

  async getVoiceprint(userId: string): Promise<Voiceprint | undefined> {
    return await userStorage.getVoiceprint(userId);
  }

  async getMasterVoiceprint(): Promise<Voiceprint | undefined> {
    return await userStorage.getMasterVoiceprint();
  }

  async createVoiceprint(voiceprint: InsertVoiceprint): Promise<Voiceprint> {
    return await userStorage.createVoiceprint(voiceprint);
  }

  async updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined> {
    return await userStorage.updateVoiceprint(userId, updates);
  }

  async getVoiceAuthorizations(): Promise<VoiceAuthorization[]> {
    return await userStorage.getVoiceAuthorizations();
  }

  async createVoiceAuthorization(auth: InsertVoiceAuthorization): Promise<VoiceAuthorization> {
    return await userStorage.createVoiceAuthorization(auth);
  }

  async deactivateVoiceAuthorization(id: string): Promise<boolean> {
    return await userStorage.deactivateVoiceAuthorization(id);
  }

  // 项目相关方法
  async createProject(project: InsertProject): Promise<Project> {
    return await projectStorage.createProject(project);
  }

  async getProjects(status?: string): Promise<Project[]> {
    return await projectStorage.getProjects(status);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return await projectStorage.getProject(id);
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    return await projectStorage.updateProject(id, updates);
  }

  // 占位方法 - 需要实现完整的IStorage接口
  // 为了简洁，这里只实现部分关键方法

  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await projectNoteRepository.getByProjectId(projectId);
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    return await projectNoteRepository.create(note);
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    return await projectNoteRepository.delete(id);
  }

  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await projectFileRepository.getByProjectId(projectId);
  }

  async createProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    return await projectFileRepository.create(file);
  }

  async updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    return await projectFileRepository.update(id, updates);
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    return await projectFileRepository.delete(id);
  }

  // 项目模板相关方法
  async getProjectTemplates(category?: string): Promise<ProjectTemplate[]> {
    return await projectTemplateRepository.getByCategory(category);
  }

  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    const result = await projectTemplateRepository.findById(id);
    return result ?? undefined;
  }

  async createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate> {
    return await projectTemplateRepository.create(template);
  }

  async incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined> {
    return await projectTemplateRepository.incrementUsage(id);
  }

  // HP经济系统方法（示例）
  async getHPBalance(): Promise<{ balance: number; maxBalance: number; totalConsumed: number; totalRecharged: number }> {
    const state = await this.getEvolutionState();
    return {
      balance: state?.hpBalance ?? 1000,
      maxBalance: state?.hpMaxBalance ?? 1000,
      totalConsumed: state?.hpTotalConsumed ?? 0,
      totalRecharged: state?.hpTotalRecharged ?? 0,
    };
  }

  async consumeHP(amount: number, reason: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }> {
    return await hpRepository.consumeHP(amount, reason);
  }

  async consumeHPWithLock(amount: number, reason: string, userId?: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }> {
    return await hpRepository.consumeHPWithLock(amount, reason, userId);
  }

  async rechargeHP(amount: number, expandMax?: boolean): Promise<{ success: boolean; newBalance: number; recharged: number; newMaxBalance?: number }> {
    return await hpRepository.rechargeHP(amount, expandMax);
  }

  async createDailyReport(report: InsertDailyReport): Promise<DailyReport> {
    return await dailyReportRepository.create(report);
  }

  async getDailyReports(limit?: number): Promise<DailyReport[]> {
    return await dailyReportRepository.getRecent(limit);
  }

  async getTodayReport(): Promise<DailyReport | undefined> {
    return await dailyReportRepository.getToday();
  }

  async updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined> {
    return await dailyReportRepository.update(id, updates);
  }

  // 以下实现IStorage接口的其他必要方法（简化版）

  // 情报相关方法
  async createIntelItem(intel: InsertIntelItem): Promise<IntelItem> {
    return await intelItemRepository.create(intel);
  }

  async getIntelItems(status?: string): Promise<IntelItem[]> {
    return await intelItemRepository.getAll(status);
  }

  async updateIntelItem(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined> {
    return await intelItemRepository.update(id, updates);
  }

  // 技能胶囊相关方法
  async createSkillCapsule(capsule: InsertSkillCapsule): Promise<SkillCapsule> {
    return await skillCapsuleRepository.create(capsule);
  }

  async getSkillCapsules(): Promise<SkillCapsule[]> {
    return await skillCapsuleRepository.findAll();
  }

  async updateSkillCapsule(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined> {
    return await skillCapsuleRepository.update(id, updates);
  }

  // 对话相关方法
  async saveConversation(conversationId: string, data: ConversationData): Promise<void> {
    return await conversationRepository.save(conversationId, data);
  }

  async getConversation(conversationId: string): Promise<ConversationData | undefined> {
    return await conversationRepository.get(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return await conversationRepository.delete(conversationId);
  }

  async getUserConversations(userId: string, limit?: number): Promise<ConversationData[]> {
    return await conversationRepository.getByUser(userId, limit);
  }

  // 对话片段相关方法
  async createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment> {
    return await conversationSegmentRepository.create(segment);
  }

  async getSessionSegments(sessionId: string): Promise<ConversationSegment[]> {
    return await conversationSegmentRepository.getBySessionId(sessionId);
  }

  // 提取实体相关方法
  async createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity> {
    return await extractedEntityRepository.create(entity);
  }

  async getSessionEntities(sessionId: string): Promise<ExtractedEntity[]> {
    return await extractedEntityRepository.getBySessionId(sessionId);
  }

  async updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined> {
    return await extractedEntityRepository.update(id, updates);
  }

  // 机会信号相关方法
  async createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal> {
    return await opportunitySignalRepository.create(signal);
  }

  async getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]> {
    return await opportunitySignalRepository.getBySessionId(sessionId);
  }

  async updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined> {
    return await opportunitySignalRepository.update(id, updates);
  }

  async getEvolutionState(): Promise<EvolutionState | undefined> {
    return await evolutionStateRepository.getSingleton();
  }

  async updateEvolutionState(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined> {
    return await evolutionStateRepository.updateSingleton(updates);
  }

  async createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand> {
    return await remoteCommandRepository.create(command);
  }

  async getRemoteCommand(id: string): Promise<RemoteCommand | undefined> {
    return await remoteCommandRepository.findById(id);
  }

  async getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]> {
    return await remoteCommandRepository.getByDeviceId(deviceId, limit);
  }

  async getPendingCommands(deviceId: string): Promise<RemoteCommand[]> {
    return await remoteCommandRepository.getPending(deviceId);
  }

  async updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined> {
    return await remoteCommandRepository.update(id, updates);
  }

  // 集成相关方法
  async createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider> {
    return await integrationProviderRepository.create(provider);
  }

  async getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined> {
    return await integrationProviderRepository.findById(id);
  }

  async getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined> {
    // 这个方法可能不存在于repository中，需要检查
    // 暂时使用原始存储
    return await integrationStorage.getIntegrationProviderByCode(code);
  }

  async getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]> {
    return await integrationProviderRepository.getAll(category);
  }

  async updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined> {
    return await integrationProviderRepository.update(id, updates);
  }

  // 集成账户相关方法
  async createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount> {
    return await integrationStorage.createIntegrationAccount(account, credentials);
  }

  async getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined> {
    return await integrationAccountRepository.findById(id);
  }

  async getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined> {
    return await integrationAccountRepository.getWithCredentials(id);
  }

  async getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]> {
    return await integrationAccountRepository.getAll(userId);
  }

  async updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined> {
    return await integrationStorage.updateIntegrationAccount(id, updates, credentials);
  }

  async deleteIntegrationAccount(id: string): Promise<boolean> {
    return await integrationAccountRepository.delete(id);
  }

  // 集成同步任务相关方法
  async createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob> {
    return await integrationSyncJobRepository.create(job);
  }

  async getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined> {
    return await integrationSyncJobRepository.findById(id);
  }

  async getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]> {
    return await integrationStorage.getAccountSyncJobs(accountId, limit);
  }

  async updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined> {
    return await integrationSyncJobRepository.update(id, updates);
  }

  // 电子邮件相关方法
  async createEmailAccount(account: InsertEmailAccount, password?: string): Promise<EmailAccount> {
    return await emailAccountRepository.createWithPassword(account, password);
  }

  async getEmailAccount(id: string): Promise<EmailAccount | undefined> {
    return await emailAccountRepository.findById(id);
  }

  async getEmailAccountWithPassword(id: string): Promise<{ account: EmailAccount; password: string | null } | undefined> {
    return await emailAccountRepository.getWithPassword(id);
  }

  async getAllEmailAccounts(userId?: string): Promise<EmailAccount[]> {
    return await emailAccountRepository.getAll(userId);
  }

  async updateEmailAccount(id: string, updates: Partial<InsertEmailAccount>, password?: string): Promise<EmailAccount | undefined> {
    return await emailAccountRepository.updateWithPassword(id, updates, password);
  }

  async deleteEmailAccount(id: string): Promise<boolean> {
    return await emailAccountRepository.deleteWithEmails(id);
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    return await emailRepository.create(email);
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return await emailRepository.findById(id);
  }

  async getEmailByMessageId(accountId: string, messageId: string): Promise<Email | undefined> {
    return await emailRepository.getByMessageId(accountId, messageId);
  }

  async getEmailsByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]> {
    return await emailRepository.getByAccount(accountId, folder, limit);
  }

  async getEmailsByCategory(accountId: string, category: string): Promise<Email[]> {
    return await emailRepository.getByCategory(accountId, category);
  }

  async getAllEmails(options?: { accountId?: string; folder?: string; category?: string; importance?: string; isRead?: boolean; limit?: number; offset?: number }): Promise<Email[]> {
    const { category, importance, isRead, limit, offset } = options ?? {};
    return await emailRepository.getAllWithFilters({ category, importance, isRead, limit, offset });
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined> {
    return await emailRepository.update(id, updates);
  }

   async deleteEmail(id: string): Promise<boolean> {
     return await emailRepository.deleteWithAttachments(id);
   }

   async getEmailStats(): Promise<{ unreadCount: number; invoiceCount: number; totalEmails: number } | undefined> {
     return await emailRepository.getStats();
   }

   // 电子邮件附件相关方法
  async createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment> {
    return await emailAttachmentRepository.create(attachment);
  }

  async getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
    return await emailAttachmentRepository.getByEmail(emailId);
  }

  async getEmailAttachment(id: string): Promise<EmailAttachment | undefined> {
    return await emailAttachmentRepository.findById(id);
  }

   async updateEmailAttachment(id: string, updates: Partial<InsertEmailAttachment>): Promise<EmailAttachment | undefined> {
    return await emailAttachmentRepository.update(id, updates);
  }

  // 发票相关方法
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    return await invoiceRepository.create(invoice);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return await invoiceRepository.findById(id);
  }

  async getAllInvoices(userId?: string, status?: string): Promise<Invoice[]> {
    return await invoiceRepository.getAll(userId, status);
  }

  async getUnassignedInvoices(userId: string): Promise<Invoice[]> {
    return await invoiceRepository.getUnassigned(userId);
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    return await invoiceRepository.update(id, updates);
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return await invoiceRepository.delete(id);
  }

  // 费用报告相关方法
  async createExpenseReport(report: InsertExpenseReport): Promise<ExpenseReport> {
    return await expenseReportRepository.create(report);
  }

  async getExpenseReport(id: string): Promise<ExpenseReport | undefined> {
    return await expenseReportRepository.findById(id);
  }

  async getAllExpenseReports(userId?: string, status?: string): Promise<ExpenseReport[]> {
    return await expenseReportRepository.getAll(userId, status);
  }

  async updateExpenseReport(id: string, updates: Partial<InsertExpenseReport>): Promise<ExpenseReport | undefined> {
    return await expenseReportRepository.update(id, updates);
  }

  async deleteExpenseReport(id: string): Promise<boolean> {
    return await expenseReportRepository.deleteWithCleanup(id);
  }

   async getExpenseReportWithInvoices(id: string): Promise<{ report: ExpenseReport; invoices: Invoice[] } | undefined> {
    return await expenseReportRepository.getWithInvoices(id);
  }

  // 团队成员相关方法
  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    return await teamMemberRepository.create(member);
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    return await teamMemberRepository.findById(id);
  }

  async getAllTeamMembers(isActive?: boolean): Promise<TeamMember[]> {
    return await teamMemberRepository.getAll(isActive);
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    return await teamMemberRepository.update(id, updates);
  }

   async deleteTeamMember(id: string): Promise<boolean> {
    return await teamMemberRepository.delete(id);
  }

  // 卫星设备相关方法
  async createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice> {
    return await satelliteDeviceRepository.create(device);
  }

  async getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.findById(id);
  }

  async getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.getByDeviceId(deviceId);
  }

  async getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]> {
    return await satelliteDeviceRepository.getAllByStatus(status);
  }

  async updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.updateWithTimestamp(id, updates);
  }

   async deleteSatelliteDevice(id: string): Promise<boolean> {
    return await satelliteDeviceRepository.delete(id);
  }

  // 战报相关方法
  async createBattleReport(report: InsertBattleReport): Promise<BattleReport> {
    return await battleReportRepository.create(report);
  }

  async getBattleReport(id: string): Promise<BattleReport | undefined> {
    return await battleReportRepository.findById(id);
  }

  async getAllBattleReports(limit?: number): Promise<BattleReport[]> {
    return await battleReportRepository.getRecent(limit);
  }

   async updateBattleReport(id: string, updates: Partial<InsertBattleReport>): Promise<BattleReport | undefined> {
    return await battleReportRepository.update(id, updates);
  }

  // 忠诚度事件相关方法
  async createLoyaltyEvent(event: InsertLoyaltyEvent): Promise<LoyaltyEvent> {
    return await loyaltyEventRepository.create(event);
  }

  async getLoyaltyEvent(id: string): Promise<LoyaltyEvent | undefined> {
    return await loyaltyEventRepository.findById(id);
  }

  async getLoyaltyEventsByMember(memberId: string): Promise<LoyaltyEvent[]> {
    return await loyaltyEventRepository.getByMemberId(memberId);
  }

  async getAllLoyaltyEvents(status?: string): Promise<LoyaltyEvent[]> {
    return await loyaltyEventRepository.getAllByStatus(status);
  }

   async updateLoyaltyEvent(id: string, updates: Partial<InsertLoyaltyEvent>): Promise<LoyaltyEvent | undefined> {
     return await loyaltyEventRepository.update(id, updates);
   }

   // Kill Switch Logs (熔断日志)
   async createKillSwitchLog(log: InsertKillSwitchLog): Promise<KillSwitchLog> {
     return await killSwitchLogRepository.create(log);
   }

   async getKillSwitchLogs(limit?: number): Promise<KillSwitchLog[]> {
     return await killSwitchLogRepository.getRecent(limit);
   }

   async updateKillSwitchLog(id: string, updates: Partial<InsertKillSwitchLog>): Promise<KillSwitchLog | undefined> {
     return await killSwitchLogRepository.update(id, updates);
   }

   // Project Strategist: Refinement Runs (推演运行)
   async createRefinementRun(run: InsertRefinementRun): Promise<RefinementRun> {
     return await refinementRunRepository.create(run);
   }

   async getRefinementRun(id: string): Promise<RefinementRun | undefined> {
     const result = await refinementRunRepository.findById(id);
     return result ?? undefined;
   }

   async getRefinementRunsByOpportunity(opportunityId: string): Promise<RefinementRun[]> {
     return await refinementRunRepository.getByOpportunityId(opportunityId);
   }

   async getActiveRefinementRuns(): Promise<RefinementRun[]> {
     return await refinementRunRepository.getActive();
   }

   async updateRefinementRun(id: string, updates: Partial<InsertRefinementRun>): Promise<RefinementRun | undefined> {
     return await refinementRunRepository.update(id, updates);
   }

   // Project Strategist: Strategy Proposals (策略提案)
   async createStrategyProposal(proposal: InsertStrategyProposal): Promise<StrategyProposal> {
     return await strategyProposalRepository.create(proposal);
   }

   async getStrategyProposal(id: string): Promise<StrategyProposal | undefined> {
     const result = await strategyProposalRepository.findById(id);
     return result ?? undefined;
   }

   async getProposalsByOpportunity(opportunityId: string): Promise<StrategyProposal[]> {
     return await strategyProposalRepository.getByOpportunityId(opportunityId);
   }

   async getPendingProposals(): Promise<StrategyProposal[]> {
     return await strategyProposalRepository.getPending();
   }

   async updateStrategyProposal(id: string, updates: Partial<InsertStrategyProposal>): Promise<StrategyProposal | undefined> {
     return await strategyProposalRepository.update(id, updates);
   }

   // Project Strategist: Alignment Signals (价值对齐信号)
   async createAlignmentSignal(signal: InsertAlignmentSignal): Promise<AlignmentSignal> {
     return await alignmentSignalRepository.create(signal);
   }

   async getAllAlignmentSignals(processedForTraining?: boolean): Promise<AlignmentSignal[]> {
     return await alignmentSignalRepository.getAllByProcessedStatus(processedForTraining);
   }

   async getUnprocessedAlignmentSignals(): Promise<AlignmentSignal[]> {
     return await alignmentSignalRepository.getUnprocessed();
   }

    async updateAlignmentSignal(id: string, updates: Partial<InsertAlignmentSignal>): Promise<AlignmentSignal | undefined> {
      return await alignmentSignalRepository.update(id, updates);
    }

    // Inspirations
    async createInspiration(inspiration: InsertInspiration): Promise<Inspiration> {
      return await inspirationRepository.create(inspiration);
    }

    async getInspiration(id: string): Promise<Inspiration | undefined> {
      const result = await inspirationRepository.findById(id);
      return result ?? undefined;
    }

    async getAllInspirations(source?: string, status?: string): Promise<Inspiration[]> {
      return await inspirationRepository.getAllFiltered(source, status);
    }

    async getActiveInspirations(): Promise<Inspiration[]> {
      return await inspirationRepository.getActive();
    }

    async updateInspiration(id: string, updates: Partial<InsertInspiration>): Promise<Inspiration | undefined> {
      return await inspirationRepository.updateWithTimestamp(id, updates);
    }

    async deleteInspiration(id: string): Promise<boolean> {
      return await inspirationRepository.delete(id);
    }

    // Insights Processing
    async createInsightsProcessing(data: InsertInsightsProcessing): Promise<InsightsProcessing> {
      return await insightsProcessingRepository.create(data);
    }

    async getInsightsProcessing(id: string): Promise<InsightsProcessing | undefined> {
      return await insightsProcessingRepository.findById(id);
    }

    async getInsightsProcessingBySession(sessionId: string): Promise<InsightsProcessing | undefined> {
      return await insightsProcessingRepository.getBySessionId(sessionId);
    }

    async getActiveInsightsProcessing(): Promise<InsightsProcessing[]> {
      return await insightsProcessingRepository.getActive();
    }

    async updateInsightsProcessing(id: string, updates: Partial<InsertInsightsProcessing>): Promise<InsightsProcessing | undefined> {
      return await insightsProcessingRepository.update(id, updates);
    }

    // 商机记录相关方法
  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    return await opportunityRepository.create(opportunity);
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    return await opportunityRepository.findById(id);
  }

  async getAllOpportunities(status?: string): Promise<Opportunity[]> {
    return await opportunityRepository.getAllByStatus(status);
  }

  async getActiveOpportunities(): Promise<Opportunity[]> {
    return await opportunityRepository.getActive();
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    return await opportunityRepository.updateWithTimestamp(id, updates);
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    return await opportunityRepository.delete(id);
  }

  // Generated Files
  async createGeneratedFile(file: InsertGeneratedFile): Promise<GeneratedFile> {
    return await generatedFileRepository.create(file);
  }

  async getGeneratedFile(id: string): Promise<GeneratedFile | undefined> {
    return await generatedFileRepository.findById(id);
  }

  async getGeneratedFiles(projectId?: string): Promise<GeneratedFile[]> {
    return await generatedFileRepository.getAll(projectId);
  }

  async getGeneratedFilesByReport(reportId: string): Promise<GeneratedFile[]> {
    return await generatedFileRepository.getByReport(reportId);
  }

  async updateGeneratedFile(id: string, updates: Partial<InsertGeneratedFile>): Promise<GeneratedFile | undefined> {
    return await generatedFileRepository.updateWithTimestamp(id, updates);
  }

  async deleteGeneratedFile(id: string): Promise<boolean> {
    return await generatedFileRepository.delete(id);
  }

  // Talk Sessions
  async createTalkSession(session: InsertTalkSession): Promise<TalkSession> {
    return await talkSessionRepository.create(session);
  }

  async getTalkSession(id: string): Promise<TalkSession | undefined> {
    const result = await talkSessionRepository.findById(id);
    return result ?? undefined;
  }

  async updateTalkSession(id: string, updates: Partial<TalkSession>): Promise<TalkSession | undefined> {
    return await talkSessionRepository.update(id, updates as unknown as Partial<TalkSession>);
  }

  async getAllTalkSessions(limit?: number): Promise<TalkSession[]> {
    return await talkSessionRepository.getRecent(limit ?? 50);
  }
}

export const storageAdapter = new StorageAdapter() as unknown as IStorage;
