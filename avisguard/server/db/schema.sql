-- AvisGuard Database Schema

-- Utilisateurs (propriétaires de commerces)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  plan TEXT DEFAULT 'starter' CHECK(plan IN ('starter', 'pro', 'premium')),
  stripe_customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Établissements
CREATE TABLE IF NOT EXISTS establishments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'FR',
  phone TEXT,
  website TEXT,
  category TEXT,
  -- Paramètres IA
  ai_tone TEXT DEFAULT 'professionnel' CHECK(ai_tone IN ('professionnel', 'amical', 'formel', 'decontracte')),
  ai_language TEXT DEFAULT 'fr',
  ai_signature TEXT,
  ai_use_tu TEXT DEFAULT 'vous' CHECK(ai_use_tu IN ('tu', 'vous')),
  auto_reply_positive INTEGER DEFAULT 1,
  auto_reply_negative INTEGER DEFAULT 0,
  -- Connexions plateformes
  google_account_id TEXT,
  google_location_id TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  facebook_page_id TEXT,
  facebook_access_token TEXT,
  tripadvisor_url TEXT,
  pagesjaunes_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Avis clients (centralisés depuis toutes les plateformes)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  establishment_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('google', 'facebook', 'tripadvisor', 'pagesjaunes', 'trustpilot', 'booking', 'yelp', 'other')),
  platform_review_id TEXT,
  author_name TEXT,
  author_avatar_url TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  text TEXT,
  language TEXT DEFAULT 'fr',
  sentiment TEXT CHECK(sentiment IN ('positive', 'neutre', 'negative')),
  sentiment_score REAL,
  is_replied INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  published_at DATETIME,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE
);

-- Réponses aux avis
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  text TEXT NOT NULL,
  generated_by TEXT DEFAULT 'ai' CHECK(generated_by IN ('ai', 'human', 'template')),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'published', 'failed')),
  published_at DATETIME,
  published_via TEXT CHECK(published_via IN ('api', 'extension', 'manual')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

-- Templates de réponses personnalisés
CREATE TABLE IF NOT EXISTS response_templates (
  id TEXT PRIMARY KEY,
  establishment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK(category IN ('positive', 'negative', 'neutral', 'general')),
  rating_min INTEGER DEFAULT 1,
  rating_max INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE
);

-- Alertes et notifications
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  review_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('new_review', 'negative_review', 'response_published', 'weekly_report')),
  channel TEXT DEFAULT 'email' CHECK(channel IN ('email', 'sms', 'push', 'in_app')),
  message TEXT,
  is_read INTEGER DEFAULT 0,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

-- Statistiques quotidiennes (pour le dashboard)
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY,
  establishment_id TEXT NOT NULL,
  date TEXT NOT NULL,
  total_reviews INTEGER DEFAULT 0,
  avg_rating REAL DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  response_rate REAL DEFAULT 0,
  UNIQUE(establishment_id, date),
  FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_reviews_establishment ON reviews(establishment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX IF NOT EXISTS idx_reviews_is_replied ON reviews(is_replied);
CREATE INDEX IF NOT EXISTS idx_reviews_published_at ON reviews(published_at);
CREATE INDEX IF NOT EXISTS idx_responses_review ON responses(review_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_establishment ON daily_stats(establishment_id, date);
