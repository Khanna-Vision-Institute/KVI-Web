const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Always resolve .env from project root (services/ parent). PM2 cwd is not always the app folder.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CRM_VERSION_PATH = '/crm/v2';

function extractResultDetails(response) {
  const detail = response?.data?.data?.[0];
  if (!detail) {
    throw new Error(`Unexpected Zoho CRM response format: ${JSON.stringify(response?.data)}`);
  }

  if (detail.status !== 'success') {
    const error = new Error(detail.message || 'Zoho CRM request failed');
    error.code = detail.code;
    error.details = detail.details;
    throw error;
  }

  return detail;
}

/**
 * OAuth redirect — must match Zoho API Console + authorize URL + token exchange body.
 * Production callback only. Override with ZOHO_OAUTH_REDIRECT_URI only if your live URL differs.
 */
const DEFAULT_ZOHO_REDIRECT_URI =
  'https://khannainstitute.com/api/vision-quest/oauth/callback';

class ZohoService {
  constructor() {
    this.clientId = (process.env.ZOHO_CLIENT_ID || '').trim();
    this.clientSecret = (process.env.ZOHO_CLIENT_SECRET || '').trim();
    this.refreshToken = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
    this.oauthRedirectUri = (
      process.env.ZOHO_OAUTH_REDIRECT_URI || DEFAULT_ZOHO_REDIRECT_URI
    ).trim();
    this.accountsUrl = (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(
      /\/$/,
      ''
    );
    this.apiDomain = (process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(
      /\/$/,
      ''
    );
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /** Safe snapshot for OAuth debugging (never includes secrets). */
  oauthExchangeSnapshot(accountsBaseOverride, redirectUriOverride) {
    const accountsBase = String(accountsBaseOverride || this.accountsUrl).replace(/\/$/, '');
    const redirect = String(redirectUriOverride || this.oauthRedirectUri || '').trim();
    return {
      redirect_uri: redirect,
      token_endpoint: `${accountsBase}/oauth/v2/token`,
      client_id_length: this.clientId.length,
      client_secret_configured: Boolean(this.clientSecret),
      authorize_tip:
        'The client_id in your browser authorize URL must exactly match ZOHO_CLIENT_ID in server .env.'
    };
  }

  /**
   * Exchange authorization code for tokens.
   * @param {string} grantToken - Authorization code from redirect URL **or** Self Client “Generate Code”.
   * @param {{ accountsUrl?: string, redirectUri?: string, selfClient?: boolean }} [opts]
   *        - Redirect flow: pass redirectUri (or rely on env DEFAULT); **do not** set selfClient.
   *        - Self Client: set selfClient=true — Zoho exchanges **without** redirect_uri ([docs](https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html)).
   */
  async generateRefreshToken(grantToken, opts = {}) {
    const code = String(grantToken || '').trim();
    if (!code) {
      throw new Error('Missing authorization code');
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET is missing. Ensure .env exists next to server.js on the server and restart PM2.'
      );
    }

    const selfClient = Boolean(opts.selfClient);

    let redirectUri = '';
    if (!selfClient) {
      redirectUri = String(opts.redirectUri || this.oauthRedirectUri || '').trim();
      if (!redirectUri) {
        throw new Error(
          'Missing redirect_uri for token exchange (set ZOHO_OAUTH_REDIRECT_URI or pass redirectUri).'
        );
      }
    }

    const redirectSnapshotLabel = selfClient
      ? '(Self Client grant — redirect_uri omitted)'
      : redirectUri;

    try {
      const accountsBase = String(opts.accountsUrl || this.accountsUrl).replace(/\/$/, '');

      const bodyFields = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code
      };
      if (!selfClient) {
        bodyFields.redirect_uri = redirectUri;
      }

      const body = new URLSearchParams(bodyFields);

      const response = await axios.post(`${accountsBase}/oauth/v2/token`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true
      });

      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          data = { parse_error: true, raw: data };
        }
      }
      if (!data || typeof data !== 'object') {
        data = {};
      }

      if (response.status >= 400 || data.error) {
        const desc = data.error_description ? ` — ${data.error_description}` : '';
        const http = response.status >= 400 ? ` (HTTP ${response.status})` : '';
        const err = new Error(`Zoho token error: ${data.error || 'unknown'}${desc}${http}`);
        err.zohoSnapshot = this.oauthExchangeSnapshot(accountsBase, redirectSnapshotLabel);
        throw err;
      }
      if (!data.refresh_token) {
        const err = new Error(`Zoho did not return refresh_token. Response: ${JSON.stringify(data)}`);
        err.zohoSnapshot = this.oauthExchangeSnapshot(accountsBase, redirectSnapshotLabel);
        throw err;
      }

