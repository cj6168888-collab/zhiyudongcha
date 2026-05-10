-- 数据库约束和索引优化迁移
-- 修复数据完整性问题，添加必要的索引和约束

-- 1. 添加外键约束确保数据完整性
ALTER TABLE user_settings 
ADD CONSTRAINT IF NOT EXISTS fk_user_settings_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE voice_prints 
ADD CONSTRAINT IF NOT EXISTS fk_voice_prints_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE devices 
ADD CONSTRAINT IF NOT EXISTS fk_devices_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE remote_commands 
ADD CONSTRAINT IF NOT EXISTS fk_remote_commands_device_id 
FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE talk_sessions 
ADD CONSTRAINT IF NOT EXISTS fk_talk_sessions_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE conversation_segments 
ADD CONSTRAINT IF NOT EXISTS fk_conversation_segments_session_id 
FOREIGN KEY (session_id) REFERENCES talk_sessions(id) ON DELETE CASCADE;

ALTER TABLE generated_files 
ADD CONSTRAINT IF NOT EXISTS fk_generated_files_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE daily_reports 
ADD CONSTRAINT IF NOT EXISTS fk_daily_reports_person_id 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- 2. 添加复合索引优化查询性能
-- 对话段索引
CREATE INDEX IF NOT EXISTS idx_conversation_segments_session_timestamp 
ON conversation_segments(session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_segments_session_role 
ON conversation_segments(session_id, role);

-- 设备索引
CREATE INDEX IF NOT EXISTS idx_devices_person_active 
ON devices(person_id, is_active);

CREATE INDEX IF NOT EXISTS idx_devices_type_created 
ON devices(device_type, created_at DESC);

-- 远程命令索引
CREATE INDEX IF NOT EXISTS idx_remote_commands_device_status 
ON remote_commands(device_id, command_status);

CREATE INDEX IF NOT EXISTS idx_remote_commands_created_at 
ON remote_commands(created_at DESC);

-- 生成文件索引
CREATE INDEX IF NOT EXISTS idx_generated_files_person_type 
ON generated_files(person_id, file_type);

CREATE INDEX IF NOT EXISTS idx_generated_files_created_at 
ON generated_files(created_at DESC);

-- 语音打印索引
CREATE INDEX IF NOT EXISTS idx_voice_prints_person_created 
ON voice_prints(person_id, created_at DESC);

-- 日报告索引
CREATE INDEX IF NOT EXISTS idx_daily_reports_person_date 
ON daily_reports(person_id, report_date DESC);

-- 3. 优化persons表索引
CREATE INDEX IF NOT EXISTS idx_persons_hp_balance 
ON persons(hp_balance);

CREATE INDEX IF NOT EXISTS idx_persons_created_at 
ON persons(created_at DESC);

-- 4. 添加数据完整性约束
ALTER TABLE persons 
ADD CONSTRAINT IF NOT EXISTS chk_persons_hp_balance_non_negative 
CHECK (hp_balance >= 0);

ALTER TABLE persons 
ADD CONSTRAINT IF NOT EXISTS chk_persons_hp_max_balance_positive 
CHECK (hp_max_balance > 0);

ALTER TABLE user_settings 
ADD CONSTRAINT IF NOT EXISTS chk_user_settings_hp_max_balance_positive 
CHECK (hp_max_balance > 0);

ALTER TABLE devices 
ADD CONSTRAINT IF NOT EXISTS chk_devices_device_type_valid 
CHECK (device_type IN ('PHONE', 'TABLET', 'COMPUTER', 'WEARABLE', 'OTHER'));

ALTER TABLE talk_sessions 
ADD CONSTRAINT IF NOT EXISTS chk_talk_sessions_duration_non_negative 
CHECK (duration >= 0);

ALTER TABLE conversation_segments 
ADD CONSTRAINT IF NOT EXISTS chk_conversation_segments_role_valid 
CHECK (role IN ('user', 'assistant', 'system'));

ALTER TABLE generated_files 
ADD CONSTRAINT IF NOT EXISTS chk_generated_files_size_non_negative 
CHECK (file_size >= 0);

-- 5. 添加更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为相关表添加更新时间戳触发器
CREATE TRIGGER update_persons_updated_at 
    BEFORE UPDATE ON persons 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remote_commands_updated_at 
    BEFORE UPDATE ON remote_commands 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_talk_sessions_updated_at 
    BEFORE UPDATE ON talk_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_segments_updated_at 
    BEFORE UPDATE ON conversation_segments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_files_updated_at 
    BEFORE UPDATE ON generated_files 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_prints_updated_at 
    BEFORE UPDATE ON voice_prints 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_reports_updated_at 
    BEFORE UPDATE ON daily_reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建优化视图简化复杂查询
CREATE OR REPLACE VIEW user_summary AS
SELECT 
    p.id,
    p.name,
    p.email,
    p.hp_balance,
    p.hp_max_balance,
    p.created_at as user_created_at,
    us.settings,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT ts.id) as session_count,
    COUNT(DISTINCT gf.id) as file_count,
    MAX(ts.created_at) as last_session_at,
    MAX(gf.created_at) as last_file_created_at
