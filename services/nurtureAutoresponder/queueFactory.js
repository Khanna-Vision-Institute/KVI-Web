const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @param {{
 *   queuePath: string,
 *   buildScheduledJobs: (enrolledAt: Date) => object[],
 *   rescheduleSpecs?: [string, number, number][],
 *   dedupHoursEnv?: string,
 * }} cfg
 */
function createCampaignQueue(cfg) {
  const dedupEnv = cfg.dedupHoursEnv || 'NURTURE_AUTORESPONDER_DEDUP_HOURS';
  const { reschedulePendingJobs } = require('./schedule');

  function ensureQueueFile() {
    const dir = path.dirname(cfg.queuePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(cfg.queuePath)) {
      fs.writeFileSync(cfg.queuePath, JSON.stringify({ enrollments: [] }, null, 2));
    }
  }

  function readQueue() {
    ensureQueueFile();
    try {
      const parsed = JSON.parse(fs.readFileSync(cfg.queuePath, 'utf8'));
      return Array.isArray(parsed.enrollments) ? parsed : { enrollments: [] };
    } catch {
      return { enrollments: [] };
    }
  }

  function writeQueue(data) {
    ensureQueueFile();
    const tmp = `${cfg.queuePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, cfg.queuePath);
  }

  function findBlockingEnrollment(queue, { email, phone }, dedupMs) {
    const now = Date.now();
    return queue.enrollments.find((e) => {
      if (e.status !== 'active') return false;
      if (now - new Date(e.enrolledAt).getTime() >= dedupMs) return false;
      const sameEmail = email && e.email === email;
      const samePhone = phone && e.lead?.phone === phone;
      return sameEmail || samePhone;
    });
  }

  function enrollLead(lead, meta = {}) {
    const queue = readQueue();
    const email = String(lead.email || '').toLowerCase();
    const phone = String(lead.phone || '').trim();
    const dedupHours = parseInt(process.env[dedupEnv] || process.env.PIE_AUTORESPONDER_DEDUP_HOURS || '24', 10);
    const dedupMs = dedupHours * 60 * 60 * 1000;

    const existing = findBlockingEnrollment(queue, { email, phone }, dedupMs);
    if (existing) {
      const day0 = existing.jobs.filter((j) => j.type.includes('day0') || j.type === 'sms_immediate');
      const day0Succeeded = day0.some((j) => j.status === 'sent');
      const day0StillPending = day0.some((j) => j.status === 'pending' || j.status === 'processing');
      if (day0Succeeded || day0StillPending) {
        return { skipped: true, reason: 'already_enrolled_24h', enrollmentId: existing.id };
      }
      existing.status = 'superseded';
      existing.supersededAt = new Date().toISOString();
    }

    const enrolledAt = new Date();
    const enrollment = {
      id: crypto.randomBytes(8).toString('hex'),
      status: 'active',
      enrolledAt: enrolledAt.toISOString(),
      email,
      lead,
      ...meta,
      jobs: cfg.buildScheduledJobs(enrolledAt)
    };
    queue.enrollments.push(enrollment);
    if (queue.enrollments.length > 5000) queue.enrollments = queue.enrollments.slice(-5000);
    writeQueue(queue);
    return { enrollmentId: enrollment.id, jobs: enrollment.jobs.length };
  }

  function claimJob(enrollmentId, jobId) {
    const queue = readQueue();
    const enrollment = queue.enrollments.find((e) => e.id === enrollmentId);
    if (!enrollment || enrollment.status !== 'active') return null;
    const job = enrollment.jobs.find((j) => j.id === jobId);
    if (!job) return null;

    const staleMs = 15 * 60 * 1000;
    if (job.status === 'processing') {
      const started = job.processingAt ? new Date(job.processingAt).getTime() : 0;
      if (Date.now() - started < staleMs) return null;
      job.status = 'pending';
    }

    if (job.status !== 'pending') return null;
    if (new Date(job.dueAt) > new Date()) return null;

    job.status = 'processing';
    job.processingAt = new Date().toISOString();
    writeQueue(queue);
    return { enrollment, job };
  }

  function getDueJobs(now = new Date()) {
    const due = [];
    for (const enrollment of readQueue().enrollments) {
      if (enrollment.status !== 'active') continue;
      for (const job of enrollment.jobs) {
        if (job.status === 'pending' && new Date(job.dueAt) <= now) {
          due.push({ enrollmentId: enrollment.id, jobId: job.id, type: job.type });
        }
      }
    }
    return due;
  }

  function markJob(enrollmentId, jobId, update) {
    const queue = readQueue();
    const enrollment = queue.enrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const job = enrollment.jobs.find((j) => j.id === jobId);
    if (!job) return;
    Object.assign(job, update);
    if (
      enrollment.jobs.every(
        (j) => j.status === 'sent' || j.status === 'skipped' || j.status === 'failed'
      )
    ) {
      enrollment.status = 'completed';
    }
    writeQueue(queue);
  }

  function rescheduleActivePendingJobs() {
    if (!cfg.rescheduleSpecs) return { enrollments: 0, jobs: 0 };
    const queue = readQueue();
    let enrollments = 0;
    let jobs = 0;
    for (const enrollment of queue.enrollments) {
      if (enrollment.status !== 'active') continue;
      const n = reschedulePendingJobs(enrollment, cfg.rescheduleSpecs);
      if (n > 0) {
        enrollments += 1;
        jobs += n;
      }
    }
    if (jobs > 0) writeQueue(queue);
    return { enrollments, jobs };
  }

  function cancelActiveForContact({ email, phone }) {
    const queue = readQueue();
    const emailNorm = email ? String(email).toLowerCase() : '';
    const phoneNorm = phone ? String(phone).trim() : '';
    let cancelled = 0;
    const now = new Date().toISOString();

    for (const enrollment of queue.enrollments) {
      if (enrollment.status !== 'active') continue;
      const sameEmail = emailNorm && enrollment.email === emailNorm;
      const samePhone = phoneNorm && enrollment.lead?.phone === phoneNorm;
      if (!sameEmail && !samePhone) continue;

      for (const job of enrollment.jobs) {
        if (job.status === 'pending' || job.status === 'processing') {
          job.status = 'skipped';
          job.detail = 'test_reschedule';
          job.completedAt = now;
        }
      }
      enrollment.status = 'cancelled';
      enrollment.cancelledAt = now;
      enrollment.cancelReason = 'test_reschedule';
      cancelled += 1;
    }

    if (cancelled > 0) writeQueue(queue);
    return cancelled;
  }

  /** Stagger pending jobs from startAt + (startSlotIndex * gapMinutes). */
  function staggerPendingJobs(enrollmentId, startAt, startSlotIndex, gapMinutes) {
    const queue = readQueue();
    const enrollment = queue.enrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return { nextSlot: startSlotIndex, jobs: [] };

    const gapMs = gapMinutes * 60 * 1000;
    const base = startAt instanceof Date ? startAt.getTime() : new Date(startAt).getTime();
    let slot = startSlotIndex;
    const jobs = [];

    for (const job of enrollment.jobs) {
      if (job.status !== 'pending' && job.status !== 'processing') continue;
      const dueAt = new Date(base + slot * gapMs).toISOString();
      job.dueAt = dueAt;
      if (job.status === 'processing') {
        job.status = 'pending';
        delete job.processingAt;
      }
      jobs.push({ type: job.type, dueAt });
      slot += 1;
    }

    writeQueue(queue);
    return { nextSlot: slot, jobs };
  }

  return {
    enrollLead,
    getDueJobs,
    claimJob,
    markJob,
    rescheduleActivePendingJobs,
    cancelActiveForContact,
    staggerPendingJobs,
    QUEUE_PATH: cfg.queuePath
  };
}

module.exports = { createCampaignQueue };
