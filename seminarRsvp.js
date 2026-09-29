const express = require('express');
const router = express.Router();
const { sendSeminarRsvpEmail } = require('../services/emailService');

// Lightweight in-memory rate limiter to reduce abuse on /api/seminar-rsvp/submit
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_REQUESTS = 20; // per IP per window
const rateStore = new Map(); // ip -> { windowStart, count }

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
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
    const name = fullName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : '');

    if (!name || !email || !eventType || !agree) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, event type (seminar or webinar), and confirmation are required.'
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

    await sendSeminarRsvpEmail({
      fullName: name,
      firstName: firstName || name.split(' ')[0],
      lastName: lastName || name.split(' ').slice(1).join(' ') || '',
      email,
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
