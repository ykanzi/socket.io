// AvisGuard Dashboard - Main Application
const API_URL = window.location.origin + '/api';
let token = localStorage.getItem('avisguard_token');
let currentUser = null;
let currentEstablishment = null;
let socket = null;

// --- Auth ---
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) {
    logout();
    throw new Error('Session expirée');
  }
  if (!res.ok) throw new Error(data.error || 'Erreur');

  return data;
}

async function login(email, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  token = data.token;
  localStorage.setItem('avisguard_token', token);
  currentUser = data.user;
  showDashboard();
}

async function register(email, password, firstName, lastName) {
  const data = await apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName, lastName })
  });
  token = data.token;
  localStorage.setItem('avisguard_token', token);
  currentUser = data.user;
  showDashboard();
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('avisguard_token');
  if (socket) socket.disconnect();
  showLogin();
}

// --- Socket.IO ---
function initSocket() {
  socket = io(window.location.origin);

  socket.on('connect', () => {
    console.log('[Socket.IO] Connecté');
    document.getElementById('connection-status').className = 'status-dot online';
    if (currentUser) socket.emit('join', currentUser.id);
  });

  socket.on('disconnect', () => {
    document.getElementById('connection-status').className = 'status-dot offline';
  });

  socket.on('new_review', (review) => {
    showToast(`Nouvel avis ${review.rating}/5 sur ${review.platform}`, 'info');
    loadReviews();
    loadStats();
  });

  socket.on('response_published', (data) => {
    showToast(`Réponse publiée sur ${data.platform}`, 'success');
    loadReviews();
  });

  // Notifications temps réel
  socket.on('notification', (notif) => {
    showToast(notif.message, notif.type === 'negative_review' ? 'error' : 'info');
    loadNotifications();
  });

  socket.on('unread_count', (data) => {
    updateNotifBadge(data.count);
  });
}

// --- Dashboard ---
async function showDashboard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('dashboard-page').style.display = 'flex';
  document.getElementById('user-name').textContent = currentUser.firstName || currentUser.email;
  document.getElementById('user-plan').textContent = currentUser.plan;

  initSocket();
  await loadEstablishments();
  loadNotifications();
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('dashboard-page').style.display = 'none';
}

// --- Establishments ---
async function loadEstablishments() {
  try {
    const data = await apiCall('/platforms/establishments');
    const list = data.establishments;

    if (list.length === 0) {
      showAddEstablishmentModal();
      return;
    }

    currentEstablishment = list[0];
    renderEstablishmentSelector(list);
    await loadStats();
    await loadReviews();
  } catch (error) {
    console.error('Error loading establishments:', error);
  }
}

function renderEstablishmentSelector(list) {
  const select = document.getElementById('establishment-select');
  select.innerHTML = list.map(e =>
    `<option value="${e.id}" ${e.id === currentEstablishment.id ? 'selected' : ''}>${e.name}</option>`
  ).join('');
}

async function addEstablishment(name, address, city, category) {
  await apiCall('/platforms/establishments', {
    method: 'POST',
    body: JSON.stringify({ name, address, city, category })
  });
  await loadEstablishments();
  closeModal();
  showToast('Établissement ajouté !', 'success');
}

