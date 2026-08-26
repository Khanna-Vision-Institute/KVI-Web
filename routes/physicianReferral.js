const express = require('express');
const axios = require('axios');
const multer = require('multer');
const zohoService = require('../services/zohoService');
const zohoBookingsService = require('../services/zohoBookingsService');

const { sendPhysicianReferralStaffNotification } = require('../services/emailService');

/** Same pairing as seminar pages + verified in routes/booking.js */
const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.RECAPTCHA_V2_SECRET_KEY ||
  '6Lf0P20sAAAAANP3mOsaj7QZ6bsl79cw_g49wnWn';

const ALLOW_EXT = /\.(png|jpg|jpeg|bmp|mp4|webm|mov|pdf|doc|docx)$/i;

async function verifyRecaptchaV2(token) {
  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET_KEY,
          response: token
        },
        timeout: 10000
      }
    );
    return !!(response.data && response.data.success);
  } catch (error) {
    console.error('[physician-referral] reCAPTCHA verification error:', error.message);
    return false;
  }
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function isUsPhone10(s) {
  let d = digitsOnly(s);
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  return d.length === 10;
}

function basicEmail(val) {
  return typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function splitJoined(val) {
  if (!val || typeof val !== 'string') return [];
  return val
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((item, ix, arr) => arr.indexOf(item) === ix);
}

function mapSharedCareLabel(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  if (s === 'comanage') {
    return 'I will comanage as soon as medically appropriate';
  }
  if (s === 'kvi-postop') {
    return 'KVI do post op & return for general eye care';
  }
  return s;
}

function splitName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Unknown' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function nonEmptyLine(v) {
  const x = typeof v === 'string' ? v.trim() : '';
  return x ? x : '—';
}

function sanitizeUploadName(name) {
  const base =
    typeof name === 'string' && name.trim()
      ? pathBasenameStrict(name.trim())
      : 'attachment';
  const clipped = base.length > 140 ? `${base.slice(0, 120)}_${Date.now().toString(36)}` : base;
  const safe = clipped.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, 'file');
  return safe || `file-${Date.now().toString(36)}`;
}

function pathBasenameStrict(p) {
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return slash >= 0 ? p.slice(slash + 1) : p;
}

function rejectDisallowedFilenames(files) {
  const bad = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const nm = typeof f.originalname === 'string' ? f.originalname : '';
    if (!ALLOW_EXT.test(nm)) bad.push(nm || '(unnamed)');
  }
  return bad;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024
  }
});

const uploadMw = upload.fields([
  { name: 'uploadInsurance', maxCount: 1 },
  { name: 'uploadClinicalChart', maxCount: 15 }
]);

const router = express.Router();

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;
const rateStore = new Map();

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  let ip = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : req.ip || 'unknown';
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  return ip || 'unknown';
}

function rateLimitSubmit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateStore.set(ip, { windowStart: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: 'Too many submissions. Please try again later.' });
  }
  return next();
}

