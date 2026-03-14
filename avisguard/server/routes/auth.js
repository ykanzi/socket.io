const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { users, passwordResets, auditLogs } = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const logger = require('../services/logger');
const config = require('../config');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate('register'), async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const existing = users.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    users.create({ id, email, passwordHash, firstName, lastName, emailVerifyToken });
    const user = users.findById(id);
    const token = generateToken(user);

    // Envoyer email de vérification
    sendVerificationEmail(user, emailVerifyToken).catch(err =>
      logger.error('Email verification send error', { error: err.message })
    );

    auditLogs.log({ userId: id, action: 'register', resource: 'user', resourceId: id, ipAddress: req.ip });

    res.status(201).json({
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, plan: user.plan, role: user.role }
    });
  } catch (error) {
    logger.error('Register error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', validate('login'), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      auditLogs.log({ userId: user.id, action: 'login_failed', resource: 'user', resourceId: user.id, ipAddress: req.ip });
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = generateToken(user);
    auditLogs.log({ userId: user.id, action: 'login', resource: 'user', resourceId: user.id, ipAddress: req.ip });

    res.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, plan: user.plan, role: user.role }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  res.json({
    id: user.id, email: user.email,
    firstName: user.first_name, lastName: user.last_name,
    plan: user.plan, role: user.role, emailVerified: !!user.email_verified
  });
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const user = users.findByVerifyToken(token);
    if (!user) return res.status(400).json({ error: 'Token invalide ou déjà utilisé' });

    users.verifyEmail(user.id);
    auditLogs.log({ userId: user.id, action: 'email_verified', resource: 'user', resourceId: user.id });

    // Rediriger vers le dashboard avec message de succès
    res.redirect('/dashboard?verified=true');
  } catch (error) {
    logger.error('Verify email error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', validate('forgotPassword'), async (req, res) => {
  try {
    const { email } = req.body;
    const user = users.findByEmail(email);

    // Toujours répondre succès pour ne pas révéler si l'email existe
    if (!user) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    passwordResets.create({ id: uuidv4(), userId: user.id, token, expiresAt });
    auditLogs.log({ userId: user.id, action: 'password_reset_requested', resource: 'user', resourceId: user.id, ipAddress: req.ip });

    sendPasswordResetEmail(user, token).catch(err =>
      logger.error('Password reset email error', { error: err.message })
    );

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    logger.error('Forgot password error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validate('resetPassword'), async (req, res) => {
  try {
    const { token, password } = req.body;

    const resetRecord = passwordResets.findByToken(token);
    if (!resetRecord) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { getDb } = require('../db/database');
    getDb().prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, resetRecord.user_id);

    passwordResets.markUsed(resetRecord.id);
    auditLogs.log({ userId: resetRecord.user_id, action: 'password_reset', resource: 'user', resourceId: resetRecord.user_id, ipAddress: req.ip });

    res.json({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (error) {
    logger.error('Reset password error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/auth/account — Suppression du compte (RGPD droit à l'oubli)
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    auditLogs.log({ userId: req.user.id, action: 'account_deleted', resource: 'user', resourceId: req.user.id, ipAddress: req.ip });
    users.deleteUser(req.user.id);
    res.json({ message: 'Compte supprimé. Toutes vos données ont été effacées.' });
  } catch (error) {
    logger.error('Delete account error', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Email helpers ---
async function sendVerificationEmail(user, token) {
  const nodemailer = require('nodemailer');
  if (!config.smtp.user || !config.smtp.pass) {
    logger.info('SMTP non configuré, email de vérification non envoyé');
    return;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const transporter = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });

  await transporter.sendMail({
    from: `"AvisGuard" <${config.smtp.user}>`,
    to: user.email,
    subject: 'AvisGuard — Vérifiez votre email',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#2563eb;">Bienvenue sur AvisGuard !</h2>
        <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
        <a href="${baseUrl}/api/auth/verify-email?token=${token}"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Vérifier mon email
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">Ce lien est valide une seule fois.</p>
      </div>
    `
  });
}

async function sendPasswordResetEmail(user, token) {
  const nodemailer = require('nodemailer');
  if (!config.smtp.user || !config.smtp.pass) {
    logger.info('SMTP non configuré, email de reset non envoyé');
    return;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const transporter = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });

  await transporter.sendMail({
    from: `"AvisGuard" <${config.smtp.user}>`,
    to: user.email,
    subject: 'AvisGuard — Réinitialisation de mot de passe',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#2563eb;">Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
        <a href="${baseUrl}/dashboard?reset-token=${token}"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      </div>
    `
  });
}

module.exports = router;
