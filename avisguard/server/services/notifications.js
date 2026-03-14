/**
 * AvisGuard - Service de notifications
 * Gère les alertes temps réel (Socket.IO + email) pour les nouveaux avis
 */

const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const config = require('../config');
const { alerts, users, establishments } = require('../db/database');

let transporter = null;

// Initialiser le transporteur email
function getTransporter() {
  if (!transporter && config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  return transporter;
}

/**
 * Notifier un nouvel avis (Socket.IO + email + in_app)
 */
async function notifyNewReview(io, review, establishment) {
  const user = users.findById(establishment.user_id);
  if (!user) return;

  const isNegative = review.sentiment === 'negative' || review.rating <= 2;
  const type = isNegative ? 'negative_review' : 'new_review';

  const starDisplay = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const message = isNegative
    ? `Avis négatif ${starDisplay} de ${review.author_name || 'Client'} sur ${review.platform} — "${(review.text || '').substring(0, 100)}"`
    : `Nouvel avis ${starDisplay} de ${review.author_name || 'Client'} sur ${review.platform}`;

  // 1. Alerte in-app (stockée en BDD)
  const alertId = uuidv4();
  alerts.create({
    id: alertId,
    userId: user.id,
    reviewId: review.id,
    type,
    channel: 'in_app',
    message
  });

  // 2. Socket.IO temps réel
  if (io) {
    io.to(`user:${user.id}`).emit('notification', {
      id: alertId,
      type,
      message,
      review: {
        id: review.id,
        platform: review.platform,
        rating: review.rating,
        authorName: review.author_name,
        text: review.text
      },
      timestamp: new Date().toISOString()
    });

    // Mettre à jour le compteur de notifications non lues
    const unread = alerts.findByUserId(user.id, { unreadOnly: true });
    io.to(`user:${user.id}`).emit('unread_count', { count: unread.length });
  }

  // 3. Email pour les avis négatifs (ou si configuré)
  if (isNegative || establishment.auto_reply_positive === 0) {
    await sendEmailNotification(user, review, establishment, type);
  }
}

/**
 * Notifier qu'une réponse a été publiée
 */
async function notifyResponsePublished(io, review, establishment, method) {
  const user = users.findById(establishment.user_id);
  if (!user) return;

  const alertId = uuidv4();
  const message = `Réponse publiée sur ${review.platform} (via ${method}) pour l'avis de ${review.author_name || 'Client'}`;

  alerts.create({
    id: alertId,
    userId: user.id,
    reviewId: review.id,
    type: 'response_published',
    channel: 'in_app',
    message
  });

  if (io) {
    io.to(`user:${user.id}`).emit('notification', {
      id: alertId,
      type: 'response_published',
      message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Envoyer un email de notification
 */
async function sendEmailNotification(user, review, establishment, type) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log('[Notifications] SMTP non configuré, email non envoyé');
    return;
  }

  const starDisplay = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const isNegative = type === 'negative_review';

  const subject = isNegative
    ? `⚠️ Avis négatif sur ${review.platform} — ${establishment.name}`
    : `Nouvel avis ${review.rating}/5 sur ${review.platform} — ${establishment.name}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${isNegative ? '#dc2626' : '#2563eb'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">AvisGuard</h2>
        <p style="margin: 4px 0 0; opacity: 0.9;">
          ${isNegative ? 'Avis négatif détecté' : 'Nouvel avis reçu'}
        </p>
      </div>

      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 16px;">
          <strong>${review.author_name || 'Client anonyme'}</strong>
          <span style="color: #6b7280; margin-left: 8px;">${review.platform}</span>
        </div>

        <div style="font-size: 20px; margin-bottom: 12px;">${starDisplay}</div>

        ${review.text ? `<p style="color: #374151; line-height: 1.6; background: #f9fafb; padding: 12px; border-radius: 6px;">"${review.text}"</p>` : ''}

        <div style="margin-top: 20px;">
          <a href="${config.google.redirectUri?.replace('/auth/google/callback', '')}/dashboard"
             style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Répondre maintenant
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
          Établissement: ${establishment.name}
        </p>
      </div>
    </div>
  `;

  try {
    await mailer.sendMail({
      from: `"AvisGuard" <${config.smtp.user}>`,
      to: user.email,
      subject,
      html
    });
    console.log(`[Notifications] Email envoyé à ${user.email}`);

    // Stocker l'alerte email
    alerts.create({
      id: uuidv4(),
      userId: user.id,
      reviewId: review.id,
      type,
      channel: 'email',
      message: subject
    });
  } catch (error) {
    console.error('[Notifications] Erreur envoi email:', error.message);
  }
}

module.exports = {
  notifyNewReview,
  notifyResponsePublished,
  sendEmailNotification
};