router.post('/submit', rateLimitSubmit, (req, res, next) => {
  uploadMw(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'One or more files are too large (max ~25 MB each). Try smaller uploads.'
        });
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: 'Upload could not be processed. Please retry.' });
      }
      return next(err);
    }
    return next();
  });
}, async (req, res) => {
  try {
    const b = req.body || {};
    const recaptchaToken =
      typeof b.recaptchaToken === 'string'
        ? b.recaptchaToken.trim()
        : typeof b['g-recaptcha-response'] === 'string'
          ? String(b['g-recaptcha-response']).trim()
          : '';

    if (!recaptchaToken) {
      return res.status(400).json({ success: false, message: 'Please complete the CAPTCHA verification.' });
    }

    const recaptchaOk = await verifyRecaptchaV2(recaptchaToken);
    if (!recaptchaOk) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed. Please try again.'
      });
    }

    const hp = typeof b.companyWebsite === 'string' ? b.companyWebsite.trim() : '';
    if (hp) {
      console.warn('[physician-referral] honeypot filled');
      return res.status(400).json({ success: false, message: 'Submission could not be processed.' });
    }

    const patientName = typeof b.patientName === 'string' ? b.patientName.trim() : '';
    const patientPhone =
      typeof b.patientPhone === 'string' ? b.patientPhone.trim() : '';
    const patientEmail =
      typeof b.patientEmail === 'string' ? b.patientEmail.trim() : '';

    const preferredLocations = splitJoined(b.preferredLocationJoined);
    const diagnoses = splitJoined(b.diagnosisJoined);
    const procedures = splitJoined(b.procedureJoined);
    const clinicalData = splitJoined(b.clinicalDataJoined);

    const preferredDoctor =
      typeof b.preferredDoctor === 'string' ? b.preferredDoctor.trim() : '';
    const submittedBy = typeof b.submittedBy === 'string' ? b.submittedBy.trim() : '';

    const personalized =
      !!(b.referringOfficeSlug && String(b.referringOfficeSlug).trim()) ||
      !!(b.referringUrlKey && String(b.referringUrlKey).trim());

    const referringDoctorName =
      typeof b.referringDoctorName === 'string' ? b.referringDoctorName.trim() : '';
    const referringDoctorPhoneRaw =
      typeof b.referringDoctorPhone === 'string' ? b.referringDoctorPhone.trim() : '';

    const errs = [];
    if (!patientName) errs.push('Patient name is required.');
    if (!patientPhone || !isUsPhone10(patientPhone)) errs.push('Patient phone must include a valid 10-digit US number.');
    if (!patientEmail || !basicEmail(patientEmail)) errs.push('A valid patient email is required.');
    if (!preferredLocations.length) errs.push('Select at least one preferred location.');
    if (!diagnoses.length && !procedures.length) errs.push('Select at least one diagnosis or suggested procedure.');
    if (!preferredDoctor) errs.push('Doctor selection is required.');

    if (personalized) {
      if (!referringDoctorName) errs.push('Referring doctor name is required for linked worksheets.');
      if (!isUsPhone10(referringDoctorPhoneRaw))
        errs.push('Referring doctor phone must be a 10-digit US number for linked worksheets.');
    }

    if (errs.length) {
      return res.status(400).json({ success: false, message: errs[0] });
    }

    const builtAtt = buildReferralAttachmentsFromUploads(req.files);
    if (builtAtt.error) {
      return res.status(400).json({ success: false, message: builtAtt.error });
    }
    const attachments = builtAtt.attachments;

    const { crmResult, crmError, crmLeadId } = await syncReferralToZohoCrm(b, attachments, {
      header: 'Physician Referral Worksheet',
      leadSource: 'Doctor Referral Worksheet'
    });

    try {
      const referringUrlKey =
        typeof b.referringUrlKey === 'string' && b.referringUrlKey.trim()
          ? b.referringUrlKey.trim()
          : typeof b.referringOfficeSlug === 'string' && b.referringOfficeSlug.trim()
            ? b.referringOfficeSlug.trim()
            : '';
      const pageUrl = referringUrlKey ? `/${referringUrlKey}` : 'referral-worksheet';
      const zb = await zohoBookingsService.syncConsultBooking({
        fullName: patientName,
        email: patientEmail,
        phone: patientPhone,
        location: zohoBookingsService.pickReferralLocation(preferredLocations),
        date: '',
        time: '',
        source: 'referral-worksheet',
        allowPlaceholderIntake: true,
        pageUrl,
        notes: [
          'Physician referral worksheet',
          `Practice: ${nonEmptyLine(typeof b.referringDoctorPractice === 'string' ? b.referringDoctorPractice : '')}`,
          `Referring doctor: ${nonEmptyLine(referringDoctorName)}`,
          `Diagnosis: ${diagnoses.length ? diagnoses.join(', ') : '—'}`,
          `Procedure: ${procedures.length ? procedures.join(', ') : '—'}`,
          `KVI doctor: ${nonEmptyLine(preferredDoctor)}`
        ].join('\n'),
        additionalFields: {
          'Referring practice':
            typeof b.referringDoctorPractice === 'string' ? b.referringDoctorPractice.trim() : '',
          'Worksheet path': pageUrl
        }
      });
      if (zb && !zb.ok && !zb.skipped) {
        console.warn('[physician-referral] Zoho Bookings:', zb.error || zb.reason);
      }
    } catch (zbErr) {
      console.error('[physician-referral] Zoho Bookings sync error:', zbErr.message || zbErr);
    }

    await sendPhysicianReferralStaffNotification(buildReferralStaffEmailPayload(b), attachments);

    if (crmError) {
      return res.json({
        success: true,
        message:
          'Referral submitted — our team will follow up at the contacts provided.',
        crmSynced: false
      });
    }

    return res.json({
      success: true,
      message: 'Referral submitted — our team will follow up at the contacts provided.',
      crmSynced: true,
      crmLeadId: crmLeadId || null
    });
  } catch (err) {
    console.error('[physician-referral] submit error:', err && err.message ? err.message : err);
    return res.status(500).json({
      success: false,
      message: 'Could not submit right now. Please call (805) 230-2126.'
    });
  }
});

