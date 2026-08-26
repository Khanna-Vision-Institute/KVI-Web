const express = require('express');
const store = require('../storage/store');
const { runGrowthOpsCycle, runBlogGeneration, runSeoReportGeneration, runNewsletterGeneration, runNewsletterTopicSuggest, getAnalyticsSummary } = require('../agents/orchestrator');
const { cityOptions } = require('../agents/cities');
const { suggestTopics } = require('../agents/blogResearch');
const { fetchSeminarInfo } = require('../integrations/seminarInfo');
const config = require('../config');
const { createGrowthTask } = require('../integrations/zoho/growthTasks');
const { ensureNewsletterHtml } = require('../agents/newsletterHtml');
const {
  publishApprovedBlog,
  listPublishedBlogs,
  updatePublishedBlog,
  deletePublishedBlog,
} = require('../integrations/blogPublisher');

const router = express.Router();

function hydrateNewsletter(item, persist = true) {
  if (!item || item.type !== 'newsletter_draft' || !item.payload) return item;
  if (item.payload.htmlDocument) return item;
  const payload = ensureNewsletterHtml(item.payload);
  if (persist) {
    const updated = store.updateApprovalPayload(item.id, { htmlDocument: payload.htmlDocument });
    return updated || { ...item, payload };
  }
  return { ...item, payload };
}

router.get('/approvals', (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const items = store.listApprovals({ status }).map((item) => hydrateNewsletter(item, false));
  res.json({ ok: true, items });
});

router.get('/briefs/latest', (req, res) => {
  res.json({ ok: true, brief: store.latestBrief() });
});

router.get('/stats', (req, res) => {
  res.json({ ok: true, stats: store.dashboardStats() });
});

router.post('/run-cycle', async (req, res) => {
  try {
    const result = await runBlogGeneration({ source: 'dashboard_legacy' });
    res.json({ ok: true, item: result.item });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.get('/blog/options', (req, res) => {
  res.json({
    ok: true,
    cities: cityOptions(),
    defaultWords: config.blogDefaultWords,
    capabilities: {
      openai: config.integrationsEnabled.openai,
      searchConsole: config.integrationsEnabled.searchConsole,
      analytics: config.integrationsEnabled.ga4,
    },
  });
});

router.post('/blog/suggest-topics', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await suggestTopics({
      city: body.city,
      useSearchConsole: body.useSearchConsole !== false,
      useAnalytics: body.useAnalytics !== false,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/blog/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runBlogGeneration({
      source: 'dashboard',
      city: body.city,
      topic: body.topic,
      wordCount: body.wordCount,
      useSearchConsole: body.useSearchConsole !== false,
      useAnalytics: body.useAnalytics !== false,
    });
    res.json({ ok: true, item: result.item });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/seo/generate', async (req, res) => {
  try {
    const result = await runSeoReportGeneration({ source: 'dashboard' });
    res.json({ ok: true, item: result.item });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.get('/newsletter/options', async (req, res) => {
  try {
    const blogs = store
      .listApprovals({ status: 'approved' })
      .filter((i) => i.type === 'blog_draft')
      .slice(0, 20)
      .map((i) => ({ id: i.id, title: i.title }));
    let seminar = null;
    try {
      seminar = await fetchSeminarInfo();
    } catch (_) {}
    res.json({
      ok: true,
      kinds: [
        { id: 'newsletter', label: 'Newsletter' },
        { id: 'reminder', label: 'Reminder mail' },
      ],
      sourceBlogs: blogs,
      seminar,
      capabilities: { openai: config.integrationsEnabled.openai },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/newsletter/suggest-topics', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runNewsletterTopicSuggest({ kind: body.kind });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/newsletter/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runNewsletterGeneration({
      source: 'dashboard',
      kind: body.kind,
      topic: body.topic,
      includeSeminar: body.includeSeminar !== false,
      blogId: body.blogId,
    });
    res.json({ ok: true, item: result.item });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.get('/analytics/summary', async (req, res) => {
  try {
    const summary = await getAnalyticsSummary();
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/approvals/:id/approve', async (req, res) => {
  const row = store.updateApprovalStatus(req.params.id, 'approved');
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  // Phase 6 (optional): write a Growth Task back to Zoho. Fire-and-forget — never
  // blocks or fails the approval. No-op unless ZOHO_WRITE_ENABLED=true.
  createGrowthTask(row).catch((err) =>
    console.warn('[growthops] growth task hook error:', err.message)
  );

  let publish = null;
  if (row.type === 'blog_draft') {
    try {
      const requestedAuthor =
        req.body && req.body.author ? String(req.body.author).trim() : undefined;
      publish = await publishApprovedBlog(row, { author: requestedAuthor });
    } catch (err) {
      console.warn('[growthops] blog publish failed:', err.message);
      store.updateApprovalMeta(row.id, {
        publishMeta: {
          status: 'failed',
          endpoint: process.env.BLOG_PUBLISH_ENDPOINT || '',
          publishedAt: new Date().toISOString(),
          error: err.message || String(err),
        },
      });
      publish = { ok: false, error: err.message || String(err) };
    }
  }

  res.json({ ok: true, item: store.getApproval(row.id) || row, publish });
});

router.get('/published-blogs', async (req, res) => {
  try {
    const items = await listPublishedBlogs();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.put('/published-blogs', async (req, res) => {
  try {
    const updated = await updatePublishedBlog(req.body || {});
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.delete('/published-blogs', async (req, res) => {
  try {
    const slug = req.query && req.query.slug ? String(req.query.slug).trim() : '';
    if (!slug) return res.status(400).json({ ok: false, message: 'slug is required' });
    const removed = await deletePublishedBlog(slug);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.post('/approvals/:id/reject', (req, res) => {
  const row = store.updateApprovalStatus(req.params.id, 'rejected');
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, item: row });
});

router.delete('/approvals/:id', (req, res) => {
  const row = store.getApproval(req.params.id);
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  if (row.status !== 'rejected') {
    return res.status(400).json({ ok: false, message: 'Only rejected drafts can be deleted' });
  }
  const ok = store.deleteApproval(req.params.id);
  if (!ok) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, deleted: req.params.id });
});

router.post('/approvals/:id/revision', (req, res) => {
  const row = store.updateApprovalStatus(req.params.id, 'revision_requested', {
    note: req.body && req.body.note ? String(req.body.note) : '',
  });
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, item: row });
});

router.post('/approvals/:id/assign', (req, res) => {
  const assignee = req.body && req.body.assignee ? String(req.body.assignee).trim() : '';
  const row = store.updateApprovalMeta(req.params.id, { assignee, assignedAt: new Date().toISOString() });
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, item: row });
});

router.post('/approvals/:id/content', (req, res) => {
  const body = req.body || {};
  const row = store.getApproval(req.params.id);
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  if (row.type !== 'newsletter_draft') {
    return res.status(400).json({ ok: false, message: 'Content edits only supported for newsletter drafts' });
  }
  const patch = {};
  if (body.htmlDocument != null) patch.htmlDocument = String(body.htmlDocument);
  if (body.body != null) patch.body = String(body.body);
  if (body.subjectOptions != null && Array.isArray(body.subjectOptions)) {
    patch.subjectOptions = body.subjectOptions.map(String);
  }
  const updated = store.updateApprovalPayload(req.params.id, patch);
  res.json({ ok: true, item: updated });
});

router.get('/approvals/:id', (req, res) => {
  const row = hydrateNewsletter(store.getApproval(req.params.id));
  if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, item: row });
});

module.exports = router;
