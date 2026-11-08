-- 乡音社区 PostgreSQL schema
--
-- Node 服务启动时会自动执行本文件（幂等），也可以手动运行：
--   psql "$DATABASE_URL" -f db/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '匿名乡音',
  type TEXT NOT NULL DEFAULT 'dialect',
  text TEXT NOT NULL,
  audio TEXT,
  audio_key TEXT,
  audio_name TEXT NOT NULL DEFAULT '',
  legacy_likes INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  reply_to TEXT,
  owner_id TEXT,
  user_id TEXT,
  consent_at BIGINT,
  delete_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'visible'
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_key TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS consent_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_posts_board_created ON posts (board, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (post_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_client ON post_likes (client_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  consent_at BIGINT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reporter_user_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at BIGINT,
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_post ON reports (post_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
