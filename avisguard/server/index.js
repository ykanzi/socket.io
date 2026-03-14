const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Initialiser la base de données
const { getDb } = require('./db/database');
getDb();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Rendre io accessible dans les routes
app.io = io;

// Middleware
app.use(cors());

// Stripe webhook doit recevoir le body brut (avant express.json)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));
app.use('/landing', express.static(path.join(__dirname, '..', 'landing')));

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/billing', require('./routes/billing'));

// Route racine → landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'landing', 'index.html'));
});

// OAuth callbacks
app.get('/auth/google/callback', (req, res, next) => {
  require('./routes/platforms').handle(req, res, next);
});

// --- Socket.IO - Temps réel ---
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connecté: ${socket.id}`);

  // Rejoindre la room de l'utilisateur pour recevoir ses notifications
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} rejoint sa room`);
  });

  // L'extension Chrome envoie un nouvel avis détecté
  socket.on('extension:new_review', (data) => {
    console.log(`[Socket.IO] Nouvel avis détecté par l'extension:`, data.platform);
    // Broadcast vers le dashboard de l'utilisateur
    if (data.userId) {
      io.to(`user:${data.userId}`).emit('new_review', data);
    }
  });

  // Demande de génération de réponse IA depuis l'extension
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
      console.error('[Socket.IO] Generate response error:', error);
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client déconnecté: ${socket.id}`);
  });
});

// Démarrage du serveur
server.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║           🛡️  AvisGuard MVP              ║
  ║                                          ║
  ║  Serveur:    http://localhost:${config.port}      ║
  ║  Dashboard:  http://localhost:${config.port}/dashboard ║
  ║  API:        http://localhost:${config.port}/api   ║
  ║  Landing:    http://localhost:${config.port}/      ║
  ║                                          ║
  ║  Socket.IO:  Activé (temps réel)         ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
