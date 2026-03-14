/**
 * AvisGuard - Background Service Worker
 * Gère la communication entre popup, content scripts et l'API
 */

const AVISGUARD_API = 'http://localhost:3000/api';

// Écouter les messages du popup et content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOGIN') {
    handleLogin(message.email, message.password)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (message.type === 'GET_CONFIG') {
    chrome.storage.local.get(['avisguard_token', 'avisguard_establishment_id', 'avisguard_user'], (data) => {
      sendResponse({
        token: data.avisguard_token,
        establishmentId: data.avisguard_establishment_id,
        user: data.avisguard_user
      });
    });
    return true;
  }

  if (message.type === 'LOGOUT') {
    chrome.storage.local.remove(['avisguard_token', 'avisguard_establishment_id', 'avisguard_user'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SET_ESTABLISHMENT') {
    chrome.storage.local.set({ avisguard_establishment_id: message.establishmentId }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_ESTABLISHMENTS') {
    getEstablishments()
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_STATS') {
    getStats(message.establishmentId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// Login
async function handleLogin(email, password) {
  const res = await fetch(`${AVISGUARD_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

  await chrome.storage.local.set({
    avisguard_token: data.token,
    avisguard_user: data.user
  });

  return data;
}

// Récupérer les établissements
async function getEstablishments() {
  const { avisguard_token: token } = await chrome.storage.local.get('avisguard_token');
  if (!token) throw new Error('Non connecté');

  const res = await fetch(`${AVISGUARD_API}/platforms/establishments`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

// Récupérer les stats
async function getStats(establishmentId) {
  const { avisguard_token: token } = await chrome.storage.local.get('avisguard_token');
  if (!token) throw new Error('Non connecté');

  const res = await fetch(`${AVISGUARD_API}/reviews/${establishmentId}/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

// Badge pour les avis non répondus
async function updateBadge() {
  try {
    const { avisguard_token: token, avisguard_establishment_id: estId } =
      await chrome.storage.local.get(['avisguard_token', 'avisguard_establishment_id']);

    if (!token || !estId) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const res = await fetch(`${AVISGUARD_API}/reviews/${estId}/unreplied`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    const count = data.reviews?.length || 0;

    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } catch {
    // Silently fail
  }
}

// Vérifier les avis non répondus toutes les 5 minutes
chrome.alarms.create('checkUnreplied', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkUnreplied') {
    updateBadge();
  }
});

// Mise à jour du badge au démarrage
updateBadge();
