/**
 * AvisGuard - Routes Admin
 * Gestion des utilisateurs, stats globales, audit, modération
 */

const express = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { users, establishments, reviews, responses, auditLogs, monthlyUsage, getDb } = require('../db/database');
const logger = require('../services/logger');

const router = express.Router();

// GET /api/admin/dashboard — Stats globales plateforme
router.get('/dashboard', adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalEstablishments = db.prepare('SELECT COUNT(*) as count FROM establishments').get().count;
    const totalReviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get().count;
    const totalResponses = db.prepare('SELECT COUNT(*) as count FROM responses').get().count;
    const totalAiResponses = db.prepare("SELECT COUNT(*) as count FROM responses WHERE generated_by = 'ai'").get().count;

    const planBreakdown = db.prepare('SELECT plan, COUNT(*) as count FROM users GROUP BY plan').all();
    const recentUsers = db.prepare('SELECT id, email, first_name, last_name, plan, role, created_at FROM users ORDER BY created_at DESC LIMIT 10').all();

    const reviewsToday = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE fetched_at >= date('now')").get().count;
    const responsesToday = db.prepare("SELECT COUNT(*) as count FROM responses WHERE created_at >= date('now')").get().count;

    const reviewsByPlatform = db.prepare('SELECT platform, COUNT(*) as count FROM reviews GROUP BY platform ORDER BY count DESC').all();

    res.json({
      stats: {
        totalUsers,
        totalEstablishments,
        totalReviews,
        totalResponses,
        totalAiResponses,
        reviewsToday,
        responsesToday
      },
      planBreakdown,
      reviewsByPlatform,
      recentUsers
    });
  } catch (error) {
    logger.error('Admin dashboard error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/users — Liste de tous les utilisateurs
router.get('/users', adminMiddleware, (req, res) => {
  try {
    const { limit, offset } = req.query;
    const userList = users.findAll({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    const total = users.count();
    res.json({ users: userList, total });
  } catch (error) {
    logger.error('Admin list users error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/users/:userId — Détails d'un utilisateur
router.get('/users/:userId', adminMiddleware, (req, res) => {
  try {
    const user = users.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const userEstablishments = establishments.findByUserId(user.id);
    const usage = monthlyUsage.getOrCreate(user.id, getCurrentMonth());
    const logs = auditLogs.findByUser(user.id, 20);

    // Compter les avis et réponses totales
    const db = getDb();
    const estIds = userEstablishments.map(e => e.id);
    let totalReviewsUser = 0;
    let totalResponsesUser = 0;
    for (const estId of estIds) {
      totalReviewsUser += db.prepare('SELECT COUNT(*) as count FROM reviews WHERE establishment_id = ?').get(estId).count;
      const reviewIds = db.prepare('SELECT id FROM reviews WHERE establishment_id = ?').all(estId).map(r => r.id);
      for (const rid of reviewIds) {
        totalResponsesUser += db.prepare('SELECT COUNT(*) as count FROM responses WHERE review_id = ?').get(rid).count;
      }
    }

    res.json({
      user: {
        id: user.id, email: user.email,
        firstName: user.first_name, lastName: user.last_name,
        role: user.role, plan: user.plan,
        emailVerified: !!user.email_verified,
        stripeCustomerId: user.stripe_customer_id,
        createdAt: user.created_at
      },
      establishments: userEstablishments,
      usage,
      totalReviews: totalReviewsUser,
      totalResponses: totalResponsesUser,
      recentLogs: logs
    });
  } catch (error) {
    logger.error('Admin user detail error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/users/:userId/plan — Changer le plan d'un utilisateur
router.put('/users/:userId/plan', adminMiddleware, (req, res) => {
  try {
    const { plan } = req.body;
    if (!['starter', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide' });
    }
    users.updatePlan(req.params.userId, plan);
    auditLogs.log({ userId: req.user.id, action: 'admin_change_plan', resource: 'user', resourceId: req.params.userId, details: `Plan → ${plan}`, ipAddress: req.ip });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/users/:userId/role — Changer le rôle d'un utilisateur
router.put('/users/:userId/role', adminMiddleware, (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    users.updateRole(req.params.userId, role);
    auditLogs.log({ userId: req.user.id, action: 'admin_change_role', resource: 'user', resourceId: req.params.userId, details: `Role → ${role}`, ipAddress: req.ip });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/users/:userId — Supprimer un utilisateur
router.delete('/users/:userId', adminMiddleware, (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte admin' });
    }
    auditLogs.log({ userId: req.user.id, action: 'admin_delete_user', resource: 'user', resourceId: req.params.userId, ipAddress: req.ip });
    users.deleteUser(req.params.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/audit-logs — Journal d'audit
router.get('/audit-logs', adminMiddleware, (req, res) => {
  try {
    const { limit, offset } = req.query;
    const logs = auditLogs.findAll({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reviews/recent — Derniers avis sur la plateforme
router.get('/reviews/recent', adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const recentReviews = db.prepare(`
      SELECT r.*, e.name as establishment_name, u.email as owner_email
      FROM reviews r
      JOIN establishments e ON r.establishment_id = e.id
      JOIN users u ON e.user_id = u.id
      ORDER BY r.fetched_at DESC LIMIT 20
    `).all();
    res.json({ reviews: recentReviews });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = router;
