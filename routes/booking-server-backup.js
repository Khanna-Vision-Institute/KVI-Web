const express = require('express');
const router = express.Router();
const axios = require('axios');
const zohoService = require('../services/zohoService');
const { sendBookingNotification, sendOnlineConsultNotification, sendUserConfirmationEmail, sendCancellationNotification } = require('../services/emailService');

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

router.post('/submit', async (req, res) => {
  try {
    const { 
      fullName, age, email, phone, location, date, time, surgeryExamType, pageUrl, website, recaptchaToken
    } = req.body || {};

    // Skip reCAPTCHA for voice/Guru bookings (server-to-server, no browser)
    const isVoiceBooking = pageUrl === 'Voice/Phone (Guru AI)';
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

    if (!fullName || !age || !email || !phone || !location || !date || !time || !surgeryExamType) {
      return res.status(400).json({
        success: false,
        message: 'Full name, age, email, phone, location, date, time, and surgery/exam type are required.'
      });
    }

    const { firstName, lastName } = splitName(fullName);

    const descriptionLines = [
      'Consultation Booking',
      '-----------------------',
      `Name: ${fullName}`,
      `Age: ${age}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Preferred Location: ${location}`,
      `Preferred Date: ${date}`,
      `Preferred Time: ${time}`,
      `Surgery/Exam Type: ${surgeryExamType}`,
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
      phone,
      leadSource: 'Website Booking',
      company: 'Consultation Lead',
      customDescription: descriptionLines.join('\n'),
      customFields: {}
    };

    const result = await zohoService.upsertLead(leadData);

    const emailData = {
      fullName,
      age,
      email,
      phone,
      location,
      date,
      time,
      surgeryExamType,
      pageUrl
    };

    const isTestEmail = email && (email.endsWith('@example.com') || email.toLowerCase().includes('test'));
    
    let emailStatus = null;
    let userEmailStatus = null;
    
    if (!isTestEmail) {
    try {
      emailStatus = await sendBookingNotification(emailData);
      console.log('Booking notification emailed:', emailStatus.messageId);
    } catch (emailError) {
      console.error('Failed to send booking notification email:', emailError.message);
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

    return res.json({
      success: true,
      message: 'Booking saved successfully',
      data: result,
      emailStatus: emailStatus ? {
        accepted: emailStatus.accepted,
        rejected: emailStatus.rejected,
        messageId: emailStatus.messageId
      } : null,
      userEmailStatus: userEmailStatus ? {
        accepted: userEmailStatus.accepted,
        rejected: userEmailStatus.rejected,
        messageId: userEmailStatus.messageId
      } : null
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
