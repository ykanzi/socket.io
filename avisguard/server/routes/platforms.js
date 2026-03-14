const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { establishments } = require('../db/database');
const googleService = require('../services/google');

const router = express.Router();

// --- Établissements ---

// POST /api/platforms/establishments — Créer un établissement
router.post('/establishments', authMiddleware, (req, res) => {
  try {
    const { name, address, city, category } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });

    const id = uuidv4();
    establishments.create({ id, userId: req.user.id, name, address, city, category });

    res.status(201).json({ establishment: establishments.findById(id) });
  } catch (error) {
    console.error('[Platforms] Create establishment error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platforms/establishments — Liste des établissements
router.get('/establishments', authMiddleware, (req, res) => {
  const list = establishments.findByUserId(req.user.id);
  res.json({ establishments: list });
});

// GET /api/platforms/establishments/:id — Détail d'un établissement
router.get('/establishments/:id', authMiddleware, (req, res) => {
  const est = establishments.findById(req.params.id);
  if (!est || est.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Établissement non trouvé' });
  }
  res.json({ establishment: est });
});

// PUT /api/platforms/establishments/:id/ai-settings — Paramètres IA
router.put('/establishments/:id/ai-settings', authMiddleware, (req, res) => {
  try {
    const est = establishments.findById(req.params.id);
    if (!est || est.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    const { tone, language, signature, useTu, autoReplyPositive, autoReplyNegative } = req.body;
    establishments.updateAiSettings(req.params.id, {
      tone: tone || 'professionnel',
      language: language || 'fr',
      signature: signature || '',
      useTu: useTu || 'vous',
      autoReplyPositive: autoReplyPositive !== undefined ? autoReplyPositive : true,
      autoReplyNegative: autoReplyNegative !== undefined ? autoReplyNegative : false
    });

    res.json({ success: true, establishment: establishments.findById(req.params.id) });
  } catch (error) {
    console.error('[Platforms] AI settings error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Google Business ---

// GET /api/platforms/google/auth-url — URL d'autorisation Google
router.get('/google/auth-url', authMiddleware, (req, res) => {
  const { establishmentId } = req.query;
  if (!establishmentId) return res.status(400).json({ error: 'establishmentId requis' });

  const state = JSON.stringify({ userId: req.user.id, establishmentId });
  const url = googleService.getAuthUrl(state);

  res.json({ url });
});

// GET /api/platforms/google/callback — Callback OAuth Google
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { userId, establishmentId } = JSON.parse(state);

    const tokens = await googleService.getTokensFromCode(code);

    // Sauvegarder les tokens
    establishments.updateGoogleTokens(establishmentId, {
      accountId: null, // sera mis à jour après listLocations
      locationId: null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    });

    // Récupérer les locations
    const locations = await googleService.listLocations(tokens.access_token);

    res.send(`
      <html><body>
        <h2>Connexion Google réussie !</h2>
        <p>Vous pouvez fermer cette fenêtre et retourner au dashboard.</p>
        <script>
          window.opener && window.opener.postMessage({
            type: 'google_connected',
            locations: ${JSON.stringify(locations)}
          }, '*');
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `);
  } catch (error) {
    console.error('[Google] OAuth callback error:', error);
    res.status(500).send('Erreur de connexion Google');
  }
});

// POST /api/platforms/google/select-location — Sélectionner un établissement Google
router.post('/google/select-location', authMiddleware, (req, res) => {
  try {
    const { establishmentId, accountId, locationId } = req.body;

    const est = establishments.findById(establishmentId);
    if (!est || est.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    establishments.updateGoogleTokens(establishmentId, {
      accountId,
      locationId,
      accessToken: est.google_access_token,
      refreshToken: est.google_refresh_token
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Google] Select location error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/platforms/google/fetch-reviews — Récupérer les avis Google
router.post('/google/fetch-reviews', authMiddleware, async (req, res) => {
  try {
    const { establishmentId } = req.body;
    const est = establishments.findById(establishmentId);
    if (!est || est.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Établissement non trouvé' });
    }

    if (!est.google_access_token) {
      return res.status(400).json({ error: 'Google Business non connecté' });
    }

    const googleReviews = await googleService.fetchReviews(
      est.google_access_token,
      est.google_account_id,
      est.google_location_id
    );

    res.json({ reviews: googleReviews, count: googleReviews.length });
  } catch (error) {
    console.error('[Google] Fetch reviews error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
