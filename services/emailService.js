const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const bookConsultPatientThankYou = require('./thankYouEmails/bookConsultationPatientThankYou');
const vipConsultPatientThankYou = require('./thankYouEmails/vipConsultPatientThankYou');
const smileBookConsultPatientThankYou = require('./thankYouEmails/smileBookConsultPatientThankYou');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

const defaultVisionQuestFrom = process.env.VISION_QUEST_EMAIL_FROM || 'Vision Quest <no-reply@visionquest.local>';
const defaultBookingFrom = process.env.BOOKING_EMAIL_FROM || defaultVisionQuestFrom;
const defaultOnlineConsultFrom = process.env.ONLINE_CONSULT_EMAIL_FROM || defaultBookingFrom;
const defaultTo = process.env.VISION_QUEST_EMAIL_TO;
const bookingSubject = process.env.BOOKING_EMAIL_SUBJECT || 'New Consultation Booking';

const bookingUserConfirmCcReplyDefault =
  'rajesh@khannavision.com, info@khannavision.com, kapil@khannavision.com';
const bookingUserConfirmCcReply =
  process.env.BOOKING_USER_CONFIRM_CC_REPLY_TO || bookingUserConfirmCcReplyDefault;
const visionQuestSubject = process.env.VISION_QUEST_EMAIL_SUBJECT || 'New Vision Quest Submission';
const onlineConsultSubject = process.env.ONLINE_CONSULT_EMAIL_SUBJECT || 'New Online Consultation Request';

/** Override with PHYSICIAN_REFERRAL_EMAIL_TO (and optionally PORTAL_BOOK_CONSULT_EMAIL_TO). */
const physicianReferralTo =
  process.env.PHYSICIAN_REFERRAL_EMAIL_TO ||
  'rajesh@khannavision.com, info@khannavision.com, kapil@khannavision.com';
const physicianReferralSubjectBase =
  process.env.PHYSICIAN_REFERRAL_EMAIL_SUBJECT || 'New doctor referral worksheet';
const physicianReferralFromDefault =
  process.env.PHYSICIAN_REFERRAL_EMAIL_FROM || defaultBookingFrom;

/** /Doctorportal/book-consultation — staff inbox (defaults to referral staff list unless overridden). */
const portalBookConsultEmailTo =
  process.env.PORTAL_BOOK_CONSULT_EMAIL_TO || physicianReferralTo;
const portalBookConsultSubjectBase =
  process.env.PORTAL_BOOK_CONSULT_EMAIL_SUBJECT || 'Doctor portal consultation request';
const portalBookConsultFromDefault =
  process.env.PORTAL_BOOK_CONSULT_EMAIL_FROM || defaultBookingFrom;

const ZOHO_FORM_BASE_URL = 'https://forms.zohopublic.com/iayezcom/form/OnlineConsultForm/formperma/HrtixAq6KqOizj9qmcFw8uh-iSVPNLyvVK6g32DL5co';

const ZOHO_FIELD_ALIASES = {
  firstName: process.env.ZOHO_FIELD_FIRSTNAME || 'firstName',
  lastName: process.env.ZOHO_FIELD_LASTNAME || 'lastName',
  age: process.env.ZOHO_FIELD_AGE || 'age',
  email: process.env.ZOHO_FIELD_EMAIL || 'email',
  phone: process.env.ZOHO_FIELD_PHONE || 'phone',
  date: process.env.ZOHO_FIELD_DATE || 'date',
  location: process.env.ZOHO_FIELD_LOCATION || 'location'
};

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

function buildPrefilledZohoFormUrl(bookingData) {
  const { firstName, lastName } = splitName(bookingData.fullName || '');
  
  const params = new URLSearchParams();
  

  if (firstName) params.append(ZOHO_FIELD_ALIASES.firstName, firstName);
  if (lastName) params.append(ZOHO_FIELD_ALIASES.lastName, lastName);
  

  if (bookingData.age) params.append(ZOHO_FIELD_ALIASES.age, bookingData.age);
  

  if (bookingData.email) params.append(ZOHO_FIELD_ALIASES.email, bookingData.email);
  
  if (bookingData.phone) params.append(ZOHO_FIELD_ALIASES.phone, bookingData.phone);
  
  if (bookingData.date) {
    const dateParts = bookingData.date.split('/');
    if (dateParts.length === 3) {
      const formattedDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
      params.append(ZOHO_FIELD_ALIASES.date, formattedDate);
    } else {
      params.append(ZOHO_FIELD_ALIASES.date, bookingData.date);
    }
  }
  
  if (bookingData.location) params.append(ZOHO_FIELD_ALIASES.location, bookingData.location);
  
  const queryString = params.toString();
  return queryString ? `${ZOHO_FORM_BASE_URL}?${queryString}` : ZOHO_FORM_BASE_URL;
}

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP credentials are not fully configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  return transporter;
}

function buildEmailBody(leadData) {
  const fields = [
    { label: 'First Name', value: leadData.firstName },
    { label: 'Last Name', value: leadData.lastName },
    { label: 'Email', value: leadData.email },
    { label: 'Phone', value: leadData.phone },
    { label: 'Vision Type', value: leadData.visionType },
    { label: 'Selected Date', value: leadData.selectedDate },
    { label: 'Selected Time', value: leadData.selectedTime },
    { label: 'Total XP', value: leadData.totalXP },
    { label: 'Tier', value: leadData.tier },
    { label: 'Wallet Amount', value: `$${leadData.walletAmount}` },
    { label: 'Completion Time', value: leadData.completionTime }
  ];

  const lines = fields
    .map(({ label, value }) => `${label}: ${value || '—'}`)
    .join('\n');

  const htmlLines = fields
    .map(({ label, value }) => `<p><strong>${label}:</strong> ${value || '—'}</p>`)
    .join('');

  return {
    text: `Vision Quest submission\n\n${lines}\n\nSubmitted: ${new Date().toLocaleString()}`,
    html: `
      <h2>Vision Quest Submission</h2>
      ${htmlLines}
      <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
    `
  };
}