      console.log('Refresh token received; save as ZOHO_REFRESH_TOKEN in .env');
      return data;
    } catch (error) {
      if (!error.zohoSnapshot) {
        error.zohoSnapshot = this.oauthExchangeSnapshot(
          opts.accountsUrl || this.accountsUrl,
          redirectSnapshotLabel
        );
      }
      console.error('Error generating refresh token:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      });

      const response = await axios.post(
        `${this.accountsUrl}/oauth/v2/token`,
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (response.data?.error) {
        throw new Error(
          `Zoho token error: ${response.data.error}${response.data.error_description ? ` — ${response.data.error_description}` : ''}`
        );
      }

      if (!response.data?.access_token) {
        throw new Error(`Zoho did not return an access token. Response: ${JSON.stringify(response.data)}`);
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + 55 * 60 * 1000;

      if (response.data.api_domain) {
        this.apiDomain = response.data.api_domain;
      }

      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw error;
    }
  }

  buildCRMUrl(pathFragment) {
    return `${this.apiDomain}${CRM_VERSION_PATH}${pathFragment}`;
  }

  buildLeadPayload(leadData) {
    const payload = {
      First_Name: leadData.firstName,
      Last_Name: leadData.lastName || 'Unknown',
      Email: leadData.email,
      Phone: leadData.phone,
      Lead_Source: leadData.leadSource || 'Vision Quest',
      Lead_Status: leadData.leadStatus || 'Not Contacted',
      Company: leadData.company || 'Vision Quest Lead',
      Description: this.formatDescription(leadData)
    };

    if (leadData.customFields && typeof leadData.customFields === 'object') {
      Object.assign(payload, leadData.customFields);
    }

    return payload;
  }

  async createLead(leadData) {
    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        data: [this.buildLeadPayload(leadData)],
        trigger: ['approval', 'workflow', 'blueprint']
      };

      const response = await axios.post(
        this.buildCRMUrl('/Leads'),
        payload,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const details = extractResultDetails(response);
      console.log('Lead created successfully:', details.details?.id || details.id);
      return { response: response.data, details };
    } catch (error) {
      console.error('Error creating lead:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchLeadByEmail(email) {
    const trimmed = String(email || '').trim();
    if (!trimmed) return [];

    const accessToken = await this.getAccessToken();
    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };

    async function runSearch(params) {
      const response = await axios.get(this.buildCRMUrl('/Leads/search'), {
        params,
        headers,
        validateStatus: () => true
      });
      if (response.status === 204 || response.status === 404) return [];
      if (response.status >= 400) {
        const err = new Error(
          `Zoho lead search failed (${response.status}): ${JSON.stringify(response.data || {}).slice(0, 300)}`
        );
        err.response = response;
        throw err;
      }
      return response.data && Array.isArray(response.data.data) ? response.data.data : [];
    }

    try {
      const byEmail = await runSearch.call(this, { email: trimmed });
      if (byEmail.length) return byEmail;

      const criteria = `(Email:equals:${trimmed})`;
      return await runSearch.call(this, { criteria });
    } catch (error) {
      if (error.response?.status === 204 || error.response?.status === 404) {
        return [];
      }

      console.error('Error searching lead:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateLead(leadId, leadData) {
    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        data: [
          {
            id: leadId,
            ...this.buildLeadPayload(leadData)
          }
        ]
      };

      const response = await axios.put(
        this.buildCRMUrl('/Leads'),
        payload,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const details = extractResultDetails(response);
      console.log('Lead updated successfully:', details.details?.id || details.id);
      return { response: response.data, details };
    } catch (error) {
      console.error('Error updating lead:', error.response?.data || error.message);
      throw error;
    }
  }

  formatDescription(leadData) {
    if (leadData.customDescription) {
      return leadData.customDescription;
    }

    return `Vision Quest Submission\n-----------------------\nName: ${leadData.firstName || ''} ${leadData.lastName || ''}\nEmail: ${leadData.email || ''}\nPhone: ${leadData.phone || ''}\nVision Type: ${leadData.visionType || 'Not specified'}\nSelected Date: ${leadData.selectedDate || 'Not scheduled'}\nSelected Time: ${leadData.selectedTime || 'Not scheduled'}\n\nGamification Stats:\n- Total XP: ${leadData.totalXP || 0}\n- Tier: ${leadData.tier || 'Bronze'}\n- Wallet Amount: $${leadData.walletAmount || 0}\n- Completion Time: ${leadData.completionTime || 'N/A'}\n\nSubmitted: ${new Date().toLocaleString()}`;
  }

  async upsertLead(leadData) {
    try {
      const existingLeads = await this.searchLeadByEmail(leadData.email);

      if (existingLeads.length > 0) {
        const leadId = existingLeads[0].id;
        return this.updateLead(leadId, leadData);
      }

      return this.createLead(leadData);
    } catch (error) {
      console.error('Error upserting lead:', error.response?.data || error.message || error);
      throw error;
    }
  }

  /**
   * Upload a file attachment to an existing Lead record in Zoho CRM.
   * Appears under the "Attachments" section of the lead.
   *
   * @param {string} leadId   - Zoho CRM Lead record ID
   * @param {Buffer} buffer   - File content
   * @param {string} filename - Display filename (e.g. "insurance-card.pdf")
   * @param {string} mimeType - MIME type (e.g. "application/pdf")
   */
  async uploadAttachment(leadId, buffer, filename, mimeType) {
    try {
      const accessToken = await this.getAccessToken();

      // Native FormData + Blob (Node.js 18+)
      const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, filename);

      const response = await axios.post(
        this.buildCRMUrl(`/Leads/${leadId}/Attachments`),
        formData,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`
            // Content-Type is set automatically by axios when FormData is passed
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000
        }
      );

      console.log(`[zoho] Attachment uploaded: "${filename}" → lead ${leadId}`);
      return response.data;
    } catch (error) {
      console.error(
        `[zoho] Attachment upload failed for "${filename}" on lead ${leadId}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

module.exports = new ZohoService();
