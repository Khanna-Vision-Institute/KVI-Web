const express = require('express');
const axios = require('axios');
const router = express.Router();
const { sendSmileLandingLeadEmail } = require('../services/emailService');

const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.RECAPTCHA_V2_SECRET_KEY ||
  '6Lf0P20sAAAAANP3mOsaj7QZ6bsl79cw_g49wnWn';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 15;
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
    console.error('SMILE landing reCAPTCHA not successful:', response.data || response.status);
    return false;
  } catch (error) {
    console.error('SMILE landing reCAPTCHA error:', error.message);
    return false;
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  let ip = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : (req.ip || 'unknown');
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.slice('::ffff:'.length);
  }
  return ip || 'unknown';
}

function rateLimitSubmit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateStore.get(ip);
  if (!entry || (now - entry.windowStart) > RATE_WINDOW_MS) {
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

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function validateFullName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 120) return false;
  if (!/[a-zA-Z]/.test(n)) return false;
  return true;
}

router.post('/submit', rateLimitSubmit, async (req, res) => {
  try {
    const {
      fullName,
      phone,
      primaryGoal,
      prescriptionRange,
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
    const phoneDigits = normalizePhone(phone);

    if (!validateFullName(nameClean)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your full name.'
      });
    }

    if (phoneDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit U.S. phone number.'
      });
    }

    const goal = String(primaryGoal || '').trim();
    const rx = String(prescriptionRange || '').trim();
    if (!goal || goal.length > 200 || !rx || rx.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all quiz steps before submitting.'
      });
    }

    await sendSmileLandingLeadEmail({
      fullName: nameClean,
      phone: phoneDigits,
      primaryGoal: goal,
      prescriptionRange: rx,
      pageUrl: typeof pageUrl === 'string' ? pageUrl.trim() : ''
    });

    return res.json({
      success: true,
      message: 'Thank you! We will contact you shortly.'
    });
  } catch (error) {
    console.error('SMILE landing lead error:', error);
    const errMsg = String(error.message || '');
    const hint =
      errMsg.includes('SMTP credentials are not fully configured') ||
      errMsg.includes('SMTP')
        ? 'We could not send your submission by email right now. Please call (805) 230-2126 or try again later.'
        : 'Unable to submit. Please try again or call (805) 230-2126.';
    return res.status(500).json({
      success: false,
      message: hint
    });
  }
});

module.exports = router;
