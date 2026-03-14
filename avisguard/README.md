# AvisGuard

SaaS de gestion et de reponse aux avis clients assiste par IA pour le marche francophone.

## Fonctionnalites

- **Dashboard centralise** — Tous vos avis Google, Facebook, TripAdvisor, Pages Jaunes en un seul endroit
- **Reponses IA** — Generation automatique via Claude (Anthropic) avec ton personnalise
- **Extension Chrome** — Repondre directement depuis n'importe quelle plateforme d'avis
- **Publication API** — Reponse automatique via Google Business et Facebook Graph API
- **Alertes temps reel** — Notifications Socket.IO + email pour chaque nouvel avis
- **Admin Panel** — Gestion des utilisateurs, stats, audit, moderation
- **Abonnements Stripe** — Plans starter (gratuit), pro (29 euros/mois), premium (79 euros/mois)

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Backend | Express.js + Socket.IO |
| Base de donnees | SQLite (better-sqlite3) |
| IA | Claude API (Anthropic) |
| Auth | JWT + bcryptjs |
| Paiements | Stripe Checkout + Webhooks |
| Google | Google Business Profile API (OAuth 2.0) |
| Securite | Helmet, rate limiting, Joi validation, sanitize-html |
| Logs | Winston |
| Cron | node-cron |
| Frontend | HTML/CSS/JS vanilla |

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd avisguard

# Installer les dependances
npm install

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos cles API

# Charger les donnees de demo
node scripts/seed.js

# Demarrer le serveur
npm start
```

## Configuration (.env)

| Variable | Description | Requis |
|----------|-------------|--------|
| `PORT` | Port du serveur (defaut: 3000) | Non |
| `JWT_SECRET` | Secret pour les tokens JWT | Oui (production) |
| `ANTHROPIC_API_KEY` | Cle API Claude pour l'IA | Oui |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Pour Google |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | Pour Google |
| `SMTP_HOST` | Serveur SMTP pour les emails | Pour emails |
| `SMTP_USER` | Email SMTP | Pour emails |
| `SMTP_PASS` | Mot de passe SMTP | Pour emails |
| `STRIPE_SECRET_KEY` | Cle secrete Stripe | Pour paiements |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe | Pour paiements |

## URLs

| Page | URL |
|------|-----|
| Landing page | http://localhost:3000/ |
| Dashboard client | http://localhost:3000/dashboard |
| Admin panel | http://localhost:3000/admin |
| API | http://localhost:3000/api |

## Comptes de demo (apres seed)

| Role | Email | Mot de passe |
|------|-------|-------------|
| Admin | admin@avisguard.fr | admin123 |
| User | demo@avisguard.fr | demo123 |

## API Endpoints

### Auth
- `POST /api/auth/register` — Inscription
- `POST /api/auth/login` — Connexion
- `GET /api/auth/me` — Profil utilisateur
- `GET /api/auth/verify-email?token=` — Verification email
- `POST /api/auth/forgot-password` — Mot de passe oublie
- `POST /api/auth/reset-password` — Reinitialiser mot de passe
- `DELETE /api/auth/account` — Supprimer le compte (RGPD)

### Reviews
- `GET /api/reviews/:estId` — Liste des avis (filtres: platform, sentiment)
- `GET /api/reviews/:estId/stats` — Statistiques
- `GET /api/reviews/:estId/unreplied` — Avis sans reponse
- `GET /api/reviews/:estId/export` — Export CSV
- `POST /api/reviews/add` — Ajouter un avis
- `POST /api/reviews/:id/generate-response` — Generer reponse IA
- `POST /api/reviews/:id/publish-response` — Publier une reponse

### Platforms
- `GET /api/platforms/establishments` — Liste des etablissements
- `POST /api/platforms/establishments` — Creer un etablissement
- `PUT /api/platforms/establishments/:id/ai-settings` — Parametres IA
- `GET /api/platforms/google/auth-url` — URL OAuth Google

### Billing
- `GET /api/billing/plans` — Plans disponibles
- `GET /api/billing/status` — Statut abonnement
- `POST /api/billing/create-checkout` — Creer session Stripe
- `POST /api/billing/portal` — Portail client Stripe

### Admin
- `GET /api/admin/dashboard` — Stats globales
- `GET /api/admin/users` — Liste utilisateurs
- `GET /api/admin/users/:id` — Detail utilisateur
- `PUT /api/admin/users/:id/plan` — Changer plan
- `PUT /api/admin/users/:id/role` — Changer role
- `DELETE /api/admin/users/:id` — Supprimer utilisateur
- `GET /api/admin/audit-logs` — Journal d'audit

### Alerts
- `GET /api/alerts` — Liste des notifications
- `PUT /api/alerts/:id/read` — Marquer comme lue
- `PUT /api/alerts/read-all` — Tout marquer comme lu

## Extension Chrome

L'extension se trouve dans `extension/`. Pour l'installer en mode developpeur :

1. Ouvrir `chrome://extensions/`
2. Activer "Mode developpeur"
3. Cliquer "Charger l'extension non empaquetee"
4. Selectionner le dossier `extension/`

## Docker

```bash
docker-compose up -d
```

## Structure du projet

```
avisguard/
  server/              # Backend Express.js
    config.js          # Configuration centralisee
    index.js           # Point d'entree serveur
    db/                # Base de donnees SQLite
    middleware/         # Auth, validation, securite, quotas
    routes/            # API endpoints
    services/          # IA, Google, notifications, cron, logs
  dashboard/           # Frontend client
  admin/               # Panel admin
  landing/             # Page marketing
  legal/               # CGU, RGPD, mentions legales
  extension/           # Extension Chrome
  scripts/             # Seed data, utilitaires
```

## Licence

Proprietary - AvisGuard 2026
