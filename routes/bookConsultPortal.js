const express = require('express');
const axios = require('axios');
const multer = require('multer');

const { sendDoctorportalBookConsultStaffEmail } = require('../services/emailService');
const zohoService = require('../services/zohoService');
const zohoBookingsService = require('../services/zohoBookingsService');

const ALLOW_EXT = /\.(png|jpg|jpeg|bmp|mp4|webm|mov|pdf|doc|docx)$/i;

/** Same pairing as booking / seminar / physician referral worksheets */
const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.RECAPTCHA_V2_SECRET_KEY ||
  '6Lf0P20sAAAAANP3mOsaj7QZ6bsl79cw_g49wnWn';

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
    console.error('[book-consult-portal] reCAPTCHA verification error:', error.message);
    return false;
  }
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function basicEmail(val) {
  return typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

/** At least 10 digits (US-ish); tolerate formatting */
function looksLikeUsPhone(raw) {
  const d = digitsOnly(raw);
  if (d.length === 11 && d.charAt(0) === '1') return d.slice(1).length === 10;
  return d.length >= 10;
}

function stripStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function pathBasenameStrict(p) {
  const slash = Math.max(String(p || '').lastIndexOf('/'), String(p || '').lastIndexOf('\\'));
  return slash >= 0 ? String(p).slice(slash + 1) : String(p || '');
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

function rejectDisallowedFilenames(files) {
  const bad = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const nm = typeof f.originalname === 'string' ? f.originalname : '';
    if (!ALLOW_EXT.test(nm)) bad.push(nm || '(unnamed)');
  }
  return bad;
}

const REFERRAL_WORKSHEET_DRAFT_MAX_CHARS = 95000;

const bookConsultUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024,
    fields: 60,
    /** Large JSON draft + normal fields */
    fieldSize: 2 * 1024 * 1024
  }
});

const bookConsultUploadMw = bookConsultUpload.fields([
  { name: 'uploadInsurance', maxCount: 1 },
  { name: 'uploadClinicalChart', maxCount: 15 }
]);

/** @param {string} rawJson */
function summarizeReferralWorksheetDraft(rawJson) {
  const raw = stripStr(rawJson);
  if (!raw) return '';

  let clipped = raw;
  if (clipped.length > REFERRAL_WORKSHEET_DRAFT_MAX_CHARS) {
    clipped = `${clipped.slice(0, REFERRAL_WORKSHEET_DRAFT_MAX_CHARS)}\n\n...[truncated server-side]`;
  }

  /** @param {string} k @param {unknown} val */
  function line(k, val) {
    if (val === undefined || val === null) return '';
    const s = String(val).replace(/\r?\n/g, ' ').trim();
    if (!s) return '';
    return `${k}: ${s}`;
  }

  try {
    const o = JSON.parse(clipped);
    if (!o || typeof o !== 'object') return clipped;

    const meta = [];
    meta.push('Referral worksheet snapshot (Schedule now handoff)');
    if (o.personalized != null) meta.push(line('Personalized worksheet', o.personalized ? 'yes' : 'no'));

    const refCtx = [];
    refCtx.push(line('Referring practice', o.referringDoctorPractice));
    refCtx.push(line('Referring doctor', o.referringDoctorName));
    refCtx.push(line('Referring phone', o.referringDoctorPhone));
    refCtx.push(line('Referring address', o.referringDoctorAddress));

    const patient = [];
    patient.push(line('Patient name', o.patientName));
    patient.push(line('DOB / age', o.patientDobAge));
    patient.push(line('Patient phone', o.patientPhone));
    patient.push(line('Patient email', o.patientEmail));
    patient.push(line('Preferred locations', o.preferredLocationJoined));
    patient.push(line('Diagnosis', o.diagnosisJoined));
    patient.push(line('Suggested procedure', o.procedureJoined));
    patient.push(line('Clinical data noted', o.clinicalDataJoined));
    patient.push(line('Shared care', o.sharedCare));
    patient.push(line('Special instructions', o.specialInstructions));
    patient.push(line('Referring doctor dropdown', o.preferredDoctor));
    patient.push(line('Submitted by', o.submittedBy));

    const chunks = [
      meta.filter(Boolean).join('\n'),
      `--- Referring context ---\n${refCtx.filter(Boolean).join('\n')}`,
      `--- Patient (worksheet) ---\n${patient.filter(Boolean).join('\n')}`
    ];
    return chunks.filter((c) => c && String(c).trim()).join('\n\n');
  } catch (_) {
    return clipped;
  }
}

