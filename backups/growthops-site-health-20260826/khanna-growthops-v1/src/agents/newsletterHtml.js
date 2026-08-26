/**
 * Gmail + Zoho Campaigns compatible HTML newsletter.
 * Table layout, inline styles only, no external CSS.
 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert lightweight markdown/plain body to email-safe HTML fragments. */
function plainBodyToHtml(body) {
  const lines = String(body || '').split('\n');

  function nextMeaningful(idx) {
    for (let j = idx + 1; j < lines.length; j += 1) {
      const t = lines[j].trim();
      if (t) return t;
    }
    return '';
  }

  let html = '';
  let inList = false;
  let inOrderedList = false;
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  const closeOrderedList = () => {
    if (inOrderedList) {
      html += '</ol>';
      inOrderedList = false;
    }
  };
  const closeLists = () => {
    closeList();
    closeOrderedList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      const next = nextMeaningful(i);
      if (inList && /^[-*•]\s+/.test(next)) continue;
      if (inOrderedList && /^\d+\.\s+/.test(next)) continue;
      closeLists();
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeLists();
      const h = escapeHtml(line.replace(/^##\s+/, ''));
      html += `<h2 style="margin:28px 0 14px;font-size:20px;line-height:1.35;color:#0f2b4c;font-family:Georgia,'Times New Roman',serif;font-weight:600;">${h}</h2>`;
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeLists();
      const h = escapeHtml(line.replace(/^#\s+/, ''));
      html += `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#0f2b4c;font-family:Georgia,'Times New Roman',serif;">${h}</h1>`;
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      closeOrderedList();
      if (!inList) {
        html += '<ul style="margin:0 0 18px 22px;padding:0;color:#243447;">';
        inList = true;
      }
      const item = escapeHtml(line.replace(/^[-*•]\s+/, ''))
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f2b4c;">$1</strong>');
      html += `<li style="margin:0 0 10px;line-height:1.65;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${item}</li>`;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      closeList();
      if (!inOrderedList) {
        html += '<ol style="margin:0 0 18px 26px;padding:0;color:#243447;">';
        inOrderedList = true;
      }
      const item = escapeHtml(line.replace(/^\d+\.\s+/, ''))
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f2b4c;">$1</strong>');
      html += `<li style="margin:0 0 10px;line-height:1.65;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${item}</li>`;
      continue;
    }
    closeLists();
    const para = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f2b4c;">$1</strong>');
    html += `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#243447;font-family:Arial,Helvetica,sans-serif;">${para}</p>`;
  }
  closeLists();
  return html || '<p style="margin:0;font-size:16px;line-height:1.65;color:#243447;">&nbsp;</p>';
}

/** Highlight card for Seminar & Webinar — Zoho/Gmail safe tables. */
function seminarBlockHtml(seminar, { reminder = false } = {}) {
  if (!seminar) return '';
  const rsvp = escapeHtml(seminar.rsvpUrl || 'https://khannainstitute.com/seminar-rsvp/');
  const badge = reminder ? 'REMINDER · RSVP TODAY' : 'SEMINAR &amp; WEBINAR';
  const cta = reminder ? 'Reserve your spot' : 'RSVP — save your seat';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 28px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="background:linear-gradient(135deg,#0f4a45 0%,#1e6a7a 55%,#155045 100%);border-radius:16px;padding:0;overflow:hidden;border:1px solid #2a8f7a;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#a8e6cf;font-family:Arial,Helvetica,sans-serif;">${badge}</p>
                <h2 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:600;">${escapeHtml(seminar.title || 'Vision Seminar & Webinar')}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(255,255,255,0.08);border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#e8f7f2;">
                        <strong style="color:#ffffff;">📅 ${escapeHtml(seminar.dateLine || '')}</strong>
                      </p>
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#d4efe8;">
                        <strong style="color:#ffffff;">🕐 ${escapeHtml(seminar.timeLine || '')}</strong>
                      </p>
                      <p style="margin:0;font-size:15px;line-height:1.5;color:#c8e8df;">
                        <strong style="color:#ffffff;">📍 ${escapeHtml(seminar.location || '')}</strong>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.88);font-family:Arial,Helvetica,sans-serif;">${escapeHtml(seminar.description || '')}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="border-radius:999px;background:linear-gradient(90deg,#c9a227 0%,#e8c547 100%);">
                      <a href="${rsvp}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#0f2b4c;text-decoration:none;font-family:Arial,Helvetica,sans-serif;border-radius:999px;">${cta}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/** Add Gmail HTML to newsletter payload when missing (older drafts). */
function ensureNewsletterHtml(payload) {
  if (!payload || payload.htmlDocument) return payload;
  const subject = (payload.subjectOptions && payload.subjectOptions[0]) || 'Khanna Vision Institute Newsletter';
  const bodyPlain = payload.body || '';
  return {
    ...payload,
    htmlDocument: buildGmailNewsletter({
      subject,
      bodyPlain,
      preheader: bodyPlain.replace(/\s+/g, ' ').slice(0, 140),
      seminar: payload.seminar,
      kind: payload.kind || 'newsletter',
      includeSeminar: payload.includeSeminar !== false,
    }),
  };
}

/**
 * Wrap content in a full HTML document suitable for Gmail / Zoho / download.
 */
function buildGmailNewsletter({ subject, bodyPlain, preheader, seminar, kind, includeSeminar }) {
  const safeSubject = escapeHtml(subject || 'Khanna Vision Institute Newsletter');
  const pre = escapeHtml(preheader || (subject || '').slice(0, 120));
  const inner = plainBodyToHtml(bodyPlain);
  const isReminder = kind === 'reminder';
  const headerTitle = isReminder ? 'Event Reminder' : 'The Vision Brief';

  const showSeminar = includeSeminar !== false && seminar;
  const seminarHtml = showSeminar ? seminarBlockHtml(seminar, { reminder: isReminder }) : '';

  const consultUrl = 'https://khannainstitute.com/vip-consult';
  const ctaBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:32px 0 8px;">
      <tr>
        <td align="center">
          <a href="${consultUrl}" target="_blank" style="display:inline-block;background:linear-gradient(90deg,#0d7c8c 0%,#1a9aaa 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 32px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 14px rgba(13,124,140,0.35);">Schedule a consultation</a>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#6b7c8f;text-align:center;font-family:Arial,Helvetica,sans-serif;">
      Educational information only · Individual results vary · Consultation required
    </p>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeSubject}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef3f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${pre}&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef3f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(15,43,76,0.08);">
          <!-- Accent bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#c9a227 0%,#0d7c8c 50%,#1a4a7a 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(145deg,#0f2b4c 0%,#1a4a7a 60%,#0d5c6e 100%);padding:32px 36px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/khannainstitute/Logo+2.png" alt="Khanna Vision Institute" width="180" style="display:block;margin:0 0 16px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#c9a227;font-family:Arial,Helvetica,sans-serif;">Khanna Vision Institute</p>
                    <h1 style="margin:0;font-size:28px;line-height:1.25;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:600;">${escapeHtml(headerTitle)}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;font-family:Arial,Helvetica,sans-serif;">
              ${seminarHtml}
              ${inner}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px 32px;background-color:#f6f9fc;border-top:1px solid #e4ecf4;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a5d70;font-family:Arial,Helvetica,sans-serif;">
                <strong style="color:#0f2b4c;">Khanna Vision Institute</strong><br>
                Beverly Hills &amp; Westlake Village, California
              </p>
              <p style="margin:0;font-size:12px;line-height:1.55;color:#8a97a6;font-family:Arial,Helvetica,sans-serif;">
                Practice news and educational updates — not medical advice.<br>
                <a href="https://khannainstitute.com" style="color:#0d7c8c;text-decoration:underline;">khannainstitute.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

module.exports = { plainBodyToHtml, buildGmailNewsletter, ensureNewsletterHtml, escapeHtml, seminarBlockHtml };
