const { google } = require('googleapis');
const config = require('../config');

/**
 * Service Google Business Profile
 * Gère l'OAuth, la lecture et la réponse aux avis Google
 */

function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Génère l'URL d'autorisation OAuth pour connecter un compte Google Business
 */
function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/business.manage'
    ],
    state
  });
}

/**
 * Échange le code d'autorisation contre des tokens
 */
async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Rafraîchit le token d'accès
 */
async function refreshAccessToken(refreshToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

/**
 * Liste les établissements du compte Google Business
 */
async function listLocations(accessToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const mybusiness = google.mybusinessbusinessinformation({
    version: 'v1',
    auth: oauth2Client
  });

  try {
    const accountsRes = await google.mybusinessaccountmanagement({
      version: 'v1',
      auth: oauth2Client
    }).accounts.list();

    const accounts = accountsRes.data.accounts || [];
    const locations = [];

    for (const account of accounts) {
      const locRes = await mybusiness.accounts.locations.list({
        parent: account.name,
        readMask: 'name,title,storefrontAddress'
      });
      if (locRes.data.locations) {
        locations.push(...locRes.data.locations.map(loc => ({
          accountId: account.name,
          locationId: loc.name,
          name: loc.title,
          address: loc.storefrontAddress
        })));
      }
    }

    return locations;
  } catch (error) {
    console.error('[Google] Error listing locations:', error.message);
    throw error;
  }
}

/**
 * Récupère les avis d'un établissement Google
 */
async function fetchReviews(accessToken, accountId, locationId) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: oauth2Client
    });

    // L'API Google Business utilise accounts.locations.reviews.list
    const res = await google.options({
      auth: oauth2Client,
      url: `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews`,
      method: 'GET'
    });

    // Format simplifié pour le MVP
    const reviews = (res.data.reviews || []).map(review => ({
      platformReviewId: review.reviewId,
      authorName: review.reviewer?.displayName || 'Anonyme',
      authorAvatarUrl: review.reviewer?.profilePhotoUrl,
      rating: starRatingToNumber(review.starRating),
      text: review.comment || '',
      publishedAt: review.createTime
    }));

    return reviews;
  } catch (error) {
    console.error('[Google] Error fetching reviews:', error.message);
    return [];
  }
}

/**
 * Publie une réponse à un avis Google
 */
async function replyToReview(accessToken, accountId, locationId, reviewId, responseText) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    const url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews/${reviewId}/reply`;

    const res = await oauth2Client.request({
      url,
      method: 'PUT',
      data: { comment: responseText }
    });

    return { success: true, data: res.data };
  } catch (error) {
    console.error('[Google] Error replying to review:', error.message);
    return { success: false, error: error.message };
  }
}

function starRatingToNumber(starRating) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || 0;
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  refreshAccessToken,
  listLocations,
  fetchReviews,
  replyToReview
};
