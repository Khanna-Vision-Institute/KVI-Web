const defaultSubject =
  'Thank you — we received your SMILE consultation request | Khanna Vision Institute';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function build({ firstNamePlain, prefLinePlain }) {
  const first = String(firstNamePlain || '').trim() || 'there';

  const text = [
    `Hi ${first},`,
    '',
    'Thank you for requesting a SMILE consultation with Khanna Vision Institute.',
    '',
    prefLinePlain ||
      'Our team will review your request and contact you shortly.',
    '',
    'Consultation hours: Beverly Hills — Mon & Thu, 8 AM – 4 PM. Westlake Village — Tue, Wed & Fri, 8 AM – 4 PM.',
    '',
    '— Khanna Vision Institute',
    'Beverly Hills · Westlake Village',
    'https://khannainstitute.com/'
  ].join('\n');

  const detailHtml = prefLinePlain
    ? `<p style="font-size:15px;color:#334155;">${escapeHtml(prefLinePlain)}</p>`
    : '<p style="font-size:15px;">Our team will review your details and contact you shortly.</p>';

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.65;color:#0f172a;max-width:560px;margin:0;padding:24px;">
      <p style="font-size:17px;">Hi ${escapeHtml(first)},</p>
      <p style="font-size:15px;">Thank you for requesting a <strong>SMILE consultation</strong> with <strong>Khanna Vision Institute</strong>.</p>
      ${detailHtml}
      <p style="font-size:13px;color:#64748b;margin-top:16px;">Consultation hours: Beverly Hills — Monday &amp; Thursday, 8:00 AM – 4:00 PM. Westlake Village — Tuesday, Wednesday &amp; Friday, 8:00 AM – 4:00 PM.</p>
      <p style="font-size:13px;color:#64748b;margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
        Khanna Vision Institute<br/>
        Beverly Hills · Westlake Village · <a href="https://khannainstitute.com/" style="color:#2563eb;">khannainstitute.com</a>
      </p>
    </body></html>`;

  return { text, html };
}

module.exports = { defaultSubject, build };
