/**
 * AvisGuard - Middleware de quota par plan
 * Vérifie les limites avant chaque action (ajout avis, génération IA, création établissement)
 */

const { monthlyUsage, establishments } = require('../db/database');

const PLAN_LIMITS = {
  starter: { reviewsPerMonth: 50, aiResponsesPerMonth: 20, maxEstablishments: 1 },
  pro:     { reviewsPerMonth: 500, aiResponsesPerMonth: -1, maxEstablishments: 5 },
  premium: { reviewsPerMonth: -1, aiResponsesPerMonth: -1, maxEstablishments: -1 }
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function checkReviewQuota(req, res, next) {
  const plan = req.user.plan || 'starter';
  const limits = PLAN_LIMITS[plan];

  if (limits.reviewsPerMonth === -1) return next();

  const month = getCurrentMonth();
  const usage = monthlyUsage.getOrCreate(req.user.id, month);

  if (usage.reviews_count >= limits.reviewsPerMonth) {
    return res.status(429).json({
      error: `Limite de ${limits.reviewsPerMonth} avis/mois atteinte (plan ${plan}). Passez au plan supérieur.`,
      upgradeRequired: true
    });
  }

  next();
}

function checkAiQuota(req, res, next) {
  const plan = req.user.plan || 'starter';
  const limits = PLAN_LIMITS[plan];

  if (limits.aiResponsesPerMonth === -1) return next();

  const month = getCurrentMonth();
  const usage = monthlyUsage.getOrCreate(req.user.id, month);

  if (usage.ai_responses_count >= limits.aiResponsesPerMonth) {
    return res.status(429).json({
      error: `Limite de ${limits.aiResponsesPerMonth} réponses IA/mois atteinte (plan ${plan}). Passez au plan supérieur.`,
      upgradeRequired: true
    });
  }

  next();
}

function checkEstablishmentQuota(req, res, next) {
  const plan = req.user.plan || 'starter';
  const limits = PLAN_LIMITS[plan];

  if (limits.maxEstablishments === -1) return next();

  const userEstablishments = establishments.findByUserId(req.user.id);

  if (userEstablishments.length >= limits.maxEstablishments) {
    return res.status(429).json({
      error: `Limite de ${limits.maxEstablishments} établissement(s) atteinte (plan ${plan}). Passez au plan supérieur.`,
      upgradeRequired: true
    });
  }

  next();
}

module.exports = { checkReviewQuota, checkAiQuota, checkEstablishmentQuota, PLAN_LIMITS, getCurrentMonth };
