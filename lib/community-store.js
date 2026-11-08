'use strict';

/* 乡音社区 SQLite 数据层
 *
 * 只使用 Node 内置的 node:sqlite，保持零运行时依赖。
 * 需要 Node.js >= 22.13（node:sqlite 在该版本起不再需要 --experimental-sqlite）。
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '匿名乡音',
  type TEXT NOT NULL DEFAULT 'dialect',
  text TEXT NOT NULL,
  audio TEXT,
  audio_name TEXT NOT NULL DEFAULT '',
  legacy_likes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reply_to TEXT,
  owner_id TEXT,
  delete_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'visible'
);

CREATE INDEX IF NOT EXISTS idx_posts_board_created ON posts (board, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_client ON post_likes (client_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIEW IF NOT EXISTS post_view AS
SELECT
  p.*,
  p.legacy_likes + (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes
FROM posts p;
`;

function toPost(row, viewerId) {
  return {
    id: row.id,
    board: row.board,
    province: row.province || '',
    name: row.name,
    type: row.type,
    text: row.text,
    audio: row.audio == null ? null : row.audio,
    audioName: row.audio_name || '',
    likes: Math.max(0, Number(row.likes) || 0),
    liked: !!Number(row.liked),
    mine: !!(viewerId && row.owner_id === viewerId),
    createdAt: Number(row.created_at) || 0,
    replyTo: row.reply_to || null,
    ownerId: row.owner_id || null,
    deleteTokenHash: row.delete_token_hash || null
  };
}

class CommunityStore {
  constructor(options) {
    const dbFile = options && options.dbFile;
    if (!dbFile) throw new Error('CommunityStore 需要 dbFile');
    this.dbFile = path.resolve(dbFile);
    this.maxPosts = Math.max(1, Number(options.maxPosts) || 500);

    fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
    this.db = new DatabaseSync(this.dbFile);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);

    const likedColumn = `
      CASE
        WHEN ? <> '' AND EXISTS (
          SELECT 1 FROM post_likes l WHERE l.post_id = v.id AND l.client_id = ?
        ) THEN 1 ELSE 0
      END AS liked`;

    this.stmtCount = this.db.prepare('SELECT COUNT(*) AS count FROM posts');
    this.stmtList = this.db.prepare(
      'SELECT v.*, ' + likedColumn + ' FROM post_view v ORDER BY v.created_at DESC'
    );
    this.stmtListByBoard = this.db.prepare(
      'SELECT v.*, ' + likedColumn + ' FROM post_view v WHERE v.board = ? ORDER BY v.created_at DESC'
    );
    this.stmtGet = this.db.prepare(
      'SELECT v.*, ' + likedColumn + ' FROM post_view v WHERE v.id = ? LIMIT 1'
    );
    this.stmtGetId = this.db.prepare('SELECT id FROM posts WHERE id = ? LIMIT 1');
    this.stmtInsertPost = this.db.prepare(`
      INSERT INTO posts (
        id, board, province, name, type, text, audio, audio_name,
        created_at, reply_to, owner_id, delete_token_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtInsertLegacy = this.db.prepare(`
      INSERT OR IGNORE INTO posts (
        id, board, province, name, type, text, audio, audio_name, legacy_likes,
        created_at, reply_to, owner_id, delete_token_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtInsertLike = this.db.prepare(`
      INSERT OR IGNORE INTO post_likes (post_id, client_id, created_at)
      VALUES (?, ?, ?)
    `);
    this.stmtDeleteLike = this.db.prepare(
      'DELETE FROM post_likes WHERE post_id = ? AND client_id = ?'
    );
    this.stmtDeletePost = this.db.prepare('DELETE FROM posts WHERE id = ?');
    this.stmtTrim = this.db.prepare(`
      DELETE FROM posts
      WHERE id NOT IN (
        SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT ?
      )
    `);
    this.stmtMetaGet = this.db.prepare('SELECT value FROM meta WHERE key = ? LIMIT 1');
    this.stmtMetaSet = this.db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
  }

  count() {
    return Math.max(0, Number(this.stmtCount.get().count) || 0);
  }

  list(board, viewerId) {
    const viewer = viewerId || '';
    const rows = board
      ? this.stmtListByBoard.all(viewer, viewer, board)
      : this.stmtList.all(viewer, viewer);
    return rows.map((row) => toPost(row, viewerId));
  }

  get(id, viewerId) {
    const viewer = viewerId || '';
    const row = this.stmtGet.get(viewer, viewer, id);
    return row ? toPost(row, viewerId) : null;
  }

  create(post) {
    const createdAt = Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.stmtInsertPost.run(
        post.id,
        post.board,
        post.province || '',
        post.name || '匿名乡音',
        post.type || 'dialect',
        post.text,
        post.audio == null ? null : post.audio,
        post.audioName || '',
        createdAt,
        post.replyTo || null,
        post.ownerId || null,
        post.deleteTokenHash || null
      );
      this.stmtTrim.run(this.maxPosts);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return this.get(post.id, post.ownerId || null);
  }

  setLike(id, clientId, liked) {
    if (!this.stmtGetId.get(id)) return null;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (liked) this.stmtInsertLike.run(id, clientId, Date.now());
      else this.stmtDeleteLike.run(id, clientId);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return this.get(id, clientId);
  }

  remove(id) {
    const result = this.stmtDeletePost.run(id);
    return result.changes > 0;
  }

  importLegacy(posts) {
    if (this.stmtMetaGet.get('community_json_imported')) return 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let imported = 0;
      for (const post of Array.isArray(posts) ? posts : []) {
        if (!post || !post.id || !post.text) continue;
        const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        const legacyLikes = Math.max(0, (Number(post.likes) || 0) - likedBy.length);
        const result = this.stmtInsertLegacy.run(
          post.id,
          post.board,
          post.province || '',
          post.name || '匿名乡音',
          post.type || 'dialect',
          post.text,
          post.audio == null ? null : post.audio,
          post.audioName || '',
          legacyLikes,
          Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now(),
          post.replyTo || null,
          post.ownerId || null,
          post.deleteTokenHash || null
        );
        if (result.changes) imported += 1;
        for (const clientId of likedBy) {
          if (/^[A-Za-z0-9_-]{6,64}$/.test(clientId)) {
            this.stmtInsertLike.run(post.id, clientId, Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now());
          }
        }
      }
      this.stmtTrim.run(this.maxPosts);
      this.stmtMetaSet.run('community_json_imported', String(Date.now()));
      this.db.exec('COMMIT');
      return imported;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = { CommunityStore };