FROM persons p
LEFT JOIN user_settings us ON p.id = us.person_id
LEFT JOIN devices d ON p.id = d.person_id AND d.is_active = true
LEFT JOIN talk_sessions ts ON p.id = ts.person_id
LEFT JOIN generated_files gf ON p.id = gf.person_id
GROUP BY p.id, us.settings;

CREATE OR REPLACE VIEW device_summary AS
SELECT 
    d.id,
    d.person_id,
    d.device_name,
    d.device_type,
    d.is_active,
    d.created_at,
    p.name as person_name,
    COUNT(DISTINCT rc.id) as command_count,
    MAX(rc.created_at) as last_command_at
FROM devices d
LEFT JOIN persons p ON d.person_id = p.id
LEFT JOIN remote_commands rc ON d.id = rc.device_id
GROUP BY d.id, p.name;

CREATE OR REPLACE VIEW session_summary AS
SELECT 
    ts.id,
    ts.person_id,
    ts.title,
    ts.duration,
    ts.created_at,
    p.name as person_name,
    COUNT(DISTINCT cs.id) as segment_count,
    COUNT(DISTINCT CASE WHEN cs.role = 'user' THEN cs.id END) as user_messages,
    COUNT(DISTINCT CASE WHEN cs.role = 'assistant' THEN cs.id END) as assistant_messages,
    MIN(cs.timestamp) as first_message_at,
    MAX(cs.timestamp) as last_message_at
FROM talk_sessions ts
LEFT JOIN persons p ON ts.person_id = p.id
LEFT JOIN conversation_segments cs ON ts.id = cs.session_id
GROUP BY ts.id, p.name;

-- 7. 添加分区表支持（针对大数据量场景）
-- 如果是PostgreSQL 10+，可以考虑对talk_sessions表进行分区
-- 以下为示例（需要根据实际情况调整）

-- 创建分区函数（按月分区）
-- CREATE OR REPLACE FUNCTION talk_sessions_partition_function()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     EXECUTE format('INSERT INTO talk_sessions_%s VALUES ($1.*)', 
--                    to_char(NEW.created_at, 'YYYY_MM'));
--     RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;

-- 创建分区表（示例）
-- CREATE TABLE talk_sessions_2024_01 PARTITION OF talk_sessions
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 8. 添加统计信息收集
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- 更新表统计信息以优化查询计划
    ANALYZE persons;
    ANALYZE user_settings;
    ANALYZE devices;
    ANALYZE remote_commands;
    ANALYZE talk_sessions;
    ANALYZE conversation_segments;
    ANALYZE generated_files;
    ANALYZE voice_prints;
    ANALYZE daily_reports;
    
    RAISE NOTICE '表统计信息已更新';
END;
$$ LANGUAGE plpgsql;

-- 9. 创建性能监控视图
CREATE OR REPLACE VIEW performance_metrics AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN (
    'persons', 'user_settings', 'devices', 'remote_commands', 
    'talk_sessions', 'conversation_segments', 'generated_files',
    'voice_prints', 'daily_reports'
  )
ORDER BY tablename, attname;

