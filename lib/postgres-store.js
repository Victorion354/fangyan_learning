'use strict';

/* 乡音社区 PostgreSQL 数据层（生产环境）
 *
 * 与 lib/community-store.js 暴露同一组方法，server.js 不感知具体数据库。
 * 需要可选依赖 pg：npm install
 */

const fs = require('node:fs');
const path = require('node:path');
const { requireOptional } = require('./optional.js');

const SCHEMA_FILE = path.join(__dirname, '..', 'db', 'migrations', '001_init.sql');

const POST_STATUSES = new Set(['visible', 'pending', 'hidden', 'removed']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);

function normalizeListCursor(cursor) {
  if (!cursor || typeof cursor !== 'object') return null;
  const createdAt = Number(cursor.createdAt);
  const id = String(cursor.id == null ? '' : cursor.id);
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return { createdAt: createdAt, id: id };
}

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
    liked: row.liked === true || Number(row.liked) === 1,
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
    email: row.email || '',
    emailKey: row.email_key || '',
    emailVerifiedAt: Number(row.email_verified_at) || 0,
    createdAt: Number(row.created_at) || 0,
    consentAt: Number(row.consent_at) || 0,
    status: row.status || 'active'
  };
}

function toAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    actorType: row.actor_type || 'admin',
    actorLabel: row.actor_label || '',
    action: row.action,
    targetType: row.target_type || '',
    targetId: row.target_id || '',
    detail: row.detail || '',
    ip: row.ip || '',
    userAgent: row.user_agent || '',
    createdAt: Number(row.created_at) || 0
  };
}

const BASE_SELECT = `
  SELECT p.*,
    p.legacy_likes + (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
    (SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id AND r.status = 'open') AS report_count,
    CASE
      WHEN $1 <> '' AND EXISTS (
        SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.client_id = $1
      ) THEN TRUE ELSE FALSE
    END AS liked
  FROM posts p`;

class PostgresCommunityStore {
  static async create(options) {
    const { Pool } = requireOptional('pg');
    const store = new PostgresCommunityStore(options, Pool);
    await store.init();
    return store;
  }

  constructor(options, Pool) {
    const connectionString = options && options.connectionString;
    if (!connectionString) throw new Error('PostgresCommunityStore 需要 connectionString');
    this.driver = 'postgres';
    this.maxPosts = Math.max(1, Number(options.maxPosts) || 500);
    this.pool = new Pool({
      connectionString: connectionString,
      max: Math.max(1, Number(options.poolMax) || 10),
      ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000
    });
  }

  async init() {
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await this.pool.query(schema);
  }

  /* ============ 留言 ============ */

  async count() {
    const result = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM posts WHERE status = 'visible'"
    );
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  async countAll() {
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM posts');
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  async countByStatus() {
    const result = await this.pool.query(
      'SELECT status, COUNT(*)::int AS count FROM posts GROUP BY status'
    );
    const counts = { visible: 0, pending: 0, hidden: 0, removed: 0 };
    for (const row of result.rows) {
      if (row.status in counts) counts[row.status] = Math.max(0, Number(row.count) || 0);
    }
    return counts;
  }

  async countByBoard() {
    const result = await this.pool.query(
      "SELECT board, COUNT(*)::int AS count FROM posts WHERE status = 'visible' GROUP BY board"
    );
    const counts = {};
    for (const row of result.rows) {
      counts[row.board] = Math.max(0, Number(row.count) || 0);
    }
    return counts;
  }

  async list(board, viewerId, options) {
    const viewer = viewerId || '';
    const opts = options || {};
    const rawLimit = Number(opts.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(500, Math.floor(rawLimit))
      : 500;
    const before = normalizeListCursor(opts.before);
    const params = [viewer];
    let sql = BASE_SELECT + " WHERE p.status = 'visible'";
    if (board) {
      params.push(board);
      sql += ' AND p.board = $' + params.length;
    }
    if (before) {
      params.push(before.createdAt);
      const createdAtParam = params.length;
      params.push(before.id);
      sql += ' AND (p.created_at < $' + createdAtParam +
        ' OR (p.created_at = $' + createdAtParam + ' AND p.id < $' + params.length + '))';
    }
    params.push(limit);
    sql += ' ORDER BY p.created_at DESC, p.id DESC LIMIT $' + params.length;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => toPost(row, viewerId));
  }

  async listByUser(userId) {
    const result = await this.pool.query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
      [userId]
    );
    return result.rows.map((row) => toPost(row, null));
  }

