import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Z2 Schema: Relationship Matrix (人际关系网/博弈表) ===
export const persons = pgTable("persons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"), // 角色/职位
  organization: text("organization"), // 所属组织
  tags: text("tags").array(), // 标签数组
  
  // Intelligence Attributes (谍报属性)
  weakness: text("weakness"), // vulnerability - 对手弱点分析记录
  interestChain: jsonb("interest_chain"), // interest_connections - 利益链映射 JSON
  decisionStyle: text("decision_style"), // 决策风格: AGGRESSIVE, CONSERVATIVE, SWING
  decisionDna: text("decision_dna"), // [NEW] 语义向量 (用于预测对方决策) - pgvector ready
  lastInteraction: timestamp("last_interaction"),
  
  // Relationship Graph (关系图谱)
  connectionNodes: text("connection_nodes").array(), // 关联人物 UUID[]
  bondStrength: real("bond_strength").default(0.5), // 关联强度 0.0-1.0
  conflictPoints: text("conflict_points").array(), // 潜在冲突点
  
  // [NEW] Access Control (权限控制)
  accessLevel: text("access_level").default("ZONE_BLUE"), // ZONE_RED | ZONE_BLUE | ZONE_GREEN
  
  // [NEW] 锚点审批状态
  approvalStatus: text("approval_status").default("PENDING"), // PENDING, CONFIRMED, ON_HOLD, DELETED
  addedBy: text("added_by").default("AI"), // AI, MASTER
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPersonSchema = createInsertSchema(persons).omit({
  id: true,
  createdAt: true,
});

export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof persons.$inferSelect;

