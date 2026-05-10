-- 对话管理表
-- 用于存储用户对话历史和上下文

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    messages JSONB DEFAULT '[]',
    state VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- 添加注释
COMMENT ON TABLE conversations IS '用户对话管理表';
COMMENT ON COLUMN conversations.id IS '对话唯一标识符';
COMMENT ON COLUMN conversations.user_id IS '用户ID';
COMMENT ON COLUMN conversations.messages IS '对话消息历史（JSON格式）';
COMMENT ON COLUMN conversations.state IS '对话状态：active/paused/completed/abandoned';
COMMENT ON COLUMN conversations.metadata IS '对话元数据（JSON格式）';
COMMENT ON COLUMN conversations.created_at IS '创建时间';
COMMENT ON COLUMN conversations.updated_at IS '更新时间';

-- 状态约束
ALTER TABLE conversations ADD CONSTRAINT chk_state CHECK (
    state IN ('active', 'paused', 'completed', 'abandoned')
);

-- 对话状态枚举类型（PostgreSQL 12+）
-- DO $$ BEGIN
-- CREATE TYPE conversation_state AS ENUM ('active', 'paused', 'completed', 'abandoned');
-- ALTER TABLE conversations ALTER COLUMN state TYPE conversation_state;
-- $$;