function joinCheckedFromBody(b, name) {
  const raw =
    typeof b[name + 'Joined'] === 'string'
      ? b[name + 'Joined']
      : typeof b[name] === 'string'
        ? b[name]
        : '';
  return splitJoined(raw);
}

function buildReferralAttachmentsFromUploads(files) {
  const insuranceArr = files && files.uploadInsurance ? files.uploadInsurance : [];
  const chartArr = files && files.uploadClinicalChart ? files.uploadClinicalChart : [];
  const allUploads = [].concat(insuranceArr || [], chartArr || []);
  const badNames = rejectDisallowedFilenames(allUploads);
  if (badNames.length) {
    return { attachments: [], error: 'Unsupported file type. Use png, jpg, pdf, mp4/mov/webm, or doc/docx only.' };
  }

  const attachments = [];
  for (let i = 0; i < insuranceArr.length; i += 1) {
    const f = insuranceArr[i];
    if (!f.buffer || !f.size) continue;
    attachments.push({
      filename: `insurance-${sanitizeUploadName(f.originalname)}`,
      content: f.buffer,
      contentType: f.mimetype || undefined
    });
  }
  for (let j = 0; j < chartArr.length; j += 1) {
    const f = chartArr[j];
    if (!f.buffer || !f.size) continue;
    attachments.push({
      filename: `chart-${j + 1}-${sanitizeUploadName(f.originalname)}`,
      content: f.buffer,
      contentType: f.mimetype || undefined
    });
  }
  return { attachments, error: null };
}

function buildReferralStaffEmailPayload(b, extra = {}) {
  const preferredLocations = joinCheckedFromBody(b, 'preferredLocation');
  const diagnoses = joinCheckedFromBody(b, 'diagnosis');
  const procedures = joinCheckedFromBody(b, 'procedure');
  const clinicalData = joinCheckedFromBody(b, 'clinicalData');
  const sharedCareRaw = typeof b.sharedCare === 'string' ? b.sharedCare.trim() : '';
  const personalized =
    !!(b.referringOfficeSlug && String(b.referringOfficeSlug).trim()) ||
    !!(b.referringUrlKey && String(b.referringUrlKey).trim());

  return {
    referringDoctorName:
      typeof b.referringDoctorName === 'string' ? b.referringDoctorName.trim() : '',
    referringDoctorPractice:
      typeof b.referringDoctorPractice === 'string' ? b.referringDoctorPractice.trim() : '',
    referringDoctorPhoneRaw:
      typeof b.referringDoctorPhone === 'string' ? b.referringDoctorPhone.trim() : '',
    referringDoctorAddress:
      typeof b.referringDoctorAddress === 'string' ? b.referringDoctorAddress.trim() : '',
    personalized,
    patientName: typeof b.patientName === 'string' ? b.patientName.trim() : '',
    patientDobAge: typeof b.patientDobAge === 'string' ? b.patientDobAge.trim() : '',
    patientPhone: typeof b.patientPhone === 'string' ? b.patientPhone.trim() : '',
    patientEmail: typeof b.patientEmail === 'string' ? b.patientEmail.trim() : '',
    preferredLocations,
    diagnoses,
    procedures,
    sharedCare: mapSharedCareLabel(sharedCareRaw),
    clinicalData,
    specialInstructions:
      typeof b.specialInstructions === 'string' ? b.specialInstructions.trim() : '',
    preferredDoctor: typeof b.preferredDoctor === 'string' ? b.preferredDoctor.trim() : '',
    submittedBy: typeof b.submittedBy === 'string' ? b.submittedBy.trim() : '',
    scheduledDate: extra.scheduledDate || '',
    scheduledTime: extra.scheduledTime || '',
    bookingId: extra.bookingId || '',
    emailKind: extra.emailKind || 'worksheet'
  };
}