function buildBookingEmailBody(bookingData) {
  const fields = [
    { label: 'Full Name', value: bookingData.fullName },
    { label: 'Age', value: bookingData.age },
    { label: 'Email', value: bookingData.email },
    { label: 'Phone', value: bookingData.phone },
    { label: 'Preferred Location', value: bookingData.location },
    { label: 'Preferred Date', value: bookingData.date },
    { label: 'Preferred Time', value: bookingData.time },
    {
      label: 'Procedure interest',
      value: bookingData.surgeryExamType || '—'
    }
  ];

  const textLines = fields.map(({ label, value }) => `${label}: ${value || '—'}`).join('\n');
  const htmlLines = fields.map(({ label, value }) => `<p><strong>${label}:</strong> ${value || '—'}</p>`).join('');

  let pageSourceText = '';
  let pageSourceHtml = '';
  if (bookingData.pageUrl && String(bookingData.pageUrl).trim()) {
    const rawUrl = String(bookingData.pageUrl).trim();
    const safeHref = rawUrl.replace(/"/g, '&quot;');
    const safeText = rawUrl.replace(/</g, '&lt;').replace(/&/g, '&amp;');
    pageSourceText = `Submission source (page URL):\n${rawUrl}\n\n`;
    pageSourceHtml = `
      <div style="margin: 0 0 22px 0; padding: 16px 18px; background: #fefce8; border-left: 4px solid #ca8a04; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #854d0e;">
          Submission source
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.45;">
          Patient submitted this booking from:<br/>
          <a href="${safeHref}" style="color: #1d4ed8; word-break: break-all;">${safeText}</a>
        </p>
      </div>`;
  }

  return {
    text: `New Consultation Booking\n\n${pageSourceText}${textLines}\n\nSubmitted: ${new Date().toLocaleString()}`,
    html: `
      <h2>New Consultation Booking</h2>
      ${pageSourceHtml}
      ${htmlLines}
      <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
    `
  };
}

function buildOnlineConsultEmailBody(consultData) {
  const fields = [
    { label: 'Preferred Date', value: consultData.consultDate },
    { label: 'First Name', value: consultData.firstName },
    { label: 'Last Name', value: consultData.lastName },
    { label: 'Email', value: consultData.email },
    { label: 'Phone', value: consultData.phone },
    { label: 'Date of Birth', value: consultData.dob },
    { label: 'Age', value: consultData.age },
    { label: 'Address Line 1', value: consultData.address1 },
    { label: 'Address Line 2', value: consultData.address2 },
    { label: 'City', value: consultData.city },
    { label: 'Postal / Zip Code', value: consultData.zip },
    { label: 'Reason', value: consultData.reason },
    { label: 'Referral Sources', value: (consultData.referralSources || []).length ? consultData.referralSources.join(', ') : '—' }
  ];

  const textLines = fields.map(({ label, value }) => `${label}: ${value || '—'}`).join('\n');
  const htmlLines = fields.map(({ label, value }) => `<p><strong>${label}:</strong> ${value || '—'}</p>`).join('');

  return {
    text: `New Online Consultation Request\n\n${textLines}\n\nSubmitted: ${new Date().toLocaleString()}`,
    html: `
      <h2>New Online Consultation Request</h2>
      ${htmlLines}
      <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
    `
  };
}

async function sendVisionQuestSummary(leadData, opts = {}) {
  const transporterInstance = getTransporter();
  const { text, html } = buildEmailBody(leadData);

  const to = opts.to || defaultTo;
  if (!to) {
    throw new Error('VISION_QUEST_EMAIL_TO is not configured.');
  }

  const mailOptions = {
    from: opts.from || defaultVisionQuestFrom,
    to,
    subject: opts.subject || visionQuestSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

async function sendBookingNotification(bookingData, opts = {}) {
  const transporterInstance = getTransporter();
  const { text, html } = buildBookingEmailBody(bookingData);

  const defaultRecipient = opts.to || defaultTo;
  if (!defaultRecipient) {
    throw new Error('VISION_QUEST_EMAIL_TO is not configured.');
  }

  const recipients = [defaultRecipient, 'kapil@khannavision.com'].filter(Boolean).join(', ');

  const mailOptions = {
    from: opts.from || defaultBookingFrom,
    to: recipients,
    replyTo: bookingData.email || opts.replyTo,
    subject: opts.subject || bookingSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

async function sendOnlineConsultNotification(consultData, opts = {}) {
  const transporterInstance = getTransporter();
  const { text, html } = buildOnlineConsultEmailBody(consultData);

  const to = opts.to || defaultTo;
  if (!to) {
    throw new Error('VISION_QUEST_EMAIL_TO is not configured.');
  }

  const mailOptions = {
    from: opts.from || defaultOnlineConsultFrom,
    to,
    subject: opts.subject || onlineConsultSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

function buildUserConfirmationEmailBody(bookingData) {
  const zohoFormUrl = buildPrefilledZohoFormUrl(bookingData);
  return bookConsultPatientThankYou.build(bookingData, zohoFormUrl);
}

async function sendUserConfirmationEmail(bookingData, opts = {}) {
  const transporterInstance = getTransporter();
  const { text, html } = buildUserConfirmationEmailBody(bookingData);

  const userEmail = bookingData.email;
  if (!userEmail) {
    throw new Error('User email is required to send confirmation email.');
  }

  const mailOptions = {
    from: opts.from || defaultBookingFrom,
    to: userEmail,
    replyTo:
      opts.replyTo !== undefined ? opts.replyTo : bookingUserConfirmCcReply,
    cc: opts.cc !== undefined ? opts.cc : bookingUserConfirmCcReply,
    subject: opts.subject || bookConsultPatientThankYou.defaultSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

async function sendSeminarRsvpEmail(rsvpData) {
  const transporterInstance = getTransporter();
  const adminTo = 'info@khannavision.com, rajesh@khannavision.com, kapil@khannavision.com';
  const userEmail = (rsvpData.email || '').trim();
  const eventType = (rsvpData.eventType || 'seminar').toLowerCase();
  const guests = Array.isArray(rsvpData.guests) ? rsvpData.guests : [];
  const numGuests = parseInt(rsvpData.numGuests, 10) || 0;

  const adminText = [
    'KVI Seminar/Webinar RSVP - 8/25/2026',
    '--------------------------------',
    `Name: ${rsvpData.fullName || '—'}`,
    `Email: ${userEmail || '—'}`,
    `Event Type: ${eventType === 'webinar' ? 'Webinar (Online)' : 'Seminar (In-Person)'}`,
    `Guests: ${numGuests || '0'}`,
    guests.length ? `Guest Names: ${guests.join(', ')}` : '',
    `Confirmation: ${rsvpData.agree || '—'}`,
    '',
    `Submitted: ${new Date().toLocaleString()}`
  ].filter(Boolean).join('\n');

  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:500px;margin:0 auto;padding:20px;}h2{color:#0066cc;}table{width:100%;border-collapse:collapse;}td{padding:8px 0;border-bottom:1px solid #eee;}td:first-child{font-weight:600;width:140px;}</style></head>
    <body>
      <h2>KVI Seminar/Webinar RSVP - 8/25/2026</h2>
      <table>
        <tr><td>Name</td><td>${(rsvpData.fullName || '—').replace(/</g, '&lt;')}</td></tr>
        <tr><td>Email</td><td>${(userEmail || '—').replace(/</g, '&lt;')}</td></tr>
        <tr><td>Event Type</td><td>${eventType === 'webinar' ? 'Webinar (Online)' : 'Seminar (In-Person)'}</td></tr>
        <tr><td>Guests</td><td>${numGuests || '0'}${guests.length ? ' — ' + guests.map(g => g.replace(/</g, '&lt;')).join(', ') : ''}</td></tr>
        <tr><td>Confirmation</td><td>${(rsvpData.agree === true ? 'Yes' : rsvpData.agree === false ? 'No' : String(rsvpData.agree ?? '—')).replace(/</g, '&lt;')}</td></tr>
      </table>
      <p style="margin-top:20px;color:#666;font-size:14px;">Submitted: ${new Date().toLocaleString()}</p>
    </body>
    </html>
  `;

  const adminMailOptions = {
    from: defaultBookingFrom,
    to: adminTo,
    subject: `KVI ${eventType === 'webinar' ? 'Webinar' : 'Seminar'} RSVP 8/25/2026 - ${rsvpData.fullName || 'New RSVP'}`,
    text: adminText,
    html: adminHtml
  };

  await transporterInstance.sendMail(adminMailOptions);

  if (userEmail) {
    const bookLink = 'https://khannainstitute.com/about/dr-khanna/books/';
    const zoomLink = 'https://us06web.zoom.us/j/88697907804?pwd=B2SGWPtWo1QZazndxVydb5STki3EGy.1';
    const address = '31824 Village Center Rd F, Westlake Village, CA 91361';
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
    const firstName = rsvpData.firstName || (rsvpData.fullName || '').split(' ')[0] || 'there';

    const bookBoxHtml = `
      <div style="background:linear-gradient(135deg,rgba(42,122,140,0.08) 0%,rgba(74,171,138,0.1) 100%);border:1px solid rgba(42,122,140,0.25);border-radius:12px;padding:20px;margin:24px 0;">
        <h3 style="color:#2a7a8c;font-size:16px;margin:0 0 12px 0;font-weight:600;">Dr. Khanna's Books</h3>
        <p style="margin:0 0 12px 0;font-size:14px;color:#1a3a42;">Explore Dr. Khanna's books on vision care:</p>
        <a href="${bookLink}" style="display:inline-block;background:linear-gradient(135deg,#2a7a8c 0%,#1a8f70 100%);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">View Books</a>
      </div>
    `;

    let eventSpecificHtml = '';
    let eventSpecificText = '';

    if (eventType === 'webinar') {
      eventSpecificHtml = `
        <div style="background:linear-gradient(135deg,rgba(42,122,140,0.08) 0%,rgba(74,171,138,0.1) 100%);border:1px solid rgba(42,122,140,0.25);border-radius:12px;padding:20px;margin:24px 0;">
          <h3 style="color:#2a7a8c;font-size:16px;margin:0 0 12px 0;font-weight:600;">Join the Webinar</h3>
          <p style="margin:0 0 8px 0;font-size:14px;color:#1a3a42;"><strong>Zoom Meeting:</strong></p>
          <p style="margin:0 0 8px 0;"><a href="${zoomLink}" style="color:#1a8f70;word-break:break-all;">${zoomLink}</a></p>
          <p style="margin:0 0 12px 0;font-size:14px;">Meeting ID: 886 9790 7804 · Passcode: 980112</p>
          <a href="${zoomLink}" style="display:inline-block;background:linear-gradient(135deg,#2a7a8c 0%,#1a8f70 100%);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">Join Zoom Meeting</a>
        </div>
      `;
      eventSpecificText = [
        'Join the webinar online:',
        zoomLink,
        'Meeting ID: 886 9790 7804',
        'Passcode: 980112',
        '',
        "Dr. Khanna's books: " + bookLink
      ].join('\n');
    } else {
      eventSpecificHtml = `
        <div style="background:linear-gradient(135deg,rgba(42,122,140,0.08) 0%,rgba(74,171,138,0.1) 100%);border:1px solid rgba(42,122,140,0.25);border-radius:12px;padding:20px;margin:24px 0;">
          <h3 style="color:#2a7a8c;font-size:16px;margin:0 0 12px 0;font-weight:600;">Join Us In Person</h3>
          <p style="margin:0 0 8px 0;font-size:14px;color:#1a3a42;"><strong>Address:</strong></p>
          <p style="margin:0 0 12px 0;font-size:15px;">${address}</p>
          <a href="${mapsUrl}" style="display:inline-block;background:linear-gradient(135deg,#2a7a8c 0%,#1a8f70 100%);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">Get Directions</a>
        </div>
      `;
      eventSpecificText = [
        'Join us at:',
        address,
        'Get directions: ' + mapsUrl,
        '',
        "Dr. Khanna's books: " + bookLink
      ].join('\n');
    }

    const userHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f9ff; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px; }
    .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(42,122,140,0.12); }
    .header { background: linear-gradient(135deg, #1e6a7a 0%, #2a7a8c 50%, #1a8f70 100%); padding: 32px 28px; text-align: center; }
    .header h1 { color: #fff; font-size: 24px; font-weight: 600; margin: 0 0 8px 0; }
    .header p { color: rgba(255,255,255,0.9); font-size: 15px; margin: 0; }
    .body { padding: 28px 28px 32px; }
    .body p { color: #1a3a42; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0; }
    .footer { text-align: center; padding: 20px; color: #5a8090; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>You're on the list!</h1>
        <p>Khanna Vision Institute — Vision ${eventType === 'webinar' ? 'Webinar' : 'Seminar'}</p>
      </div>
      <div class="body">
        <p>Hi ${firstName},</p>
        <p>Thank you for your RSVP. We're excited to see you ${eventType === 'webinar' ? 'online' : 'at our Westlake Village location'} on <strong>Tuesday, August 25th, 2026</strong> from <strong>4:00–6:00 PM PST</strong>.</p>
        ${eventSpecificHtml}
        ${bookBoxHtml}
        <p>We look forward to seeing you there!</p>
      </div>
    </div>
    <p class="footer">© 2026 Khanna Vision Institute · khannainstitute.com</p>
  </div>
</body>
</html>
    `;

    const userText = [
      `Hi ${firstName},`,
      '',
      `Thank you for your RSVP. We're excited to see you ${eventType === 'webinar' ? 'online' : 'at our Westlake Village location'} on Tuesday, August 25th, 2026 from 4:00–6:00 PM PST.`,
      '',
      eventSpecificText,
      '',
      'We look forward to seeing you there!',
      '',
      '— Khanna Vision Institute'
    ].join('\n');

    const userMailOptions = {
      from: defaultBookingFrom,
      to: userEmail,
      subject: `Your RSVP Confirmation — Khanna Vision Institute ${eventType === 'webinar' ? 'Webinar' : 'Seminar'} 8/25/2026`,
      text: userText,
      html: userHtml
    };

    await transporterInstance.sendMail(userMailOptions);
  }
}

const smileLandingLeadToDefault = [
  'info@khannavision.com',
  'rajesh@khannavision.com',
  'kapil@khannavision.com',
  'karim@iayezindia.com'
].join(', ');
const smileLandingLeadTo =
  process.env.SMILE_LA_LANDING_LEAD_EMAIL_TO || smileLandingLeadToDefault;
const smileLandingLeadSubject =
  process.env.SMILE_LA_LANDING_LEAD_EMAIL_SUBJECT ||
  'SMILE LA Landing 2026 — Candidate quiz lead';

const vipConsultDefaultTo =
  process.env.VIP_CONSULT_EMAIL_TO ||
  ['info@khannavision.com', 'rajesh@khannavision.com', 'kapil@khannavision.com'].join(', ');
const vipConsultSubject =
  process.env.VIP_CONSULT_EMAIL_SUBJECT || 'VIP Private Consult — Khanna Vision Institute';

const vipPieBookPublicUrl =
  process.env.VIP_PIE_BOOK_PUBLIC_URL ||
  'https://khannainstitute.com/public/downloads/dr-khanna-pie-rejuvenate-aging-eyes.pdf';
const vipPieBookAttachmentName =
  process.env.VIP_PIE_BOOK_ATTACHMENT_NAME || 'Dr-Khanna-PIE-Rejuvenate-Aging-Eyes.pdf';

function getVipPieBookPdfPath() {
  const override = process.env.VIP_PIE_BOOK_PDF_PATH;
  if (override && fs.existsSync(override)) return override;
  const defaultPath = path.join(
    __dirname,
    '..',
    'public',
    'downloads',
    'dr-khanna-pie-rejuvenate-aging-eyes.pdf'
  );
  return fs.existsSync(defaultPath) ? defaultPath : null;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


async function sendVipConsultNotification(vipData, opts = {}) {
  const transporterInstance = getTransporter();
  const firstName = vipData.firstName || '—';
  const lastName = vipData.lastName || '—';
  const phone = vipData.phone || '—';
  const email = vipData.email || '—';
  const interest = vipData.interest || '—';
  const message = (vipData.message || '').trim() || '—';
  const formSource = vipData.formSource || 'VIP-Consult';

  const text = [
    'VIP Private Consult Request',
    '---------------------------',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Primary interest: ${interest}`,
    `Message: ${message}`,
    `Form source: ${formSource}`,
    '',
    `Submitted: ${new Date().toLocaleString()}`
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:Georgia,serif;line-height:1.6;color:#1a1a2e;max-width:560px;">
      <h2 style="color:#0b1829;">VIP Private Consult Request</h2>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:140px;">Name</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(firstName)} ${escapeHtml(lastName)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Interest</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(interest)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;vertical-align:top;">Message</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(message).replace(/\n/g, '<br/>')}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Source</td>
            <td style="padding:8px 0;">${escapeHtml(formSource)}</td></tr>
      </table>
      <p style="font-size:13px;color:#666;margin-top:16px;"><em>${new Date().toLocaleString()}</em></p>
    </body></html>`;

  const to = opts.to || vipConsultDefaultTo;
  if (!to) {
    throw new Error('VIP consult email recipient is not configured.');
  }

  const mailOptions = {
    from: opts.from || defaultBookingFrom,
    to,
    replyTo: vipData.email || opts.replyTo,
    subject: opts.subject || vipConsultSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}


async function sendVipConsultUserThankYouEmail(vipData, opts = {}) {
  const transporterInstance = getTransporter();
  const rawFirst = (vipData.firstName || '').trim() || 'there';
  const userEmail = (vipData.email || '').trim();
  if (!userEmail) {
    throw new Error('User email is required for VIP consult thank-you email.');
  }

  const pdfPath = getVipPieBookPdfPath();
  let pdfBuffer = null;
  if (pdfPath) {
    try {
      pdfBuffer = fs.readFileSync(pdfPath);
      console.log(
        '[VIP thank-you] PIE book PDF loaded:',
        pdfPath,
        'bytes:',
        pdfBuffer.length
      );
    } catch (readErr) {
      console.error('[VIP thank-you] Could not read PDF, sending link only:', readErr.message);
      pdfBuffer = null;
    }
  } else {
    console.warn(
      '[VIP thank-you] PDF not on disk at public/downloads/dr-khanna-pie-rejuvenate-aging-eyes.pdf — email will be link-only.'
    );
  }

  const subject = opts.subject || vipConsultPatientThankYou.defaultSubject;

  const baseMail = {
    from: opts.from || defaultBookingFrom,
    to: userEmail,
    subject
  };

  if (pdfBuffer && pdfBuffer.length) {
    const { text, html } = vipConsultPatientThankYou.build({
      rawFirstName: rawFirst,
      bookNotePlain: vipConsultPatientThankYou.bookNoteWithAttach,
      downloadUrl: vipPieBookPublicUrl
    });
    try {
      return await transporterInstance.sendMail({
        ...baseMail,
        text,
        html,
        attachments: [
          {
            filename: vipPieBookAttachmentName,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
    } catch (attachErr) {
      console.error(
        '[VIP thank-you] Send with attachment failed, retrying link-only:',
        attachErr.message
      );
    }
  }

  const { text: textLo, html: htmlLo } = vipConsultPatientThankYou.build({
    rawFirstName: rawFirst,
    bookNotePlain: vipConsultPatientThankYou.bookNoteLinkOnly,
    downloadUrl: vipPieBookPublicUrl
  });
  return transporterInstance.sendMail({
    ...baseMail,
    text: textLo,
    html: htmlLo
  });
}

const smileBookConsultStaffDefault = [
  'rajesh@khannavision.com',
  'info@khannavision.com',
  'kapil@khannavision.com',
  'karim@iayezindia.com'
].join(', ');
const smileBookConsultStaffTo =
  process.env.SMILE_BOOK_CONSULT_EMAIL_TO || smileBookConsultStaffDefault;
const smileBookConsultStaffSubject =
  process.env.SMILE_BOOK_CONSULT_EMAIL_SUBJECT ||
  'SMILE cost page — Book consultation request';
const smileBookConsultUserThankYouCc =
  process.env.SMILE_BOOK_CONSULT_USER_THANK_YOU_CC || smileBookConsultStaffDefault;

function formatSmileConsultDate(yyyyMmDd) {
  const s = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return s;
  try {
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return s;
  }
}

async function sendSmileBookConsultStaffNotification(leadData, opts = {}) {
  const transporterInstance = getTransporter();
  const emailRaw = String(leadData.email || '').trim();
  const fullName = escapeHtml(leadData.fullName || '—');
  const emailDisplay = escapeHtml(emailRaw || '—');
  const phone = escapeHtml(leadData.phone || '—');
  const ageDisplay =
    leadData.age !== undefined && leadData.age !== null && String(leadData.age).trim() !== ''
      ? escapeHtml(String(leadData.age))
      : '—';
  const locationDisplay = escapeHtml(leadData.location || '—');
  const prefRaw = String(leadData.preferredDate || '').trim();
  const prefFormatted = formatSmileConsultDate(prefRaw);
  const prefHtml = escapeHtml(prefFormatted);
  const timeRaw = String(leadData.preferredTime || '').trim();
  const timeDisplay = escapeHtml(timeRaw || '—');
  const mailtoHref = emailRaw
    ? 'mailto:' + encodeURIComponent(emailRaw).replace(/'/g, '%27')
    : '#';
  const rawUrl = (leadData.pageUrl || '').trim();
  const safeHref = rawUrl.replace(/"/g, '&quot;');
  const safeText = escapeHtml(rawUrl || '—');

  const text = [
    'SMILE — Book consultation (smile-book-consultation)',
    '--------------------------------',
    `Full name: ${leadData.fullName || '—'}`,
    `Email: ${leadData.email || '—'}`,
    `Phone: ${leadData.phone ? leadData.phone : '— (not provided)'}`,
    `Age: ${leadData.age !== undefined && leadData.age !== null ? leadData.age : '—'}`,
    `Preferred location: ${leadData.location || '—'}`,
    prefRaw ? `Preferred consultation date: ${prefFormatted} (${prefRaw})` : '',
    timeRaw ? `Preferred time: ${timeRaw}` : '',
    rawUrl ? `Submitted from: ${rawUrl}` : '',
    '',
    'Hours: Beverly Hills — Mon & Thu, 8:00 AM – 4:00 PM; Westlake Village — Tue, Wed & Fri, 8:00 AM – 4:00 PM',
    '',
    `Submitted: ${new Date().toLocaleString()}`
  ]
    .filter(Boolean)
    .join('\n');

  const sourceBlock = rawUrl
    ? `<div style="margin:0 0 18px 0;padding:14px 16px;background:#fefce8;border-left:4px solid #ca8a04;border-radius:6px;">
         <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#854d0e;">Form page</p>
         <p style="margin:0;font-size:14px;"><a href="${safeHref}" style="color:#1d4ed8;word-break:break-all;">${safeText}</a></p>
       </div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#111;max-width:560px;">
      <h2 style="color:#1e40af;margin:0 0 12px 0;">SMILE — Book consultation request</h2>
      ${sourceBlock}
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:160px;">Full name</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${fullName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="${mailtoHref}">${emailDisplay}</a></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${phone}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Age</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${ageDisplay}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Preferred location</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${locationDisplay}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Preferred date</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${prefHtml}${prefRaw ? ` <span style="color:#64748b;font-size:12px;">(${escapeHtml(prefRaw)})</span>` : ''}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Preferred time</td>
            <td style="padding:8px 0;">${timeDisplay}</td></tr>
      </table>
      <p style="font-size:12px;color:#475569;margin-top:14px;line-height:1.5;">
        <strong>Consultation hours:</strong> Beverly Hills — Monday &amp; Thursday, 8:00 AM – 4:00 PM.
        Westlake Village — Tuesday, Wednesday &amp; Friday, 8:00 AM – 4:00 PM.
      </p>
      <p style="font-size:12px;color:#666;margin-top:16px;"><em>${new Date().toLocaleString()}</em></p>
    </body></html>`;

  const to = opts.to || smileBookConsultStaffTo;
  const mailOptions = {
    from: opts.from || defaultBookingFrom,
    to,
    replyTo: leadData.email || opts.replyTo,
    subject: opts.subject || smileBookConsultStaffSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

async function sendSmileBookConsultUserThankYou(leadData, opts = {}) {
  const transporterInstance = getTransporter();
  const userEmail = (leadData.email || '').trim();
  if (!userEmail) {
    throw new Error('User email is required for SMILE book consult thank-you.');
  }
  const first = String(leadData.fullName || '').trim().split(/\s+/)[0] || 'there';
  const loc = String(leadData.location || '').trim();
  const prefLine = (() => {
    const raw = String(leadData.preferredDate || '').trim();
    if (!raw) return '';
    const nice = formatSmileConsultDate(raw);
    const tim = String(leadData.preferredTime || '').trim();
    const bits = [];
    if (loc) bits.push(loc);
    bits.push(`${nice}${tim ? ` at ${tim}` : ''}`);
    return `We noted your request for ${bits.join(' · ')}. We’ll confirm by email or phone.`;
  })();

  const { text, html } = smileBookConsultPatientThankYou.build({
    firstNamePlain: first,
    prefLinePlain: prefLine
  });

  const ccList =
    Object.prototype.hasOwnProperty.call(opts, 'cc') && opts.cc !== undefined
      ? opts.cc
      : smileBookConsultUserThankYouCc;

  const mailOpts = {
    from: opts.from || defaultBookingFrom,
    to: userEmail,
    subject: opts.subject || smileBookConsultPatientThankYou.defaultSubject,
    text,
    html
  };

  if (ccList != null && String(ccList).trim() !== '') {
    mailOpts.cc = ccList;
  }

  return transporterInstance.sendMail(mailOpts);
}

async function sendSmileLandingLeadEmail(leadData) {
  const transporterInstance = getTransporter();
  const fullName = (leadData.fullName || '—').replace(/</g, '&lt;');
  const phone = String(leadData.phone || '—').replace(/</g, '&lt;');
  const primaryGoal = (leadData.primaryGoal || '—').replace(/</g, '&lt;');
  const prescriptionRange = (leadData.prescriptionRange || '—').replace(/</g, '&lt;');
  const pageUrl = (leadData.pageUrl || '').trim();

  const text = [
    'SMILE LA Landing Page — Are You a Candidate? (quiz)',
    '--------------------------------',
    `Full name: ${leadData.fullName || '—'}`,
    `Phone: ${leadData.phone || '—'}`,
    `Question 1 — Primary goal: ${leadData.primaryGoal || '—'}`,
    `Question 2 — Prescription range: ${leadData.prescriptionRange || '—'}`,
    pageUrl ? `Submitted from: ${pageUrl}` : '',
    '',
    `Submitted: ${new Date().toLocaleString()}`
  ]
    .filter(Boolean)
    .join('\n');

  const pageRow = pageUrl
    ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Page</td><td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="${pageUrl.replace(/"/g, '&quot;')}">${pageUrl.replace(/</g, '&lt;')}</a></td></tr>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:sans-serif;line-height:1.6;color:#333;max-width:560px;">
      <h2 style="color:#0066cc;">SMILE LA Landing — Candidate quiz</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:160px;">Full name</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${fullName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${phone}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Primary goal</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${primaryGoal}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Prescription range</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${prescriptionRange}</td></tr>
        ${pageRow}
      </table>
      <p style="font-size:13px;color:#666;margin-top:16px;"><em>${new Date().toLocaleString()}</em></p>
    </body></html>`;

  const mailOptions = {
    from: defaultBookingFrom,
    to: smileLandingLeadTo,
    subject: smileLandingLeadSubject,
    text,
    html
  };

  return transporterInstance.sendMail(mailOptions);
}

function escapePhysicianMailText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function physicianBullets(lines) {
  if (!lines || !lines.length) return '<span style="color:#9095a1;">—</span>';
  return `<ul style="margin:10px 0 0;padding:0 0 0 20px;line-height:1.55;color:#1f2937;font-size:15px;font-weight:500;">
${lines.map((t) => `<li style="margin:4px 0;">${escapePhysicianMailText(t)}</li>`).join('')}
</ul>`;
}

function physicianRow(leftLabelUpper, innerHtml) {
  return `<tr><td valign="top" style="padding:13px 12px;width:184px;color:#9298a9;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.09em;text-transform:uppercase;font-weight:700;border-bottom:1px solid #eef2f7;">${escapePhysicianMailText(
    leftLabelUpper
  )}</td><td valign="top" style="padding:13px 12px;color:#161b26;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;font-weight:600;border-bottom:1px solid #eef2f7;">${innerHtml}</td></tr>`;
}

function physicianRowPlain(leftLabelUpper, plain) {
  const v =
    plain && String(plain).trim()
      ? escapePhysicianMailText(String(plain).trim())
      : '<span style="color:#9095a1;">—</span>';
  return physicianRow(leftLabelUpper, v);
}

function physicianRowMultiline(leftLabelUpper, plain) {
  const trimmed = plain && String(plain).trim() ? String(plain).trim() : '';
  if (!trimmed) {
    return physicianRowPlain(leftLabelUpper, '');
  }
  const inner = escapePhysicianMailText(trimmed).replace(/\r?\n/g, '<br />');
  return physicianRow(leftLabelUpper, inner);
}

function physicianBannerRow(title) {
  return `<tr><td colspan="2" style="padding:14px 12px 8px;background:#f8fafc;border-top:1px solid #eef2f7;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:800;color:#64748b;">${escapePhysicianMailText(
    title
  )}</td></tr>`;
}

function splitPipeListForMail(s) {
  if (!s || typeof s !== 'string') return [];
  return s
    .split('|')
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function mapSharedCareDisplayForMail(raw) {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (t === 'comanage') return 'I will comanage as soon as medically appropriate';
  if (t === 'kvi-postop') return 'KVI do post op & return for general eye care';
  return t;
}

/** Turn JSON draft from refer-a-patient “Schedule now” into neat table rows (HTML). */
function buildReferralWorksheetSnapshotTableRows(draftRaw) {
  const raw = typeof draftRaw === 'string' ? draftRaw.trim() : '';
  if (!raw) return '';

  let o;
  try {
    o = JSON.parse(raw);
  } catch (_) {
    const clip = raw.length > 12000 ? `${raw.slice(0, 12000)}\n…` : raw;
    return `
    ${physicianBannerRow('Referral worksheet snapshot (Schedule now)')}
    ${physicianRowMultiline('Raw snapshot (unparsed)', clip)}`;
  }

  if (!o || typeof o !== 'object') return '';

  const personalizedLabel =
    o.personalized === true ? 'yes' : o.personalized === false ? 'no' : '';

  return `
    ${physicianBannerRow('Referral worksheet snapshot (Schedule now)')}
    ${physicianRowPlain('Personalized worksheet', personalizedLabel)}
    ${physicianBannerRow('Referring context')}
    ${physicianRowPlain('Referring practice', o.referringDoctorPractice)}
    ${physicianRowPlain('Referring doctor', o.referringDoctorName)}
    ${physicianRowPlain('Referring phone', o.referringDoctorPhone)}
    ${physicianRowMultiline('Referring address', o.referringDoctorAddress)}
    ${physicianBannerRow('Patient (worksheet snapshot)')}
    ${physicianRowPlain('Patient name', o.patientName)}
    ${physicianRowPlain('DOB / age', o.patientDobAge)}
    ${physicianRowPlain('Patient phone', o.patientPhone)}
    ${physicianRowPlain('Patient email', o.patientEmail)}
    ${physicianRow('Preferred locations', physicianBullets(splitPipeListForMail(o.preferredLocationJoined)))}
    ${physicianRow('Diagnosis', physicianBullets(splitPipeListForMail(o.diagnosisJoined)))}
    ${physicianRow('Suggested procedure', physicianBullets(splitPipeListForMail(o.procedureJoined)))}
    ${physicianRow('Clinical data noted', physicianBullets(splitPipeListForMail(o.clinicalDataJoined)))}
    ${physicianRowPlain('Shared care', mapSharedCareDisplayForMail(o.sharedCare))}
    ${physicianRowMultiline('Special instructions', o.specialInstructions)}
    ${physicianRowPlain('Doctor selection', o.preferredDoctor)}
    ${physicianRowPlain('Submitted by', o.submittedBy)}`;
}

async function sendPhysicianReferralStaffNotification(payload, attachmentsInput) {
  const transporterInstance = getTransporter();

  const {
    referringDoctorName,
    referringDoctorPractice,
    referringDoctorPhoneRaw,
    referringDoctorAddress,
    personalized,
    patientName,
    patientDobAge,
    patientPhone,
    patientEmail,
    preferredLocations,
    diagnoses,
    procedures,
    sharedCare,
    clinicalData,
    specialInstructions,
    preferredDoctor,
    submittedBy,
    scheduledDate,
    scheduledTime,
    bookingId,
    emailKind
  } = payload || {};

  const isScheduled = emailKind === 'scheduled' || !!(scheduledDate || scheduledTime);
  const scheduledDateDisp = scheduledDate ? String(scheduledDate).trim() : '';
  const scheduledTimeDisp = scheduledTime ? String(scheduledTime).trim() : '';
  const bookingIdDisp = bookingId ? String(bookingId).trim() : '';

  const uploaded = Array.isArray(attachmentsInput) ? attachmentsInput : [];
  const namesFromBuffers = uploaded.map((a, idx) =>
    a && typeof a.filename === 'string' && a.filename.trim()
      ? a.filename.trim()
      : `attachment-${idx + 1}`
  );

  const textBody = [
    'KHANNA VISION INSTITUTE · Doctor referral worksheet',
    '='.repeat(60),
    `Submitted: ${new Date().toLocaleString()}`,
    '',
    '[Personalization]',
    `Personalized worksheet: ${personalized ? 'yes' : 'no'}`,
    '',
    '[Referring provider]',
    `Referring Doctor Name: ${referringDoctorName || '—'}`,
    `Referring Practice: ${referringDoctorPractice || '—'}`,
    `Referring Phone: ${referringDoctorPhoneRaw || '—'}`,
    `Referring Address: ${(referringDoctorAddress || '').replace(/\s+/g, ' ') || '—'}`,
    '',
    '[Patient]',
    `Patient name: ${patientName || '—'}`,
    `DOB / age: ${patientDobAge || '—'}`,
    `Patient phone: ${patientPhone || '—'}`,
    `Patient email: ${patientEmail || '—'}`,
    `Preferred location(s): ${(preferredLocations || []).join('; ') || '—'}`,
    '',
    `[Diagnosis]`,
    diagnoses && diagnoses.length ? diagnoses.map((x) => ` • ${x}`).join('\n') : '—',
    '',
    `[Suggested procedure]`,
    procedures && procedures.length ? procedures.map((x) => ` • ${x}`).join('\n') : '—',
    '',
    `[Shared care]`,
    sharedCare ? String(sharedCare).trim() : '—',
    '',
    `[Clinical data available]`,
    clinicalData && clinicalData.length ? clinicalData.map((x) => ` • ${x}`).join('\n') : '—',
    '',
    `[Special instructions]`,
    specialInstructions ? String(specialInstructions).trim() : '—',
    '',
    '[Routing]',
    `Doctor selection: ${preferredDoctor || '—'}`,
    `Submitted by: ${submittedBy || '—'}`,
    '',
    isScheduled
      ? [
          '[Scheduled appointment]',
          `Appointment date: ${scheduledDateDisp || '—'}`,
          `Appointment time: ${scheduledTimeDisp || '—'}`,
          `Zoho booking ID: ${bookingIdDisp || '—'}`,
          ''
        ].join('\n')
      : '',
    namesFromBuffers.length ? `[Attachments]\n${namesFromBuffers.map((n, ix) => `${ix + 1}. ${n}`).join('\n')}` : '[Attachments] none'
  ].join('\n');

  const tableRows = `
    ${personalized ? physicianRowPlain('Personalization', 'Yes — opened via referral partner link') : physicianRowPlain('Personalization', 'General worksheet')}
    ${physicianRowPlain('Referring doctor name', referringDoctorName)}
    ${physicianRowPlain('Referring practice', referringDoctorPractice)}
    ${physicianRowPlain('Referring doctor phone', referringDoctorPhoneRaw)}
    ${physicianRowMultiline('Referring doctor address', (referringDoctorAddress || '').trim())}

    ${physicianRowPlain('Patient name', patientName)}
    ${physicianRowPlain('Patient DOB / age', patientDobAge)}
    ${physicianRowPlain('Patient phone', patientPhone)}
    ${physicianRowPlain('Patient email', patientEmail)}
    ${physicianRow('Preferred location(s)', physicianBullets(preferredLocations))}

    ${physicianRow('Diagnosis', physicianBullets(diagnoses))}
    ${physicianRow('Suggested procedure', physicianBullets(procedures))}
    ${physicianRowPlain('Shared care', sharedCare)}
    ${physicianRow('Clinical data available', physicianBullets(clinicalData))}
    ${physicianRowMultiline('Special instructions', specialInstructions)}
    ${physicianRowPlain('Doctor selection', preferredDoctor)}
    ${physicianRowPlain('Submitted by', submittedBy)}
    ${
      isScheduled
        ? `${physicianBannerRow('Scheduled appointment')}
    ${physicianRowPlain('Appointment date', scheduledDateDisp)}
    ${physicianRowPlain('Appointment time', scheduledTimeDisp)}
    ${physicianRowPlain('Zoho booking ID', bookingIdDisp)}`
        : ''
    }
  `;

  const attachmentNote =
    namesFromBuffers.length > 0
      ? `
        <div style="margin:18px 0 0;color:#475467;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.55;">
          <strong style="color:#111827;">Uploaded files (${namesFromBuffers.length})</strong> are attached directly to this message (not hosted on-site).
          <ul style="margin:8px 0 0;padding:0 0 0 18px;color:#667085;font-size:13px;line-height:1.6;">
${namesFromBuffers.slice(0, 30).map((nm) => `<li style="margin:3px 0;">${escapePhysicianMailText(nm)}</li>`).join('')}
          </ul>
          ${
            namesFromBuffers.length > 30
              ? `<div style="margin-top:6px;color:#9298a9;">(+ additional files truncated in list)</div>`
              : ''
          }
        </div>`
      : `<div style="margin:14px 0 0;color:#9298a9;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.55;">No files were uploaded.</div>`;

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="color-scheme" content="light dark" />
    </head>
    <body style="margin:0;padding:26px;background:#edf0f7;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 auto;max-width:720px;background:#edf0f7;">
        <tr>
          <td style="padding:8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:14px;border:1px solid #dfe5ef;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
              <tr>
                <td style="padding:26px 28px;background:linear-gradient(135deg,#121826,#1b2436);border-bottom:4px solid #d6b066;">
                  <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;line-height:1.2;color:#f4f5f7;">
                    Doctor referral <span style="font-style:italic;color:#f4e6c8;">${isScheduled ? 'appointment scheduled' : 'worksheet'}</span>
                  </div>
                  <div style="margin-top:12px;font-family:DM Sans,'Segoe UI',Arial,sans-serif;color:#cdd2dc;font-size:14px;line-height:1.55;font-weight:500;">
                    Khanna Vision Institute · ${isScheduled ? 'referral worksheet · Schedule now' : 'routed from the doctors portal worksheet'}
                  </div>
                  <div style="margin-top:14px;font-family:DM Sans,'Segoe UI',Arial,sans-serif;color:#eae4ce;font-size:12px;line-height:1.6;opacity:0.9;">
                    Submitted ${escapePhysicianMailText(new Date().toLocaleString())}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 8px 6px;background:#fafbfc;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                    ${tableRows}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 20px 24px;background:#fafbfc;">
                  ${attachmentNote}
                  <div style="margin-top:18px;color:#aab0bc;font-family:DM Sans,'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.5;text-align:center;">
                    © Khanna Vision Institute · Beverly Hills & Westlake Village · khannainstitute.com
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim();

  const subjectPatient = (patientName ? String(patientName).trim() : 'New referral')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 120);
  const subjectLead = isScheduled
    ? `${physicianReferralSubjectBase} · appointment scheduled`
    : physicianReferralSubjectBase;

  const mailOpts = {
    from: physicianReferralFromDefault,
    to: physicianReferralTo,
    subject: `${subjectLead} · ${subjectPatient}`,
    text: textBody,
    html: htmlBody,
    attachments: uploaded
      .filter((a) => a && Buffer.isBuffer(a.content))
      .map((a) => ({
        filename:
          typeof a.filename === 'string' && a.filename.trim()
            ? a.filename.trim()
            : `attachment-${Date.now()}.dat`,
        content: a.content,
        contentType: a.contentType
      }))
  };

  return transporterInstance.sendMail(mailOpts);
}

async function sendDoctorportalBookConsultStaffEmail(payload) {
  const transporterInstance = getTransporter();

  const {
    apptForLabel,
    visitType,
    preferredLocation,
    preferredDate,
    preferredTime,
    firstName,
    lastName,
    fullName,
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
    sourcePath,
    attachmentsInput
  } = payload || {};

  const isOfficeReferral =
    String(apptForLabel || '').toLowerCase().indexOf("doctor's office") >= 0 ||
    String(apptForLabel || '').toLowerCase().indexOf('office referral') >= 0;

  const referringBlockTxt =
    isOfficeReferral
      ? [
          '',
          '[Referring doctor / practice]',
          `Referring doctor: ${referringDoctorName || '—'}`,
          `Practice: ${referringDoctorPractice || '—'}`,
          `Referring phone: ${referringDoctorPhone || '—'}`,
          `Practice address: ${referringDoctorAddress || '—'}`,
          `Submitted by: ${referringSubmittedBy || '—'}`
        ].join('\n')
      : '';

  const referringBlockHtml = isOfficeReferral
    ? `${physicianBannerRow('Referring doctor / practice')}
    ${physicianRowPlain('Referring doctor', referringDoctorName)}
    ${physicianRowPlain('Practice', referringDoctorPractice)}
    ${physicianRowPlain('Referring phone', referringDoctorPhone)}
    ${physicianRowMultiline('Practice address', referringDoctorAddress)}
    ${physicianRowPlain('Submitted by', referringSubmittedBy)}`
    : '';

  const worksheetBlock =
    referralWorksheetSummary && String(referralWorksheetSummary).trim()
      ? String(referralWorksheetSummary).trim()
      : '';

  const worksheetSnapshotHtml =
    buildReferralWorksheetSnapshotTableRows(
      typeof referralWorksheetDraftRaw === 'string' ? referralWorksheetDraftRaw.trim() : ''
    ) ||
    (worksheetBlock ? physicianBannerRow('Referral worksheet snapshot') + physicianRowMultiline('Details', worksheetBlock) : '');

  const attachments = Array.isArray(attachmentsInput) ? attachmentsInput : [];
  const attachmentMeta = attachments
    .filter((a) => a && Buffer.isBuffer(a.content))
    .map((a, idx) =>
      a && typeof a.filename === 'string' && a.filename.trim()
        ? a.filename.trim()
        : `attachment-${idx + 1}`
    );

  const txt = [
    'KHANNA VISION INSTITUTE · Doctors portal — Book consultation',
    '='.repeat(58),
    `Submitted: ${new Date().toLocaleString()}`,
    `Source: ${sourcePath || '/Doctorportal/book-consultation'}`,
    '',
    `Appointment for: ${apptForLabel || '—'}`,
    `Visit type: ${visitType || '—'}`,
    `Preferred office: ${preferredLocation || '—'}`,
    `Preferred date: ${preferredDate || '—'}`,
    `Preferred time window: ${preferredTime || '—'}`,
    '',
    `Patient: ${fullName || `${firstName || ''} ${lastName || ''}`.trim() || '—'}`,
    `DOB: ${dob || '—'}`,
    `Phone: ${phone || '—'}`,
    `Email: ${email || '—'}`,
    referringBlockTxt,
    '',
    '[Notes]',
    notes ? String(notes).trim() : '—',
    worksheetBlock ? '\n[Referral worksheet — carried from Schedule now]\n' + worksheetBlock : '',
    attachmentMeta.length ? `\n[Attachments with scheduling request]\n${attachmentMeta.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : ''
  ].join('\n');

  const tableRows = `
    ${physicianRowPlain('Submitted', new Date().toLocaleString())}
    ${physicianRowPlain('Source', sourcePath || '/Doctorportal/book-consultation')}
    ${physicianRowPlain('Appointment for', apptForLabel)}
    ${physicianRowPlain('Visit type', visitType)}
    ${physicianRowPlain('Preferred office', preferredLocation)}
    ${physicianRowPlain('Preferred date', preferredDate)}
    ${physicianRowPlain('Preferred time', preferredTime)}
    ${physicianRowPlain('First name', firstName)}
    ${physicianRowPlain('Last name', lastName)}
    ${physicianRowPlain('DOB', dob)}
    ${physicianRowPlain('Phone', phone)}
    ${physicianRowPlain('Email', email)}
    ${referringBlockHtml}
    ${physicianRowMultiline('Notes', notes)}
    ${worksheetSnapshotHtml}
    ${attachmentMeta.length ? physicianBannerRow('Attachments with scheduling request') : ''}
    ${attachmentMeta.length ? physicianRow('Files attached', physicianBullets(attachmentMeta)) : ''}
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:22px;background:#edf0f7;font-family:DM Sans,'Segoe UI',Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 auto;max-width:680px;background:#edf0f7;">
        <tr><td style="padding:10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:14px;border:1px solid #dfe5ef;overflow:hidden;box-shadow:0 20px 48px rgba(15,23,42,0.08);">
            <tr><td style="padding:22px 24px;background:linear-gradient(135deg,#121826,#1b2436);border-bottom:4px solid #d6b066;">
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:24px;line-height:1.2;color:#f4f5f7;">
                Book consultation <span style="font-style:italic;color:#f4e6c8;">request</span>
              </div>
              <div style="margin-top:10px;color:#cdd2dc;font-size:13px;line-height:1.55;font-weight:500;">
                Khanna Vision Institute · Doctors portal
              </div>
              <div style="margin-top:12px;color:#eae4ce;font-size:12px;line-height:1.5;">
                Submitted ${escapePhysicianMailText(new Date().toLocaleString())}
              </div>
            </td></tr>
            <tr><td style="padding:12px 6px;background:#fafbfc;">
              <table role="presentation" width="100%" style="border-collapse:collapse;">
                ${tableRows}
              </table>
            </td></tr>
            <tr><td style="padding:16px 20px;text-align:center;color:#aab0bc;font-size:11px;line-height:1.5;">
              © Khanna Vision Institute · khannainstitute.com
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
  `.trim();

  const subjectLead = (
    fullName ||
    `${typeof firstName === 'string' ? firstName.trim() : ''} ${
      typeof lastName === 'string' ? lastName.trim() : ''
    }`.trim() ||
    'New request'
  )
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 100);

  const mailOpts = {
    from: portalBookConsultFromDefault,
    to: portalBookConsultEmailTo,
    subject: `${portalBookConsultSubjectBase} · ${subjectLead}`,
    text: txt,
    html,
    attachments: attachments
      .filter((a) => a && Buffer.isBuffer(a.content))
      .map((a) => ({
        filename:
          typeof a.filename === 'string' && a.filename.trim()
            ? a.filename.trim()
            : `attachment-${Date.now()}.dat`,
        content: a.content,
        contentType: a.contentType
      }))
  };

  return transporterInstance.sendMail(mailOpts);
}

module.exports = {
  sendVisionQuestSummary,
  sendBookingNotification,
  sendOnlineConsultNotification,
  sendUserConfirmationEmail,
  sendSeminarRsvpEmail,
  sendSmileLandingLeadEmail,
  sendSmileBookConsultStaffNotification,
  sendSmileBookConsultUserThankYou,
  sendVipConsultNotification,
  sendVipConsultUserThankYouEmail,
  sendPhysicianReferralStaffNotification,
  sendDoctorportalBookConsultStaffEmail,
  buildPrefilledZohoFormUrl
};
