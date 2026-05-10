/**
 * 领域存储接口定义
 *
 * 按业务领域拆分的存储接口
 * 每个接口代表一个独立的业务领域
 */

import type {
  User, InsertUser,
  UserSettings, InsertUserSettings,
  Voiceprint, InsertVoiceprint,
  VoiceAuthorization, InsertVoiceAuthorization,
  Person, InsertPerson,
  RelationshipInsight,
  VaultItem, InsertVaultItem,
  Device, InsertDevice,
  RemoteCommand, InsertRemoteCommand,
  SatelliteDevice, InsertSatelliteDevice,
  Project, InsertProject,
  ProjectNote, InsertProjectNote,
  ProjectFile, InsertProjectFile,
  ProjectTemplate, InsertProjectTemplate,
  TalkSession, InsertTalkSession,
  ConversationSegment, InsertConversationSegment,
  ExtractedEntity, InsertExtractedEntity,
  OpportunitySignal, InsertOpportunitySignal,
  AuditLog, InsertAuditLog,
  ExpertDecision, InsertExpertDecision,
  EvolutionEvent, InsertEvolutionEvent,
  DailyReport, InsertDailyReport,
  IntegrationProvider, InsertIntegrationProvider,
  IntegrationAccount, InsertIntegrationAccount,
  IntegrationSyncJob, InsertIntegrationSyncJob,
  ShadowMemory, InsertShadowMemory,
  DownloadTask, InsertDownloadTask,
  ComputeJob, InsertComputeJob,
  DreamLog, InsertDreamLog,
} from '@shared/schema';

export interface IUserStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

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
}

export interface IPersonStorage {
  getPerson(id: string): Promise<Person | undefined>;
  getAllPersons(accessLevel?: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<boolean>;
  searchPersonsByWeakness(keyword: string): Promise<Person[]>;
  findConflictingRelationships(personId: string): Promise<Person[]>;
  getRelationshipInsight(personName: string): Promise<RelationshipInsight | null>;
  getPersonsByApprovalStatus(status: string): Promise<Person[]>;
  getPersonsByOrganization(organization: string): Promise<Person[]>;
}

export interface IVaultStorage {
  getVaultItem(id: string): Promise<VaultItem | undefined>;
  getAllVaultItems(zone?: string): Promise<VaultItem[]>;
  createVaultItem(item: InsertVaultItem): Promise<VaultItem>;
  updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined>;
  deleteVaultItem(id: string): Promise<boolean>;
  searchVaultBySemanticTag(tag: string): Promise<VaultItem[]>;
  searchVaultByIntent(intent: string): Promise<VaultItem[]>;
}

export interface IDeviceStorage {
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByToken(tokenHash: string): Promise<Device | undefined>;
  getAllDevices(userId?: string): Promise<Device[]>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceHeartbeat(id: string): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;

  getRemoteCommand(id: string): Promise<RemoteCommand | undefined>;
  getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]>;
  getPendingCommands(deviceId: string): Promise<RemoteCommand[]>;
  createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand>;
  updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined>;

  getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined>;
  getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined>;
  getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]>;
  createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice>;
  updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined>;
  deleteSatelliteDevice(id: string): Promise<boolean>;
}

export interface IProjectStorage {
  getProject(id: string): Promise<Project | undefined>;
  getProjects(status?: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
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
}

export interface IConversationStorage {
  createTalkSession(session: InsertTalkSession): Promise<TalkSession>;
  getTalkSession(id: string): Promise<TalkSession | undefined>;
  updateTalkSession(id: string, updates: Partial<InsertTalkSession>): Promise<TalkSession | undefined>;
  getAllTalkSessions(limit?: number): Promise<TalkSession[]>;

  createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment>;
  getSessionSegments(sessionId: string): Promise<ConversationSegment[]>;

  createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity>;
  getSessionEntities(sessionId: string): Promise<ExtractedEntity[]>;
  updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined>;

  createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal>;
  getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]>;
  updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined>;
}

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
}

export interface IIntegrationStorage {
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
}

export interface IMemoryStorage {
  getAllMemories(): Promise<ShadowMemory[]>;
  createMemory(memory: InsertShadowMemory): Promise<ShadowMemory>;
}

export interface IJobStorage {
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
}

export interface IVaultStats {
  totalDownloads: number;
  activeDownloads: number;
  totalComputeJobs: number;
  activeComputeJobs: number;
  totalDreams: number;
  categories: Record<string, number>;
}
