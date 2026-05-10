-- 分布式锁表
CREATE TABLE IF NOT EXISTS distributed_locks (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    owner VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_distributed_locks_key ON distributed_locks(key);
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON distributed_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_distributed_locks_owner ON distributed_locks(owner);

-- 创建自动清理过期锁的函数
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM distributed_locks WHERE expires_at <= NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- HP交易记录表
CREATE TABLE IF NOT EXISTS hp_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('consume', 'add')),
    amount DECIMAL(10,2) NOT NULL,
    previous_balance DECIMAL(10,2) NOT NULL,
    new_balance DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建HP交易记录的索引
CREATE INDEX IF NOT EXISTS idx_hp_transactions_user_id ON hp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_hp_transactions_operation ON hp_transactions(operation);
CREATE INDEX IF NOT EXISTS idx_hp_transactions_created_at ON hp_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_hp_transactions_user_created ON hp_transactions(user_id, created_at);

-- 创建外键约束（确保用户存在）
ALTER TABLE hp_transactions 
ADD CONSTRAINT IF NOT EXISTS fk_hp_transactions_user_id 
FOREIGN KEY (user_id) REFERENCES persons(id) ON DELETE CASCADE;

-- 添加自动更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为分布式锁表添加更新时间戳触发器
CREATE TRIGGER update_distributed_locks_updated_at 
    BEFORE UPDATE ON distributed_locks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 为HP交易记录表添加更新时间戳触发器
CREATE TRIGGER update_hp_transactions_updated_at 
    BEFORE UPDATE ON hp_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建定时清理任务（需要pg_cron扩展）
-- 如果有pg_cron扩展，可以启用以下定时任务：
-- SELECT cron.schedule('cleanup-expired-locks', '0 */6 * * *', 'SELECT cleanup_expired_locks();');

-- 创建HP余额变更历史视图
CREATE OR REPLACE VIEW hp_balance_history AS
SELECT 
    user_id,
    operation,
    amount,
    previous_balance,
    new_balance,
    description,
    created_at,
    LAG(new_balance) OVER (PARTITION BY user_id ORDER BY created_at) as prev_balance
FROM hp_transactions
ORDER BY user_id, created_at DESC;

-- 创建用户HP统计视图
CREATE OR REPLACE VIEW user_hp_stats AS
SELECT 
    p.id as user_id,
    p.hp_balance as current_balance,
    COALESCE(total_consumed.amount, 0) as total_consumed,
    COALESCE(total_added.amount, 0) as total_added,
    COALESCE(transaction_count.count, 0) as transaction_count,
    last_transaction.last_transaction_at
FROM persons p
LEFT JOIN (
    SELECT user_id, SUM(amount) as amount
    FROM hp_transactions 
    WHERE operation = 'consume'
    GROUP BY user_id
) total_consumed ON p.id = total_consumed.user_id
LEFT JOIN (
    SELECT user_id, SUM(amount) as amount
    FROM hp_transactions 
    WHERE operation = 'add'
    GROUP BY user_id
) total_added ON p.id = total_added.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM hp_transactions
    GROUP BY user_id
) transaction_count ON p.id = transaction_count.user_id
LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, created_at as last_transaction_at
    FROM hp_transactions
    ORDER BY user_id, created_at DESC
) last_transaction ON p.id = last_transaction.user_id;

-- 创建HP余额变更函数
CREATE OR REPLACE FUNCTION update_hp_balance(
    p_user_id VARCHAR(255),
    p_operation VARCHAR(50),
    p_amount DECIMAL(10,2),
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance DECIMAL(10,2),
    error_message TEXT
) AS $$
DECLARE
    current_balance DECIMAL(10,2);
    new_balance DECIMAL(10,2);
