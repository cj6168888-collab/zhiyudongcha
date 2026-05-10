# PostgreSQL 数据库种子数据

# 注意：这些是初始化数据，仅用于首次部署或数据库重置
# 在生产环境中，这些数据应该通过迁移脚本插入

INSERT INTO users (id, username, email, password_hash, full_name, phone, role, is_active, created_at, updated_at) VALUES
  ('00000001-0000-0000-0000-0001', 'admin', 'admin@example.com', '$2a$12$s$j84ZyIx567V$CzYJ89aQH...', '系统管理员', '+86-138-8888-8888', null, true, NOW(), NOW()),
  ('00000002-0000-0000-0002', 'user', 'user@example.com', '$2b$12$s$XyIx567V$CzYJ89aQH...', '普通用户', '+86-139-9999-9999', null, true, NOW(), NOW()),
  ('00000003-0000-0000-0003', 'guest', 'guest@example.com', '$2c$12$s$ASo3fYIx567V$CzYJ89aQH...', '访客用户', '+86-138-0000-0000-0000', null, false, NOW(), NOW());

INSERT INTO projects (id, name, description, status, owner_id, created_at, updated_at, priority) VALUES
  ('00000001-0000-0000-0004', 'AI助手平台', '企业级AI助手系统平台', 'active', 'admin', NOW(), NOW()),
  ('00000002-0000-0000-0005', '智能客服系统', '提升客户服务质量', 'admin', NOW(), NOW()),
  ('00000003-0000-0000-0006', '数据分析系统', '业务数据分析', 'active', 'admin', NOW(), NOW());

INSERT INTO vault_items (id, user_id, title, content, category, access_level, tags, created_at, updated_at) VALUES
  ('00000001-0000-0000-0007', '00000001', 'secret_config', '数据库连接配置信息', 'admin', NOW(), NOW()),
  ('00000002-0000-0000-0008', 'encryption_keys', 'API加密密钥存储', 'admin', NOW(), NOW()),
  ('00000003-0000-0000-0009', 'user_manual', '用户手册', 'low', 'admin', NOW(), NOW());

INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, result, ip_address, user_agent, created_at) VALUES
  ('00000001-0000-0000-0010', 'admin', 'system', 'system', '00000001', '系统启动', 'success', 'admin', NOW(), NOW(), NOW());

INSERT INTO health_checks (id, component, status, last_check, message, metadata, created_at, updated_at) VALUES
  ('00000001-0000-0000-0011', 'database', 'healthy', NOW(), 'Database connected successfully', null, NOW(), NOW()),
  ('00000002-0000-0000-0012', 'redis', 'healthy', NOW(), 'Redis connected successfully', null, NOW()),
  ('00000003-0000-0000-0013', 'api', 'healthy', NOW(), 'API server is running', null, NOW());

INSERT INTO evolution_state (id, hp_balance, hp_max_balance, hp_total_consumed, hp_total_recharged, last_hp_recharge, created_at, updated_at) VALUES
  ('00000001-0000-0000-0020', '1000', 1000, 0, 0, 0, NOW(), NOW());

-- 示例配置数据
INSERT INTO user_settings (user_id, theme, language, timezone, notification_preferences, auto_save, created_at, updated_at) VALUES
  ('00000001', 'admin', 'dark', 'zh-CN', 'Asia/Shanghai', '{"browser_enabled": true, "mobile_menu": false, "desktop_notifications": true, "api_notifications": true}', NOW(), NOW()),
  ('00000002', 'user', 'light', 'zh-CN', 'UTC', '{"browser_enabled": false, "mobile_menu": true, "desktop_notifications": true, "api_notifications": true}', NOW(), NOW());

INSERT INTO person (id, user_id, name, email, phone, role, access_level, company, position, department, skills, created_at, updated_at) VALUES
  ('00000001-0000-0000-0003', 'admin', 'admin@example.com', '+86-138-8888-8888', null, 'system', '系统开发团队', '后端开发', '技术负责人', NOW(), NOW()),
  ('00000002-0000-0000-0004', 'user', 'user@example.com', '+86-139-9999-9999', null, 'user', '产品经理', '前端开发', 'React/Vue/React', NOW(), NOW()),
  ('00000003-0000-0000-0005', 'guest', 'guest@example.com', '+86-138-0000-0000', null, 'guest', '访客', '系统访问', NOW(), NOW());

-- 性能基准数据
INSERT INTO performance_benchmarks (id, test_name, metric_type, baseline_value, current_value, improvement_percentage, test_date, environment) VALUES
  ('00000001-0000-0000-0050', 'database_query_performance', 'response_time', 500, 450, -10, 'development', NOW()),
  ('00000002-0000-0000-0051', 'api_endpoint_response', 'response_time', 200, 150, -25, 'development', NOW()),
  ('00000003-0000-0000-0052', 'cache_performance', 'hit_rate', 75, 85, +13.3, 'development', NOW());

-- 其他示例数据可以按需添加