-- Swarm Management Tables Migration
-- Phase 11.3 - 蜂群管理数据库表
-- Created: 2026-02-15

-- 蜂群实体表 - 存储小智的分身
CREATE TABLE IF NOT EXISTS swarm_entities (
    id VARCHAR(255) PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- MASTER, CLONE, AGENT, OBSERVER
    parent_id VARCHAR(255),
    owner_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, EXPIRED, REVOKED
    
    permissions JSONB, -- 权限配置
    capabilities TEXT[], -- 功能列表
    
    -- 元数据
    metadata JSONB, -- { deviceInfo, ipRestrictions, maxSessions, currentSessions, totalRequests }
    
    expires_at TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 访问令牌表 - 存储分身访问令牌
CREATE TABLE IF NOT EXISTS swarm_tokens (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255) NOT NULL REFERENCES swarm_entities(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- SESSION, API, ONETIME
    
    permissions TEXT[], -- 权限ID列表
    
    issued_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER, -- null 表示无限制
    
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 团队表 - 存储分身团队
CREATE TABLE IF NOT EXISTS swarm_teams (
    id VARCHAR(255) PRIMARY KEY,
    name TEXT NOT NULL,
    leader_entity_id VARCHAR(255) NOT NULL REFERENCES swarm_entities(id),
    
    members JSONB, -- 团队成员列表
    aggregated_stats JSONB, -- 聚合统计
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 团队洞察表 - 存储团队分析结果
CREATE TABLE IF NOT EXISTS swarm_team_insights (
    id VARCHAR(255) PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL REFERENCES swarm_teams(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL, -- USAGE_PATTERN, SECURITY_ALERT, EFFICIENCY, RECOMMENDATION
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL, -- INFO, WARNING, CRITICAL
    
    generated_at TIMESTAMP DEFAULT NOW()
);

-- 审计日志表 - 存储蜂群操作审计
CREATE TABLE IF NOT EXISTS swarm_audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255),
    token_id VARCHAR(255),
    
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    outcome TEXT NOT NULL, -- SUCCESS, DENIED, ERROR
    
    details JSONB, -- 详细信息
    ip_address VARCHAR(255),
    user_agent TEXT,
    
    timestamp TIMESTAMP DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_swarm_entities_owner_id ON swarm_entities(owner_id);
CREATE INDEX IF NOT EXISTS idx_swarm_entities_status ON swarm_entities(status);
CREATE INDEX IF NOT EXISTS idx_swarm_entities_type ON swarm_entities(type);

CREATE INDEX IF NOT EXISTS idx_swarm_tokens_entity_id ON swarm_tokens(entity_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tokens_status ON swarm_tokens(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tokens_expires_at ON swarm_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_swarm_teams_leader_id ON swarm_teams(leader_entity_id);

CREATE INDEX IF NOT EXISTS idx_swarm_audit_logs_entity_id ON swarm_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_swarm_audit_logs_timestamp ON swarm_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_swarm_audit_logs_action ON swarm_audit_logs(action);

COMMENT ON TABLE swarm_entities IS '蜂群实体表 - 存储小智的分身';
COMMENT ON TABLE swarm_tokens IS '访问令牌表 - 存储分身访问令牌';
COMMENT ON TABLE swarm_teams IS '团队表 - 存储分身团队';
COMMENT ON TABLE swarm_team_insights IS '团队洞察表 - 存储团队分析结果';
COMMENT ON TABLE swarm_audit_logs IS '审计日志表 - 存储蜂群操作审计';
