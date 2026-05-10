-- 数据库迁移脚本: 添加任务编排系统表
-- 执行时间: 2026-03-18
-- 版本: 1.0.0

-- ============================================
-- 1. 任务定义表 (tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 任务基本信息
  name TEXT NOT NULL,
  description TEXT,

  -- 触发器配置
  trigger_type TEXT NOT NULL DEFAULT 'MANUAL',
  trigger_config JSONB,

  -- 任务动作列表 (JSON数组)
  actions JSONB NOT NULL,

  -- 执行选项
  options JSONB,

  -- 状态
  status TEXT NOT NULL DEFAULT 'PENDING',
  enabled BOOLEAN DEFAULT true,

  -- 时间戳
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,

  created_by VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- ============================================
-- 2. 任务执行历史表 (task_executions)
-- ============================================
CREATE TABLE IF NOT EXISTS task_executions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联任务
  task_id VARCHAR(255) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_name TEXT,

  -- 执行状态
  status TEXT NOT NULL DEFAULT 'RUNNING',
  triggered_by TEXT,

  -- 时间
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- 执行结果
  result JSONB,

  -- 动作执行详情 (JSON数组)
  action_results JSONB,

  -- 元数据
  execution_source TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
CREATE INDEX IF NOT EXISTS idx_task_executions_started_at ON task_executions(started_at DESC);

-- ============================================
-- 3. PC设备远程控制表 (pc_devices)
-- ============================================
CREATE TABLE IF NOT EXISTS pc_devices (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 设备信息
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT,

  -- 能力
  capabilities JSONB,

  -- 状态
  status TEXT NOT NULL DEFAULT 'OFFLINE',

  -- 网络
  ip_address VARCHAR(255),

  -- 时间戳
  last_seen TIMESTAMP,
  registered_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pc_devices_status ON pc_devices(status);
CREATE INDEX IF NOT EXISTS idx_pc_devices_platform ON pc_devices(platform);

-- ============================================
-- 4. PC远程控制会话表 (pc_sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS pc_sessions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联设备
  device_id VARCHAR(255) NOT NULL REFERENCES pc_devices(id) ON DELETE CASCADE,

  -- 会话信息
  user_id VARCHAR(255),
  status TEXT NOT NULL DEFAULT 'CONNECTING',

  -- 活动信息
  last_activity TIMESTAMP,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pc_sessions_device_id ON pc_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_pc_sessions_status ON pc_sessions(status);

-- ============================================
-- 5. 告警通知表 (task_alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS task_alerts (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id VARCHAR(255) REFERENCES task_executions(id) ON DELETE CASCADE,

  -- 告警信息
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- 状态
  status TEXT NOT NULL DEFAULT 'PENDING',

  -- 通知渠道
  channels JSONB,

  -- 时间
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,

  -- 元数据
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_alerts_task_id ON task_alerts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_alerts_status ON task_alerts(status);
CREATE INDEX IF NOT EXISTS idx_task_alerts_severity ON task_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_task_alerts_created_at ON task_alerts(created_at DESC);

-- ============================================
-- 6. 添加 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 tasks 表添加触发器
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 pc_devices 表添加触发器
DROP TRIGGER IF EXISTS update_pc_devices_updated_at ON pc_devices;
CREATE TRIGGER update_pc_devices_updated_at
  BEFORE UPDATE ON pc_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 迁移完成
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully: Task Orchestration System tables created';
END $$;