-- 10. 添加数据完整性检查函数
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE(
    table_name text,
    issue_type text,
    issue_count bigint,
    description text
) AS $$
BEGIN
    -- 检查persons表中的HP余额异常
    RETURN QUERY
    SELECT 
        'persons'::text,
        'negative_hp_balance'::text,
        COUNT(*)::bigint,
        'Users with negative HP balance'::text
    FROM persons 
    WHERE hp_balance < 0;
    
    -- 检查user_settings表中的孤立记录
    RETURN QUERY
    SELECT 
        'user_settings'::text,
        'orphaned_records'::text,
        COUNT(*)::bigint,
        'User settings without corresponding person'::text
    FROM user_settings us
    LEFT JOIN persons p ON us.person_id = p.id
    WHERE p.id IS NULL;
    
    -- 检查devices表中的孤立记录
    RETURN QUERY
    SELECT 
        'devices'::text,
        'orphaned_records'::text,
        COUNT(*)::bigint,
        'Devices without corresponding person'::text
    FROM devices d
    LEFT JOIN persons p ON d.person_id = p.id
    WHERE p.id IS NULL;
    
    -- 检查conversation_segments表中的孤立记录
    RETURN QUERY
    SELECT 
        'conversation_segments'::text,
        'orphaned_records'::text,
        COUNT(*)::bigint,
        'Conversation segments without corresponding session'::text
    FROM conversation_segments cs
    LEFT JOIN talk_sessions ts ON cs.session_id = ts.id
    WHERE ts.id IS NULL;
    
END;
$$ LANGUAGE plpgsql;

-- 11. 创建定期维护任务（需要pg_cron扩展）
-- 如果有pg_cron扩展，可以启用以下定时任务：
-- SELECT cron.schedule('update-statistics', '0 2 * * *', 'SELECT update_table_statistics();');
-- SELECT cron.schedule('check-integrity', '0 3 * * 0', 'SELECT check_data_integrity();');

-- 12. 添加查询优化建议函数
CREATE OR REPLACE FUNCTION get_query_optimization_suggestions()
RETURNS TABLE(
    suggestion text,
    priority text,
    sql_query text
) AS $$
BEGIN
    -- 检查缺失的索引
    RETURN QUERY
    SELECT 
        'Consider adding index on frequently queried columns'::text,
        'HIGH'::text,
        'CREATE INDEX CONCURRENTLY idx_table_column ON table(column);'::text
    WHERE EXISTS (
        SELECT 1 FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 AND idx_tup_read = 0
    );
    
    -- 检查未使用的表
    RETURN QUERY
    SELECT 
        format('Table %s appears to be unused', schemaname||'.'||tablename)::text,
        'MEDIUM'::text,
        'Consider archiving or removing unused tables'::text
    FROM pg_stat_user_tables 
    WHERE seq_scan = 0 AND idx_scan = 0;
END;
$$ LANGUAGE plpgsql;

-- 13. 创建数据备份建议
CREATE OR REPLACE FUNCTION get_backup_recommendations()
RETURNS TABLE(
    table_name text,
    backup_priority text,
    estimated_size_gb numeric,
    recommendation text
) AS $$
BEGIN
    -- 识别重要表
    RETURN QUERY
    SELECT 
        'persons'::text,
        'CRITICAL'::text,
        ROUND(pg_total_relation_size('persons')::numeric / 1024 / 1024 / 1024, 2),
        'Daily backup with point-in-time recovery'::text
    UNION ALL
    SELECT 
        'talk_sessions'::text,
        'HIGH'::text,
        ROUND(pg_total_relation_size('talk_sessions')::numeric / 1024 / 1024 / 1024, 2),
        'Daily backup with weekly full backup'::text
    UNION ALL
    SELECT 
        'conversation_segments'::text,
        'HIGH'::text,
        ROUND(pg_total_relation_size('conversation_segments')::numeric / 1024 / 1024 / 1024, 2),
        'Daily backup with compression'::text;
END;
$$ LANGUAGE plpgsql;

-- 创建索引使用统计视图
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'RARELY_USED'
        WHEN idx_scan < 100 THEN 'MODERATELY_USED'
        ELSE 'FREQUENTLY_USED'
    END as usage_frequency,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 为大型表创建部分索引（示例）
CREATE INDEX IF NOT EXISTS idx_conversation_segments_user_recent 
ON conversation_segments(session_id, timestamp DESC) 
WHERE role = 'user' AND timestamp > NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_remote_commands_pending 
ON remote_commands(device_id, created_at) 
WHERE command_status = 'PENDING';

-- 完成迁移
DO $$
BEGIN
    RAISE NOTICE '数据库约束和索引优化迁移完成';
    RAISE NOTICE '已添加 % 个外键约束', (
        SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
    );
    RAISE NOTICE '已添加 % 个索引', (
        SELECT COUNT(*) FROM pg_indexes 
        WHERE schemaname = 'public'
    );
    RAISE NOTICE '建议运行 ANALYZE 更新统计信息';
END $$;