// === Z2 Schema: Resource Vault (资源堡垒索引) ===
export const vaultItems = pgTable("vault_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // RESEARCH, SOFTWARE, MEDIA, BOOK, SYSTEM_DRIVE
  fileName: text("file_name").notNull(),
  filePath: text("file_path"), // [NEW] 文件物理路径
  fileHash: text("file_hash"), // SHA256
  sourceUrl: text("source_url"),
  
  // Security & Indexing
  sandboxStatus: text("sandbox_status").default("PENDING"), // PENDING, SAFE, QUARANTINE (= security_status)
  semanticTags: text("semantic_tags").array(), // 语义标签
  semanticIndex: text("semantic_index"), // [NEW] 语义摘要向量 (用于意图调阅) - pgvector ready
  downloadNode: text("download_node").default("SERVER_01"),
  
  // Privacy Zone
  privacyZone: text("privacy_zone").default("ZONE_GREEN"), // RED, BLUE, GREEN
  
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
  context: text("context").notNull(), // 上下文描述 (含场景ID)
  choiceMade: text("choice_made").notNull(), // 最终选择 (含主人原始动作)
  rejectedOptions: text("rejected_options").array(), // 被拒绝的选项
  mimicryWeight: real("mimicry_weight").default(0.5), // 逻辑权重/模仿权重
  
  // Academic Progress
  field: text("field"), // LAW, FINANCE, STRATEGY, BIO
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

// === Legacy User Schema (Keep for compatibility) ===
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
  category: text("category").notNull(), // RESEARCH, SOFTWARE, MEDIA, BOOKS
  status: text("status").default("PENDING"), // PENDING, DOWNLOADING, INDEXING, COMPLETE, FAILED
  progress: integer("progress").default(0), // 0-100
  fileSize: integer("file_size"),
  fileName: text("file_name"),
  sandboxResult: text("sandbox_result"), // SAFE, QUARANTINE, PENDING
  errorMessage: text("error_message"),
  vaultItemId: varchar("vault_item_id"), // Link to vault_items after completion
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
  jobType: text("job_type").notNull(), // PDF_EDIT, VIDEO_TRANSCODE, REPORT_ANALYSIS, DREAM_SIMULATION
  status: text("status").default("QUEUED"), // QUEUED, PROCESSING, COMPLETE, FAILED
  priority: integer("priority").default(5), // 1-10, higher = more urgent
  inputPayload: jsonb("input_payload"), // Task-specific input data
  outputResult: jsonb("output_result"), // Task-specific output data
  progress: integer("progress").default(0),
  processingTimeMs: integer("processing_time_ms"),
  sourceDevice: text("source_device").default("Z5_MOBILE"), // Which device submitted
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

// === Z6 Schema: Dream Logs (梦境推演日志) ===
export const dreamLogs = pgTable("dream_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dreamType: text("dream_type").notNull(), // BUSINESS_SIMULATION, SELF_EVOLUTION, MEMORY_CONSOLIDATION
  simulationCount: integer("simulation_count").default(0),
  decisionsOptimized: integer("decisions_optimized").default(0),
  patchesGenerated: text("patches_generated").array(),
  insightsDiscovered: jsonb("insights_discovered"),
  durationMs: integer("duration_ms"),
  status: text("status").default("SLEEPING"), // SLEEPING, DREAMING, AWAKENED
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDreamLogSchema = createInsertSchema(dreamLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDreamLog = z.infer<typeof insertDreamLogSchema>;
export type DreamLog = typeof dreamLogs.$inferSelect;

// === P0: Audit Log Schema (审计日志) ===
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // SHRED, DOWNLOAD, COMPUTE, LOGIN, ROLE_CHANGE, etc.
  actor: text("actor").notNull(), // MASTER, GUEST, or user ID
  targetType: text("target_type"), // vault_item, person, download_task, etc.
  targetId: text("target_id"),
  details: jsonb("details"), // Additional context
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  result: text("result").default("SUCCESS"), // SUCCESS, DENIED, FAILED
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
  expertType: text("expert_type").notNull(), // LEGAL, FINANCE, STRATEGY, SECRETARY, PSYCHOLOGY, PLANNING
  query: text("query").notNull(), // 用户问题
  chainOfThought: jsonb("chain_of_thought"), // 思维链
  recommendation: text("recommendation"), // 最终建议
  confidence: real("confidence").default(0.5), // 置信度 0.0-1.0
  hpCost: integer("hp_cost").default(0), // HP 消耗
  appliedToZ1: integer("applied_to_z1").default(0), // 是否已应用到 Z1
  feedbackScore: real("feedback_score"), // 用户反馈评分
  relatedPersonIds: text("related_person_ids").array(), // 相关人物
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
  sourceModule: text("source_module").notNull(), // Z6_DREAM, Z4_DECISION, Z2_MEMORY
  eventType: text("event_type").notNull(), // HP_GAIN, LEVEL_UP, WEIGHT_UPDATE, SKILL_UNLOCK
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  deltaDescription: text("delta_description"), // 人类可读的变化描述
  triggeredBy: text("triggered_by"), // 触发源 ID (dream_log_id, decision_id, etc.)
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
  category: text("category").default("BUSINESS"), // BUSINESS, ACQUISITION, INVESTMENT, PARTNERSHIP
  status: text("status").default("PENDING_REVIEW"), // PENDING_REVIEW, APPROVED, ON_HOLD, ABOLISHED
  priority: integer("priority").default(5), // 1-10
  
  // 关联数据
  relatedPersonIds: text("related_person_ids").array(),
  relatedIntelIds: text("related_intel_ids").array(),
  
  // 专家分析结果
  legalAnalysis: jsonb("legal_analysis"),
  financeAnalysis: jsonb("finance_analysis"),
  strategyAnalysis: jsonb("strategy_analysis"),
  
  // 审批信息
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  source: text("source"), // 来源：网络搜集、用户输入、AI发现
  category: text("category").default("GENERAL"), // GENERAL, COMPETITOR, OPPORTUNITY, RISK, PERSON
  
  // 审批状态
  status: text("status").default("PENDING"), // PENDING, PROJECT(立项), COLLECTING(续搜), ARCHIVED(归档), SHREDDED(粉碎)
  
  // 关联
  relatedPersonId: varchar("related_person_id"),
  relatedProjectId: varchar("related_project_id"),
  
  // AI 分析
  riskLevel: text("risk_level").default("LOW"), // LOW, MEDIUM, HIGH, CRITICAL
  aiSummary: text("ai_summary"),
  aiRecommendation: text("ai_recommendation"),
  
  // 审批
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
export const skillCapsules = pgTable("skill_capsules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // LEGAL, FINANCE, STRATEGY, SECRETARY, HEALTH, EVOLUTION
  
  // 能力定义
  skillCode: text("skill_code"), // 技能代码/逻辑
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  
  // 来源与状态
  learnedFrom: text("learned_from"), // DREAM, EXTERNAL_LLM, USER_FEEDBACK
  isActive: integer("is_active").default(1),
  version: text("version").default("1.0.0"),
  
  // 统计
  usageCount: integer("usage_count").default(0),
  successRate: real("success_rate").default(1.0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSkillCapsuleSchema = createInsertSchema(skillCapsules).omit({
  id: true,
  createdAt: true,
});

export type InsertSkillCapsule = z.infer<typeof insertSkillCapsuleSchema>;
export type SkillCapsule = typeof skillCapsules.$inferSelect;

// === 进化状态 (Evolution State) - 单例表 ===
export const evolutionState = pgTable("evolution_state", {
  id: varchar("id").primaryKey().default("singleton"),
  
  // 学术阶梯
  academicLevel: text("academic_level").default("BACHELOR"), // BACHELOR, MASTER, PHD, EXPERT, AVATAR
  academicXp: integer("academic_xp").default(0),
  nextLevelXp: integer("next_level_xp").default(1000),
  
  // 脱离外脑进度
  localModelProgress: real("local_model_progress").default(0), // 0-100%
  externalCallCount: integer("external_call_count").default(0),
  localCallCount: integer("local_call_count").default(0),
  
  // 知识蒸馏
  distillationCount: integer("distillation_count").default(0),
  distilledKnowledgeSize: integer("distilled_knowledge_size").default(0), // KB
  
  // 能力统计
  totalSkillCapsules: integer("total_skill_capsules").default(0),
  activeSkillCapsules: integer("active_skill_capsules").default(0),
  
  // 梦境统计
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
  
  // 汇报内容
  summary: text("summary"), // 今日总结
  keyEvents: jsonb("key_events"), // 重要事件列表
  
  // 商机与预测
  opportunities: jsonb("opportunities"), // 发现的商机
  predictions: jsonb("predictions"), // 事件预测
  risks: jsonb("risks"), // 风险提醒
  
  // 待办建议
  suggestedActions: jsonb("suggested_actions"),
  
  // HP 与进化
  hpConsumed: integer("hp_consumed").default(0),
  xpGained: integer("xp_gained").default(0),
  
  // 状态
  isRead: integer("is_read").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReports).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReport = typeof dailyReports.$inferSelect;

// === 锚点审批状态扩展 ===
export type PersonApprovalStatus = 'PENDING' | 'CONFIRMED' | 'ON_HOLD' | 'DELETED';

// === 合同管理 (Contracts with Multi-page Support) ===
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  
  // 合同状态
  status: text("status").default("DRAFT"), // DRAFT, PENDING_REVIEW, APPROVED, REJECTED, EXECUTED
  
  // 关联
  relatedPersonId: varchar("related_person_id"),
  relatedProjectId: varchar("related_project_id"),
  
  // 元数据
  totalPages: integer("total_pages").default(0),
  contractType: text("contract_type"), // SERVICE, NDA, EMPLOYMENT, PURCHASE, OTHER
  
  // 专家审核
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
  
  // 文件信息
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"), // image/jpeg, image/png, application/pdf
  fileSize: integer("file_size"), // bytes
  
  // 来源
  captureMethod: text("capture_method"), // UPLOAD, CAMERA, SCAN
  
  // OCR 结果
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
