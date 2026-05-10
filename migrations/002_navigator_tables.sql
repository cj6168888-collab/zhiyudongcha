-- =====================================================
-- Navigator-X Database Migration Script
-- Version: 1.0.0
-- =====================================================

-- Note: This is a forward-only migration script
-- Existing data will be preserved

-- 1. Add new columns to swarmEntities (if not exists)
ALTER TABLE swarmEntities
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS leader_preferences JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS morale_curve JSONB DEFAULT '[]';

-- 2. Add new columns to swarmTeams (if not exists)
ALTER TABLE swarmTeams
ADD COLUMN IF NOT EXISTS compute_quota JSONB DEFAULT '{"sovereignPriority":80,"nodePriority":60,"maxConcurrentOps":100}',
ADD COLUMN IF NOT EXISTS avg_morale_score DECIMAL(5,2) DEFAULT 75.00,
ADD COLUMN IF NOT EXISTS anomaly_count INTEGER DEFAULT 0;

-- 3. Create navigatorReports table (new)
CREATE TABLE IF NOT EXISTS navigatorReports (
    id VARCHAR(255) PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    raw_content TEXT,
    attachments JSONB DEFAULT '[]',
    authenticity_score DECIMAL(5,2) DEFAULT 70.00,
    status VARCHAR(20) DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create navigatorTasks table (new)
CREATE TABLE IF NOT EXISTS navigatorTasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_node_id VARCHAR(255) NOT NULL,
    assignee_node_name VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'NORMAL',
    deadline TIMESTAMP,
    checkpoints JSONB DEFAULT '[]',
    parent_report_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create navigatorRedAlerts table (new)
CREATE TABLE IF NOT EXISTS navigatorRedAlerts (
    id VARCHAR(255) PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    evidence JSONB DEFAULT '[]',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create navigatorInspirationBroadcast table (new)
CREATE TABLE IF NOT EXISTS navigatorInspirationBroadcast (
    id VARCHAR(255) PRIMARY KEY,
    raw_text TEXT NOT NULL,
    enriched_text TEXT,
    source VARCHAR(20) DEFAULT 'TEXT',
    total_nodes INTEGER DEFAULT 0,
    delivered_nodes INTEGER DEFAULT 0,
    failed_nodes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    broadcasted_at TIMESTAMP
);

-- 7. Create navigatorSelfHealing table (new)
CREATE TABLE IF NOT EXISTS navigatorSelfHealing (
    id VARCHAR(255) PRIMARY KEY,
    anomaly_id VARCHAR(255) NOT NULL,
    plan_id VARCHAR(255) NOT NULL,
    plan_name VARCHAR(255),
    executed_actions JSONB DEFAULT '[]',
    self_healing_score DECIMAL(5,2),
    success BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create index for performance
CREATE INDEX IF NOT EXISTS idx_navigatorReports_status ON navigatorReports(status);
CREATE INDEX IF NOT EXISTS idx_navigatorReports_submitted_at ON navigatorReports(submitted_at);
CREATE INDEX IF NOT EXISTS idx_navigatorTasks_status ON navigatorTasks(status);
CREATE INDEX IF NOT EXISTS idx_navigatorTasks_assignee ON navigatorTasks(assignee_node_id);
CREATE INDEX IF NOT EXISTS idx_navigatorRedAlerts_severity ON navigatorRedAlerts(severity);
CREATE INDEX IF NOT EXISTS idx_navigatorRedAlerts_acknowledged ON navigatorRedAlerts(acknowledged);
