const express = require('express');
const router = express.Router();
const axios = require('axios');
const zohoService = require('../services/zohoService');
const zohoBookingsService = require('../services/zohoBookingsService');
const {
  buildBookingZohoCustomFields,
  resolveBookingLeadSource,
  isPieBooking
} = require('../services/zohoBookingLeadFields');
const pieAutoresponder = require('../services/pieAutoresponder/safe');
const {
  sendBookingNotification,
  sendOnlineConsultNotification,
  sendUserConfirmationEmail,
  sendCancellationNotification,
  sendVipConsultNotification,
  sendVipConsultUserThankYouEmail
} = require('../services/emailService');

if (typeof sendVipConsultUserThankYouEmail !== 'function') {
  console.error(
    '[kvi] CRITICAL: sendVipConsultUserThankYouEmail missing from services/emailService.js — VIP auto-reply will not send. Deploy emailService.js with the rest of booking.js.'
  );
}

// reCAPTCHA v2 configuration
const RECAPTCHA_SECRET_KEY = '6Lf0P20sAAAAANP3mOsaj7QZ6bsl79cw_g49wnWn';

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
    
    console.log('reCAPTCHA verification:', response.data);
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error.message);
    return false;
  }
}

function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

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

function parseDateToIso(inputDate) {
  const raw = String(inputDate || '')
    .trim()
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) {
    const mm = Number(mdY[1]);
    const dd = Number(mdY[2]);
    const yy = Number(mdY[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const test = new Date(Date.UTC(yy, mm - 1, dd));
    if (test.getUTCFullYear() !== yy || test.getUTCMonth() !== mm - 1 || test.getUTCDate() !== dd) {
      return null;
    }
    return (
      String(yy).padStart(4, '0') +
      '-' +
      String(mm).padStart(2, '0') +
      '-' +
      String(dd).padStart(2, '0')
    );
  }

  const parsedMs = Date.parse(raw);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    if (yy >= 2000 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return (
        String(yy).padStart(4, '0') +
        '-' +
        String(mm).padStart(2, '0') +
        '-' +
        String(dd).padStart(2, '0')
      );
    }
  }

  return null;
}

function normalizeLocation(location) {
  const t = String(location || '').trim().toLowerCase();
  if (!t) return location;
  if (t.includes('beverly')) return 'Beverly Hills';
  if (t.includes('westlake')) return 'Westlake Village';
  if (t === 'online' || t.includes('virtual')) return 'Online';
  return String(location).trim();
}

