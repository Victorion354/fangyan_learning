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
  delete_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'visible'
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_key TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_board_created ON posts (board, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (post_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_client ON post_likes (client_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
