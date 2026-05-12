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
} from '@shared/schema';

export interface ConversationData {
  id: string;
  userId: string;
  messages: unknown[];
  state: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

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

  getHPBalance(): Promise<{ balance: number; maxBalance: number; totalConsumed: number; totalRecharged: number }>;
  consumeHP(amount: number, reason: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }>;
  consumeHPWithLock(amount: number, reason: string, userId?: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }>;
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

  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByToken(tokenHash: string): Promise<Device | undefined>;
  getAllDevices(userId?: string): Promise<Device[]>;
  updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceHeartbeat(id: string): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;

  createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand>;
  getRemoteCommand(id: string): Promise<RemoteCommand | undefined>;
  getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]>;
  getPendingCommands(deviceId: string): Promise<RemoteCommand[]>;
  updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined>;

  createGeneratedFile(file: InsertGeneratedFile): Promise<GeneratedFile>;
  getGeneratedFile(id: string): Promise<GeneratedFile | undefined>;
  getGeneratedFiles(projectId?: string): Promise<GeneratedFile[]>;
  getGeneratedFilesByReport(reportId: string): Promise<GeneratedFile[]>;
  updateGeneratedFile(id: string, updates: Partial<InsertGeneratedFile>): Promise<GeneratedFile | undefined>;
  deleteGeneratedFile(id: string): Promise<boolean>;

  createTalkSession(session: InsertTalkSession): Promise<TalkSession>;
  getTalkSession(id: string): Promise<TalkSession | undefined>;
  updateTalkSession(id: string, updates: Partial<TalkSession>): Promise<TalkSession | undefined>;
  getAllTalkSessions(limit?: number): Promise<TalkSession[]>;

  saveConversation(conversationId: string, data: ConversationData): Promise<void>;
  getConversation(conversationId: string): Promise<ConversationData | undefined>;
  deleteConversation(conversationId: string): Promise<void>;
  getUserConversations(userId: string, limit?: number): Promise<ConversationData[]>;

  createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment>;
  getSessionSegments(sessionId: string): Promise<ConversationSegment[]>;

  createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity>;
  getSessionEntities(sessionId: string): Promise<ExtractedEntity[]>;
  updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined>;

  createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal>;
  getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]>;
  updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined>;

  createInspiration(inspiration: InsertInspiration): Promise<Inspiration>;
  getInspiration(id: string): Promise<Inspiration | undefined>;
  getAllInspirations(source?: string, status?: string): Promise<Inspiration[]>;
  getActiveInspirations?(): Promise<Inspiration[]>;
  updateInspiration(id: string, updates: Partial<InsertInspiration>): Promise<Inspiration | undefined>;
  deleteInspiration(id: string): Promise<boolean>;

  createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider>;
  getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined>;
  getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined>;
  getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]>;
  updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined>;

  createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount>;
  getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined>;
  getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined>;
  getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]>;
  updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined>;
  deleteIntegrationAccount(id: string): Promise<boolean>;

  createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob>;
  getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined>;
  getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]>;
  updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined>;

  createChatMessage(message: InsertAvatarChatHistory): Promise<AvatarChatHistory>;
  getChatHistory(limit?: number, scope?: { userId?: string; sessionId?: string; deviceId?: string }): Promise<AvatarChatHistory[]>;
  getRecentChatContext(limit?: number, scope?: { userId?: string; sessionId?: string; deviceId?: string }): Promise<AvatarChatHistory[]>;
  updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined>;
  getMemorizedChats(): Promise<AvatarChatHistory[]>;

  getAvatarUserPreferences(): Promise<AvatarUserPreferences | undefined>;
  updateAvatarUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined>;

  createInsightsProcessing(data: InsertInsightsProcessing): Promise<InsightsProcessing>;
  getInsightsProcessing(id: string): Promise<InsightsProcessing | undefined>;
  getInsightsProcessingBySession(sessionId: string): Promise<InsightsProcessing | undefined>;
  getActiveInsightsProcessing(): Promise<InsightsProcessing[]>;
  updateInsightsProcessing(id: string, updates: Partial<InsertInsightsProcessing>): Promise<InsightsProcessing | undefined>;

  createEmailAccount(account: InsertEmailAccount, password?: string): Promise<EmailAccount>;
  getEmailAccount(id: string): Promise<EmailAccount | undefined>;
  getEmailAccountWithPassword(id: string): Promise<{ account: EmailAccount; password: string | null } | undefined>;
  getAllEmailAccounts(userId?: string): Promise<EmailAccount[]>;
  updateEmailAccount(id: string, updates: Partial<InsertEmailAccount>, password?: string): Promise<EmailAccount | undefined>;
  deleteEmailAccount(id: string): Promise<boolean>;

  createEmail(email: InsertEmail): Promise<Email>;
  getEmail(id: string): Promise<Email | undefined>;
  getEmailByMessageId(accountId: string, messageId: string): Promise<Email | undefined>;
  getEmailsByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]>;
  getEmailsByCategory(accountId: string, category: string): Promise<Email[]>;
  getAllEmails(options?: { accountId?: string; folder?: string; category?: string; importance?: string; isRead?: boolean; limit?: number; offset?: number }): Promise<Email[]>;
  getEmailStats?(): Promise<{ unreadCount: number; invoiceCount: number; totalEmails: number } | undefined>;
  updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined>;
  deleteEmail(id: string): Promise<boolean>;

  createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment>;
  getEmailAttachments(emailId: string): Promise<EmailAttachment[]>;
  getEmailAttachment(id: string): Promise<EmailAttachment | undefined>;
  updateEmailAttachment(id: string, updates: Partial<InsertEmailAttachment>): Promise<EmailAttachment | undefined>;

  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(userId?: string, status?: string): Promise<Invoice[]>;
  getUnassignedInvoices(userId: string): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  createExpenseReport(report: InsertExpenseReport): Promise<ExpenseReport>;
  getExpenseReport(id: string): Promise<ExpenseReport | undefined>;
  getAllExpenseReports(userId?: string, status?: string): Promise<ExpenseReport[]>;
  updateExpenseReport(id: string, updates: Partial<InsertExpenseReport>): Promise<ExpenseReport | undefined>;
  deleteExpenseReport(id: string): Promise<boolean>;
  getExpenseReportWithInvoices(id: string): Promise<{ report: ExpenseReport; invoices: Invoice[] } | undefined>;

  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getAllTeamMembers(isActive?: boolean): Promise<TeamMember[]>;
  updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice>;
  getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined>;
  getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined>;
  getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]>;
  updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined>;
  deleteSatelliteDevice(id: string): Promise<boolean>;

  createBattleReport(report: InsertBattleReport): Promise<BattleReport>;
  getBattleReport(id: string): Promise<BattleReport | undefined>;
  getAllBattleReports(limit?: number): Promise<BattleReport[]>;
  updateBattleReport(id: string, updates: Partial<InsertBattleReport>): Promise<BattleReport | undefined>;

  createKillSwitchLog(log: InsertKillSwitchLog): Promise<KillSwitchLog>;
  getKillSwitchLogs(limit?: number): Promise<KillSwitchLog[]>;
  updateKillSwitchLog(id: string, updates: Partial<InsertKillSwitchLog>): Promise<KillSwitchLog | undefined>;

  createLoyaltyEvent(event: InsertLoyaltyEvent): Promise<LoyaltyEvent>;
  getLoyaltyEvent(id: string): Promise<LoyaltyEvent | undefined>;
  getLoyaltyEventsByMember(memberId: string): Promise<LoyaltyEvent[]>;
  getAllLoyaltyEvents(status?: string): Promise<LoyaltyEvent[]>;
  updateLoyaltyEvent(id: string, updates: Partial<InsertLoyaltyEvent>): Promise<LoyaltyEvent | undefined>;

  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getAllOpportunities(status?: string): Promise<Opportunity[]>;
  getActiveOpportunities(): Promise<Opportunity[]>;
  updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;

  createRefinementRun(run: InsertRefinementRun): Promise<RefinementRun>;
  getRefinementRun(id: string): Promise<RefinementRun | undefined>;
  getRefinementRunsByOpportunity(opportunityId: string): Promise<RefinementRun[]>;
  getActiveRefinementRuns(): Promise<RefinementRun[]>;
  updateRefinementRun(id: string, updates: Partial<InsertRefinementRun>): Promise<RefinementRun | undefined>;

  createStrategyProposal(proposal: InsertStrategyProposal): Promise<StrategyProposal>;
  getStrategyProposal(id: string): Promise<StrategyProposal | undefined>;
  getProposalsByOpportunity(opportunityId: string): Promise<StrategyProposal[]>;
  getPendingProposals(): Promise<StrategyProposal[]>;
  updateStrategyProposal(id: string, updates: Partial<InsertStrategyProposal>): Promise<StrategyProposal | undefined>;

  createAlignmentSignal(signal: InsertAlignmentSignal): Promise<AlignmentSignal>;
  getAllAlignmentSignals(processedForTraining?: boolean): Promise<AlignmentSignal[]>;
  getUnprocessedAlignmentSignals(): Promise<AlignmentSignal[]>;
  updateAlignmentSignal(id: string, updates: Partial<InsertAlignmentSignal>): Promise<AlignmentSignal | undefined>;
}