function extractCrmLeadId(crmResult) {
  if (!crmResult || !crmResult.details) return null;
  const d = crmResult.details;
  if (d.details && d.details.id) return String(d.details.id);
  if (d.id) return String(d.id);
  return null;
}

function buildReferralCrmDescription(b, opts = {}) {
  const patientName = typeof b.patientName === 'string' ? b.patientName.trim() : '';
  const patientPhone = typeof b.patientPhone === 'string' ? b.patientPhone.trim() : '';
  const patientEmail = typeof b.patientEmail === 'string' ? b.patientEmail.trim() : '';
  const preferredLocations = joinCheckedFromBody(b, 'preferredLocation');
  const diagnoses = joinCheckedFromBody(b, 'diagnosis');
  const procedures = joinCheckedFromBody(b, 'procedure');
  const clinicalData = joinCheckedFromBody(b, 'clinicalData');
  const sharedCareRaw = typeof b.sharedCare === 'string' ? b.sharedCare.trim() : '';
  const referringDoctorName =
    typeof b.referringDoctorName === 'string' ? b.referringDoctorName.trim() : '';
  const referringDoctorPhoneRaw =
    typeof b.referringDoctorPhone === 'string' ? b.referringDoctorPhone.trim() : '';
  const personalized =
    !!(b.referringOfficeSlug && String(b.referringOfficeSlug).trim()) ||
    !!(b.referringUrlKey && String(b.referringUrlKey).trim());
  const preferredDoctor = typeof b.preferredDoctor === 'string' ? b.preferredDoctor.trim() : '';
  const submittedBy = typeof b.submittedBy === 'string' ? b.submittedBy.trim() : '';

  const lines = [
    opts.header || 'Physician Referral Worksheet',
    '-----------------------',
    `Patient Name: ${nonEmptyLine(patientName)}`,
    `Patient DOB/Age: ${nonEmptyLine(typeof b.patientDobAge === 'string' ? b.patientDobAge : '')}`,
    `Patient Phone: ${nonEmptyLine(patientPhone)}`,
    `Patient Email: ${nonEmptyLine(patientEmail)}`,
    `Preferred Location(s): ${preferredLocations.length ? preferredLocations.join(', ') : '—'}`,
    `Diagnosis: ${diagnoses.length ? diagnoses.join(', ') : '—'}`,
    `Suggested Procedure(s): ${procedures.length ? procedures.join(', ') : '—'}`,
    `Clinical Data: ${clinicalData.length ? clinicalData.join(', ') : '—'}`,
    `Shared Care: ${nonEmptyLine(mapSharedCareLabel(sharedCareRaw))}`,
    `Special Instructions: ${nonEmptyLine(typeof b.specialInstructions === 'string' ? b.specialInstructions : '')}`,
    '',
    `Referring Doctor: ${nonEmptyLine(referringDoctorName)}`,
    `Referring Practice: ${nonEmptyLine(typeof b.referringDoctorPractice === 'string' ? b.referringDoctorPractice : '')}`,
    `Referring Doctor Phone: ${nonEmptyLine(referringDoctorPhoneRaw)}`,
    `Referring Doctor Address: ${nonEmptyLine(typeof b.referringDoctorAddress === 'string' ? b.referringDoctorAddress : '')}`,
    `Worksheet Doctor Selection: ${nonEmptyLine(preferredDoctor)}`,
    `Submitted By: ${nonEmptyLine(submittedBy)}`,
    '',
    `Referring Office Slug: ${nonEmptyLine(typeof b.referringOfficeSlug === 'string' ? b.referringOfficeSlug : '')}`,
    `Referring URL Key: ${nonEmptyLine(typeof b.referringUrlKey === 'string' ? b.referringUrlKey : '')}`,
    `Personalized Worksheet: ${personalized ? 'Yes' : 'No'}`
  ];

  if (opts.scheduledDate || opts.scheduledTime) {
    lines.push(
      '',
      '[Scheduled appointment]',
      `Appointment date: ${nonEmptyLine(opts.scheduledDate)}`,
      `Appointment time: ${nonEmptyLine(opts.scheduledTime)}`,
      `Zoho booking ID: ${nonEmptyLine(opts.bookingId)}`
    );
  }

  lines.push(`Submitted: ${new Date().toLocaleString()}`);
  if (opts.footer) lines.push(opts.footer);

  return lines.join('\n');
}

