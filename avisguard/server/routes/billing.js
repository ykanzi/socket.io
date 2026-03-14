/**
 * AvisGuard - Routes Billing (Stripe)
 * Gère les abonnements : starter (gratuit), pro (29€/mois), premium (79€/mois)
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { users } = require('../db/database');
const config = require('../config');

const router = express.Router();

// Plans AvisGuard
const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    reviewsPerMonth: 50,
    establishments: 1,
    aiResponses: 20,
    features: ['1 établissement', '50 avis/mois', '20 réponses IA', 'Extension Chrome']
  },
  pro: {
    name: 'Pro',
    price: 2900, // centimes
    priceId: process.env.STRIPE_PRICE_PRO,
    reviewsPerMonth: 500,
    establishments: 5,
    aiResponses: -1, // illimité
    features: ['5 établissements', '500 avis/mois', 'Réponses IA illimitées', 'API Google & Facebook', 'Alertes email', 'Support prioritaire']
  },
  premium: {
    name: 'Premium',
    price: 7900,
    priceId: process.env.STRIPE_PRICE_PREMIUM,
    reviewsPerMonth: -1,
    establishments: -1,
    aiResponses: -1,
    features: ['Établissements illimités', 'Avis illimités', 'Réponses IA illimitées', 'Toutes les plateformes', 'Auto-réponse', 'Rapport hebdomadaire', 'Support dédié']
  }
};

// GET /api/billing/plans — Liste des plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/billing/status — Statut abonnement
router.get('/status', authMiddleware, (req, res) => {
  const user = users.findById(req.user.id);
  const plan = PLANS[user.plan] || PLANS.starter;

  res.json({
    currentPlan: user.plan,
    planDetails: plan,
    stripeCustomerId: user.stripe_customer_id
  });
});

// POST /api/billing/create-checkout — Créer une session Stripe Checkout
router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    if (!config.stripe.secretKey) {
      return res.status(503).json({ error: 'Paiement non configuré. Ajoutez STRIPE_SECRET_KEY dans .env' });
    }

    const stripe = require('stripe')(config.stripe.secretKey);
    const { plan } = req.body;

    if (!plan || !PLANS[plan] || plan === 'starter') {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    const planConfig = PLANS[plan];
    if (!planConfig.priceId) {
      return res.status(400).json({ error: 'Price ID Stripe non configuré pour ce plan' });
    }

    const user = users.findById(req.user.id);

    // Créer ou récupérer le customer Stripe
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      // Sauvegarder le customer ID
      const { getDb } = require('../db/database');
      getDb().prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: planConfig.priceId,
        quantity: 1
      }],
      success_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard?billing=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard?billing=cancel`,
      metadata: {
        userId: user.id,
        plan
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[Billing] Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/portal — Portail client Stripe (gérer abonnement)
router.post('/portal', authMiddleware, async (req, res) => {
  try {
    if (!config.stripe.secretKey) {
      return res.status(503).json({ error: 'Paiement non configuré' });
    }

    const stripe = require('stripe')(config.stripe.secretKey);
    const user = users.findById(req.user.id);

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun abonnement actif' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[Billing] Portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/webhook — Webhook Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    return res.status(503).send('Not configured');
  }

  const stripe = require('stripe')(config.stripe.secretKey);
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    console.error('[Billing] Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const plan = session.metadata.plan;
      if (userId && plan) {
        users.updatePlan(userId, plan);
        console.log(`[Billing] User ${userId} upgraded to ${plan}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      // Retrouver l'utilisateur par customer ID et downgrader
      const { getDb } = require('../db/database');
      const user = getDb().prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
      if (user) {
        users.updatePlan(user.id, 'starter');
        console.log(`[Billing] User ${user.id} downgraded to starter (subscription cancelled)`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.warn(`[Billing] Payment failed for customer ${invoice.customer}`);
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
