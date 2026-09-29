const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUE_PATH =
  process.env.PIE_AUTORESPONDER_QUEUE_PATH ||
  path.join(__dirname, '../../data/pie-autoresponder-queue.json');

function ensureQueueFile() {
  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(QUEUE_PATH)) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify({ enrollments: [] }, null, 2), 'utf8');
  }
}

function readQueue() {
  ensureQueueFile();
  try {
    const raw = fs.readFileSync(QUEUE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.enrollments)) {
      return { enrollments: [] };
    }
    return parsed;
  } catch (err) {
    console.error('[pie-queue] read failed:', err.message);
    return { enrollments: [] };
  }
}

function writeQueue(data) {
  ensureQueueFile();
  const tmp = `${QUEUE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, QUEUE_PATH);
}

function makeEnrollmentId(lead) {
  const key = `${String(lead.email || '').toLowerCase()}|${lead.phone || ''}|${Date.now()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * @param {object} lead
 * @param {Date} enrolledAt
 */
function buildScheduledJobs(lead, enrolledAt) {
  const base = enrolledAt.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const delays = [
    { type: 'sms_day0', delayMs: 2 * 60 * 1000, label: 'Day 0 SMS (within 5 min)' },
    { type: 'call_day0', delayMs: 3 * 60 * 1000, label: 'Day 0 immediate follow-up call' },
    { type: 'sms_day1', delayMs: 1 * day, label: 'Day 1 SMS' },
    { type: 'sms_day2', delayMs: 2 * day, label: 'Day 2 SMS' },
    { type: 'sms_day3', delayMs: 3 * day, label: 'Day 3 SMS' },
    { type: 'email_day5', delayMs: 5 * day, label: 'Day 5 email' },
    { type: 'call_day7', delayMs: 7 * day, label: 'Day 7 follow-up call' },
    { type: 'sms_day10', delayMs: 10 * day, label: 'Day 10 SMS' },
    { type: 'sms_day14', delayMs: 14 * day, label: 'Day 14 SMS' }
  ];

  return delays.map((d) => ({
    id: crypto.randomBytes(8).toString('hex'),
    type: d.type,
    label: d.label,
    dueAt: new Date(base + d.delayMs).toISOString(),
    status: 'pending',
    attempts: 0,
    lastError: null
  }));
}

function enrollLead(lead) {
  const queue = readQueue();
  const email = String(lead.email || '').toLowerCase();
  const recent = queue.enrollments.find(
    (e) =>
      e.email === email &&
      e.status === 'active' &&
      Date.now() - new Date(e.enrolledAt).getTime() < 24 * 60 * 60 * 1000
  );
  if (recent) {
    return { skipped: true, reason: 'already_enrolled_24h', enrollmentId: recent.id };
  }

  const enrolledAt = new Date();
  const enrollment = {
    id: makeEnrollmentId(lead),
    status: 'active',
    enrolledAt: enrolledAt.toISOString(),
    email,
    phone: lead.phone || '',
    fullName: lead.fullName || '',
    lead,
    jobs: buildScheduledJobs(lead, enrolledAt)
  };

  queue.enrollments.push(enrollment);
  if (queue.enrollments.length > 5000) {
    queue.enrollments = queue.enrollments.slice(-5000);
  }
  writeQueue(queue);
  return { enrollmentId: enrollment.id, jobs: enrollment.jobs.length };
}

function getDueJobs(now = new Date()) {
  const queue = readQueue();
  const due = [];
  for (const enrollment of queue.enrollments) {
    if (enrollment.status !== 'active') continue;
    for (const job of enrollment.jobs) {
      if (job.status !== 'pending') continue;
      if (new Date(job.dueAt).getTime() <= now.getTime()) {
        due.push({ enrollment, job });
      }
    }
  }
  return due;
}

function markJob(enrollmentId, jobId, update) {
  const queue = readQueue();
  const enrollment = queue.enrollments.find((e) => e.id === enrollmentId);
  if (!enrollment) return false;
  const job = enrollment.jobs.find((j) => j.id === jobId);
  if (!job) return false;
  Object.assign(job, update);
  const allDone = enrollment.jobs.every((j) => j.status === 'sent' || j.status === 'skipped');
  if (allDone) {
    enrollment.status = 'completed';
    enrollment.completedAt = new Date().toISOString();
  }
  writeQueue(queue);
  return true;
}

module.exports = {
  enrollLead,
  getDueJobs,
  markJob,
  readQueue,
  QUEUE_PATH
};
