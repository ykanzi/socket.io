/**
 * AvisGuard - Content Script
 * Détecte les avis sur les pages de review et injecte le bouton de réponse IA
 * Fonctionne sur : Google, TripAdvisor, Facebook, Pages Jaunes, Yelp, Booking
 */

(function() {
  'use strict';

  const AVISGUARD_API = 'http://localhost:3000/api';
  let config = {};

  // Charger la config depuis le storage
  chrome.storage.local.get(['avisguard_token', 'avisguard_establishment_id'], (data) => {
    config.token = data.avisguard_token;
    config.establishmentId = data.avisguard_establishment_id;
  });

  // --- Détection de la plateforme ---
  function detectPlatform() {
    const url = window.location.hostname;
    if (url.includes('google.com')) return 'google';
    if (url.includes('tripadvisor')) return 'tripadvisor';
    if (url.includes('facebook.com')) return 'facebook';
    if (url.includes('pagesjaunes.fr')) return 'pagesjaunes';
    if (url.includes('yelp')) return 'yelp';
    if (url.includes('booking.com')) return 'booking';
    return null;
  }

  // --- Sélecteurs CSS par plateforme ---
  const SELECTORS = {
    google: {
      reviewContainer: '[data-review-id]',
      reviewText: '.MyEned span, .wiI7pd',
      reviewRating: '[role="img"][aria-label*="étoile"], [role="img"][aria-label*="star"]',
      authorName: '.d4r55, .WNxzHc',
      replyButton: '.a-no-hover-decoration'
    },
    tripadvisor: {
      reviewContainer: '[data-reviewid], .review-container, .cWwQK',
      reviewText: '.cPQsENeY, .fIrGe, .biGQs',
      reviewRating: '.UctUV svg, [class*="bubble_"]',
      authorName: '.cRVSd, .biGQs._P',
      replyButton: null // pas de bouton API, on injecte
    },
    facebook: {
      reviewContainer: '[data-ad-preview], .x1yztbdb',
      reviewText: '.x193iq5w span',
      reviewRating: '[aria-label*="star"]',
      authorName: 'strong span a',
      replyButton: '[aria-label="Comment"], [aria-label="Commenter"]'
    },
    pagesjaunes: {
      reviewContainer: '.bi-review, .pj-review',
      reviewText: '.bi-review-text, .pj-review-content',
      reviewRating: '.bi-note, .pj-stars',
      authorName: '.bi-review-author, .pj-author',
      replyButton: null
    },
    yelp: {
      reviewContainer: '[class*="review__"]',
      reviewText: '[class*="comment__"] span, .raw__',
      reviewRating: '[aria-label*="star rating"]',
      authorName: '[class*="user-passport"] a',
      replyButton: null
    },
    booking: {
      reviewContainer: '.review_list_new_item_block, [data-testid="review-card"]',
      reviewText: '.review_pos, .review_neg, [data-testid="review-positive-text"]',
      reviewRating: '.bui-review-score__badge, [data-testid="review-score"]',
      authorName: '.bui-avatar-block__title, [data-testid="review-avatar"]',
      replyButton: null
    }
  };

  // --- Extraction des avis ---
  function extractReviews(platform) {
    const selectors = SELECTORS[platform];
    if (!selectors) return [];

    const containers = document.querySelectorAll(selectors.reviewContainer);
    const reviews = [];

    containers.forEach((container, index) => {
      // Vérifie si le bouton AvisGuard est déjà injecté
      if (container.querySelector('.avisguard-btn')) return;

      const textEl = container.querySelector(selectors.reviewText);
      const authorEl = container.querySelector(selectors.authorName);
      const ratingEl = container.querySelector(selectors.reviewRating);

      const review = {
        element: container,
        text: textEl ? textEl.textContent.trim() : '',
        authorName: authorEl ? authorEl.textContent.trim() : 'Client',
        rating: extractRating(ratingEl, platform),
        platform,
        index
      };

      if (review.text || review.rating) {
        reviews.push(review);
      }
    });

    return reviews;
  }

  function extractRating(element, platform) {
    if (!element) return 0;
    const ariaLabel = element.getAttribute('aria-label') || '';
    const match = ariaLabel.match(/(\d)/);
    if (match) return parseInt(match[1]);

    // Fallback: compter les étoiles
    const stars = element.querySelectorAll('[fill="gold"], .full-star, .star-fill');
    return stars.length || 0;
  }

  // --- Injection du bouton AvisGuard ---
  function injectAvisGuardButton(review) {
    const btn = document.createElement('div');
    btn.className = 'avisguard-btn';
    btn.innerHTML = `
      <button class="avisguard-generate" title="Générer une réponse IA avec AvisGuard">
        <span class="avisguard-icon">AG</span>
        Répondre avec AvisGuard
      </button>
    `;

    btn.querySelector('.avisguard-generate').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGenerateResponse(review, btn);
    });

    // Injecte après le texte de l'avis ou à la fin du container
    const reviewText = review.element.querySelector(SELECTORS[review.platform]?.reviewText);
    if (reviewText && reviewText.parentNode) {
      reviewText.parentNode.insertBefore(btn, reviewText.nextSibling);
    } else {
      review.element.appendChild(btn);
    }
  }

  // --- Génération de réponse IA ---
  async function handleGenerateResponse(review, btnContainer) {
    const generateBtn = btnContainer.querySelector('.avisguard-generate');
    generateBtn.textContent = 'Génération en cours...';
    generateBtn.disabled = true;

    try {
      // Appel à l'API AvisGuard
      const response = await fetch(`${AVISGUARD_API}/reviews/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`
        },
        body: JSON.stringify({
          establishmentId: config.establishmentId,
          platform: review.platform,
          authorName: review.authorName,
          rating: review.rating,
          text: review.text
        })
      });

      const data = await response.json();
      if (!data.review) throw new Error('Erreur de création');

      // Générer la réponse IA
      const aiResponse = await fetch(`${AVISGUARD_API}/reviews/${data.review.id}/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`
        }
      });

      const aiData = await aiResponse.json();

      // Afficher la réponse
      showResponseOverlay(review, aiData.response, btnContainer);

    } catch (error) {
      console.error('[AvisGuard] Error:', error);
      generateBtn.textContent = 'Erreur - Réessayer';
      generateBtn.disabled = false;
    }
  }

  // --- Overlay de réponse ---
  function showResponseOverlay(review, response, btnContainer) {
    // Supprimer l'ancien bouton
    btnContainer.innerHTML = '';

    const overlay = document.createElement('div');
    overlay.className = 'avisguard-response-box';
    overlay.innerHTML = `
      <div class="avisguard-response-header">
        <span class="avisguard-badge">AvisGuard IA</span>
        <span class="avisguard-close" title="Fermer">&times;</span>
      </div>
      <textarea class="avisguard-textarea">${response.text}</textarea>
      <div class="avisguard-response-actions">
        <button class="avisguard-copy" title="Copier la réponse">Copier</button>
        <button class="avisguard-paste" title="Coller dans le champ de réponse">Coller & Répondre</button>
        <button class="avisguard-regenerate" title="Regénérer">Regénérer</button>
      </div>
    `;

    // Actions
    overlay.querySelector('.avisguard-close').addEventListener('click', () => {
      overlay.remove();
      injectAvisGuardButton(review); // Réinjecter le bouton
    });

    overlay.querySelector('.avisguard-copy').addEventListener('click', () => {
      const text = overlay.querySelector('.avisguard-textarea').value;
      navigator.clipboard.writeText(text).then(() => {
        overlay.querySelector('.avisguard-copy').textContent = 'Copié !';
        setTimeout(() => { overlay.querySelector('.avisguard-copy').textContent = 'Copier'; }, 2000);
      });
    });

    overlay.querySelector('.avisguard-paste').addEventListener('click', () => {
      const text = overlay.querySelector('.avisguard-textarea').value;
      pasteIntoReplyField(review, text);
    });

    overlay.querySelector('.avisguard-regenerate').addEventListener('click', () => {
      overlay.remove();
      injectAvisGuardButton(review);
      const newBtn = review.element.querySelector('.avisguard-btn');
      if (newBtn) handleGenerateResponse(review, newBtn);
    });

    btnContainer.appendChild(overlay);
  }

  // --- Coller dans le champ de réponse natif de la plateforme ---
  function pasteIntoReplyField(review, text) {
    const platform = review.platform;
    const selectors = SELECTORS[platform];

    // Chercher le champ de réponse natif
    let replyField = null;

    if (selectors.replyButton) {
      // Cliquer sur le bouton "Répondre" pour ouvrir le champ
      const replyBtn = review.element.querySelector(selectors.replyButton);
      if (replyBtn) {
        replyBtn.click();
        setTimeout(() => {
          // Chercher le textarea ou contenteditable
          replyField = review.element.querySelector('textarea, [contenteditable="true"]');
          if (replyField) {
            if (replyField.tagName === 'TEXTAREA' || replyField.tagName === 'INPUT') {
              replyField.value = text;
              replyField.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              replyField.textContent = text;
              replyField.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }, 500);
      }
    }

    // Copier dans le presse-papier comme fallback
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Réponse copiée ! Collez-la dans le champ de réponse (Ctrl+V)');
    });
  }

  // --- Notification flottante ---
  function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'avisguard-notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  // --- Observer les changements de page (SPA) ---
  function observePageChanges() {
    const observer = new MutationObserver(() => {
      const platform = detectPlatform();
      if (platform) {
        const reviews = extractReviews(platform);
        reviews.forEach(review => injectAvisGuardButton(review));
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Initialisation ---
  function init() {
    const platform = detectPlatform();
    if (!platform) return;

    console.log(`[AvisGuard] Extension active sur ${platform}`);

    // Scan initial
    setTimeout(() => {
      const reviews = extractReviews(platform);
      reviews.forEach(review => injectAvisGuardButton(review));
      console.log(`[AvisGuard] ${reviews.length} avis détectés`);
    }, 2000);

    // Observer les changements de page (SPA comme Google Maps)
    observePageChanges();
  }

  // Lancer après le chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