  async listAdmin(options) {
    const opts = options || {};
    const status = POST_STATUSES.has(opts.status) ? opts.status : '';
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
    const params = [''];
    let sql = BASE_SELECT;
    if (status) {
      params.push(status);
      sql += ' WHERE p.status = $2';
    }
    params.push(limit);
    sql += ' ORDER BY p.created_at DESC, p.id DESC LIMIT $' + params.length;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => toPost(row, null));
  }

  async get(id, viewerId) {
    const viewer = viewerId || '';
    const result = await this.pool.query(
      BASE_SELECT + ' WHERE p.id = $2 LIMIT 1',
      [viewer, id]
    );
    return result.rows[0] ? toPost(result.rows[0], viewerId) : null;
  }

  async getStatus(id) {
    const result = await this.pool.query('SELECT status FROM posts WHERE id = $1', [id]);
    return result.rows[0] ? result.rows[0].status : null;
  }

  async create(post) {
    const createdAt = Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now();
    const status = POST_STATUSES.has(post.status) ? post.status : 'visible';
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO posts (
          id, board, province, name, type, text, audio, audio_key, audio_name,
          created_at, reply_to, owner_id, user_id, consent_at, delete_token_hash, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
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
        ]
      );
      await client.query(
        `DELETE FROM posts WHERE id NOT IN (
          SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT $1
        )`,
        [this.maxPosts]
      );
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
    return this.get(post.id, post.ownerId || null);
  }

  async setLike(id, clientId, liked) {
    const exists = await this.pool.query('SELECT 1 FROM posts WHERE id = $1', [id]);
    if (!exists.rowCount) return null;
    if (liked) {
      await this.pool.query(
        `INSERT INTO post_likes (post_id, client_id, created_at)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [id, clientId, Date.now()]
      );
    } else {
      await this.pool.query(
        'DELETE FROM post_likes WHERE post_id = $1 AND client_id = $2',
        [id, clientId]
      );
    }
    return this.get(id, clientId);
  }

  async setStatus(id, status) {
    if (!POST_STATUSES.has(status)) throw new Error('留言状态不合法：' + status);
    const result = await this.pool.query(
      'UPDATE posts SET status = $1 WHERE id = $2',
      [status, id]
    );
    return result.rowCount > 0;
  }

  async remove(id) {
    const result = await this.pool.query('DELETE FROM posts WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /* ============ 账号 ============ */

  async createUser(user) {
    const result = await this.pool.query(
      `INSERT INTO users (
        id, username, username_key, display_name, password_hash,
        email, email_key, email_verified_at, created_at, consent_at, status
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
       RETURNING *`,
      [
        user.id,
        user.username,
        user.usernameKey,
        user.displayName || user.username,
        user.passwordHash,
        user.email || '',
        user.emailKey || null,
        Number(user.emailVerifiedAt) || null,
        Number(user.createdAt) || Date.now(),
        Number(user.consentAt) || Date.now()
      ]
    );
    return toUser(result.rows[0]);
  }

  async getUserById(id) {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return toUser(result.rows[0]);
  }

  async getUserByUsernameKey(key) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE username_key = $1 LIMIT 1',
      [key]
    );
    return toUser(result.rows[0]);
  }

  async getUserByEmailKey(key) {
    if (!key) return null;
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email_key = $1 LIMIT 1',
      [key]
    );
    return toUser(result.rows[0]);
  }

  async setUserEmail(userId, email, emailKey) {
    const result = await this.pool.query(
      'UPDATE users SET email = $1, email_key = $2, email_verified_at = NULL WHERE id = $3',
      [email || '', emailKey || null, userId]
    );
    return result.rowCount > 0;
  }

  async setEmailVerified(userId, verifiedAt) {
    const result = await this.pool.query(
      'UPDATE users SET email_verified_at = $1 WHERE id = $2',
      [Number(verifiedAt) || Date.now(), userId]
    );
    return result.rowCount > 0;
  }

  async updateUserPassword(userId, passwordHash) {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );
    return result.rowCount > 0;
  }

  async countUsers() {
    const result = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE status = 'active'"
    );
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  async deleteUser(id) {
    const result = await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async deleteUserData(userId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const posts = await client.query(
        'SELECT id, audio_key FROM posts WHERE user_id = $1',
        [userId]
      );
      const postIds = posts.rows.map((row) => row.id);
      const audioKeys = posts.rows.map((row) => row.audio_key).filter(Boolean);
      await client.query('DELETE FROM reports WHERE reporter_user_id = $1', [userId]);
      await client.query('DELETE FROM posts WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { postIds: postIds, audioKeys: audioKeys };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  /* ============ 邮箱令牌 ============ */

  async createEmailToken(token) {
    await this.pool.query(
      `INSERT INTO email_tokens (token_hash, user_id, kind, created_at, expires_at, used_at)
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [
        token.tokenHash,
        token.userId,
        token.kind,
        Number(token.createdAt) || Date.now(),
        Number(token.expiresAt)
      ]
    );
  }

  async getEmailToken(tokenHash, now) {
    const result = await this.pool.query(
      'SELECT * FROM email_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 LIMIT 1',
      [tokenHash, Number(now) || Date.now()]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      userId: row.user_id,
      kind: row.kind,
      createdAt: Number(row.created_at) || 0,
      expiresAt: Number(row.expires_at) || 0
    };
  }

  async useEmailToken(tokenHash, usedAt) {
    const result = await this.pool.query(
      'UPDATE email_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL',
      [Number(usedAt) || Date.now(), tokenHash]
    );
    return result.rowCount > 0;
  }

  async deleteEmailTokens(userId, kind) {
    const result = await this.pool.query(
      'DELETE FROM email_tokens WHERE user_id = $1 AND kind = $2',
      [userId, kind]
    );
    return result.rowCount;
  }

  async pruneEmailTokens(now) {
    const result = await this.pool.query(
      'DELETE FROM email_tokens WHERE expires_at <= $1',
      [Number(now) || Date.now()]
    );
    return result.rowCount;
  }

  /* ============ 管理审计日志 ============ */

  async createAuditLog(log) {
    const result = await this.pool.query(
      `INSERT INTO audit_logs (
        id, actor_type, actor_label, action, target_type, target_id,
        detail, ip, user_agent, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        log.id,
        log.actorType || 'admin',
        log.actorLabel || '',
        log.action,
        log.targetType || '',
        log.targetId || '',
        log.detail || '',
        log.ip || '',
        log.userAgent || '',
        Number(log.createdAt) || Date.now()
      ]
    );
    return toAudit(result.rows[0]);
  }

  async getAuditLog(id) {
    const result = await this.pool.query('SELECT * FROM audit_logs WHERE id = $1 LIMIT 1', [id]);
    return toAudit(result.rows[0]);
  }

  async listAuditLogs(options) {
    const opts = options || {};
    const limit = Math.min(5000, Math.max(1, Number(opts.limit) || 100));
    const where = [];
    const params = [];
    if (opts.action) { params.push(opts.action); where.push('action = $' + params.length); }
    if (opts.targetType) { params.push(opts.targetType); where.push('target_type = $' + params.length); }
    if (opts.targetId) { params.push(opts.targetId); where.push('target_id = $' + params.length); }
    if (Number(opts.before) > 0) { params.push(Number(opts.before)); where.push('created_at < $' + params.length); }
    params.push(limit);
    const sql = 'SELECT * FROM audit_logs' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY created_at DESC, id DESC LIMIT $' + params.length;
    const result = await this.pool.query(sql, params);
    return result.rows.map(toAudit);
  }

  async countAuditLogs() {
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM audit_logs');
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  /* ============ 登录会话 ============ */

  async createUserSession(session) {
    await this.pool.query(
      `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [
        session.tokenHash,
        session.userId,
        Number(session.createdAt) || Date.now(),
        Number(session.expiresAt)
      ]
    );
  }

  async getUserSession(tokenHash) {
    const result = await this.pool.query(
      `SELECT s.token_hash, s.user_id, s.expires_at,
        u.username, u.display_name, u.created_at, u.status AS user_status
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2 AND u.status = 'active'
       LIMIT 1`,
      [tokenHash, Date.now()]
    );
    const row = result.rows[0];
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

  async deleteUserSession(tokenHash) {
    const result = await this.pool.query(
      'DELETE FROM user_sessions WHERE token_hash = $1',
      [tokenHash]
    );
    return result.rowCount > 0;
  }

  async deleteUserSessions(userId) {
    const result = await this.pool.query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
    return result.rowCount;
  }

  async pruneUserSessions(now) {
    const result = await this.pool.query(
      'DELETE FROM user_sessions WHERE expires_at <= $1',
      [Number(now) || Date.now()]
    );
    return result.rowCount;
  }

  /* ============ 举报 ============ */

  async createReport(report) {
    const result = await this.pool.query(
      `INSERT INTO reports (id, post_id, reporter_id, reporter_user_id, reason, created_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,'open')
       ON CONFLICT (post_id, reporter_id) DO NOTHING
       RETURNING *`,
      [
        report.id,
        report.postId,
        report.reporterId,
        report.reporterUserId || null,
        report.reason || '',
        Number(report.createdAt) || Date.now()
      ]
    );
    if (!result.rowCount) return { created: false, report: null };
    return { created: true, report: toReport(result.rows[0]) };
  }

  async getReport(id) {
    const result = await this.pool.query('SELECT * FROM reports WHERE id = $1 LIMIT 1', [id]);
    return toReport(result.rows[0]);
  }

  async listReports(options) {
    const opts = options || {};
    const status = REPORT_STATUSES.has(opts.status) ? opts.status : '';
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
    const params = [];
    let sql = `SELECT r.*, p.text AS post_text, p.name AS post_name,
        p.board AS post_board, p.status AS post_status
      FROM reports r LEFT JOIN posts p ON p.id = r.post_id`;
    if (status) {
      params.push(status);
      sql += ' WHERE r.status = $' + params.length;
    }
    params.push(limit);
    sql += ' ORDER BY r.created_at DESC LIMIT $' + params.length;
    const result = await this.pool.query(sql, params);
    return result.rows.map(toReport);
  }

  async listReportsByUser(userId) {
    const result = await this.pool.query(
      'SELECT * FROM reports WHERE reporter_user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(toReport);
  }

  async resolveReport(id, status) {
    if (!REPORT_STATUSES.has(status) || status === 'open') {
      throw new Error('举报状态不合法：' + status);
    }
    const result = await this.pool.query(
      'UPDATE reports SET status = $1, resolved_at = $2 WHERE id = $3',
      [status, Date.now(), id]
    );
    return result.rowCount > 0;
  }

  async countOpenReports(postId) {
    const result = postId
      ? await this.pool.query(
        "SELECT COUNT(*)::int AS count FROM reports WHERE post_id = $1 AND status = 'open'",
        [postId]
      )
      : await this.pool.query("SELECT COUNT(*)::int AS count FROM reports WHERE status = 'open'");
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  /* ============ 演示与维护 ============ */

  /* 清空全部社区数据，并标记旧 JSON 已导入，避免重启后重新导入。
   * 仅供 scripts/demo-data.js 与测试使用。 */
  async reset() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM reports');
      await client.query('DELETE FROM post_likes');
      await client.query('DELETE FROM posts');
      await client.query('DELETE FROM email_tokens');
      await client.query('DELETE FROM audit_logs');
      await client.query('DELETE FROM user_sessions');
      await client.query('DELETE FROM users');
      await client.query('DELETE FROM meta');
      await client.query(
        `INSERT INTO meta (key, value) VALUES ('community_json_imported', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(Date.now())]
      );
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  /* ============ 旧数据导入 ============ */

  async importLegacy(posts) {
    const meta = await this.pool.query(
      "SELECT 1 FROM meta WHERE key = 'community_json_imported'"
    );
    if (meta.rowCount) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let imported = 0;
      for (const post of Array.isArray(posts) ? posts : []) {
        if (!post || !post.id || !post.text) continue;
        const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        const legacyLikes = Math.max(0, (Number(post.likes) || 0) - likedBy.length);
        const createdAt = Number.isFinite(Number(post.createdAt))
          ? Number(post.createdAt)
          : Date.now();
        const result = await client.query(
          `INSERT INTO posts (
            id, board, province, name, type, text, audio, audio_key, audio_name,
            legacy_likes, created_at, reply_to, owner_id, user_id, consent_at, delete_token_hash, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'visible')
          ON CONFLICT (id) DO NOTHING`,
          [
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
            createdAt,
            post.replyTo || null,
            post.ownerId || null,
            null,
            null,
            post.deleteTokenHash || null
          ]
        );
        if (result.rowCount) imported += 1;
        for (const likedClientId of likedBy) {
          if (/^[A-Za-z0-9_-]{6,64}$/.test(likedClientId)) {
            await client.query(
              `INSERT INTO post_likes (post_id, client_id, created_at)
               VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
              [post.id, likedClientId, createdAt]
            );
          }
        }
      }
      await client.query(
        `DELETE FROM posts WHERE id NOT IN (
          SELECT id FROM posts ORDER BY created_at DESC, id DESC LIMIT $1
        )`,
        [this.maxPosts]
      );
      await client.query(
        `INSERT INTO meta (key, value) VALUES ('community_json_imported', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(Date.now())]
      );
      await client.query('COMMIT');
      return imported;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresCommunityStore };
