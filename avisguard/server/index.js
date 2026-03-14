const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const logger = require('./services/logger');
const { helmetMiddleware, globalLimiter, sanitizeBody, getCorsOptions } = require('./middleware/security');

// Initialiser la base de données
const { getDb } = require('./db/database');
getDb();

const app = express();
const server = http.createServer(app);

const corsOptions = getCorsOptions();
const io = new Server(server, { cors: corsOptions });

// Rendre io accessible dans les routes
app.io = io;

// Middleware de sécurité
app.use(helmetMiddleware);
app.use(cors(corsOptions));
app.use(globalLimiter);

// Stripe webhook doit recevoir le body brut (avant express.json)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody);

// Fichiers statiques
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/landing', express.static(path.join(__dirname, '..', 'landing')));
app.use('/legal', express.static(path.join(__dirname, '..', 'legal')));

// Favicon & robots.txt
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard/\nDisallow: /admin/\nSitemap: ' + (process.env.BASE_URL || 'http://localhost:3000') + '/sitemap.xml');
});
app.get('/sitemap.xml', (req, res) => {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><priority>1.0</priority></url>
  <url><loc>${base}/legal/cgu.html</loc><priority>0.3</priority></url>
  <url><loc>${base}/legal/privacy.html</loc><priority>0.3</priority></url>
  <url><loc>${base}/legal/mentions-legales.html</loc><priority>0.3</priority></url>
</urlset>`);
});

// Routes API
const { authLimiter, aiLimiter } = require('./middleware/security');
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/admin', require('./routes/admin'));

// Route racine → landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'landing', 'index.html'));
});

// OAuth callbacks
app.get('/auth/google/callback', (req, res, next) => {
  require('./routes/platforms').handle(req, res, next);
});

// Gestion d'erreurs globale
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// --- Socket.IO - Temps réel ---
io.on('connection', (socket) => {
  logger.info(`Socket.IO client connecté: ${socket.id}`);

  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('extension:new_review', (data) => {
    logger.info(`Nouvel avis détecté par l'extension: ${data.platform}`);
    if (data.userId) {
      io.to(`user:${data.userId}`).emit('new_review', data);
    }
  });

  socket.on('extension:generate_response', async (data, callback) => {
    try {
      const { generateReviewResponse } = require('./services/ai');
      const { establishments } = require('./db/database');

      const establishment = establishments.findById(data.establishmentId);
      if (!establishment) {
        return callback({ error: 'Établissement non trouvé' });
      }

      const response = await generateReviewResponse(data.review, establishment);
      callback({ success: true, response });
    } catch (error) {
      logger.error('Socket.IO generate response error', { error: error.message });
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket.IO client déconnecté: ${socket.id}`);
  });
});

// --- Cron Jobs ---
require('./services/cron');

// Démarrage du serveur
server.listen(config.port, () => {
  logger.info(`AvisGuard démarré sur le port ${config.port}`);
  console.log(`
  ╔══════════════════════════════════════════╗
  ║           AvisGuard MVP                  ║
  ║                                          ║
  ║  Serveur:    http://localhost:${config.port}      ║
  ║  Dashboard:  http://localhost:${config.port}/dashboard ║
  ║  Admin:      http://localhost:${config.port}/admin     ║
  ║  API:        http://localhost:${config.port}/api   ║
  ║  Landing:    http://localhost:${config.port}/      ║
  ║                                          ║
  ║  Socket.IO:  Activé (temps réel)         ║
  ║  Cron Jobs:  Activés                     ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