BEGIN
    -- 获取当前余额
    SELECT hp_balance INTO current_balance 
    FROM persons 
    WHERE id = p_user_id;
    
    IF current_balance IS NULL THEN
        RETURN QUERY SELECT FALSE::BOOLEAN, NULL::DECIMAL(10,2), 'User not found'::TEXT;
        RETURN;
    END IF;
    
    -- 检查操作类型
    IF p_operation NOT IN ('consume', 'add') THEN
        RETURN QUERY SELECT FALSE::BOOLEAN, NULL::DECIMAL(10,2), 'Invalid operation type'::TEXT;
        RETURN;
    END IF;
    
    -- 计算新余额
    IF p_operation = 'consume' THEN
        IF current_balance < p_amount THEN
            RETURN QUERY SELECT FALSE::BOOLEAN, current_balance, 'Insufficient balance'::TEXT;
            RETURN;
        END IF;
        new_balance := current_balance - p_amount;
    ELSE
        new_balance := current_balance + p_amount;
    END IF;
    
    -- 更新余额
    UPDATE persons 
    SET hp_balance = new_balance 
    WHERE id = p_user_id;
    
    -- 记录交易
    INSERT INTO hp_transactions (
        user_id, operation, amount, previous_balance, new_balance, description, created_at
    ) VALUES (
        p_user_id, p_operation, p_amount, current_balance, new_balance, p_description, NOW()
    );
    
    RETURN QUERY SELECT TRUE::BOOLEAN, new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 创建批量HP余额更新函数
CREATE OR REPLACE FUNCTION batch_update_hp_balance(
    p_updates JSONB
)
RETURNS TABLE(
    user_id VARCHAR(255),
    success BOOLEAN,
    new_balance DECIMAL(10,2),
    error_message TEXT
) AS $$
DECLARE
    update_record JSONB;
    current_balance DECIMAL(10,2);
    new_balance DECIMAL(10,2);
    p_operation VARCHAR(50);
    p_amount DECIMAL(10,2);
    p_description TEXT;
BEGIN
    -- 开始事务
    FOR update_record IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        p_user_id := update_record->>'user_id';
        p_operation := update_record->>'operation';
        p_amount := (update_record->>'amount')::DECIMAL(10,2);
        p_description := update_record->>'description';
        
        -- 获取当前余额
        SELECT hp_balance INTO current_balance 
        FROM persons 
        WHERE id = p_user_id;
        
        IF current_balance IS NULL THEN
            RETURN QUERY NEXT SELECT p_user_id, FALSE::BOOLEAN, NULL::DECIMAL(10,2), 'User not found'::TEXT;
            CONTINUE;
        END IF;
        
        -- 检查操作类型
        IF p_operation NOT IN ('consume', 'add') THEN
            RETURN QUERY NEXT SELECT p_user_id, FALSE::BOOLEAN, current_balance, 'Invalid operation type'::TEXT;
            CONTINUE;
        END IF;
        
        -- 计算新余额
        IF p_operation = 'consume' THEN
            IF current_balance < p_amount THEN
                RETURN QUERY NEXT SELECT p_user_id, FALSE::BOOLEAN, current_balance, 'Insufficient balance'::TEXT;
                CONTINUE;
            END IF;
            new_balance := current_balance - p_amount;
        ELSE
            new_balance := current_balance + p_amount;
        END IF;
        
        -- 更新余额
        UPDATE persons 
        SET hp_balance = new_balance 
        WHERE id = p_user_id;
        
        -- 记录交易
        INSERT INTO hp_transactions (
            user_id, operation, amount, previous_balance, new_balance, description, created_at
        ) VALUES (
            p_user_id, p_operation, p_amount, current_balance, new_balance, p_description, NOW()
        );
        
        RETURN QUERY NEXT SELECT p_user_id, TRUE::BOOLEAN, new_balance, NULL::TEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 创建HP余额检查函数
CREATE OR REPLACE FUNCTION check_hp_balance(
    p_user_id VARCHAR(255),
    p_required_amount DECIMAL(10,2)
)
RETURNS TABLE(
    sufficient BOOLEAN,
    current_balance DECIMAL(10,2),
    required_amount DECIMAL(10,2),
    shortage DECIMAL(10,2)
) AS $$
DECLARE
    current_balance DECIMAL(10,2);
BEGIN
    SELECT hp_balance INTO current_balance 
    FROM persons 
    WHERE id = p_user_id;
    
    IF current_balance IS NULL THEN
        RETURN QUERY SELECT FALSE::BOOLEAN, NULL::DECIMAL(10,2), p_required_amount, NULL::DECIMAL(10,2);
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 
        (current_balance >= p_required_amount)::BOOLEAN as sufficient,
        current_balance,
        p_required_amount,
        CASE 
            WHEN current_balance >= p_required_amount THEN NULL
            ELSE p_required_amount - current_balance
        END as shortage;
