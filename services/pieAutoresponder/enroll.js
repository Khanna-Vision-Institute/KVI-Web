const queue = require('./queue');
const { runPieJob } = require('./runJob');
const { isPieBooking } = require('../zohoBookingLeadFields');
const {
  validateOutboundPhone,
  isPermanentDeliveryError
} = require('../twilioSmsService');

function isTestLead(lead) {
  const email = String(lead.email || '').toLowerCase();
  return email.endsWith('@example.com') || email.includes('test');
}

async function enrollPieStage1Autoresponder(lead, opts = {}) {
  if (!isPieBooking(lead)) return { skipped: true, reason: 'not_pie' };
  if (!opts.allowInternal && isTestLead(lead)) return { skipped: true, reason: 'test_email' };

  const phoneCheck = validateOutboundPhone(lead.phone, { location: lead.location || '' });
  if (!phoneCheck.ok) {
    console.warn(
      `[pie-autoresponder] enroll skipped: ${phoneCheck.reason} phone=${lead.phone} email=${lead.email}`
    );
    return { skipped: true, reason: phoneCheck.reason };
  }

  const normalized = {
    fullName: lead.fullName || '',
    email: lead.email || '',
    phone: phoneCheck.e164,
    age: lead.age,
    location: lead.location || '',
    date: lead.date || lead.preferredDate || '',
    time: lead.time || lead.preferredTime || '',
    surgeryExamType: lead.surgeryExamType || 'PIE',
    pageUrl: lead.pageUrl || ''
  };

  const result = queue.enrollLead(normalized);
  if (result.skipped) {
    console.log(`[pie-autoresponder] enroll skipped: ${result.reason} email=${normalized.email}`);
  } else {
    console.log(
      `[pie-autoresponder] enroll ok: id=${result.enrollmentId} jobs=${result.jobs} email=${normalized.email} phone=${normalized.phone}`
    );
  }
  if (!result.skipped) {
    setImmediate(() => {
      processDuePieJobs().catch((e) => console.error('[pie-autoresponder] process:', e.message));
    });
  }
  return result;
}

async function processDuePieJobs() {
  const due = queue.getDueJobs();
  if (due.length) {
    console.log(
      `[pie-autoresponder] processing ${due.length} due job(s): ${due.map((d) => d.type).join(', ')}`
    );
  }

  for (const { enrollmentId, jobId, type } of due) {
    const claimed = queue.claimJob(enrollmentId, jobId);
    if (!claimed) continue;

    const { enrollment, job } = claimed;
    const outcome = await runPieJob({ enrollment, job });
    const attempts = (job.attempts || 0) + 1;

    if (outcome.status === 'sent' || outcome.status === 'skipped') {
      queue.markJob(enrollment.id, job.id, {
        status: outcome.status,
        attempts,
        completedAt: new Date().toISOString(),
        detail: outcome.detail || null
      });
    } else if (outcome.error && isPermanentDeliveryError(outcome.error)) {
      queue.markJob(enrollment.id, job.id, {
        status: 'failed',
        attempts,
        lastError: outcome.error,
        completedAt: new Date().toISOString()
      });
    } else if (attempts >= 3) {
      queue.markJob(enrollment.id, job.id, {
        status: 'failed',
        attempts,
        lastError: outcome.error
      });
    } else {
      queue.markJob(enrollment.id, job.id, {
        status: 'pending',
        attempts,
        lastError: outcome.error
      });
    }
  }

  return { processed: due.length };
}

module.exports = { enrollPieStage1Autoresponder, processDuePieJobs };
