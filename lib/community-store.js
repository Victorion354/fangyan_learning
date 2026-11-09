'use strict';

/* 乡音社区 SQLite 数据层
 *
 * 只使用 Node 内置的 node:sqlite，保持零运行时依赖。
 * 需要 Node.js >= 22.13（node:sqlite 在该版本起不再需要 --experimental-sqlite）。
 *
 * 数据表：
 *   posts          留言（status: visible / pending / hidden / removed）
 *   post_likes     点赞
 *   users          账号（用户名 + scrypt 密码哈希）
 *   user_sessions  登录会话（只存令牌哈希）
 *   reports        举报（每个举报人对同一条留言只能举报一次）
 *   meta           导入标记等元数据
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
  audio_key TEXT,
  audio_name TEXT NOT NULL DEFAULT '',
  legacy_likes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reply_to TEXT,
  owner_id TEXT,
  user_id TEXT,
  consent_at INTEGER,
  delete_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'visible'
);

CREATE INDEX IF NOT EXISTS idx_posts_board_created ON posts (board, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_client ON post_likes (client_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  consent_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reporter_user_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at INTEGER,
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_post ON reports (post_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

DROP VIEW IF EXISTS post_view;
CREATE VIEW post_view AS
SELECT
  p.*,
  p.legacy_likes + (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id AND r.status = 'open') AS report_count
FROM posts p;
`;

const POST_STATUSES = new Set(['visible', 'pending', 'hidden', 'removed']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);

function toPost(row, viewerId) {
  return {
    id: row.id,
    board: row.board,
    province: row.province || '',
    name: row.name,
    type: row.type,
    text: row.text,
    audio: row.audio == null ? null : row.audio,
    audioKey: row.audio_key || null,
    audioName: row.audio_name || '',
    likes: Math.max(0, Number(row.likes) || 0),
    liked: !!Number(row.liked),
    mine: !!(viewerId && row.owner_id === viewerId),
    createdAt: Number(row.created_at) || 0,
    replyTo: row.reply_to || null,
    ownerId: row.owner_id || null,
    userId: row.user_id || null,
    consentAt: Number(row.consent_at) || 0,
    status: POST_STATUSES.has(row.status) ? row.status : 'visible',
    reportCount: Math.max(0, Number(row.report_count) || 0),
    deleteTokenHash: row.delete_token_hash || null
  };
}

function toReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    postId: row.post_id,
    reporterId: row.reporter_id,
    reporterUserId: row.reporter_user_id || null,
    reason: row.reason || '',
    createdAt: Number(row.created_at) || 0,
    status: REPORT_STATUSES.has(row.status) ? row.status : 'open',
    resolvedAt: Number(row.resolved_at) || 0,
    post: row.post_id
      ? {
        id: row.post_id,
        text: row.post_text == null ? '' : row.post_text,
        name: row.post_name == null ? '' : row.post_name,
        board: row.post_board == null ? '' : row.post_board,
        status: row.post_status == null ? '' : row.post_status
      }
      : null
  };
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    displayName: row.display_name || row.username,
    passwordHash: row.password_hash,
    createdAt: Number(row.created_at) || 0,
    consentAt: Number(row.consent_at) || 0,
    status: row.status || 'active'
  };
}

class CommunityStore {
  constructor(options) {
    const dbFile = options && options.dbFile;
    if (!dbFile) throw new Error('CommunityStore 需要 dbFile');
    this.driver = 'sqlite';
    this.dbFile = path.resolve(dbFile);
    this.maxPosts = Math.max(1, Number(options.maxPosts) || 500);

    fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
    this.db = new DatabaseSync(this.dbFile);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);

    /* 兼容旧数据库：补充后来新增的列 */
    const columns = new Set(
      this.db.prepare('PRAGMA table_info(posts)').all().map((row) => row.name)
    );
    const additions = [
      ['audio_key', 'ALTER TABLE posts ADD COLUMN audio_key TEXT'],
      ['user_id', 'ALTER TABLE posts ADD COLUMN user_id TEXT'],
      ['consent_at', 'ALTER TABLE posts ADD COLUMN consent_at INTEGER']
    ];
    for (const [name, sql] of additions) {
      if (!columns.has(name)) this.db.exec(sql);
    }

    const likedColumn = `
      CASE
        WHEN ? <> '' AND EXISTS (
          SELECT 1 FROM post_likes l WHERE l.post_id = v.id AND l.client_id = ?
        ) THEN 1 ELSE 0
      END AS liked`;

    this.stmtCount = this.db.prepare("SELECT COUNT(*) AS count FROM posts WHERE status = 'visible'");
    this.stmtCountAll = this.db.prepare('SELECT COUNT(*) AS count FROM posts');
    this.stmtCountByStatus = this.db.prepare(
      'SELECT status, COUNT(*) AS count FROM posts GROUP BY status'
    );
    this.stmtList = this.db.prepare(
      "SELECT v.*, " + likedColumn + " FROM post_view v WHERE v.status = 'visible' ORDER BY v.created_at DESC, v.id DESC"
    );
    this.stmtListByBoard = this.db.prepare(
      "SELECT v.*, " + likedColumn + " FROM post_view v WHERE v.board = ? AND v.status = 'visible' ORDER BY v.created_at DESC, v.id DESC"
    );
    this.stmtGet = this.db.prepare(
      'SELECT v.*, ' + likedColumn + ' FROM post_view v WHERE v.id = ? LIMIT 1'
    );
    this.stmtGetId = this.db.prepare('SELECT id, status FROM posts WHERE id = ? LIMIT 1');
    this.stmtListByUser = this.db.prepare(
      'SELECT v.* FROM post_view v WHERE v.user_id = ? ORDER BY v.created_at DESC, v.id DESC'
    );
    this.stmtInsertPost = this.db.prepare(`
      INSERT INTO posts (
        id, board, province, name, type, text, audio, audio_key, audio_name,
        created_at, reply_to, owner_id, user_id, consent_at, delete_token_hash, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtInsertLegacy = this.db.prepare(`
      INSERT OR IGNORE INTO posts (
        id, board, province, name, type, text, audio, audio_key, audio_name, legacy_likes,
        created_at, reply_to, owner_id, user_id, consent_at, delete_token_hash, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtInsertLike = this.db.prepare(`
      INSERT OR IGNORE INTO post_likes (post_id, client_id, created_at)
      VALUES (?, ?, ?)
    `);
    this.stmtDeleteLike = this.db.prepare(
      'DELETE FROM post_likes WHERE post_id = ? AND client_id = ?'
    );
    this.stmtDeletePost = this.db.prepare('DELETE FROM posts WHERE id = ?');
    this.stmtSetStatus = this.db.prepare('UPDATE posts SET status = ? WHERE id = ?');
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

    /* 账号 */
    this.stmtInsertUser = this.db.prepare(`
      INSERT INTO users (id, username, username_key, display_name, password_hash, created_at, consent_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);
    this.stmtUserById = this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    this.stmtUserByKey = this.db.prepare('SELECT * FROM users WHERE username_key = ? LIMIT 1');
    this.stmtDeleteUser = this.db.prepare('DELETE FROM users WHERE id = ?');
    this.stmtCountUsers = this.db.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'");

    /* 登录会话 */
    this.stmtInsertUserSession = this.db.prepare(`
      INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    this.stmtUserSession = this.db.prepare(`
      SELECT s.token_hash, s.user_id, s.created_at AS session_created_at, s.expires_at,
        u.username, u.display_name, u.created_at, u.status AS user_status
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1
    `);
    this.stmtDeleteUserSession = this.db.prepare('DELETE FROM user_sessions WHERE token_hash = ?');
    this.stmtDeleteUserSessions = this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?');
    this.stmtPruneUserSessions = this.db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?');

    /* 举报 */
    this.stmtInsertReport = this.db.prepare(`
      INSERT OR IGNORE INTO reports (
        id, post_id, reporter_id, reporter_user_id, reason, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'open')
    `);
    this.stmtReportById = this.db.prepare('SELECT * FROM reports WHERE id = ? LIMIT 1');
    this.stmtResolveReport = this.db.prepare(
      'UPDATE reports SET status = ?, resolved_at = ? WHERE id = ?'
    );
    this.stmtOpenReportsForPost = this.db.prepare(
      "SELECT COUNT(*) AS count FROM reports WHERE post_id = ? AND status = 'open'"
    );
    this.stmtOpenReports = this.db.prepare(
      "SELECT COUNT(*) AS count FROM reports WHERE status = 'open'"
    );
    this.stmtReportsByUser = this.db.prepare(
      'SELECT * FROM reports WHERE reporter_user_id = ? ORDER BY created_at DESC'
    );
    this.stmtDeleteReportsByUser = this.db.prepare(
      'DELETE FROM reports WHERE reporter_user_id = ?'
    );
    this.stmtPostsByUser = this.db.prepare(
      'SELECT id, audio_key FROM posts WHERE user_id = ?'
    );
  }

  /* ============ 留言 ============ */

  count() {
    return Math.max(0, Number(this.stmtCount.get().count) || 0);
  }

  countAll() {
    return Math.max(0, Number(this.stmtCountAll.get().count) || 0);
  }

  countByStatus() {
    const result = { visible: 0, pending: 0, hidden: 0, removed: 0 };
    for (const row of this.stmtCountByStatus.all()) {
      if (row.status in result) result[row.status] = Math.max(0, Number(row.count) || 0);
    }
    return result;
  }

  list(board, viewerId) {
    const viewer = viewerId || '';
    const rows = board
      ? this.stmtListByBoard.all(viewer, viewer, board)
      : this.stmtList.all(viewer, viewer);
    return rows.map((row) => toPost(row, viewerId));
  }

  listByUser(userId) {
    return this.stmtListByUser.all(userId || '').map((row) => toPost(row, null));
  }

  listAdmin(options) {
    const opts = options || {};
    const status = POST_STATUSES.has(opts.status) ? opts.status : '';
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
    const sql = 'SELECT v.* FROM post_view v' +
      (status ? ' WHERE v.status = ?' : '') +
      ' ORDER BY v.created_at DESC, v.id DESC LIMIT ?';
    const params = status ? [status, limit] : [limit];
    return this.db.prepare(sql).all(...params).map((row) => toPost(row, null));
  }

  get(id, viewerId) {
    const viewer = viewerId || '';
    const row = this.stmtGet.get(viewer, viewer, id);
    return row ? toPost(row, viewerId) : null;
  }

  getStatus(id) {
    const row = this.stmtGetId.get(id);
    return row ? row.status : null;
  }

  create(post) {
    const createdAt = Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now();
    const status = POST_STATUSES.has(post.status) ? post.status : 'visible';
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
        post.audioKey || null,
        post.audioName || '',
        createdAt,
        post.replyTo || null,
        post.ownerId || null,
        post.userId || null,
        Number(post.consentAt) || null,
        post.deleteTokenHash || null,
        status
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

  setStatus(id, status) {
    if (!POST_STATUSES.has(status)) throw new Error('留言状态不合法：' + status);
    const result = this.stmtSetStatus.run(status, id);
    return result.changes > 0;
  }

  remove(id) {
    const result = this.stmtDeletePost.run(id);
    return result.changes > 0;
  }

  /* ============ 账号 ============ */

  createUser(user) {
    this.stmtInsertUser.run(
      user.id,
      user.username,
      user.usernameKey,
      user.displayName || user.username,
      user.passwordHash,
      Number(user.createdAt) || Date.now(),
      Number(user.consentAt) || Date.now()
    );
    return this.getUserById(user.id);
  }

  getUserById(id) {
    return toUser(this.stmtUserById.get(id));
  }

  getUserByUsernameKey(key) {
    return toUser(this.stmtUserByKey.get(key));
  }

  countUsers() {
    return Math.max(0, Number(this.stmtCountUsers.get().count) || 0);
  }

  deleteUser(id) {
    const result = this.stmtDeleteUser.run(id);
    return result.changes > 0;
  }

  /* 删除账号及其全部内容，返回需要同步清理的对象存储键 */
  deleteUserData(userId) {
    const posts = this.stmtPostsByUser.all(userId);
    const postIds = posts.map((row) => row.id);
    const audioKeys = posts.map((row) => row.audio_key).filter(Boolean);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.stmtDeleteReportsByUser.run(userId);
      this.db.prepare('DELETE FROM posts WHERE user_id = ?').run(userId);
      this.stmtDeleteUserSessions.run(userId);
      this.stmtDeleteUser.run(userId);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return { postIds: postIds, audioKeys: audioKeys };
  }

  /* ============ 登录会话 ============ */

  createUserSession(session) {
    this.stmtInsertUserSession.run(
      session.tokenHash,
      session.userId,
      Number(session.createdAt) || Date.now(),
      Number(session.expiresAt)
    );
  }

  getUserSession(tokenHash) {
    const row = this.stmtUserSession.get(tokenHash, Date.now());
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      userId: row.user_id,
      expiresAt: Number(row.expires_at) || 0,
      username: row.username,
      displayName: row.display_name || row.username,
      createdAt: Number(row.created_at) || 0
    };
  }

  deleteUserSession(tokenHash) {
    return this.stmtDeleteUserSession.run(tokenHash).changes > 0;
  }

  deleteUserSessions(userId) {
    return this.stmtDeleteUserSessions.run(userId).changes;
  }

  pruneUserSessions(now) {
    return this.stmtPruneUserSessions.run(Number(now) || Date.now()).changes;
  }

  /* ============ 举报 ============ */

  createReport(report) {
    const result = this.stmtInsertReport.run(
      report.id,
      report.postId,
      report.reporterId,
      report.reporterUserId || null,
      report.reason || '',
      Number(report.createdAt) || Date.now()
    );
    if (!result.changes) return { created: false, report: null };
    return { created: true, report: this.getReport(report.id) };
  }

  getReport(id) {
    return toReport(this.stmtReportById.get(id));
  }

  listReports(options) {
    const opts = options || {};
    const status = REPORT_STATUSES.has(opts.status) ? opts.status : '';
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
    const sql = `SELECT r.*, p.text AS post_text, p.name AS post_name,
        p.board AS post_board, p.status AS post_status
      FROM reports r LEFT JOIN posts p ON p.id = r.post_id` +
      (status ? ' WHERE r.status = ?' : '') +
      ' ORDER BY r.created_at DESC LIMIT ?';
    const params = status ? [status, limit] : [limit];
    return this.db.prepare(sql).all(...params).map(toReport);
  }

  listReportsByUser(userId) {
    return this.stmtReportsByUser.all(userId).map(toReport);
  }

  resolveReport(id, status) {
    if (!REPORT_STATUSES.has(status) || status === 'open') {
      throw new Error('举报状态不合法：' + status);
    }
    const result = this.stmtResolveReport.run(status, Date.now(), id);
    return result.changes > 0;
  }

  countOpenReports(postId) {
    if (postId) {
      return Math.max(0, Number(this.stmtOpenReportsForPost.get(postId).count) || 0);
    }
    return Math.max(0, Number(this.stmtOpenReports.get().count) || 0);
  }

  /* ============ 演示与维护 ============ */

  /* 清空全部社区数据，并标记旧 JSON 已导入，避免重启后重新导入。
   * 仅供 scripts/demo-data.js 与测试使用。 */
  reset() {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM reports');
      this.db.exec('DELETE FROM post_likes');
      this.db.exec('DELETE FROM posts');
      this.db.exec('DELETE FROM user_sessions');
      this.db.exec('DELETE FROM users');
      this.db.exec('DELETE FROM meta');
      this.stmtMetaSet.run('community_json_imported', String(Date.now()));
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /* ============ 旧数据导入 ============ */

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
          null,
          post.audioName || '',
          legacyLikes,
          Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now(),
          post.replyTo || null,
          post.ownerId || null,
          null,
          null,
          post.deleteTokenHash || null,
          'visible'
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