END;
$$ LANGUAGE plpgsql;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_hp_transactions_user_operation ON hp_transactions(user_id, operation);
CREATE INDEX IF NOT EXISTS idx_hp_transactions_amount ON hp_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_hp_transactions_balance ON hp_transactions(previous_balance, new_balance);

-- 为persons表的hp_balance字段创建索引（如果还没有）
CREATE INDEX IF NOT EXISTS idx_persons_hp_balance ON persons(hp_balance);

-- 添加约束确保HP余额不为负数
ALTER TABLE persons 
ADD CONSTRAINT IF NOT EXISTS chk_persons_hp_balance_non_negative 
CHECK (hp_balance >= 0);

-- 创建审计日志表（记录HP余额变更的详细信息）
CREATE TABLE IF NOT EXISTS hp_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    transaction_id BIGINT REFERENCES hp_transactions(id),
    operation_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 审计字段
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    approval_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 为审计日志创建索引
CREATE INDEX IF NOT EXISTS idx_hp_audit_user_id ON hp_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_hp_audit_transaction_id ON hp_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_hp_audit_created_at ON hp_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_hp_audit_operation_type ON hp_audit_log(operation_type);

-- 创建触发器自动记录HP变更到审计日志
CREATE OR REPLACE FUNCTION log_hp_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO hp_audit_log (
        user_id, transaction_id, operation_type, amount, 
        balance_before, balance_after, created_at
    ) VALUES (
        NEW.user_id, NEW.id, NEW.operation, NEW.amount,
        NEW.previous_balance, NEW.new_balance, NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为HP交易表创建审计触发器
CREATE TRIGGER trigger_hp_audit_log
    AFTER INSERT ON hp_transactions
    FOR EACH ROW
    EXECUTE FUNCTION log_hp_changes();

-- 创建权限视图（不同角色可以看到不同级别的HP信息）
CREATE OR REPLACE VIEW hp_summary AS
SELECT 
    p.id as user_id,
    p.hp_balance as current_balance,
    COALESCE(stats.total_consumed, 0) as total_consumed,
    COALESCE(stats.total_added, 0) as total_added,
    COALESCE(stats.transaction_count, 0) as total_transactions,
    COALESCE(stats.last_transaction_at, p.created_at) as last_activity,
    CASE 
        WHEN p.hp_balance >= 1000 THEN 'high'
        WHEN p.hp_balance >= 500 THEN 'medium'
        WHEN p.hp_balance >= 100 THEN 'low'
        ELSE 'critical'
    END as balance_level
FROM persons p
LEFT JOIN user_hp_stats stats ON p.id = stats.user_id
WHERE p.hp_balance IS NOT NULL;

-- 为summary视图创建索引
CREATE INDEX IF NOT EXISTS idx_hp_summary_user_id ON hp_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_hp_summary_balance_level ON hp_summary(balance_level);

COMMENT ON TABLE distributed_locks IS '分布式锁表，用于确保并发操作的原子性';
COMMENT ON TABLE hp_transactions IS 'HP交易记录表，记录所有HP余额的变更历史';
COMMENT ON TABLE hp_audit_log IS 'HP审计日志表，记录详细的变更信息和审计字段';
COMMENT ON VIEW hp_balance_history IS 'HP余额变更历史视图';
COMMENT ON VIEW user_hp_stats IS '用户HP统计视图，包含汇总信息';
COMMENT ON VIEW hp_summary IS 'HP余额摘要视图，用于快速查看用户HP状态';

-- 创建常用的复合查询函数
CREATE OR REPLACE FUNCTION get_user_hp_history(
    p_user_id VARCHAR(255),
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    transaction_id BIGINT,
    operation VARCHAR(50),
    amount DECIMAL(10,2),
    previous_balance DECIMAL(10,2),
    new_balance DECIMAL(10,2),
    balance_change DECIMAL(10,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.operation,
        t.amount,
        t.previous_balance,
        t.new_balance,
        t.new_balance - t.previous_balance as balance_change,
        t.description,
        t.created_at
    FROM hp_transactions t
    WHERE t.user_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;