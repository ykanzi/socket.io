/**
 * AvisGuard - Cron Jobs
 * - Fetch automatique des avis Google (toutes les heures)
 * - Calcul des stats quotidiennes (tous les jours à minuit)
 * - Refresh des tokens Google (tous les jours)
 */

const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { getDb, establishments, reviews } = require('../db/database');
const { analyzeSentiment } = require('./ai');

// --- Fetch Google Reviews (toutes les heures) ---
cron.schedule('0 * * * *', async () => {
  logger.info('[Cron] Fetch Google reviews started');
  try {
    const db = getDb();
    const googleEstablishments = db.prepare(
      'SELECT * FROM establishments WHERE google_access_token IS NOT NULL AND google_location_id IS NOT NULL'
    ).all();

    for (const est of googleEstablishments) {
      try {
        const googleService = require('./google');

        // Refresh token si nécessaire
        if (est.google_refresh_token) {
          try {
            const newTokens = await googleService.refreshAccessToken(est.google_refresh_token);
            if (newTokens.access_token) {
              db.prepare('UPDATE establishments SET google_access_token = ? WHERE id = ?')
                .run(newTokens.access_token, est.id);
              est.google_access_token = newTokens.access_token;
            }
          } catch (refreshErr) {
            logger.warn(`[Cron] Token refresh failed for ${est.name}`, { error: refreshErr.message });
          }
        }

        const googleReviews = await googleService.fetchReviews(
          est.google_access_token, est.google_account_id, est.google_location_id
        );

        let newCount = 0;
        for (const gr of (googleReviews || [])) {
          const existing = db.prepare('SELECT id FROM reviews WHERE platform_review_id = ? AND platform = ?')
            .get(gr.reviewId || gr.name, 'google');

          if (!existing) {
            const { sentiment, score } = analyzeSentiment(gr.starRating, gr.comment);
            reviews.create({
              id: uuidv4(),
              establishmentId: est.id,
              platform: 'google',
              platformReviewId: gr.reviewId || gr.name,
              authorName: gr.reviewer?.displayName || 'Client Google',
              authorAvatarUrl: gr.reviewer?.profilePhotoUrl || null,
              rating: gr.starRating || 0,
              text: gr.comment || '',
              language: 'fr',
              sentiment,
              sentimentScore: score,
              publishedAt: gr.createTime || new Date().toISOString()
            });
            newCount++;
          }
        }

        if (newCount > 0) {
          logger.info(`[Cron] ${newCount} nouveaux avis Google pour ${est.name}`);
        }
      } catch (estErr) {
        logger.error(`[Cron] Error fetching reviews for ${est.name}`, { error: estErr.message });
      }
    }
  } catch (error) {
    logger.error('[Cron] Google fetch error', { error: error.message });
  }
});

// --- Calcul des stats quotidiennes (tous les jours à 00:05) ---
cron.schedule('5 0 * * *', () => {
  logger.info('[Cron] Daily stats calculation started');
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const allEstablishments = db.prepare('SELECT id FROM establishments').all();

    for (const est of allEstablishments) {
      const stats = reviews.getStats(est.id);
      if (!stats || stats.total === 0) continue;

      const existing = db.prepare('SELECT id FROM daily_stats WHERE establishment_id = ? AND date = ?')
        .get(est.id, today);

      if (existing) {
        db.prepare(`
          UPDATE daily_stats SET total_reviews = ?, avg_rating = ?,
            positive_count = ?, neutral_count = ?, negative_count = ?,
            response_count = ?, response_rate = ?
          WHERE id = ?
        `).run(
          stats.total, stats.avg_rating,
          stats.positive || 0, stats.neutral || 0, stats.negative || 0,
          stats.replied || 0, stats.response_rate || 0,
          existing.id
        );
      } else {
        db.prepare(`
          INSERT INTO daily_stats (id, establishment_id, date, total_reviews, avg_rating,
            positive_count, neutral_count, negative_count, response_count, response_rate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(), est.id, today,
          stats.total, stats.avg_rating,
          stats.positive || 0, stats.neutral || 0, stats.negative || 0,
          stats.replied || 0, stats.response_rate || 0
        );
      }
    }
    logger.info(`[Cron] Daily stats calculated for ${allEstablishments.length} establishments`);
  } catch (error) {
    logger.error('[Cron] Daily stats error', { error: error.message });
  }
});

logger.info('[Cron] Jobs initialized: Google fetch (hourly), Daily stats (midnight)');

module.exports = {};
