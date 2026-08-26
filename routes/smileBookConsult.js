const express = require('express');
const axios = require('axios');
const router = express.Router();
const {
  sendSmileBookConsultStaffNotification,
  sendSmileBookConsultUserThankYou
} = require('../services/emailService');
const zohoService = require('../services/zohoService');
const zohoBookingsService = require('../services/zohoBookingsService');

const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.RECAPTCHA_V2_SECRET_KEY ||
  '6Lf0P20sAAAAANP3mOsaj7QZ6bsl79cw_g49wnWn';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 20;
const rateStore = new Map();

async function verifyRecaptchaV2(token) {
  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET_KEY,
          response: token
        }
      }
    );
    if (response.data && response.data.success === true) return true;
    console.error('SMILE book consult reCAPTCHA not successful:', response.data || response.status);
    return false;
  } catch (error) {
    console.error('SMILE book consult reCAPTCHA error:', error.message);
    return false;
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  let ip =
    req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : req.ip || 'unknown';
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.slice('::ffff:'.length);
  }
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
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
  return next();
}

function validateFullName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 120) return false;
  if (!/[a-zA-Z]/.test(n)) return false;
  return true;
}

function validateEmail(email) {
  const e = String(email || '').trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const SLOT_TIMES = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM'
];
const SLOT_TIME_SET = new Set(SLOT_TIMES);

/** Same weekday rules as partials/booking-consult-main.ejs (getDay / Sun=0) */
const LOCATION_RULES = {
  'Beverly Hills': { days: [1, 4] },
  'Westlake Village': { days: [2, 3, 5] }
};

const ALLOWED_LOCATIONS = new Set(Object.keys(LOCATION_RULES));
const HOLIDAY_CLOSED_DATES = new Set([
  '2026-07-04',
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-05-31'
]);
const HOLIDAY_HALF_DAY_DATES = new Set([
  '2026-12-24',
  '2026-12-31'
]);
const HOLIDAY_HALF_DAY_ALLOWED_TIMES = new Set([
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM'
]);

function validateAge(age) {
  const n = typeof age === 'number' ? age : parseInt(String(age || '').trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 120) return null;
  return n;
}

/** @returns {string|null} YYYY-MM-DD */
function validatePreferredDate(s) {
  const str = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const parts = str.split('-').map(Number);
  const yy = parts[0];
  const mm = parts[1];
  const dd = parts[2];
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  if (d.getUTCFullYear() !== yy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const pickUtc = Date.UTC(yy, mm - 1, dd);
  if (pickUtc < todayUtc) return null;
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 1);
  const maxUtc = Date.UTC(max.getFullYear(), max.getMonth(), max.getDate());
  if (pickUtc > maxUtc) return null;
  return str;
}

