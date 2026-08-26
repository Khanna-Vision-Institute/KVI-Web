const config = require('../config');
const { collectGrowthSignals } = require('./analyticsAnalyst');
const { draftVisionNewsBlog } = require('./blogDraftAgent');
const { generateSeoReport } = require('./seoReportAgent');
const { gatherBlogResearch } = require('./blogResearch');
const { draftNewsletter, suggestNewsletterTopics } = require('./newsletterDraftAgent');
const store = require('../storage/store');

async function runBlogGeneration(options = {}) {
  const startedAt = new Date().toISOString();
  const research = await gatherBlogResearch(options);
  const blog = await draftVisionNewsBlog(research.signals, {
    city: research.city,
    topic: options.topic,
    wordCount: options.wordCount,
    research: research.used,
  });

  const item = {
    id: store.uid('appr'),
    type: 'blog_draft',
    title: blog.title,
    status: 'pending',
    createdAt: startedAt,
    payload: blog,
    compliance: blog.compliance,
  };
  store.upsertApproval(item);
  store.addJobRun({
    id: store.uid('job'),
    job: 'blog_generate',
    source: options.source || 'dashboard',
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    approvalCount: 1,
  });
  return { item };
}

async function runSeoReportGeneration(options = {}) {
  const startedAt = new Date().toISOString();
  const report = await generateSeoReport();
  const item = {
    id: store.uid('appr'),
    type: 'seo_report',
    title: report.title,
    status: 'pending',
    createdAt: startedAt,
    payload: report,
    compliance: report.compliance,
  };
  store.upsertApproval(item);
  store.addJobRun({
    id: store.uid('job'),
    job: 'seo_report',
    source: options.source || 'dashboard',
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    approvalCount: 1,
  });
  return { item };
}

async function runNewsletterGeneration(options = {}) {
  const startedAt = new Date().toISOString();
  const kind = options.kind === 'reminder' ? 'reminder' : 'newsletter';

  let blog = null;
  if (options.blogId) {
    const row = store.getApproval(options.blogId);
    if (row && row.type === 'blog_draft' && row.payload) {
      blog = { title: row.title, body: row.payload.body, ...row.payload };
    }
  }

  const draft = await draftNewsletter({
    kind,
    topic: options.topic,
    includeSeminar: options.includeSeminar !== false,
    blog,
  });

  const title =
    kind === 'reminder'
      ? `Reminder email — ${(draft.seminar && draft.seminar.dateLine) || 'seminar'}`
      : options.topic
        ? `Newsletter — ${options.topic.slice(0, 60)}`
        : 'Patient newsletter draft';

  const item = {
    id: store.uid('appr'),
    type: 'newsletter_draft',
    title,
    status: 'pending',
    createdAt: startedAt,
    payload: draft,
    compliance: draft.compliance,
  };
  store.upsertApproval(item);
  store.addJobRun({
    id: store.uid('job'),
    job: kind === 'reminder' ? 'newsletter_reminder' : 'newsletter_generate',
    source: options.source || 'dashboard',
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    approvalCount: 1,
  });
  return { item };
}

async function runNewsletterTopicSuggest(options = {}) {
  return suggestNewsletterTopics(options);
}

/** @deprecated Use POST /blog/generate or POST /seo/generate */
async function runGrowthOpsCycle({ source = 'manual' } = {}) {
  return runBlogGeneration({ source });
}

async function getAnalyticsSummary() {
  const signals = await collectGrowthSignals();
  const ga = signals.ga4 || {};
  const sc = signals.searchConsole || {};
  const landing = ga.landingPages || [];
  const status = signals._integrationStatus || {};

  return {
    days: 28,
    totals: {
      sessions: status.ga4 === 'connected' ? (ga.totalSessions ?? 0) : null,
      users: status.ga4 === 'connected' ? (ga.totalUsers ?? 0) : null,
      pageViews: status.ga4 === 'connected' ? (ga.pageViews ?? 0) : null,
      consultIntents: status.ga4 === 'connected' ? (ga.consultIntentsTotal ?? 0) : null,
      organicClicks: status.searchConsole === 'connected' ? (sc.totalClicks ?? 0) : null,
      organicImpressions: status.searchConsole === 'connected' ? (sc.totalImpressions ?? 0) : null,
    },
    topPages: landing.slice(0, 8).map((p) => ({
      path: p.path,
      sessions: p.sessions,
      conversions: p.conversions || 0,
    })),
    topQueries: (sc.topQueries || []).slice(0, 8),
    lowCtrPages: (sc.lowCtrPages || []).slice(0, 5),
    zoho: signals.zoho || {},
    sources: status,
  };
}

module.exports = {
  runBlogGeneration,
  runSeoReportGeneration,
  runNewsletterGeneration,
  runNewsletterTopicSuggest,
  runGrowthOpsCycle,
  getAnalyticsSummary,
};
