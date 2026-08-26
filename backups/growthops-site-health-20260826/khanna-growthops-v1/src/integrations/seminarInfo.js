/**
 * Fetch upcoming seminar / webinar details from the public RSVP page.
 * Used by newsletter generation — read-only, no auth required.
 */

const RSVP_URL = 'https://khannainstitute.com/seminar-rsvp/';

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? stripTags(m[group]) : '';
}

/**
 * @returns {Promise<{
 *   title: string,
 *   dateLine: string,
 *   timeLine: string,
 *   location: string,
 *   description: string,
 *   rsvpUrl: string,
 *   fetchedAt: string,
 * }>}
 */
async function fetchSeminarInfo() {
  const res = await fetch(RSVP_URL, {
    headers: {
      'User-Agent': 'Khanna-GrowthOps/1.0 (+internal newsletter)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Seminar page HTTP ${res.status}`);

  const html = await res.text();
  const title = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html) || 'Vision Seminar & Webinar';

  const whenHtml = (html.match(/<p class="when"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
  const whenParts = whenHtml
    .split(/<br\s*\/?>/gi)
    .map(stripTags)
    .filter(Boolean);
  const dateLine = whenParts[0] || '';
  const timeLine = whenParts[1] || '';

  const intro = pick(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/i, html);
  const location =
    intro.match(/Westlake Village/i) ? 'Westlake Village, CA (in person) or online via Zoom' : 'Westlake Village or online';

  const titleTag = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const dateFromTitle = titleTag.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i
  );

  return {
    title,
    dateLine: dateLine || (dateFromTitle ? dateFromTitle[0] : 'See RSVP page for date'),
    timeLine: timeLine.includes('PM') || timeLine.includes('AM') ? timeLine : '4:00–6:00 PM PST',
    location,
    description:
      intro ||
      'Join us in Westlake Village or online for an evening on LASIK, SMILE, PIE, and more. Reserve your spot below.',
    rsvpUrl: RSVP_URL,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { fetchSeminarInfo, RSVP_URL };