function apptForLabel(v) {
  if (stripStr(v).toLowerCase() === 'physician') return "Doctor's office referral";
  return 'Patient (self-scheduling)';
}

const router = express.Router();

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 24;
const rateStore = new Map();

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
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
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }
  return next();
}

router.post(
  '/',
  rateLimitSubmit,
  (req, res, next) => {
    bookConsultUploadMw(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'One or more files are too large (max ~25 MB each). Try smaller uploads.'
        });
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: 'Upload could not be processed. Please retry.'
        });
      }
      if (err) return next(err);
      return next();
    });
  },
  async (req, res) => {
    try {
      const b = req.body || {};

      const recaptchaTokenRaw =
        typeof b.recaptchaToken === 'string'
          ? b.recaptchaToken.trim()
          : typeof b['g-recaptcha-response'] === 'string'
            ? String(b['g-recaptcha-response']).trim()
            : '';

      if (!recaptchaTokenRaw) {
        return res.status(400).json({ success: false, message: 'Please complete the CAPTCHA verification.' });
      }

      const recaptchaOk = await verifyRecaptchaV2(recaptchaTokenRaw);
      if (!recaptchaOk) {
        return res.status(400).json({ success: false, message: 'CAPTCHA verification failed. Please try again.' });
      }

      const visitType = stripStr(b.visitType);
      const firstName = stripStr(b.firstName);
      const lastName = stripStr(b.lastName);
      const phone = stripStr(b.phone);
      const email = stripStr(b.email);
      const dob = stripStr(b.dob);
      const preferredLocation = stripStr(b.preferredLocation) || 'Either';
      const preferredDate = stripStr(b.preferredDate);
      const preferredTime = stripStr(b.preferredTime);
      const notes = stripStr(b.notes);
      const apptFor = stripStr(b.apptFor) || 'patient';
      const referringDoctorName = stripStr(b.referringDoctorName);
      const referringDoctorPractice = stripStr(b.referringDoctorPractice);
      const referringDoctorPhone = stripStr(b.referringDoctorPhone);
      const referringDoctorAddress = stripStr(b.referringDoctorAddress);
      const referringSubmittedBy = stripStr(b.referringSubmittedBy);

      const errs = [];
      if (!visitType) errs.push('Please select a visit type.');
      if (!firstName) errs.push('First name is required.');
      if (!lastName) errs.push('Last name is required.');
      if (!phone || !looksLikeUsPhone(phone)) errs.push('Please enter a valid phone number.');
      if (!email || !basicEmail(email)) errs.push('A valid email is required.');
      if (apptFor === 'physician') {
        if (!referringDoctorName) errs.push('Referring doctor name is required for office referrals.');
        if (!referringDoctorPhone || !looksLikeUsPhone(referringDoctorPhone)) {
          errs.push('A valid referring office phone number is required.');
        }
      }
      if (errs.length) return res.status(400).json({ success: false, message: errs[0] });

      const insuranceArr = req.files && req.files.uploadInsurance ? req.files.uploadInsurance : [];
      const chartArr = req.files && req.files.uploadClinicalChart ? req.files.uploadClinicalChart : [];
      const allUploads = ([]).concat(insuranceArr || [], chartArr || []);

      const badUploadNames = rejectDisallowedFilenames(allUploads);
      if (badUploadNames.length) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported file type. Use png, jpg, pdf, mp4/mov/webm, bmp, or doc/docx only.'
        });
      }

      const attachments = [];
      for (let i = 0; i < insuranceArr.length; i += 1) {
        const f = insuranceArr[i];
        if (!f || !f.buffer || !f.size) continue;
        attachments.push({
          filename: `bc-insurance-${sanitizeUploadName(f.originalname)}`,
          content: f.buffer,
          contentType: f.mimetype || undefined
        });
      }
      for (let j = 0; j < chartArr.length; j += 1) {
        const f = chartArr[j];
        if (!f || !f.buffer || !f.size) continue;
        attachments.push({
          filename: `bc-chart-${j + 1}-${sanitizeUploadName(f.originalname)}`,
          content: f.buffer,
          contentType: f.mimetype || undefined
        });
      }

      const referralWorksheetDraftRaw =
        typeof b.referralWorksheetDraft === 'string' ? b.referralWorksheetDraft : '';
      const referralWorksheetSummary = summarizeReferralWorksheetDraft(referralWorksheetDraftRaw);

      const descriptionLines = [
        'Book Consultation — Doctor Portal',
        '-----------------------',
        `Appointment for: ${apptForLabel(apptFor)}`,
        `Visit type: ${visitType || '—'}`,
        `Name: ${firstName} ${lastName}`.trim(),
        `DOB: ${dob || '—'}`,
        `Phone: ${phone || '—'}`,
        `Email: ${email || '—'}`,
        `Preferred location: ${preferredLocation || '—'}`,
        `Preferred date: ${preferredDate || '—'}`,
        `Preferred time: ${preferredTime || '—'}`,
        `Notes: ${notes || '—'}`
      ];

      if (apptFor === 'physician') {
        descriptionLines.push(
          '',
          '[Referring doctor / practice]',
          `Referring doctor: ${referringDoctorName || '—'}`,
          `Practice: ${referringDoctorPractice || '—'}`,
          `Referring phone: ${referringDoctorPhone || '—'}`,
          `Practice address: ${referringDoctorAddress || '—'}`,
          `Submitted by: ${referringSubmittedBy || '—'}`
        );
      }

      if (referralWorksheetSummary) {
        descriptionLines.push('', referralWorksheetSummary);
      }

      descriptionLines.push('', `Submitted: ${new Date().toLocaleString()}`);

      const zohoLeadData = {
        firstName,
        lastName: lastName || 'Unknown',
        email,
        phone,
        leadSource:
          apptFor === 'physician'
            ? 'Book Consultation (Doctor Office Referral)'
            : 'Book Consultation (Doctor Portal)',
        company:
          apptFor === 'physician' && referringDoctorPractice
            ? referringDoctorPractice
            : 'Consultation Request',
        leadStatus: process.env.ZOHO_BOOKING_LEAD_STATUS || undefined,
        customDescription: descriptionLines.join('\n'),
        customFields: {}
      };

      try {
        await zohoService.upsertLead(zohoLeadData);
      } catch (zohoErr) {
        console.error(
          '[book-consult-portal] Zoho CRM upsert failed (email still attempted):',
          zohoErr.response?.data || zohoErr.message || zohoErr
        );
      }

      const hasReferralHandoff = !!referralWorksheetSummary;
      const shouldSyncBookings =
        preferredDate || preferredTime || hasReferralHandoff;

      if (shouldSyncBookings) {
        try {
          const zb = await zohoBookingsService.syncConsultBooking({
            fullName: `${firstName} ${lastName}`.trim(),
            email,
            phone,
            location: preferredLocation,
            date: preferredDate,
            time: preferredTime,
            allowPlaceholderIntake: hasReferralHandoff || Boolean(preferredDate && !preferredTime),
            source: hasReferralHandoff ? 'referral-worksheet' : 'doctor-portal',
            pageUrl: hasReferralHandoff
              ? '/Doctorportal/book-consultation?referral-handoff'
              : '/Doctorportal/book-consultation',
            notes: [
              hasReferralHandoff ? 'Schedule now from referral worksheet' : '',
              `Visit type: ${visitType || '—'}`,
              `Appointment for: ${apptForLabel(apptFor)}`,
              apptFor === 'physician'
                ? `Referring: ${referringDoctorName || '—'} · ${referringDoctorPractice || '—'} · ${referringDoctorPhone || '—'}`
                : '',
              notes ? `Notes: ${notes}` : '',
              hasReferralHandoff ? referralWorksheetSummary.slice(0, 4000) : ''
            ]
              .filter(Boolean)
              .join('\n'),
            additionalFields: {
              'Visit type': visitType || '',
              'Appointment for': apptForLabel(apptFor)
            }
          });
          if (zb && !zb.ok && !zb.skipped) {
            console.warn('[book-consult-portal] Zoho Bookings:', zb.error || zb.reason);
          }
        } catch (zbErr) {
          console.error('[book-consult-portal] Zoho Bookings sync error:', zbErr.message || zbErr);
        }
      }

      await sendDoctorportalBookConsultStaffEmail({
        apptForLabel: apptForLabel(apptFor),
        visitType,
        preferredLocation,
        preferredDate,
        preferredTime,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        dob,
        phone,
        email,
        notes,
        referringDoctorName,
        referringDoctorPractice,
        referringDoctorPhone,
        referringDoctorAddress,
        referringSubmittedBy,
        referralWorksheetSummary,
        referralWorksheetDraftRaw,
        sourcePath: '/Doctorportal/book-consultation',
        attachmentsInput: attachments
      });

      return res.json({
        success: true,
        message: 'Request received.'
      });
    } catch (err) {
      console.error('[book-consult-portal] submit error:', err && err.message ? err.message : err);
      return res.status(500).json({
        success: false,
        message: 'Could not submit right now. Please call (805) 230-2126.'
      });
    }
  }
);

module.exports = router;
