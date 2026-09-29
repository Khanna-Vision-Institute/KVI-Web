const queue = require('./queue');
const { runPieJob, pieAutoresponderEnabled } = require('./runJob');
const { isPieBooking } = require('../zohoBookingLeadFields');

function isTestLead(lead) {
  const email = String(lead.email || '').toLowerCase();
  return email.endsWith('@example.com') || email.includes('test');
}

/**
 * Start PIE Stage 1 autoresponder (Days 0–14 per reference doc).
 * @param {object} lead — booking payload fields
 */
async function enrollPieStage1Autoresponder(lead) {
  if (!pieAutoresponderEnabled()) {
    return { skipped: true, reason: 'PIE_AUTORESPONDER_ENABLED=false' };
  }

  if (!isPieBooking(lead)) {
    return { skipped: true, reason: 'not_pie_lead' };
  }

  if (isTestLead(lead)) {
    return { skipped: true, reason: 'test_email' };
  }

  const normalized = {
    fullName: lead.fullName || '',
    email: lead.email || '',
    phone: lead.phone || '',
    age: lead.age,
    location: lead.location || '',
    date: lead.date || lead.preferredDate || '',
    time: lead.time || lead.preferredTime || '',
    surgeryExamType: lead.surgeryExamType || 'PIE',
    pageUrl: lead.pageUrl || ''
  };

  const result = queue.enrollLead(normalized);
  if (result.skipped) {
    return result;
  }

  console.log(
    `[pie-autoresponder] enrolled ${normalized.email} id=${result.enrollmentId} jobs=${result.jobs}`
  );

  // Process anything due immediately (cron will catch the rest).
  setImmediate(() => {
    processDuePieJobs().catch((err) => {
      console.error('[pie-autoresponder] initial process failed:', err.message);
    });
  });

  return result;
}

async function processDuePieJobs() {
  if (!pieAutoresponderEnabled()) return { processed: 0 };

  const due = queue.getDueJobs();
  let processed = 0;

  for (const item of due) {
    const { enrollment, job } = item;
    const outcome = await runPieJob({ enrollment, job });
    const attempts = (job.attempts || 0) + 1;

    if (outcome.status === 'sent' || outcome.status === 'skipped') {
      queue.markJob(enrollment.id, job.id, {
        status: outcome.status === 'sent' ? 'sent' : 'skipped',
        completedAt: new Date().toISOString(),
        attempts,
        lastError: outcome.reason || null,
        detail: outcome.detail || null
      });
      processed += 1;
    } else if (attempts >= 3) {
      queue.markJob(enrollment.id, job.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        attempts,
        lastError: outcome.error || 'max_attempts'
      });
      processed += 1;
    } else {
      queue.markJob(enrollment.id, job.id, {
        attempts,
        lastError: outcome.error || 'retry'
      });
    }
  }

  return { processed, due: due.length };
}

module.exports = {
  enrollPieStage1Autoresponder,
  processDuePieJobs
};
