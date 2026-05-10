-- Knowledge Base Enhancement Migration
-- Phase 12 - 知识库自动同步增强
-- Created: 2026-02-15

-- =====================================================
-- 1. 扩展知识库同步日志表
-- =====================================================

ALTER TABLE knowledge_sync_logs ADD COLUMN IF NOT EXISTS sync_type VARCHAR(50);
ALTER TABLE knowledge_sync_logs ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMP;
ALTER TABLE knowledge_sync_logs ADD COLUMN IF NOT EXISTS sync_completed_at TIMESTAMP;
ALTER TABLE knowledge_sync_logs ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0;
ALTER TABLE knowledge_sync_logs ADD COLUMN IF NOT EXISTS items_failed INTEGER DEFAULT 0;

-- =====================================================
-- 2. 创建政策源配置表
-- =====================================================

CREATE TABLE IF NOT EXISTS policy_sources (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- LEGAL, FINANCE, LABOR, TAX
    category VARCHAR(100),
    description TEXT,
    last_fetched_at TIMESTAMP,
    fetch_interval_ms BIGINT DEFAULT 86400000, -- 默认24小时
    enabled BOOLEAN DEFAULT TRUE,
    priority VARCHAR(20) DEFAULT 'NORMAL', -- HIGH, NORMAL, LOW
    fetch_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 初始化默认政策源
INSERT INTO policy_sources (id, name, url, type, category, priority) VALUES
    ('tax_policy_001', '国家税务总局', 'http://www.chinatax.gov.cn', 'TAX', '税务政策', 'HIGH'),
    ('labor_law_001', '人力资源和社会保障部', 'http://www.mohrss.gov.cn', 'LABOR', '劳动法', 'HIGH'),
    ('legal_search_001', '中国法律法规数据库', 'https://flk.npc.gov.cn', 'LEGAL', '法律法规', 'NORMAL')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. 创建知识库优化记录表
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_optimization_logs (
    id VARCHAR(255) PRIMARY KEY,
    optimization_type VARCHAR(50) NOT NULL, -- INDEX_REBUILD, CACHE_CLEAR, DEDUP, BACKUP
    status VARCHAR(20) NOT NULL, -- STARTED, COMPLETED, FAILED
    items_affected INTEGER DEFAULT 0,
    duration_ms BIGINT,
    details JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- =====================================================
-- 4. 创建专家反馈表
-- =====================================================

CREATE TABLE IF NOT EXISTS expert_feedback (
    id VARCHAR(255) PRIMARY KEY,
    decision_id VARCHAR(255) NOT NULL,
    expert_type VARCHAR(50) NOT NULL, -- LEGAL, FINANCE, STRATEGY, PSYCHOLOGY, PLANNING, SECRETARY
    user_accepted BOOLEAN,
    actual_outcome TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    improvement_note TEXT,
    feedback_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_expert_feedback_decision ON expert_feedback(decision_id);
CREATE INDEX IF NOT EXISTS idx_expert_feedback_type ON expert_feedback(expert_type);
CREATE INDEX IF NOT EXISTS idx_expert_feedback_rating ON expert_feedback(rating);

-- =====================================================
-- 5. 创建搜索缓存表
-- =====================================================

CREATE TABLE IF NOT EXISTS search_cache (
    cache_key VARCHAR(500) PRIMARY KEY,
    query_type VARCHAR(20) NOT NULL, -- LEGAL, FINANCE
    query_text TEXT NOT NULL,
    results JSONB NOT NULL,
    result_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- =====================================================
-- 6. 创建知识库统计表
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_stats (
    id VARCHAR(255) PRIMARY KEY,
    stat_date DATE NOT NULL,
    knowledge_type VARCHAR(20) NOT NULL, -- LEGAL, FINANCE
    total_count INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    hit_count INTEGER DEFAULT 0,
    avg_search_time_ms REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_stats_date ON knowledge_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_stats_type ON knowledge_stats(knowledge_type);

-- =====================================================
-- 7. 添加法律知识版本控制字段
-- =====================================================

ALTER TABLE legal_knowledge ADD COLUMN IF NOT EXISTS version VARCHAR(20);
ALTER TABLE legal_knowledge ADD COLUMN IF NOT EXISTS change_log TEXT;
ALTER TABLE legal_knowledge ADD COLUMN IF NOT EXISTS superseded_by VARCHAR(255);

-- =====================================================
-- 8. 添加财税知识来源URL
-- =====================================================

ALTER TABLE finance_knowledge ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE finance_knowledge ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100); -- 全国/地方

-- =====================================================
-- 9. 创建定时任务表
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id VARCHAR(255) PRIMARY KEY,
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- POLICY_SYNC, OPTIMIZE, BACKUP, NOTIFICATION
    enabled BOOLEAN DEFAULT TRUE,
    interval_ms BIGINT NOT NULL,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 初始化默认任务
INSERT INTO scheduled_tasks (id, task_name, task_type, interval_ms, priority, next_run_at) VALUES
    ('task_tax_sync', '税务政策同步', 'POLICY_SYNC', 21600000, 'HIGH', NOW()),
    ('task_labor_sync', '劳动法规同步', 'POLICY_SYNC', 43200000, 'HIGH', NOW() + INTERVAL '6 hours'),
    ('task_legal_sync', '法律法规同步', 'POLICY_SYNC', 86400000, 'NORMAL', NOW() + INTERVAL '12 hours'),
    ('task_optimize', '知识库优化', 'OPTIMIZE', 86400000, 'LOW', NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. 创建知识库健康检查表
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_health_checks (
    id VARCHAR(255) PRIMARY KEY,
    check_type VARCHAR(50) NOT NULL, -- CONNECTIVITY, FRESHNESS, COMPLETENESS, PERFORMANCE
    status VARCHAR(20) NOT NULL, -- PASS, WARN, FAIL
    score INTEGER DEFAULT 0, -- 0-100
    details JSONB,
    checked_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE policy_sources IS '政策数据源配置表';
COMMENT ON TABLE knowledge_optimization_logs IS '知识库优化记录表';
COMMENT ON TABLE expert_feedback IS '专家决策反馈表';
COMMENT ON TABLE search_cache IS '搜索结果缓存表';
COMMENT ON TABLE knowledge_stats IS '知识库使用统计表';
COMMENT ON TABLE scheduled_tasks IS '定时任务配置表';
COMMENT ON TABLE knowledge_health_checks IS '知识库健康检查表';
