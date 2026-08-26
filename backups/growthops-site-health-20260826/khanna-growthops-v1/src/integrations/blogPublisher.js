const config = require('../config');
const store = require('../storage/store');

function markdownToHtml(md) {
  return String(md || '')
    .split('\n')
    .map((line) => {
      if (/^\s*##\s+/.test(line)) return `<h2>${line.replace(/^\s*##\s+/, '')}</h2>`;
      if (/^\s*#\s+/.test(line)) return `<h1>${line.replace(/^\s*#\s+/, '')}</h1>`;
      if (/^\s*[-*]\s+/.test(line)) return `<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`;
      if (!line.trim()) return '';
      return `<p>${line}</p>`;
    })
    .join('\n')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '');
}

function plainExcerpt(md) {
  return String(md || '')
    .replace(/[#*_>`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.blogPublish.token) headers.Authorization = `Bearer ${config.blogPublish.token}`;
  return headers;
}

function endpointFor(pathname) {
  const base = new URL(config.blogPublish.endpoint);
  base.pathname = pathname;
  base.search = '';
  return base.toString();
}

async function publishApprovedBlog(item, options = {}) {
  if (!item || item.type !== 'blog_draft') return { skipped: true, reason: 'not_blog' };
  if (!config.blogPublish.enabled) return { skipped: true, reason: 'publish_disabled' };
  if (!config.blogPublish.endpoint) return { skipped: true, reason: 'missing_endpoint' };

  const payload = item.payload || {};
  const body = {
    source: 'khanna-growthops-v1',
    approvalId: item.id,
    title: payload.title || item.title,
    markdown: payload.body || '',
    html: markdownToHtml(payload.body || ''),
    excerpt: plainExcerpt(payload.body || ''),
    createdAt: item.createdAt,
    approvedAt: item.updatedAt || new Date().toISOString(),
    author: options.author || payload.author || 'Dr. Rajesh Khanna',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.blogPublish.timeoutMs);
  try {
    const res = await fetch(config.blogPublish.endpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseText = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    const publishMeta = {
      status: ok ? 'published' : 'failed',
      endpoint: config.blogPublish.endpoint,
      publishedAt: new Date().toISOString(),
      responseStatus: res.status,
      responseBody: responseText.slice(0, 800),
    };
    store.updateApprovalMeta(item.id, { publishMeta });
    if (!ok) throw new Error(`publish_http_${res.status}`);
    let published = {};
    try {
      published = JSON.parse(responseText);
    } catch {
      published = { raw: responseText };
    }
    return { ok: true, responseStatus: res.status, published };
  } finally {
    clearTimeout(timer);
  }
}

async function listPublishedBlogs() {
  const res = await fetch(endpointFor('/api/internal/growthops/published-blogs'), {
    method: 'GET',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message || `list_http_${res.status}`);
  return json.items || [];
}

async function updatePublishedBlog(payload) {
  const res = await fetch(endpointFor('/api/internal/growthops/published-blogs'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload || {}),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message || `update_http_${res.status}`);
  return json.updated;
}

async function deletePublishedBlog(slug) {
  const url = new URL(endpointFor('/api/internal/growthops/published-blogs'));
  url.searchParams.set('slug', slug);
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message || `delete_http_${res.status}`);
  return json.removed;
}

module.exports = { publishApprovedBlog, listPublishedBlogs, updatePublishedBlog, deletePublishedBlog };
