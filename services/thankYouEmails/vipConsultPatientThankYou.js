const defaultSubject =
  'Thank you - your PIE book + VIP consult request | Khanna Vision Institute';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function build({ rawFirstName, bookNotePlain, downloadUrl }) {
  const safeFirst = String(rawFirstName || '').trim() || 'there';
  const firstNameHtml = escapeHtml(safeFirst);
  const safeUrl = escapeHtml(downloadUrl);

  const text = [
    `Hi ${safeFirst},`,
    '',
    'Thank you for your VIP Private Consult request with Khanna Vision Institute.',
    '',
    bookNotePlain.replace(/\n/g, ' '),
    '',
    `Download: ${downloadUrl}`,
    '',
    'Our staff will contact you soon to follow up.',
    '',
    '- Khanna Vision Institute',
    'Beverly Hills - Westlake Village',
    'https://khannainstitute.com/'
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:Georgia,'Times New Roman',serif;line-height:1.65;color:#1a1a2e;max-width:560px;margin:0;padding:24px;">
      <p style="font-size:17px;">Hi ${firstNameHtml},</p>
      <p style="font-size:15px;">Thank you for your <strong>VIP Private Consult</strong> request with <strong>Khanna Vision Institute</strong>.</p>
      <p style="font-size:15px;">${escapeHtml(bookNotePlain)}</p>
      <p style="margin:28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#0c1a2e 0%,#163256 100%);color:#f0e4c4!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">Download your PIE book (PDF)</a>
      </p>
      <p style="font-size:14px;color:#444;">Our staff will contact you soon to follow up.</p>
      <p style="font-size:13px;color:#666;margin-top:32px;padding-top:20px;border-top:1px solid #e5e5e5;">
        Khanna Vision Institute<br/>
        Beverly Hills - Westlake Village - <a href="https://khannainstitute.com/" style="color:#163256;">khannainstitute.com</a>
      </p>
    </body></html>`;

  return { text, html };
}

const bookNoteWithAttach =
  "We've attached Dr. Khanna's PIE book (PDF) to this email. You can also download it using the button below if your inbox blocks attachments.";
const bookNoteLinkOnly =
  "Download Dr. Khanna's PIE book (PDF) using the link below (your inbox will always get this message even if attachments are blocked).";

module.exports = {
  defaultSubject,
  build,
  bookNoteWithAttach,
  bookNoteLinkOnly
};
