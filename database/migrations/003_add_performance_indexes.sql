-- 性能优化索引集合
-- 解决N+1查询问题和提升查询性能

-- 1. evolution_state 表优化
CREATE INDEX IF NOT EXISTS idx_evolution_state_updated_at_desc ON evolution_state(updated_at DESC);

-- 2. persons 表优化（关系查询优化）
CREATE INDEX IF NOT EXISTS idx_persons_organization ON persons(organization);
CREATE INDEX IF NOT EXISTS idx_persons_tags ON persons USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_persons_approval_status ON persons(approval_status);
CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at);
CREATE INDEX IF NOT EXISTS idx_persons_bond_strength ON persons(bond_strength);
CREATE INDEX IF NOT EXISTS idx_persons_connection_nodes ON persons USING GIN(connection_nodes);
CREATE INDEX IF NOT EXISTS idx_persons_capability_indexed_at ON persons(capability_indexed_at);

-- 3. shadow_memories 表优化
CREATE INDEX IF NOT EXISTS idx_shadow_memories_user_id ON shadow_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_shadow_memories_created_at ON shadow_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_memories_confidence ON shadow_memories(confidence DESC);

-- 4. audit_logs 表优化
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON audit_logs(result);

-- 5. remote_commands 表优化
CREATE INDEX IF NOT EXISTS idx_remote_commands_device_id ON remote_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_remote_commands_status ON remote_commands(status);
CREATE INDEX IF NOT EXISTS idx_remote_commands_created_at ON remote_commands(created_at);

-- 6. conversations 表优化（已在前面创建，这里补充）
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated_at ON conversations(user_id, updated_at DESC);

-- 7. daily_reports 表优化
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date DESC);

-- 8. voice_prints 表优化
CREATE INDEX IF NOT EXISTS idx_voice_prints_user_id ON voice_prints(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_prints_is_master ON voice_prints(is_master);
CREATE INDEX IF NOT EXISTS idx_voice_prints_created_at ON voice_prints(created_at DESC);

-- 9. devices 表优化
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS devices_is_active ON devices(is_active);
CREATE INDEX IF NOT EXISTS devices_last_seen ON devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS devices_token_hash ON devices(token_hash);

-- 10. talk_sessions 表优化
CREATE INDEX IF NOT EXISTS idx_talk_sessions_user_id ON talk_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_talk_sessions_status ON talk_sessions(status);
CREATE INDEX IF NOT EXISTS idx_talk_sessions_created_at ON talk_sessions(created_at DESC);

-- 11. function_calling 表优化
CREATE INDEX IF NOT EXISTS idx_function_calling_session_id ON function_calling(session_id);
CREATE INDEX IF NOT EXISTS idx_function_calling_created_at ON function_calling(created_at DESC);

-- 12. generated_files 表优化
CREATE INDEX IF NOT EXISTS idx_generated_files_project_id ON generated_files(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_files_report_id ON generated_files(report_id);
CREATE INDEX IF NOT EXISTS idx_generated_files_created_at ON generated_files(created_at DESC);

-- 13. persons 模糊搜索优化（全文搜索）
-- 如果需要支持中文搜索，可以考虑添加全文索引
-- CREATE INDEX CONCURRENTLY idx_persons_fulltext ON persons USING GIN(to_tsvector('chinese', name || '' || ' ' || COALESCE(tags, array_to_string(tags, ' ')));

-- 14. 复合索引优化（针对特定查询模式）
CREATE INDEX IF NOT EXISTS idx_persons_org_approval ON persons(organization, approval_status);
CREATE INDEX IF NOT EXISTS idx_devices_user_active_seen ON devices(user_id, is_active, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_state_updated ON conversations(user_id, state, updated_at DESC);

-- 性能分析视图（用于监控慢查询）
CREATE OR REPLACE VIEW slow_conversations AS
SELECT 
    c.id,
    c.user_id,
    c.state,
    c.updated_at,
    ARRAY_LENGTH(c.messages) as message_count,
    c.metadata
FROM conversations c
WHERE c.updated_at < NOW() - INTERVAL '7 days'
ORDER BY c.updated_at DESC;

CREATE OR REPLACE VIEW active_devices_by_user AS
SELECT 
    d.user_id,
    COUNT(*) as device_count,
    MAX(d.last_seen) as last_seen,
    STRING_AGG(d.name, ', ') as device_names
FROM devices d
WHERE d.is_active = true
GROUP BY d.user_id
ORDER BY last_seen DESC;