const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { reviews, establishments, responses, alerts } = require('../db/database');
const { generateReviewResponse, analyzeSentiment } = require('../services/ai');
const { notifyNewReview, notifyResponsePublished } = require('../services/notifications');

const router = express.Router();

// GET /api/reviews/:establishmentId — Liste des avis
router.get('/:establishmentId', authMiddleware, (req, res) => {
  try {
    const establishment = establishments.findById(req.params.establishmentId);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    const { platform, sentiment, limit, offset } = req.query;
    const reviewList = reviews.findByEstablishment(req.params.establishmentId, {
      platform, sentiment,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({ reviews: reviewList });
  } catch (error) {
    console.error('[Reviews] List error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/reviews/:establishmentId/stats — Statistiques
router.get('/:establishmentId/stats', authMiddleware, (req, res) => {
  try {
    const establishment = establishments.findById(req.params.establishmentId);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    const stats = reviews.getStats(req.params.establishmentId);
    const byPlatform = reviews.getStatsByPlatform(req.params.establishmentId);

    res.json({ stats, byPlatform });
  } catch (error) {
    console.error('[Reviews] Stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/reviews/:establishmentId/unreplied — Avis sans réponse
router.get('/:establishmentId/unreplied', authMiddleware, (req, res) => {
  try {
    const establishment = establishments.findById(req.params.establishmentId);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    const unreplied = reviews.findUnreplied(req.params.establishmentId);
    res.json({ reviews: unreplied });
  } catch (error) {
    console.error('[Reviews] Unreplied error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/reviews/add — Ajouter un avis manuellement (ou depuis l'extension)
router.post('/add', authMiddleware, (req, res) => {
  try {
    const { establishmentId, platform, authorName, rating, text, platformReviewId, publishedAt } = req.body;

    const establishment = establishments.findById(establishmentId);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    const { sentiment, score } = analyzeSentiment(rating, text);
    const id = uuidv4();

    reviews.create({
      id,
      establishmentId,
      platform: platform || 'other',
      platformReviewId: platformReviewId || null,
      authorName,
      authorAvatarUrl: null,
      rating,
      text,
      language: 'fr',
      sentiment,
      sentimentScore: score,
      publishedAt: publishedAt || new Date().toISOString()
    });

    const review = reviews.findById(id);

    // Notifier via Socket.IO + email
    if (req.app.io) {
      req.app.io.to(`user:${req.user.id}`).emit('new_review', review);
      notifyNewReview(req.app.io, review, establishment).catch(err =>
        console.error('[Reviews] Notification error:', err)
      );
    }

    res.status(201).json({ review });
  } catch (error) {
    console.error('[Reviews] Add error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/reviews/:reviewId/generate-response — Générer une réponse IA
router.post('/:reviewId/generate-response', authMiddleware, async (req, res) => {
  try {
    const review = reviews.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: 'Avis non trouvé' });

    const establishment = establishments.findById(review.establishment_id);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const aiResponse = await generateReviewResponse(review, establishment);
    const id = uuidv4();

    responses.create({
      id,
      reviewId: review.id,
      text: aiResponse.text,
      generatedBy: aiResponse.generatedBy,
      status: 'draft'
    });

    res.json({
      response: {
        id,
        text: aiResponse.text,
        generatedBy: aiResponse.generatedBy,
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed
      }
    });
  } catch (error) {
    console.error('[Reviews] Generate response error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/reviews/:reviewId/publish-response — Publier une réponse
router.post('/:reviewId/publish-response', authMiddleware, async (req, res) => {
  try {
    const { responseId, text } = req.body;
    const review = reviews.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: 'Avis non trouvé' });

    const establishment = establishments.findById(review.establishment_id);
    if (!establishment || establishment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Si une réponse existante est fournie, la mettre à jour
    if (responseId) {
      responses.updateStatus(responseId, 'published');
    } else if (text) {
      // Sinon créer une nouvelle réponse manuelle
      const id = uuidv4();
      responses.create({ id, reviewId: review.id, text, generatedBy: 'human', status: 'published' });
    }

    reviews.markAsReplied(review.id);

    // Publier sur la plateforme si possible (Google, Facebook)
    let publishResult = { success: true, method: 'manual' };
    if (review.platform === 'google' && establishment.google_access_token) {
      const googleService = require('../services/google');
      publishResult = await googleService.replyToReview(
        establishment.google_access_token,
        establishment.google_account_id,
        establishment.google_location_id,
        review.platform_review_id,
        text || (responseId && responses.findByReviewId(review.id)[0]?.text)
      );
      publishResult.method = 'api';
    }

    // Notifier via Socket.IO + alerte
    if (req.app.io) {
      req.app.io.to(`user:${req.user.id}`).emit('response_published', {
        reviewId: review.id,
        platform: review.platform,
        method: publishResult.method
      });
      notifyResponsePublished(req.app.io, review, establishment, publishResult.method).catch(err =>
        console.error('[Reviews] Notification error:', err)
      );
    }

    res.json({ success: true, publishResult });
  } catch (error) {
    console.error('[Reviews] Publish response error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/reviews/:reviewId/read — Marquer comme lu
router.put('/:reviewId/read', authMiddleware, (req, res) => {
  reviews.markAsRead(req.params.reviewId);
  res.json({ success: true });
});

module.exports = router;