function formatDateForEmail(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [yy, mm, dd] = isoDate.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

router.post('/submit', async (req, res) => {
  try {
    const { 
      fullName, age, email, phone, location, date, time, surgeryExamType, pageUrl, website, recaptchaToken
    } = req.body || {};

    // Skip reCAPTCHA for server-to-server bookings (voice call or AI chat widget)
    const isVoiceBooking = pageUrl === 'Voice/Phone (Guru AI)' ||
                           (typeof pageUrl === 'string' && (
                             pageUrl.startsWith('Chat Widget') ||
                             pageUrl.startsWith('Web Voice Call')
                           ));
    if (!isVoiceBooking) {
      if (!recaptchaToken) {
        console.log('Spam detected: missing reCAPTCHA token');
        return res.status(400).json({
          success: false,
          message: 'Please complete the reCAPTCHA verification.'
        });
      }
      const isValidRecaptcha = await verifyRecaptchaV2(recaptchaToken);
      if (!isValidRecaptcha) {
        console.log('Spam detected: invalid reCAPTCHA');
        return res.status(400).json({
          success: false,
          message: 'reCAPTCHA verification failed. Please try again.'
        });
      }
    }

    // Honeypot check
    if (website && website.trim() !== '') {
      console.log('Spam detected: honeypot field filled');
      return res.status(400).json({
        success: false,
        message: 'Invalid submission detected.'
      });
    }

    // Gibberish check
    const containsOnlyGibberish = (text) => {
      if (!text || typeof text !== 'string') return false;
      const vowels = (text.match(/[aeiouAEIOU]/g) || []).length;
      const consonants = (text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
      const total = vowels + consonants;
      if (total === 0) return true;
      return vowels / total < 0.2;
    };

    if (fullName && containsOnlyGibberish(fullName)) {
      console.log('Spam detected: gibberish name -', fullName);
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid name.'
      });
    }

    if (!fullName || !age || !email || !location || !date || !time) {
      return res.status(400).json({
        success: false,
        message:
          'Full name, age, email, preferred location, preferred date, and preferred time are required.'
      });
    }

    const bookingDateIso = parseDateToIso(date);
    if (!bookingDateIso) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid appointment date.'
      });
    }

    const normalizedLocation = normalizeLocation(location);
    const displayDate = formatDateForEmail(bookingDateIso);

    if (HOLIDAY_CLOSED_DATES.has(bookingDateIso)) {
      return res.status(400).json({
        success: false,
        message: 'That date is a clinic holiday and is unavailable. Please choose another date.'
      });
    }

    if (
      HOLIDAY_HALF_DAY_DATES.has(bookingDateIso) &&
      !HOLIDAY_HALF_DAY_ALLOWED_TIMES.has(String(time || '').trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Selected date is a half-day clinic schedule (8:00 AM - 12:00 PM). Please choose an earlier time.'
      });
    }

    const { firstName, lastName } = splitName(fullName);

    const descriptionLines = [
      'Consultation Booking',
      '-----------------------',
      `Name: ${fullName}`,
      `Age: ${age}`,
      `Email: ${email}`,
      `Phone: ${phone ? String(phone).trim() : '—'}`,
      `Preferred Location: ${normalizedLocation}`,
      `Preferred Date: ${displayDate}`,
      `Preferred Time: ${time}`,
      `Surgery/Exam Type: ${surgeryExamType ? String(surgeryExamType).trim() : '—'}`,
      ''
    ];

    if (pageUrl) {
      descriptionLines.push(`Submitted from: ${pageUrl}`, '');
    }

    descriptionLines.push(`Submitted: ${new Date().toLocaleString()}`);

    const leadData = {
      firstName,
      lastName: lastName || 'Unknown',
      email,
      phone: phone && String(phone).trim() ? String(phone).trim() : 'Not provided',
      leadSource: resolveBookingLeadSource({ surgeryExamType, pageUrl }),
      company: 'Consultation Lead',
      // Must match your Leads → Lead Status picklist exactly (Kanban columns use this field).
      // Example: ZOHO_BOOKING_LEAD_STATUS=Lead — see Zoho Setup → Customization → Modules → Leads → Fields → Lead Status.
      leadStatus: process.env.ZOHO_BOOKING_LEAD_STATUS || undefined,
      customDescription: descriptionLines.join('\n'),
      customFields: buildBookingZohoCustomFields({
        surgeryExamType,
        pageUrl,
        date: displayDate,
        time,
        smsOptIn: true,
        emailOptIn: true
      })
    };

    let crmResult = null;
    let crmError = null;
    try {
      crmResult = await zohoService.upsertLead(leadData);
    } catch (zohoErr) {
      crmError = zohoErr;
      console.error(
        'Zoho CRM upsert failed (booking may still be delivered by email):',
        zohoErr.response?.data || zohoErr.message || zohoErr
      );
    }

    let zohoBookingsResult = null;
    try {
      zohoBookingsResult = await zohoBookingsService.syncConsultBooking({
        fullName,
        email,
        phone,
        location: normalizedLocation,
        date: displayDate,
        time,
        pageUrl,
        notes: surgeryExamType ? `Procedure interest: ${String(surgeryExamType).trim()}` : undefined,
        additionalFields: {
          Age: String(age),
          'Procedure interest': surgeryExamType ? String(surgeryExamType).trim() : ''
        }
      });
      if (zohoBookingsResult && !zohoBookingsResult.ok && !zohoBookingsResult.skipped) {
        console.warn('[booking] Zoho Bookings:', zohoBookingsResult.error || zohoBookingsResult.reason);
      }
    } catch (zbErr) {
      console.error('[booking] Zoho Bookings sync error:', zbErr.message || zbErr);
    }

    const emailData = {
      fullName,
      age,
      email,
      phone: typeof phone === 'string' ? phone.trim() : phone || '',
      location: normalizedLocation,
      date: displayDate,
      time,
      surgeryExamType:
        typeof surgeryExamType === 'string' ? surgeryExamType.trim() : surgeryExamType || '',
      pageUrl
    };

    const isTestEmail = email && (email.endsWith('@example.com') || email.toLowerCase().includes('test'));
    const isPieLead = isPieBooking({ surgeryExamType, pageUrl });

    let emailStatus = null;
    let userEmailStatus = null;

    if (!isTestEmail) {
      try {
        emailStatus = await sendBookingNotification(emailData);
        console.log('Booking notification emailed:', emailStatus.messageId);
      } catch (emailError) {
        console.error('Failed to send booking notification email:', emailError.message);
      }

      if (isPieLead && pieAutoresponder.isPieAutoresponderEnabled()) {
        pieAutoresponder.schedulePieAutoresponderForLead(emailData);
      }

      try {
        userEmailStatus = await sendUserConfirmationEmail(emailData);
        console.log('User confirmation email sent:', userEmailStatus.messageId);
      } catch (userEmailError) {
        console.error('Failed to send user confirmation email:', userEmailError.message);
      }
    } else {
      console.log('Skipping emails for test address:', email);
    }

    if (crmError) {
      const staffNotified = !!emailStatus;
      if (staffNotified) {
        return res.json({
          success: true,
          message:
            'Your consultation request was received. Our team will contact you within 24 hours.',
          data: null,
          crmSynced: false,
          zohoBookingsSynced: !!(zohoBookingsResult && zohoBookingsResult.ok),
          emailStatus: emailStatus
            ? {
                accepted: emailStatus.accepted,
                rejected: emailStatus.rejected,
                messageId: emailStatus.messageId
              }
            : null,
          userEmailStatus: userEmailStatus
            ? {
                accepted: userEmailStatus.accepted,
                rejected: userEmailStatus.rejected,
                messageId: userEmailStatus.messageId
              }
            : null
        });
      }
      if (isTestEmail) {
        return res.status(503).json({
          success: false,
          message:
            'Test booking could not be saved to CRM and emails were skipped. Use a real email or fix Zoho.',
          error: crmError.message
        });
      }
      return res.status(503).json({
        success: false,
        message:
          'We could not complete your booking online. Please call (805) 230-2126 or try again shortly.',
        error: crmError.message
      });
    }

    return res.json({
      success: true,
      message: 'Booking saved successfully',
      data: crmResult,
      crmSynced: true,
      zohoBookingsSynced: !!(zohoBookingsResult && zohoBookingsResult.ok),
      emailStatus: emailStatus
        ? {
            accepted: emailStatus.accepted,
            rejected: emailStatus.rejected,
            messageId: emailStatus.messageId
          }
        : null,
      userEmailStatus: userEmailStatus
        ? {
            accepted: userEmailStatus.accepted,
            rejected: userEmailStatus.rejected,
            messageId: userEmailStatus.messageId
          }
        : null
    });
  } catch (error) {
    console.error('Error processing booking:', error.response?.data || error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process booking',
      error: error.message
    });
  }
});

