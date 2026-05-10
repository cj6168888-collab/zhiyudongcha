-- 蜂群任务记录表（restart-safe，服务重启后可恢复内存状态）
CREATE TABLE IF NOT EXISTS swarm_tasks (
  id            TEXT PRIMARY KEY,
  task_name     TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  target_nodes  TEXT        NOT NULL DEFAULT 'ALL',
  delivered_count INTEGER   NOT NULL DEFAULT 0,
  broadcasted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reports       JSONB       NOT NULL DEFAULT '[]'
);

-- 暂存待确认动作表（pending/draft，10分钟TTL，restart-safe）
CREATE TABLE IF NOT EXISTS pending_actions (
  id            TEXT        PRIMARY KEY,
  entry_type    TEXT        NOT NULL,  -- 'pending' | 'draft'
  action        TEXT,                  -- pending 类型：动作名称
  action_params JSONB,                 -- pending 类型：动作参数
  items         JSONB,                 -- draft 类型：条目列表
  user_id       TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_expires_at ON pending_actions (expires_at);
