const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db;

function getDb() {
  if (!db) {
    db = new Database(config.db.path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('[DB] Schema initialized');
}

// --- Users ---
const users = {
  create(user) {
    const stmt = getDb().prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(user.id, user.email, user.passwordHash, user.firstName, user.lastName);
  },

  findByEmail(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  updatePlan(id, plan) {
    return getDb().prepare('UPDATE users SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan, id);
  }
};

// --- Establishments ---
const establishments = {
  create(est) {
    const stmt = getDb().prepare(`
      INSERT INTO establishments (id, user_id, name, address, city, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(est.id, est.userId, est.name, est.address, est.city, est.category);
  },

  findByUserId(userId) {
    return getDb().prepare('SELECT * FROM establishments WHERE user_id = ?').all(userId);
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM establishments WHERE id = ?').get(id);
  },

  updateAiSettings(id, settings) {
    const stmt = getDb().prepare(`
      UPDATE establishments
      SET ai_tone = ?, ai_language = ?, ai_signature = ?, ai_use_tu = ?,
          auto_reply_positive = ?, auto_reply_negative = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      settings.tone, settings.language, settings.signature, settings.useTu,
      settings.autoReplyPositive ? 1 : 0, settings.autoReplyNegative ? 1 : 0, id
    );
  },

  updateGoogleTokens(id, tokens) {
    const stmt = getDb().prepare(`
      UPDATE establishments
      SET google_account_id = ?, google_location_id = ?,
          google_access_token = ?, google_refresh_token = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(tokens.accountId, tokens.locationId, tokens.accessToken, tokens.refreshToken, id);
  },

  updateFacebookTokens(id, pageId, accessToken) {
    const stmt = getDb().prepare(`
      UPDATE establishments
      SET facebook_page_id = ?, facebook_access_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(pageId, accessToken, id);
  }
};

// --- Reviews ---
const reviews = {
  create(review) {
    const stmt = getDb().prepare(`
      INSERT OR IGNORE INTO reviews (id, establishment_id, platform, platform_review_id,
        author_name, author_avatar_url, rating, text, language, sentiment, sentiment_score, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      review.id, review.establishmentId, review.platform, review.platformReviewId,
      review.authorName, review.authorAvatarUrl, review.rating, review.text,
      review.language, review.sentiment, review.sentimentScore, review.publishedAt
    );
  },

  findByEstablishment(establishmentId, { limit = 50, offset = 0, platform, sentiment } = {}) {
    let query = 'SELECT * FROM reviews WHERE establishment_id = ?';
    const params = [establishmentId];

    if (platform) {
      query += ' AND platform = ?';
      params.push(platform);
    }
    if (sentiment) {
      query += ' AND sentiment = ?';
      params.push(sentiment);
    }

    query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return getDb().prepare(query).all(...params);
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  },

  findUnreplied(establishmentId) {
    return getDb().prepare(
      'SELECT * FROM reviews WHERE establishment_id = ? AND is_replied = 0 ORDER BY published_at DESC'
    ).all(establishmentId);
  },

  markAsReplied(id) {
    return getDb().prepare('UPDATE reviews SET is_replied = 1 WHERE id = ?').run(id);
  },

  markAsRead(id) {
    return getDb().prepare('UPDATE reviews SET is_read = 1 WHERE id = ?').run(id);
  },

  getStats(establishmentId) {
    return getDb().prepare(`
      SELECT
        COUNT(*) as total,
        ROUND(AVG(rating), 2) as avg_rating,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN sentiment = 'neutre' THEN 1 ELSE 0 END) as neutral,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
        SUM(CASE WHEN is_replied = 1 THEN 1 ELSE 0 END) as replied,
        ROUND(CAST(SUM(CASE WHEN is_replied = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as response_rate
      FROM reviews WHERE establishment_id = ?
    `).get(establishmentId);
  },

  getStatsByPlatform(establishmentId) {
    return getDb().prepare(`
      SELECT platform,
        COUNT(*) as total,
        ROUND(AVG(rating), 2) as avg_rating,
        SUM(CASE WHEN is_replied = 1 THEN 1 ELSE 0 END) as replied
      FROM reviews WHERE establishment_id = ?
      GROUP BY platform
    `).all(establishmentId);
  }
};

// --- Responses ---
const responses = {
  create(response) {
    const stmt = getDb().prepare(`
      INSERT INTO responses (id, review_id, text, generated_by, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(response.id, response.reviewId, response.text, response.generatedBy, response.status || 'draft');
  },

  findByReviewId(reviewId) {
    return getDb().prepare('SELECT * FROM responses WHERE review_id = ? ORDER BY created_at DESC').all(reviewId);
  },

  updateStatus(id, status) {
    const stmt = getDb().prepare(`
      UPDATE responses SET status = ?,
        published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE id = ?
    `);
    return stmt.run(status, status, id);
  }
};

// --- Alerts ---
const alerts = {
  create(alert) {
    const stmt = getDb().prepare(`
      INSERT INTO alerts (id, user_id, review_id, type, channel, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(alert.id, alert.userId, alert.reviewId, alert.type, alert.channel, alert.message);
  },

  findByUserId(userId, { limit = 20, unreadOnly = false } = {}) {
    let query = 'SELECT * FROM alerts WHERE user_id = ?';
    if (unreadOnly) query += ' AND is_read = 0';
    query += ' ORDER BY sent_at DESC LIMIT ?';
    return getDb().prepare(query).all(userId, limit);
  },

  markAsRead(id) {
    return getDb().prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
  },

  markAllAsRead(userId) {
    return getDb().prepare('UPDATE alerts SET is_read = 1 WHERE user_id = ?').run(userId);
  }
};

module.exports = { getDb, users, establishments, reviews, responses, alerts };