function buildReferralCrmLeadData(b, opts = {}) {
  const patientName = typeof b.patientName === 'string' ? b.patientName.trim() : '';
  const patientEmail = typeof b.patientEmail === 'string' ? b.patientEmail.trim() : '';
  const patientPhone = typeof b.patientPhone === 'string' ? b.patientPhone.trim() : '';
  const { firstName, lastName } = splitName(patientName);

  return {
    firstName,
    lastName,
    email: patientEmail,
    phone: patientPhone,
    leadSource: opts.leadSource || 'Doctor Referral Worksheet',
    company:
      typeof b.referringDoctorPractice === 'string' && b.referringDoctorPractice.trim()
        ? b.referringDoctorPractice.trim()
        : 'Physician Referral Lead',
    leadStatus: process.env.ZOHO_PHYSICIAN_REFERRAL_LEAD_STATUS || process.env.ZOHO_BOOKING_LEAD_STATUS || undefined,
    customDescription: buildReferralCrmDescription(b, opts),
    customFields: {}
  };
}

/**
 * Upsert Zoho CRM lead + upload clinical/insurance attachments.
 * @returns {Promise<{ crmResult: object|null, crmError: Error|null, crmLeadId: string|null, crmSynced: boolean }>}
 */
async function syncReferralToZohoCrm(b, attachments, opts = {}) {
  const leadData = buildReferralCrmLeadData(b, opts);
  let crmResult = null;
  let crmError = null;

  try {
    crmResult = await zohoService.upsertLead(leadData);
  } catch (zohoErr) {
    crmError = zohoErr;
    console.error(
      '[physician-referral] Zoho CRM upsert failed:',
      zohoErr.response?.data || zohoErr.message || zohoErr
    );
  }

  const crmLeadId = extractCrmLeadId(crmResult);
  if (!crmLeadId && crmResult) {
    console.warn('[physician-referral] CRM upsert ok but lead id missing:', JSON.stringify(crmResult.details || {}).slice(0, 400));
  }

  if (crmLeadId && Array.isArray(attachments) && attachments.length) {
    for (const att of attachments) {
      try {
        await zohoService.uploadAttachment(
          crmLeadId,
          att.content,
          att.filename,
          att.contentType || 'application/octet-stream'
        );
      } catch (attErr) {
        console.error(
          '[physician-referral] CRM attachment upload failed:',
          att.filename,
          attErr.response?.data || attErr.message || attErr
        );
      }
    }
  } else if (crmResult && Array.isArray(attachments) && attachments.length && !crmLeadId) {
    console.warn('[physician-referral] CRM lead ID not found — attachments not uploaded to CRM.');
  }

  return {
    crmResult,
    crmError,
    crmLeadId,
    crmSynced: Boolean(crmResult && !crmError && crmLeadId)
  };
}

