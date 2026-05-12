ALTER TABLE avatar_chat_history
  ADD COLUMN IF NOT EXISTS user_id varchar,
  ADD COLUMN IF NOT EXISTS session_id varchar,
  ADD COLUMN IF NOT EXISTS device_id varchar,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_avatar_chat_history_scope_created_at
  ON avatar_chat_history (user_id, session_id, device_id, created_at DESC);
