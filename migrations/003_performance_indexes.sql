-- ============================================================
-- 数据库性能索引 - 提升查询性能
-- 创建时间: 2026-03-09
-- 描述: 为常用查询字段添加索引，优化性能
-- ============================================================

-- -----------------------------------------------------
-- 用户表索引
-- -----------------------------------------------------
-- 用户邮箱唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 用户名唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 用户创建时间索引 (用于排序和范围查询)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- -----------------------------------------------------
-- 人际关系表索引
-- -----------------------------------------------------
-- 姓名搜索索引
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);

-- 访问级别索引 (权限筛选)
CREATE INDEX IF NOT EXISTS idx_persons_access_level ON persons(access_level);

-- 用户ID索引 (个人人脉查询)
CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id);

-- 角色索引
CREATE INDEX IF NOT EXISTS idx_persons_role ON persons(role);

-- 组织索引
CREATE INDEX IF NOT EXISTS idx_persons_organization ON persons(organization);

-- -----------------------------------------------------
-- 项目表索引
-- -----------------------------------------------------
-- 用户项目列表索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- 项目状态索引 (筛选进行中/已完成项目)
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 项目创建时间索引 (排序)
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- 项目负责人索引
CREATE INDEX IF NOT EXISTS idx_projects_leader_id ON projects(leader_id);

-- -----------------------------------------------------
-- 邮件表索引
-- -----------------------------------------------------
-- 邮件账户索引
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);

-- 邮件已读状态索引
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);

-- 邮件分类索引
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);

-- 邮件接收时间索引 (排序)
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);

-- -----------------------------------------------------
-- 会话表索引
-- -----------------------------------------------------
-- 用户会话列表索引
CREATE INDEX IF NOT EXISTS idx_talk_sessions_user_id ON talk_sessions(user_id);

-- 会话时间索引 (获取最近会话)
CREATE INDEX IF NOT EXISTS idx_talk_sessions_started_at ON talk_sessions(started_at DESC);

-- 会话类型索引
CREATE INDEX IF NOT EXISTS idx_talk_sessions_type ON talk_sessions(type);

-- -----------------------------------------------------
-- 设备表索引
-- -----------------------------------------------------
-- 用户设备列表索引
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- 设备类型索引
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);

-- 设备最后活跃时间索引
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active_at DESC);

-- -----------------------------------------------------
-- 声纹表索引
-- -----------------------------------------------------
-- 用户声纹索引
CREATE INDEX IF NOT EXISTS idx_voiceprints_user_id ON voiceprints(user_id);

-- 声纹创建时间索引
CREATE INDEX IF NOT EXISTS idx_voiceprints_created_at ON voiceprints(created_at DESC);

-- -----------------------------------------------------
-- 审计日志表索引
-- -----------------------------------------------------
-- 审计日志用户索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- 审计日志时间索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 审计日志操作类型索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- -----------------------------------------------------
-- 灵感/任务表索引
-- -----------------------------------------------------
-- 灵感用户索引
CREATE INDEX IF NOT EXISTS idx_inspirations_user_id ON inspirations(user_id);

-- 灵感状态索引
CREATE INDEX IF NOT EXISTS idx_inspirations_status ON inspirations(status);

-- 灵感创建时间索引
CREATE INDEX IF NOT EXISTS idx_inspirations_created_at ON inspirations(created_at DESC);

-- -----------------------------------------------------
-- 知识库表索引
-- -----------------------------------------------------
-- 知识库用户索引
CREATE INDEX IF NOT EXISTS idx_knowledge_base_user_id ON knowledge_base(user_id);

-- 知识库标签索引
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);

-- -----------------------------------------------------
-- 团建蜂群表索引
-- -----------------------------------------------------
-- 蜂群用户索引
CREATE INDEX IF NOT EXISTS idx_swarm_entities_user_id ON swarm_entities(user_id);

-- 蜂群类型索引
CREATE INDEX IF NOT EXISTS idx_swarm_entities_type ON swarm_entities(type);

-- -----------------------------------------------------
-- 缓存表索引 (如果使用Redis或内存缓存)
-- -----------------------------------------------------
-- 缓存键索引
CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key) WHERE cache_key IS NOT NULL;

-- 缓存过期时间索引
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- 说明:
-- 1. 使用 IF NOT EXISTS 避免重复创建索引错误
-- 2. DESC 索引适用于排序查询
-- 3. GIN 索引适用于数组/JSONB 字段
-- 4. 部分索引使用 WHERE 子句创建条件索引，减少索引大小
-- ============================================================
