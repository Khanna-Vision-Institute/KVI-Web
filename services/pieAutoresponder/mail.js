const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let transporter;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP not configured for PIE autoresponder mail');
    }
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: { user, pass }
    });
  }
  return transporter;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const staffTo =
  process.env.PIE_AUTORESPONDER_STAFF_EMAIL ||
  process.env.VISION_QUEST_EMAIL_TO ||
  'rajesh@khannavision.com, info@khannavision.com, kapil@khannavision.com';

const fromDefault =
  process.env.PIE_AUTORESPONDER_EMAIL_FROM ||
  process.env.BOOKING_EMAIL_FROM ||
  process.env.VISION_QUEST_EMAIL_FROM;

async function sendDay5PatientEmail({ to, subject, text }) {
  const html = text
    .split('\n')
    .map((line) => `<p style="font-size:15px;line-height:1.6;">${esc(line) || '&nbsp;'}</p>`)
    .join('');
  return getTransporter().sendMail({
    from: fromDefault,
    to,
    subject,
    text,
    html: `<body style="font-family:sans-serif;max-width:600px;padding:24px;">${html}</body>`
  });
}

async function sendStaffCallUrgentEmail({ lead, callKind, reason, script }) {
  const label =
    callKind === 'day7' ? 'PIE Day 7 follow-up call' : 'PIE Day 0 immediate follow-up call';
  const fields = [
    ['Lead', lead.fullName],
    ['Phone', lead.phone],
    ['Email', lead.email],
    ['Age', lead.age],
    ['Location', lead.location],
    ['Consult', `${lead.date || ''} ${lead.time || ''}`],
    ['Note', reason]
  ];
  const text = `${label} — CALL NOW\n\n${fields.map(([k, v]) => `${k}: ${v || '—'}`).join('\n')}\n\n--- SCRIPT ---\n\n${script}`;
  return getTransporter().sendMail({
    from: fromDefault,
    to: staffTo,
    subject: `${label}: ${lead.fullName || lead.phone || 'PIE lead'}`,
    text
  });
}

module.exports = { sendDay5PatientEmail, sendStaffCallUrgentEmail };