// --- Stats ---
async function loadStats() {
  if (!currentEstablishment) return;
  try {
    const data = await apiCall(`/reviews/${currentEstablishment.id}/stats`);
    renderStats(data.stats, data.byPlatform);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function renderStats(stats, byPlatform) {
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-rating').textContent = stats.avg_rating || '-';
  document.getElementById('stat-response-rate').textContent = (stats.response_rate || 0) + '%';
  document.getElementById('stat-negative').textContent = stats.negative || 0;

  const platformsHtml = (byPlatform || []).map(p => `
    <div class="stat-card">
      <div class="label">${p.platform}</div>
      <div class="value">${p.avg_rating || '-'}</div>
      <div class="change">${p.total} avis | ${p.replied} réponses</div>
    </div>
  `).join('');
  document.getElementById('platform-stats').innerHTML = platformsHtml;
}

// --- Reviews ---
async function loadReviews() {
  if (!currentEstablishment) return;
  try {
    const platform = document.getElementById('filter-platform')?.value || '';
    const sentiment = document.getElementById('filter-sentiment')?.value || '';

    const data = await apiCall(
      `/reviews/${currentEstablishment.id}?platform=${platform}&sentiment=${sentiment}`
    );
    renderReviews(data.reviews);
  } catch (error) {
    console.error('Error loading reviews:', error);
  }
}

function renderReviews(reviewList) {
  const container = document.getElementById('reviews-list');

  if (!reviewList || reviewList.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--gray-500);">
        <p style="font-size: 18px; margin-bottom: 8px;">Aucun avis pour le moment</p>
        <p style="font-size: 14px;">Connectez Google Business ou ajoutez un avis manuellement</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="showAddReviewModal()">
          + Ajouter un avis test
        </button>
      </div>`;
    return;
  }

  container.innerHTML = reviewList.map(review => `
    <div class="review-item ${review.is_read ? '' : 'unread'}" data-id="${review.id}">
      <div class="review-top">
        <div class="review-author">
          <div class="review-avatar">${(review.author_name || '?')[0].toUpperCase()}</div>
          <div>
            <div class="review-name">${review.author_name || 'Anonyme'}</div>
            <div class="review-meta">
              <span class="review-platform ${review.platform}">${review.platform}</span>
              <span class="sentiment ${review.sentiment}">${review.sentiment}</span>
              <span>${formatDate(review.published_at)}</span>
            </div>
          </div>
        </div>
        <div class="review-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
      </div>
      <div class="review-text">${review.text || '<em>Pas de commentaire</em>'}</div>
      <div class="review-actions">
        ${review.is_replied
          ? '<span class="btn btn-sm btn-success" style="cursor:default;">Répondu</span>'
          : `<button class="btn btn-sm btn-primary" onclick="generateResponse('${review.id}')">
               Générer une réponse IA
             </button>
             <button class="btn btn-sm btn-outline" onclick="showManualResponseBox('${review.id}')">
               Répondre manuellement
             </button>`
        }
      </div>
      <div id="response-box-${review.id}" style="display:none;"></div>
    </div>
  `).join('');
}

// --- AI Response ---
async function generateResponse(reviewId) {
  const responseBox = document.getElementById(`response-box-${reviewId}`);
  responseBox.style.display = 'block';
  responseBox.innerHTML = '<div class="response-box"><p>Génération en cours...</p></div>';

  try {
    const data = await apiCall(`/reviews/${reviewId}/generate-response`, { method: 'POST' });

    responseBox.innerHTML = `
      <div class="response-box">
        <div class="ai-badge">Généré par IA (${data.response.generatedBy})</div>
        <textarea id="response-text-${reviewId}">${data.response.text}</textarea>
        <div class="response-actions">
          <div>
            <button class="btn btn-sm btn-success" onclick="publishResponse('${reviewId}', '${data.response.id}')">
              Publier
            </button>
            <button class="btn btn-sm btn-primary" onclick="generateResponse('${reviewId}')">
              Regénérer
            </button>
            <button class="btn btn-sm btn-outline" onclick="copyResponse('${reviewId}')">
              Copier
            </button>
          </div>
          <span style="font-size:11px;color:var(--gray-500);">${data.response.tokensUsed} tokens</span>
        </div>
      </div>`;
  } catch (error) {
    responseBox.innerHTML = `<div class="response-box"><p style="color:var(--danger);">Erreur: ${error.message}</p></div>`;
  }
}

function showManualResponseBox(reviewId) {
  const responseBox = document.getElementById(`response-box-${reviewId}`);
  responseBox.style.display = 'block';
  responseBox.innerHTML = `
    <div class="response-box">
      <textarea id="response-text-${reviewId}" placeholder="Écrivez votre réponse..."></textarea>
      <div class="response-actions">
        <button class="btn btn-sm btn-success" onclick="publishManualResponse('${reviewId}')">Publier</button>
        <button class="btn btn-sm btn-outline" onclick="document.getElementById('response-box-${reviewId}').style.display='none'">Annuler</button>
      </div>
    </div>`;
}

async function publishResponse(reviewId, responseId) {
  try {
    const text = document.getElementById(`response-text-${reviewId}`).value;
    await apiCall(`/reviews/${reviewId}/publish-response`, {
      method: 'POST',
      body: JSON.stringify({ responseId, text })
    });
    showToast('Réponse publiée !', 'success');
    loadReviews();
  } catch (error) {
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function publishManualResponse(reviewId) {
  const text = document.getElementById(`response-text-${reviewId}`).value;
  if (!text.trim()) return showToast('Réponse vide', 'error');

  await publishResponse(reviewId, null);
}

function copyResponse(reviewId) {
  const text = document.getElementById(`response-text-${reviewId}`).value;
  navigator.clipboard.writeText(text);
  showToast('Réponse copiée !', 'success');
}

// --- Modals ---
function showAddEstablishmentModal() {
  document.getElementById('modal-title').textContent = 'Ajouter un établissement';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Nom</label><input id="est-name" placeholder="Mon Restaurant"></div>
    <div class="form-group"><label>Adresse</label><input id="est-address" placeholder="12 rue de la Paix"></div>
    <div class="form-group"><label>Ville</label><input id="est-city" placeholder="Paris"></div>
    <div class="form-group"><label>Catégorie</label>
      <select id="est-category">
        <option value="restaurant">Restaurant</option>
        <option value="hotel">Hôtel</option>
        <option value="commerce">Commerce</option>
        <option value="artisan">Artisan</option>
        <option value="profession_liberale">Profession libérale</option>
        <option value="autre">Autre</option>
      </select>
    </div>`;
  document.getElementById('modal-submit').onclick = () => {
    addEstablishment(
      document.getElementById('est-name').value,
      document.getElementById('est-address').value,
      document.getElementById('est-city').value,
      document.getElementById('est-category').value
    );
  };
  openModal();
}

function showAddReviewModal() {
  document.getElementById('modal-title').textContent = 'Ajouter un avis test';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Nom du client</label><input id="rev-author" placeholder="Marie Dupont"></div>
    <div class="form-group"><label>Note</label>
      <select id="rev-rating">
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Très bien</option>
        <option value="3">3 - Moyen</option>
        <option value="2">2 - Décevant</option>
        <option value="1">1 - Très mauvais</option>
      </select>
    </div>
    <div class="form-group"><label>Plateforme</label>
      <select id="rev-platform">
        <option value="google">Google</option>
        <option value="facebook">Facebook</option>
        <option value="tripadvisor">TripAdvisor</option>
        <option value="pagesjaunes">Pages Jaunes</option>
      </select>
    </div>
    <div class="form-group"><label>Commentaire</label>
      <textarea id="rev-text" rows="3" placeholder="Super restaurant, personnel aux petits soins..."></textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = () => addTestReview();
  openModal();
}

async function addTestReview() {
  try {
    await apiCall('/reviews/add', {
      method: 'POST',
      body: JSON.stringify({
        establishmentId: currentEstablishment.id,
        platform: document.getElementById('rev-platform').value,
        authorName: document.getElementById('rev-author').value,
        rating: parseInt(document.getElementById('rev-rating').value),
        text: document.getElementById('rev-text').value
      })
    });
    closeModal();
    showToast('Avis ajouté !', 'success');
    loadReviews();
    loadStats();
  } catch (error) {
    showToast('Erreur: ' + error.message, 'error');
  }
}

function openModal() { document.getElementById('modal-overlay').classList.add('active'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

// --- Utilities ---
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- Notifications ---
async function loadNotifications() {
  try {
    const data = await apiCall('/alerts?limit=20');
    renderNotifications(data.alerts);
    updateNotifBadge(data.unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function renderNotifications(notifList) {
  const container = document.getElementById('notif-list');
  if (!notifList || notifList.length === 0) {
    container.innerHTML = '<div class="notif-empty">Aucune notification</div>';
    return;
  }

  container.innerHTML = notifList.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
      <div class="notif-type ${n.type}">${formatNotifType(n.type)}</div>
      <div>${n.message}</div>
      <div class="notif-time">${formatDate(n.sent_at)}</div>
    </div>
  `).join('');
}

function formatNotifType(type) {
  const labels = {
    new_review: 'Nouvel avis',
    negative_review: 'Avis négatif',
    response_published: 'Réponse publiée',
    weekly_report: 'Rapport'
  };
  return labels[type] || type;
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    loadNotifications();
  } else {
    panel.style.display = 'none';
  }
}

async function markNotifRead(id) {
  try {
    await apiCall(`/alerts/${id}/read`, { method: 'PUT' });
    loadNotifications();
  } catch (error) {
    console.error('Error marking notification:', error);
  }
}

async function markAllNotifsRead() {
  try {
    await apiCall('/alerts/read-all', { method: 'PUT' });
    loadNotifications();
    showToast('Notifications marquées comme lues', 'success');
  } catch (error) {
    console.error('Error marking all notifications:', error);
  }
}

// --- Init ---
async function init() {
  if (token) {
    try {
      const data = await apiCall('/auth/me');
      currentUser = data;
      showDashboard();
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);