/**
 * VIP Private Consult — /VIP-Consult/ (vip-consult.html)
 * reCAPTCHA v2 → Zoho CRM Lead (Lead_Status from env) + VIP staff email +
 * VIP_CONSULT_EMAIL_TO thank-you where configured.
 */
router.post('/vip-consult', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      interest,
      message,
      formSource,
      recaptchaToken,
      website
    } = req.body || {};

    if (website && String(website).trim() !== '') {
      console.log('Spam detected: honeypot field filled (VIP consult)');
      return res.status(400).json({
        success: false,
        message: 'Invalid submission detected.'
      });
    }

    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the reCAPTCHA verification.'
      });
    }

    const isValidRecaptcha = await verifyRecaptchaV2(recaptchaToken);
    if (!isValidRecaptcha) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed. Please try again.'
      });
    }

    const fn = typeof firstName === 'string' ? firstName.trim() : '';
    const ln = typeof lastName === 'string' ? lastName.trim() : '';
    const ph = typeof phone === 'string' ? phone.trim() : '';
    const em = typeof email === 'string' ? email.trim() : '';

    if (!fn || !ln || !ph || !em) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, phone, and email are required.'
      });
    }

    const interestTxt = typeof interest === 'string' ? interest.trim() : '';
    const messageTxt =
      typeof message === 'string' ? String(message).trim() : '';
    const sourceTxt =
      typeof formSource === 'string' ? formSource.trim() : 'VIP-Consult';

    const descriptionLines = [
      'VIP Private Consult',
      '-----------------------',
      `Name: ${fn} ${ln}`,
      `Email: ${em}`,
      `Phone: ${ph}`,
      `Interest: ${interestTxt || '—'}`,
      `Message: ${messageTxt || '—'}`,
      `Form source: ${sourceTxt}`,
      '',
      `Submitted: ${new Date().toLocaleString()}`
    ];

    const vipLeadStatus =
      process.env.ZOHO_VIP_CONSULT_LEAD_STATUS ||
      process.env.ZOHO_BOOKING_LEAD_STATUS ||
      undefined;

    const leadData = {
      firstName: fn,
      lastName: ln,
      email: em,
      phone: ph || 'Not provided',
      leadSource: 'Website VIP Consult',
      company: 'VIP Consult Lead',
      leadStatus: vipLeadStatus,
      customDescription: descriptionLines.join('\n'),
      customFields: {}
    };

    let crmResult = null;
    let crmError = null;
    try {
      crmResult = await zohoService.upsertLead(leadData);
    } catch (zohoErr) {
      crmError = zohoErr;
      console.error(
        'Zoho CRM upsert failed for VIP consult (staff email may still send):',
        zohoErr.response?.data || zohoErr.message || zohoErr
      );
    }

    let vipEmailSent = false;
    try {
      await sendVipConsultNotification({
        firstName: fn,
        lastName: ln,
        phone: ph,
        email: em,
        interest: interestTxt,
        message:
          typeof message === 'string'
            ? message
            : messageTxt || '',
        formSource: sourceTxt
      });
      vipEmailSent = true;
    } catch (notifyErr) {
      console.error('VIP consult staff notification failed:', notifyErr.message);
    }

    if (typeof sendVipConsultUserThankYouEmail !== 'function') {
      console.error(
        '[kvi] VIP thank-you skipped: sendVipConsultUserThankYouEmail not loaded (deploy services/emailService.js).'
      );
    } else {
      try {
        const thankYouResult = await sendVipConsultUserThankYouEmail({
          firstName: fn,
          lastName: ln,
          email: em
        });
        console.log(
          'VIP consult thank-you (PIE book) sent to:',
          em,
          thankYouResult && thankYouResult.messageId ? thankYouResult.messageId : ''
        );
      } catch (userMailErr) {
        console.error(
          'VIP consult user thank-you email failed:',
          userMailErr.message,
          userMailErr.stack || ''
        );
      }
    }

    if (crmError) {
      if (vipEmailSent) {
        return res.json({
          success: true,
          message:
            'Your request was received. Our team will be in touch shortly.',
          crmSynced: false,
          data: null
        });
      }
      return res.status(503).json({
        success: false,
        message:
          'We could not complete your request online. Please call 818 857 1735 or try again shortly.',
        error: crmError.message || 'CRM unavailable'
      });
    }

    return res.json({
      success: true,
      message: 'Your request was received. Our team will be in touch shortly.',
      crmSynced: true,
      data: crmResult ? { details: crmResult.details || null } : null
    });
  } catch (error) {
    console.error('VIP consult error:', error.response?.data || error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send your request. Please call 818 857 1735 or try again.'
    });
  }
});

