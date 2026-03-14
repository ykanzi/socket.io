/**
 * AvisGuard - Script de seed (donnees de demonstration)
 * Usage: node scripts/seed.js
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Charger la config
process.env.NODE_ENV = 'development';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getDb, users, establishments, reviews, responses } = require('../server/db/database');

async function seed() {
  console.log('Seeding AvisGuard database...\n');

  // 1. Admin user
  const adminId = uuidv4();
  const adminHash = await bcrypt.hash('admin123', 12);
  try {
    users.create({
      id: adminId,
      email: 'admin@avisguard.fr',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'AvisGuard',
      role: 'admin',
      emailVerifyToken: null
    });
    getDb().prepare('UPDATE users SET email_verified = 1, plan = ? WHERE id = ?').run('premium', adminId);
    console.log('Admin cree: admin@avisguard.fr / admin123');
  } catch (e) {
    console.log('Admin deja existant, skip.');
  }

  // 2. Demo user
  const userId = uuidv4();
  const userHash = await bcrypt.hash('demo123', 12);
  try {
    users.create({
      id: userId,
      email: 'demo@avisguard.fr',
      passwordHash: userHash,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'user',
      emailVerifyToken: null
    });
    getDb().prepare('UPDATE users SET email_verified = 1, plan = ? WHERE id = ?').run('pro', userId);
    console.log('Demo user cree: demo@avisguard.fr / demo123');
  } catch (e) {
    console.log('Demo user deja existant, skip.');
  }

  // 3. Establishment
  const estId = uuidv4();
  try {
    establishments.create({
      id: estId,
      userId: userId,
      name: 'Le Petit Bistrot',
      address: '42 rue de la Paix',
      city: 'Paris',
      category: 'restaurant'
    });
    console.log('Etablissement cree: Le Petit Bistrot');
  } catch (e) {
    console.log('Etablissement deja existant, skip.');
  }

  // 4. Sample reviews
  const sampleReviews = [
    { authorName: 'Marie Martin', rating: 5, platform: 'google', sentiment: 'positive', text: 'Excellent restaurant ! Le service etait impeccable et les plats delicieux. Je recommande vivement le risotto aux truffes. Nous reviendrons sans hesiter.' },
    { authorName: 'Pierre Durand', rating: 4, platform: 'google', sentiment: 'positive', text: 'Tres bonne cuisine, cadre agreable. Le serveur etait tres attentif. Seul petit bemol, l\'attente un peu longue pour le dessert.' },
    { authorName: 'Sophie Leclerc', rating: 2, platform: 'tripadvisor', sentiment: 'negative', text: 'Decu par cette experience. Les plats etaient froids et le service desorganise. Pour le prix, on s\'attend a mieux. Ne reviendrai pas.' },
    { authorName: 'Lucas Bernard', rating: 5, platform: 'facebook', sentiment: 'positive', text: 'Un vrai coup de coeur ! L\'ambiance est chaleureuse, les plats sont raffines et le chef est venu nous saluer. Bravo !' },
    { authorName: 'Emma Petit', rating: 3, platform: 'pagesjaunes', sentiment: 'neutre', text: 'Correct sans plus. La carte est assez limitee mais ce qui est propose est bien cuisine. Rapport qualite-prix moyen.' },
    { authorName: 'Thomas Moreau', rating: 1, platform: 'google', sentiment: 'negative', text: 'Catastrophique. 45 minutes d\'attente pour un plat tiede. Le personnel semblait deborde et peu aimable. A eviter.' },
    { authorName: 'Julie Robert', rating: 5, platform: 'tripadvisor', sentiment: 'positive', text: 'Nous avons fete notre anniversaire ici et tout etait parfait. Le menu degustation est une merveille. Merci pour cette soiree magique !' },
    { authorName: 'Antoine Dubois', rating: 4, platform: 'google', sentiment: 'positive', text: 'Bonne adresse dans le quartier. Les pates fraiches sont excellentes. Service rapide et souriant. Je reviendrai avec plaisir.' },
  ];

  for (const r of sampleReviews) {
    const reviewId = uuidv4();
    const daysAgo = Math.floor(Math.random() * 30);
    const publishedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    try {
      reviews.create({
        id: reviewId,
        establishmentId: estId,
        platform: r.platform,
        platformReviewId: null,
        authorName: r.authorName,
        authorAvatarUrl: null,
        rating: r.rating,
        text: r.text,
        language: 'fr',
        sentiment: r.sentiment,
        sentimentScore: r.rating / 5,
        publishedAt
      });
    } catch (e) {
      // Skip duplicates
    }
  }
  console.log(`${sampleReviews.length} avis de demo crees`);

  // 5. Sample response for first review
  const firstReview = getDb().prepare('SELECT id FROM reviews WHERE establishment_id = ? LIMIT 1').get(estId);
  if (firstReview) {
    try {
      responses.create({
        id: uuidv4(),
        reviewId: firstReview.id,
        text: 'Merci beaucoup Marie pour votre avis ! Nous sommes ravis que vous ayez apprecie votre experience au Petit Bistrot. Le risotto aux truffes est effectivement l\'un de nos plats signatures. Au plaisir de vous revoir tres bientot ! - L\'equipe du Petit Bistrot',
        generatedBy: 'ai',
        status: 'published'
      });
      getDb().prepare('UPDATE reviews SET is_replied = 1 WHERE id = ?').run(firstReview.id);
      console.log('1 reponse de demo creee');
    } catch (e) {
      // Skip
    }
  }

  console.log('\nSeed termine !');
  console.log('\nComptes de demo :');
  console.log('  Admin : admin@avisguard.fr / admin123');
  console.log('  User  : demo@avisguard.fr  / demo123');
  console.log('\nDashboard : http://localhost:3000/dashboard');
  console.log('Admin     : http://localhost:3000/admin');
}

seed().catch(console.error);
