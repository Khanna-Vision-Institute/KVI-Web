const { scanDraft } = require('./complianceAgent');
const config = require('../config');
const { buildGmailNewsletter, ensureNewsletterHtml } = require('./newsletterHtml');
const { fetchSeminarInfo } = require('../integrations/seminarInfo');
const { collectGrowthSignals } = require('./analyticsAnalyst');

const NEWSLETTER_PROMPT = `You are a patient newsletter writer for Khanna Vision Institute, an ophthalmology practice.
Write a warm, professional email newsletter for existing patients and prospects.

Hard rules (compliance — never violate):
- No hype, fear-based copy, or urgency pressure (except gentle event reminders when asked).
- NEVER guarantee outcomes or claim "best surgeon" / superlative rankings.
- Do not invent statistics, prices, or testimonials.
- State that candidacy varies and a consultation is required.
- Refer to the practice as "Khanna Vision Institute".

Output format (exactly):
SUBJECT 1: <first subject line option>
SUBJECT 2: <second subject line option>
SUBJECT 3: <third subject line option>

BODY:
<newsletter body in plain text with short paragraphs; use ## for section headings and - for bullet lists>
Start with a greeting like "Dear Valued Patients and Friends,".
End with a brief sign-off from Khanna Vision Institute.
Do NOT duplicate the Seminar & Webinar section — it is added automatically in the HTML template.`;

const REMINDER_PROMPT = `You are writing a friendly REMINDER email for an upcoming Khanna Vision Institute Vision Seminar & Webinar.
The reader may have seen an earlier invitation. Encourage them to RSVP if they have not yet.
Tone: warm, helpful, not pushy. Mention the event is soon.
Same compliance rules as newsletters (no guarantees, no invented stats).

Output format (exactly):
SUBJECT 1: <reminder subject option>
SUBJECT 2: <second option>
SUBJECT 3: <third option>

BODY:
<short reminder body, ~150-250 words; ## headings ok>
Start with "Dear Valued Patients and Friends,".
Do NOT repeat full event details (date/time card is in the template) — reference the event briefly.`;

function templateNewsletter({ topic, blog, seminar }) {
  const subjectOptions = topic
    ? [
        `${topic.slice(0, 50)} — from Khanna Vision`,
        'Your Vision Brief: what patients are asking about',
        'Eye health updates from Khanna Vision Institute',
      ]
    : [
        '3 eye-health updates worth seeing this month',
        'The Vision Brief: new eye news in plain English',
        'Eye news, safety tips, and what patients should know',
      ];

  const main = blog?.body
    ? blog.body.slice(0, 1200)
    : topic
      ? `This month we are sharing practical guidance on **${topic}** — what patients at Khanna Vision Institute often ask about, and what the research suggests in plain language.

Every eye is different. A consultation helps determine whether SMILE, LASIK, EVO ICL, or other options may be appropriate for you.`
      : `Here is this month's patient-friendly vision news summary from Khanna Vision Institute — educational updates on SMILE, LASIK, EVO ICL, and everyday eye health.`;

  const seminarNote = seminar
    ? `\n\n## Upcoming event\n\nWe hope you can join our Vision Seminar & Webinar. Details and RSVP are in the highlighted section above.`
    : '';

  const body = `Dear Valued Patients and Friends,

${main}
${seminarNote}

## Next step

Schedule a consultation to discuss your vision goals with our team.

With care,
Khanna Vision Institute`;

  return { subjectOptions, body, generatedBy: 'template' };
}

function templateReminder({ seminar }) {
  const dateBit = seminar?.dateLine ? ` on ${seminar.dateLine}` : ' soon';
  return {
    subjectOptions: [
      `Reminder: Vision Seminar & Webinar${dateBit}`,
      'Your seat is waiting — RSVP for our vision event',
      'Last chance to join us — seminar & webinar RSVP',
    ],
    body: `Dear Valued Patients and Friends,

This is a friendly reminder about our upcoming **Vision Seminar & Webinar**${dateBit}.

Whether you attend in Westlake Village or join online, you will hear clear, educational information about LASIK, SMILE, PIE, and more — with time for your questions.

If you have not reserved your spot yet, please use the RSVP button in this email. Spaces are limited for the in-person seminar.

We look forward to seeing you.

Warm regards,
Khanna Vision Institute`,
    generatedBy: 'template',
  };
}

function parseNewsletter(text) {
  const subjectOptions = [];
  let body = '';
  let inBody = false;

  for (const line of text.split('\n')) {
    const subj = line.match(/^\s*SUBJECT\s*\d+:\s*(.+)$/i);
    if (subj) {
      subjectOptions.push(subj[1].trim());
      continue;
    }
    if (/^\s*BODY:\s*$/i.test(line)) {
      inBody = true;
      continue;
    }
    if (inBody) body += `${line}\n`;
  }

  body = body.trim();
  if (!subjectOptions.length || !body) return null;
  return { subjectOptions: subjectOptions.slice(0, 3), body, generatedBy: 'openai' };
}

function briefingSnippet(signals) {
  const sc = signals?.searchConsole?.topQueries || [];
  const ga = signals?.ga4?.landingPages || [];
  const lines = [];
  if (sc.length) {
    lines.push('Top search queries: ' + sc.slice(0, 4).map((q) => `"${q.query}"`).join(', '));
  }
  if (ga.length) {
    lines.push('Top pages: ' + ga.slice(0, 3).map((p) => p.path).join(', '));
  }
  return lines.join('\n') || '';
}

