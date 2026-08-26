const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const router = express.Router();
const zohoService = require('../services/zohoService');
const emailService = require('../services/emailService');

const ZOHO_OAUTH_WAIT_MS = 90_000;
const ZOHO_OAUTH_POLL_MS = 100;

function oauthLockDir(code) {
  const h = crypto.createHash('sha256').update(code).digest('hex');
  return path.join(os.tmpdir(), `kvi-zoho-oauth-${h}`);
}

function scheduleOAuthLockCleanup(dir) {
  setTimeout(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }, 120_000);
}

/**
 * Ensures exactly one token exchange per authorization code across PM2 cluster workers.
 * Without this, two workers can hit Zoho with the same code — second response is invalid_code.
 */
async function exchangeAuthorizationCodeDeduped(code, accountsServer, redirectUri) {
  const dir = oauthLockDir(code);
  const resultPath = path.join(dir, 'result.json');
  const markerPath = path.join(dir, 'done.marker');

  try {
    fs.mkdirSync(dir);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }

    const tail = crypto.createHash('sha256').update(code).digest('hex').slice(-8);
    console.warn(`[zoho oauth] pid=${process.pid} waiting on peer exchange (code …${tail})`);

    const deadline = Date.now() + ZOHO_OAUTH_WAIT_MS;
    while (Date.now() < deadline && !fs.existsSync(markerPath)) {
      await new Promise((r) => setTimeout(r, ZOHO_OAUTH_POLL_MS));
    }

    if (!fs.existsSync(markerPath)) {
      throw new Error(
        'OAuth exchange timed out waiting for another server process. If using PM2 cluster, run kvi-home with a single instance for OAuth, then retry with a fresh authorize URL.'
      );
    }

    const raw = fs.readFileSync(resultPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.ok) {
      const err = new Error(parsed.message || 'OAuth exchange failed');
      err.zohoSnapshot = parsed.zohoSnapshot || undefined;
      throw err;
    }
    return parsed.tokens;
  }

  console.log(`[zoho oauth] pid=${process.pid} leading token exchange`);

  try {
    const tokens = await zohoService.generateRefreshToken(code, {
      accountsUrl: accountsServer || undefined,
      redirectUri
    });
    fs.writeFileSync(resultPath, JSON.stringify({ ok: true, tokens }), 'utf8');
    fs.writeFileSync(markerPath, '1', 'utf8');
    scheduleOAuthLockCleanup(dir);
    return tokens;
  } catch (err) {
    fs.writeFileSync(
      resultPath,
      JSON.stringify({
        ok: false,
        message: err.message,
        zohoSnapshot: err.zohoSnapshot || null
      }),
      'utf8'
    );
    fs.writeFileSync(markerPath, '1', 'utf8');
    scheduleOAuthLockCleanup(dir);
    throw err;
  }
}

router.post('/submit', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      visionType,
      selectedDate,
      selectedTime,
      totalXP,
      tier,
      walletAmount,
      completionTime
    } = req.body || {};

    if (!firstName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name and email are required'
      });
    }

    const normalizedTier = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Bronze';

    const leadData = {
      firstName,
      lastName: lastName || 'Unknown',
      email,
      phone: phone || '',
      visionType: visionType || '',
      selectedDate: selectedDate || '',
      selectedTime: selectedTime || '',
      totalXP: totalXP || 0,
      tier: normalizedTier,
      walletAmount: walletAmount || 0,
      completionTime: completionTime || 'N/A',
      company: 'Vision Quest Lead'
    };

    const result = await zohoService.upsertLead(leadData);

    let emailStatus = null;
    try {
      emailStatus = await emailService.sendVisionQuestSummary(leadData, {
        subject: 'New Booking from GENZ Quiz'
      });
      console.log('Vision Quest summary emailed:', emailStatus.messageId);
    } catch (emailError) {
      console.error('Failed to send Vision Quest summary email:', emailError.message);
    }

    return res.json({
      success: true,
      message: 'Lead saved successfully',
      data: result,
      emailStatus: emailStatus ? {
        accepted: emailStatus.accepted,
        rejected: emailStatus.rejected,
        messageId: emailStatus.messageId
      } : null
    });
  } catch (error) {
    console.error('Error submitting to Zoho CRM:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save lead',
      error: error.message
    });
  }
});

router.post('/level-complete', async (req, res) => {
  try {
    const { email, level, xpGained, rewardAmount } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to track progression'
      });
    }

    console.log(`Level ${level} completed by ${email} | XP: ${xpGained} | Reward: ${rewardAmount}`);

    return res.json({
      success: true,
      message: 'Level completion tracked'
    });
  } catch (error) {
    console.error('Error tracking level completion:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to track level completion',
      error: error.message
    });
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function accountsServerFromRequest(req) {
  let accountsServer = req.query['accounts-server'];
  if (Array.isArray(accountsServer)) {
    accountsServer = accountsServer[0];
  }
  accountsServer = accountsServer ? String(accountsServer).trim().replace(/\/$/, '') : '';

  if (!accountsServer && typeof req.originalUrl === 'string') {
    const m = req.originalUrl.match(/[&?]accounts-server=([^&]*)/);
    if (m && m[1]) {
      try {
        accountsServer = decodeURIComponent(m[1]).trim().replace(/\/$/, '');
      } catch (_) {
        accountsServer = m[1].trim().replace(/\/$/, '');
      }
    }
  }

  return accountsServer || undefined;
}

