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
    deleteTokenHash: row.delete_token_hash || null
  };
}

const BASE_SELECT = `
  SELECT p.*,
    p.legacy_likes + (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
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

  async count() {
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM posts');
    return Math.max(0, Number(result.rows[0].count) || 0);
  }

  async list(board, viewerId) {
    const viewer = viewerId || '';
    const params = [viewer];
    let sql = BASE_SELECT;
    if (board) {
      params.push(board);
      sql += ' WHERE p.board = $2';
    }
    sql += ' ORDER BY p.created_at DESC, p.id DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => toPost(row, viewerId));
  }

  async get(id, viewerId) {
    const viewer = viewerId || '';
    const result = await this.pool.query(
      BASE_SELECT + ' WHERE p.id = $2 LIMIT 1',
      [viewer, id]
    );
    return result.rows[0] ? toPost(result.rows[0], viewerId) : null;
  }

  async create(post) {
    const createdAt = Number.isFinite(Number(post.createdAt)) ? Number(post.createdAt) : Date.now();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO posts (
          id, board, province, name, type, text, audio, audio_key, audio_name,
          created_at, reply_to, owner_id, delete_token_hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
          post.deleteTokenHash || null
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

  async remove(id) {
    const result = await this.pool.query('DELETE FROM posts WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

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
            legacy_likes, created_at, reply_to, owner_id, delete_token_hash
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
