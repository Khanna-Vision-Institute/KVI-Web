const config = require('../../config');

// In-memory access-token cache (per process).
let cached = { token: null, expiresAt: 0 };

// Zoho accounts/API hosts differ per data center.
function accountsHost(dc) {
  return `https://accounts.zoho.${dc}`;
}

function apiHost(dc) {
  // Zoho CRM API host mirrors the DC (e.g. www.zohoapis.com / .in / .eu / .com.au)
  return `https://www.zohoapis.${dc}`;
}

/**
 * Exchange the stored refresh token for a short-lived access token.
 * @returns {Promise<string>} access token
 */
async function getZohoAccessToken() {
  const { clientId, clientSecret, refreshToken, dc } = config.zoho;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho credentials missing (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN)');
  }

  const now = Date.now();
  if (cached.token && now < cached.expiresAt) return cached.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${accountsHost(dc)}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const detail = data.error || `HTTP ${res.status}`;
    throw new Error(`Zoho token refresh failed: ${detail}`);
  }

  cached = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cached.token;
}

function _resetZohoTokenCache() {
  cached = { token: null, expiresAt: 0 };
}

module.exports = { getZohoAccessToken, accountsHost, apiHost, _resetZohoTokenCache };
