const queue = require('./queue');
const { runSmileJob } = require('./runJob');
const { validateOutboundPhone } = require('../twilioSmsService');
const { processDueJobsForCampaign } = require('../nurtureAutoresponder/runJobCommon');

function isTestLead(lead) {
  const email = String(lead.email || '').toLowerCase();
  return email.endsWith('@example.com') || email.includes('+test');
}

function normalizeVariant(v) {
  return String(v || 'a').trim().toLowerCase() === 'b' ? 'b' : 'a';
}

async function enrollSmileStage1Autoresponder(lead, opts = {}) {
  const phoneCheck = validateOutboundPhone(lead.phone, { location: lead.location || '' });
  if (!phoneCheck.ok) {
    return { skipped: true, reason: phoneCheck.reason };
  }

  const normalized = {
    fullName: lead.fullName || '',
    email: String(lead.email || '').toLowerCase(),
    phone: phoneCheck.e164,
    location: lead.location || 'Westlake Village',
    smileVariant: normalizeVariant(opts.variant || lead.smileVariant)
  };

  if (!opts.allowTest && isTestLead(normalized)) {
    return { skipped: true, reason: 'test_email' };
  }

  const result = queue.enrollLead(normalized, { variant: normalized.smileVariant });
  if (!result.skipped) {
    setImmediate(() => {
      processDueSmileJobs().catch((e) => console.error('[smile-autoresponder] process:', e.message));
    });
  }
  return result;
}

async function processDueSmileJobs() {
  return processDueJobsForCampaign({
    campaign: 'smile-autoresponder',
    queue,
    runJob: runSmileJob
  });
}

module.exports = { enrollSmileStage1Autoresponder, processDueSmileJobs };
