const express = require('express');
const {
  createStrapiBlogPost,
  listPublishedStrapiBlogs,
  updateStrapiBlogBySlug,
  deleteStrapiBlogBySlug,
} = require('../services/strapi');

const router = express.Router();

function publishSecret() {
  return String(process.env.GROWTHOPS_BLOG_PUBLISH_SECRET || '').trim();
}

function extractSecret(req) {
  const expected = publishSecret();
  if (!expected) return { ok: false, reason: 'secret_not_configured' };

  const auth = String(req.headers.authorization || '').trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (bearer && bearer[1] === expected) return { ok: true };

  const header = String(req.headers['x-growthops-publish-secret'] || '').trim();
  if (header && header === expected) return { ok: true };

  return { ok: false, reason: 'unauthorized' };
}

function guard(req, res) {
  const auth = extractSecret(req);
  if (!auth.ok) {
    res.status(auth.reason === 'secret_not_configured' ? 503 : 401).json({
      ok: false,
      message: auth.reason,
    });
    return false;
  }
  return true;
}

router.post('/publish-blog', async (req, res) => {
  if (!guard(req, res)) return;

  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const html = body.html != null ? String(body.html) : '';
    const markdown = body.markdown != null ? String(body.markdown) : '';

    if (!title || (!html && !markdown)) {
      return res.status(400).json({
        ok: false,
        message: 'title and html or markdown are required',
      });
    }

    const published = await createStrapiBlogPost({
      title,
      html,
      markdown,
      excerpt: body.excerpt ? String(body.excerpt) : undefined,
      author: body.author ? String(body.author) : 'Dr. Rajesh Khanna',
      publishedAt: body.approvedAt || body.publishedAt || new Date().toISOString(),
      tags: 'SEO,GrowthOps',
    });

    console.log(
      '[growthops-publish] blog created:',
      published.slug,
      body.approvalId ? `(approval ${body.approvalId})` : ''
    );

    res.json({ ok: true, published });
  } catch (err) {
    console.error('[growthops-publish] failed:', err.message);
    res.status(500).json({
      ok: false,
      message: err.response?.data?.error?.message || err.message || String(err),
    });
  }
});

router.get('/published-blogs', async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const rows = await listPublishedStrapiBlogs();
    const items = rows
      .map((b) => ({
        id: b._id,
        entityId: b.strapiEntityId || b.documentId || null,
        source: b.source || 'strapi',
        slug: b.slug,
        title: b.title,
        author: b.author || 'Dr. Rajesh Khanna',
        excerpt: b.excerpt || b.metaDescription || '',
        content: b.content || '',
        publishedAt: b.publishedAt || b.date || null,
        url: `https://khannainstitute.com/${b.slug}`,
      }))
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    res.json({ ok: true, items });
  } catch (err) {
    console.error('[growthops-publish] list failed:', err.message);
    res.status(500).json({ ok: false, message: err.message || String(err) });
  }
});

router.put('/published-blogs', async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const body = req.body || {};
    const slug = String(body.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, message: 'slug is required' });
    const updated = await updateStrapiBlogBySlug({
      slug,
      entityId: body.entityId ? String(body.entityId) : undefined,
      title: body.title != null ? String(body.title) : undefined,
      html: body.html != null ? String(body.html) : undefined,
      markdown: body.markdown != null ? String(body.markdown) : undefined,
      excerpt: body.excerpt != null ? String(body.excerpt) : undefined,
      author: body.author != null ? String(body.author) : undefined,
      tags: body.tags != null ? String(body.tags) : undefined,
      publishedAt: body.publishedAt != null ? String(body.publishedAt) : undefined,
    });
    res.json({ ok: true, updated });
  } catch (err) {
    const strapiMsg = err.response?.data?.error?.message;
    const status = err.response?.status;
    const message = strapiMsg || err.message || String(err);
    console.error('[growthops-publish] update failed:', message, status ? `(HTTP ${status})` : '');
    const code = String(message).startsWith('blog_not_found') ? 404 : 500;
    res.status(code).json({
      ok: false,
      message: status ? `Strapi ${status}: ${message}` : message,
    });
  }
});

router.delete('/published-blogs', async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const slug = String(req.query.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, message: 'slug is required' });
    const entityId = req.query.entityId ? String(req.query.entityId) : undefined;
    const removed = await deleteStrapiBlogBySlug(slug, entityId);
    res.json({ ok: true, removed });
  } catch (err) {
    const strapiMsg = err.response?.data?.error?.message;
    const status = err.response?.status;
    const message = strapiMsg || err.message || String(err);
    console.error('[growthops-publish] delete failed:', message, status ? `(HTTP ${status})` : '');
    const code = String(message).startsWith('blog_not_found') ? 404 : 500;
    res.status(code).json({
      ok: false,
      message: status ? `Strapi ${status}: ${message}` : message,
    });
  }
});

module.exports = router;
