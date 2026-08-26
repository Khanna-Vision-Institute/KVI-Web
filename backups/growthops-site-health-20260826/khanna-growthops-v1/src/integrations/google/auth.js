const config = require('../../config');

// In-memory access-token cache (per process). Refresh tokens are long-lived;
// access tokens last ~1h, so we cache until shortly before expiry.
let cached = { token: null, expiresAt: 0 };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Exchange the stored refresh token for a short-lived access token.
 * Cached in memory until ~60s before expiry.
 * @returns {Promise<string>} access token
 */
async function getGoogleAccessToken() {
  const { clientId, clientSecret, refreshToken } = config.google;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google credentials missing (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)');
  }

  const now = Date.now();
  if (cached.token && now < cached.expiresAt) return cached.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Google token refresh failed: ${detail}`);
  }

  cached = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cached.token;
}

// Exposed for tests / manual reset.
function _resetGoogleTokenCache() {
  cached = { token: null, expiresAt: 0 };
}

module.exports = { getGoogleAccessToken, _resetGoogleTokenCache };