function buildReferralScheduleNotes(b, extraLines) {
  const lines = Array.isArray(extraLines) ? extraLines.slice() : [];
  const doc = typeof b.preferredDoctor === 'string' ? b.preferredDoctor.trim() : '';
  const practice = typeof b.referringDoctorPractice === 'string' ? b.referringDoctorPractice.trim() : '';
  if (doc) lines.push(`Referring doctor: ${doc}`);
  if (practice) lines.push(`Practice: ${practice}`);
  const dx = joinCheckedFromBody(b, 'diagnosis');
  const proc = joinCheckedFromBody(b, 'procedure');
  if (dx.length) lines.push(`Diagnosis: ${dx.join(', ')}`);
  if (proc.length) lines.push(`Procedure: ${proc.join(', ')}`);
  const instr =
    typeof b.specialInstructions === 'string' ? b.specialInstructions.trim() : '';
  if (instr) lines.push(`Special instructions: ${instr}`);
  lines.push('Booked via referral worksheet Schedule now (KVI scheduler).');
  return lines.filter(Boolean).join('\n');
}

router.get('/zoho-available-slots', async (req, res) => {
  try {
    if (!zohoBookingsService.isEnabled()) {
      return res.status(503).json({ ok: false, message: 'Online scheduling is not available right now.' });
    }

    const dateRaw = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : '';

    if (!parsed) {
      return res.status(400).json({ ok: false, message: 'Valid date (YYYY-MM-DD) is required.' });
    }

    const preferredLocations = splitJoined(
      typeof req.query.preferredLocationJoined === 'string' ? req.query.preferredLocationJoined : ''
    );
    const location = zohoBookingsService.pickReferralLocation(preferredLocations);
    const { serviceId, staffId } = zohoBookingsService.resolveReferralScheduleTarget(location);

    if (!serviceId || !staffId) {
      return res.status(503).json({ ok: false, message: 'Scheduler is not configured. Please call (805) 230-2126.' });
    }

    const result = await zohoBookingsService.fetchAvailableSlots({
      serviceId,
      staffId,
      dateIso: parsed
    });

    if (!result.ok) {
      return res.status(502).json({
        ok: false,
        message: result.error || 'Could not load available times. Please try another date.'
      });
    }

    return res.json({
      ok: true,
      date: parsed,
      slots: result.slots || [],
      timezone: result.timezone || process.env.ZOHO_BOOKINGS_TIMEZONE || 'America/Los_Angeles'
    });
  } catch (err) {
    console.error('[physician-referral] zoho-available-slots:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, message: 'Could not load times. Please try again.' });
  }
});

router.post('/zoho-book-appointment', rateLimitSubmit, (req, res, next) => {
  uploadMw(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          ok: false,
          message: 'One or more files are too large (max ~25 MB each). Try smaller uploads.'
        });
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ ok: false, message: 'Upload could not be processed. Please retry.' });
      }
      return next(err);
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!zohoBookingsService.isEnabled()) {
      return res.status(503).json({ ok: false, message: 'Online scheduling is not available right now.' });
    }

    const b = req.body || {};
    const recaptchaToken =
      typeof b.recaptchaToken === 'string'
        ? b.recaptchaToken.trim()
        : typeof b['g-recaptcha-response'] === 'string'
          ? String(b['g-recaptcha-response']).trim()
          : '';

    if (!recaptchaToken) {
      return res.status(400).json({
        ok: false,
        message: 'Please complete the CAPTCHA verification before confirming.'
      });
    }

    const recaptchaOk = await verifyRecaptchaV2(recaptchaToken);
    if (!recaptchaOk) {
      return res.status(400).json({
        ok: false,
        message: 'CAPTCHA verification failed. Please try again.'
      });
    }

    const patientName = typeof b.patientName === 'string' ? b.patientName.trim() : '';
    const patientEmail = typeof b.patientEmail === 'string' ? b.patientEmail.trim() : '';
    const patientPhone = typeof b.patientPhone === 'string' ? b.patientPhone.trim() : '';
    const dateRaw = typeof b.date === 'string' ? b.date.trim() : '';
    const timeRaw = typeof b.time === 'string' ? b.time.trim() : '';

    if (!patientName) {
      return res.status(400).json({ ok: false, message: 'Patient name is required.' });
    }
    if (!basicEmail(patientEmail)) {
      return res.status(400).json({ ok: false, message: 'Valid patient email is required.' });
    }
    if (!isUsPhone10(patientPhone)) {
      return res.status(400).json({ ok: false, message: 'Valid US patient phone is required.' });
    }
    if (!dateRaw || !timeRaw) {
      return res.status(400).json({ ok: false, message: 'Date and time are required.' });
    }

    const builtAtt = buildReferralAttachmentsFromUploads(req.files);
    if (builtAtt.error) {
      return res.status(400).json({ ok: false, message: builtAtt.error });
    }

    const preferredLocations = joinCheckedFromBody(b, 'preferredLocation');
    const location = zohoBookingsService.pickReferralLocation(preferredLocations);
    const timeLabel = zohoBookingsService.normalizeSlotToTimeLabel(timeRaw);

    const { crmError, crmLeadId, crmSynced } = await syncReferralToZohoCrm(b, builtAtt.attachments, {
      header: 'Physician Referral Worksheet — appointment scheduled',
      leadSource: 'Doctor Referral Worksheet (Scheduled)',
      scheduledDate: dateRaw,
      scheduledTime: timeLabel || timeRaw,
      footer: 'Submitted via referral worksheet · Schedule now · Confirm appointment'
    });

    if (crmError) {
      console.warn(
        '[physician-referral] CRM sync failed for scheduled booking (continuing):',
        crmError.response?.data || crmError.message || crmError
      );
    }

    const booking = await zohoBookingsService.syncConsultBooking({
      fullName: patientName,
      email: patientEmail,
      phone: patientPhone,
      location,
      date: dateRaw,
      time: timeLabel,
      notes: buildReferralScheduleNotes(b, []),
      source: 'doctor-portal',
      pageUrl: '/Doctorportal/refer-a-patient (Schedule now)',
      allowPlaceholderIntake: false
    });

    if (!booking.ok) {
      const msg =
        booking.reason === 'missing_or_invalid_datetime'
          ? 'That time is no longer available. Please pick another slot.'
          : booking.error || 'Could not book this appointment. Please call (805) 230-2126.';
      return res.status(502).json({ ok: false, message: msg });
    }

    const bookingId =
      booking.booking && booking.booking.booking_id ? String(booking.booking.booking_id) : '';

    try {
      await sendPhysicianReferralStaffNotification(
        buildReferralStaffEmailPayload(b, {
          emailKind: 'scheduled',
          scheduledDate: dateRaw,
          scheduledTime: timeLabel || timeRaw,
          bookingId
        }),
        builtAtt.attachments
      );
    } catch (mailErr) {
      console.error(
        '[physician-referral] schedule staff email failed (booking ok):',
        mailErr && mailErr.message ? mailErr.message : mailErr
      );
    }

    return res.json({
      ok: true,
      message: 'Appointment booked. Our team will confirm details shortly.',
      bookingId: bookingId || null,
      crmSynced: Boolean(crmSynced),
      crmLeadId: crmLeadId || null
    });
  } catch (err) {
    console.error('[physician-referral] zoho-book-appointment:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, message: 'Could not book right now. Please call (805) 230-2126.' });
  }
});

module.exports = router;
