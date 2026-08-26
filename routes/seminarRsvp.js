const express = require('express');
const router = express.Router();
const { sendSeminarRsvpEmail } = require('../services/emailService');

// Lightweight in-memory rate limiter to reduce abuse on /api/seminar-rsvp/submit
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_REQUESTS = 20; // per IP per window
const rateStore = new Map(); // ip -> { windowStart, count }

function validateName(name) {
  // Letters only, with optional spaces/hyphens/apostrophes. No digits.
  return typeof name === 'string' && /^[A-Za-z][A-Za-z'\\-\\s]*$/.test(name) && !/[0-9]/.test(name);
}

function validateEmail(email) {
  // Basic email validation:
  // - must contain "@"
  // - disallow weird symbols like "= + - * & ( ) # $ % !"
  // - basic domain + TLD check
  // Local part: only letters/numbers/dot/underscore
  return typeof email === 'string' && /^[A-Za-z0-9._]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

function isTestEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  // Common test patterns you (or the team) might use during QA.
  return e.endsWith('@example.com') || e.startsWith('test@') || e.startsWith('testing@');
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }

  // Prefer socket remote address (stable for rate limiting).
  let ip = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : (req.ip || 'unknown');

  // Normalize IPv6-mapped IPv4 addresses.
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

router.post('/submit', rateLimitSubmit, async (req, res) => {
  try {
    const { firstName, lastName, fullName, email, eventType, numGuests, guests, agree, captchaToken } = req.body || {};
    const firstNameClean = typeof firstName === 'string' ? firstName.trim() : '';
    const lastNameClean = typeof lastName === 'string' ? lastName.trim() : '';
    const emailClean = typeof email === 'string' ? email.trim() : '';

    const name =
      fullName && typeof fullName === 'string'
        ? fullName.trim()
        : firstNameClean && lastNameClean
          ? `${firstNameClean} ${lastNameClean}`.trim()
          : '';

    if (!validateName(firstNameClean) || !validateName(lastNameClean) || !emailClean || !eventType || !agree) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid first name, last name, email, event type, and confirmation.'
      });
    }

    if (!validateEmail(emailClean)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // CAPTCHA token gating (no server-side verification due to missing secret).
    // This blocks empty/obvious-bot requests and aligns with the current reCAPTCHA front-end flow.
    if (!captchaToken || typeof captchaToken !== 'string' || captchaToken.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please complete CAPTCHA and try again.'
      });
    }

    if (!['seminar', 'webinar'].includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'Please select Seminar (in-person) or Webinar (online).'
      });
    }

    // QA/test submissions should not send any emails.
    if (isTestEmail(emailClean)) {
      return res.json({
        success: true,
        message: 'Your RSVP has been received.'
      });
    }

    await sendSeminarRsvpEmail({
      fullName: name,
      firstName: firstNameClean,
      lastName: lastNameClean,
      email: emailClean,
      eventType,
      numGuests: parseInt(numGuests, 10) || 0,
      guests: Array.isArray(guests) ? guests : [],
      agree
    });

    return res.json({
      success: true,
      message: 'Your RSVP has been received. Check your email for event details!'
    });
  } catch (error) {
    console.error('Seminar RSVP error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to submit RSVP. Please try again or call us.'
    });
  }
});

module.exports = router;