function civilWeekdaySun0(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/** @returns {string|null} */
function validatePreferredDateForLocation(dateStr, location) {
  const clean = validatePreferredDate(dateStr);
  if (!clean) return null;
  if (HOLIDAY_CLOSED_DATES.has(clean)) return null;
  const rules = LOCATION_RULES[location];
  if (!rules) return null;
  const [yy, mm, dd] = clean.split('-').map(Number);
  const dow = civilWeekdaySun0(yy, mm, dd);
  if (!rules.days.includes(dow)) return null;
  return clean;
}

/** @returns {string|null} */
function validatePreferredTime(time, location, dateStr) {
  if (!LOCATION_RULES[location]) return null;
  const t = String(time || '').trim();
  if (!SLOT_TIME_SET.has(t)) return null;
  if (HOLIDAY_HALF_DAY_DATES.has(String(dateStr || '').trim()) && !HOLIDAY_HALF_DAY_ALLOWED_TIMES.has(t)) {
    return null;
  }
  return t;
}

router.post('/submit', rateLimitSubmit, async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      age,
      location,
      preferredDate,
      preferredTime,
      recaptchaToken,
      website,
      pageUrl
    } = req.body || {};

    if (website && String(website).trim() !== '') {
      return res.status(400).json({ success: false, message: 'Invalid submission.' });
    }

    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please complete the reCAPTCHA verification.'
      });
    }

    const captchaOk = await verifyRecaptchaV2(recaptchaToken);
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed. Please try again.'
      });
    }

    const nameClean = String(fullName || '').trim();
    const emailClean = String(email || '').trim();
    const phoneClean = typeof phone === 'string' ? phone.trim() : '';

    if (!validateFullName(nameClean)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your full name.'
      });
    }

    if (!validateEmail(emailClean)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    const ageNum = validateAge(age);
    if (ageNum === null) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid age.'
      });
    }

    const locationClean = String(location || '').trim();
    if (!ALLOWED_LOCATIONS.has(locationClean)) {
      return res.status(400).json({
        success: false,
        message: 'Please select Beverly Hills or Westlake Village.'
      });
    }

    const preferredDateClean = validatePreferredDateForLocation(preferredDate, locationClean);
    if (!preferredDateClean) {
      return res.status(400).json({
        success: false,
        message:
          'Please choose a valid date on a day that location is open (Beverly Hills: Mon & Thu; Westlake: Tue, Wed & Fri).'
      });
    }

    const preferredTimeClean = validatePreferredTime(preferredTime, locationClean, preferredDateClean);
    if (!preferredTimeClean) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid appointment time (half-day schedules only allow 8:00 AM - 12:00 PM).'
      });
    }

    const payload = {
      fullName: nameClean,
      email: emailClean,
      phone: phoneClean || '',
      age: ageNum,
      location: locationClean,
      preferredDate: preferredDateClean,
      preferredTime: preferredTimeClean,
      pageUrl: typeof pageUrl === 'string' ? pageUrl.trim() : ''
    };

    const nameParts = nameClean.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || nameClean;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

    const descriptionLines = [
      'SMILE Book Consultation',
      '-----------------------',
      `Name: ${nameClean}`,
      `Email: ${emailClean}`,
      `Phone: ${phoneClean || '—'}`,
      `Age: ${ageNum}`,
      `Location: ${locationClean}`,
      `Preferred date: ${preferredDateClean}`,
      `Preferred time: ${preferredTimeClean}`,
      `Page: ${payload.pageUrl || '—'}`,
      '',
      `Submitted: ${new Date().toLocaleString()}`
    ];

    try {
      await zohoService.upsertLead({
        firstName,
        lastName,
        email: emailClean,
        phone: phoneClean || 'Not provided',
        leadSource: 'SMILE Book Consultation',
        company: 'SMILE Consultation Lead',
        leadStatus: process.env.ZOHO_BOOKING_LEAD_STATUS || undefined,
        customDescription: descriptionLines.join('\n'),
        customFields: {}
      });
    } catch (zohoErr) {
      console.error(
        '[smile-book-consult] Zoho CRM upsert failed (email still attempted):',
        zohoErr.response?.data || zohoErr.message || zohoErr
      );
    }

    try {
      const zb = await zohoBookingsService.syncConsultBooking({
        fullName: nameClean,
        email: emailClean,
        phone: phoneClean,
        location: locationClean,
        date: preferredDateClean,
        time: preferredTimeClean,
        pageUrl: payload.pageUrl || '/smile-book-consultation/',
        source: 'smile',
        notes: 'SMILE Book Consultation',
        additionalFields: { Age: String(ageNum) }
      });
      if (zb && !zb.ok && !zb.skipped) {
        console.warn('[smile-book-consult] Zoho Bookings:', zb.error || zb.reason);
      }
    } catch (zbErr) {
      console.error('[smile-book-consult] Zoho Bookings sync error:', zbErr.message || zbErr);
    }

    await sendSmileBookConsultStaffNotification(payload);

    try {
      await sendSmileBookConsultUserThankYou(payload);
    } catch (userMailErr) {
      console.error('SMILE book consult user thank-you failed:', userMailErr.message);
    }

    return res.json({
      success: true,
      message: 'Thank you! Redirecting…',
      redirectUrl: '/smile-book-consultation-thank-you/'
    });
  } catch (error) {
    console.error('SMILE book consult error:', error);
    const errMsg = String(error.message || '');
    const hint =
      errMsg.includes('SMTP credentials are not fully configured') || errMsg.includes('SMTP')
        ? 'We could not send your request by email right now. Please call 818 857 1735 or try again later.'
        : 'Unable to submit. Please try again or call 818 857 1735.';
    return res.status(500).json({
      success: false,
      message: hint
    });
  }
});

module.exports = router;
