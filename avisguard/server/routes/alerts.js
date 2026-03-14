/**
 * AvisGuard - Routes Alertes/Notifications
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { alerts } = require('../db/database');

const router = express.Router();

// GET /api/alerts — Liste des alertes de l'utilisateur
router.get('/', authMiddleware, (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;
    const alertList = alerts.findByUserId(req.user.id, {
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true'
    });
    const unreadCount = alerts.findByUserId(req.user.id, { unreadOnly: true }).length;

    res.json({ alerts: alertList, unreadCount });
  } catch (error) {
    console.error('[Alerts] List error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/alerts/:alertId/read — Marquer une alerte comme lue
router.put('/:alertId/read', authMiddleware, (req, res) => {
  try {
    alerts.markAsRead(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/alerts/read-all — Marquer toutes les alertes comme lues
router.put('/read-all', authMiddleware, (req, res) => {
  try {
    alerts.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
