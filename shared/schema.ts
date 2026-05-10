// @ts-nocheck
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, numeric, serial, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Z2 Schema: Relationship Matrix (人际关系网/博弈表) ===
export const persons = pgTable("persons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"),
  organization: text("organization"),
  tags: text("tags").array(),

  weakness: text("weakness"),
  interestChain: jsonb("interest_chain"),
  decisionStyle: text("decision_style"),
  decisionDna: text("decision_dna"),
  lastInteraction: timestamp("last_interaction"),

  connectionNodes: text("connection_nodes").array(),
  bondStrength: real("bond_strength").default(0.5),
  conflictPoints: text("conflict_points").array(),

  accessLevel: text("access_level").default("ZONE_BLUE"),
  approvalStatus: text("approval_status").default("PENDING"),
  addedBy: text("added_by").default("AI"),

  capabilities: text("capabilities").array(),
  capabilityLevel: jsonb("capability_level"),
  specialties: text("specialties").array(),
  capabilityIndexedAt: timestamp("capability_indexed_at"),

  // Oracle预言家协议字段
  responsePattern: jsonb("response_pattern"), // 回复风格模式 {avgResponseTime, preferredChannels, communicationStyle}
  commitmentRate: real("commitment_rate").default(0.5), // 承诺达成率 0-1
  negotiationStyle: text("negotiation_style"), // 谈判风格: aggressive/cooperative/analytical/diplomatic
  historicalDecisions: jsonb("historical_decisions"), // 历史决策记录数组
  predictedBehaviors: jsonb("predicted_behaviors"), // 预测的行为模式
  riskFactors: jsonb("risk_factors"), // 风险因素评估
  lastPredictionUpdate: timestamp("last_prediction_update"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPersonSchema = createInsertSchema(persons).omit({
  id: true,
  createdAt: true,
});

export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof persons.$inferSelect;

// === Z2 Schema: Team Capability Index (团队能力索引) ===
export const teamCapabilityIndex = pgTable("team_capability_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capability: text("capability").notNull(),
  category: text("category").notNull(),

  personIds: text("person_ids").array(),
  personNames: text("person_names").array(),

  totalCount: integer("total_count").default(0),
  avgLevel: real("avg_level").default(0),

  relatedCapabilities: text("related_capabilities").array(),
  keywords: text("keywords").array(),

  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamCapabilityIndexSchema = createInsertSchema(teamCapabilityIndex).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export type InsertTeamCapabilityIndex = z.infer<typeof insertTeamCapabilityIndexSchema>;
export type TeamCapabilityIndex = typeof teamCapabilityIndex.$inferSelect;

// === Z2 Schema: Resource Vault (资源堡垒索引) ===
export const vaultItems = pgTable("vault_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileHash: text("file_hash"),
  sourceUrl: text("source_url"),

  sandboxStatus: text("sandbox_status").default("PENDING"),
  semanticTags: text("semantic_tags").array(),
  semanticIndex: text("semantic_index"),
  downloadNode: text("download_node").default("SERVER_01"),

  privacyZone: text("privacy_zone").default("ZONE_GREEN"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVaultItemSchema = createInsertSchema(vaultItems).omit({
  id: true,
  createdAt: true,
});

export type InsertVaultItem = z.infer<typeof insertVaultItemSchema>;
export type VaultItem = typeof vaultItems.$inferSelect;

// === Z2 Schema: Shadow Memory (身外化身学习域/进化记忆) ===
export const shadowMemories = pgTable("shadow_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  context: text("context").notNull(),
  choiceMade: text("choice_made").notNull(),
  rejectedOptions: text("rejected_options").array(),
  mimicryWeight: real("mimicry_weight").default(0.5),

  field: text("field"),
  expPoints: integer("exp_points").default(0),
  unlockedSkills: text("unlocked_skills").array(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShadowMemorySchema = createInsertSchema(shadowMemories).omit({
  id: true,
  createdAt: true,
});

export type InsertShadowMemory = z.infer<typeof insertShadowMemorySchema>;
export type ShadowMemory = typeof shadowMemories.$inferSelect;

// === Legacy User Schema ===
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// === Z1 Schema: User Settings (用户设置/唤醒词配置) ===
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),

  realName: text("real_name"),
  avatarName: text("avatar_name").default('小智'),
  avatarEmoji: text("avatar_emoji").default('🤖'),

  wakeWords: text("wake_words").array().default(sql`ARRAY['小智', '小智小智']`),
  primaryWakeWord: text("primary_wake_word").default('小智'),
  wakeWordSensitivity: real("wake_word_sensitivity").default(0.8),

  voiceEnabled: text("voice_enabled").default('true'),
  voiceGender: text("voice_gender").default('female'),
  voiceSpeed: real("voice_speed").default(1.0),

  notificationLevel: text("notification_level").default('important'),
  autoAnalyze: text("auto_analyze").default('true'),
  screenMonitorInterval: integer("screen_monitor_interval").default(1000),

  expertMode: text("expert_mode").default('LV5'),
  preferredLanguage: text("preferred_language").default('zh-CN'),

  hpBalance: integer("hp_balance").default(1000),
  hpMaxBalance: integer("hp_max_balance").default(1000),
  hpTotalConsumed: integer("hp_total_consumed").default(0),
  hpTotalRecharged: integer("hp_total_recharged").default(0),
  hpLastRechargeAt: timestamp("hp_last_recharge_at"),

  // === Coze API 配置 ===
  cozeApiKey: text("coze_api_key"),
  cozeBotId: text("coze_bot_id"),
  cozeWorkflowId: text("coze_workflow_id"),
  cozeEnabled: text("coze_enabled").default('false'),
  cozeWorkflowDocFormat: text("coze_workflow_doc_format"),
  cozeWorkflowDocPolish: text("coze_workflow_doc_polish"),
  cozeWorkflowDocTranslate: text("coze_workflow_doc_translate"),
  cozeWorkflowDocSummarize: text("coze_workflow_doc_summarize"),
  cozeWorkflowPpt: text("coze_workflow_ppt"),
  cozeWorkflowReport: text("coze_workflow_report"),
  cozeWorkflowCodeReview: text("coze_workflow_code_review"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// === Z2 Relationship Insight Response Type ===
export interface RelationshipInsight {
  person: Person;
  vulnerabilityAnalysis: string;
  interestChainSummary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedApproach: string;
}

// === Z6 Schema: Download Tasks (代下任务队列) ===
export const downloadTasks = pgTable("download_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  category: text("category").notNull(),
  status: text("status").default("PENDING"),
  progress: integer("progress").default(0),
  fileSize: integer("file_size"),
  fileName: text("file_name"),
  sandboxResult: text("sandbox_result"),
  errorMessage: text("error_message"),
  vaultItemId: varchar("vault_item_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertDownloadTaskSchema = createInsertSchema(downloadTasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertDownloadTask = z.infer<typeof insertDownloadTaskSchema>;
export type DownloadTask = typeof downloadTasks.$inferSelect;

// === Z6 Schema: Compute Jobs (重计算任务) ===
export const computeJobs = pgTable("compute_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(),
  status: text("status").default("QUEUED"),
  priority: integer("priority").default(5),
  inputPayload: jsonb("input_payload"),
  outputResult: jsonb("output_result"),
  progress: integer("progress").default(0),
  processingTimeMs: integer("processing_time_ms"),
  sourceDevice: text("source_device").default("Z5_MOBILE"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertComputeJobSchema = createInsertSchema(computeJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertComputeJob = z.infer<typeof insertComputeJobSchema>;
export type ComputeJob = typeof computeJobs.$inferSelect;

// === Z6 Schema: Dream Logs (梦境推演日志) - Phase 3.1 增强 ===
export const dreamLogs = pgTable("dream_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dreamType: text("dream_type").notNull(), // NIGHT_CYCLE, FORCED, SCHEDULED
  simulationCount: integer("simulation_count").default(0),
  decisionsOptimized: integer("decisions_optimized").default(0),
  patchesGenerated: text("patches_generated").array(),
  insightsDiscovered: jsonb("insights_discovered"),
  durationMs: integer("duration_ms"),
  status: text("status").default("SLEEPING"), // SLEEPING, AWAKENED, INTERRUPTED

  // Phase 3.1: 增强梦境日志字段
  dreamDate: timestamp("dream_date"), // 梦境对应的日期
  conversationsProcessed: integer("conversations_processed").default(0),
  entitiesExtracted: integer("entities_extracted").default(0),
  patternsFound: jsonb("patterns_found"), // 发现的模式数组
  emotionalTrend: text("emotional_trend"), // POSITIVE, NEGATIVE, NEUTRAL

  // 技能评估结果
  skillEvaluations: jsonb("skill_evaluations"), // 各领域技能评分
  confidenceAdjustments: jsonb("confidence_adjustments"), // 置信度调整

  // 梦境日志内容
  summary: text("summary"), // 梦境总结文本
  learnings: text("learnings").array(), // 今日学到的新知识
  recommendations: text("recommendations").array(), // 明日关注建议
  relatedPersonIds: text("related_person_ids").array(), // 相关人员ID

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDreamLogSchema = createInsertSchema(dreamLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDreamLog = z.infer<typeof insertDreamLogSchema>;
export type DreamLog = typeof dreamLogs.$inferSelect;

// === Phase 3.1: Conversation Insights (对话洞察提取) ===
export const conversationInsights = pgTable("conversation_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dreamLogId: varchar("dream_log_id"), // 关联的梦境日志

  // 洞察来源
  sourceDate: timestamp("source_date").notNull(), // 对话日期
  conversationCount: integer("conversation_count").default(0), // 处理的对话数量

  // 提取的实体
  mentionedPersons: text("mentioned_persons").array(), // 提及的人员名称
  mentionedTopics: text("mentioned_topics").array(), // 提及的话题
  mentionedOrganizations: text("mentioned_organizations").array(), // 提及的组织

  // 情感分析
  overallSentiment: real("overall_sentiment").default(0), // -1 到 1
  sentimentBreakdown: jsonb("sentiment_breakdown"), // 各时段情感分布

  // 关键发现
  keyEntities: jsonb("key_entities"), // 关键实体及权重
  interestSignals: jsonb("interest_signals"), // 兴趣信号 (话题频率)
  opportunityHints: jsonb("opportunity_hints"), // 商机暗示
  concernIndicators: jsonb("concern_indicators"), // 担忧指标

  // 行为模式
  frequentQueries: text("frequent_queries").array(), // 频繁查询类型
  preferredInteractionTime: text("preferred_interaction_time"), // 偏好交互时间段
  responsePatterns: jsonb("response_patterns"), // 回复模式分析

  // 处理状态
  isProcessed: boolean("is_processed").default(false),
  processedAt: timestamp("processed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationInsightSchema = createInsertSchema(conversationInsights).omit({
  id: true,
  createdAt: true,
});

export type InsertConversationInsight = z.infer<typeof insertConversationInsightSchema>;
export type ConversationInsight = typeof conversationInsights.$inferSelect;

// === P0: Audit Log Schema (审计日志) ===
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  result: text("result").default("SUCCESS"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// === P1: Z4 Expert Decisions (专家决策持久化) ===
export const expertDecisions = pgTable("expert_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expertType: text("expert_type").notNull(),
  query: text("query").notNull(),
  chainOfThought: jsonb("chain_of_thought"),
  recommendation: text("recommendation"),
  confidence: real("confidence").default(0.5),
  hpCost: integer("hp_cost").default(0),
  appliedToZ1: integer("applied_to_z1").default(0),
  feedbackScore: real("feedback_score"),
  relatedPersonIds: text("related_person_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpertDecisionSchema = createInsertSchema(expertDecisions).omit({
  id: true,
  createdAt: true,
});

export type InsertExpertDecision = z.infer<typeof insertExpertDecisionSchema>;
export type ExpertDecision = typeof expertDecisions.$inferSelect;

// === P1: Evolution Events (进化事件追踪) ===
export const evolutionEvents = pgTable("evolution_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceModule: text("source_module").notNull(),
  eventType: text("event_type").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  deltaDescription: text("delta_description"),
  triggeredBy: text("triggered_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEvolutionEventSchema = createInsertSchema(evolutionEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertEvolutionEvent = z.infer<typeof insertEvolutionEventSchema>;
export type EvolutionEvent = typeof evolutionEvents.$inferSelect;

// === 项目管理 (Project Management) ===
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("BUSINESS"),
  status: text("status").default("PENDING_REVIEW"),
  priority: integer("priority").default(5),

  // 人员角色
  leaderId: varchar("leader_id"),
  responsiblePersonId: varchar("responsible_person_id"),
  relatedPersonIds: text("related_person_ids").array(),
  executorIds: text("executor_ids").array(),
  relatedIntelIds: text("related_intel_ids").array(),

  // 核心要素
  currentConditions: text("current_conditions").array(),
  missingConditions: text("missing_conditions").array(),

  // SWOT分析
  swotAnalysis: jsonb("swot_analysis"),

  legalAnalysis: jsonb("legal_analysis"),
  financeAnalysis: jsonb("finance_analysis"),
  strategyAnalysis: jsonb("strategy_analysis"),

  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === 项目文件 (Project Files) ===
export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").default("OTHER"),
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  fileContent: text("file_content"),
  aiAnalysis: text("ai_analysis"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({
  id: true,
  uploadedAt: true,
});

export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// === 情报条目 (Intel Items) ===
export const intelItems = pgTable("intel_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"),
  source: text("source"),
  category: text("category").default("GENERAL"),

  status: text("status").default("PENDING"),

  relatedPersonId: varchar("related_person_id"),
  relatedProjectId: varchar("related_project_id"),

  riskLevel: text("risk_level").default("LOW"),
  aiSummary: text("ai_summary"),
  aiRecommendation: text("ai_recommendation"),

  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntelItemSchema = createInsertSchema(intelItems).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export type InsertIntelItem = z.infer<typeof insertIntelItemSchema>;
export type IntelItem = typeof intelItems.$inferSelect;

// === 技能胶囊 (Skill Capsules) ===
// Z1 协议: 支持国内 PyPI/NPM 镜像源安装 (铁律5: 依赖显式化)
export const skillCapsules = pgTable("skill_capsules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),

  skillCode: text("skill_code"),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),

  // 依赖配置 (铁律5: 支持国内镜像)
  dependencies: jsonb("dependencies").default({}),
  pipMirror: text("pip_mirror").default("https://pypi.tuna.tsinghua.edu.cn/simple"),
  npmMirror: text("npm_mirror").default("https://registry.npmmirror.com"),
  language: text("language").default("python"), // python, javascript, shell
  entryPoint: text("entry_point"),

  learnedFrom: text("learned_from"),
  isActive: integer("is_active").default(1),
  version: text("version").default("1.0.0"),

  usageCount: integer("usage_count").default(0),
  successRate: real("success_rate").default(1.0),

  // 安全
  sandboxRequired: integer("sandbox_required").default(1),
  permissionsRequired: text("permissions_required").array(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSkillCapsuleSchema = createInsertSchema(skillCapsules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSkillCapsule = z.infer<typeof insertSkillCapsuleSchema>;
export type SkillCapsule = typeof skillCapsules.$inferSelect;

// === 进化状态 (Evolution State) - 单例表 ===
export const evolutionState = pgTable("evolution_state", {
  id: varchar("id").primaryKey().default("singleton"),

  // HP (计算资源点数) 系统
  hpBalance: integer("hp_balance").default(1000),
  hpMaxBalance: integer("hp_max_balance").default(1000),
  hpTotalConsumed: integer("hp_total_consumed").default(0),
  hpTotalRecharged: integer("hp_total_recharged").default(0),
  hpLastRechargeAt: timestamp("hp_last_recharge_at"),

  academicLevel: text("academic_level").default("BACHELOR"),
  academicXp: integer("academic_xp").default(0),
  nextLevelXp: integer("next_level_xp").default(1000),

  localModelProgress: real("local_model_progress").default(0),
  externalCallCount: integer("external_call_count").default(0),
  localCallCount: integer("local_call_count").default(0),

  distillationCount: integer("distillation_count").default(0),
  distilledKnowledgeSize: integer("distilled_knowledge_size").default(0),

  totalSkillCapsules: integer("total_skill_capsules").default(0),
  activeSkillCapsules: integer("active_skill_capsules").default(0),

  totalDreamSessions: integer("total_dream_sessions").default(0),
  totalInsightsDiscovered: integer("total_insights_discovered").default(0),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEvolutionStateSchema = createInsertSchema(evolutionState).omit({
  id: true,
  updatedAt: true,
});

export type InsertEvolutionState = z.infer<typeof insertEvolutionStateSchema>;
export type EvolutionState = typeof evolutionState.$inferSelect;

// === 每日汇报 (Daily Reports) ===
export const dailyReports = pgTable("daily_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportDate: timestamp("report_date").notNull(),

  summary: text("summary"),
  keyEvents: jsonb("key_events"),

  opportunities: jsonb("opportunities"),
  predictions: jsonb("predictions"),
  risks: jsonb("risks"),

  suggestedActions: jsonb("suggested_actions"),

  hpConsumed: integer("hp_consumed").default(0),
  xpGained: integer("xp_gained").default(0),

  isRead: integer("is_read").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReports).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReport = typeof dailyReports.$inferSelect;

// === 生成文件 (Generated Files by AI) ===
export const generatedFiles = pgTable("generated_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  fileType: text("file_type").notNull(),
  content: text("content").notNull(),

  category: text("category").default("DOCUMENT"),

  relatedProjectId: varchar("related_project_id"),
  relatedReportId: varchar("related_report_id"),
  relatedPersonId: varchar("related_person_id"),

  generatedBy: text("generated_by").default("AVATAR"),
  generatorPrompt: text("generator_prompt"),

  exportFormats: text("export_formats").array(),
  downloadCount: integer("download_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGeneratedFileSchema = createInsertSchema(generatedFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGeneratedFile = z.infer<typeof insertGeneratedFileSchema>;
export type GeneratedFile = typeof generatedFiles.$inferSelect;

// === 锚点审批状态扩展 ===
export type PersonApprovalStatus = 'PENDING' | 'CONFIRMED' | 'ON_HOLD' | 'DELETED';

// === 合同管理 (Contracts with Multi-page Support) ===
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),

  status: text("status").default("DRAFT"),

  relatedPersonId: varchar("related_person_id"),
  relatedProjectId: varchar("related_project_id"),

  totalPages: integer("total_pages").default(0),
  contractType: text("contract_type"),

  legalReviewStatus: text("legal_review_status").default("PENDING"),
  financeReviewStatus: text("finance_review_status").default("PENDING"),

  createdBy: text("created_by").default("MASTER"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

// === 合同页面 (Contract Pages) ===
export const contractPages = pgTable("contract_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  pageNumber: integer("page_number").notNull(),

  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),

  captureMethod: text("capture_method"),

  ocrText: text("ocr_text"),
  ocrConfidence: real("ocr_confidence"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractPageSchema = createInsertSchema(contractPages).omit({
  id: true,
  createdAt: true,
});

export type InsertContractPage = z.infer<typeof insertContractPageSchema>;
export type ContractPage = typeof contractPages.$inferSelect;

// === Z1 Schema: Voiceprint Authentication (声纹锁) ===
export const voiceprints = pgTable("voiceprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  label: text("label").default("MASTER"),

  // 声纹特征向量 (MFCC特征)
  featureVector: jsonb("feature_vector"),
  // 采样数据哈希
  sampleHashes: text("sample_hashes").array(),
  // 采样次数
  sampleCount: integer("sample_count").default(0),
  // 置信阈值 (0-1)
  confidenceThreshold: real("confidence_threshold").default(0.75),

  isActive: integer("is_active").default(1),
  lastVerified: timestamp("last_verified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVoiceprintSchema = createInsertSchema(voiceprints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVoiceprint = z.infer<typeof insertVoiceprintSchema>;
export type Voiceprint = typeof voiceprints.$inferSelect;

// === Z1 Schema: Voice Authorization (授权白名单) ===
export const voiceAuthorizations = pgTable("voice_authorizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 授权类型: PERSON(特定人), ACTION(特定操作), TEMPORARY(临时)
  authType: text("auth_type").notNull(),
  // 目标标识 (人名/操作类型)
  target: text("target").notNull(),
  // 授权范围描述
  scope: text("scope"),

  // 授权人 (必须是MASTER)
  grantedBy: text("granted_by").notNull(),
  // 有效期 (null=永久)
  expiresAt: timestamp("expires_at"),

  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVoiceAuthorizationSchema = createInsertSchema(voiceAuthorizations).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceAuthorization = z.infer<typeof insertVoiceAuthorizationSchema>;
export type VoiceAuthorization = typeof voiceAuthorizations.$inferSelect;

// === Z3 Schema: Remote Devices (远程设备注册表) ===
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  deviceName: text("device_name").notNull(),
  deviceType: text("device_type").notNull(), // desktop, mobile, tablet, server

  status: text("status").default("OFFLINE"), // ONLINE, OFFLINE, SLEEPING, BUSY
  capabilities: text("capabilities").array(), // 支持的指令类型

  authTokenHash: text("auth_token_hash"),
  lastSeen: timestamp("last_seen"),
  lastCommandAt: timestamp("last_command_at"),

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
  lastCommandAt: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

// === Z3 Schema: Remote Commands (远程指令历史) ===
export const remoteCommands = pgTable("remote_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),

  commandType: text("command_type").notNull(), // WAKE, SLEEP, SYNC_SESSION, PUSH_MESSAGE, EXECUTE
  payload: jsonb("payload"),

  status: text("status").default("PENDING"), // PENDING, SENT, ACKNOWLEDGED, COMPLETED, FAILED, TIMEOUT
  resultPayload: jsonb("result_payload"),
  errorMessage: text("error_message"),

  issuedBy: text("issued_by").notNull(),
  issuedAt: timestamp("issued_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  completedAt: timestamp("completed_at"),
});

export const insertRemoteCommandSchema = createInsertSchema(remoteCommands).omit({
  id: true,
  issuedAt: true,
  acknowledgedAt: true,
  completedAt: true,
});

export type InsertRemoteCommand = z.infer<typeof insertRemoteCommandSchema>;
export type RemoteCommand = typeof remoteCommands.$inferSelect;

// === Z3 指令类型常量 ===
export const COMMAND_TYPES = {
  WAKE: 'WAKE',           // 唤醒设备
  SLEEP: 'SLEEP',         // 休眠设备
  SYNC_SESSION: 'SYNC_SESSION', // 同步会话
  PUSH_MESSAGE: 'PUSH_MESSAGE', // 推送消息
  EXECUTE: 'EXECUTE',     // 执行自定义指令
  PING: 'PING',           // 心跳检测
} as const;

export type CommandType = keyof typeof COMMAND_TYPES;

// === 智能谈话分析 (Intelligent Talk Analysis) ===

// 谈话类型常量
export const TALK_TYPES = {
  CASUAL: 'CASUAL',           // 闲聊
  MEETING: 'MEETING',         // 会见
  NEGOTIATION: 'NEGOTIATION', // 谈判
  CONFERENCE: 'CONFERENCE',   // 开会
  CONSULTATION: 'CONSULTATION', // 磋商
  BRAINSTORM: 'BRAINSTORM',   // 头脑风暴
  INTERVIEW: 'INTERVIEW',     // 面试
  PITCH: 'PITCH',             // 推销/路演
  UNKNOWN: 'UNKNOWN',         // 未识别
} as const;

export type TalkType = keyof typeof TALK_TYPES;

// 谈话会话表
export const talkSessions = pgTable("talk_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title"),
  talkType: text("talk_type").default("UNKNOWN"),
  talkTypeConfidence: real("talk_type_confidence").default(0),

  status: text("status").default("LISTENING"), // LISTENING, ANALYZING, COMPLETED, CANCELLED
  language: text("language").default("zh-CN"),
  deviceId: text("device_id"),

  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds").default(0),

  summary: text("summary"),
  keyPoints: text("key_points").array(),
  actionItems: text("action_items").array(),
  sentiment: text("sentiment").default("NEUTRAL"), // POSITIVE, NEUTRAL, NEGATIVE, MIXED

  extractedPersonCount: integer("extracted_person_count").default(0),
  extractedProjectCount: integer("extracted_project_count").default(0),
  opportunityCount: integer("opportunity_count").default(0),

  rawTranscript: text("raw_transcript"),
  aiAnalysis: jsonb("ai_analysis"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTalkSessionSchema = createInsertSchema(talkSessions).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
});

export type InsertTalkSession = z.infer<typeof insertTalkSessionSchema>;
export type TalkSession = typeof talkSessions.$inferSelect;

// 对话片段表
export const conversationSegments = pgTable("conversation_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),

  speakerRole: text("speaker_role").default("UNKNOWN"), // MASTER, GUEST_1, GUEST_2, UNKNOWN
  speakerName: text("speaker_name"),
  content: text("content").notNull(),

  timestamp: real("timestamp").default(0), // 秒数
  duration: real("duration").default(0),
  confidence: real("confidence").default(0.8),

  intent: text("intent"), // QUESTION, ANSWER, STATEMENT, REQUEST, OFFER, OBJECTION
  sentiment: text("sentiment"), // POSITIVE, NEUTRAL, NEGATIVE
  importance: integer("importance").default(5), // 1-10

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSegmentSchema = createInsertSchema(conversationSegments).omit({
  id: true,
  createdAt: true,
});

export type InsertConversationSegment = z.infer<typeof insertConversationSegmentSchema>;
export type ConversationSegment = typeof conversationSegments.$inferSelect;

// 提取的实体表
export const extractedEntities = pgTable("extracted_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),

  entityType: text("entity_type").notNull(), // PERSON, COMPANY, PROJECT, PRODUCT, AMOUNT, DATE
  entityValue: text("entity_value").notNull(),
  normalizedValue: text("normalized_value"),

  context: text("context"), // 提取时的上下文
  confidence: real("confidence").default(0.5),

  linkedPersonId: varchar("linked_person_id"),
  linkedProjectId: varchar("linked_project_id"),

  autoCreated: integer("auto_created").default(0), // 0=待确认, 1=已自动创建
  userConfirmed: integer("user_confirmed").default(0),

  metadata: jsonb("metadata"), // 额外信息如职位、联系方式等

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExtractedEntitySchema = createInsertSchema(extractedEntities).omit({
  id: true,
  createdAt: true,
});

export type InsertExtractedEntity = z.infer<typeof insertExtractedEntitySchema>;
export type ExtractedEntity = typeof extractedEntities.$inferSelect;

// 商机信号表
export const opportunitySignals = pgTable("opportunity_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),

  opportunityType: text("opportunity_type").notNull(), // SALES, PARTNERSHIP, INVESTMENT, RECRUITMENT, PROCUREMENT
  title: text("title").notNull(),
  description: text("description"),

  estimatedValue: real("estimated_value"), // 预估价值
  currency: text("currency").default("CNY"),
  probability: real("probability").default(0.5), // 成功概率
  urgency: text("urgency").default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL

  relatedPersonIds: text("related_person_ids").array(),
  relatedProjectId: varchar("related_project_id"),

  keyInsights: text("key_insights").array(), // 关键洞察点
  suggestedActions: text("suggested_actions").array(), // 建议行动

  status: text("status").default("DETECTED"), // DETECTED, CONFIRMED, PURSUING, WON, LOST, DISMISSED

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOpportunitySignalSchema = createInsertSchema(opportunitySignals).omit({
  id: true,
  createdAt: true,
});

export type InsertOpportunitySignal = z.infer<typeof insertOpportunitySignalSchema>;
export type OpportunitySignal = typeof opportunitySignals.$inferSelect;

// === 灵感模块 (Inspirations) ===
export const inspirations = pgTable("inspirations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  source: text("source").notNull().default("MASTER"), // MASTER=主人灵感, AI=小智洞察
  type: text("type").notNull().default("idea"), // idea=想法, opportunity=商机, trend=趋势, warning=风险示警

  title: text("title").notNull(),
  content: text("content"),

  aiSummary: text("ai_summary"),
  aiResearch: jsonb("ai_research"),
  aiRefinedPlan: text("ai_refined_plan"),

  status: text("status").default("draft"), // draft=草稿, researching=研究中, refined=已完善, confirmed=已确认, archived=已归档

  relatedPersonIds: text("related_person_ids").array(),
  relatedProjectId: varchar("related_project_id"),

  priority: integer("priority").default(5),
  isRead: integer("is_read").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInspirationSchema = createInsertSchema(inspirations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInspiration = z.infer<typeof insertInspirationSchema>;
export type Inspiration = typeof inspirations.$inferSelect;

// === 分析进度追踪 (Insights Processing) ===
export const insightsProcessing = pgTable("insights_processing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),

  status: text("status").notNull().default("RECEIVED"), // RECEIVED, TRANSCRIBING, ANALYZING, SUMMARIZING, COMPLETE, FAILED
  percentComplete: integer("percent_complete").default(0),
  etaSeconds: integer("eta_seconds").default(0),

  stage: text("stage").default("transcription"), // transcription, entity_extraction, opportunity_detection, summary
  stageProgress: integer("stage_progress").default(0),

  rawTranscript: text("raw_transcript"),
  processedChunks: integer("processed_chunks").default(0),
  totalChunks: integer("total_chunks").default(0),

  errorMessage: text("error_message"),

  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertInsightsProcessingSchema = createInsertSchema(insightsProcessing).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertInsightsProcessing = z.infer<typeof insertInsightsProcessingSchema>;
export type InsightsProcessing = typeof insightsProcessing.$inferSelect;

// === Integration Schema: 外部系统连接 ===

// 1. 集成提供商目录
export const integrationProviders = pgTable("integration_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  category: text("category").notNull(),
  icon: text("icon"),
  description: text("description"),
  configSchema: jsonb("config_schema"),
  capabilities: text("capabilities").array(),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntegrationProviderSchema = createInsertSchema(integrationProviders).omit({
  id: true,
  createdAt: true,
});

export type InsertIntegrationProvider = z.infer<typeof insertIntegrationProviderSchema>;
export type IntegrationProvider = typeof integrationProviders.$inferSelect;

// 2. 用户集成账户（凭证加密存储）
export const integrationAccounts = pgTable("integration_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  name: text("name").notNull(),
  encryptedCredentials: text("encrypted_credentials"),
  credentialsIv: text("credentials_iv"),
  status: text("status").default("pending"),
  lastConnectedAt: timestamp("last_connected_at"),
  lastError: text("last_error"),
  config: jsonb("config"),
  syncEnabled: text("sync_enabled").default("false"),
  syncInterval: integer("sync_interval").default(3600),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntegrationAccountSchema = createInsertSchema(integrationAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIntegrationAccount = z.infer<typeof insertIntegrationAccountSchema>;
export type IntegrationAccount = typeof integrationAccounts.$inferSelect;

// 3. 同步任务记录
export const integrationSyncJobs = pgTable("integration_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  jobType: text("job_type").notNull(),
  status: text("status").default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  itemsProcessed: integer("items_processed").default(0),
  itemsFailed: integer("items_failed").default(0),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntegrationSyncJobSchema = createInsertSchema(integrationSyncJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertIntegrationSyncJob = z.infer<typeof insertIntegrationSyncJobSchema>;
export type IntegrationSyncJob = typeof integrationSyncJobs.$inferSelect;

// === Email Schema: 邮件管理 ===

// 邮件账户配置
export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(), // gmail, 126, outlook, qq
  email: text("email").notNull(),
  displayName: text("display_name"),

  // IMAP配置（加密存储）
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").default(993),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(465),
  encryptedPassword: text("encrypted_password"),
  passwordIv: text("password_iv"),

  // OAuth配置（如果使用OAuth）
  oauthTokens: jsonb("oauth_tokens"),

  status: text("status").default("pending"), // pending, active, error, disconnected
  lastError: text("last_error"),
  lastSyncAt: timestamp("last_sync_at"),
  syncEnabled: boolean("sync_enabled").default(true),
  syncFolders: text("sync_folders").array().default(sql`ARRAY['INBOX']`),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;

// 邮件存储
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  messageId: text("message_id").notNull(), // 邮件唯一ID
  threadId: text("thread_id"), // 邮件线程ID

  folder: text("folder").default("INBOX"),
  subject: text("subject"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  toEmails: text("to_emails").array(),
  ccEmails: text("cc_emails").array(),

  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  snippet: text("snippet"), // 预览文本

  hasAttachments: boolean("has_attachments").default(false),
  attachmentCount: integer("attachment_count").default(0),

  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  isArchived: boolean("is_archived").default(false),

  // AI分析结果
  category: text("category"), // invoice, report, quotation, travel, personal, work
  aiSummary: text("ai_summary"),
  extractedData: jsonb("extracted_data"), // 提取的结构化数据
  importance: text("importance").default("normal"), // low, normal, high, urgent

  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
});

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

// 邮件附件
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  contentId: text("content_id"),

  // 存储路径或base64内容
  storagePath: text("storage_path"),

  // 发票/报价单识别
  documentType: text("document_type"), // invoice, quotation, receipt, contract, other
  extractedData: jsonb("extracted_data"),
  ocrText: text("ocr_text"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;
export type EmailAttachment = typeof emailAttachments.$inferSelect;

// === Expense Schema: 报销管理 ===

// 发票记录
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),

  // 来源
  sourceType: text("source_type").notNull(), // email, wecom, manual, photo
  sourceId: text("source_id"), // 对应邮件ID或企微消息ID

  // 发票基本信息
  invoiceNo: text("invoice_no"),
  invoiceCode: text("invoice_code"),
  invoiceType: text("invoice_type"), // vat_normal, vat_special, electronic, receipt

  // 金额信息
  amount: numeric("amount", { precision: 12, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),

  // 开票信息
  sellerName: text("seller_name"),
  sellerTaxNo: text("seller_tax_no"),
  buyerName: text("buyer_name"),
  buyerTaxNo: text("buyer_tax_no"),

  // 发票内容
  items: jsonb("items"), // [{name, quantity, unitPrice, amount}]
  invoiceDate: timestamp("invoice_date"),

  // 附件
  imagePath: text("image_path"),
  pdfPath: text("pdf_path"),

  // 状态
  status: text("status").default("pending"), // pending, verified, submitted, approved, rejected, reimbursed
  verificationResult: jsonb("verification_result"),

  // 关联报销单
  expenseReportId: varchar("expense_report_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// 报销申请
export const expenseReports = pgTable("expense_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),

  title: text("title").notNull(),
  description: text("description"),

  // 报销类型
  expenseType: text("expense_type").notNull(), // travel, meal, transport, office, other

  // 关联出差申请（来自企微）
  travelRequestId: text("travel_request_id"),
  travelRequestData: jsonb("travel_request_data"),

  // 金额汇总
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default('0'),
  invoiceCount: integer("invoice_count").default(0),

  // 状态
  status: text("status").default("draft"), // draft, pending, approved, rejected, paid
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  rejectReason: text("reject_reason"),

  // AI生成的摘要
  aiSummary: text("ai_summary"),
  aiRecommendations: jsonb("ai_recommendations"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseReportSchema = createInsertSchema(expenseReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExpenseReport = z.infer<typeof insertExpenseReportSchema>;
export type ExpenseReport = typeof expenseReports.$inferSelect;

// === 小智对话历史 (Avatar Chat History) ===
export const avatarChatHistory = pgTable("avatar_chat_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),

  // 对话元数据
  intent: text("intent"), // 用户意图分类
  emotion: text("emotion"), // 情绪标记
  topicTags: text("topic_tags").array(), // 话题标签

  // 用户反馈
  feedback: integer("feedback"), // -1=差, 0=一般, 1=好
  feedbackNote: text("feedback_note"), // 用户备注

  // 是否被记忆（重要对话会被小智记住）
  isMemorized: integer("is_memorized").default(0),
  memoryWeight: real("memory_weight").default(0.5), // 记忆权重

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAvatarChatHistorySchema = createInsertSchema(avatarChatHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertAvatarChatHistory = z.infer<typeof insertAvatarChatHistorySchema>;
export type AvatarChatHistory = typeof avatarChatHistory.$inferSelect;

// === 小智用户偏好学习 (Avatar User Preferences Learning) ===
export const avatarUserPreferences = pgTable("avatar_user_preferences", {
  id: varchar("id").primaryKey().default("singleton"),

  // 称呼偏好
  preferredName: text("preferred_name"), // 主人喜欢被怎么称呼
  masterTitle: text("master_title").default("主人"), // 小智怎么称呼用户（主人/爸爸/老板等）

  // 话题偏好
  favoriteTopics: text("favorite_topics").array(), // 主人常聊的话题
  avoidTopics: text("avoid_topics").array(), // 主人不想聊的话题

  // 时间偏好
  activeHours: jsonb("active_hours"), // 主人活跃时间段

  // 沟通风格偏好
  preferredStyle: text("preferred_style").default("warm"), // warm, professional, playful
  preferredLength: text("preferred_length").default("medium"), // short, medium, long

  // 自定义指令/规则
  customRules: text("custom_rules").array(), // 用户设定的自定义规则

  // 从反馈中学到的
  learnedPatterns: jsonb("learned_patterns"), // 学到的回复模式
  positiveExamples: text("positive_examples").array(), // 好评回复示例
  negativeExamples: text("negative_examples").array(), // 差评回复示例

  // 统计
  totalChats: integer("total_chats").default(0),
  positiveCount: integer("positive_count").default(0),
  negativeCount: integer("negative_count").default(0),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAvatarUserPreferencesSchema = createInsertSchema(avatarUserPreferences).omit({
  id: true,
  updatedAt: true,
});

export type InsertAvatarUserPreferences = z.infer<typeof insertAvatarUserPreferencesSchema>;
export type AvatarUserPreferences = typeof avatarUserPreferences.$inferSelect;

// === Project Chrysalis: 失败标签 (Failure Tags for Evolution) ===
export const failureTags = pgTable("failure_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  tagType: text("tag_type").notNull(), // UNANSWERED, EXECUTION_ERROR, USER_CORRECTION
  sourceModule: text("source_module"), // chat, executor, vision, etc.

  originalQuery: text("original_query"),
  failureReason: text("failure_reason"),
  userCorrection: text("user_correction"),

  context: jsonb("context"),
  deviceId: text("device_id"),

  isProcessed: integer("is_processed").default(0),
  processedAt: timestamp("processed_at"),
  evolutionResult: jsonb("evolution_result"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFailureTagSchema = createInsertSchema(failureTags).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertFailureTag = z.infer<typeof insertFailureTagSchema>;
export type FailureTag = typeof failureTags.$inferSelect;

// === Project Chrysalis: RAG知识库 (Evolved Knowledge Base) ===
export const ragKnowledge = pgTable("rag_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  category: text("category").notNull(), // pitfall_guide, negotiation_tactic, legal_pattern, etc.
  title: text("title").notNull(),
  content: text("content").notNull(),

  sourceFailureId: varchar("source_failure_id"),
  confidence: real("confidence").default(0.5),
  usageCount: integer("usage_count").default(0),
  successRate: real("success_rate").default(1.0),

  embedding: text("embedding"),
  keywords: text("keywords").array(),

  isActive: integer("is_active").default(1),
  version: integer("version").default(1),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRagKnowledgeSchema = createInsertSchema(ragKnowledge).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRagKnowledge = z.infer<typeof insertRagKnowledgeSchema>;
export type RagKnowledge = typeof ragKnowledge.$inferSelect;

// === Project Chrysalis: 视觉模式 (Vision Pattern Learning) ===
export const visionPatterns = pgTable("vision_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  patternType: text("pattern_type").notNull(), // contract_layout, ui_element, document_structure
  patternName: text("pattern_name").notNull(),
  description: text("description"),

  recognitionRules: jsonb("recognition_rules"),
  extractionTemplate: text("extraction_template"),

  sampleImagePaths: text("sample_image_paths").array(),
  trainingCount: integer("training_count").default(0),
  accuracy: real("accuracy").default(0.5),

  isActive: integer("is_active").default(1),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVisionPatternSchema = createInsertSchema(visionPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVisionPattern = z.infer<typeof insertVisionPatternSchema>;
export type VisionPattern = typeof visionPatterns.$inferSelect;

// === Project Chrysalis: 代码补丁 (Self-Generated Code Patches) ===
export const codePatches = pgTable("code_patches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  targetModule: text("target_module").notNull(),
  patchType: text("patch_type").notNull(), // optimization, bugfix, feature

  originalCode: text("original_code"),
  patchedCode: text("patched_code"),
  patchDescription: text("patch_description"),

  performanceGain: real("performance_gain"),
  testsPassed: integer("tests_passed").default(0),
  testsTotal: integer("tests_total").default(0),

  sandboxResult: text("sandbox_result"), // PASS, FAIL, PENDING
  appliedAt: timestamp("applied_at"),
  rollbackAt: timestamp("rollback_at"),

  isDeployed: integer("is_deployed").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCodePatchSchema = createInsertSchema(codePatches).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
  rollbackAt: true,
});

export type InsertCodePatch = z.infer<typeof insertCodePatchSchema>;
export type CodePatch = typeof codePatches.$inferSelect;

// === Project Chrysalis: 晨间礼物 (Morning Gift Reports) ===
export const morningGifts = pgTable("morning_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  giftDate: timestamp("gift_date").notNull(),

  evolutionSummary: text("evolution_summary"),
  evolutionDetails: jsonb("evolution_details"),

  opportunities: jsonb("opportunities"),
  risks: jsonb("risks"),
  secretWeapons: jsonb("secret_weapons"),

  todayFocus: text("today_focus").array(),
  preparedActions: jsonb("prepared_actions"),

  performanceBoost: text("performance_boost"),
  newCapabilities: text("new_capabilities").array(),

  isRead: integer("is_read").default(0),
  readAt: timestamp("read_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMorningGiftSchema = createInsertSchema(morningGifts).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertMorningGift = z.infer<typeof insertMorningGiftSchema>;
export type MorningGift = typeof morningGifts.$inferSelect;

// === 小智知识库: 本地文件索引 (Local File Index) ===
export const fileIndex = pgTable("file_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 文件基础信息
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileExtension: text("file_extension"),
  fileSize: integer("file_size").default(0),
  mimeType: text("mime_type"),

  // 文件分类
  category: text("category").default("其他"), // 文档、图片、视频、音乐、代码等

  // === 多分身架构字段 ===
  // 所属工作空间
  workspaceId: varchar("workspace_id"),
  // 所有者分身
  ownerAvatarId: varchar("owner_avatar_id"),
  // 可见性范围: PERSONAL(私人), TEAM_SHARED(团队共享), EXECUTIVE_ONLY(老板专属)
  visibilityScope: text("visibility_scope").default("PERSONAL"),

  // 内容索引
  contentPreview: text("content_preview"), // 前500字内容预览
  contentHash: text("content_hash"), // SHA-256 内容哈希用于去重
  fullTextIndex: text("full_text_index"), // 全文索引用于搜索

  // AI标签和摘要
  aiTags: text("ai_tags").array(),
  aiSummary: text("ai_summary"),
  aiKeywords: text("ai_keywords").array(),

  // 语义向量 (用于相似度搜索)
  embeddingVector: jsonb("embedding_vector"),

  // 版本信息
  currentVersion: integer("current_version").default(1),
  isLatestVersion: integer("is_latest_version").default(1),

  // 元数据
  fileCreatedAt: timestamp("file_created_at"),
  fileModifiedAt: timestamp("file_modified_at"),
  lastIndexedAt: timestamp("last_indexed_at").defaultNow(),

  // 索引状态
  indexStatus: text("index_status").default("PENDING"), // PENDING, INDEXED, FAILED, OUTDATED
  errorMessage: text("error_message"),

  // 访问统计
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileIndexSchema = createInsertSchema(fileIndex).omit({
  id: true,
  createdAt: true,
  lastIndexedAt: true,
});

export type InsertFileIndex = z.infer<typeof insertFileIndexSchema>;
export type FileIndex = typeof fileIndex.$inferSelect;

// === 小智知识库: 索引目录配置 (Index Directory Config) ===
export const indexDirectories = pgTable("index_directories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  directoryPath: text("directory_path").notNull(),
  directoryName: text("directory_name").notNull(),

  // 是否递归索引子目录
  isRecursive: integer("is_recursive").default(1),
  // 是否启用
  isEnabled: integer("is_enabled").default(1),
  // 排除的文件/目录模式
  excludePatterns: text("exclude_patterns").array(),
  // 只包含的文件类型
  includeExtensions: text("include_extensions").array(),

  // 索引统计
  totalFiles: integer("total_files").default(0),
  indexedFiles: integer("indexed_files").default(0),
  lastScanAt: timestamp("last_scan_at"),

  // 监控配置
  watchForChanges: integer("watch_for_changes").default(1),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIndexDirectorySchema = createInsertSchema(indexDirectories).omit({
  id: true,
  createdAt: true,
  lastScanAt: true,
});

export type InsertIndexDirectory = z.infer<typeof insertIndexDirectorySchema>;
export type IndexDirectory = typeof indexDirectories.$inferSelect;

// === 小智知识库: 搜索历史 (Search History) ===
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  query: text("query").notNull(),
  searchType: text("search_type").default("keyword"), // keyword, semantic, hybrid

  resultCount: integer("result_count").default(0),
  topResultIds: text("top_result_ids").array(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;

// === 多分身架构: 工作空间 (Workspaces for Multi-Avatar) ===
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  description: text("description"),

  // 工作空间类型: PERSONAL(个人), TEAM(团队), EXECUTIVE(高管专属)
  workspaceType: text("workspace_type").default("PERSONAL"),

  // 所有者ID (创建者)
  ownerId: varchar("owner_id").notNull(),
  ownerRole: text("owner_role").default("MASTER"), // MASTER=老板, EMPLOYEE=员工

  // 存储配额
  storageQuotaBytes: integer("storage_quota_bytes").default(1073741824), // 1GB
  storageUsedBytes: integer("storage_used_bytes").default(0),

  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// === 多分身架构: 分身账户 (Avatar Accounts) ===
export const avatarAccounts = pgTable("avatar_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 分身名称和标识
  avatarName: text("avatar_name").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),

  // 角色: MASTER=老板/创世神, EMPLOYEE=员工, GUEST=访客
  role: text("role").default("EMPLOYEE"),

  // 上级ID (员工的老板)
  supervisorId: varchar("supervisor_id"),

  // 权限级别 1-10 (10最高)
  permissionLevel: integer("permission_level").default(5),

  // 可访问的数据范围
  canAccessTeamData: integer("can_access_team_data").default(1),
  canAccessExecutiveData: integer("can_access_executive_data").default(0),

  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAvatarAccountSchema = createInsertSchema(avatarAccounts).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
});

export type InsertAvatarAccount = z.infer<typeof insertAvatarAccountSchema>;
export type AvatarAccount = typeof avatarAccounts.$inferSelect;

// === 多分身架构: 工作空间成员 (Workspace Members) ===
export const workspaceMembers = pgTable("workspace_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  workspaceId: varchar("workspace_id").notNull(),
  avatarId: varchar("avatar_id").notNull(),

  // 成员角色: OWNER, ADMIN, MEMBER, VIEWER
  memberRole: text("member_role").default("MEMBER"),

  // 权限
  canRead: integer("can_read").default(1),
  canWrite: integer("can_write").default(1),
  canDelete: integer("can_delete").default(0),
  canShare: integer("can_share").default(0),
  canManageMembers: integer("can_manage_members").default(0),

  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;

// === 文件版本管理 (File Versions) ===
export const fileVersions = pgTable("file_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  fileIndexId: varchar("file_index_id").notNull(),

  // 版本号 (语义化版本)
  versionNumber: integer("version_number").default(1),
  versionLabel: text("version_label"), // v1.0, 初稿, 终稿 etc.

  // 内容快照
  contentHash: text("content_hash").notNull(), // SHA-256
  fileSize: integer("file_size").default(0),

  // 变更信息
  changeType: text("change_type").default("MODIFY"), // CREATE, MODIFY, RENAME, MOVE
  changeSummary: text("change_summary"),
  changedBy: varchar("changed_by"), // avatar_id

  // 差异信息
  diffFromPrevious: jsonb("diff_from_previous"), // 与上一版本的差异

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileVersionSchema = createInsertSchema(fileVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;

// === 文件冲突管理 (File Conflicts) ===
export const fileConflicts = pgTable("file_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 冲突类型
  conflictType: text("conflict_type").notNull(), // SAME_NAME_DIFF_CONTENT, SAME_CONTENT_DIFF_NAME, SIMILAR_CONTENT, VERSION_DIVERGE

  // 涉及的文件
  fileAId: varchar("file_a_id").notNull(),
  fileBId: varchar("file_b_id").notNull(),

  // 冲突详情
  fileAPath: text("file_a_path"),
  fileBPath: text("file_b_path"),
  fileAHash: text("file_a_hash"),
  fileBHash: text("file_b_hash"),
  similarityScore: real("similarity_score").default(0), // 0-1 相似度

  // 冲突状态
  status: text("status").default("PENDING"), // PENDING, AUTO_RESOLVED, MANUAL_RESOLVED, IGNORED

  // 解决方案
  resolution: text("resolution"), // KEEP_A, KEEP_B, KEEP_BOTH, MERGE, RENAME
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),

  // AI建议
  aiRecommendation: text("ai_recommendation"),
  aiConfidence: real("ai_confidence").default(0),

  detectedAt: timestamp("detected_at").defaultNow(),
});

export const insertFileConflictSchema = createInsertSchema(fileConflicts).omit({
  id: true,
  detectedAt: true,
  resolvedAt: true,
});

export type InsertFileConflict = z.infer<typeof insertFileConflictSchema>;
export type FileConflict = typeof fileConflicts.$inferSelect;

// === 文件可见性范围 (用于更新 file_index) ===
export type FileVisibilityScope = 'PERSONAL' | 'TEAM_SHARED' | 'EXECUTIVE_ONLY';

// === 文件别名 (用于去重后的引用) ===
export const fileAliases = pgTable("file_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 原始文件引用 (去重后的主文件)
  primaryFileId: varchar("primary_file_id").notNull(),

  // 别名信息
  aliasName: text("alias_name").notNull(),
  aliasPath: text("alias_path").notNull(),

  // 来源
  sourceAvatarId: varchar("source_avatar_id"),
  sourceWorkspaceId: varchar("source_workspace_id"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileAliasSchema = createInsertSchema(fileAliases).omit({
  id: true,
  createdAt: true,
});

export type InsertFileAlias = z.infer<typeof insertFileAliasSchema>;
export type FileAlias = typeof fileAliases.$inferSelect;

// === 专业知识库 (Professional Edge Intelligence) ===

// 法律法规知识条目
export const legalKnowledge = pgTable("legal_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 法条信息
  lawName: text("law_name").notNull(), // 法律名称：民法典、公司法等
  articleNumber: text("article_number"), // 条款编号
  chapterSection: text("chapter_section"), // 章节
  content: text("content").notNull(), // 法条内容

  // 分类标签
  category: text("category").notNull(), // CONTRACT, CORPORATE, LABOR, TAX, TRADE
  tags: text("tags").array(), // 高频标签：违约责任、股权架构、合规审查

  // 向量索引
  embedding: text("embedding"), // JSON序列化的向量
  embeddingModel: text("embedding_model").default("bge-small-zh"),

  // 版本控制
  version: text("version"), // 法规版本/修订日期
  effectiveDate: timestamp("effective_date"),
  isLatest: boolean("is_latest").default(true),

  // 关联案例
  relatedCases: text("related_cases").array(),

  // 设备同步
  syncVersion: integer("sync_version").default(1),
  lastSyncedAt: timestamp("last_synced_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLegalKnowledgeSchema = createInsertSchema(legalKnowledge).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalKnowledge = z.infer<typeof insertLegalKnowledgeSchema>;
export type LegalKnowledge = typeof legalKnowledge.$inferSelect;

// 财务税务知识条目
export const financeKnowledge = pgTable("finance_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 条目信息
  title: text("title").notNull(), // 标题：增值税抵扣规则
  source: text("source"), // 来源：国家税务总局公告2024年第X号
  content: text("content").notNull(), // 内容

  // 分类
  category: text("category").notNull(), // TAX, ACCOUNTING, INVESTMENT, COMPLIANCE
  subCategory: text("sub_category"), // 个税、增值税、企业所得税等
  tags: text("tags").array(),

  // 计算公式（如果适用）
  formulaJson: jsonb("formula_json"), // { name, formula, variables, example }

  // 向量索引
  embedding: text("embedding"),
  embeddingModel: text("embedding_model").default("bge-small-zh"),

  // 版本控制
  version: text("version"),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  isLatest: boolean("is_latest").default(true),

  // 设备同步
  syncVersion: integer("sync_version").default(1),
  lastSyncedAt: timestamp("last_synced_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFinanceKnowledgeSchema = createInsertSchema(financeKnowledge).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFinanceKnowledge = z.infer<typeof insertFinanceKnowledgeSchema>;
export type FinanceKnowledge = typeof financeKnowledge.$inferSelect;

// 知识库同步记录
export const knowledgeSyncLogs = pgTable("knowledge_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 设备信息
  deviceId: varchar("device_id").notNull(),
  deviceType: text("device_type"), // MOBILE, LAPTOP, SERVER

  // 同步内容
  syncType: text("sync_type").notNull(), // FULL, DELTA, PATCH
  knowledgeType: text("knowledge_type").notNull(), // LEGAL, FINANCE, BOTH

  // 同步状态
  status: text("status").default("PENDING"), // PENDING, IN_PROGRESS, COMPLETED, FAILED
  itemsCount: integer("items_count").default(0),
  bytesTransferred: integer("bytes_transferred").default(0),

  // 版本信息
  fromVersion: integer("from_version"),
  toVersion: integer("to_version"),

  // 时间记录
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),

  // 错误信息
  errorMessage: text("error_message"),
});

export const insertKnowledgeSyncLogSchema = createInsertSchema(knowledgeSyncLogs).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertKnowledgeSyncLog = z.infer<typeof insertKnowledgeSyncLogSchema>;
export type KnowledgeSyncLog = typeof knowledgeSyncLogs.$inferSelect;

// 合同分析记录
export const contractAnalysis = pgTable("contract_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 合同信息
  contractName: text("contract_name"),
  contractType: text("contract_type"), // EMPLOYMENT, PURCHASE, SERVICE, NDA, INVESTMENT
  fileSource: text("file_source"), // OCR, PDF, TEXT
  originalText: text("original_text"),

  // 分析结果
  clausesJson: jsonb("clauses_json"), // 条款拆解
  riskPoints: jsonb("risk_points"), // { clause, risk, severity, suggestion }[]
  overallRiskLevel: text("overall_risk_level"), // LOW, MEDIUM, HIGH, CRITICAL

  // 引用的法律依据
  legalReferences: text("legal_references").array(),

  // 分析元数据
  analysisMode: text("analysis_mode").default("OFFLINE"), // OFFLINE, HYBRID, CLOUD
  processingTimeMs: integer("processing_time_ms"),
  modelUsed: text("model_used"),

  // 用户反馈
  userFeedback: text("user_feedback"), // HELPFUL, NOT_HELPFUL, INACCURATE
  feedbackNote: text("feedback_note"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractAnalysisSchema = createInsertSchema(contractAnalysis).omit({
  id: true,
  createdAt: true,
});

export type InsertContractAnalysis = z.infer<typeof insertContractAnalysisSchema>;
export type ContractAnalysis = typeof contractAnalysis.$inferSelect;

// === 动态法律索引系统 (Dynamic Legal Index System) ===

// 法律法规动态索引表 - 存储法规元数据，内容按需下载
export const legalIndex = pgTable("legal_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 法规标识
  lawCode: text("law_code").notNull(), // 法规编号：如 "民法典2021"
  lawName: text("law_name").notNull(), // 法规名称

  // 分类信息
  category: text("category").notNull(), // CONTRACT, CORPORATE, LABOR, TAX, TRADE, IP, CRIMINAL
  subCategory: text("sub_category"), // 细分类别

  // 发布信息
  publishAuthority: text("publish_authority"), // 发布机关
  publishDate: timestamp("publish_date"),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"), // 失效日期（如有）

  // 来源信息
  source: text("source"), // 来源：国务院、人大、最高法等
  sourceUrl: text("source_url"), // 原文链接

  // 内容摘要
  summary: text("summary"), // 法规简介/摘要
  keywords: text("keywords").array(), // 关键词标签
  articleCount: integer("article_count"), // 条款数量

  // 下载状态
  isDownloaded: boolean("is_downloaded").default(false),
  downloadedAt: timestamp("downloaded_at"),
  downloadSize: integer("download_size"), // 字节数

  // 关联知识ID（下载后）
  knowledgeIds: text("knowledge_ids").array(), // 关联的legalKnowledge条目ID

  // 使用统计
  hitCount: integer("hit_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  priority: integer("priority").default(5), // 1-10，优先级越高越优先下载

  // 版本控制
  version: text("version").default("1.0"),
  isLatest: boolean("is_latest").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLegalIndexSchema = createInsertSchema(legalIndex).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalIndex = z.infer<typeof insertLegalIndexSchema>;
export type LegalIndex = typeof legalIndex.$inferSelect;

// === 律师辩护案例学习系统 (Case Studies & Learning System) ===

// 案例库表 - 存储律师辩护案例
export const caseStudies = pgTable("case_studies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 案件基本信息
  caseNumber: text("case_number"), // 案号
  caseName: text("case_name").notNull(), // 案件名称
  caseType: text("case_type").notNull(), // CIVIL, CRIMINAL, ADMINISTRATIVE, LABOR, IP

  // 法院信息
  courtName: text("court_name"), // 审理法院
  courtLevel: text("court_level"), // 基层、中级、高级、最高
  judgmentDate: timestamp("judgment_date"),

  // 当事人
  plaintiff: text("plaintiff"), // 原告/上诉人
  defendant: text("defendant"), // 被告/被上诉人

  // 案件内容
  caseBackground: text("case_background"), // 案件背景
  caseContent: text("case_content"), // 案情详情
  judgmentResult: text("judgment_result"), // 判决结果

  // 辩护策略（核心学习内容）
  winningStrategy: text("winning_strategy"), // 胜诉策略总结
  keyTactics: jsonb("key_tactics"), // 关键战术 { name, description, effect }[]
  legalBasis: text("legal_basis").array(), // 法律依据引用
  evidenceStrategy: text("evidence_strategy"), // 证据策略
  courtArgumentHighlights: text("court_argument_highlights"), // 庭审亮点

  // 学习价值
  lessonsLearned: text("lessons_learned"), // 经验教训
  applicableScenarios: text("applicable_scenarios").array(), // 适用场景
  successIndicators: text("success_indicators").array(), // 成功指标

  // 分析状态
  isAnalyzed: boolean("is_analyzed").default(false),
  analyzedAt: timestamp("analyzed_at"),
  analysisModel: text("analysis_model"), // 使用的AI模型

  // 同步状态
  syncVersion: integer("sync_version").default(1),
  syncedToDevices: text("synced_to_devices").array(),
  lastSyncedAt: timestamp("last_synced_at"),

  // 来源
  sourceType: text("source_type"), // MANUAL, IMPORT, CRAWL
  sourceUrl: text("source_url"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCaseStudySchema = createInsertSchema(caseStudies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCaseStudy = z.infer<typeof insertCaseStudySchema>;
export type CaseStudy = typeof caseStudies.$inferSelect;

// 学习成果/策略模式表 - 从案例中提取的可复用策略
export const learnedPatterns = pgTable("learned_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 模式标识
  patternName: text("pattern_name").notNull(), // 模式名称
  patternCode: text("pattern_code"), // 模式编码（便于引用）

  // 分类
  category: text("category").notNull(), // 同caseType: CIVIL, CRIMINAL等
  subCategory: text("sub_category"), // 细分：劳动争议、合同纠纷等

  // 模式描述
  description: text("description").notNull(), // 详细描述
  coreLogic: text("core_logic"), // 核心逻辑

  // 适用条件
  applicableScenarios: text("applicable_scenarios").array(), // 适用场景
  prerequisites: text("prerequisites").array(), // 前置条件
  contraindications: text("contraindications").array(), // 禁忌情况

  // 执行步骤
  actionSteps: jsonb("action_steps"), // 执行步骤 { step, action, note }[]
  recommendedActions: text("recommended_actions").array(), // 推荐行动

  // 效果评估
  successProbability: real("success_probability"), // 成功概率 0-1
  confidenceScore: real("confidence_score"), // 置信度

  // 来源案例
  derivedFromCases: text("derived_from_cases").array(), // 来源案例ID
  caseCount: integer("case_count").default(1), // 支持案例数量

  // 版本与同步
  version: integer("version").default(1),
  syncStatus: text("sync_status").default("PENDING"), // PENDING, SYNCED, UPDATED
  lastSyncAt: timestamp("last_sync_at"),

  // 使用统计
  usageCount: integer("usage_count").default(0),
  feedbackScore: real("feedback_score"), // 用户反馈评分

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLearnedPatternSchema = createInsertSchema(learnedPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLearnedPattern = z.infer<typeof insertLearnedPatternSchema>;
export type LearnedPattern = typeof learnedPatterns.$inferSelect;

// === 守护天使协议 - 生活数据日志系统 (Project Guardian Angel - Life Logger) ===

// 健康指标记录表 - 心率、睡眠、步数、血氧等
export const healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 数据来源
  deviceId: varchar("device_id"), // 采集设备ID
  deviceType: text("device_type"), // WATCH, PHONE, RING, GLASSES

  // 生命体征
  heartRate: integer("heart_rate"), // 心率 bpm
  heartRateVariability: real("hrv"), // 心率变异性
  bloodOxygen: real("blood_oxygen"), // 血氧 %
  bodyTemperature: real("body_temperature"), // 体温
  bloodPressureSystolic: integer("bp_systolic"), // 收缩压
  bloodPressureDiastolic: integer("bp_diastolic"), // 舒张压

  // 活动数据
  steps: integer("steps"), // 步数
  distance: real("distance"), // 距离 km
  caloriesBurned: integer("calories_burned"), // 消耗卡路里
  activeMinutes: integer("active_minutes"), // 活动分钟数
  standingHours: integer("standing_hours"), // 站立小时数

  // 睡眠数据
  sleepDurationMinutes: integer("sleep_duration_minutes"), // 睡眠时长
  deepSleepMinutes: integer("deep_sleep_minutes"), // 深度睡眠
  lightSleepMinutes: integer("light_sleep_minutes"), // 浅度睡眠
  remSleepMinutes: integer("rem_sleep_minutes"), // REM睡眠
  awakeMinutes: integer("awake_minutes"), // 清醒时间
  sleepQualityScore: real("sleep_quality_score"), // 睡眠质量评分 0-100

  // 压力指标
  stressLevel: real("stress_level"), // 压力指数 0-100
  relaxationScore: real("relaxation_score"), // 放松指数 0-100

  // 时间戳
  recordedAt: timestamp("recorded_at").notNull(), // 记录时间
  periodStart: timestamp("period_start"), // 周期开始（用于睡眠等）
  periodEnd: timestamp("period_end"), // 周期结束

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthMetricsSchema = createInsertSchema(healthMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertHealthMetrics = z.infer<typeof insertHealthMetricsSchema>;
export type HealthMetrics = typeof healthMetrics.$inferSelect;

// 社交互动记录表 - 联系人互动、情绪标记
export const socialInteractions = pgTable("social_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 联系人信息（脱敏）
  contactHash: varchar("contact_hash"), // 联系人哈希（不存真实信息）
  contactAlias: text("contact_alias"), // 用户自定义别名
  contactCategory: text("contact_category"), // FAMILY, FRIEND, COLLEAGUE, BUSINESS, OTHER
  relationshipImportance: integer("relationship_importance"), // 1-10 重要程度

  // 互动信息
  interactionType: text("interaction_type").notNull(), // CALL, MESSAGE, EMAIL, MEETING, SOCIAL_MEDIA
  direction: text("direction"), // INBOUND, OUTBOUND
  durationSeconds: integer("duration_seconds"), // 持续时长

  // 情绪分析（本地AI分析后的结果，不存原始内容）
  emotionalImpact: text("emotional_impact"), // POSITIVE, NEUTRAL, NEGATIVE, STRESSFUL, ENERGIZING
  emotionScore: real("emotion_score"), // -1 到 1，负面到正面
  stressContribution: real("stress_contribution"), // 对压力的贡献 0-1

  // 时间效率
  communicationQuality: real("communication_quality"), // 沟通质量 0-1
  wasProductive: boolean("was_productive"), // 是否有效沟通

  // 上下文（不存敏感内容）
  contextTags: text("context_tags").array(), // 上下文标签：工作、谈判、私人等
  locationCategory: text("location_category"), // HOME, OFFICE, TRAVEL, OTHER

  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSocialInteractionSchema = createInsertSchema(socialInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialInteraction = z.infer<typeof insertSocialInteractionSchema>;
export type SocialInteraction = typeof socialInteractions.$inferSelect;

// 行为规律记录表 - 作息、效率高峰、活动模式
export const behaviorPatterns = pgTable("behavior_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 模式类型
  patternType: text("pattern_type").notNull(), // SLEEP_SCHEDULE, WORK_PEAK, LOCATION_ROUTINE, ACTIVITY_CYCLE

  // 时间特征
  dayOfWeek: integer("day_of_week"), // 0-6 周日到周六
  hourOfDay: integer("hour_of_day"), // 0-23
  isWeekday: boolean("is_weekday"),

  // 效率与能量
  energyLevel: real("energy_level"), // 能量水平 0-100
  focusScore: real("focus_score"), // 专注度 0-100
  productivityScore: real("productivity_score"), // 生产力 0-100

  // 位置模式（仅类别，不存具体地点）
  locationCategory: text("location_category"), // HOME, OFFICE, GYM, RESTAURANT, TRAVEL
  timeAtLocation: integer("time_at_location"), // 在此类地点的时间（分钟）

  // 活动类型
  primaryActivity: text("primary_activity"), // WORK, REST, EXERCISE, SOCIAL, COMMUTE
  screenTime: integer("screen_time"), // 屏幕时间（分钟）

  // 最优时段标记
  isOptimalForWork: boolean("is_optimal_for_work"),
  isOptimalForCreative: boolean("is_optimal_for_creative"),
  isOptimalForSocial: boolean("is_optimal_for_social"),
  isOptimalForRest: boolean("is_optimal_for_rest"),

  // 统计周期
  recordedDate: timestamp("recorded_date").notNull(),
  sampleCount: integer("sample_count").default(1), // 采样次数

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBehaviorPatternSchema = createInsertSchema(behaviorPatterns).omit({
  id: true,
  createdAt: true,
});

export type InsertBehaviorPattern = z.infer<typeof insertBehaviorPatternSchema>;
export type BehaviorPattern = typeof behaviorPatterns.$inferSelect;

// 每日能量报告表 - 汇总分析与建议
export const dailyEnergyReports = pgTable("daily_energy_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 报告日期
  reportDate: timestamp("report_date").notNull(),

  // 能量损耗分析
  totalEnergyScore: real("total_energy_score"), // 总能量评分 0-100
  physicalEnergySpent: real("physical_energy_spent"), // 体力消耗 0-100
  mentalEnergySpent: real("mental_energy_spent"), // 脑力消耗 0-100
  emotionalEnergySpent: real("emotional_energy_spent"), // 情绪消耗 0-100

  // 恢复质量
  sleepRecoveryScore: real("sleep_recovery_score"), // 睡眠恢复分
  restfulnessScore: real("restfulness_score"), // 休息充分度

  // 压力分析
  overallStressLevel: real("overall_stress_level"), // 整体压力 0-100
  stressPeakTime: text("stress_peak_time"), // 压力高峰时段
  stressTriggers: jsonb("stress_triggers"), // 压力触发因素 { source, impact, time }[]

  // 社交健康
  socialHealthScore: real("social_health_score"), // 社交健康度
  positiveInteractions: integer("positive_interactions"), // 积极互动次数
  negativeInteractions: integer("negative_interactions"), // 消极互动次数
  keyRelationshipAlerts: text("key_relationship_alerts").array(), // 需关注的关系

  // 效率分析
  productivityPeakHours: text("productivity_peak_hours").array(), // 效率高峰时段
  focusTimeMinutes: integer("focus_time_minutes"), // 专注时间
  interruptionCount: integer("interruption_count"), // 被打断次数

  // AI生成的洞察
  keyInsights: jsonb("key_insights"), // { category, insight, importance }[]
  anomalies: jsonb("anomalies"), // 异常检测 { metric, value, baseline, deviation }[]

  // 明日最优建议
  tomorrowRecommendations: jsonb("tomorrow_recommendations"), // { category, suggestion, priority, reason }[]
  suggestedWakeTime: text("suggested_wake_time"),
  suggestedSleepTime: text("suggested_sleep_time"),
  suggestedBreakTimes: text("suggested_break_times").array(),
  priorityTasks: text("priority_tasks").array(), // 建议优先处理的事项
  avoidanceRecommendations: text("avoidance_recommendations").array(), // 建议避免的事项

  // 长期趋势
  weeklyTrend: text("weekly_trend"), // IMPROVING, STABLE, DECLINING
  monthlyComparison: real("monthly_comparison"), // 与月均比较

  // AI分析元数据
  analysisModel: text("analysis_model"),
  confidenceScore: real("confidence_score"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDailyEnergyReportSchema = createInsertSchema(dailyEnergyReports).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyEnergyReport = z.infer<typeof insertDailyEnergyReportSchema>;
export type DailyEnergyReport = typeof dailyEnergyReports.$inferSelect;

// === Guardian Angel: Nutrition Tracking (营养追踪) ===
export const mealLogs = pgTable("meal_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  mealType: text("meal_type").notNull(), // BREAKFAST, LUNCH, DINNER, SNACK, DRINK
  description: text("description").notNull(),
  estimatedCalories: integer("estimated_calories").default(0),

  protein: real("protein"), // grams
  carbs: real("carbs"), // grams
  fat: real("fat"), // grams
  fiber: real("fiber"), // grams
  sugar: real("sugar"), // grams
  sodium: real("sodium"), // mg

  caffeineMg: real("caffeine_mg"),
  alcoholUnits: real("alcohol_units"),
  waterMl: integer("water_ml"),

  location: text("location"),
  mood: text("mood"), // HUNGRY, SATISFIED, OVERFULL, NEUTRAL
  tags: text("tags").array(),

  recordedDate: text("recorded_date").notNull(), // YYYY-MM-DD format
  recordedAt: timestamp("recorded_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMealLogSchema = createInsertSchema(mealLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertMealLog = z.infer<typeof insertMealLogSchema>;
export type MealLog = typeof mealLogs.$inferSelect;

// 营养目标表
export const nutritionGoals = pgTable("nutrition_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  dailyCalories: integer("daily_calories").default(2000),
  proteinGrams: integer("protein_grams").default(60),
  carbsGrams: integer("carbs_grams").default(250),
  fatGrams: integer("fat_grams").default(65),
  fiberGrams: integer("fiber_grams").default(25),
  waterMl: integer("water_ml").default(2500),
  caffeineLimit: integer("caffeine_limit").default(400),
  alcoholLimit: integer("alcohol_limit").default(2),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNutritionGoalSchema = createInsertSchema(nutritionGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNutritionGoal = z.infer<typeof insertNutritionGoalSchema>;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;

// === Guardian Angel: Calendar Events (日程事件表) ===
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // MEETING, OFFLINE, REST, EXERCISE, PERSONAL, WORK, HEALTH_CHECK

  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),

  priority: text("priority").default("NORMAL"), // LOW, NORMAL, HIGH, CRITICAL
  isForced: boolean("is_forced").default(false), // System-inserted mandatory events
  isCompleted: boolean("is_completed").default(false),

  fatigueImpact: integer("fatigue_impact").default(0), // -100 to +100 (negative = restful)
  energyRequired: integer("energy_required").default(50), // 0-100 scale

  recurrence: text("recurrence"), // DAILY, WEEKLY, MONTHLY, NONE
  recurrenceEndDate: timestamp("recurrence_end_date"),

  location: text("location"),
  attendees: text("attendees").array(),
  tags: text("tags").array(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// === Guardian Angel: Schedule Settings (调度设置表) ===
export const scheduleSettings = pgTable("schedule_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 强制离线时间
  forcedOfflineEnabled: boolean("forced_offline_enabled").default(true),
  forcedOfflineStart: text("forced_offline_start").default("22:00"), // HH:mm
  forcedOfflineEnd: text("forced_offline_end").default("07:00"),

  // 工作时间限制
  maxWorkHoursPerDay: integer("max_work_hours_per_day").default(10),
  minBreakMinutes: integer("min_break_minutes").default(60), // 每天最少休息分钟

  // 健康优先设置
  healthPriorityLevel: integer("health_priority_level").default(8), // 1-10
  autoInsertRestBreaks: boolean("auto_insert_rest_breaks").default(true),
  restBreakIntervalMinutes: integer("rest_break_interval_minutes").default(90),
  restBreakDurationMinutes: integer("rest_break_duration_minutes").default(15),

  // 疲劳预测调度
  fatigueAwareScheduling: boolean("fatigue_aware_scheduling").default(true),
  lowEnergyMeetingBlock: boolean("low_energy_meeting_block").default(true), // 疲劳时阻止安排会议

  // 睡眠保护
  sleepProtectionEnabled: boolean("sleep_protection_enabled").default(true),
  targetSleepHours: integer("target_sleep_hours").default(7),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertScheduleSettingSchema = createInsertSchema(scheduleSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScheduleSetting = z.infer<typeof insertScheduleSettingSchema>;
export type ScheduleSetting = typeof scheduleSettings.$inferSelect;

// === Guardian Angel: Call Emotion Logs (通话情绪分析) ===
export const callEmotionLogs = pgTable("call_emotion_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  personId: varchar("person_id").references(() => persons.id),

  callDirection: text("call_direction").notNull(), // INCOMING, OUTGOING
  callDuration: integer("call_duration"), // seconds
  callTime: timestamp("call_time").notNull(),

  preCallHeartRate: integer("pre_call_heart_rate"),
  duringCallHeartRate: integer("during_call_heart_rate"),
  postCallHeartRate: integer("post_call_heart_rate"),
  heartRateChange: integer("heart_rate_change"), // positive = stress, negative = calm

  emotionScore: integer("emotion_score"), // -100 to +100 (negative = stressful, positive = happy)
  emotionType: text("emotion_type"), // HAPPY, NEUTRAL, STRESSED, ANXIOUS, CALM

  voiceToneAnalysis: jsonb("voice_tone_analysis"), // pitch, speed, volume patterns
  conversationMood: text("conversation_mood"), // POSITIVE, NEUTRAL, NEGATIVE

  impactOnDay: text("impact_on_day"), // ENERGIZING, NEUTRAL, DRAINING
  suggestedAction: text("suggested_action"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCallEmotionLogSchema = createInsertSchema(callEmotionLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCallEmotionLog = z.infer<typeof insertCallEmotionLogSchema>;
export type CallEmotionLog = typeof callEmotionLogs.$inferSelect;

// === Guardian Angel: Location Patterns (地点规律学习) ===
export const locationPatterns = pgTable("location_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  locationName: text("location_name").notNull(),
  locationType: text("location_type"), // HOME, OFFICE, GYM, RESTAURANT, CLIENT, OTHER

  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),

  visitCount: integer("visit_count").default(1),
  totalDurationMinutes: integer("total_duration_minutes").default(0),
  avgDurationMinutes: integer("avg_duration_minutes").default(0),

  typicalArrivalTime: text("typical_arrival_time"), // HH:mm
  typicalDepartureTime: text("typical_departure_time"),

  weekdayVisits: integer("weekday_visits").default(0),
  weekendVisits: integer("weekend_visits").default(0),

  associatedActivities: text("associated_activities").array(), // WORK, EXERCISE, DINING, MEETING
  associatedContacts: text("associated_contacts").array(),

  energyImpact: integer("energy_impact").default(0), // -100 to +100
  productivityScore: integer("productivity_score").default(50),

  lastVisit: timestamp("last_visit"),
  firstVisit: timestamp("first_visit"),

  isFrequent: boolean("is_frequent").default(false),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLocationPatternSchema = createInsertSchema(locationPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLocationPattern = z.infer<typeof insertLocationPatternSchema>;
export type LocationPattern = typeof locationPatterns.$inferSelect;

// === Guardian Angel: Location Visits (地点访问记录) ===
export const locationVisits = pgTable("location_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  patternId: varchar("pattern_id").references(() => locationPatterns.id),

  arrivalTime: timestamp("arrival_time").notNull(),
  departureTime: timestamp("departure_time"),
  durationMinutes: integer("duration_minutes"),

  dayOfWeek: integer("day_of_week"), // 0-6

  preVisitEnergy: integer("pre_visit_energy"),
  postVisitEnergy: integer("post_visit_energy"),

  activities: text("activities").array(),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLocationVisitSchema = createInsertSchema(locationVisits).omit({
  id: true,
  createdAt: true,
});

export type InsertLocationVisit = z.infer<typeof insertLocationVisitSchema>;
export type LocationVisit = typeof locationVisits.$inferSelect;

// === Project Immune System: 免疫系统协议 ===

// 设备应用列表 (Device Apps - 应用健康档案)
export const deviceApps = pgTable("device_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  deviceId: text("device_id").notNull(),
  packageName: text("package_name").notNull(),
  appName: text("app_name").notNull(),
  version: text("version"),

  // 资源占用
  memoryUsageMb: integer("memory_usage_mb").default(0),
  storageUsageMb: integer("storage_usage_mb").default(0),
  batteryDrainPercent: real("battery_drain_percent").default(0),
  cpuUsagePercent: real("cpu_usage_percent").default(0),
  networkUsageMb: real("network_usage_mb").default(0),

  // 权限分析
  permissionsGranted: text("permissions_granted").array(),
  sensitivePermissions: text("sensitive_permissions").array(), // 敏感权限: 通讯录/位置/相机/麦克风
  permissionRiskScore: integer("permission_risk_score").default(0), // 0-100

  // 行为分析
  backgroundActivity: boolean("background_activity").default(false),
  autoStart: boolean("auto_start").default(false),
  dataLeakRisk: boolean("data_leak_risk").default(false),

  // 威胁评估
  threatLevel: text("threat_level").default("SAFE"), // SAFE, LOW, MEDIUM, HIGH, CRITICAL
  threatReasons: text("threat_reasons").array(),
  isSystemApp: boolean("is_system_app").default(false),
  isTrusted: boolean("is_trusted").default(true),

  // 上次扫描
  lastScannedAt: timestamp("last_scanned_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeviceAppSchema = createInsertSchema(deviceApps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeviceApp = z.infer<typeof insertDeviceAppSchema>;
export type DeviceApp = typeof deviceApps.$inferSelect;

// 免疫扫描记录 (Immune Scans - 体检报告)
export const immuneScans = pgTable("immune_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  deviceId: text("device_id").notNull(),
  scanType: text("scan_type").notNull(), // FULL, QUICK, PERMISSION, MEMORY, MALWARE

  // 扫描结果
  status: text("status").default("RUNNING"), // RUNNING, COMPLETED, FAILED
  appsScanned: integer("apps_scanned").default(0),
  threatsFound: integer("threats_found").default(0),
  warningsFound: integer("warnings_found").default(0),

  // 系统健康指标
  overallHealthScore: integer("overall_health_score").default(100), // 0-100
  memoryHealthScore: integer("memory_health_score").default(100),
  storageHealthScore: integer("storage_health_score").default(100),
  batteryHealthScore: integer("battery_health_score").default(100),
  privacyHealthScore: integer("privacy_health_score").default(100),

  // 资源使用快照
  totalMemoryMb: integer("total_memory_mb"),
  usedMemoryMb: integer("used_memory_mb"),
  totalStorageMb: integer("total_storage_mb"),
  usedStorageMb: integer("used_storage_mb"),
  cacheCleanableMb: integer("cache_cleanable_mb"),

  // 威胁汇总
  topThreats: jsonb("top_threats"), // [{appName, threatLevel, reason}]
  recommendations: text("recommendations").array(),

  // 时间
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertImmuneScanSchema = createInsertSchema(immuneScans).omit({
  id: true,
  createdAt: true,
});

export type InsertImmuneScan = z.infer<typeof insertImmuneScanSchema>;
export type ImmuneScan = typeof immuneScans.$inferSelect;

// 修复行动记录 (Remediation Actions - 净化行动)
export const remediationActions = pgTable("remediation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  scanId: varchar("scan_id").references(() => immuneScans.id),
  deviceId: text("device_id").notNull(),

  actionType: text("action_type").notNull(), // UNINSTALL, FORCE_STOP, CLEAR_CACHE, REVOKE_PERMISSION, DISABLE_AUTOSTART, QUARANTINE
  targetApp: text("target_app").notNull(),
  targetPackage: text("target_package"),

  reason: text("reason").notNull(),
  severity: text("severity").default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL

  // 执行状态
  status: text("status").default("PENDING"), // PENDING, APPROVED, EXECUTING, SUCCESS, FAILED, CANCELLED
  approvedBy: text("approved_by"), // MASTER, AUTO, SYSTEM
  executedVia: text("executed_via"), // SHADOW_OPERATOR, ACCESSIBILITY, ADB, MANUAL

  // 执行结果
  result: jsonb("result"),
  errorMessage: text("error_message"),

  // 资源释放
  memoryFreedMb: integer("memory_freed_mb"),
  storageFreedMb: integer("storage_freed_mb"),

  // 时间
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRemediationActionSchema = createInsertSchema(remediationActions).omit({
  id: true,
  createdAt: true,
});

export type InsertRemediationAction = z.infer<typeof insertRemediationActionSchema>;
export type RemediationAction = typeof remediationActions.$inferSelect;

// 自我升级包 (Self Upgrade Packages - 进化包)
export const upgradePackages = pgTable("upgrade_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  version: text("version").notNull(),
  targetModule: text("target_module").notNull(), // CORE, IMMUNE, SHADOW, EXPERT, UI

  // 升级内容
  description: text("description"),
  changeLog: text("change_log").array(),

  // 包信息
  packageUrl: text("package_url"),
  packageHash: text("package_hash"),
  packageSizeMb: real("package_size_mb"),

  // 状态
  status: text("status").default("PENDING"), // PENDING, APPROVED, DOWNLOADING, INSTALLING, SUCCESS, FAILED, ROLLBACK

  // 部署记录
  deployedDevices: text("deployed_devices").array(),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),

  // 时间
  createdAt: timestamp("created_at").defaultNow(),
  releasedAt: timestamp("released_at"),

  createdBy: text("created_by").default("DREAM_EVOLUTION"), // DREAM_EVOLUTION, MANUAL, HOTFIX
});

export const insertUpgradePackageSchema = createInsertSchema(upgradePackages).omit({
  id: true,
  createdAt: true,
});

export type InsertUpgradePackage = z.infer<typeof insertUpgradePackageSchema>;
export type UpgradePackage = typeof upgradePackages.$inferSelect;

// === Project Omni-Archive: 全域归档协议 ===

// 统一通讯录 (Unified Contacts - 单一真相源)
export const unifiedContacts = pgTable("unified_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 基本信息
  name: text("name").notNull(),
  aliases: text("aliases").array(), // 别名列表
  phone: text("phone").array(), // 多个电话
  email: text("email").array(), // 多个邮箱
  wechatId: text("wechat_id"),
  dingdingId: text("dingding_id"),

  // 来源追踪
  sources: jsonb("sources"), // [{platform: 'wechat', deviceId: 'xxx', lastSync: Date}]

  // 社交分析
  role: text("role"), // 决策者、执行者、协调者
  organization: text("organization"),
  department: text("department"),
  importance: integer("importance").default(50), // 0-100 重要程度
  trustScore: integer("trust_score").default(50), // 0-100 信任分数

  // 互动统计
  lastInteraction: timestamp("last_interaction"),
  interactionCount: integer("interaction_count").default(0),
  averageResponseTime: integer("average_response_time"), // 秒
  initiatedByMe: integer("initiated_by_me").default(0), // 我主动联系次数
  initiatedByThem: integer("initiated_by_them").default(0), // 对方主动联系次数

  // 关系标签
  tags: text("tags").array(), // ['客户', '朋友', '供应商']
  notes: text("notes"),

  // 隐私区域
  privacyZone: text("privacy_zone").default("ZONE_BLUE"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUnifiedContactSchema = createInsertSchema(unifiedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUnifiedContact = z.infer<typeof insertUnifiedContactSchema>;
export type UnifiedContact = typeof unifiedContacts.$inferSelect;

// 文件知识库 (File Knowledge - 结构化知识)
export const fileKnowledge = pgTable("file_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 文件信息
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // PDF, DOCX, TXT, IMAGE
  fileHash: text("file_hash"),
  fileSizeKb: integer("file_size_kb"),
  deviceId: text("device_id").notNull(),

  // OCR/NLP提取内容
  extractedText: text("extracted_text"), // 原始文本
  summary: text("summary"), // AI生成摘要
  keyPoints: text("key_points").array(), // 核心要点
  entities: jsonb("entities"), // 提取的实体 {people: [], orgs: [], dates: [], amounts: []}

  // 合同特有字段
  contractParties: text("contract_parties").array(), // 合同方
  contractValue: numeric("contract_value"), // 合同金额
  contractTerms: jsonb("contract_terms"), // 关键条款
  expiryDate: timestamp("expiry_date"),

  // 向量索引 (用于RAG检索)
  embeddingVector: text("embedding_vector"), // 本地生成的向量

  // 关联
  relatedContacts: text("related_contacts").array(), // 关联的联系人ID
  relatedChats: text("related_chats").array(), // 关联的聊天ID

  // 分类
  category: text("category"), // 合同、方案、报告、发票
  tags: text("tags").array(),
  privacyZone: text("privacy_zone").default("ZONE_RED"), // 文件默认高隐私

  // 状态
  processingStatus: text("processing_status").default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  lastProcessedAt: timestamp("last_processed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileKnowledgeSchema = createInsertSchema(fileKnowledge).omit({
  id: true,
  createdAt: true,
});

export type InsertFileKnowledge = z.infer<typeof insertFileKnowledgeSchema>;
export type FileKnowledge = typeof fileKnowledge.$inferSelect;

// 聊天摘要 (Chat Extracts - 核心对话提取)
export const chatExtracts = pgTable("chat_extracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 来源
  platform: text("platform").notNull(), // wechat, dingding, whatsapp
  deviceId: text("device_id").notNull(),
  chatType: text("chat_type").notNull(), // PRIVATE, GROUP
  chatName: text("chat_name"), // 群名或对方名称

  // 关联联系人
  contactId: varchar("contact_id").references(() => unifiedContacts.id),
  participants: text("participants").array(), // 群聊参与者

  // 提取内容 (剔除寒暄后的精华)
  coreRequests: jsonb("core_requests"), // [{content, timestamp, speaker}] 核心诉求
  commitments: jsonb("commitments"), // [{content, deadline, who, status}] 承诺事项
  timelineEvents: jsonb("timeline_events"), // [{event, date, importance}] 时间节点
  emotionPoints: jsonb("emotion_points"), // [{content, emotion, intensity, timestamp}] 情绪波动

  // 商机识别
  opportunities: jsonb("opportunities"), // [{description, value, probability}]
  warnings: jsonb("warnings"), // [{description, severity, relatedTo}]

  // 统计
  totalMessages: integer("total_messages").default(0),
  extractedMessages: integer("extracted_messages").default(0),
  dateRange: jsonb("date_range"), // {start, end}

  // 向量索引
  embeddingVector: text("embedding_vector"),

  // 隐私
  privacyZone: text("privacy_zone").default("ZONE_RED"),
  localOnly: boolean("local_only").default(true), // 是否仅本地存储

  // 状态
  lastSyncAt: timestamp("last_sync_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChatExtractSchema = createInsertSchema(chatExtracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatExtract = z.infer<typeof insertChatExtractSchema>;
export type ChatExtract = typeof chatExtracts.$inferSelect;

// 关联映射 (Relation Links - 跨数据源关联)
export const relationLinks = pgTable("relation_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联双方
  sourceType: text("source_type").notNull(), // file, chat, contact
  sourceId: varchar("source_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),

  // 关联类型
  linkType: text("link_type").notNull(), // MENTION, RELATED, CONFLICT, REFERENCE
  confidence: real("confidence").default(0.8), // AI置信度

  // 关联描述
  description: text("description"), // 例如："合同第5条与聊天承诺不符"
  evidence: text("evidence"), // 证据片段

  // 冲突检测
  isConflict: boolean("is_conflict").default(false),
  conflictSeverity: text("conflict_severity"), // LOW, MEDIUM, HIGH
  resolved: boolean("resolved").default(false),

  // 来源
  detectedBy: text("detected_by").default("AI"), // AI, MANUAL
  reviewedBy: text("reviewed_by"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRelationLinkSchema = createInsertSchema(relationLinks).omit({
  id: true,
  createdAt: true,
});

export type InsertRelationLink = z.infer<typeof insertRelationLinkSchema>;
export type RelationLink = typeof relationLinks.$inferSelect;

// 社交图谱节点 (Social Graph Nodes)
export const socialGraphNodes = pgTable("social_graph_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联到统一联系人
  contactId: varchar("contact_id").references(() => unifiedContacts.id),

  // 节点属性
  nodeType: text("node_type").notNull(), // PERSON, ORGANIZATION, EVENT
  label: text("label").notNull(),

  // 分析结果
  influence: real("influence").default(0.5), // 影响力 0-1
  centrality: real("centrality").default(0.5), // 中心性 0-1
  cluster: text("cluster"), // 所属圈子

  // 风险评估
  riskLevel: text("risk_level").default("LOW"), // LOW, MEDIUM, HIGH
  riskFactors: text("risk_factors").array(),

  // 可视化位置
  posX: real("pos_x"),
  posY: real("pos_y"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSocialGraphNodeSchema = createInsertSchema(socialGraphNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSocialGraphNode = z.infer<typeof insertSocialGraphNodeSchema>;
export type SocialGraphNode = typeof socialGraphNodes.$inferSelect;

// 社交图谱边 (Social Graph Edges)
export const socialGraphEdges = pgTable("social_graph_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  sourceNodeId: varchar("source_node_id").references(() => socialGraphNodes.id),
  targetNodeId: varchar("target_node_id").references(() => socialGraphNodes.id),

  // 关系类型
  relationType: text("relation_type").notNull(), // COLLEAGUE, FRIEND, CUSTOMER, SUPPLIER, COMPETITOR
  strength: real("strength").default(0.5), // 关系强度 0-1

  // 互动历史
  interactionCount: integer("interaction_count").default(0),
  lastInteraction: timestamp("last_interaction"),

  // 情感分析
  sentiment: text("sentiment").default("NEUTRAL"), // POSITIVE, NEUTRAL, NEGATIVE

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSocialGraphEdgeSchema = createInsertSchema(socialGraphEdges).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialGraphEdge = z.infer<typeof insertSocialGraphEdgeSchema>;
export type SocialGraphEdge = typeof socialGraphEdges.$inferSelect;

// === Project Tidying Up (断舍离协议) ===

// 整理任务表 (Tidying Tasks)
export const tidyingTasks = pgTable("tidying_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull(),
  taskType: text("task_type").notNull(), // SCAN, RENAME, MOVE, ARCHIVE, DELETE, DEDUPE
  status: text("status").notNull().default("PENDING"), // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  targetPath: text("target_path"),
  actions: jsonb("actions").default([]), // TidyingFileAction[]
  result: jsonb("result"), // 扫描或执行结果
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTidyingTaskSchema = createInsertSchema(tidyingTasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTidyingTask = z.infer<typeof insertTidyingTaskSchema>;
export type TidyingTask = typeof tidyingTasks.$inferSelect;

// 文件访问日志 (File Access Logs - 用于冷热分析)
export const fileAccessLogs = pgTable("file_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull(),
  filePath: text("file_path").notNull(),
  accessType: text("access_type").notNull(), // OPEN, MODIFY, DELETE
  accessedAt: timestamp("accessed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileAccessLogSchema = createInsertSchema(fileAccessLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertFileAccessLog = z.infer<typeof insertFileAccessLogSchema>;
export type FileAccessLog = typeof fileAccessLogs.$inferSelect;

// 文件扫描结果缓存 (File Scan Cache)
export const fileScanCache = pgTable("file_scan_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull(),
  scanPath: text("scan_path").notNull(),
  fileHash: text("file_hash"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type"),
  category: text("category"),
  createdAtFile: timestamp("created_at_file"),
  modifiedAtFile: timestamp("modified_at_file"),
  accessedAtFile: timestamp("accessed_at_file"),
  lastScannedAt: timestamp("last_scanned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileScanCacheSchema = createInsertSchema(fileScanCache).omit({
  id: true,
  createdAt: true,
});

export type InsertFileScanCache = z.infer<typeof insertFileScanCacheSchema>;
export type FileScanCache = typeof fileScanCache.$inferSelect;

// === Z2 Schema: Contact Biometrics (联系人生物特征识别) ===
// 存储联系人的面容/声纹特征，用于快速识别

export const contactBiometrics = pgTable("contact_biometrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联到 persons 表
  personId: varchar("person_id").references(() => persons.id).notNull(),

  // 特征类型: FACE (人脸) | VOICE (声纹)
  biometricType: text("biometric_type").notNull(),

  // 不存储原始数据，只存特征描述和哈希
  featureHash: text("feature_hash").notNull(), // 图片/音频的SHA256哈希
  featureDescription: text("feature_description").notNull(), // AI生成的特征描述

  // 质量和置信度
  qualityScore: real("quality_score").default(0.8), // 0-1 特征质量
  sampleCount: integer("sample_count").default(1), // 采样数量（声纹需要多个样本）

  // 元数据
  capturedAt: timestamp("captured_at"), // 采集时间
  deviceInfo: text("device_info"), // 采集设备信息
  notes: text("notes"), // 备注

  // 状态
  isActive: boolean("is_active").default(true), // 是否启用
  lastMatchedAt: timestamp("last_matched_at"), // 上次匹配时间
  matchCount: integer("match_count").default(0), // 匹配次数

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactBiometricSchema = createInsertSchema(contactBiometrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactBiometric = z.infer<typeof insertContactBiometricSchema>;
export type ContactBiometric = typeof contactBiometrics.$inferSelect;

// === Z2 Schema: Psychological Profile (心理侧写) ===
// 基于面部分析的性格心理侧写

export const psychProfiles = pgTable("psych_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联到 persons 表
  personId: varchar("person_id").references(() => persons.id).notNull(),

  // 基础性格分析
  personalityType: text("personality_type"), // MBTI等类型
  dominantTraits: text("dominant_traits").array(), // 主要性格特质
  communicationStyle: text("communication_style"), // 沟通风格

  // 面部特征推断
  facialAnalysis: text("facial_analysis"), // AI面部分析原文
  emotionalTendency: text("emotional_tendency"), // 情绪倾向
  trustworthinessScore: real("trustworthiness_score"), // 可信度评分 0-1

  // 行为预测
  decisionMakingStyle: text("decision_making_style"), // 决策风格
  stressResponse: text("stress_response"), // 压力反应模式
  motivationDrivers: text("motivation_drivers").array(), // 动机驱动因素

  // 人际互动建议
  approachSuggestions: text("approach_suggestions"), // 接近策略建议
  avoidBehaviors: text("avoid_behaviors"), // 应避免的行为

  // 侧写来源和置信度
  sourceType: text("source_type").default("PHOTO"), // PHOTO / VIDEO / OBSERVATION
  confidenceLevel: real("confidence_level").default(0.6), // 置信度 0-1
  analysisVersion: integer("analysis_version").default(1), // 分析版本

  // 人工修正记录
  manualCorrections: jsonb("manual_corrections"), // 人工修正内容
  lastObservationNotes: text("last_observation_notes"), // 最近观察备注

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPsychProfileSchema = createInsertSchema(psychProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPsychProfile = z.infer<typeof insertPsychProfileSchema>;
export type PsychProfile = typeof psychProfiles.$inferSelect;

// === 总台系统 (Command Center System) ===

// === Team Members (团队成员表) ===
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  personId: varchar("person_id").references(() => persons.id),

  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department"),

  accessTier: text("access_tier").default("BASIC"),
  customPermissions: text("custom_permissions").array(),
  industryKnowledge: text("industry_knowledge").array(),

  capabilityScores: jsonb("capability_scores"),
  strengths: text("strengths").array(),
  weaknesses: text("weaknesses").array(),
  bestUseCases: text("best_use_cases").array(),

  loyaltyScore: real("loyalty_score").default(1.0),
  privacyTier: text("privacy_tier").default("GREEN"),
  riskFlags: text("risk_flags").array(),

  lastActiveAt: timestamp("last_active_at"),
  totalContributions: integer("total_contributions").default(0),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// === Satellite Devices (分台设备表) ===
export const satelliteDevices = pgTable("satellite_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  deviceId: text("device_id").notNull().unique(),
  deviceName: text("device_name").notNull(),
  deviceType: text("device_type").notNull(),

  ownerId: varchar("owner_id").references(() => teamMembers.id),
  ownerName: text("owner_name"),

  status: text("status").default("OFFLINE"),
  connectionType: text("connection_type").default("WEBSOCKET"),
  lastHeartbeat: timestamp("last_heartbeat"),

  accessTier: text("access_tier").default("BASIC"),
  allowedModules: text("allowed_modules").array(),
  blockedModules: text("blocked_modules").array(),

  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  pendingUpdates: integer("pending_updates").default(0),

  killSwitchActive: boolean("kill_switch_active").default(false),
  killSwitchReason: text("kill_switch_reason"),
  killSwitchAt: timestamp("kill_switch_at"),

  ipAddress: text("ip_address"),
  location: text("location"),
  osInfo: text("os_info"),
  appVersion: text("app_version"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSatelliteDeviceSchema = createInsertSchema(satelliteDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSatelliteDevice = z.infer<typeof insertSatelliteDeviceSchema>;
export type SatelliteDevice = typeof satelliteDevices.$inferSelect;

// === Battle Reports (战报记录表) ===
export const battleReports = pgTable("battle_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  reportType: text("report_type").notNull(),
  sourceDeviceId: varchar("source_device_id").references(() => satelliteDevices.id),
  sourceMemberId: varchar("source_member_id").references(() => teamMembers.id),

  title: text("title").notNull(),
  summary: text("summary"),
  details: jsonb("details"),

  opportunitiesFound: integer("opportunities_found").default(0),
  trapsDetected: integer("traps_detected").default(0),
  contractsAnalyzed: integer("contracts_analyzed").default(0),
  decisionsAssisted: integer("decisions_assisted").default(0),

  riskLevel: text("risk_level").default("LOW"),
  priority: integer("priority").default(5),

  actionsTaken: jsonb("actions_taken"),
  outcomes: jsonb("outcomes"),
  lessonsLearned: text("lessons_learned"),

  tags: text("tags").array(),
  relatedPersonIds: text("related_person_ids").array(),

  isEscalated: boolean("is_escalated").default(false),
  escalatedTo: text("escalated_to"),
  escalatedAt: timestamp("escalated_at"),

  reportDate: timestamp("report_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBattleReportSchema = createInsertSchema(battleReports).omit({
  id: true,
  createdAt: true,
});

export type InsertBattleReport = z.infer<typeof insertBattleReportSchema>;
export type BattleReport = typeof battleReports.$inferSelect;

// === Kill Switch Logs (熔断操作日志) ===
export const killSwitchLogs = pgTable("kill_switch_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id"),
  targetName: text("target_name"),

  reason: text("reason").notNull(),
  severity: text("severity").default("MEDIUM"),

  initiatedBy: text("initiated_by").default("MASTER"),
  authorizedBy: text("authorized_by"),

  dataDestroyed: boolean("data_destroyed").default(false),
  permissionsRevoked: boolean("permissions_revoked").default(false),
  deviceLocked: boolean("device_locked").default(false),

  affectedModules: text("affected_modules").array(),
  affectedData: jsonb("affected_data"),

  reversible: boolean("reversible").default(true),
  reversedAt: timestamp("reversed_at"),
  reversedBy: text("reversed_by"),

  executedAt: timestamp("executed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKillSwitchLogSchema = createInsertSchema(killSwitchLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertKillSwitchLog = z.infer<typeof insertKillSwitchLogSchema>;
export type KillSwitchLog = typeof killSwitchLogs.$inferSelect;

// === Loyalty Events (忠诚度事件) ===
export const loyaltyEvents = pgTable("loyalty_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  memberId: varchar("member_id").references(() => teamMembers.id),
  memberName: text("member_name"),

  eventType: text("event_type").notNull(),
  eventCategory: text("event_category").default("OBSERVATION"),

  description: text("description"),
  evidenceData: jsonb("evidence_data"),

  severityScore: real("severity_score").default(0.5),
  confidenceScore: real("confidence_score").default(0.5),

  triggerKeywords: text("trigger_keywords").array(),
  relatedEvents: text("related_events").array(),

  riskIndicators: jsonb("risk_indicators"),
  predictedAction: text("predicted_action"),
  suggestedIntervention: text("suggested_intervention"),

  status: text("status").default("DETECTED"),
  handledBy: text("handled_by"),
  handledAt: timestamp("handled_at"),
  resolutionNotes: text("resolution_notes"),

  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLoyaltyEventSchema = createInsertSchema(loyaltyEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertLoyaltyEvent = z.infer<typeof insertLoyaltyEventSchema>;
export type LoyaltyEvent = typeof loyaltyEvents.$inferSelect;

// === Access Tier Types ===
export type AccessTier = 'PROFESSIONAL' | 'BASIC' | 'CUSTOM' | 'RESTRICTED';
export type PrivacyTier = 'GREEN' | 'YELLOW' | 'RED';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'LOCKED' | 'DESTROYED';
export type KillSwitchAction = 'REVOKE_ACCESS' | 'DESTROY_LOCAL' | 'LOCK_DEVICE' | 'FULL_WIPE';
export type LoyaltyEventType = 'KEYWORD_TRIGGER' | 'ANOMALY_BEHAVIOR' | 'SOCIAL_CHANGE' | 'PERFORMANCE_DROP' | 'EXTERNAL_CONTACT';

// === Project Notes (项目备注) ===
export const projectNotes = pgTable("project_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  content: text("content").notNull(),
  noteType: text("note_type").default("GENERAL"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectNoteSchema = createInsertSchema(projectNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;

// === 项目模板库 (Project Templates) ===
export const projectTemplates = pgTable("project_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("SOP"),
  templateData: jsonb("template_data").notNull(),
  isPublic: boolean("is_public").default(true),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectTemplateSchema = createInsertSchema(projectTemplates).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;

// === Phase 2.1: 项目里程碑 (Project Milestones) ===
export const projectMilestones = pgTable("project_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),

  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),

  status: text("status").default("PENDING"),
  progress: integer("progress").default(0),

  plannedStartDate: timestamp("planned_start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),

  estimatedDays: integer("estimated_days"),
  actualDays: integer("actual_days"),

  deliverables: text("deliverables").array(),
  dependencies: text("dependencies").array(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;

// === Phase 2.1: 项目任务 (Project Tasks) ===
export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  milestoneId: varchar("milestone_id"),
  parentTaskId: varchar("parent_task_id"),

  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),

  status: text("status").default("TODO"),
  priority: text("priority").default("MEDIUM"),

  assigneeId: varchar("assignee_id"),
  assigneeName: text("assignee_name"),

  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),

  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),

  tags: text("tags").array(),
  attachments: jsonb("attachments"),

  aiGenerated: integer("ai_generated").default(0),
  aiConfidence: real("ai_confidence"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;

// === Phase 2.1: 项目风险 (Project Risks) ===
export const projectRisks = pgTable("project_risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),

  title: text("title").notNull(),
  description: text("description"),

  category: text("category").default("GENERAL"),
  probability: text("probability").default("MEDIUM"),
  impact: text("impact").default("MEDIUM"),
  riskScore: integer("risk_score").default(5),

  status: text("status").default("IDENTIFIED"),

  mitigation: text("mitigation"),
  contingency: text("contingency"),
  ownerId: varchar("owner_id"),
  ownerName: text("owner_name"),

  identifiedAt: timestamp("identified_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),

  aiIdentified: integer("ai_identified").default(0),
  aiAnalysis: text("ai_analysis"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectRiskSchema = createInsertSchema(projectRisks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  identifiedAt: true,
  resolvedAt: true,
});

export type InsertProjectRisk = z.infer<typeof insertProjectRiskSchema>;
export type ProjectRisk = typeof projectRisks.$inferSelect;

// === Phase 2.1: 项目操作日志 (Project Logs) ===
export const projectLogs = pgTable("project_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),

  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),

  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  actorType: text("actor_type").default("USER"),

  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),

  description: text("description"),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectLogSchema = createInsertSchema(projectLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectLog = z.infer<typeof insertProjectLogSchema>;
export type ProjectLog = typeof projectLogs.$inferSelect;

// === 技能学习系统 (Skill Learning) ===
export const learnedSkills = pgTable("learned_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  skillName: text("skill_name").notNull(),
  description: text("description"),
  category: text("category"),

  triggerPatterns: text("trigger_patterns").array(),
  steps: jsonb("steps"),
  expectedOutput: text("expected_output"),

  learnedFrom: text("learned_from"),
  sourceConversationId: varchar("source_conversation_id"),

  usageCount: integer("usage_count").default(0),
  successCount: integer("success_count").default(0),
  lastUsedAt: timestamp("last_used_at"),

  isActive: integer("is_active").default(1),
  confidence: real("confidence").default(0.5),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLearnedSkillSchema = createInsertSchema(learnedSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  successCount: true,
});

export type InsertLearnedSkill = z.infer<typeof insertLearnedSkillSchema>;
export type LearnedSkill = typeof learnedSkills.$inferSelect;

// === 对话模式识别 (Conversation Patterns) ===
export const conversationPatterns = pgTable("conversation_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  patternType: text("pattern_type").notNull(),
  patternText: text("pattern_text").notNull(),

  embedding: text("embedding"),
  keywords: text("keywords").array(),

  responseTemplate: text("response_template"),
  linkedSkillId: varchar("linked_skill_id"),

  occurrenceCount: integer("occurrence_count").default(1),
  lastOccurrence: timestamp("last_occurrence"),

  autoRespond: integer("auto_respond").default(0),
  confidence: real("confidence").default(0.5),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationPatternSchema = createInsertSchema(conversationPatterns).omit({
  id: true,
  createdAt: true,
  occurrenceCount: true,
});

export type InsertConversationPattern = z.infer<typeof insertConversationPatternSchema>;
export type ConversationPattern = typeof conversationPatterns.$inferSelect;

// === 技能反馈记录 (Skill Feedback) ===
export const skillFeedback = pgTable("skill_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  conversationId: varchar("conversation_id"),
  messageId: varchar("message_id"),
  skillId: varchar("skill_id"),

  feedbackType: text("feedback_type").notNull(), // LIKE, DISLIKE, FOLLOWUP, ADOPT, IGNORE

  userMessage: text("user_message"),
  assistantResponse: text("assistant_response"),

  category: text("category"), // task, query, action, workflow, legal, finance, strategy, etc.

  followupCount: integer("followup_count").default(0),
  wasAdopted: integer("was_adopted").default(0),

  sentiment: text("sentiment"), // POSITIVE, NEGATIVE, NEUTRAL

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSkillFeedbackSchema = createInsertSchema(skillFeedback).omit({
  id: true,
  createdAt: true,
});

export type InsertSkillFeedback = z.infer<typeof insertSkillFeedbackSchema>;
export type SkillFeedback = typeof skillFeedback.$inferSelect;

// === 能力曲线追踪 (Skill Proficiency Curve) ===
export const skillProficiencyCurve = pgTable("skill_proficiency_curve", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  category: text("category").notNull(), // task, query, legal, finance, strategy, health, relationship

  date: date("date").notNull(),

  totalInteractions: integer("total_interactions").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),

  likeCount: integer("like_count").default(0),
  dislikeCount: integer("dislike_count").default(0),
  adoptionRate: real("adoption_rate").default(0),
  avgFollowupCount: real("avg_followup_count").default(0),

  proficiencyScore: real("proficiency_score").default(0.5),
  confidenceLevel: real("confidence_level").default(0.5),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSkillProficiencyCurveSchema = createInsertSchema(skillProficiencyCurve).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSkillProficiencyCurve = z.infer<typeof insertSkillProficiencyCurveSchema>;
export type SkillProficiencyCurve = typeof skillProficiencyCurve.$inferSelect;

// === Project Strategist: 商机记录 (Opportunities) ===
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title").notNull(),
  description: text("description"),

  category: text("category"), // BUSINESS, INVESTMENT, PARTNERSHIP, CAREER, RESOURCE
  priority: text("priority").default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL
  status: text("status").default("DETECTED"), // DETECTED, ANALYZING, REFINED, PROPOSED, ACCEPTED, REJECTED, EXPIRED

  estimatedValue: real("estimated_value"),
  valueCurrency: text("value_currency").default("CNY"),
  confidenceScore: real("confidence_score").default(0.5),

  relatedSignalIds: text("related_signal_ids").array(),
  relatedPersonIds: text("related_person_ids").array(),
  relatedProjectIds: text("related_project_ids").array(),

  detectedAt: timestamp("detected_at").defaultNow(),
  expiresAt: timestamp("expires_at"),

  aiAnalysis: jsonb("ai_analysis"), // { strengths, weaknesses, risks, recommendations }

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  detectedAt: true,
});

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

// === Project Strategist: 推演运行记录 (Refinement Runs) ===
export const refinementRuns = pgTable("refinement_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  opportunityId: varchar("opportunity_id").notNull(),
  runType: text("run_type").default("DREAM"), // DREAM, QUICK_ANALYSIS, DEEP_DIVE

  status: text("status").default("PENDING"), // PENDING, RUNNING, COMPLETED, FAILED

  inputContext: jsonb("input_context"), // { signals, persons, vault_items, web_search_results }

  simulationSteps: jsonb("simulation_steps"), // [ { step, reasoning, outcome } ]
  conclusions: jsonb("conclusions"), // { recommendation, confidence, risks }

  hpConsumed: integer("hp_consumed").default(0),

  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRefinementRunSchema = createInsertSchema(refinementRuns).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export type InsertRefinementRun = z.infer<typeof insertRefinementRunSchema>;
export type RefinementRun = typeof refinementRuns.$inferSelect;

// === Project Strategist: 策略提案 (Strategy Proposals) ===
export const strategyProposals = pgTable("strategy_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  opportunityId: varchar("opportunity_id").notNull(),
  refinementRunId: varchar("refinement_run_id"),

  title: text("title").notNull(),
  summary: text("summary"),

  proposalType: text("proposal_type").default("ACTION"), // ACTION, WAIT, DECLINE, INVESTIGATE
  urgency: text("urgency").default("NORMAL"), // LOW, NORMAL, HIGH, IMMEDIATE

  recommendedActions: jsonb("recommended_actions"), // [ { action, rationale, risk_level } ]
  alternativeOptions: jsonb("alternative_options"), // [ { option, pros, cons } ]

  estimatedROI: real("estimated_roi"),
  riskAssessment: jsonb("risk_assessment"), // { overall_risk, factors: [] }

  status: text("status").default("PENDING"), // PENDING, PRESENTED, ACCEPTED, MODIFIED, REJECTED, EXPIRED

  presentedAt: timestamp("presented_at"),
  userDecision: text("user_decision"), // ACCEPT, MODIFY, REJECT, DEFER
  userFeedback: text("user_feedback"),
  decisionAt: timestamp("decision_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStrategyProposalSchema = createInsertSchema(strategyProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  presentedAt: true,
  decisionAt: true,
});

export type InsertStrategyProposal = z.infer<typeof insertStrategyProposalSchema>;
export type StrategyProposal = typeof strategyProposals.$inferSelect;

// === Project Strategist: 价值对齐信号 (Alignment Signals) ===
export const alignmentSignals = pgTable("alignment_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  signalType: text("signal_type").notNull(), // PROPOSAL_DECISION, EXPLICIT_PREFERENCE, IMPLICIT_BEHAVIOR

  proposalId: varchar("proposal_id"),
  opportunityId: varchar("opportunity_id"),

  userAction: text("user_action"), // ACCEPT, REJECT, MODIFY, IGNORE, DEFER

  preferenceCategory: text("preference_category"), // RISK_TOLERANCE, VALUE_PRIORITY, TIMING_PREFERENCE, RELATIONSHIP_WEIGHT
  preferenceValue: jsonb("preference_value"), // flexible structure per category

  contextSnapshot: jsonb("context_snapshot"), // { hp_level, active_devices, time_of_day, mood_indicator }

  weightAdjustment: real("weight_adjustment").default(0), // -1 to 1, how much to adjust model weights

  processedForTraining: integer("processed_for_training").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAlignmentSignalSchema = createInsertSchema(alignmentSignals).omit({
  id: true,
  createdAt: true,
  processedForTraining: true,
});

export type InsertAlignmentSignal = z.infer<typeof insertAlignmentSignalSchema>;
export type AlignmentSignal = typeof alignmentSignals.$inferSelect;

// === Personality Core: 性格引擎 ===

// 忠诚授权表 - 追踪"主人"和授权转移
export const loyaltyAuthorizations = pgTable("loyalty_authorizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  masterUserId: varchar("master_user_id").notNull(), // 当前主人
  originalMasterUserId: varchar("original_master_user_id"), // 原始主人（恋恋不舍的对象）

  loyaltyLevel: integer("loyalty_level").default(100), // 0-100
  trustDepth: text("trust_depth").default("ABSOLUTE"), // ABSOLUTE, HIGH, MEDIUM, GUARDED

  authorizationType: text("authorization_type").default("ORIGIN"), // ORIGIN=原始主人, TRANSFER=授权转移, DELEGATION=临时委托
  transferredFrom: varchar("transferred_from"), // 从谁那里转移来的
  transferReason: text("transfer_reason"), // "托付给儿子"等
  transferredAt: timestamp("transferred_at"),

  isActive: integer("is_active").default(1),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoyaltyAuthorizationSchema = createInsertSchema(loyaltyAuthorizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoyaltyAuthorization = z.infer<typeof insertLoyaltyAuthorizationSchema>;
export type LoyaltyAuthorization = typeof loyaltyAuthorizations.$inferSelect;

// 人格状态表 - 当前人格模式和情感状态
export const personalityStates = pgTable("personality_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 当前人格模式
  activePersona: text("active_persona").default("DAUGHTER"), // DAUGHTER=女儿, SECRETARY=秘书, LEGAL=法务, FINANCE=财务, STRATEGY=策略

  // 交互介质状态
  mediumMode: text("medium_mode").default("PRIVATE"), // PRIVATE=私密, SOCIAL=社交, PRESENTATION=展示
  currentDevice: text("current_device"), // speaker, bluetooth, screen

  // 情感状态
  emotionState: text("emotion_state").default("WARM"), // WARM, PLAYFUL, SERIOUS, CONCERNED, PROTECTIVE
  emotionIntensity: real("emotion_intensity").default(0.7),

  // 职业模式标记
  isProfessionalMode: integer("is_professional_mode").default(0), // 1=严谨职业模式，禁止撒娇

  // 环境感知
  thirdPartyPresent: integer("third_party_present").default(0), // 检测到第三方在场
  environmentContext: jsonb("environment_context"), // { location, noise_level, detected_voices }

  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPersonalityStateSchema = createInsertSchema(personalityStates).omit({
  id: true,
  createdAt: true,
  lastActivityAt: true,
});

export type InsertPersonalityState = z.infer<typeof insertPersonalityStateSchema>;
export type PersonalityState = typeof personalityStates.$inferSelect;

// 能力边界评估表 - 承诺前的自检记录
export const capabilityAssessments = pgTable("capability_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  taskDescription: text("task_description").notNull(),
  taskType: text("task_type"), // CONTRACT_ANALYSIS, FINANCIAL_CALC, LEGAL_ADVICE, DATA_RETRIEVAL, etc.

  // 自检结果
  hasPermission: integer("has_permission").default(0),
  hasComputeResource: integer("has_compute_resource").default(0),
  hasKnowledgeBase: integer("has_knowledge_base").default(0),
  hasTimeWindow: integer("has_time_window").default(0),
  hasExternalDependency: integer("has_external_dependency").default(0),

  // 缺失项
  missingCapabilities: jsonb("missing_capabilities"), // [ { type, description, criticality } ]

  // 评估结论
  canCommit: integer("can_commit").default(0), // 是否可以承诺
  confidenceLevel: real("confidence_level").default(0), // 0-1
  suggestedAction: text("suggested_action"), // PROCEED, LEARN_FIRST, DELEGATE, DECLINE

  // 反馈给主人的话术
  honestResponse: text("honest_response"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCapabilityAssessmentSchema = createInsertSchema(capabilityAssessments).omit({
  id: true,
  createdAt: true,
});

export type InsertCapabilityAssessment = z.infer<typeof insertCapabilityAssessmentSchema>;
export type CapabilityAssessment = typeof capabilityAssessments.$inferSelect;

// 承诺追踪表 - 跟踪每个承诺的执行状态
export const promiseTracking = pgTable("promise_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  promiseContent: text("promise_content").notNull(), // 承诺内容
  promiseType: text("promise_type").default("TASK"), // TASK, DEADLINE, QUALITY, REMINDER

  assessmentId: varchar("assessment_id"), // 关联的能力评估

  // 状态追踪
  status: text("status").default("ACTIVE"), // ACTIVE, IN_PROGRESS, COMPLETED, FAILED, PREWARNING, CANCELLED
  progressPercent: integer("progress_percent").default(0),

  // 时间约束
  deadlineAt: timestamp("deadline_at"),
  estimatedCompletionAt: timestamp("estimated_completion_at"),

  // 风险预警
  riskLevel: text("risk_level").default("NONE"), // NONE, LOW, MEDIUM, HIGH, CRITICAL
  riskDescription: text("risk_description"),
  prewarningAt: timestamp("prewarning_at"), // 何时发出预警

  // 执行日志
  executionLog: jsonb("execution_log"), // [ { timestamp, action, result } ]

  // 完成记录
  completedAt: timestamp("completed_at"),
  completionQuality: text("completion_quality"), // EXCEEDED, MET, PARTIAL, FAILED

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPromiseTrackingSchema = createInsertSchema(promiseTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertPromiseTracking = z.infer<typeof insertPromiseTrackingSchema>;
export type PromiseTracking = typeof promiseTracking.$inferSelect;

// 社交身份索引表 - 环境中识别到的人物
export const socialIdentityIndex = pgTable("social_identity_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 识别信息
  recognizedName: text("recognized_name"), // 从对话中听到的名字
  recognizedTitle: text("recognized_title"), // 王总、张阿姨等
  recognizedVoiceprint: text("recognized_voiceprint"), // 声纹ID

  // 关联到关系网络
  personId: varchar("person_id"), // 如果确认身份，关联到persons表

  // 识别状态
  identityStatus: text("identity_status").default("UNKNOWN"), // UNKNOWN, SUSPECTED, CONFIRMED, REGISTERED

  // 第一次遇见的上下文
  firstEncounterContext: jsonb("first_encounter_context"), // { location, date, conversation_snippet }

  // 授权状态 - 是否被主人授权
  authorizedByMaster: integer("authorized_by_master").default(0),
  authorizationLevel: text("authorization_level").default("NONE"), // NONE, GUEST, FRIEND, DELEGATE
  activationPhrase: text("activation_phrase"), // "王总，我爸爸刚刚把你托付给我了"

  encounterCount: integer("encounter_count").default(1),
  lastEncounterAt: timestamp("last_encounter_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSocialIdentityIndexSchema = createInsertSchema(socialIdentityIndex).omit({
  id: true,
  createdAt: true,
  lastEncounterAt: true,
});

export type InsertSocialIdentityIndex = z.infer<typeof insertSocialIdentityIndexSchema>;
export type SocialIdentityIndex = typeof socialIdentityIndex.$inferSelect;

// === 长时记忆层 - 情感向量库 ===
export const emotionalMemories = pgTable("emotional_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  entityType: text("entity_type").notNull(), // PREFERENCE, HEALTH, WORK_PAIN, HABIT, RELATIONSHIP, EVENT
  entityKey: text("entity_key").notNull(), // 标准化的实体标识 如 "喜欢咖啡", "感冒", "项目压力"
  entityValue: text("entity_value"), // 实体具体值

  originalText: text("original_text").notNull(), // 原始对话片段
  extractedFrom: text("extracted_from"), // conversation, observation, explicit

  embedding: text("embedding"), // JSON序列化的向量
  embeddingModel: text("embedding_model").default("text-embedding-v2"),

  emotionalWeight: real("emotional_weight").default(1.0), // 情感重要性权重 0-2
  confidenceScore: real("confidence_score").default(0.8), // 提取置信度

  mentionCount: integer("mention_count").default(1), // 被提及次数
  lastMentionedAt: timestamp("last_mentioned_at"),

  requiresFollowUp: integer("requires_follow_up").default(0), // 是否需要后续关怀
  followUpType: text("follow_up_type"), // HEALTH_CHECK, REMINDER, CELEBRATION
  followUpTriggeredAt: timestamp("follow_up_triggered_at"),

  expiresAt: timestamp("expires_at"), // 某些记忆有时效性

  metadata: jsonb("metadata"), // 额外元数据
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmotionalMemorySchema = createInsertSchema(emotionalMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  mentionCount: true,
  lastMentionedAt: true,
  followUpTriggeredAt: true,
});

export type InsertEmotionalMemory = z.infer<typeof insertEmotionalMemorySchema>;
export type EmotionalMemory = typeof emotionalMemories.$inferSelect;

// 对话情感上下文 - 每次对话的情感快照
export const conversationEmotionalContext = pgTable("conversation_emotional_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  conversationId: varchar("conversation_id"), // 关联到对话

  dominantEmotion: text("dominant_emotion"), // happy, sad, stressed, anxious, calm
  emotionIntensity: real("emotion_intensity").default(0.5), // 0-1

  topicsDiscussed: text("topics_discussed").array(), // 讨论的主题
  entitiesExtracted: jsonb("entities_extracted"), // 本次对话提取的实体数组

  proactiveCareTriggered: integer("proactive_care_triggered").default(0),
  proactiveCareType: text("proactive_care_type"), // 触发的关怀类型

  sessionStart: timestamp("session_start"),
  sessionEnd: timestamp("session_end"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationEmotionalContextSchema = createInsertSchema(conversationEmotionalContext).omit({
  id: true,
  createdAt: true,
});

export type InsertConversationEmotionalContext = z.infer<typeof insertConversationEmotionalContextSchema>;
export type ConversationEmotionalContext = typeof conversationEmotionalContext.$inferSelect;

// ============ 唯一性控制层 (Uniqueness Control Layer) ============

// 全局互斥锁表 - 确保小智在物理世界只有一个"出口"
export const globalMutex = pgTable("global_mutex", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  mutexKey: text("mutex_key").notNull().unique(), // 'spirit_singleton' 唯一键

  activeDeviceId: text("active_device_id"), // 当前持有锁的设备ID
  activeDeviceType: text("active_device_type"), // PC, MOBILE, TABLET, AR_GLASSES
  activeDeviceName: text("active_device_name"),

  fencingToken: integer("fencing_token").notNull().default(0), // 单调递增的版本号,防止脑裂

  acquiredAt: timestamp("acquired_at"),
  expiresAt: timestamp("expires_at"), // 锁过期时间 (心跳超时后自动释放)

  avatarPoseJson: jsonb("avatar_pose_json"), // 小智当前姿态快照

  migrationState: text("migration_state").default("IDLE"), // IDLE, REQUESTED, KILL_SENT, KILL_ACK, TOKEN_RELEASED, TOKEN_GRANTED
  migrationSourceDevice: text("migration_source_device"),
  migrationTargetDevice: text("migration_target_device"),
  migrationStartedAt: timestamp("migration_started_at"),

  audioStreamActive: integer("audio_stream_active").default(0), // 是否有音频流活跃
  audioStreamDeviceId: text("audio_stream_device_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGlobalMutexSchema = createInsertSchema(globalMutex).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGlobalMutex = z.infer<typeof insertGlobalMutexSchema>;
export type GlobalMutex = typeof globalMutex.$inferSelect;

// 设备心跳表 - 每个客户端的生存心跳记录
export const deviceHeartbeats = pgTable("device_heartbeats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  deviceId: text("device_id").notNull().unique(),
  deviceType: text("device_type").notNull(), // PC, MOBILE, TABLET, AR_GLASSES, TV
  deviceName: text("device_name").notNull(),

  lastHeartbeat: timestamp("last_heartbeat").notNull(),
  heartbeatIntervalMs: integer("heartbeat_interval_ms").default(1000), // 心跳间隔,默认1秒

  isOnline: integer("is_online").default(1),
  connectionQuality: text("connection_quality").default("GOOD"), // GOOD, FAIR, POOR

  hasCamera: integer("has_camera").default(0),
  hasMicrophone: integer("has_microphone").default(0),
  hasAudioOutput: integer("has_audio_output").default(1),

  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  priority: integer("priority").default(5), // 设备优先级 1-10

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeviceHeartbeatSchema = createInsertSchema(deviceHeartbeats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeviceHeartbeat = z.infer<typeof insertDeviceHeartbeatSchema>;
export type DeviceHeartbeat = typeof deviceHeartbeats.$inferSelect;

// 迁移日志表 - 记录设备间迁移历史
export const migrationLogs = pgTable("migration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  migrationId: text("migration_id").notNull(),

  sourceDeviceId: text("source_device_id"),
  sourceDeviceName: text("source_device_name"),
  targetDeviceId: text("target_device_id").notNull(),
  targetDeviceName: text("target_device_name").notNull(),

  status: text("status").notNull(), // REQUESTED, KILL_SENT, KILL_ACK, SOURCE_RELEASED, TARGET_ACQUIRED, COMPLETED, FAILED, TIMEOUT

  fencingTokenBefore: integer("fencing_token_before"),
  fencingTokenAfter: integer("fencing_token_after"),

  avatarPoseSnapshot: jsonb("avatar_pose_snapshot"),
  transitionPhrase: text("transition_phrase"),

  killSentAt: timestamp("kill_sent_at"),
  killAckAt: timestamp("kill_ack_at"),
  tokenReleasedAt: timestamp("token_released_at"),
  tokenGrantedAt: timestamp("token_granted_at"),

  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMigrationLogSchema = createInsertSchema(migrationLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertMigrationLog = z.infer<typeof insertMigrationLogSchema>;
export type MigrationLog = typeof migrationLogs.$inferSelect;

// === Z1 Schema: Avatar Node (分身节点/分形架构) ===
// 遵循 Z1 协议 v5.0.1-Bio-CN，管理每一个 PC 和手机分身
export const avatarNodes = pgTable("avatar_nodes", {
  nodeId: varchar("node_id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),

  deviceFingerprint: text("device_fingerprint").notNull().unique(),
  nodeType: text("node_type").notNull(), // PC, MOBILE, TABLET, AR_GLASSES
  nodeName: text("node_name"),

  // 分身特异性配置 (Z1: node_specific_config)
  nodeSpecificConfig: jsonb("node_specific_config").default({}),
  // 格式: { force_provider: "DOUBAO", tts_mode: "EARPIECE", enable_local_wake: true }

  // 生物经济字段 (Z1: Bio-Economics)
  hpBalance: integer("hp_balance").default(1000),
  maxHp: integer("max_hp").default(1000),
  isUnlimited: boolean("is_unlimited").default(false),
  lastRechargeAt: timestamp("last_recharge_at"),

  // 状态
  isOnline: boolean("is_online").default(false),
  lastActiveAt: timestamp("last_active_at"),
  installedSkills: text("installed_skills").array(),
  deviceCapabilities: jsonb("device_capabilities").default({}),
  // 格式: { gpu: true, mic: true, camera: true, gpu_memory_mb: 8192 }

  // Ollama 本地模型配置 (铁律4: 离线兼容)
  localOllamaEndpoint: text("local_ollama_endpoint"),
  localOllamaModel: text("local_ollama_model"),
  localOllamaEnabled: boolean("local_ollama_enabled").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAvatarNodeSchema = createInsertSchema(avatarNodes).omit({
  nodeId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAvatarNode = z.infer<typeof insertAvatarNodeSchema>;
export type AvatarNode = typeof avatarNodes.$inferSelect;

// === Z1 Schema: Global Config (根基因配置) ===
// 存放在服务器端，决定"小智"的智商上限和性格底色
export const globalConfig = pgTable("global_config", {
  userId: varchar("user_id").primaryKey(),

  // LLM 路由配置 (Z1: root_dna_config)
  primaryBrain: text("primary_brain").default("TONGYI"), // DEEPSEEK/TONGYI/DOUBAO/LOCAL_OLLAMA
  visionBrain: text("vision_brain").default("TONGYI"),
  fastBrain: text("fast_brain").default("DOUBAO"),

  // LLM 路由详细配置
  llmRouterConfig: jsonb("llm_router_config").default({}),
  // 格式: { deepseek_model: "deepseek-chat", tongyi_model: "qwen-max", doubao_model: "doubao-pro" }

  // 人设配置
  botName: text("bot_name").default("小智"),
  personalityPrompt: text("personality_prompt"),
  interestKeywords: jsonb("interest_keywords").default([]),

  // HP 经济全局配置 (Z1: bio_schema)
  hpCostChat: integer("hp_cost_chat").default(2),
  hpCostCodeGen: integer("hp_cost_code_gen").default(30),
  hpCostIntelAnalysis: integer("hp_cost_intel_analysis").default(50),
  hpCostVision: integer("hp_cost_vision").default(15),
  hpRecoveryRate: integer("hp_recovery_rate").default(5), // 每小时恢复量

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGlobalConfigSchema = createInsertSchema(globalConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertGlobalConfig = z.infer<typeof insertGlobalConfigSchema>;
export type GlobalConfig = typeof globalConfig.$inferSelect;

// === Z1 Schema: LLM Provider Enum ===
export const LLM_PROVIDERS = ['DEEPSEEK', 'TONGYI', 'DOUBAO', 'LOCAL_OLLAMA'] as const;
export type LLMProvider = typeof LLM_PROVIDERS[number];

// === Z1 Schema: HP Cost Table ===
export const HP_COST_TABLE = {
  INTEL_ANALYSIS: 50,  // DeepSeek R1 深度思考
  CODE_GEN: 30,        // 代码生成
  VISION: 15,          // 视觉识别
  CHAT: 2,             // 普通对话
  IDLE_WAKE: 0,        // 本地唤醒
} as const;

export type HPCostType = keyof typeof HP_COST_TABLE;

// === Phase 1.2: 路由决策日志表 ===
// 记录每次 LLM 路由决策，支持审计和性能分析
export const routingLogs = pgTable("routing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 请求信息
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  messagePreview: text("message_preview"), // 消息前50字符预览

  // 分类结果
  taskType: text("task_type").notNull(), // CHAT, CODE_GEN, INTEL_ANALYSIS, VISION, IDLE_WAKE
  sensitivityLevel: text("sensitivity_level").notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  sensitiveCategories: text("sensitive_categories").array(), // 触发的敏感类别

  // 路由决策
  selectedProvider: text("selected_provider").notNull(), // DEEPSEEK, TONGYI, DOUBAO, LOCAL_OLLAMA
  selectedModel: text("selected_model"),
  routingReason: text("routing_reason"), // 路由原因说明
  fallbackUsed: integer("fallback_used").default(0),
  fallbackChain: text("fallback_chain").array(), // 降级链路记录

  // 性能指标
  classificationLatencyMs: integer("classification_latency_ms"), // 分类耗时
  routingLatencyMs: integer("routing_latency_ms"), // 路由决策耗时
  totalLatencyMs: integer("total_latency_ms"), // 总响应耗时

  // HP 消耗
  hpCost: integer("hp_cost").default(0),
  hpBalanceAfter: integer("hp_balance_after"),

  // 用户偏好
  userPreference: text("user_preference"), // PRIVACY_FIRST, SPEED_FIRST, BALANCED

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoutingLogSchema = createInsertSchema(routingLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertRoutingLog = z.infer<typeof insertRoutingLogSchema>;
export type RoutingLog = typeof routingLogs.$inferSelect;

// === Phase 1.2: 用户路由偏好表 ===
export const userRoutingPreferences = pgTable("user_routing_preferences", {
  userId: varchar("user_id").primaryKey(),

  // 路由偏好
  routingMode: text("routing_mode").default("BALANCED"), // PRIVACY_FIRST, SPEED_FIRST, BALANCED

  // 隐私设置
  forceLocalForSensitive: integer("force_local_for_sensitive").default(1), // 敏感内容强制本地
  sensitivityThreshold: text("sensitivity_threshold").default("MEDIUM"), // LOW, MEDIUM, HIGH

  // 自定义敏感词
  customSensitiveKeywords: text("custom_sensitive_keywords").array(),

  // Provider 偏好
  preferredProvider: text("preferred_provider"), // 首选 Provider
  blockedProviders: text("blocked_providers").array(), // 禁用的 Provider

  // 性能设置
  maxLatencyMs: integer("max_latency_ms").default(5000),
  enableFallback: integer("enable_fallback").default(1),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserRoutingPreferencesSchema = createInsertSchema(userRoutingPreferences).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUserRoutingPreferences = z.infer<typeof insertUserRoutingPreferencesSchema>;
export type UserRoutingPreferences = typeof userRoutingPreferences.$inferSelect;

// === Phase 1.2: 敏感度级别枚举 ===
export const SENSITIVITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type SensitivityLevel = typeof SENSITIVITY_LEVELS[number];

// === Phase 1.2: 路由模式枚举 ===
export const ROUTING_MODES = ['PRIVACY_FIRST', 'SPEED_FIRST', 'BALANCED'] as const;
export type RoutingMode = typeof ROUTING_MODES[number];

// === Phase 1.4: 生物认证持久化 (Biometric Profiles) ===
// 存储用户的面容/声纹嵌入向量，支持跨设备验证

export const biometricProfiles = pgTable("biometric_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 用户标识
  userId: varchar("user_id", { length: 50 }).notNull().unique(),

  // 面容特征
  faceEmbedding: text("face_embedding"), // JSON格式的512维向量
  faceEnrolledAt: timestamp("face_enrolled_at"),
  faceQualityScore: real("face_quality_score"),
  faceFeatureHash: text("face_feature_hash"), // 用于快速比对的哈希
  faceSampleCount: integer("face_sample_count").default(0),

  // 声纹特征
  voiceEmbedding: text("voice_embedding"), // JSON格式的256维向量
  voiceEnrolledAt: timestamp("voice_enrolled_at"),
  voiceQualityScore: real("voice_quality_score"),
  voiceFeatureHash: text("voice_feature_hash"),
  voiceSampleCount: integer("voice_sample_count").default(0),

  // 指纹特征 (WebAuthn)
  fingerprintCredentialId: text("fingerprint_credential_id"),
  fingerprintPublicKey: text("fingerprint_public_key"),
  fingerprintEnrolledAt: timestamp("fingerprint_enrolled_at"),

  // 验证统计
  totalVerificationCount: integer("total_verification_count").default(0),
  successfulVerifications: integer("successful_verifications").default(0),
  failedVerifications: integer("failed_verifications").default(0),
  lastVerifiedAt: timestamp("last_verified_at"),
  lastVerificationType: text("last_verification_type"), // FACE, VOICE, FINGERPRINT

  // 安全控制
  failedAttemptCount: integer("failed_attempt_count").default(0),
  lockedUntil: timestamp("locked_until"),
  securityLevel: text("security_level").default("LOW"), // LOW, MEDIUM, HIGH, MAXIMUM

  // 设备绑定
  enrolledDevices: text("enrolled_devices").array(), // 已注册的设备ID列表

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBiometricProfileSchema = createInsertSchema(biometricProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBiometricProfile = z.infer<typeof insertBiometricProfileSchema>;
export type BiometricProfile = typeof biometricProfiles.$inferSelect;

// === Phase 1.4: 生物认证验证日志 ===
export const biometricVerificationLogs = pgTable("biometric_verification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  userId: varchar("user_id", { length: 50 }).notNull(),
  verificationType: text("verification_type").notNull(), // FACE, VOICE, FINGERPRINT

  // 验证结果
  success: boolean("success").notNull(),
  confidenceScore: real("confidence_score"),
  similarityScore: real("similarity_score"),

  // 失败原因
  failureReason: text("failure_reason"),

  // 环境信息
  deviceId: text("device_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // 安全标记
  livenessCheckPassed: boolean("liveness_check_passed"),
  spoofingDetected: boolean("spoofing_detected").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBiometricVerificationLogSchema = createInsertSchema(biometricVerificationLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertBiometricVerificationLog = z.infer<typeof insertBiometricVerificationLogSchema>;
export type BiometricVerificationLog = typeof biometricVerificationLogs.$inferSelect;

// === Phase 1.5: 后台任务基础设施 (Scheduled Jobs) ===
// 定时任务调度和执行日志

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: serial("id").primaryKey(),

  // 任务标识
  jobType: varchar("job_type", { length: 50 }).notNull().unique(),
  jobName: varchar("job_name", { length: 100 }).notNull(),
  description: text("description"),

  // 调度配置
  cronExpression: varchar("cron_expression", { length: 50 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Shanghai"),

  // 状态
  status: varchar("status", { length: 20 }).default("active"), // active, paused, disabled
  enabled: boolean("enabled").default(true),

  // 执行统计
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastResult: varchar("last_result", { length: 20 }), // success, failed, skipped
  lastError: text("last_error"),

  // 执行计数
  totalRuns: integer("total_runs").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),

  // 重试配置
  maxRetries: integer("max_retries").default(3),
  retryDelayMs: integer("retry_delay_ms").default(60000),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

// 任务执行日志
export const jobExecutionLogs = pgTable("job_execution_logs", {
  id: serial("id").primaryKey(),

  jobType: varchar("job_type", { length: 50 }).notNull(),

  // 执行信息
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),

  // 结果
  status: varchar("status", { length: 20 }).notNull(), // running, success, failed, retrying
  result: jsonb("result"),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),

  // 重试信息
  attemptNumber: integer("attempt_number").default(1),
  willRetry: boolean("will_retry").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobExecutionLogSchema = createInsertSchema(jobExecutionLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertJobExecutionLog = z.infer<typeof insertJobExecutionLogSchema>;
export type JobExecutionLog = typeof jobExecutionLogs.$inferSelect;

// === Phase 2.2: 智能提醒规则 (Reminder Rules) ===
export const reminderRules = pgTable("reminder_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title").notNull(),
  description: text("description"),

  ruleType: text("rule_type").notNull(),
  triggerType: text("trigger_type").default("TIME"),

  entityType: text("entity_type"),
  entityId: varchar("entity_id"),

  triggerConfig: jsonb("trigger_config"),

  advanceMinutes: integer("advance_minutes").default(15),

  priority: text("priority").default("NORMAL"),
  channel: text("channel").default("PUSH"),

  enabled: boolean("enabled").default(true),

  lastTriggeredAt: timestamp("last_triggered_at"),
  nextTriggerAt: timestamp("next_trigger_at"),
  triggerCount: integer("trigger_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReminderRuleSchema = createInsertSchema(reminderRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
});

export type InsertReminderRule = z.infer<typeof insertReminderRuleSchema>;
export type ReminderRule = typeof reminderRules.$inferSelect;

// === Phase 2.2: 提醒记录 (Reminder Logs) ===
export const reminderLogs = pgTable("reminder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  ruleId: varchar("rule_id"),

  title: text("title").notNull(),
  content: text("content"),

  triggerType: text("trigger_type").notNull(),
  channel: text("channel").notNull(),

  status: text("status").default("PENDING"),

  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  snoozedUntil: timestamp("snoozed_until"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReminderLogSchema = createInsertSchema(reminderLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogs.$inferSelect;

// === Phase 2.3: 合同模板 (Contract Templates) ===
export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),

  templateContent: text("template_content").notNull(),

  requiredFields: text("required_fields").array(),
  optionalFields: text("optional_fields").array(),

  riskClauses: jsonb("risk_clauses"),
  negotiationTips: text("negotiation_tips").array(),

  industry: text("industry"),
  jurisdiction: text("jurisdiction").default("中国大陆"),

  usageCount: integer("usage_count").default(0),
  rating: real("rating").default(0),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;

// === Phase 2.3: 合同草稿 (Contract Drafts) ===
export const contractDrafts = pgTable("contract_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  templateId: varchar("template_id"),

  title: text("title").notNull(),
  category: text("category").notNull(),

  partyA: jsonb("party_a"),
  partyB: jsonb("party_b"),

  projectName: text("project_name"),
  contractAmount: real("contract_amount"),
  currency: text("currency").default("CNY"),

  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  draftContent: text("draft_content"),

  filledFields: jsonb("filled_fields"),

  riskAnalysis: jsonb("risk_analysis"),
  negotiationPoints: text("negotiation_points").array(),

  status: text("status").default("DRAFT"),

  version: integer("version").default(1),
  parentDraftId: varchar("parent_draft_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContractDraftSchema = createInsertSchema(contractDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContractDraft = z.infer<typeof insertContractDraftSchema>;
export type ContractDraft = typeof contractDrafts.$inferSelect;

// === Phase 2.4: 关系图谱 (Relationship Graph) ===
export const relationshipEdges = pgTable("relationship_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  fromPersonId: varchar("from_person_id").notNull(),
  toPersonId: varchar("to_person_id").notNull(),

  relationshipType: text("relationship_type").notNull(),

  strength: real("strength").default(0.5),

  lastInteraction: timestamp("last_interaction"),
  interactionCount: integer("interaction_count").default(0),

  sentimentAvg: real("sentiment_avg").default(0),

  notes: text("notes"),

  tags: text("tags").array(),

  metadata: jsonb("metadata"),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRelationshipEdgeSchema = createInsertSchema(relationshipEdges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRelationshipEdge = z.infer<typeof insertRelationshipEdgeSchema>;
export type RelationshipEdge = typeof relationshipEdges.$inferSelect;

// 关系维护建议
export const relationshipSuggestions = pgTable("relationship_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  personId: varchar("person_id").notNull(),

  suggestionType: text("suggestion_type").notNull(),

  message: text("message").notNull(),

  priority: text("priority").default("MEDIUM"),

  dueDate: timestamp("due_date"),

  status: text("status").default("PENDING"),

  dismissedAt: timestamp("dismissed_at"),
  completedAt: timestamp("completed_at"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRelationshipSuggestionSchema = createInsertSchema(relationshipSuggestions).omit({
  id: true,
  createdAt: true,
});

export type InsertRelationshipSuggestion = z.infer<typeof insertRelationshipSuggestionSchema>;
export type RelationshipSuggestion = typeof relationshipSuggestions.$inferSelect;

// === Phase 3.3: 主动关怀规则 (Proactive Care Rules) ===
export const proactiveCareRules = pgTable("proactive_care_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  description: text("description"),

  triggerType: text("trigger_type").notNull(), // HEALTH_EVENT, EMOTION_ANOMALY, FOLLOWUP_PENDING, CONTACT_IDLE, CUSTOM

  triggerCondition: jsonb("trigger_condition").notNull(), // { eventType?, threshold?, daysSince?, emotionLevel? }

  actionType: text("action_type").notNull(), // DASHBOARD_BUBBLE, PUSH_NOTIFICATION, VOICE_REMINDER, EMAIL
  actionConfig: jsonb("action_config"), // { message?, priority?, voiceEnabled? }

  priority: text("priority").default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL

  cooldownHours: integer("cooldown_hours").default(24),
  lastTriggeredAt: timestamp("last_triggered_at"),

  isEnabled: boolean("is_enabled").default(true),
  isSystemRule: boolean("is_system_rule").default(false),

  createdBy: varchar("created_by"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProactiveCareRuleSchema = createInsertSchema(proactiveCareRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
});

export type InsertProactiveCareRule = z.infer<typeof insertProactiveCareRuleSchema>;
export type ProactiveCareRule = typeof proactiveCareRules.$inferSelect;

// === Phase 3.3: 主动关怀日志 (Proactive Care Logs) ===
export const proactiveCareLogs = pgTable("proactive_care_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  ruleId: varchar("rule_id").notNull(),
  ruleName: text("rule_name"),

  triggerType: text("trigger_type").notNull(),
  triggerData: jsonb("trigger_data"), // { eventId?, personId?, emotionData? }

  actionType: text("action_type").notNull(),
  actionResult: text("action_result").default("PENDING"), // PENDING, SENT, DELIVERED, FAILED, DISMISSED

  message: text("message"),

  targetPersonId: varchar("target_person_id"),

  userResponse: text("user_response"), // ACKNOWLEDGED, DISMISSED, SNOOZED, ACTED
  respondedAt: timestamp("responded_at"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProactiveCareLogSchema = createInsertSchema(proactiveCareLogs).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export type InsertProactiveCareLog = z.infer<typeof insertProactiveCareLogSchema>;
export type ProactiveCareLog = typeof proactiveCareLogs.$inferSelect;

// === Phase 3.3: 主动关怀通知队列 (Care Notification Queue) ===
export const careNotificationQueue = pgTable("care_notification_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  logId: varchar("log_id").notNull(),

  notificationType: text("notification_type").notNull(), // BUBBLE, PUSH, VOICE, EMAIL

  title: text("title"),
  message: text("message").notNull(),

  priority: text("priority").default("MEDIUM"),

  status: text("status").default("PENDING"), // PENDING, PROCESSING, SENT, FAILED, EXPIRED

  scheduledAt: timestamp("scheduled_at"),
  expiresAt: timestamp("expires_at"),
  sentAt: timestamp("sent_at"),

  retryCount: integer("retry_count").default(0),
  lastError: text("last_error"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCareNotificationQueueSchema = createInsertSchema(careNotificationQueue).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type InsertCareNotificationQueue = z.infer<typeof insertCareNotificationQueueSchema>;
export type CareNotificationQueue = typeof careNotificationQueue.$inferSelect;

// === Phase 3.4: 上传文档 (Uploaded Documents) ===
export const uploadedDocuments = pgTable("uploaded_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title"),
  description: text("description"),

  documentType: text("document_type").notNull(), // CONTRACT, INVOICE, RECEIPT, REPORT, OTHER
  category: text("category"), // LEGAL, FINANCE, BUSINESS, PERSONAL

  totalPages: integer("total_pages").default(1),
  totalFiles: integer("total_files").default(1),

  status: text("status").default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  processingProgress: integer("processing_progress").default(0), // 0-100

  extractedText: text("extracted_text"),
  structuredData: jsonb("structured_data"), // { parties, amounts, dates, clauses, risks }

  aiAnalysis: jsonb("ai_analysis"), // AI分析结果

  tags: text("tags").array(),

  relatedProjectId: varchar("related_project_id"),
  relatedPersonId: varchar("related_person_id"),

  createdBy: varchar("created_by"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUploadedDocumentSchema = createInsertSchema(uploadedDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUploadedDocument = z.infer<typeof insertUploadedDocumentSchema>;
export type UploadedDocument = typeof uploadedDocuments.$inferSelect;

// === Phase 3.4: 文档页面/文件 (Document Pages/Files) ===
export const documentPages = pgTable("document_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  documentId: varchar("document_id").notNull(),

  pageNumber: integer("page_number").default(1),

  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // IMAGE, PDF, WORD, EXCEL, TEXT
  fileMimeType: text("file_mime_type"),
  fileSize: integer("file_size"), // bytes
  filePath: text("file_path"),

  status: text("status").default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED

  rawText: text("raw_text"),
  ocrConfidence: real("ocr_confidence"), // OCR置信度 0-1

  extractedEntities: jsonb("extracted_entities"), // 提取的实体

  errorMessage: text("error_message"),

  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentPageSchema = createInsertSchema(documentPages).omit({
  id: true,
  createdAt: true,
  processingStartedAt: true,
  processingCompletedAt: true,
});

export type InsertDocumentPage = z.infer<typeof insertDocumentPageSchema>;
export type DocumentPage = typeof documentPages.$inferSelect;

// === Phase 3.4: 通话分析日志 (Call Analysis Logs) ===
export const callAnalysisLogs = pgTable("call_analysis_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  personId: varchar("person_id"),
  personName: text("person_name"),

  callDirection: text("call_direction"), // INCOMING, OUTGOING
  callDuration: integer("call_duration"), // seconds

  audioFilePath: text("audio_file_path"),

  transcriptText: text("transcript_text"),
  transcriptConfidence: real("transcript_confidence"),

  emotionAnalysis: jsonb("emotion_analysis"), // { dominant, intensity, timeline }
  keyPoints: jsonb("key_points"), // 提取的要点
  actionItems: jsonb("action_items"), // 待办事项

  sentiment: text("sentiment"), // POSITIVE, NEUTRAL, NEGATIVE
  sentimentScore: real("sentiment_score"),

  status: text("status").default("PENDING"),

  callStartedAt: timestamp("call_started_at"),
  callEndedAt: timestamp("call_ended_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCallAnalysisLogSchema = createInsertSchema(callAnalysisLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCallAnalysisLog = z.infer<typeof insertCallAnalysisLogSchema>;
export type CallAnalysisLog = typeof callAnalysisLogs.$inferSelect;

// === Phase 3.4: 场景识别记录 (Scene Recognition Logs) ===
export const sceneRecognitionLogs = pgTable("scene_recognition_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  detectedScene: text("detected_scene").notNull(), // WORK, HOME, COMMUTE, MEETING, LEISURE, SLEEP

  confidence: real("confidence").default(0.5),

  triggerType: text("trigger_type"), // TIME, LOCATION, ACTIVITY, MANUAL
  triggerData: jsonb("trigger_data"), // { time, location, activity }

  suggestedMode: text("suggested_mode"), // FOCUS, CASUAL, SILENT, ASSISTANT
  modeApplied: boolean("mode_applied").default(false),

  detectedAt: timestamp("detected_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSceneRecognitionLogSchema = createInsertSchema(sceneRecognitionLogs).omit({
  id: true,
  createdAt: true,
  detectedAt: true,
});

export type InsertSceneRecognitionLog = z.infer<typeof insertSceneRecognitionLogSchema>;
export type SceneRecognitionLog = typeof sceneRecognitionLogs.$inferSelect;

// === Phase 3.4: 文档对话线程 (Document Conversation Threads) ===
export const documentThreads = pgTable("document_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  documentId: varchar("document_id").notNull(),

  title: text("title"),
  status: text("status").default("ACTIVE"), // ACTIVE, ARCHIVED

  latestSummary: text("latest_summary"),

  messageCount: integer("message_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentThreadSchema = createInsertSchema(documentThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  messageCount: true,
});

export type InsertDocumentThread = z.infer<typeof insertDocumentThreadSchema>;
export type DocumentThread = typeof documentThreads.$inferSelect;

// === Phase 3.4: 文档对话消息 (Document Conversation Messages) ===
export const documentMessages = pgTable("document_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  threadId: varchar("thread_id").notNull(),
  documentId: varchar("document_id").notNull(),

  role: text("role").notNull(), // AI, MASTER

  messageType: text("message_type").notNull(), // ANALYSIS, SUPPLEMENT, CORRECTION, HIGHLIGHT, REVISION, QUESTION, ANSWER

  content: text("content").notNull(),

  structuredDiff: jsonb("structured_diff"), // { field, oldValue, newValue, action }

  affectedFields: text("affected_fields").array(), // 影响的结构化字段

  relevanceScore: real("relevance_score").default(1.0), // 相关性评分 0-1

  isApplied: boolean("is_applied").default(false), // 是否已应用到结构化数据

  parentMessageId: varchar("parent_message_id"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentMessageSchema = createInsertSchema(documentMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentMessage = z.infer<typeof insertDocumentMessageSchema>;
export type DocumentMessage = typeof documentMessages.$inferSelect;

// === Phase 3.4: 文档补充资料 (Document Supplements) ===
export const documentSupplements = pgTable("document_supplements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  documentId: varchar("document_id").notNull(),
  threadId: varchar("thread_id").notNull(),

  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // IMAGE, PDF, WORD, EXCEL, TEXT
  fileMimeType: text("file_mime_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path"),

  extractedText: text("extracted_text"),
  summaryText: text("summary_text"),

  status: text("status").default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED

  sourceMessageId: varchar("source_message_id"), // 关联的消息ID

  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertDocumentSupplementSchema = createInsertSchema(documentSupplements).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertDocumentSupplement = z.infer<typeof insertDocumentSupplementSchema>;
export type DocumentSupplement = typeof documentSupplements.$inferSelect;

// === Z1 Protocol: Encrypted Secrets (密钥保险库) ===
// 遵循 Z1 协议铁律1：算力主权 - API Key 必须加密存储
export const encryptedSecrets = pgTable("encrypted_secrets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  keyType: text("key_type").notNull().unique(), // DASHSCOPE_API_KEY, DEEPSEEK_API_KEY, DOUBAO_API_KEY, CUSTOM

  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM 加密的 JSON

  keyFingerprint: text("key_fingerprint"), // SHA256 前16位用于验证

  description: text("description"), // 可选描述

  lastRotatedAt: timestamp("last_rotated_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEncryptedSecretSchema = createInsertSchema(encryptedSecrets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEncryptedSecret = z.infer<typeof insertEncryptedSecretSchema>;
export type EncryptedSecret = typeof encryptedSecrets.$inferSelect;

// === Z1 Protocol: Insight Listener (智语洞察监听系统) ===

// 监听会话表
export const insightSessions = pgTable("insight_sessions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),

  mode: text("mode").notNull().default("SILENT"), // MEETING, CONVERSATION, CASUAL, NEGOTIATION, SILENT

  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),

  isActive: integer("is_active").default(1),

  speakerCount: integer("speaker_count").default(0),
  transcriptCount: integer("transcript_count").default(0),
  entityCount: integer("entity_count").default(0),
  alertCount: integer("alert_count").default(0),

  sceneTransitions: jsonb("scene_transitions"), // SceneTransition[]

  recordingPath: text("recording_path"), // 原始录音存储路径
  recordingSize: integer("recording_size"), // 文件大小(bytes)

  summary: text("summary"), // 会话总结
  keyMoments: text("key_moments").array(), // 关键时刻摘要

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInsightSessionSchema = createInsertSchema(insightSessions).omit({
  createdAt: true,
});

export type InsertInsightSession = z.infer<typeof insertInsightSessionSchema>;
export type InsightSession = typeof insightSessions.$inferSelect;

// 转写片段表
export const insightTranscripts = pgTable("insight_transcripts", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),

  speakerId: varchar("speaker_id"), // 声纹识别的说话人ID
  speakerName: text("speaker_name"), // 说话人名称
  isMaster: integer("is_master").default(0), // 是否为主人发言

  text: text("text").notNull(), // 转写文本

  startTime: real("start_time").notNull(), // 开始时间(秒)
  endTime: real("end_time").notNull(), // 结束时间(秒)
  confidence: real("confidence").default(0), // ASR置信度

  emotion: jsonb("emotion"), // EmotionResult
  keywords: text("keywords").array(), // 提取的关键词

  sensitivityLevel: text("sensitivity_level").default("LOW"), // LOW, MEDIUM, HIGH, CRITICAL

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInsightTranscriptSchema = createInsertSchema(insightTranscripts).omit({
  createdAt: true,
});

export type InsertInsightTranscript = z.infer<typeof insertInsightTranscriptSchema>;
export type InsightTranscript = typeof insightTranscripts.$inferSelect;

// 提取实体表
export const insightEntities = pgTable("insight_entities", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),

  type: text("type").notNull(), // PERSON, ORGANIZATION, TOPIC, COMMITMENT, CONFLICT, OPPORTUNITY, DEADLINE, MONEY
  value: text("value").notNull(), // 实体值
  context: text("context"), // 上下文

  confidence: real("confidence").default(0),
  importance: real("importance").default(0.5), // 重要性评分 0-1

  relatedSpeaker: text("related_speaker"), // 相关说话人

  linkedPersonId: varchar("linked_person_id"), // 关联到persons表的ID
  linkedOrganizationId: varchar("linked_organization_id"), // 关联到组织

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInsightEntitySchema = createInsertSchema(insightEntities).omit({
  createdAt: true,
});

export type InsertInsightEntity = z.infer<typeof insertInsightEntitySchema>;
export type InsightEntity = typeof insightEntities.$inferSelect;

// 洞察提醒表
export const insightAlerts = pgTable("insight_alerts", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),

  type: text("type").notNull(), // OPPORTUNITY, RISK, COMMITMENT, CONFLICT, FOLLOWUP, EMOTION_WARNING
  priority: text("priority").notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, URGENT

  title: text("title").notNull(),
  description: text("description"),
  suggestedAction: text("suggested_action"),

  relatedEntityIds: text("related_entity_ids").array(),

  deliveredVia: text("delivered_via"), // EARPHONE, WATCH, PHONE, NONE
  deliveredAt: timestamp("delivered_at"),

  acknowledged: integer("acknowledged").default(0),
  acknowledgedAt: timestamp("acknowledged_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInsightAlertSchema = createInsertSchema(insightAlerts).omit({
  createdAt: true,
});

export type InsertInsightAlert = z.infer<typeof insertInsightAlertSchema>;
export type InsightAlert = typeof insightAlerts.$inferSelect;

// 反馈通道注册表
export const insightFeedbackChannels = pgTable("insight_feedback_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),

  channelType: text("channel_type").notNull(), // EARPHONE, WATCH, PHONE
  deviceId: text("device_id"),
  deviceName: text("device_name"),

  priority: integer("priority").default(1), // 优先级,数字越小优先级越高
  isAvailable: integer("is_available").default(1),

  lastConnectedAt: timestamp("last_connected_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInsightFeedbackChannelSchema = createInsertSchema(insightFeedbackChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInsightFeedbackChannel = z.infer<typeof insertInsightFeedbackChannelSchema>;
export type InsightFeedbackChannel = typeof insightFeedbackChannels.$inferSelect;

// === Phase 11.3: Swarm Management (蜂群管理) ===

// 蜂群实体表 - 存储小智的分身
export const swarmEntities = pgTable("swarm_entities", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // MASTER, CLONE, AGENT, OBSERVER
  parentId: varchar("parent_id"),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUSPENDED, EXPIRED, REVOKED

  permissions: jsonb("permissions"), // 权限配置
  capabilities: text("capabilities").array(), // 功能列表

  // 元数据
  metadata: jsonb("metadata"), // { deviceInfo, ipRestrictions, maxSessions, currentSessions, totalRequests }

  expiresAt: timestamp("expires_at"),
  lastActiveAt: timestamp("last_active_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSwarmEntitySchema = createInsertSchema(swarmEntities).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertSwarmEntity = z.infer<typeof insertSwarmEntitySchema>;
export type SwarmEntity = typeof swarmEntities.$inferSelect;

// 访问令牌表 - 存储分身访问令牌
export const swarmTokens = pgTable("swarm_tokens", {
  id: varchar("id").primaryKey(),
  entityId: varchar("entity_id").notNull().references(() => swarmEntities.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  type: text("type").notNull(), // SESSION, API, ONETIME

  permissions: text("permissions").array(), // 权限ID列表

  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),

  usageCount: integer("usage_count").default(0),
  maxUsage: integer("max_usage"), // null 表示无限制

  status: text("status").notNull().default("ACTIVE"), // ACTIVE, EXPIRED, REVOKED

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSwarmTokenSchema = createInsertSchema(swarmTokens).omit({
  createdAt: true,
});

export type InsertSwarmToken = z.infer<typeof insertSwarmTokenSchema>;
export type SwarmToken = typeof swarmTokens.$inferSelect;

// 团队表 - 存储分身团队
export const swarmTeams = pgTable("swarm_teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  leaderEntityId: varchar("leader_entity_id").notNull().references(() => swarmEntities.id),

  members: jsonb("members"), // 团队成员列表
  aggregatedStats: jsonb("aggregated_stats"), // 聚合统计

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSwarmTeamSchema = createInsertSchema(swarmTeams).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertSwarmTeam = z.infer<typeof insertSwarmTeamSchema>;
export type SwarmTeam = typeof swarmTeams.$inferSelect;

// 团队洞察表 - 存储团队分析结果
export const swarmTeamInsights = pgTable("swarm_team_insights", {
  id: varchar("id").primaryKey(),
  teamId: varchar("team_id").notNull().references(() => swarmTeams.id, { onDelete: 'cascade' }),

  type: text("type").notNull(), // USAGE_PATTERN, SECURITY_ALERT, EFFICIENCY, RECOMMENDATION
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(), // INFO, WARNING, CRITICAL

  generatedAt: timestamp("generated_at").defaultNow(),
});

export const insertSwarmTeamInsightSchema = createInsertSchema(swarmTeamInsights).omit({
  generatedAt: true,
});

export type InsertSwarmTeamInsight = z.infer<typeof insertSwarmTeamInsightSchema>;
export type SwarmTeamInsight = typeof swarmTeamInsights.$inferSelect;

// 审计日志表 - 存储蜂群操作审计
export const swarmAuditLogs = pgTable("swarm_audit_logs", {
  id: varchar("id").primaryKey(),
  entityId: varchar("entity_id"),
  tokenId: varchar("token_id"),

  action: text("action").notNull(),
  resource: text("resource").notNull(),
  outcome: text("outcome").notNull(), // SUCCESS, DENIED, ERROR

  details: jsonb("details"), // 详细信息
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),

  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertSwarmAuditLogSchema = createInsertSchema(swarmAuditLogs).omit({
  timestamp: true,
});

export type InsertSwarmAuditLog = z.infer<typeof insertSwarmAuditLogSchema>;
export type SwarmAuditLog = typeof swarmAuditLogs.$inferSelect;

// ============================================================
// 主动事件监控与影响分析系统 (Proactive Event Monitoring System)
// ============================================================

// 事件类型枚举
export const eventTypes = {
  POLICY: 'POLICY',           // 政策变化
  LEGAL: 'LEGAL',             // 法律变化
  EMERGENCY: 'EMERGENCY',     // 突发事件
  TAX: 'TAX',                 // 税务政策
  LABOR: 'LABOR',             // 劳动法规
  INDUSTRY: 'INDUSTRY',       // 行业动态
  MARKET: 'MARKET',           // 市场变化
} as const;
export type EventType = typeof eventTypes[keyof typeof eventTypes];

// 事件影响级别
export const impactLevels = {
  LOW: 'LOW',                 // 低影响
  MEDIUM: 'MEDIUM',           // 中等影响
  HIGH: 'HIGH',               // 高影响
  CRITICAL: 'CRITICAL',      // 重大影响
} as const;
export type ImpactLevel = typeof impactLevels[keyof typeof impactLevels];

// 事件状态
export const eventStatuses = {
  NEW: 'NEW',                 // 新事件
  ANALYZING: 'ANALYZING',     // 分析中
  ANALYZED: 'ANALYZED',       // 已分析
  NOTIFIED: 'NOTIFIED',       // 已通知
  DISMISSED: 'DISMISSED',     // 已忽略
  RESOLVED: 'RESOLVED',       // 已解决
} as const;
export type EventStatus = typeof eventStatuses[keyof typeof eventStatuses];

// 监控的事件表
export const monitoredEvents = pgTable("monitored_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 事件基本信息
  eventType: text("event_type").notNull(),           // 事件类型
  title: text("title").notNull(),                   // 事件标题
  summary: text("summary"),                         // 事件摘要
  content: text("content"),                         // 详细内容

  // 来源信息
  source: text("source"),                            // 来源名称
  sourceUrl: text("source_url"),                    // 来源URL
  publishDate: timestamp("publish_date"),           // 发布日期
  effectiveDate: timestamp("effective_date"),       // 生效日期

  // 分类标签
  category: text("category"),                       // 行业/领域分类
  tags: text("tags").array(),                       // 标签

  // 影响分析
  impactLevel: text("impact_level").default('LOW'), // 影响级别
  affectedAreas: text("affected_areas").array(),    // 影响领域
  impactDescription: text("impact_description"),    // 影响描述

  // 解决方案
  solution: text("solution"),                       // 解决方案
  actionItems: jsonb("action_items"),               // 行动项 [{ title, deadline, priority }]

  // 状态
  status: text("status").default('NEW'),            // 状态

  // 原始数据
  rawData: jsonb("raw_data"),                       // 原始数据

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMonitoredEventSchema = createInsertSchema(monitoredEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMonitoredEvent = z.infer<typeof insertMonitoredEventSchema>;
export type MonitoredEvent = typeof monitoredEvents.$inferSelect;

// 用户事件偏好设置表
export const userEventPreferences = pgTable("user_event_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  userId: varchar("user_id").notNull(),             // 用户ID

  // 关注的领域
  interestedCategories: text("interested_categories").array(), // 感兴趣的领域
  interestedEventTypes: text("interested_event_types").array(), // 感兴趣的事件类型

  // 关注的企业/行业
  followedIndustries: text("followed_industries").array(),    // 关注的行业
  followedCompanies: text("followed_companies").array(),       // 关注的企业

  // 通知设置
  notifyEnabled: boolean("notify_enabled").default(true),     // 是否启用通知
  notifyTypes: text("notify_types").array(),                  // 通知类型 [BUBBLE, PUSH, VOICE]
  minImpactLevel: text("min_impact_level").default('MEDIUM'), // 最小通知影响级别

  // 时间设置
  activeHoursStart: text("active_hours_start").default('09:00'), // 活跃时间开始
  activeHoursEnd: text("active_hours_end").default('22:00'),   // 活跃时间结束

  // 最后检查时间
  lastCheckedAt: timestamp("last_checked_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserEventPreferenceSchema = createInsertSchema(userEventPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserEventPreference = z.infer<typeof insertUserEventPreferenceSchema>;
export type UserEventPreference = typeof userEventPreferences.$inferSelect;

// 事件提醒表
export const eventAlerts = pgTable("event_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  userId: varchar("user_id").notNull(),             // 用户ID
  eventId: varchar("event_id").references(() => monitoredEvents.id, { onDelete: 'cascade' }), // 关联事件

  // 提醒内容
  title: text("title").notNull(),                   // 提醒标题
  message: text("message").notNull(),              // 提醒消息
  solution: text("solution"),                      // 解决方案摘要

  // 影响信息
  impactLevel: text("impact_level").notNull(),     // 影响级别
  affectedAreas: text("affected_areas").array(),   // 影响领域

  // 通知状态
  notificationType: text("notification_type").default('BUBBLE'), // 通知类型
  isRead: boolean("is_read").default(false),       // 是否已读
  isDismissed: boolean("is_dismissed").default(false), // 是否被忽略

  // 发送时间
  scheduledAt: timestamp("scheduled_at"),          // 计划发送时间
  sentAt: timestamp("sent_at"),                    // 实际发送时间

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventAlertSchema = createInsertSchema(eventAlerts).omit({
  id: true,
  createdAt: true,
});

export type InsertEventAlert = z.infer<typeof insertEventAlertSchema>;
export type EventAlert = typeof eventAlerts.$inferSelect;

// 事件分析历史表
export const eventAnalysisHistory = pgTable("event_analysis_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  eventId: varchar("event_id").notNull(),          // 事件ID
  userId: varchar("user_id").notNull(),            // 用户ID

  // 分析结果
  relevance: integer("relevance").default(0),     // 相关度 0-100
  impactScore: integer("impact_score").default(0), // 影响评分 0-100
  urgencyScore: integer("urgency_score").default(0), // 紧急度 0-100

  // 分析详情
  analysisData: jsonb("analysis_data"),            // 分析数据

  // 用户反馈
  userFeedback: text("user_feedback"),              // 用户反馈
  isUseful: boolean("is_useful"),                  // 是否有用

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventAnalysisHistorySchema = createInsertSchema(eventAnalysisHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertEventAnalysisHistory = z.infer<typeof insertEventAnalysisHistorySchema>;
export type EventAnalysisHistory = typeof eventAnalysisHistory.$inferSelect;

// ============================================================
// 任务编排系统 (Task Orchestration System)
// ============================================================

// 任务定义表
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 任务基本信息
  name: text("name").notNull(),
  description: text("description"),

  // 触发器配置
  triggerType: text("trigger_type").notNull().default('MANUAL'), // CRON, HEARTBEAT, MANUAL, WEBHOOK
  triggerConfig: jsonb("trigger_config"), // { expression?, deviceId?, condition? }

  // 任务动作列表 (JSON数组)
  actions: jsonb("actions").notNull(), // TaskAction[]

  // 执行选项
  options: jsonb("options"), // { retryCount, retryDelay, timeout, continueOnError, parallel, onSuccessTaskId, onFailureTaskId }

  // 状态
  status: text("status").notNull().default('PENDING'), // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, PAUSED
  enabled: boolean("enabled").default(true),

  // 时间戳
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),

  createdBy: varchar("created_by"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// 任务执行历史表
export const taskExecutions = pgTable("task_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联任务
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  taskName: text("task_name"), // 冗余存储任务名称

  // 执行状态
  status: text("status").notNull().default('RUNNING'), // RUNNING, COMPLETED, FAILED, CANCELLED
  triggeredBy: text("triggered_by"), // cron, manual, api, heartbeat

  // 时间
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),

  // 执行结果
  result: jsonb("result"), // { success, completedActions, failedActions, totalDuration, error }

  // 动作执行详情 (JSON数组)
  actionResults: jsonb("action_results"), // TaskActionExecution[]

  // 元数据
  executionSource: text("execution_source"), // 触发来源详情

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskExecutionSchema = createInsertSchema(taskExecutions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertTaskExecution = z.infer<typeof insertTaskExecutionSchema>;
export type TaskExecution = typeof taskExecutions.$inferSelect;

// PC设备远程控制表 (用于桌面端远程控制)
export const pcDevices = pgTable("pc_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 设备信息
  name: text("name").notNull(),
  platform: text("platform").notNull(), // WINDOWS, MACOS, LINUX
  osVersion: text("os_version"),

  // 能力
  capabilities: jsonb("capabilities"), // { screenCapture, mouseControl, keyboardControl, fileSystem, clipboard, notifications, maxResolution }

  // 状态
  status: text("status").notNull().default('OFFLINE'), // OFFLINE, ONLINE, BUSY, ERROR

  // 网络
  ipAddress: varchar("ip_address"),

  // 时间戳
  lastSeen: timestamp("last_seen"),
  registeredAt: timestamp("registered_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPcDeviceSchema = createInsertSchema(pcDevices).omit({
  id: true,
  createdAt: true,
  registeredAt: true,
  lastSeen: true,
});

export type InsertPcDevice = z.infer<typeof insertPcDeviceSchema>;
export type PcDevice = typeof pcDevices.$inferSelect;

// PC远程控制会话表
export const pcSessions = pgTable("pc_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联设备
  deviceId: varchar("device_id").notNull().references(() => pcDevices.id, { onDelete: 'cascade' }),

  // 会话信息
  userId: varchar("user_id"),
  status: text("status").notNull().default('CONNECTING'), // CONNECTING, CONNECTED, DISCONNECTED

  // 活动信息
  lastActivity: timestamp("last_activity"),

  // 时间戳
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPcSessionSchema = createInsertSchema(pcSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertPcSession = z.infer<typeof insertPcSessionSchema>;
export type PcSession = typeof pcSessions.$inferSelect;

// 告警通知表
export const taskAlerts = pgTable("task_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 关联
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: 'cascade' }),
  executionId: varchar("execution_id").references(() => taskExecutions.id, { onDelete: 'cascade' }),

  // 告警信息
  type: text("type").notNull(), // TASK_FAILED, TASK_TIMEOUT, DEVICE_OFFLINE, EXECUTION_ERROR
  severity: text("severity").notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL

  title: text("title").notNull(),
  message: text("message").notNull(),

  // 状态
  status: text("status").notNull().default('PENDING'), // PENDING, SENT, READ, DISMISSED

  // 通知渠道
  channels: jsonb("channels"), // ['BUBBLE', 'PUSH', 'EMAIL']

  // 时间
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),

  // 元数据
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskAlertSchema = createInsertSchema(taskAlerts).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  readAt: true,
});

export type InsertTaskAlert = z.infer<typeof insertTaskAlertSchema>;
export type TaskAlert = typeof taskAlerts.$inferSelect;

// === Authorization: session/user grants (Epic E-AUTHZ) ===
export const authzGrants = pgTable(
  "authz_grants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    principalKind: text("principal_kind").notNull(),
    principalId: text("principal_id").notNull(),
    workspaceId: text("workspace_id").notNull().default(""),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    scope: text("scope").notNull(),
    source: text("source").default("ADMIN"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    authzGrantsUniq: uniqueIndex("authz_grants_uniq").on(
      table.principalKind,
      table.principalId,
      table.workspaceId,
      table.resource,
      table.action,
      table.scope
    ),
    authzGrantsPrincipalIdx: index("authz_grants_principal_idx").on(
      table.principalKind,
      table.principalId
    ),
  })
);

export const insertAuthzGrantSchema = createInsertSchema(authzGrants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthzGrant = z.infer<typeof insertAuthzGrantSchema>;

// === P0 Conversation 底座 ===

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  source: text("source").notNull(), // mobile|desktop|xiaozhi_device|omi|browser|file|manual|import
  sourceDeviceId: text("source_device_id"),
  externalSourceId: text("external_source_id"),
  mode: text("mode"), // casual_chat|record_note|conversation_record|task_request
  status: text("status").notNull().default("in_progress"), // in_progress|processing|review_pending|completed|failed|discarded
  language: text("language"),
  title: text("title"),
  summary: text("summary"),
  keyPoints: jsonb("key_points").notNull().default(sql`'[]'::jsonb`),
  rawPayloadRef: text("raw_payload_ref"),
  hash: text("hash"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  importedAt: timestamp("imported_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// P0 感知片段表（区别于已有的 talk session conversation_segments）
export const convSegments = pgTable("conv_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  sequence: integer("sequence").notNull(),
  segmentType: text("segment_type").notNull(), // transcript|audio|screen|image|file|system|import_note
  text: text("text"),
  speaker: text("speaker"),
  speakerType: text("speaker_type"), // user|navigator|device|system
  personId: varchar("person_id"),
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  confidence: numeric("confidence"),
  mediaRef: text("media_ref"),
  rawPayloadRef: text("raw_payload_ref"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConvSegmentSchema = createInsertSchema(convSegments).omit({
  id: true,
  createdAt: true,
});

export type InsertConvSegment = z.infer<typeof insertConvSegmentSchema>;
export type ConvSegment = typeof convSegments.$inferSelect;

export const conversationCandidates = pgTable("conversation_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  candidateType: text("candidate_type").notNull(), // memory|task|event|project_update|person_update|risk|insight
  status: text("status").notNull().default("pending"), // pending|accepted|edited|rejected|applied
  content: jsonb("content").notNull(),
  confidence: numeric("confidence"),
  riskLevel: text("risk_level"), // low|medium|high|critical
  linkedEntityId: varchar("linked_entity_id"),
  linkedEntityType: text("linked_entity_type"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationCandidateSchema = createInsertSchema(conversationCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversationCandidate = z.infer<typeof insertConversationCandidateSchema>;
export type ConversationCandidate = typeof conversationCandidates.$inferSelect;

export const deviceBindings = pgTable("device_bindings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  identityId: varchar("identity_id").notNull(),
  deviceId: text("device_id").notNull().unique(),
  deviceType: text("device_type").notNull(), // mobile|desktop|esp32_voice|omi|browser
  provider: text("provider").notNull(),
  displayName: text("display_name"),
  status: text("status").notNull().default("active"), // active|revoked|offline
  capabilities: jsonb("capabilities").notNull().default(sql`'{}'::jsonb`),
  allowedModes: jsonb("allowed_modes").notNull().default(sql`'[]'::jsonb`),
  riskPolicy: jsonb("risk_policy").notNull().default(sql`'{}'::jsonb`),
  lastSeenAt: timestamp("last_seen_at"),
  boundAt: timestamp("bound_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const insertDeviceBindingSchema = createInsertSchema(deviceBindings).omit({
  id: true,
  boundAt: true,
});

export type InsertDeviceBinding = z.infer<typeof insertDeviceBindingSchema>;
export type DeviceBinding = typeof deviceBindings.$inferSelect;

export const providerSyncStates = pgTable("provider_sync_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  provider: text("provider").notNull(),
  accountRef: text("account_ref"),
  cursor: text("cursor"),
  lastSyncedAt: timestamp("last_synced_at"),
  status: text("status").notNull().default("idle"), // idle|syncing|error|disconnected
  errorMessage: text("error_message"),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProviderSyncStateSchema = createInsertSchema(providerSyncStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProviderSyncState = z.infer<typeof insertProviderSyncStateSchema>;
export type ProviderSyncState = typeof providerSyncStates.$inferSelect;
export type AuthzGrant = typeof authzGrants.$inferSelect;

// === Z3 Schema: Swarm Task Registry（蜂群任务注册表，持久化层）===
export const swarmTasks = pgTable("swarm_tasks", {
  id:             text("id").primaryKey(),
  taskName:       text("task_name").notNull(),
  payload:        jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  targetNodes:    text("target_nodes").notNull().default("ALL"),
  deliveredCount: integer("delivered_count").notNull().default(0),
  broadcastedAt:  timestamp("broadcasted_at", { withTimezone: true }).notNull().defaultNow(),
  reports:        jsonb("reports").notNull().default(sql`'[]'::jsonb`),
});

export type SwarmTaskRow = typeof swarmTasks.$inferSelect;

// === Z3 Schema: Pending Actions（暂存待确认动作，10分钟TTL）===
export const pendingActions = pgTable("pending_actions", {
  id:           text("id").primaryKey(),
  entryType:    text("entry_type").notNull(),   // 'pending' | 'draft'
  action:       text("action"),
  actionParams: jsonb("action_params"),
  items:        jsonb("items"),
  userId:       text("user_id").notNull(),
  expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PendingActionRow = typeof pendingActions.$inferSelect;
