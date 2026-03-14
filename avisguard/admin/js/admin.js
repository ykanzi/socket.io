// AvisGuard Admin Panel
const API_URL = window.location.origin + '/api';
let token = localStorage.getItem('avisguard_admin_token');

// --- API ---
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Accès refusé');
  }
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

// --- Auth ---
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.user.role !== 'admin') {
      errorEl.textContent = 'Accès réservé aux administrateurs';
      return;
    }

    token = data.token;
    localStorage.setItem('avisguard_admin_token', token);
    showApp(data.user);
  } catch (e) {
    errorEl.textContent = e.message;
  }
});

document.getElementById('btn-logout').addEventListener('click', logout);

function logout() {
  token = null;
  localStorage.removeItem('avisguard_admin_token');
  document.getElementById('admin-login').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';
}

// --- Navigation ---
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const section = link.dataset.section;
    document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${section}`).style.display = 'block';

    if (section === 'dashboard') loadDashboard();
    if (section === 'users') loadUsers();
    if (section === 'reviews') loadReviews();
    if (section === 'audit') loadAuditLogs();
  });
});

// --- App ---
async function showApp(user) {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  document.getElementById('admin-email').textContent = user.email;
  loadDashboard();
}

// --- Dashboard ---
async function loadDashboard() {
  try {
    const data = await apiCall('/admin/dashboard');
    const s = data.stats;

    document.getElementById('admin-stats').innerHTML = [
      { label: 'Utilisateurs', value: s.totalUsers },
      { label: 'Etablissements', value: s.totalEstablishments },
      { label: 'Total avis', value: s.totalReviews },
      { label: 'Reponses IA', value: s.totalAiResponses },
      { label: "Avis aujourd'hui", value: s.reviewsToday },
      { label: "Reponses aujourd'hui", value: s.responsesToday }
    ].map(st => `
      <div class="stat-card">
        <div class="label">${st.label}</div>
        <div class="value">${st.value}</div>
      </div>
    `).join('');

    document.getElementById('plan-breakdown').innerHTML = data.planBreakdown.map(p => `
      <div class="breakdown-item">
        <span><span class="badge-plan ${p.plan}">${p.plan}</span></span>
        <strong>${p.count} utilisateurs</strong>
      </div>
    `).join('');

    document.getElementById('platform-breakdown').innerHTML = data.reviewsByPlatform.map(p => `
      <div class="breakdown-item">
        <span>${p.platform}</span>
        <strong>${p.count} avis</strong>
      </div>
    `).join('');
  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

// --- Users ---
async function loadUsers() {
  try {
    const data = await apiCall('/admin/users');
    document.getElementById('users-count').textContent = data.total;

    document.getElementById('users-tbody').innerHTML = data.users.map(u => `
      <tr>
        <td>${u.email}</td>
        <td>${u.first_name || ''} ${u.last_name || ''}</td>
        <td><span class="badge-plan ${u.plan}">${u.plan}</span></td>
        <td><span class="badge-role ${u.role}">${u.role}</span></td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewUser('${u.id}')">Voir</button>
          <select class="btn btn-sm" onchange="changePlan('${u.id}', this.value)" style="font-size:11px;">
            <option value="">Plan...</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>
          ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.email}')">Suppr</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Users error:', e);
  }
}

async function viewUser(userId) {
  try {
    const data = await apiCall(`/admin/users/${userId}`);
    const u = data.user;

    document.getElementById('user-modal-body').innerHTML = `
      <div style="margin-bottom:12px;">
        <strong>${u.firstName || ''} ${u.lastName || ''}</strong> (${u.email})
      </div>
      <div class="breakdown-item"><span>Plan</span><span class="badge-plan ${u.plan}">${u.plan}</span></div>
      <div class="breakdown-item"><span>Role</span><span class="badge-role ${u.role}">${u.role}</span></div>
      <div class="breakdown-item"><span>Email verifie</span><span>${u.emailVerified ? 'Oui' : 'Non'}</span></div>
      <div class="breakdown-item"><span>Stripe ID</span><span>${u.stripeCustomerId || '-'}</span></div>
      <div class="breakdown-item"><span>Inscrit le</span><span>${formatDate(u.createdAt)}</span></div>
      <div class="breakdown-item"><span>Etablissements</span><strong>${data.establishments.length}</strong></div>
      <div class="breakdown-item"><span>Total avis</span><strong>${data.totalReviews}</strong></div>
      <div class="breakdown-item"><span>Total reponses</span><strong>${data.totalResponses}</strong></div>
      <div class="breakdown-item"><span>Avis ce mois</span><strong>${data.usage.reviews_count}</strong></div>
      <div class="breakdown-item"><span>Reponses IA ce mois</span><strong>${data.usage.ai_responses_count}</strong></div>
      ${data.establishments.length > 0 ? `
        <h4 style="margin-top:16px;font-size:13px;">Etablissements</h4>
        ${data.establishments.map(e => `<div class="breakdown-item"><span>${e.name}</span><span>${e.city || ''}</span></div>`).join('')}
      ` : ''}
    `;
    document.getElementById('user-modal').style.display = 'flex';
  } catch (e) {
    console.error('View user error:', e);
  }
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

async function changePlan(userId, plan) {
  if (!plan) return;
  try {
    await apiCall(`/admin/users/${userId}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan })
    });
    loadUsers();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteUser(userId, email) {
  if (!confirm(`Supprimer l'utilisateur ${email} et toutes ses données ?`)) return;
  try {
    await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
    loadUsers();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

// --- Reviews ---
async function loadReviews() {
  try {
    const data = await apiCall('/admin/reviews/recent');
    document.getElementById('admin-reviews-list').innerHTML = data.reviews.map(r => `
      <div class="review-card">
        <div class="meta">
          <strong>${r.author_name || 'Anonyme'}</strong> sur <strong>${r.platform}</strong>
          | Etablissement: ${r.establishment_name} (${r.owner_email})
          | ${formatDate(r.fetched_at)}
        </div>
        <div class="stars">${'*'.repeat(r.rating)}${'*'.repeat(5 - r.rating).replace(/\*/g, ' ')}</div>
        <div class="text">${r.text || '<em>Pas de texte</em>'}</div>
      </div>
    `).join('') || '<p style="color:#6b7280;padding:20px;">Aucun avis</p>';
  } catch (e) {
    console.error('Reviews error:', e);
  }
}

// --- Audit ---
async function loadAuditLogs() {
  try {
    const data = await apiCall('/admin/audit-logs');
    document.getElementById('audit-tbody').innerHTML = data.logs.map(l => `
      <tr>
        <td>${formatDate(l.created_at)}</td>
        <td>${l.user_id ? l.user_id.substring(0, 8) + '...' : '-'}</td>
        <td><strong>${l.action}</strong></td>
        <td>${l.resource || '-'} ${l.resource_id ? l.resource_id.substring(0, 8) : ''}</td>
        <td>${l.ip_address || '-'}</td>
        <td>${l.details || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">Aucun log</td></tr>';
  } catch (e) {
    console.error('Audit error:', e);
  }
}

// --- Utilities ---
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Init ---
async function init() {
  if (token) {
    try {
      const data = await apiCall('/auth/me');
      if (data.role === 'admin') {
        showApp(data);
      } else {
        logout();
      }
    } catch {
      logout();
    }
  }
}

init();
