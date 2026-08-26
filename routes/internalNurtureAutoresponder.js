const express = require('express');
const { isSmileEnabled, isPterygiumEnabled } = require('../nurtureAutoresponder/cron');
const {
  CAMPAIGN_ORDER,
  applyTestStaggerForRecipient,
  cancelActiveAcrossCampaigns
} = require('../nurtureAutoresponder/testSchedule');
const { enrollSmileStage1Autoresponder } = require('../smileAutoresponder/enroll');
const { enrollPterygiumStage1Autoresponder } = require('../pterygiumAutoresponder/enroll');
const { enrollPieStage1Autoresponder } = require('../pieAutoresponder/enroll');
const { isPieAutoresponderEnabled } = require('../pieAutoresponder/safe');

const router = express.Router();

function enrollSecret() {
  return (
    process.env.NURTURE_AUTORESPONDER_ENROLL_SECRET ||
    process.env.PIE_AUTORESPONDER_ENROLL_SECRET ||
    process.env.ZOHO_HERITAGE_SYNC_SECRET ||
    ''
  );
}

function extractSecret(req) {
  const expected = enrollSecret();
  if (!expected) return { ok: false, reason: 'secret_not_configured' };

  const auth = String(req.headers.authorization || '').trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (bearer && bearer[1] === expected) return { ok: true };

  const header = String(req.headers['x-kvi-nurture-enroll-secret'] || '').trim();
  if (header && header === expected) return { ok: true };

  return { ok: false, reason: 'unauthorized' };
}

function guard(req, res) {
  const auth = extractSecret(req);
  if (!auth.ok) {
    res.status(auth.reason === 'secret_not_configured' ? 503 : 401).json({
      ok: false,
      code: auth.reason === 'secret_not_configured' ? 'SECRET_MISSING' : 'UNAUTHORIZED',
      message:
        auth.reason === 'secret_not_configured'
          ? 'Set NURTURE_AUTORESPONDER_ENROLL_SECRET in .env and pass Authorization: Bearer …'
          : 'Invalid enroll secret.'
    });
    return false;
  }
  return true;
}

/**
 * Internal-only: enroll test recipients into nurture campaigns.
 * POST body:
 * {
 *   "recipients": [{ "fullName", "email", "phone", "smileVariant": "a"|"b" }],
 *   "campaigns": ["smile", "pterygium", "pie"]  // default: smile + pterygium
 * }
 */
router.post('/enroll', async (req, res) => {
  if (!guard(req, res)) return;

  const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
  const testMode = req.body?.testMode !== false;
  const gapMinutes = parseInt(req.body?.gapMinutes || '5', 10);
  const testStartOpts = {
    testStartAt: req.body?.testStartAt,
    testStartHour: req.body?.testStartHour,
    testStartMinute: req.body?.testStartMinute
  };
  const campaignsRaw = Array.isArray(req.body?.campaigns)
    ? req.body.campaigns
    : testMode
      ? CAMPAIGN_ORDER
      : ['smile', 'pterygium'];
  const campaigns = CAMPAIGN_ORDER.filter((c) =>
    campaignsRaw.map((x) => String(x).trim().toLowerCase()).includes(c)
  );

  if (!recipients.length) {
    return res.status(400).json({ ok: false, message: 'recipients[] required' });
  }

  const results = [];

  for (const raw of recipients) {
    const lead = {
      fullName: String(raw.fullName || raw.name || '').trim(),
      email: String(raw.email || '').trim(),
      phone: String(raw.phone || '').trim(),
      location: String(raw.location || '').trim(),
      smileVariant: raw.smileVariant
    };

    if (!lead.email && !lead.phone) {
      results.push({ lead, error: 'email or phone required' });
      continue;
    }

    const row = {
      lead: { email: lead.email, phone: lead.phone, fullName: lead.fullName },
      campaigns: {},
      testSchedule: null
    };

    if (testMode) {
      row.cancelledPrevious = cancelActiveAcrossCampaigns({
        email: lead.email,
        phone: lead.phone
      });
    }

    const enrollmentIds = {};

    for (const campaign of campaigns) {
      try {
        if (campaign === 'smile') {
          if (!isSmileEnabled()) {
            row.campaigns.smile = { skipped: true, reason: 'SMILE_AUTORESPONDER_ENABLED=false' };
          } else {
            const r = await enrollSmileStage1Autoresponder(lead, {
              variant: lead.smileVariant,
              allowTest: true
            });
            row.campaigns.smile = r;
            if (r.enrollmentId) enrollmentIds.smile = r.enrollmentId;
          }
        } else if (campaign === 'pterygium') {
          if (!isPterygiumEnabled()) {
            row.campaigns.pterygium = { skipped: true, reason: 'PTERYGIUM_AUTORESPONDER_ENABLED=false' };
          } else {
            const r = await enrollPterygiumStage1Autoresponder(lead, { allowTest: true });
            row.campaigns.pterygium = r;
            if (r.enrollmentId) enrollmentIds.pterygium = r.enrollmentId;
          }
        } else if (campaign === 'pie') {
          if (!isPieAutoresponderEnabled()) {
            row.campaigns.pie = { skipped: true, reason: 'PIE_AUTORESPONDER_ENABLED=false' };
          } else {
            const r = await enrollPieStage1Autoresponder(
              {
                ...lead,
                surgeryExamType: 'PIE',
                pageUrl: '/procedures/lens-solutions/pie'
              },
              { allowInternal: true }
            );
            row.campaigns.pie = r;
            if (r.enrollmentId) enrollmentIds.pie = r.enrollmentId;
          }
        }
      } catch (err) {
        row.campaigns[campaign] = { error: err.message || String(err) };
      }
    }

    if (testMode && Object.keys(enrollmentIds).length) {
      row.testSchedule = applyTestStaggerForRecipient(enrollmentIds, gapMinutes, testStartOpts);
    }

    results.push(row);
  }

  return res.json({
    ok: true,
    enrolled: results.length,
    campaigns,
    testMode,
    gapMinutes: testMode ? gapMinutes : null,
    scheduleNote: testMode
      ? `Test mode: touchpoints start at ${testStartOpts.testStartHour != null ? `${testStartOpts.testStartHour}:${String(testStartOpts.testStartMinute ?? 0).padStart(2, '0')} LA today` : testStartOpts.testStartAt || 'next 1:00 PM Los Angeles'}, ${gapMinutes} min apart, order SMILE → Pterygium → PIE`
      : 'Production: touchpoints at 1:00 PM LA on scheduled nurture days',
    results
  });
});

router.get('/status', (req, res) => {
  if (!guard(req, res)) return;
  return res.json({
    ok: true,
    smileEnabled: isSmileEnabled(),
    pterygiumEnabled: isPterygiumEnabled(),
    cron:
      process.env.NURTURE_AUTORESPONDER_CRON ||
      process.env.PIE_AUTORESPONDER_CRON ||
      '*/5 * * * *'
  });
});

module.exports = { createInternalNurtureRouter: () => router };