async function suggestNewsletterTopics(options = {}) {
  const kind = options.kind === 'reminder' ? 'reminder' : 'newsletter';
  const signals = await collectGrowthSignals();
  const briefing = briefingSnippet(signals);

  if (config.integrationsEnabled.openai) {
    try {
      const { generateDraft } = require('../integrations/openai/client');
      const text = await generateDraft({
        maxTokens: 500,
        systemPrompt: `You are an email marketing strategist for Khanna Vision Institute (ophthalmology).
Propose ${kind === 'reminder' ? 'reminder email' : 'patient newsletter'} topics. Educational tone only.
Respond as JSON array of 5 objects: [{"topic": string, "angle": string}].`,
        userPrompt: `${briefing}\n\nKind: ${kind}\nReturn 5 distinct email topic ideas.`,
      });
      const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
      if (Array.isArray(parsed) && parsed.length) {
        return { topics: parsed.slice(0, 5) };
      }
    } catch (err) {
      console.warn('[growthops] newsletter topic suggest failed:', err.message);
    }
  }

  const fallback = [
    { topic: 'SMILE vs LASIK — what active patients should know', angle: 'Comparison in plain language' },
    { topic: 'EVO ICL for patients who are not LASIK candidates', angle: 'Lens-based vision correction' },
    { topic: 'Keratoconus updates and modern treatment paths', angle: 'Specialty care at KVI' },
    { topic: 'What to expect at your vision consultation', angle: 'Reduces friction to book' },
    { topic: 'Dry eye and screen time — practical tips', angle: 'Seasonal eye health' },
  ];
  if (kind === 'reminder') {
    return {
      topics: [
        { topic: 'Seminar reminder — 48 hours before the event', angle: 'RSVP nudge' },
        { topic: 'Webinar link reminder for online attendees', angle: 'Zoom details follow-up' },
        { topic: 'Last seats for in-person Westlake Village seminar', angle: 'Gentle urgency' },
      ],
    };
  }
  return { topics: fallback };
}

/**
 * Draft a patient newsletter or reminder email.
 * @param {object} options
 * @param {'newsletter'|'reminder'} [options.kind]
 * @param {string} [options.topic]
 * @param {boolean} [options.includeSeminar]
 * @param {object} [options.blog] optional source blog
 */
async function draftNewsletter(options = {}) {
  const kind = options.kind === 'reminder' ? 'reminder' : 'newsletter';
  const includeSeminar = options.includeSeminar !== false;
  let seminar = null;

  if (includeSeminar) {
    try {
      seminar = await fetchSeminarInfo();
    } catch (err) {
      console.warn('[growthops] seminar fetch failed:', err.message);
    }
  }

  const signals = await collectGrowthSignals();
  const topic = (options.topic || '').trim();
  const blog = options.blog || null;
  let draft;

  const systemPrompt = kind === 'reminder' ? REMINDER_PROMPT : NEWSLETTER_PROMPT;
  const seminarCtx = seminar
    ? `\n\nEvent context (card is auto-inserted in HTML — do not repeat full details):\nTitle: ${seminar.title}\nWhen: ${seminar.dateLine} ${seminar.timeLine}\nWhere: ${seminar.location}`
    : '';

  if (config.integrationsEnabled.openai) {
    try {
      const { generateDraft } = require('../integrations/openai/client');
      const userPrompt =
        kind === 'reminder'
          ? `Write a reminder email for the Vision Seminar & Webinar.${seminarCtx}\n${topic ? `Focus angle: ${topic}` : ''}`
          : blog
            ? `Blog title: ${blog.title || 'Vision news'}\n\nBlog content:\n${blog.body || ''}\n\nCreate a newsletter (~300-450 words).${seminarCtx}`
            : `Topic: ${topic || 'General vision health update for patients'}\n\nResearch context:\n${briefingSnippet(signals)}${seminarCtx}\n\nCreate a patient newsletter (~300-450 words).`;

      const text = await generateDraft({
        systemPrompt,
        userPrompt,
        maxTokens: kind === 'reminder' ? 800 : 1200,
      });
      const parsed = parseNewsletter(text);
      draft =
        parsed ||
        (kind === 'reminder'
          ? templateReminder({ seminar })
          : templateNewsletter({ topic, blog, seminar }));
    } catch (err) {
      console.warn(`[growthops] newsletter OpenAI failed (${err.message}) — template`);
      draft =
        kind === 'reminder'
          ? templateReminder({ seminar })
          : templateNewsletter({ topic, blog, seminar });
    }
  } else {
    draft =
      kind === 'reminder'
        ? templateReminder({ seminar })
        : templateNewsletter({ topic, blog, seminar });
  }

  const payload = ensureNewsletterHtml({
    subjectOptions: draft.subjectOptions,
    body: draft.body,
    generatedBy: draft.generatedBy,
    kind,
    topic: topic || null,
    includeSeminar,
    seminar,
    type: 'newsletter_draft',
  });

  const compliance = scanDraft(`${payload.subjectOptions[0]}\n${payload.body}`);
  return { ...payload, compliance };
}

/** @deprecated use draftNewsletter */
async function draftNewsletterFromBlog(blog) {
  return draftNewsletter({ blog, kind: 'newsletter', includeSeminar: true });
}

module.exports = {
  draftNewsletter,
  draftNewsletterFromBlog,
  suggestNewsletterTopics,
  buildGmailNewsletter,
};