router.post('/online-consult', async (req, res) => {
  try {
    const {
      consultDate,
      firstName,
      lastName,
      dob,
      age,
      address1,
      address2,
      city,
      zip,
      phone,
      email,
      reason,
      referralSources
    } = req.body || {};

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and phone are required.'
      });
    }

    const referralList = Array.isArray(referralSources)
      ? referralSources
      : referralSources
      ? [referralSources]
      : [];

    const descriptionLines = [
      'Online Consultation Request',
      '-----------------------',
      `Preferred Date: ${consultDate || 'Not provided'}`,
      `Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Date of Birth: ${dob || 'Not provided'}`,
      `Age: ${age || 'Not provided'}`,
      `Address Line 1: ${address1 || 'Not provided'}`,
      `Address Line 2: ${address2 || 'Not provided'}`,
      `City: ${city || 'Not provided'}`,
      `Postal / Zip Code: ${zip || 'Not provided'}`,
      `Reason: ${reason || 'Not provided'}`,
      `Referral Sources: ${referralList.length ? referralList.join(', ') : 'Not provided'}`,
      `Submitted: ${new Date().toLocaleString()}`
    ];

    const leadData = {
      firstName,
      lastName: lastName || 'Unknown',
      email,
      phone,
      leadSource: 'Online Consultation Form',
      company: 'Online Consultation Lead',
      customDescription: descriptionLines.join('\n'),
      customFields: {}
    };

    const result = await zohoService.upsertLead(leadData);

    let emailStatus = null;
    try {
      emailStatus = await sendOnlineConsultNotification({
        consultDate,
        firstName,
        lastName,
        dob,
        age,
        address1,
        address2,
        city,
        zip,
        phone,
        email,
        reason,
        referralSources: referralList
      });
      console.log('Online consultation notification emailed:', emailStatus.messageId);
    } catch (emailError) {
      console.error('Failed to send online consultation email:', emailError.message);
    }

    return res.json({
      success: true,
      message: 'Consultation request saved successfully',
      data: result,
      emailStatus: emailStatus ? {
        accepted: emailStatus.accepted,
        rejected: emailStatus.rejected,
        messageId: emailStatus.messageId
      } : null
    });
  } catch (error) {
    console.error('Error processing online consultation:', error.response?.data || error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process consultation request',
      error: error.message
    });
  }
});


// Appointment cancellation (called by Guru AI - no recaptcha for server-to-server)
router.post("/cancel", async (req, res) => {
  try {
    const { fullName, age, procedure, email } = req.body || {};
    if (!fullName || !age || !procedure || !email) {
      return res.status(400).json({
        success: false,
        message: "Full name, age, procedure, and email are required for cancellation."
      });
    }
    const cancelData = { fullName, age, procedure, email };
    const emailStatus = await sendCancellationNotification(cancelData);
    return res.json({
      success: true,
      message: "Cancellation request received. We will process it shortly.",
      emailStatus: { accepted: emailStatus.accepted, messageId: emailStatus.messageId }
    });
  } catch (error) {
    console.error("Error processing cancellation:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to process cancellation",
      error: error.message
    });
  }
});

module.exports = router;
