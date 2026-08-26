const queue = require('./queue');
const { runPterygiumJob } = require('./runJob');
const { validateOutboundPhone } = require('../twilioSmsService');
const { processDueJobsForCampaign } = require('../nurtureAutoresponder/runJobCommon');

function isTestLead(lead) {
  const email = String(lead.email || '').toLowerCase();
  return email.endsWith('@example.com') || email.includes('+test');
}

async function enrollPterygiumStage1Autoresponder(lead, opts = {}) {
  const phoneCheck = validateOutboundPhone(lead.phone, { location: lead.location || '' });
  if (!phoneCheck.ok) {
    return { skipped: true, reason: phoneCheck.reason };
  }

  const normalized = {
    fullName: lead.fullName || '',
    email: String(lead.email || '').toLowerCase(),
    phone: phoneCheck.e164,
    location: lead.location || 'Beverly Hills'
  };

  if (!opts.allowTest && isTestLead(normalized)) {
    return { skipped: true, reason: 'test_email' };
  }

  const result = queue.enrollLead(normalized);
  if (!result.skipped) {
    setImmediate(() => {
      processDuePterygiumJobs().catch((e) =>
        console.error('[pterygium-autoresponder] process:', e.message)
      );
    });
  }
  return result;
}

async function processDuePterygiumJobs() {
  return processDueJobsForCampaign({
    campaign: 'pterygium-autoresponder',
    queue,
    runJob: runPterygiumJob
  });
}

module.exports = { enrollPterygiumStage1Autoresponder, processDuePterygiumJobs };
