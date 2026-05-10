import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, or, sql } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type Person,
  type InsertPerson,
  type VaultItem,
  type InsertVaultItem,
  type ShadowMemory,
  type InsertShadowMemory,
  type RelationshipInsight,
  type DownloadTask,
  type InsertDownloadTask,
  type ComputeJob,
  type InsertComputeJob,
  type DreamLog,
  type InsertDreamLog,
  type AuditLog,
  type InsertAuditLog,
  type ExpertDecision,
  type InsertExpertDecision,
  type EvolutionEvent,
  type InsertEvolutionEvent,
  type Project,
  type InsertProject,
  type IntelItem,
  type InsertIntelItem,
  type SkillCapsule,
  type InsertSkillCapsule,
  type EvolutionState,
  type InsertEvolutionState,
  type DailyReport,
  type InsertDailyReport,
  type UserSettings,
  type InsertUserSettings,
  type Voiceprint,
  type InsertVoiceprint,
  type VoiceAuthorization,
  type InsertVoiceAuthorization,
  type Device,
  type InsertDevice,
  type RemoteCommand,
  type InsertRemoteCommand,
  type TeamMember,
  type InsertTeamMember,
  type SatelliteDevice,
  type InsertSatelliteDevice,
  type BattleReport,
  type InsertBattleReport,
  type KillSwitchLog,
  type InsertKillSwitchLog,
  type LoyaltyEvent,
  type InsertLoyaltyEvent,
  users,
  persons,
  vaultItems,
  shadowMemories,
  downloadTasks,
  computeJobs,
  dreamLogs,
  auditLogs,
  expertDecisions,
  evolutionEvents,
  projects,
  intelItems,
  skillCapsules,
  evolutionState,
  dailyReports,
  userSettings,
  voiceprints,
  voiceAuthorizations,
  devices,
  remoteCommands,
  generatedFiles,
  InsertGeneratedFile,
  GeneratedFile,
  teamMembers,
  satelliteDevices,
  battleReports,
  killSwitchLogs,
  loyaltyEvents,
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
  type InsertInsightsProcessing,
  type IntegrationProvider,
  type InsertIntegrationProvider,
  type IntegrationAccount,
  type InsertIntegrationAccount,
  type IntegrationSyncJob,
  type InsertIntegrationSyncJob,
  type EmailAccount,
  type InsertEmailAccount,
  type Email,
  type InsertEmail,
  type EmailAttachment,
  type InsertEmailAttachment,
  type Invoice,
  type InsertInvoice,
  type ExpenseReport,
  type InsertExpenseReport,
  talkSessions,
  conversationSegments,
  extractedEntities,
  opportunitySignals,
  inspirations,
  insightsProcessing,
  integrationProviders,
  integrationAccounts,
  integrationSyncJobs,
  emailAccounts,
  emails,
  emailAttachments,
  invoices,
  expenseReports,
  type AvatarChatHistory,
  type InsertAvatarChatHistory,
  type AvatarUserPreferences,
  type InsertAvatarUserPreferences,
  avatarChatHistory,
  avatarUserPreferences,
  type ProjectNote,
  type InsertProjectNote,
  projectNotes,
  type ProjectFile,
  type InsertProjectFile,
  projectFiles,
  type ProjectTemplate,
  type InsertProjectTemplate,
  projectTemplates,
  type Opportunity,
  type InsertOpportunity,
  opportunities,
  type RefinementRun,
  type InsertRefinementRun,
  refinementRuns,
  type StrategyProposal,
  type InsertStrategyProposal,
  strategyProposals,
  type AlignmentSignal,
  type InsertAlignmentSignal,
  alignmentSignals,
} from "@shared/schema";
import { encryptCredentials, decryptCredentials } from "./utils/crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getPerson(id: string): Promise<Person | undefined>;
  getAllPersons(accessLevel?: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<boolean>;
  searchPersonsByWeakness(keyword: string): Promise<Person[]>;
  findConflictingRelationships(personId: string): Promise<Person[]>;
  getRelationshipInsight(personName: string): Promise<RelationshipInsight | null>;

  getVaultItem(id: string): Promise<VaultItem | undefined>;
  getAllVaultItems(zone?: string): Promise<VaultItem[]>;
  createVaultItem(item: InsertVaultItem): Promise<VaultItem>;
  updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined>;
  deleteVaultItem(id: string): Promise<boolean>;
  searchVaultBySemanticTag(tag: string): Promise<VaultItem[]>;
  searchVaultByIntent(intent: string): Promise<VaultItem[]>;
  permanentShred(targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }>;

  getAllMemories(): Promise<ShadowMemory[]>;
  createMemory(memory: InsertShadowMemory): Promise<ShadowMemory>;

  createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask>;
  getDownloadTasks(): Promise<DownloadTask[]>;
  updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined>;
  deleteDownloadTask(id: string): Promise<boolean>;

  createComputeJob(job: InsertComputeJob): Promise<ComputeJob>;
  getComputeJobs(): Promise<ComputeJob[]>;
  updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined>;

  createDreamLog(log: InsertDreamLog): Promise<DreamLog>;
  getDreamLogs(): Promise<DreamLog[]>;
  updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined>;

  getVaultStats(): Promise<{
    totalDownloads: number;
    activeDownloads: number;
    totalComputeJobs: number;
    activeComputeJobs: number;
    totalDreams: number;
    categories: Record<string, number>;
  }>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;

  createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision>;
  getExpertDecisions(expertType?: string): Promise<ExpertDecision[]>;
  updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined>;

  createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent>;
  getEvolutionEvents(limit?: number): Promise<EvolutionEvent[]>;

  createProject(project: InsertProject): Promise<Project>;
  getProjects(status?: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  
  getProjectNotes(projectId: string): Promise<ProjectNote[]>;
  createProjectNote(note: InsertProjectNote): Promise<ProjectNote>;
  deleteProjectNote(id: string): Promise<boolean>;

  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined>;
  deleteProjectFile(id: string): Promise<boolean>;

  getProjectTemplates(category?: string): Promise<ProjectTemplate[]>;
  getProjectTemplate(id: string): Promise<ProjectTemplate | undefined>;
  createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate>;
  incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined>;

  createIntelItem(intel: InsertIntelItem): Promise<IntelItem>;
  getIntelItems(status?: string): Promise<IntelItem[]>;
  updateIntelItem(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined>;

  createSkillCapsule(capsule: InsertSkillCapsule): Promise<SkillCapsule>;
  getSkillCapsules(): Promise<SkillCapsule[]>;
  updateSkillCapsule(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined>;

  getEvolutionState(): Promise<EvolutionState | undefined>;
  updateEvolutionState(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined>;

  // HP (计算资源) 管理
  getHPBalance(): Promise<{ balance: number; maxBalance: number; totalConsumed: number; totalRecharged: number }>;
  consumeHP(amount: number, reason: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }>;
  rechargeHP(amount: number, expandMax?: boolean): Promise<{ success: boolean; newBalance: number; recharged: number; newMaxBalance?: number }>;

  createDailyReport(report: InsertDailyReport): Promise<DailyReport>;
  getDailyReports(limit?: number): Promise<DailyReport[]>;
  getTodayReport(): Promise<DailyReport | undefined>;
  updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined>;

  getPersonsByApprovalStatus(status: string): Promise<Person[]>;

  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  getAllUserSettings(): Promise<UserSettings[]>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  deleteUserSettings(userId: string): Promise<boolean>;

  getVoiceprint(userId: string): Promise<Voiceprint | undefined>;
  getMasterVoiceprint(): Promise<Voiceprint | undefined>;
  createVoiceprint(voiceprint: InsertVoiceprint): Promise<Voiceprint>;
  updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined>;
  
  getVoiceAuthorizations(): Promise<VoiceAuthorization[]>;
  createVoiceAuthorization(auth: InsertVoiceAuthorization): Promise<VoiceAuthorization>;
  deactivateVoiceAuthorization(id: string): Promise<boolean>;

  // Z3 Remote Devices
  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByToken(tokenHash: string): Promise<Device | undefined>;
  getAllDevices(userId?: string): Promise<Device[]>;
  updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceHeartbeat(id: string): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;

  // Z3 Remote Commands
  createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand>;
  getRemoteCommand(id: string): Promise<RemoteCommand | undefined>;
  getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]>;
  getPendingCommands(deviceId: string): Promise<RemoteCommand[]>;
  updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined>;

  // Generated Files
  createGeneratedFile(file: InsertGeneratedFile): Promise<GeneratedFile>;
  getGeneratedFile(id: string): Promise<GeneratedFile | undefined>;
  getGeneratedFiles(projectId?: string): Promise<GeneratedFile[]>;
  getGeneratedFilesByReport(reportId: string): Promise<GeneratedFile[]>;
  updateGeneratedFile(id: string, updates: Partial<InsertGeneratedFile>): Promise<GeneratedFile | undefined>;
  deleteGeneratedFile(id: string): Promise<boolean>;

  // Talk Sessions
  createTalkSession(session: InsertTalkSession): Promise<TalkSession>;
  getTalkSession(id: string): Promise<TalkSession | undefined>;
  updateTalkSession(id: string, updates: Partial<TalkSession>): Promise<TalkSession | undefined>;
  getAllTalkSessions(limit?: number): Promise<TalkSession[]>;

  // Conversation Segments
  createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment>;
  getSessionSegments(sessionId: string): Promise<ConversationSegment[]>;

  // Extracted Entities
  createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity>;
  getSessionEntities(sessionId: string): Promise<ExtractedEntity[]>;
  updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined>;

  // Opportunity Signals
  createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal>;
  getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]>;
  updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined>;

  // Inspirations
  createInspiration(inspiration: InsertInspiration): Promise<Inspiration>;
  getInspiration(id: string): Promise<Inspiration | undefined>;
  getAllInspirations(source?: string, status?: string): Promise<Inspiration[]>;
  getActiveInspirations?(): Promise<Inspiration[]>;
  updateInspiration(id: string, updates: Partial<InsertInspiration>): Promise<Inspiration | undefined>;
  deleteInspiration(id: string): Promise<boolean>;

  // Integration Providers
  createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider>;
  getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined>;
  getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined>;
  getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]>;
  updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined>;

  // Integration Accounts
  createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount>;
  getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined>;
  getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined>;
  getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]>;
  updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined>;
  deleteIntegrationAccount(id: string): Promise<boolean>;

  // Integration Sync Jobs
  createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob>;
  getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined>;
  getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]>;
  updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined>;

  // Avatar Chat History
  createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory>;
  getChatHistory(limit?: number): Promise<AvatarChatHistory[]>;
  getRecentChatContext(limit?: number): Promise<AvatarChatHistory[]>;
  updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined>;
  getMemorizedChats(): Promise<AvatarChatHistory[]>;
  
  // Avatar User Preferences
  getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined>;
  updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined>;

  // Insights Processing
  createInsightsProcessing(data: InsertInsightsProcessing): Promise<InsightsProcessing>;
  getInsightsProcessing(id: string): Promise<InsightsProcessing | undefined>;
  getInsightsProcessingBySession(sessionId: string): Promise<InsightsProcessing | undefined>;
  getActiveInsightsProcessing(): Promise<InsightsProcessing[]>;
  updateInsightsProcessing(id: string, updates: Partial<InsertInsightsProcessing>): Promise<InsightsProcessing | undefined>;

  // Email Accounts
  createEmailAccount(account: InsertEmailAccount, password?: string): Promise<EmailAccount>;
  getEmailAccount(id: string): Promise<EmailAccount | undefined>;
  getEmailAccountWithPassword(id: string): Promise<{ account: EmailAccount; password: string | null } | undefined>;
  getAllEmailAccounts(userId?: string): Promise<EmailAccount[]>;
  updateEmailAccount(id: string, updates: Partial<InsertEmailAccount>, password?: string): Promise<EmailAccount | undefined>;
  deleteEmailAccount(id: string): Promise<boolean>;

  // Emails
  createEmail(email: InsertEmail): Promise<Email>;
  getEmail(id: string): Promise<Email | undefined>;
  getEmailByMessageId(accountId: string, messageId: string): Promise<Email | undefined>;
  getEmailsByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]>;
  getEmailsByCategory(accountId: string, category: string): Promise<Email[]>;
  getAllEmails(options?: { accountId?: string; folder?: string; category?: string; importance?: string; isRead?: boolean; limit?: number; offset?: number }): Promise<Email[]>;
  getEmailStats?(): Promise<{ unreadCount: number; invoiceCount: number; totalEmails: number } | undefined>;
  updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined>;
  deleteEmail(id: string): Promise<boolean>;

  // Email Attachments
  createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment>;
  getEmailAttachments(emailId: string): Promise<EmailAttachment[]>;
  getEmailAttachment(id: string): Promise<EmailAttachment | undefined>;
  updateEmailAttachment(id: string, updates: Partial<InsertEmailAttachment>): Promise<EmailAttachment | undefined>;

  // Invoices
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(userId?: string, status?: string): Promise<Invoice[]>;
  getUnassignedInvoices(userId: string): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Expense Reports
  createExpenseReport(report: InsertExpenseReport): Promise<ExpenseReport>;
  getExpenseReport(id: string): Promise<ExpenseReport | undefined>;
  getAllExpenseReports(userId?: string, status?: string): Promise<ExpenseReport[]>;
  updateExpenseReport(id: string, updates: Partial<InsertExpenseReport>): Promise<ExpenseReport | undefined>;
  deleteExpenseReport(id: string): Promise<boolean>;
  getExpenseReportWithInvoices(id: string): Promise<{ report: ExpenseReport; invoices: Invoice[] } | undefined>;

  // Team Members (总台系统)
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getAllTeamMembers(isActive?: boolean): Promise<TeamMember[]>;
  updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  // Satellite Devices (分台设备)
  createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice>;
  getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined>;
  getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined>;
  getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]>;
  updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined>;
  deleteSatelliteDevice(id: string): Promise<boolean>;

  // Battle Reports (战报)
  createBattleReport(report: InsertBattleReport): Promise<BattleReport>;
  getBattleReport(id: string): Promise<BattleReport | undefined>;
  getAllBattleReports(limit?: number): Promise<BattleReport[]>;
  updateBattleReport(id: string, updates: Partial<InsertBattleReport>): Promise<BattleReport | undefined>;

  // Kill Switch Logs (熔断日志)
  createKillSwitchLog(log: InsertKillSwitchLog): Promise<KillSwitchLog>;
  getKillSwitchLogs(limit?: number): Promise<KillSwitchLog[]>;
  updateKillSwitchLog(id: string, updates: Partial<InsertKillSwitchLog>): Promise<KillSwitchLog | undefined>;

  // Loyalty Events (忠诚度事件)
  createLoyaltyEvent(event: InsertLoyaltyEvent): Promise<LoyaltyEvent>;
  getLoyaltyEvent(id: string): Promise<LoyaltyEvent | undefined>;
  getLoyaltyEventsByMember(memberId: string): Promise<LoyaltyEvent[]>;
  getAllLoyaltyEvents(status?: string): Promise<LoyaltyEvent[]>;
  updateLoyaltyEvent(id: string, updates: Partial<InsertLoyaltyEvent>): Promise<LoyaltyEvent | undefined>;

  // Project Strategist: Opportunities (商机记录)
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getAllOpportunities(status?: string): Promise<Opportunity[]>;
  getActiveOpportunities(): Promise<Opportunity[]>;
  updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;

  // Project Strategist: Refinement Runs (推演运行)
  createRefinementRun(run: InsertRefinementRun): Promise<RefinementRun>;
  getRefinementRun(id: string): Promise<RefinementRun | undefined>;
  getRefinementRunsByOpportunity(opportunityId: string): Promise<RefinementRun[]>;
  getActiveRefinementRuns(): Promise<RefinementRun[]>;
  updateRefinementRun(id: string, updates: Partial<InsertRefinementRun>): Promise<RefinementRun | undefined>;

  // Project Strategist: Strategy Proposals (策略提案)
  createStrategyProposal(proposal: InsertStrategyProposal): Promise<StrategyProposal>;
  getStrategyProposal(id: string): Promise<StrategyProposal | undefined>;
  getProposalsByOpportunity(opportunityId: string): Promise<StrategyProposal[]>;
  getPendingProposals(): Promise<StrategyProposal[]>;
  updateStrategyProposal(id: string, updates: Partial<InsertStrategyProposal>): Promise<StrategyProposal | undefined>;

  // Project Strategist: Alignment Signals (价值对齐信号)
  createAlignmentSignal(signal: InsertAlignmentSignal): Promise<AlignmentSignal>;
  getAllAlignmentSignals(processedForTraining?: boolean): Promise<AlignmentSignal[]>;
  getUnprocessedAlignmentSignals(): Promise<AlignmentSignal[]>;
  updateAlignmentSignal(id: string, updates: Partial<InsertAlignmentSignal>): Promise<AlignmentSignal | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getPerson(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(persons).where(eq(persons.id, id));
    return person;
  }

  async getAllPersons(accessLevel?: string): Promise<Person[]> {
    if (accessLevel) {
      return await db.select().from(persons).where(eq(persons.accessLevel, accessLevel));
    }
    return await db.select().from(persons);
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    const [newPerson] = await db.insert(persons).values(person).returning();
    return newPerson;
  }

  async updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined> {
    const [updated] = await db.update(persons).set(person).where(eq(persons.id, id)).returning();
    return updated;
  }

  async deletePerson(id: string): Promise<boolean> {
    const result = await db.delete(persons).where(eq(persons.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async searchPersonsByWeakness(keyword: string): Promise<Person[]> {
    return await db.select().from(persons).where(sql`${persons.weakness} ILIKE ${`%${keyword}%`}`);
  }

  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await db.select().from(persons).where(
      or(
        sql`${persons.connectionNodes} @> ARRAY[${personId}]::text[]`,
        sql`${persons.conflictPoints} IS NOT NULL AND array_length(${persons.conflictPoints}, 1) > 0`
      )
    );
  }

  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    const [person] = await db.select().from(persons).where(sql`${persons.name} ILIKE ${`%${personName}%`}`);
    
    if (!person) return null;

    const interestChain = person.interestChain as Record<string, unknown> | null;
    const interestSummary = interestChain 
      ? Object.entries(interestChain).map(([k, v]) => `${k}: ${v}`).join(', ')
      : '无已知利益关联';

    const riskLevel = person.weakness 
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

  async getVaultItem(id: string): Promise<VaultItem | undefined> {
    const [item] = await db.select().from(vaultItems).where(eq(vaultItems.id, id));
    return item;
  }

  async getAllVaultItems(zone?: string): Promise<VaultItem[]> {
    if (zone) {
      return await db.select().from(vaultItems).where(eq(vaultItems.privacyZone, zone));
    }
    return await db.select().from(vaultItems);
  }

  async createVaultItem(item: InsertVaultItem): Promise<VaultItem> {
    const [newItem] = await db.insert(vaultItems).values(item).returning();
    return newItem;
  }

  async updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined> {
    const [updated] = await db.update(vaultItems).set(item).where(eq(vaultItems.id, id)).returning();
    return updated;
  }

  async deleteVaultItem(id: string): Promise<boolean> {
    const result = await db.delete(vaultItems).where(eq(vaultItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async searchVaultBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await db.select().from(vaultItems).where(sql`${tag} = ANY(${vaultItems.semanticTags})`);
  }

  async searchVaultByIntent(intent: string): Promise<VaultItem[]> {
    return await db.select().from(vaultItems).where(
      or(
        sql`${vaultItems.fileName} ILIKE ${`%${intent}%`}`,
        sql`${vaultItems.semanticIndex} ILIKE ${`%${intent}%`}`,
        sql`EXISTS (SELECT 1 FROM unnest(${vaultItems.semanticTags}) AS tag WHERE tag ILIKE ${`%${intent}%`})`
      )
    );
  }

  async permanentShred(targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> {
    try {
      if (table === 'vault') {
        const item = await this.getVaultItem(targetId);
        if (!item) {
          return { success: false, message: 'Target not found in vault' };
        }
        
        console.log(`[SECURITY] Initiating physical shredding for vault item: ${item.fileName}`);
        await db.delete(vaultItems).where(eq(vaultItems.id, targetId));
        
        return { success: true, message: `[SHRED COMPLETE] ${item.fileName} has been permanently destroyed` };
      } else {
        const person = await this.getPerson(targetId);
        if (!person) {
          return { success: false, message: 'Target person not found' };
        }
        
        console.log(`[SECURITY] Initiating data purge for person: ${person.name}`);
        await db.delete(persons).where(eq(persons.id, targetId));
        
        return { success: true, message: `[PURGE COMPLETE] All records of ${person.name} have been erased` };
      }
    } catch (error) {
      return { success: false, message: `Shredding failed: ${error}` };
    }
  }

  async getAllMemories(): Promise<ShadowMemory[]> {
    return await db.select().from(shadowMemories);
  }

  async createMemory(memory: InsertShadowMemory): Promise<ShadowMemory> {
    const [newMemory] = await db.insert(shadowMemories).values(memory).returning();
    return newMemory;
  }

  async createDownloadTask(task: InsertDownloadTask): Promise<DownloadTask> {
    const [newTask] = await db.insert(downloadTasks).values(task).returning();
    return newTask;
  }

  async getDownloadTasks(): Promise<DownloadTask[]> {
    return await db.select().from(downloadTasks).orderBy(sql`created_at DESC`);
  }

  async updateDownloadTask(id: string, updates: Partial<InsertDownloadTask>): Promise<DownloadTask | undefined> {
    const [updated] = await db.update(downloadTasks).set(updates).where(eq(downloadTasks.id, id)).returning();
    return updated;
  }

  async deleteDownloadTask(id: string): Promise<boolean> {
    const result = await db.delete(downloadTasks).where(eq(downloadTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async createComputeJob(job: InsertComputeJob): Promise<ComputeJob> {
    const [newJob] = await db.insert(computeJobs).values(job).returning();
    return newJob;
  }

  async getComputeJobs(): Promise<ComputeJob[]> {
    return await db.select().from(computeJobs).orderBy(sql`created_at DESC`);
  }

  async updateComputeJob(id: string, updates: Partial<InsertComputeJob>): Promise<ComputeJob | undefined> {
    const [updated] = await db.update(computeJobs).set(updates).where(eq(computeJobs.id, id)).returning();
    return updated;
  }

  async createDreamLog(log: InsertDreamLog): Promise<DreamLog> {
    const [newLog] = await db.insert(dreamLogs).values(log).returning();
    return newLog;
  }

  async getDreamLogs(): Promise<DreamLog[]> {
    return await db.select().from(dreamLogs).orderBy(sql`created_at DESC`);
  }

  async updateDreamLog(id: string, updates: Partial<InsertDreamLog>): Promise<DreamLog | undefined> {
    const [updated] = await db.update(dreamLogs).set(updates).where(eq(dreamLogs.id, id)).returning();
    return updated;
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

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(sql`created_at DESC`).limit(limit);
  }

  async createExpertDecision(decision: InsertExpertDecision): Promise<ExpertDecision> {
    const [newDecision] = await db.insert(expertDecisions).values(decision).returning();
    return newDecision;
  }

  async getExpertDecisions(expertType?: string): Promise<ExpertDecision[]> {
    if (expertType) {
      return await db.select().from(expertDecisions).where(eq(expertDecisions.expertType, expertType)).orderBy(sql`created_at DESC`);
    }
    return await db.select().from(expertDecisions).orderBy(sql`created_at DESC`);
  }

  async updateExpertDecision(id: string, updates: Partial<InsertExpertDecision>): Promise<ExpertDecision | undefined> {
    const [updated] = await db.update(expertDecisions).set(updates).where(eq(expertDecisions.id, id)).returning();
    return updated;
  }

  async createEvolutionEvent(event: InsertEvolutionEvent): Promise<EvolutionEvent> {
    const [newEvent] = await db.insert(evolutionEvents).values(event).returning();
    return newEvent;
  }

  async getEvolutionEvents(limit: number = 50): Promise<EvolutionEvent[]> {
    return await db.select().from(evolutionEvents).orderBy(sql`created_at DESC`).limit(limit);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getProjects(status?: string): Promise<Project[]> {
    if (status) {
      return await db.select().from(projects).where(eq(projects.status, status)).orderBy(sql`created_at DESC`);
    }
    return await db.select().from(projects).orderBy(sql`created_at DESC`);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await db.select().from(projectNotes).where(eq(projectNotes.projectId, projectId)).orderBy(sql`created_at DESC`);
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    const [newNote] = await db.insert(projectNotes).values(note).returning();
    return newNote;
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    const result = await db.delete(projectNotes).where(eq(projectNotes.id, id));
    return true;
  }

  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(sql`uploaded_at DESC`);
  }

  async createProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }

  async updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    const [updated] = await db.update(projectFiles).set(updates).where(eq(projectFiles.id, id)).returning();
    return updated;
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    await db.delete(projectFiles).where(eq(projectFiles.id, id));
    return true;
  }

  async getProjectTemplates(category?: string): Promise<ProjectTemplate[]> {
    if (category) {
      return await db.select().from(projectTemplates)
        .where(eq(projectTemplates.category, category))
        .orderBy(sql`usage_count DESC`);
    }
    return await db.select().from(projectTemplates).orderBy(sql`usage_count DESC`);
  }

  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    const [template] = await db.select().from(projectTemplates).where(eq(projectTemplates.id, id));
    return template;
  }

  async createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate> {
    const [created] = await db.insert(projectTemplates).values(template).returning();
    return created;
  }

  async incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined> {
    const template = await this.getProjectTemplate(id);
    if (!template) return undefined;
    const [updated] = await db.update(projectTemplates)
      .set({ usageCount: (template.usageCount || 0) + 1 })
      .where(eq(projectTemplates.id, id))
      .returning();
    return updated;
  }

  async createIntelItem(intel: InsertIntelItem): Promise<IntelItem> {
    const [newIntel] = await db.insert(intelItems).values(intel).returning();
    return newIntel;
  }

  async getIntelItems(status?: string): Promise<IntelItem[]> {
    if (status) {
      return await db.select().from(intelItems).where(eq(intelItems.status, status)).orderBy(sql`created_at DESC`);
    }
    return await db.select().from(intelItems).orderBy(sql`created_at DESC`);
  }

  async updateIntelItem(id: string, updates: Partial<InsertIntelItem>): Promise<IntelItem | undefined> {
    const [updated] = await db.update(intelItems).set(updates).where(eq(intelItems.id, id)).returning();
    return updated;
  }

  async createSkillCapsule(capsule: InsertSkillCapsule): Promise<SkillCapsule> {
    const [newCapsule] = await db.insert(skillCapsules).values(capsule).returning();
    return newCapsule;
  }

  async getSkillCapsules(): Promise<SkillCapsule[]> {
    return await db.select().from(skillCapsules).orderBy(sql`created_at DESC`);
  }

  async updateSkillCapsule(id: string, updates: Partial<InsertSkillCapsule>): Promise<SkillCapsule | undefined> {
    const [updated] = await db.update(skillCapsules).set(updates).where(eq(skillCapsules.id, id)).returning();
    return updated;
  }

  async getEvolutionState(): Promise<EvolutionState | undefined> {
    const [state] = await db.select().from(evolutionState).where(eq(evolutionState.id, 'singleton'));
    if (!state) {
      const [newState] = await db.insert(evolutionState).values({ id: 'singleton' } as any).returning();
      return newState;
    }
    return state;
  }

  async updateEvolutionState(updates: Partial<InsertEvolutionState>): Promise<EvolutionState | undefined> {
    await this.getEvolutionState();
    const [updated] = await db.update(evolutionState).set({ ...updates, updatedAt: new Date() }).where(eq(evolutionState.id, 'singleton')).returning();
    return updated;
  }

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
    const state = await this.getEvolutionState();
    const currentBalance = state?.hpBalance ?? 1000;
    
    if (amount <= 0) {
      return { success: false, newBalance: currentBalance, consumed: 0, error: 'Amount must be positive' };
    }
    
    if (amount > currentBalance) {
      await this.createAuditLog({
        action: 'HP_CONSUME',
        actor: 'SYSTEM',
        targetType: 'HP',
        targetId: reason,
        details: { requestedAmount: amount, currentBalance, error: 'INSUFFICIENT_BALANCE' },
        result: 'FAILED',
      });
      return { success: false, newBalance: currentBalance, consumed: 0, error: 'HP余额不足' };
    }
    
    const newBalance = currentBalance - amount;
    
    await this.updateEvolutionState({
      hpBalance: newBalance,
      hpTotalConsumed: (state?.hpTotalConsumed ?? 0) + amount,
    });
    
    await this.createAuditLog({
      action: 'HP_CONSUME',
      actor: 'SYSTEM',
      targetType: 'HP',
      targetId: reason,
      details: { amount, previousBalance: currentBalance, newBalance },
      result: 'SUCCESS',
    });
    
    return { success: true, newBalance, consumed: amount };
  }

  async rechargeHP(amount: number, expandMax?: boolean): Promise<{ success: boolean; newBalance: number; recharged: number; newMaxBalance?: number }> {
    const state = await this.getEvolutionState();
    const currentBalance = state?.hpBalance ?? 0;
    let maxBalance = state?.hpMaxBalance ?? 1000;
    
    if (amount <= 0) {
      return { success: false, newBalance: currentBalance, recharged: 0 };
    }
    
    if (expandMax && currentBalance + amount > maxBalance) {
      maxBalance = currentBalance + amount;
    }
    
    const actualRecharge = Math.min(amount, maxBalance - currentBalance);
    const newBalance = currentBalance + actualRecharge;
    
    await this.updateEvolutionState({
      hpBalance: newBalance,
      hpMaxBalance: maxBalance,
      hpTotalRecharged: (state?.hpTotalRecharged ?? 0) + actualRecharge,
      hpLastRechargeAt: new Date(),
    });
    
    await this.createAuditLog({
      action: 'HP_RECHARGE',
      actor: 'SYSTEM',
      targetType: 'HP',
      targetId: 'recharge',
      details: { amount: actualRecharge, previousBalance: currentBalance, newBalance, maxBalance },
      result: 'SUCCESS',
    });
    
    return { success: true, newBalance, recharged: actualRecharge, newMaxBalance: maxBalance };
  }

  async createDailyReport(report: InsertDailyReport): Promise<DailyReport> {
    const [newReport] = await db.insert(dailyReports).values(report).returning();
    return newReport;
  }

  async getDailyReports(limit: number = 30): Promise<DailyReport[]> {
    return await db.select().from(dailyReports).orderBy(sql`report_date DESC`).limit(limit);
  }

  async getTodayReport(): Promise<DailyReport | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [report] = await db.select().from(dailyReports).where(sql`DATE(report_date) = DATE(${today})`);
    return report;
  }

  async updateDailyReport(id: string, updates: Partial<InsertDailyReport>): Promise<DailyReport | undefined> {
    const [updated] = await db.update(dailyReports).set(updates).where(eq(dailyReports.id, id)).returning();
    return updated;
  }

  async getPersonsByApprovalStatus(status: string): Promise<Person[]> {
    return await db.select().from(persons).where(eq(persons.approvalStatus, status)).orderBy(sql`created_at DESC`);
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async getAllUserSettings(): Promise<UserSettings[]> {
    return await db.select().from(userSettings);
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const [newSettings] = await db.insert(userSettings).values(settings).returning();
    return newSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const [updated] = await db.update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated;
  }

  async deleteUserSettings(userId: string): Promise<boolean> {
    const result = await db.delete(userSettings).where(eq(userSettings.userId, userId));
    return true;
  }

  async getVoiceprint(userId: string): Promise<Voiceprint | undefined> {
    const [vp] = await db.select().from(voiceprints).where(eq(voiceprints.userId, userId));
    return vp;
  }

  async getMasterVoiceprint(): Promise<Voiceprint | undefined> {
    const [vp] = await db.select().from(voiceprints)
      .where(sql`${voiceprints.label} = 'MASTER' AND ${voiceprints.isActive} = 1`);
    return vp;
  }

  async createVoiceprint(voiceprint: InsertVoiceprint): Promise<Voiceprint> {
    const [newVp] = await db.insert(voiceprints).values(voiceprint).returning();
    return newVp;
  }

  async updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined> {
    const [updated] = await db.update(voiceprints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceprints.userId, userId))
      .returning();
    return updated;
  }

  async getVoiceAuthorizations(): Promise<VoiceAuthorization[]> {
    return await db.select().from(voiceAuthorizations)
      .where(eq(voiceAuthorizations.isActive, 1))
      .orderBy(sql`created_at DESC`);
  }

  async createVoiceAuthorization(auth: InsertVoiceAuthorization): Promise<VoiceAuthorization> {
    const [newAuth] = await db.insert(voiceAuthorizations).values(auth).returning();
    return newAuth;
  }

  async deactivateVoiceAuthorization(id: string): Promise<boolean> {
    await db.update(voiceAuthorizations)
      .set({ isActive: 0 })
      .where(eq(voiceAuthorizations.id, id));
    return true;
  }

  // Z3 Remote Devices
  async createDevice(device: InsertDevice): Promise<Device> {
    const [newDevice] = await db.insert(devices).values({
      ...device,
      lastSeen: new Date(),
    }).returning();
    return newDevice;
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async getDeviceByToken(tokenHash: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices)
      .where(eq(devices.authTokenHash, tokenHash));
    return device;
  }

  async getAllDevices(userId?: string): Promise<Device[]> {
    if (userId) {
      return await db.select().from(devices)
        .where(eq(devices.userId, userId))
        .orderBy(sql`last_seen DESC NULLS LAST`);
    }
    return await db.select().from(devices)
      .orderBy(sql`last_seen DESC NULLS LAST`);
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    const [updated] = await db.update(devices)
      .set(updates)
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async updateDeviceHeartbeat(id: string): Promise<Device | undefined> {
    const [updated] = await db.update(devices)
      .set({ lastSeen: new Date(), status: 'ONLINE' })
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async deleteDevice(id: string): Promise<boolean> {
    const result = await db.delete(devices).where(eq(devices.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Z3 Remote Commands
  async createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand> {
    const [newCommand] = await db.insert(remoteCommands).values(command).returning();
    return newCommand;
  }

  async getRemoteCommand(id: string): Promise<RemoteCommand | undefined> {
    const [cmd] = await db.select().from(remoteCommands).where(eq(remoteCommands.id, id));
    return cmd;
  }

  async getDeviceCommands(deviceId: string, limit: number = 50): Promise<RemoteCommand[]> {
    return await db.select().from(remoteCommands)
      .where(eq(remoteCommands.deviceId, deviceId))
      .orderBy(sql`issued_at DESC`)
      .limit(limit);
  }

  async getPendingCommands(deviceId: string): Promise<RemoteCommand[]> {
    return await db.select().from(remoteCommands)
      .where(sql`${remoteCommands.deviceId} = ${deviceId} AND ${remoteCommands.status} IN ('PENDING', 'SENT')`)
      .orderBy(sql`issued_at ASC`);
  }

  async updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined> {
    const [updated] = await db.update(remoteCommands)
      .set(updates)
      .where(eq(remoteCommands.id, id))
      .returning();
    return updated;
  }

  // Generated Files
  async createGeneratedFile(file: InsertGeneratedFile): Promise<GeneratedFile> {
    const [newFile] = await db.insert(generatedFiles).values(file).returning();
    return newFile;
  }

  async getGeneratedFile(id: string): Promise<GeneratedFile | undefined> {
    const [file] = await db.select().from(generatedFiles).where(eq(generatedFiles.id, id));
    return file;
  }

  async getGeneratedFiles(projectId?: string): Promise<GeneratedFile[]> {
    if (projectId) {
      return await db.select().from(generatedFiles)
        .where(eq(generatedFiles.relatedProjectId, projectId))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(generatedFiles).orderBy(sql`created_at DESC`);
  }

  async getGeneratedFilesByReport(reportId: string): Promise<GeneratedFile[]> {
    return await db.select().from(generatedFiles)
      .where(eq(generatedFiles.relatedReportId, reportId))
      .orderBy(sql`created_at DESC`);
  }

  async updateGeneratedFile(id: string, updates: Partial<InsertGeneratedFile>): Promise<GeneratedFile | undefined> {
    const [updated] = await db.update(generatedFiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(generatedFiles.id, id))
      .returning();
    return updated;
  }

  async deleteGeneratedFile(id: string): Promise<boolean> {
    const result = await db.delete(generatedFiles).where(eq(generatedFiles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Talk Sessions
  async createTalkSession(session: InsertTalkSession): Promise<TalkSession> {
    const [newSession] = await db.insert(talkSessions).values(session).returning();
    return newSession;
  }

  async getTalkSession(id: string): Promise<TalkSession | undefined> {
    const [session] = await db.select().from(talkSessions).where(eq(talkSessions.id, id));
    return session;
  }

  async updateTalkSession(id: string, updates: Partial<TalkSession>): Promise<TalkSession | undefined> {
    const [updated] = await db.update(talkSessions)
      .set(updates as any)
      .where(eq(talkSessions.id, id))
      .returning();
    return updated;
  }

  async getAllTalkSessions(limit: number = 50): Promise<TalkSession[]> {
    return await db.select().from(talkSessions)
      .orderBy(sql`started_at DESC`)
      .limit(limit);
  }

  // Conversation Segments
  async createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment> {
    const [newSegment] = await db.insert(conversationSegments).values(segment).returning();
    return newSegment;
  }

  async getSessionSegments(sessionId: string): Promise<ConversationSegment[]> {
    return await db.select().from(conversationSegments)
      .where(eq(conversationSegments.sessionId, sessionId))
      .orderBy(sql`timestamp ASC`);
  }

  // Extracted Entities
  async createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity> {
    const [newEntity] = await db.insert(extractedEntities).values(entity).returning();
    return newEntity;
  }

  async getSessionEntities(sessionId: string): Promise<ExtractedEntity[]> {
    return await db.select().from(extractedEntities)
      .where(eq(extractedEntities.sessionId, sessionId));
  }

  async updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined> {
    const [updated] = await db.update(extractedEntities)
      .set(updates)
      .where(eq(extractedEntities.id, id))
      .returning();
    return updated;
  }

  // Opportunity Signals
  async createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal> {
    const [newSignal] = await db.insert(opportunitySignals).values(signal).returning();
    return newSignal;
  }

  async getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]> {
    return await db.select().from(opportunitySignals)
      .where(eq(opportunitySignals.sessionId, sessionId));
  }

  async updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined> {
    const [updated] = await db.update(opportunitySignals)
      .set(updates)
      .where(eq(opportunitySignals.id, id))
      .returning();
    return updated;
  }

  // Inspirations
  async createInspiration(inspiration: InsertInspiration): Promise<Inspiration> {
    const [newInspiration] = await db.insert(inspirations).values(inspiration).returning();
    return newInspiration;
  }

  async getInspiration(id: string): Promise<Inspiration | undefined> {
    const [inspiration] = await db.select().from(inspirations).where(eq(inspirations.id, id));
    return inspiration;
  }

  async getAllInspirations(source?: string, status?: string): Promise<Inspiration[]> {
    let query = db.select().from(inspirations);
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

  async getActiveInspirations(): Promise<Inspiration[]> {
    return await db.select().from(inspirations)
      .where(sql`${inspirations.status} IN ('new', 'pending', 'in_progress')`)
      .orderBy(sql`created_at DESC`);
  }

  async updateInspiration(id: string, updates: Partial<InsertInspiration>): Promise<Inspiration | undefined> {
    const [updated] = await db.update(inspirations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inspirations.id, id))
      .returning();
    return updated;
  }

  async deleteInspiration(id: string): Promise<boolean> {
    const result = await db.delete(inspirations).where(eq(inspirations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Insights Processing
  async createInsightsProcessing(data: InsertInsightsProcessing): Promise<InsightsProcessing> {
    const [newRecord] = await db.insert(insightsProcessing).values(data).returning();
    return newRecord;
  }

  async getInsightsProcessing(id: string): Promise<InsightsProcessing | undefined> {
    const [record] = await db.select().from(insightsProcessing).where(eq(insightsProcessing.id, id));
    return record;
  }

  async getInsightsProcessingBySession(sessionId: string): Promise<InsightsProcessing | undefined> {
    const [record] = await db.select().from(insightsProcessing)
      .where(eq(insightsProcessing.sessionId, sessionId));
    return record;
  }

  async getActiveInsightsProcessing(): Promise<InsightsProcessing[]> {
    return await db.select().from(insightsProcessing)
      .where(sql`${insightsProcessing.status} NOT IN ('COMPLETE', 'FAILED')`)
      .orderBy(sql`started_at DESC`);
  }

  async updateInsightsProcessing(id: string, updates: Partial<InsertInsightsProcessing>): Promise<InsightsProcessing | undefined> {
    const [updated] = await db.update(insightsProcessing)
      .set(updates)
      .where(eq(insightsProcessing.id, id))
      .returning();
    return updated;
  }

  // Integration Providers
  async createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider> {
    const [newProvider] = await db.insert(integrationProviders).values(provider).returning();
    return newProvider;
  }

  async getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined> {
    const [provider] = await db.select().from(integrationProviders).where(eq(integrationProviders.id, id));
    return provider;
  }

  async getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined> {
    const [provider] = await db.select().from(integrationProviders).where(eq(integrationProviders.code, code));
    return provider;
  }

  async getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]> {
    if (category) {
      return await db.select().from(integrationProviders).where(eq(integrationProviders.category, category));
    }
    return await db.select().from(integrationProviders);
  }

  async updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined> {
    const [updated] = await db.update(integrationProviders)
      .set(updates)
      .where(eq(integrationProviders.id, id))
      .returning();
    return updated;
  }

  // Integration Accounts
  async createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount> {
    let accountData = { ...account };
    if (credentials) {
      const { encrypted, iv } = encryptCredentials(credentials);
      accountData.encryptedCredentials = encrypted;
      accountData.credentialsIv = iv;
    }
    const [newAccount] = await db.insert(integrationAccounts).values(accountData).returning();
    return newAccount;
  }

  async getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined> {
    const [account] = await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, id));
    return account;
  }

  async getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined> {
    const [account] = await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, id));
    if (!account) return undefined;
    
    let credentials: object | null = null;
    if (account.encryptedCredentials && account.credentialsIv) {
      try {
        credentials = decryptCredentials(account.encryptedCredentials, account.credentialsIv);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
      }
    }
    return { account, credentials };
  }

  async getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]> {
    if (userId) {
      return await db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, userId));
    }
    return await db.select().from(integrationAccounts);
  }

  async updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined> {
    let updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
    if (credentials) {
      const { encrypted, iv } = encryptCredentials(credentials);
      updateData.encryptedCredentials = encrypted;
      updateData.credentialsIv = iv;
    }
    const [updated] = await db.update(integrationAccounts)
      .set(updateData)
      .where(eq(integrationAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteIntegrationAccount(id: string): Promise<boolean> {
    const result = await db.delete(integrationAccounts).where(eq(integrationAccounts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Integration Sync Jobs
  async createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob> {
    const [newJob] = await db.insert(integrationSyncJobs).values(job).returning();
    return newJob;
  }

  async getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined> {
    const [job] = await db.select().from(integrationSyncJobs).where(eq(integrationSyncJobs.id, id));
    return job;
  }

  async getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]> {
    let query = db.select().from(integrationSyncJobs)
      .where(eq(integrationSyncJobs.accountId, accountId))
      .orderBy(sql`created_at DESC`);
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined> {
    const [updated] = await db.update(integrationSyncJobs)
      .set(updates)
      .where(eq(integrationSyncJobs.id, id))
      .returning();
    return updated;
  }

  // Email Accounts
  async createEmailAccount(account: InsertEmailAccount, password?: string): Promise<EmailAccount> {
    let accountData = { ...account };
    if (password) {
      const { encrypted, iv } = encryptCredentials({ password });
      accountData.encryptedPassword = encrypted;
      accountData.passwordIv = iv;
    }
    const [newAccount] = await db.insert(emailAccounts).values(accountData).returning();
    return newAccount;
  }

  async getEmailAccount(id: string): Promise<EmailAccount | undefined> {
    const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
    return account;
  }

  async getEmailAccountWithPassword(id: string): Promise<{ account: EmailAccount; password: string | null } | undefined> {
    const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
    if (!account) return undefined;
    
    let password: string | null = null;
    if (account.encryptedPassword && account.passwordIv) {
      try {
        const decrypted = decryptCredentials(account.encryptedPassword, account.passwordIv) as { password: string };
        password = decrypted.password;
      } catch (e) {
        console.error('Failed to decrypt email password:', e);
      }
    }
    return { account, password };
  }

  async getAllEmailAccounts(userId?: string): Promise<EmailAccount[]> {
    if (userId) {
      return await db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
    }
    return await db.select().from(emailAccounts);
  }

  async updateEmailAccount(id: string, updates: Partial<InsertEmailAccount>, password?: string): Promise<EmailAccount | undefined> {
    let updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
    if (password) {
      const { encrypted, iv } = encryptCredentials({ password });
      updateData.encryptedPassword = encrypted;
      updateData.passwordIv = iv;
    }
    const [updated] = await db.update(emailAccounts)
      .set(updateData)
      .where(eq(emailAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteEmailAccount(id: string): Promise<boolean> {
    await db.delete(emails).where(eq(emails.accountId, id));
    const result = await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Emails
  async createEmail(email: InsertEmail): Promise<Email> {
    const [newEmail] = await db.insert(emails).values(email).returning();
    return newEmail;
  }

  async getEmail(id: string): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email;
  }

  async getEmailByMessageId(accountId: string, messageId: string): Promise<Email | undefined> {
    const results = await db.select().from(emails)
      .where(sql`${emails.accountId} = ${accountId} AND ${emails.messageId} = ${messageId}`);
    return results[0];
  }

  async getEmailsByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]> {
    let query = db.select().from(emails)
      .where(folder 
        ? sql`${emails.accountId} = ${accountId} AND ${emails.folder} = ${folder}`
        : eq(emails.accountId, accountId)
      )
      .orderBy(sql`received_at DESC`);
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getEmailsByCategory(accountId: string, category: string): Promise<Email[]> {
    return await db.select().from(emails)
      .where(sql`${emails.accountId} = ${accountId} AND ${emails.category} = ${category}`)
      .orderBy(sql`received_at DESC`);
  }

  async getAllEmails(options?: { 
    category?: string; 
    importance?: string; 
    isRead?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Email[]> {
    let conditions: any[] = [];
    
    if (options?.category) {
      conditions.push(sql`${emails.category} = ${options.category}`);
    }
    if (options?.importance) {
      conditions.push(sql`${emails.importance} = ${options.importance}`);
    }
    if (options?.isRead !== undefined) {
      conditions.push(sql`${emails.isRead} = ${options.isRead}`);
    }
    
    let query = db.select().from(emails);
    
    if (conditions.length > 0) {
      const combinedCondition = conditions.reduce((acc, cond, idx) => 
        idx === 0 ? cond : sql`${acc} AND ${cond}`
      );
      query = query.where(combinedCondition) as typeof query;
    }
    
    query = query.orderBy(sql`received_at DESC`) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }
    
    return await query;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined> {
    const [updated] = await db.update(emails)
      .set(updates)
      .where(eq(emails.id, id))
      .returning();
    return updated;
  }

  async deleteEmail(id: string): Promise<boolean> {
    await db.delete(emailAttachments).where(eq(emailAttachments.emailId, id));
    const result = await db.delete(emails).where(eq(emails.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getEmailStats(): Promise<{ unreadCount: number; invoiceCount: number; totalEmails: number }> {
    const allEmails = await db.select().from(emails);
    const unreadCount = allEmails.filter(e => !e.isRead).length;
    const invoiceCount = allEmails.filter(e => e.category === 'invoice').length;
    return { unreadCount, invoiceCount, totalEmails: allEmails.length };
  }

  // Email Attachments
  async createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment> {
    const [newAttachment] = await db.insert(emailAttachments).values(attachment).returning();
    return newAttachment;
  }

  async getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
    return await db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
  }

  async getEmailAttachment(id: string): Promise<EmailAttachment | undefined> {
    const [attachment] = await db.select().from(emailAttachments).where(eq(emailAttachments.id, id));
    return attachment;
  }

  async updateEmailAttachment(id: string, updates: Partial<InsertEmailAttachment>): Promise<EmailAttachment | undefined> {
    const [updated] = await db.update(emailAttachments)
      .set(updates)
      .where(eq(emailAttachments.id, id))
      .returning();
    return updated;
  }

  // Invoices
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getAllInvoices(userId?: string, status?: string): Promise<Invoice[]> {
    if (userId && status) {
      return await db.select().from(invoices)
        .where(sql`${invoices.userId} = ${userId} AND ${invoices.status} = ${status}`)
        .orderBy(sql`created_at DESC`);
    } else if (userId) {
      return await db.select().from(invoices)
        .where(eq(invoices.userId, userId))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(invoices).orderBy(sql`created_at DESC`);
  }

  async getUnassignedInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices)
      .where(sql`${invoices.userId} = ${userId} AND ${invoices.expenseReportId} IS NULL`)
      .orderBy(sql`created_at DESC`);
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Expense Reports
  async createExpenseReport(report: InsertExpenseReport): Promise<ExpenseReport> {
    const [newReport] = await db.insert(expenseReports).values(report).returning();
    return newReport;
  }

  async getExpenseReport(id: string): Promise<ExpenseReport | undefined> {
    const [report] = await db.select().from(expenseReports).where(eq(expenseReports.id, id));
    return report;
  }

  async getAllExpenseReports(userId?: string, status?: string): Promise<ExpenseReport[]> {
    if (userId && status) {
      return await db.select().from(expenseReports)
        .where(sql`${expenseReports.userId} = ${userId} AND ${expenseReports.status} = ${status}`)
        .orderBy(sql`created_at DESC`);
    } else if (userId) {
      return await db.select().from(expenseReports)
        .where(eq(expenseReports.userId, userId))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(expenseReports).orderBy(sql`created_at DESC`);
  }

  async updateExpenseReport(id: string, updates: Partial<InsertExpenseReport>): Promise<ExpenseReport | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(expenseReports)
      .set(updateData)
      .where(eq(expenseReports.id, id))
      .returning();
    return updated;
  }

  async deleteExpenseReport(id: string): Promise<boolean> {
    await db.update(invoices)
      .set({ expenseReportId: null })
      .where(eq(invoices.expenseReportId, id));
    const result = await db.delete(expenseReports).where(eq(expenseReports.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getExpenseReportWithInvoices(id: string): Promise<{ report: ExpenseReport; invoices: Invoice[] } | undefined> {
    const [report] = await db.select().from(expenseReports).where(eq(expenseReports.id, id));
    if (!report) return undefined;
    
    const relatedInvoices = await db.select().from(invoices)
      .where(eq(invoices.expenseReportId, id))
      .orderBy(sql`created_at DESC`);
    
    return { report, invoices: relatedInvoices };
  }

  // Avatar Chat History
  async createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory> {
    const [newMessage] = await db.insert(avatarChatHistory).values(message).returning();
    return newMessage;
  }

  async getChatHistory(limit: number = 100): Promise<AvatarChatHistory[]> {
    return await db.select().from(avatarChatHistory)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  async getRecentChatContext(limit: number = 10): Promise<AvatarChatHistory[]> {
    const messages = await db.select().from(avatarChatHistory)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
    return messages.reverse();
  }

  async updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined> {
    const updateData: any = { feedback };
    if (note !== undefined) {
      updateData.feedbackNote = note;
    }
    if (feedback === 1) {
      updateData.isMemorized = 1;
      updateData.memoryWeight = 0.8;
    }
    const [updated] = await db.update(avatarChatHistory)
      .set(updateData)
      .where(eq(avatarChatHistory.id, id))
      .returning();
    return updated;
  }

  async getMemorizedChats(): Promise<AvatarChatHistory[]> {
    return await db.select().from(avatarChatHistory)
      .where(eq(avatarChatHistory.isMemorized, 1))
      .orderBy(sql`memory_weight DESC, created_at DESC`)
      .limit(20);
  }

  // Avatar User Preferences
  async getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined> {
    const [prefs] = await db.select().from(avatarUserPreferences)
      .where(eq(avatarUserPreferences.id, 'singleton'));
    return prefs;
  }

  async updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined> {
    const existing = await this.getAvatarUserPreferences();
    const updateData = { ...updates, updatedAt: new Date() };
    
    if (existing) {
      const [updated] = await db.update(avatarUserPreferences)
        .set(updateData)
        .where(eq(avatarUserPreferences.id, 'singleton'))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(avatarUserPreferences)
        .values({ ...updateData, id: 'singleton' } as any)
        .returning();
      return created;
    }
  }

  // Team Members (总台系统)
  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member;
  }

  async getAllTeamMembers(isActive?: boolean): Promise<TeamMember[]> {
    if (isActive !== undefined) {
      return await db.select().from(teamMembers).where(eq(teamMembers.isActive, isActive));
    }
    return await db.select().from(teamMembers);
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db.update(teamMembers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teamMembers.id, id))
      .returning();
    return updated;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(teamMembers).where(eq(teamMembers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Satellite Devices (分台设备)
  async createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice> {
    const [created] = await db.insert(satelliteDevices).values(device).returning();
    return created;
  }

  async getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined> {
    const [device] = await db.select().from(satelliteDevices).where(eq(satelliteDevices.id, id));
    return device;
  }

  async getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined> {
    const [device] = await db.select().from(satelliteDevices).where(eq(satelliteDevices.deviceId, deviceId));
    return device;
  }

  async getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]> {
    if (status) {
      return await db.select().from(satelliteDevices).where(eq(satelliteDevices.status, status));
    }
    return await db.select().from(satelliteDevices);
  }

  async updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined> {
    const [updated] = await db.update(satelliteDevices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(satelliteDevices.id, id))
      .returning();
    return updated;
  }

  async deleteSatelliteDevice(id: string): Promise<boolean> {
    const result = await db.delete(satelliteDevices).where(eq(satelliteDevices.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Battle Reports (战报)
  async createBattleReport(report: InsertBattleReport): Promise<BattleReport> {
    const [created] = await db.insert(battleReports).values(report).returning();
    return created;
  }

  async getBattleReport(id: string): Promise<BattleReport | undefined> {
    const [report] = await db.select().from(battleReports).where(eq(battleReports.id, id));
    return report;
  }

  async getAllBattleReports(limit?: number): Promise<BattleReport[]> {
    const query = db.select().from(battleReports).orderBy(sql`created_at DESC`);
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateBattleReport(id: string, updates: Partial<InsertBattleReport>): Promise<BattleReport | undefined> {
    const [updated] = await db.update(battleReports)
      .set(updates)
      .where(eq(battleReports.id, id))
      .returning();
    return updated;
  }

  // Kill Switch Logs (熔断日志)
  async createKillSwitchLog(log: InsertKillSwitchLog): Promise<KillSwitchLog> {
    const [created] = await db.insert(killSwitchLogs).values(log).returning();
    return created;
  }

  async getKillSwitchLogs(limit?: number): Promise<KillSwitchLog[]> {
    const query = db.select().from(killSwitchLogs).orderBy(sql`executed_at DESC`);
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateKillSwitchLog(id: string, updates: Partial<InsertKillSwitchLog>): Promise<KillSwitchLog | undefined> {
    const [updated] = await db.update(killSwitchLogs)
      .set(updates)
      .where(eq(killSwitchLogs.id, id))
      .returning();
    return updated;
  }

  // Loyalty Events (忠诚度事件)
  async createLoyaltyEvent(event: InsertLoyaltyEvent): Promise<LoyaltyEvent> {
    const [created] = await db.insert(loyaltyEvents).values(event).returning();
    return created;
  }

  async getLoyaltyEvent(id: string): Promise<LoyaltyEvent | undefined> {
    const [event] = await db.select().from(loyaltyEvents).where(eq(loyaltyEvents.id, id));
    return event;
  }

  async getLoyaltyEventsByMember(memberId: string): Promise<LoyaltyEvent[]> {
    return await db.select().from(loyaltyEvents)
      .where(eq(loyaltyEvents.memberId, memberId))
      .orderBy(sql`detected_at DESC`);
  }

  async getAllLoyaltyEvents(status?: string): Promise<LoyaltyEvent[]> {
    if (status) {
      return await db.select().from(loyaltyEvents)
        .where(eq(loyaltyEvents.status, status))
        .orderBy(sql`detected_at DESC`);
    }
    return await db.select().from(loyaltyEvents).orderBy(sql`detected_at DESC`);
  }

  async updateLoyaltyEvent(id: string, updates: Partial<InsertLoyaltyEvent>): Promise<LoyaltyEvent | undefined> {
    const [updated] = await db.update(loyaltyEvents)
      .set(updates)
      .where(eq(loyaltyEvents.id, id))
      .returning();
    return updated;
  }

  // Project Strategist: Opportunities (商机记录)
  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    const [created] = await db.insert(opportunities).values(opportunity).returning();
    return created;
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return opp;
  }

  async getAllOpportunities(status?: string): Promise<Opportunity[]> {
    if (status) {
      return await db.select().from(opportunities)
        .where(eq(opportunities.status, status))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(opportunities).orderBy(sql`created_at DESC`);
  }

  async getActiveOpportunities(): Promise<Opportunity[]> {
    return await db.select().from(opportunities)
      .where(sql`${opportunities.status} IN ('DETECTED', 'ANALYZING', 'REFINED', 'PROPOSED')`)
      .orderBy(sql`created_at DESC`);
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const [updated] = await db.update(opportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return updated;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    const result = await db.delete(opportunities).where(eq(opportunities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Project Strategist: Refinement Runs (推演运行)
  async createRefinementRun(run: InsertRefinementRun): Promise<RefinementRun> {
    const [created] = await db.insert(refinementRuns).values(run).returning();
    return created;
  }

  async getRefinementRun(id: string): Promise<RefinementRun | undefined> {
    const [run] = await db.select().from(refinementRuns).where(eq(refinementRuns.id, id));
    return run;
  }

  async getRefinementRunsByOpportunity(opportunityId: string): Promise<RefinementRun[]> {
    return await db.select().from(refinementRuns)
      .where(eq(refinementRuns.opportunityId, opportunityId))
      .orderBy(sql`created_at DESC`);
  }

  async getActiveRefinementRuns(): Promise<RefinementRun[]> {
    return await db.select().from(refinementRuns)
      .where(sql`${refinementRuns.status} IN ('PENDING', 'RUNNING')`)
      .orderBy(sql`created_at DESC`);
  }

  async updateRefinementRun(id: string, updates: Partial<InsertRefinementRun>): Promise<RefinementRun | undefined> {
    const [updated] = await db.update(refinementRuns)
      .set(updates)
      .where(eq(refinementRuns.id, id))
      .returning();
    return updated;
  }

  // Project Strategist: Strategy Proposals (策略提案)
  async createStrategyProposal(proposal: InsertStrategyProposal): Promise<StrategyProposal> {
    const [created] = await db.insert(strategyProposals).values(proposal).returning();
    return created;
  }

  async getStrategyProposal(id: string): Promise<StrategyProposal | undefined> {
    const [proposal] = await db.select().from(strategyProposals).where(eq(strategyProposals.id, id));
    return proposal;
  }

  async getProposalsByOpportunity(opportunityId: string): Promise<StrategyProposal[]> {
    return await db.select().from(strategyProposals)
      .where(eq(strategyProposals.opportunityId, opportunityId))
      .orderBy(sql`created_at DESC`);
  }

  async getPendingProposals(): Promise<StrategyProposal[]> {
    return await db.select().from(strategyProposals)
      .where(eq(strategyProposals.status, 'PENDING'))
      .orderBy(sql`created_at DESC`);
  }

  async updateStrategyProposal(id: string, updates: Partial<InsertStrategyProposal>): Promise<StrategyProposal | undefined> {
    const [updated] = await db.update(strategyProposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategyProposals.id, id))
      .returning();
    return updated;
  }

  // Project Strategist: Alignment Signals (价值对齐信号)
  async createAlignmentSignal(signal: InsertAlignmentSignal): Promise<AlignmentSignal> {
    const [created] = await db.insert(alignmentSignals).values(signal).returning();
    return created;
  }

  async getAllAlignmentSignals(processedForTraining?: boolean): Promise<AlignmentSignal[]> {
    if (processedForTraining !== undefined) {
      return await db.select().from(alignmentSignals)
        .where(eq(alignmentSignals.processedForTraining, processedForTraining ? 1 : 0))
        .orderBy(sql`created_at DESC`);
    }
    return await db.select().from(alignmentSignals).orderBy(sql`created_at DESC`);
  }

  async getUnprocessedAlignmentSignals(): Promise<AlignmentSignal[]> {
    return await db.select().from(alignmentSignals)
      .where(eq(alignmentSignals.processedForTraining, 0))
      .orderBy(sql`created_at DESC`);
  }

  async updateAlignmentSignal(id: string, updates: Partial<InsertAlignmentSignal>): Promise<AlignmentSignal | undefined> {
    const [updated] = await db.update(alignmentSignals)
      .set(updates)
      .where(eq(alignmentSignals.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
