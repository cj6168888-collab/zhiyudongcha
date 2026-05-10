-- 分布式锁表
-- 用于在高并发场景下保护关键操作

CREATE TABLE IF NOT EXISTS distributed_locks (
    id SERIAL PRIMARY KEY,
    lock_key VARCHAR(255) NOT NULL UNIQUE,
    lock_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建过期时间索引，用于自动清理过期锁
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON distributed_locks(expires_at);

-- 创建锁键索引
CREATE INDEX IF NOT EXISTS idx_distributed_locks_key ON distributed_locks(lock_key);

-- 自动清理过期锁的函数
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM distributed_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 创建定时清理任务（如果pg_cron扩展可用）
-- SELECT cron.schedule('cleanup-expired-locks', '*/5 * * * *', 'SELECT cleanup_expired_locks();');

-- 添加注释说明
COMMENT ON TABLE distributed_locks IS '分布式锁管理表，用于防止并发操作冲突';
COMMENT ON COLUMN distributed_locks.lock_key IS '锁的唯一标识符';
COMMENT ON COLUMN distributed_locks.lock_id IS '锁的实例ID';
COMMENT ON COLUMN distributed_locks.expires_at IS '锁的过期时间';
COMMENT ON COLUMN distributed_locks.created_at IS '锁的创建时间';