/** Matches whatever URL the browser actually landed on (www vs apex, HTTPS behind proxy). */
function oauthRedirectUriFromCallbackRequest(req) {
  const forced = process.env.ZOHO_OAUTH_REDIRECT_URI?.trim();
  if (forced) {
    return forced;
  }

  const rawProto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const proto = String(rawProto).split(',')[0].trim() || 'https';

  const rawHost = req.get('x-forwarded-host') || req.get('host') || '';
  const host = String(rawHost).split(',')[0].trim();
  if (!host) {
    return zohoService.oauthRedirectUri;
  }

  return `${proto}://${host}/api/vision-quest/oauth/callback`;
}

router.get('/oauth/callback', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');

  let code = req.query.code;
  if (Array.isArray(code)) {
    code = code[0];
  }
  code = code ? String(code).trim() : '';

  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  const accountsServer = accountsServerFromRequest(req);
  const redirectUri = oauthRedirectUriFromCallbackRequest(req);

  console.log('[zoho oauth] callback', {
    redirect_uri: redirectUri,
    host: req.get('host'),
    x_forwarded_host: req.get('x-forwarded-host'),
    x_forwarded_proto: req.get('x-forwarded-proto')
  });

  try {
    const tokens = await exchangeAuthorizationCodeDeduped(code, accountsServer, redirectUri);
    const rt = tokens.refresh_token;
    return res.send(`
      <h1>Authorization Successful!</h1>
      <p>Copy this refresh token into your .env file:</p>
      <pre>${escapeHtml(rt)}</pre>
      <p>Set it as: <code>ZOHO_REFRESH_TOKEN=${escapeHtml(rt)}</code></p>
      <p style="font-size:12px;color:#666;margin-top:2rem">Handled by server: <code>${escapeHtml(os.hostname())}</code></p>
    `);
  } catch (error) {
    console.error('Error generating refresh token:', error.response?.data || error.message);
    const snap = error.zohoSnapshot ? JSON.stringify(error.zohoSnapshot, null, 2) : '';
    const snapshotBlock = snap
      ? `<p><strong>Server OAuth snapshot</strong> (no secrets shown):</p><pre>${escapeHtml(snap)}</pre>`
      : '';

    const hints = `
<p><strong>Zoho docs on <code>invalid_code</code>:</strong> the grant/code usually expires in about <strong>one minute</strong>, works <strong>only once</strong>, or was invalidated because it was sent twice.</p>
<p><strong>Critical:</strong> Zoho Console authorized redirect URI, the <code>redirect_uri</code> in your authorize URL, and <strong>Server OAuth snapshot → redirect_uri</strong> must match exactly (scheme, host, path, no stray slash).</p>
<ul>
<li>Immediately after you click Accept, do not refresh this page or open the callback URL twice.</li>
<li>Use incognito mode or temporarily disable aggressive extensions — some prefetch duplicate GET requests.</li>
<li>In Zoho API Console: authorized redirect URI must match exactly (same host as authorize URL — try registering both non‑www and www if unsure).</li>
<li>If your Zoho account spans regions, enable <strong>Multi‑DC</strong> for this client or generate tokens using the domain shown on your consent screen.</li>
<li><strong>Bypass redirect OAuth (recommended if this keeps failing):</strong> In <a href="https://api-console.zoho.com/">Zoho API Console</a> open <strong>Self Client</strong> → <strong>Generate Code</strong> with scopes such as <code>ZohoCRM.modules.leads.ALL</code>. On <strong>this same machine</strong> run:<pre style="white-space:pre-wrap;background:#f5f5f5;padding:10px">cd "/home/ec2-user/kvi-home/kvi home"
node scripts/zoho-exchange-self-client-code.js "PASTE_GRANT_CODE_HERE"</pre>Use the <strong>Self Client</strong> client id/secret in <code>.env</code> (they differ from “Server-based” clients). Grant codes expire quickly.</li>
<li>If you use a <strong>load balancer</strong> with several EC2 instances, two servers may still race OAuth; Self Client exchange runs once on one box.</li>
</ul>`;

    return res
      .status(500)
      .send(
        `<h1>OAuth token exchange failed</h1><p>${escapeHtml(error.message)}</p>${snapshotBlock}${hints}<p style="font-size:12px;color:#666;margin-top:2rem">Handled by server: <code>${escapeHtml(os.hostname())}</code></p>`
      );
  }
});

module.exports = router;
