/**
 * AvisGuard - Popup Script
 */

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  const config = await sendMessage({ type: 'GET_CONFIG' });

  if (config.token && config.user) {
    showDashboard(config.user, config.establishmentId);
  } else {
    showLogin();
  }
});

// --- Login ---
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (!email || !password) {
    errorEl.textContent = 'Remplissez tous les champs';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  const btn = document.getElementById('btn-login');
  btn.textContent = 'Connexion...';
  btn.disabled = true;

  const result = await sendMessage({ type: 'LOGIN', email, password });

  if (result.error) {
    errorEl.textContent = result.error;
    errorEl.style.display = 'block';
    btn.textContent = 'Se connecter';
    btn.disabled = false;
  } else {
    showDashboard(result.user);
  }
});

// --- Logout ---
document.getElementById('btn-logout').addEventListener('click', async () => {
  await sendMessage({ type: 'LOGOUT' });
  showLogin();
});

// --- Establishment select ---
document.getElementById('establishment-select').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;

  await sendMessage({ type: 'SET_ESTABLISHMENT', establishmentId: id });
  loadStats(id);
});

// --- Views ---
function showLogin() {
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('btn-login').textContent = 'Se connecter';
  document.getElementById('btn-login').disabled = false;
}

async function showDashboard(user, savedEstablishmentId) {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');

  // User info
  const initial = (user.firstName || user.email || '?')[0].toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent = user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email;
  document.getElementById('user-plan').textContent = `Plan ${user.plan || 'gratuit'}`;

  // Status
  document.getElementById('status-dot').className = 'status-dot online';
  document.getElementById('status-text').textContent = 'Connecté';

  // Load establishments
  const result = await sendMessage({ type: 'GET_ESTABLISHMENTS' });
  const select = document.getElementById('establishment-select');

  if (result.error || !result.establishments?.length) {
    select.innerHTML = '<option value="">Aucun établissement</option>';
    return;
  }

  const establishments = result.establishments;
  select.innerHTML = establishments.map(e =>
    `<option value="${e.id}" ${e.id === savedEstablishmentId ? 'selected' : ''}>${e.name}</option>`
  ).join('');

  // Auto-select first or saved
  const activeId = savedEstablishmentId || establishments[0].id;
  select.value = activeId;
  await sendMessage({ type: 'SET_ESTABLISHMENT', establishmentId: activeId });
  loadStats(activeId);
}

async function loadStats(establishmentId) {
  const result = await sendMessage({ type: 'GET_STATS', establishmentId });

  if (result.error || !result.stats) {
    document.getElementById('stat-total').textContent = '-';
    document.getElementById('stat-unreplied').textContent = '-';
    document.getElementById('stat-rating').textContent = '-';
    document.getElementById('stat-response').textContent = '-';
    return;
  }

  const s = result.stats;
  document.getElementById('stat-total').textContent = s.total || 0;
  document.getElementById('stat-unreplied').textContent = s.unreplied || 0;
  document.getElementById('stat-rating').textContent = s.avg_rating ? Number(s.avg_rating).toFixed(1) : '-';
  document.getElementById('stat-response').textContent = (s.response_rate || 0) + '%';
}

// --- Messaging ---
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}
