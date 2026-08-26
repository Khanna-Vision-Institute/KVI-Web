/* Khanna GrowthOps v1 — dashboard frontend
   Vanilla JS. No build step, no deps. Talks to the existing /api routes only. */

'use strict';

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

const TYPES = {
  daily_brief:        { label: 'Daily brief',  color: 'navy',   icon: 'doc' },
  blog_draft:         { label: 'Blog draft',   color: 'teal',   icon: 'pen' },
  newsletter_draft:   { label: 'Newsletter',   color: 'gold',   icon: 'mail' },
  seo_recommendation: { label: 'SEO',          color: 'green',  icon: 'search' },
  seo_report:         { label: 'SEO report',   color: 'green',  icon: 'search' },
  ad_draft:           { label: 'Ad draft',     color: 'purple', icon: 'megaphone' },
  link_review:        { label: 'Link risk',    color: 'red',    icon: 'link' },
};

// Display order + labels for the integration grid / header pills.
const INTEGRATIONS = [
  { key: 'ga4',           label: 'GA4',            full: 'Google Analytics 4', icon: 'search',
    desc: 'Website traffic, landing-page sessions and on-site conversions used to spot which pages drive consults.' },
  { key: 'searchConsole', label: 'Search Console', full: 'Google Search Console', icon: 'link',
    desc: 'Organic search performance — top queries, impressions, click-through rate and average position.' },
  { key: 'zoho',          label: 'Zoho CRM',       full: 'Zoho CRM', icon: 'mail',
    desc: 'Consult leads created in Zoho over the trailing 7 days, plus lead sources and pipeline status.' },
  { key: 'openai',        label: 'ChatGPT',        full: 'OpenAI — AI drafts', icon: 'pen',
    desc: 'Generates blog, newsletter and ad drafts. Every output is a draft awaiting human approval — nothing publishes automatically.' },
  { key: 'googleAds',     label: 'Google Ads',     full: 'Google Ads', icon: 'megaphone',
    desc: 'Paid search spend, clicks, leads and cost-per-lead. Read-only in v1 — no budgets or campaigns are changed.' },
  { key: 'metaAds',       label: 'Meta Ads',       full: 'Meta Ads', icon: 'megaphone',
    desc: 'Facebook & Instagram spend, leads, booked consults and lead quality. Read-only in v1.' },
];

const STATUS = {
  connected:      { tone: 'ok',    label: 'Live',           short: 'Live' },
  sample:         { tone: 'warn',  label: 'Sample data',    short: 'Sample' },
  error:          { tone: 'bad',   label: 'Needs attention',short: 'Error' },
  not_configured: { tone: 'muted', label: 'Not set up',     short: 'Off' },
};

const ICONS = {
  doc: '<path d="M6 2h7l5 5v15H6z" fill="none"/><path d="M13 2v5h5"/>',
  pen: '<path d="M4 20l4-1L20 7l-3-3L5 16z"/><path d="M14 6l3 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8"/>',
  link: '<path d="M9 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M15 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
};

function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.doc}</svg>`;
}

/* ------------------------------------------------------------------ *
 * Charts — dependency-free SVG + CSS, built from live signals
 * ------------------------------------------------------------------ */

// Shorten a URL path to its most meaningful segment for chart labels.
function shortPath(p) {
  if (!p) return '—';
  const seg = String(p).split('/').filter(Boolean).pop() || p;
  return seg.length > 14 ? seg.slice(0, 13) + '…' : seg;
}

// Circular progress / gauge.
function donut(pct, label, color) {
  const size = 150, stroke = 14, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const off = c * (1 - p / 100);
  const col = color || 'var(--teal)';
  return `<div class="donut" style="--c:${c.toFixed(1)};--off:${off.toFixed(1)}">
    <svg viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="var(--chart-track)" stroke-width="${stroke}"/>
      <circle class="donut-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${col}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="donut-center">
      <div class="donut-pct">${Math.round(p)}%</div>
      <div class="donut-cap">${escapeHtml(label || '')}</div>
    </div>
  </div>`;
}

// Vertical bar chart. data: [{label, value, short?}]
function vbars(data, accent, fmt) {
  const f = fmt || fmtNum;
  const max = data.reduce((m, d) => Math.max(m, d.value || 0), 0) || 1;
  return `<div class="vbars accent-${accent || 'teal'}">${data.map((d, i) => {
    const h = Math.max(3, Math.round((d.value || 0) / max * 100));
    return `<div class="vbar-col" title="${escapeHtml(d.label)}: ${f(d.value)}">
      <div class="vbar-val">${f(d.value)}</div>
      <div class="vbar-track">
        <div class="vbar-fill" style="height:${h}%;animation-delay:${i * 80}ms"></div>
      </div>
      <div class="vbar-label">${escapeHtml(d.short || d.label)}</div>
    </div>`;
  }).join('')}</div>`;
}

// Horizontal bar chart. data: [{label, value}]
function hbars(data, accent, fmt) {
  const f = fmt || fmtNum;
  const max = data.reduce((m, d) => Math.max(m, d.value || 0), 0) || 1;
  return `<div class="hbars accent-${accent || 'teal'}">${data.map((d, i) => {
    const w = Math.max(3, Math.round((d.value || 0) / max * 100));
    return `<div class="hbar-row">
      <span class="hbar-label" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</span>
      <span class="hbar-num">${f(d.value)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${w}%;animation-delay:${i * 90}ms"></span></span>
    </div>`;
  }).join('')}</div>`;
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  channel: 'blog',
  blogSubview: 'drafts',
  health: null,
  stats: null,
  items: [],
  publishedBlogs: [],
  analyticsSummary: null,
  publishedEditor: {
    open: false,
    slug: '',
    title: '',
    author: '',
    content: '',
    publishedAt: '',
    excerpt: '',
  },
  brief: null,
  approvalsTab: 'pending',
  typeFilter: 'all',
  loaded: false,
  generating: false,
};

function publishedBlogSortTime(item) {
  const at = item && (item.publishedAt || item.date);
  if (at) {
    const t = new Date(at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const slug = String((item && item.slug) || '');
  const m = slug.match(/^(\d{4})\/(\d{2})\//);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, 1);
  return 0;
}

function sortPublishedBlogsNewestFirst(items) {
  return [...(items || [])].sort(
    (a, b) => publishedBlogSortTime(b) - publishedBlogSortTime(a)
  );
}

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

async function api(path, opts) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function $(sel, root) { return (root || document).querySelector(sel); }
function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US');
}

function fmtPct(frac, digits) {
  if (frac == null || isNaN(frac)) return '—';
  return (frac * 100).toFixed(digits == null ? 1 : digits) + '%';
}

function fmtPos(p) {
  if (p == null || isNaN(p)) return '—';
  return Number(p).toFixed(1);
}

function fmtMoney(n, cents) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function toast(msg, tone) {
  const t = document.createElement('div');
  t.className = 'toast' + (tone ? ' ' + tone : '');
  t.textContent = msg;
  el('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 3000);
}

function riskClass(level) {
  return level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low';
}

/* A live/sample summary used by header badge + brief page. */
function dataMode() {
  const ints = (state.health && state.health.integrations) || {};
  const anyLive = Object.values(ints).includes('connected') && !state.health.sampleData;
  return anyLive ? 'live' : 'sample';
}

function fmtLiveMetric(value, connected) {
  if (!connected || value == null) return '—';
  return fmtNum(value);
}

/** Map /analytics/summary into the shape used by analytics cards & integration drawer. */
function analyticsSignals() {
  const s = state.analyticsSummary;
  if (!s) return null;
  const t = s.totals || {};
  const sources = s.sources || {};
  return {
    ga4: {
      landingPages: (s.topPages || []).map((p) => ({
        path: p.path,
        sessions: p.sessions,
        conversions: p.conversions || 0,
      })),
      totalSessions: t.sessions,
      totalUsers: t.users,
      pageViews: t.pageViews,
      consultIntentsTotal: t.consultIntents,
      connected: sources.ga4 === 'connected',
    },
    searchConsole: {
      topQueries: s.topQueries || [],
      lowCtrPages: s.lowCtrPages || [],
      totalClicks: t.organicClicks,
      totalImpressions: t.organicImpressions,
      connected: sources.searchConsole === 'connected',
    },
    zoho: { ...(s.zoho || {}), connected: sources.zoho === 'connected' },
    ads: {},
  };
}

function signalData() {
  return analyticsSignals() || {};
}

/** Count leads in a Zoho Lead_Status bucket (e.g. "New Leads", "Consult Done"). */
function zohoStatusCount(z, status) {
  const row = (z.leadsByStatus || []).find((r) => r.status === status);
  return row ? row.count : null;
}

/* ------------------------------------------------------------------ *
 * Minimal, safe markdown renderer (brief body)
 * ------------------------------------------------------------------ */

function renderMarkdown(md) {
  if (!md) return '<p class="empty-line">No brief yet. Run the agent cycle to generate one.</p>';
  const lines = escapeHtml(md).split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (let raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>');
    if (/^### /.test(raw)) { closeList(); html += `<h3>${line.slice(4)}</h3>`; }
    else if (/^## /.test(raw)) { closeList(); html += `<h2>${line.slice(3)}</h2>`; }
    else if (/^# /.test(raw)) { closeList(); html += `<h1>${line.slice(2)}</h1>`; }
    else if (/^\s*[-*] /.test(raw)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.replace(/^\s*[-*] /, '')}</li>`;
    } else if (/^\s*\d+\.\s/.test(raw)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.replace(/^\s*\d+\.\s/, '')}</li>`;
    } else if (/^---+\s*$/.test(raw)) { closeList(); html += '<hr>'; }
    else if (raw.trim() === '') { closeList(); }
    else { closeList(); html += `<p>${line}</p>`; }
  }
  closeList();
  return html;
}

/* ------------------------------------------------------------------ *
 * KPI row (shared by Overview + Daily Brief)
 * ------------------------------------------------------------------ */

function kpiCards() {
  const sig = signalData();
  const stats = state.stats || {};
  const ints = (state.health && state.health.integrations) || {};

  const ga = sig.ga4 || {};
  const zoho = sig.zoho || {};
  const sc = sig.searchConsole || {};
  const topQuery = (sc.topQueries && sc.topQueries[0]) || null;

  const cards = [
    { icon: 'search', accent: 'teal', label: 'Sessions · 28d',
      value: fmtLiveMetric(ga.totalSessions, ga.connected), sub: 'GA4 · property total' },
    { icon: 'doc', accent: 'navy', label: 'Consult events · 28d',
      value: fmtLiveMetric(ga.consultIntentsTotal, ga.connected), sub: 'GA4 · consult booking event' },
    { icon: 'mail', accent: 'gold', label: 'Leads · 7d',
      value: fmtLiveMetric(zoho.newLeads7d, zoho.connected), sub: 'Zoho CRM · consult bookings' },
    { icon: 'pen', accent: 'purple', label: 'Pending approvals',
      value: fmtNum(stats.pending || 0), sub: 'Awaiting your review' },
    { icon: 'link', accent: 'navy', label: 'Organic clicks · 28d',
      value: fmtLiveMetric(sc.totalClicks, sc.connected),
      sub: topQuery ? `Top query: ${escapeHtml(topQuery.query)}` : 'Search Console · site total' },
  ];

  return `<div class="kpi-row">${cards.map((c) => `
    <div class="kpi accent-${c.accent}">
      <div class="kpi-top">
        <span class="kpi-icon">${svg(c.icon)}</span>
        ${c.chip ? `<span class="chip">${c.chip}</span>` : ''}
      </div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-sub" title="${c.sub}">${c.sub}</div>
    </div>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ *
 * Integration pills (header) + grid (overview)
 * ------------------------------------------------------------------ */

function renderHeaderPills() {
  const ints = (state.health && state.health.integrations) || {};
  const host = el('intPills');
  if (!host) return;
  // Show the four primary data sources in the header to keep it tidy.
  const primary = ['ga4', 'zoho', 'searchConsole', 'openai'];
  host.innerHTML = primary.map((key) => {
    const meta = INTEGRATIONS.find((i) => i.key === key);
    const st = STATUS[ints[key]] || STATUS.not_configured;
    if (!meta) return '';
    return `<span class="pill" data-int="${key}" role="button" tabindex="0"
      title="${meta.full}: ${st.label} — click to view">
      <span class="dot ${st.tone}"></span>${meta.label} · ${st.short}</span>`;
  }).join('');

  host.querySelectorAll('[data-int]').forEach((p) => {
    p.addEventListener('click', () => openIntegrationDrawer(p.dataset.int));
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIntegrationDrawer(p.dataset.int); }
    });
  });

  // Header data-mode badge.
  const badge = el('dataBadge');
  if (badge) {
    const mode = dataMode();
    badge.textContent = mode === 'live' ? 'Live data' : 'Sample data';
    badge.className = 'badge ' + (mode === 'live' ? 'live' : 'sample');
  }
}

function integrationsPanel() {
  const ints = (state.health && state.health.integrations) || {};
  return `<section class="card span-all">
    <div class="card-head">
      <h2>Integrations</h2>
      <span class="muted-note">Click any source to view its details &amp; data</span>
    </div>
    <div class="int-grid">
      ${INTEGRATIONS.map((i) => {
        const st = STATUS[ints[i.key]] || STATUS.not_configured;
        return `<div class="int-cell" data-int="${i.key}" role="button" tabindex="0"
            aria-label="View ${i.full} details">
          <div class="int-row"><span class="dot ${st.tone}"></span>
            <span class="int-name">${i.label}</span></div>
          <div class="int-status tone-${st.tone}">${st.label}</div>
          <div class="int-full" title="${i.full}">${i.full}</div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ *
 * Analytics cards
 * ------------------------------------------------------------------ */

function ga4Card() {
  const sig = signalData();
  const ints = (state.health && state.health.integrations) || {};
  const pages = (sig.ga4 && sig.ga4.landingPages) || [];
  let body;
  if (!pages.length) {
    const hint = ints.ga4 === 'connected'
      ? 'No landing-page sessions in the last 28 days.'
      : 'Add GA4_PROPERTY_ID to .env and restart GrowthOps.';
    body = emptyState('No GA4 data yet', hint);
  } else {
    const maxS = pages.reduce((m, p) => Math.max(m, p.sessions || 0), 0) || 1;
    body = `<table class="data-table">
      <thead><tr><th>Landing page</th><th class="num">Sessions · 28d</th></tr></thead>
      <tbody>${pages.slice(0, 8).map((p) => `
        <tr>
          <td><span class="path" title="${escapeHtml(p.path)}">${escapeHtml(p.path)}</span>
            <span class="bar"><span style="width:${Math.round((p.sessions || 0) / maxS * 100)}%"></span></span>
          </td>
          <td class="num strong">${fmtNum(p.sessions)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  }
  const ga = sig.ga4 || {};
  const foot = ga.connected && ga.totalSessions != null
    ? `GA4 property total: ${fmtNum(ga.totalSessions)} sessions · 28d`
    : 'GA4 · top landing pages';
  return analyticsCard('search', 'Website traffic', foot, body);
}

function zohoCard() {
  const sig = signalData();
  const z = sig.zoho || {};
  const connected = z.connected;
  const leads = z.newLeads7d ?? 0;
  const sources = z.leadSources || (z.topSources || []).map((s) => ({ source: s, count: 0 }));

  if (!connected) {
    return analyticsCard(
      'mail',
      'Consult leads',
      'Zoho CRM',
      emptyState('Zoho CRM not connected', 'Add Zoho OAuth credentials on the server to load live lead data.')
    );
  }

  let inner;
  if (!leads && !sources.length) {
    inner = emptyState('No leads in the last 7 days', 'Consult bookings will appear here once Zoho records activity.');
  } else {
    inner = `
      <div class="dual-stat">
        <div><div class="ds-value">${fmtNum(leads)}</div><div class="ds-label">Leads · 7d</div></div>
      </div>
      <div class="conv-note">Each Zoho lead is a consult booking inquiry — see status breakdown →</div>
      ${sources.length ? `
        <div class="sub-head">Top lead sources</div>
        <div class="source-list">${sources.map((s) => {
          const max = sources[0].count || 1;
          const w = Math.max(8, Math.round((s.count / max) * 100));
          return `
          <div class="source-row">
            <span class="source-name" title="${escapeHtml(s.source)}">${escapeHtml(s.source)}</span>
            <span class="bar"><span style="width:${w}%"></span></span>
            <span class="qs"><b>${fmtNum(s.count)}</b></span>
          </div>`;
        }).join('')}</div>` : ''}
    `;
  }
  return analyticsCard('mail', 'Consult leads', 'Zoho Leads module · last 7 days', inner);
}

function zohoStatusCard() {
  const z = signalData().zoho || {};
  const rows = z.leadsByStatus || [];
  if (!z.connected) {
    return analyticsCard(
      'doc',
      'Leads by status',
      'Lead_Status · 7d',
      emptyState('Zoho CRM not connected', 'Status breakdown appears when Zoho is linked.')
    );
  }
  if (!rows.length) {
    return analyticsCard(
      'doc',
      'Leads by status',
      'Lead_Status · 7d',
      emptyState('No leads in the last 7 days', 'Lead status counts will appear as new records are created.')
    );
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  const body = `
    <div class="source-list">${rows.map((r) => {
      const w = Math.max(8, Math.round((r.count / max) * 100));
      return `
      <div class="source-row">
        <span class="source-name" title="${escapeHtml(r.status)}">${escapeHtml(r.status)}</span>
        <span class="bar"><span style="width:${w}%"></span></span>
        <span class="qs"><b>${fmtNum(r.count)}</b></span>
      </div>`;
    }).join('')}</div>`;
  return analyticsCard('doc', 'Leads by status', 'Lead_Status · last 7 days', body);
}

function searchCard() {
  const sig = signalData();
  const ints = (state.health && state.health.integrations) || {};
  const sc = sig.searchConsole || {};
  const queries = sc.topQueries || [];
  const low = (sc.lowCtrPages && sc.lowCtrPages[0]) || null;
  const sample = ints.searchConsole === 'sample';

  let inner;
  if (!queries.length) {
    const hint = ints.searchConsole === 'connected'
      ? 'No organic queries in the last 28 days.'
      : 'Connect Search Console (GSC_SITE_URL + Google OAuth) in .env.';
    inner = emptyState('No Search Console data yet', hint);
  } else {
    inner = `
      <div class="query-list">${queries.slice(0, 4).map((q) => `
        <div class="query-row">
          <span class="query-name" title="${escapeHtml(q.query)}">${escapeHtml(q.query)}</span>
          <span class="query-stats">
            <span class="qs"><b>${fmtNum(q.clicks)}</b> clicks</span>
            <span class="qs">pos <b>${fmtPos(q.position)}</b></span>
            <span class="qs"><b>${fmtPct(q.ctr)}</b> CTR</span>
          </span>
        </div>`).join('')}</div>
      ${low ? `
        <div class="callout">
          <div class="callout-label">Opportunity · low CTR page</div>
          <div class="callout-path" title="${escapeHtml(low.page)}">${escapeHtml(low.page)}</div>
          <div class="callout-meta">${fmtPct(low.ctr)} CTR on ${fmtNum(low.impressions)} impressions — test clearer title &amp; meta.</div>
        </div>` : ''}
    `;
  }
  const chip = sample ? 'Sample until Search Console access' : null;
  const foot = sc.connected && sc.totalClicks != null
    ? `Site total: ${fmtNum(sc.totalClicks)} clicks · ${fmtNum(sc.totalImpressions || 0)} impressions · 28d`
    : 'Search Console · top queries';
  return analyticsCard('link', 'Organic search', foot, inner, chip);
}

function paidCard() {
  const sig = signalData();
  const ads = sig.ads || {};
  const g = ads.google;
  const m = ads.meta;

  let inner;
  if (!g && !m) {
    inner = emptyState('Paid media not connected', 'Google Ads and Meta are read-only stubs in v1 — no spend is tracked yet.');
  } else {
    const rows = [];
    if (g) rows.push(`
      <div class="paid-row">
        <div class="paid-head"><span class="dot ok"></span>Google Ads</div>
        <div class="paid-stats">
          <span><b>${fmtMoney(g.spend)}</b> spend</span>
          <span><b>${fmtNum(g.clicks)}</b> clicks</span>
          <span><b>${fmtNum(g.leads)}</b> leads</span>
          <span><b>${fmtMoney(g.cpl, true)}</b> CPL</span>
        </div>
      </div>`);
    if (m) rows.push(`
      <div class="paid-row">
        <div class="paid-head"><span class="dot ok"></span>Meta</div>
        <div class="paid-stats">
          <span><b>${fmtMoney(m.spend)}</b> spend</span>
          <span><b>${fmtNum(m.leads)}</b> leads</span>
          <span><b>${fmtNum(m.booked)}</b> booked</span>
          <span class="quality">quality: ${escapeHtml(m.quality || '—')}</span>
        </div>
      </div>`);
    inner = rows.join('');
  }
  return analyticsCard('megaphone', 'Paid media', 'Google Ads &amp; Meta', inner);
}

function analyticsCard(icon, title, sub, body, chip) {
  return `<section class="card">
    <div class="card-head">
      <div class="card-title">
        <span class="card-icon">${svg(icon)}</span>
        <div><h2>${title}</h2><span class="muted-note">${sub}</span></div>
      </div>
      ${chip ? `<span class="chip">${chip}</span>` : ''}
    </div>
    <div class="card-body">${body}</div>
  </section>`;
}

function emptyState(title, sub) {
  return `<div class="empty">
    <div class="empty-title">${escapeHtml(title)}</div>
    <div class="empty-sub">${escapeHtml(sub)}</div>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Pipeline + help
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Performance snapshot — the graphs row
 * ------------------------------------------------------------------ */

function snapshotCard() {
  const sig = signalData();
  const pages = (sig.ga4 && sig.ga4.landingPages) || [];
  const z = sig.zoho || {};
  const queries = (sig.searchConsole && sig.searchConsole.topQueries) || [];

  const leads = z.newLeads7d || 0;

  // Nothing to chart yet → let the cards below carry empty states.
  if (!pages.length && !queries.length && !leads) return '';

  const sessionPanel = pages.length ? `
    <div class="chart-panel">
      <div class="chart-title">Top landing pages · sessions</div>
      ${vbars(pages.slice(0, 5).map((p) => ({
        label: p.path, short: shortPath(p.path), value: p.sessions || 0,
      })), 'teal')}
      <div class="chart-sub">GA4 · sessions on the highest-traffic pages</div>
    </div>` : '';

  const convPanel = leads ? `
    <div class="chart-panel">
      <div class="chart-title">Consult leads · 7d</div>
      ${hbars((z.leadsByStatus || []).map((r) => ({ label: r.status, value: r.count })), 'gold')}
      <div class="chart-sub"><b>${fmtNum(leads)}</b> Zoho leads created · each is a consult booking</div>
    </div>` : '';

  const queryPanel = queries.length ? `
    <div class="chart-panel">
      <div class="chart-title">Organic clicks by query</div>
      ${hbars(queries.slice(0, 4).map((q) => ({ label: q.query, value: q.clicks || 0 })), 'purple')}
      <div class="chart-sub">Search Console · clicks from top organic queries</div>
    </div>` : '';

  return `<section class="card span-all">
    <div class="card-head">
      <div class="card-title">
        <span class="card-icon">${svg('search')}</span>
        <div><h2>Performance snapshot</h2><span class="muted-note">Live view across search, site &amp; CRM signals</span></div>
      </div>
    </div>
    <div class="card-body">
      <div class="chart-grid">${sessionPanel}${convPanel}${queryPanel}</div>
    </div>
  </section>`;
}

function pipelineCard() {
  const steps = ['Analytics', 'SEO scout', 'Draft agents', 'Compliance', 'Approval queue'];
  return `<section class="card span-all">
    <div class="card-head"><h2>Agent pipeline</h2>
      <span class="muted-note">Last run ${timeAgo(state.stats && state.stats.lastJobRun && state.stats.lastJobRun.finishedAt)}</span>
    </div>
    <div class="card-body">
      <div class="stepper">${steps.map((s, i) => `
        <div class="step done">
          <span class="step-num">${i + 1}</span>
          <span class="step-label">${s}</span>
        </div>${i < steps.length - 1 ? '<span class="step-line"></span>' : ''}`).join('')}
      </div>
      <p class="muted-note pipeline-foot">v1 never publishes, emails, or launches ads automatically. Every output is a draft awaiting human approval.</p>
    </div>
  </section>`;
}

function helpCard() {
  return `<section class="card span-all">
    <details class="help">
      <summary>
        <span>How to use this dashboard</span>
        <span class="chev" aria-hidden="true">▾</span>
      </summary>
      <ol class="help-list">
        <li><strong>Generate blog</strong> or <strong>Generate SEO report</strong> — each runs on its own using live Search Console &amp; Analytics.</li>
        <li><strong>✦ Suggest</strong> — OpenAI topic ideas from your GSC/GA data (blog modal).</li>
        <li><strong>View draft</strong> — read the full content before deciding.</li>
        <li><strong>Approve</strong> — blog drafts publish to khannainstitute.com/blog/latest/.</li>
        <li><strong>Request revision</strong> — send back to marketing with a note.</li>
        <li><strong>Assign</strong> — tag for SEO or Marketing review.</li>
        <li><strong>Reject</strong> — do not use this recommendation.</li>
      </ol>
    </details>
  </section>`;
}

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

function renderOverview() {
  if (!state.loaded) return skeletonOverview();
  return `
    ${cyclingBanner()}
    ${kpiCards()}
    <div class="card-grid">
      ${snapshotCard()}
      ${integrationsPanel()}
      ${ga4Card()}
      ${zohoCard()}
      ${searchCard()}
      ${paidCard()}
      ${pipelineCard()}
      ${helpCard()}
    </div>`;
}

function renderBriefView() {
  if (!state.loaded) return skeletonBrief();
  const brief = state.brief;
  const meta = brief
    ? `Generated ${fmtDateTime(brief.createdAt)} · ${dataMode() === 'live' ? 'Live data' : 'Sample data'}`
    : 'No brief generated yet';
  return `
    ${kpiCards()}
    <section class="card span-all brief-card">
      <div class="card-head">
        <div class="card-title">
          <span class="card-icon">${svg('doc')}</span>
          <div><h2>Daily Growth Brief</h2><span class="muted-note">${meta}</span></div>
        </div>
        <button class="btn ghost sm" id="printBriefBtn">Print</button>
      </div>
      <div class="card-body">
        <article class="article">${renderMarkdown(brief && brief.markdown)}</article>
      </div>
    </section>`;
}

function renderApprovals() {
  if (!state.loaded) return skeletonApprovals();

  const counts = { pending: 0, approved: 0, revision_requested: 0, rejected: 0 };
  state.items.forEach((i) => { if (counts[i.status] != null) counts[i.status]++; });

  const tabs = [
    ['pending', 'Pending'], ['approved', 'Approved'],
    ['revision_requested', 'Revisions'], ['rejected', 'Rejected'],
  ];

  let items = state.items.filter((i) => i.status === state.approvalsTab);
  if (state.typeFilter !== 'all') items = items.filter((i) => i.type === state.typeFilter);

  // Type filter chips derive from items currently in this status tab.
  const typesPresent = Array.from(new Set(
    state.items.filter((i) => i.status === state.approvalsTab).map((i) => i.type)
  ));

  return `
    <section class="card span-all approvals-card">
      <div class="card-head">
        <div class="seg">${tabs.map(([k, label]) => `
          <button class="seg-btn ${state.approvalsTab === k ? 'active' : ''}" data-tab="${k}">
            ${label}<span class="count">${counts[k]}</span>
          </button>`).join('')}
        </div>
      </div>
      ${typesPresent.length > 1 ? `
        <div class="filter-chips">
          <button class="fchip ${state.typeFilter === 'all' ? 'active' : ''}" data-type="all">All</button>
          ${typesPresent.map((t) => `
            <button class="fchip ${state.typeFilter === t ? 'active' : ''}" data-type="${t}">
              ${TYPES[t] ? TYPES[t].label : t}</button>`).join('')}
        </div>` : ''}
      <div class="card-body">
        ${items.length ? `<div class="approval-list">${items.map(approvalCard).join('')}</div>`
          : emptyState(`No ${state.approvalsTab.replace('_', ' ')} items`,
              'Run the agent cycle to generate new drafts.')}
      </div>
    </section>`;
}

function renderPublished() {
  if (!state.loaded) return skeletonApprovals();
  const items = sortPublishedBlogsNewestFirst(state.publishedBlogs);
  return `
    <section class="card span-all approvals-card">
      <div class="card-head">
        <h2>Published blogs</h2>
        <span class="muted-note">${items.length} item(s) from khannainstitute.com/blog/latest/</span>
      </div>
      <div class="card-body">
        ${items.length ? `<div class="approval-list">${items.map((item) => `
          <article class="approval type-teal" data-pub-slug="${escapeHtml(item.slug)}">
            <div class="approval-icon">${svg('pen')}</div>
            <div class="approval-main">
              <div class="approval-top">
                <span class="type-tag">Published</span>
                <span class="assignee">${escapeHtml(item.author || 'Dr. Rajesh Khanna')}</span>
              </div>
              <div class="approval-title">${escapeHtml(item.title || item.slug)}</div>
              <div class="approval-preview">${escapeHtml(item.excerpt || '')}</div>
              <div class="approval-actions">
                <button class="act view" data-action="open-published">Open</button>
                <button class="act approve" data-action="edit-published">Edit</button>
                <button class="act reject" data-action="delete-published">Remove</button>
              </div>
            </div>
          </article>
        `).join('')}</div>` : emptyState('No published blogs yet', 'Approve a blog draft to publish it here.')}
      </div>
    </section>`;
}

function openPublishedEditor(item) {
  state.publishedEditor = {
    open: true,
    slug: item.slug,
    entityId: item.entityId || null,
    title: item.title || '',
    author: item.author || 'Dr. Rajesh Khanna',
    content: item.content || '',
    publishedAt: item.publishedAt || new Date().toISOString(),
    excerpt: item.excerpt || '',
  };
  el('pubEditTitle').value = state.publishedEditor.title;
  el('pubEditAuthor').value = state.publishedEditor.author;
  el('pubEditContent').value = state.publishedEditor.content;
  el('pubEditorScrim').classList.add('open');
  el('pubEditor').classList.add('open');
}

function closePublishedEditor() {
  state.publishedEditor.open = false;
  el('pubEditorScrim').classList.remove('open');
  el('pubEditor').classList.remove('open');
}

async function savePublishedEditor() {
  const payload = {
    slug: state.publishedEditor.slug,
    entityId: state.publishedEditor.entityId || undefined,
    title: el('pubEditTitle').value.trim(),
    author: el('pubEditAuthor').value.trim() || 'Dr. Rajesh Khanna',
    html: el('pubEditContent').value,
    excerpt: state.publishedEditor.excerpt,
    publishedAt: state.publishedEditor.publishedAt,
  };
  try {
    await api('/published-blogs', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    closePublishedEditor();
    toast('Published blog updated', 'ok');
    await refresh();
  } catch (err) {
    toast('Update failed: ' + err.message, 'bad');
  }
}

const WORKFLOW_TYPES = new Set(['blog_draft', 'newsletter_draft', 'seo_report']);

const APPROVAL_TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['revision_requested', 'Revisions'],
  ['rejected', 'Rejected'],
];

function downloadNewsletterHtml(item) {
  const doc = item && item.payload && item.payload.htmlDocument;
  if (!doc) {
    toast('No HTML to download — open the draft or regenerate', 'bad');
    return;
  }
  const slug = (item.title || 'email').replace(/[^\w]+/g, '-').slice(0, 40).toLowerCase();
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `khanna-email-${slug || 'draft'}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('HTML downloaded (inline CSS — ready for Zoho / Gmail)', 'ok');
}

function approvalActionButtons(item) {
  const st = item.status;
  const workflow = WORKFLOW_TYPES.has(item.type);
  let html = '<button class="act view" data-action="view">View draft</button>';

  if (item.type === 'newsletter_draft' && item.payload && item.payload.htmlDocument) {
    html += '<button class="act view" data-action="download-html">Download HTML</button>';
  }

  if (!workflow) {
    if (st !== 'pending') html += `<span class="status-tag">${escapeHtml(st.replace('_', ' '))}</span>`;
    return html;
  }

  if (st === 'pending' || st === 'revision_requested') {
    html += `
      <button class="act approve" data-action="approve">Approve</button>
      <button class="act reject" data-action="reject">Reject</button>
      <button class="act revision" data-action="revision">Revise</button>`;
    if (item.type === 'blog_draft' || item.type === 'newsletter_draft') {
      html += `
        <div class="more">
          <button class="act more-btn" data-action="more" aria-label="More actions">⋯ More</button>
          <div class="more-menu" hidden>
            <button data-action="revision">Request revision</button>
            <button data-action="assign-seo">Assign · SEO</button>
            <button data-action="assign-marketing">Assign · Marketing</button>
          </div>
        </div>`;
    }
  } else if (st === 'approved') {
    html += '<button class="act reject" data-action="reject">Reject</button>';
  } else if (st === 'rejected') {
    html += '<button class="act reject" data-action="delete">Delete</button>';
  } else {
    html += `<span class="status-tag">${escapeHtml(st.replace('_', ' '))}</span>`;
  }
  return html;
}

function approvalTabButtons(counts) {
  return APPROVAL_TABS.map(([k, label]) => `
    <button class="seg-btn ${state.approvalsTab === k ? 'active' : ''}" data-tab="${k}">
      ${label}<span class="count">${counts[k] || 0}</span>
    </button>`).join('');
}

function countByStatus(items) {
  const counts = { pending: 0, approved: 0, revision_requested: 0, rejected: 0 };
  items.forEach((i) => { if (counts[i.status] != null) counts[i.status]++; });
  return counts;
}

function approvalCard(item) {
  const t = TYPES[item.type] || { label: item.type, color: 'navy', icon: 'doc' };
  const p = item.payload || {};
  const risk = item.compliance && item.compliance.riskLevel;
  return `
    <article class="approval type-${t.color}" data-id="${item.id}">
      <div class="approval-icon">${svg(t.icon)}</div>
      <div class="approval-main">
        <div class="approval-top">
          <span class="type-tag">${t.label}${p.kind === 'reminder' ? ' · Reminder' : p.kind === 'newsletter' ? ' · Newsletter' : ''}</span>
          <span class="risk ${riskClass(risk)}">${risk || 'low'} risk</span>
          ${item.assignee ? `<span class="assignee">${escapeHtml(item.assignee)}</span>` : ''}
        </div>
        <div class="approval-title">${escapeHtml(item.title)}</div>
        <div class="approval-preview">${escapeHtml(previewText(item))}</div>
        ${item.revisionNote ? `<div class="revision-note">Revision note: ${escapeHtml(item.revisionNote)}</div>` : ''}
        <div class="approval-actions">
          ${approvalActionButtons(item)}
        </div>
      </div>
    </article>`;
}

/* ------------------------------------------------------------------ *
 * Skeletons
 * ------------------------------------------------------------------ */

function skBlock(cls) { return `<div class="sk ${cls || ''}"></div>`; }

function skeletonOverview() {
  const note = state.cycling
    ? `<p class="loading-note">Running agents — pulling live analytics and generating AI drafts. This can take 30–60 seconds…</p>`
    : `<p class="loading-note">Loading dashboard…</p>`;
  return `
    ${note}
    <div class="kpi-row">${Array.from({ length: 6 }, () => `
      <div class="kpi"><div class="sk sk-icon"></div><div class="sk sk-num"></div><div class="sk sk-line"></div></div>`).join('')}</div>
    <div class="card-grid">
      ${Array.from({ length: 4 }, () => `<section class="card"><div class="card-body">
        ${skBlock('sk-line w60')}${skBlock('sk-line')}${skBlock('sk-line w80')}${skBlock('sk-line w40')}
      </div></section>`).join('')}
    </div>`;
}

function cyclingBanner() {
  if (!state.cycling) return '';
  return `<div class="cycle-banner">Running agents — fetching GA4, Search Console, Zoho, and writing ChatGPT drafts…</div>`;
}

function skeletonApprovals() {
  return `<section class="card span-all"><div class="card-body">
    ${Array.from({ length: 4 }, () => `<div class="sk sk-card"></div>`).join('')}
  </div></section>`;
}

function skeletonBrief() {
  return `<section class="card span-all"><div class="card-body">
    ${skBlock('sk-line w40')}${skBlock('sk-line')}${skBlock('sk-line')}${skBlock('sk-line w80')}
    ${skBlock('sk-line w60')}${skBlock('sk-line')}${skBlock('sk-line w40')}
  </div></section>`;
}

/* ------------------------------------------------------------------ *
 * Preview / detail text for approvals
 * ------------------------------------------------------------------ */

function previewText(item) {
  const p = item.payload || {};
  if ((item.type === 'blog_draft' || item.type === 'newsletter_draft') && p.body) {
    return p.body.replace(/[#*]/g, '').trim().slice(0, 180) + '…';
  }
  if (item.type === 'seo_recommendation') return `${p.page || ''} — ${p.rationale || ''}`;
  if (item.type === 'seo_report' && (p.lede || p.body)) return String(p.lede || p.body).slice(0, 180) + '…';
  if (item.type === 'ad_draft' && p.headlines) return p.headlines.join(' · ');
  if (item.type === 'link_review' && p.candidate) {
    return `${p.candidate.domain} → ${p.verdict} (score ${p.score})`;
  }
  if (item.type === 'daily_brief' && p.preview) return p.preview.replace(/[#*]/g, '').trim();
  return item.title;
}

function newsletterDetailHtml(item) {
  const p = item.payload || {};
  const subs = (p.subjectOptions || [])
    .map((s, i) => `<li><strong>Option ${i + 1}:</strong> ${escapeHtml(s)}</li>`)
    .join('');
  const hasHtml = Boolean(p.htmlDocument);
  return `
    <div class="newsletter-tools">
      <div class="seg newsletter-tabs">
        <button type="button" class="seg-btn active" data-nl-tab="preview">Email preview</button>
        <button type="button" class="seg-btn" data-nl-tab="edit">Edit HTML</button>
        <button type="button" class="seg-btn" data-nl-tab="plain">Plain text</button>
      </div>
      <div class="newsletter-actions">
        <button type="button" class="btn ghost sm" data-nl-action="open" ${hasHtml ? '' : 'disabled'}>Open preview</button>
        <button type="button" class="btn ghost sm" data-nl-action="download" ${hasHtml ? '' : 'disabled'}>Download .html</button>
        <button type="button" class="btn ghost sm" data-nl-action="copy" ${hasHtml ? '' : 'disabled'}>Copy HTML</button>
        <button type="button" class="btn sm" data-nl-action="save" ${hasHtml ? '' : 'disabled'}>Save edits</button>
      </div>
    </div>
    ${hasHtml ? '' : `<div class="empty" style="margin-bottom:12px"><div class="empty-title">No HTML yet</div><div class="empty-sub">Regenerate this email from the Email tab.</div></div>`}
    ${p.kind === 'reminder' ? '<p class="muted-note">Reminder mail · includes seminar RSVP block when enabled</p>' : ''}
    ${p.seminar ? `<p class="muted-note">Seminar: ${escapeHtml(p.seminar.dateLine || '')} · ${escapeHtml(p.seminar.timeLine || '')}</p>` : ''}
    <div class="kv"><span>Subject line options</span></div>
    <ul class="subject-list">${subs || '<li>—</li>'}</ul>
    <div class="nl-panel" data-nl-panel="preview">
      <iframe class="email-preview" title="Newsletter email preview" sandbox=""></iframe>
    </div>
    <div class="nl-panel" data-nl-panel="edit" hidden>
      <textarea class="html-editor" spellcheck="false" placeholder="HTML email source…"></textarea>
      <p class="muted-note">Edits save locally until you click <strong>Save edits</strong>. Use table-based inline styles for best Gmail compatibility.</p>
    </div>
    <div class="nl-panel" data-nl-panel="plain" hidden>
      <div class="plain-body">${renderMarkdown(p.body || '')}</div>
    </div>`;
}

function detailHtml(item) {
  const p = item.payload || {};
  if (item.type === 'newsletter_draft') {
    return newsletterDetailHtml(item);
  }
  if (item.type === 'blog_draft') {
    return `<h3>${escapeHtml(p.title || item.title)}</h3>${renderMarkdown(p.body || '')}`;
  }
  if (item.type === 'seo_report') {
    return `<h3>${escapeHtml(item.title)}</h3>${renderMarkdown(p.markdown || p.body || '')}`;
  }
  if (item.type === 'seo_recommendation') {
    return `
      <div class="kv"><span>Page</span><code>${escapeHtml(p.page)}</code></div>
      <div class="kv"><span>Suggested title</span><strong>${escapeHtml(p.suggestedTitle)}</strong></div>
      <p>${escapeHtml(p.rationale)}</p>`;
  }
  if (item.type === 'ad_draft') {
    const hs = (p.headlines || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('');
    return `
      <div class="kv"><span>Headlines</span></div><ul>${hs}</ul>
      <div class="kv"><span>Description</span></div><p>${escapeHtml(p.description)}</p>
      <div class="kv"><span>Status</span><code>${escapeHtml(p.status)}</code></div>`;
  }
  if (item.type === 'link_review') {
    const c = p.candidate || {};
    const reasons = (p.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    return `
      <div class="kv"><span>Domain</span><code>${escapeHtml(c.domain)}</code></div>
      <div class="kv"><span>Verdict</span><strong>${escapeHtml(p.verdict)}</strong> (score ${escapeHtml(p.score)})</div>
      <div class="kv"><span>Source type</span>${escapeHtml(c.sourceType)} · spam score ${escapeHtml(c.spamScore)}</div>
      <div class="kv"><span>Reasons</span></div><ul>${reasons}</ul>`;
  }
  return renderMarkdown(p.preview || item.title);
}

/* ------------------------------------------------------------------ *
 * Slide-over (view draft)
 * ------------------------------------------------------------------ */

function wireNewsletterDrawer(item) {
  const p = item.payload || {};
  const html = p.htmlDocument || '';
  const body = el('drawerBody');
  const iframe = body.querySelector('.email-preview');
  const textarea = body.querySelector('.html-editor');
  if (!iframe || !textarea) return;

  textarea.value = html;
  const setPreview = (doc) => { iframe.srcdoc = doc; };

  if (html) setPreview(html);

  body.querySelectorAll('[data-nl-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('[data-nl-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.nlTab;
      body.querySelectorAll('[data-nl-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.nlPanel !== tab;
      });
      if (tab === 'preview') setPreview(textarea.value || html);
    });
  });

  body.querySelectorAll('[data-nl-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const doc = textarea.value || html;
      if (!doc) return toast('No HTML to export — run agent cycle first', 'bad');
      if (btn.dataset.nlAction === 'open') {
        const w = window.open('', '_blank');
        if (!w) return toast('Pop-up blocked — allow pop-ups or use Download', 'bad');
        w.document.write(doc);
        w.document.close();
        toast('Opened email preview in new tab', 'ok');
      } else if (btn.dataset.nlAction === 'download') {
        downloadNewsletterHtml(item);
      } else if (btn.dataset.nlAction === 'copy') {
        try {
          await navigator.clipboard.writeText(doc);
          toast('HTML copied — paste into Gmail or your ESP', 'ok');
        } catch {
          toast('Copy failed — use Download instead', 'bad');
        }
      } else if (btn.dataset.nlAction === 'save') {
        try {
          const res = await api(`/approvals/${item.id}/content`, {
            method: 'POST',
            body: JSON.stringify({ htmlDocument: doc }),
          });
          const idx = state.items.findIndex((i) => i.id === item.id);
          if (idx >= 0) state.items[idx] = res.item;
          item.payload = res.item.payload;
          toast('Newsletter HTML saved', 'ok');
        } catch (err) {
          toast('Save failed: ' + err.message, 'bad');
        }
      }
    });
  });
}

/* ------------------------------------------------------------------ *
 * Integration detail (slide-over) — clickable data sources
 * ------------------------------------------------------------------ */

function metricCell(val, lab) {
  return `<div class="int-metric"><div class="m-val">${val}</div><div class="m-lab">${escapeHtml(lab)}</div></div>`;
}

function integrationDetailHtml(key) {
  const sig = signalData();
  const ints = (state.health && state.health.integrations) || {};

  if (key === 'ga4') {
    const ga = sig.ga4 || {};
    const pages = ga.landingPages || [];
    if (!ga.connected) {
      return emptyState('GA4 not connected', 'Add GA4_PROPERTY_ID to .env and restart GrowthOps.');
    }
    if (!pages.length && ga.totalSessions == null) {
      return emptyState('No GA4 data yet', 'No sessions in the last 28 days.');
    }
    return `
      <div class="int-metrics">
        ${metricCell(fmtLiveMetric(ga.totalSessions, ga.connected), 'Sessions · 28d')}
        ${metricCell(fmtLiveMetric(ga.totalUsers, ga.connected), 'Users · 28d')}
        ${metricCell(fmtLiveMetric(ga.consultIntentsTotal, ga.connected), 'Consult events')}
      </div>
      ${pages.length ? `<div class="int-section">
        <div class="chart-title">Sessions by landing page (top ${pages.length})</div>
        ${vbars(pages.slice(0, 8).map((p) => ({ label: p.path, short: shortPath(p.path), value: p.sessions || 0 })), 'teal')}
      </div>` : ''}`;
  }

  if (key === 'searchConsole') {
    const sc = sig.searchConsole || {};
    const queries = sc.topQueries || [];
    const low = (sc.lowCtrPages && sc.lowCtrPages[0]) || null;
    if (!sc.connected) {
      return emptyState('Search Console not connected', 'Connect GSC_SITE_URL + Google OAuth in .env.');
    }
    if (!queries.length && sc.totalClicks == null) {
      return emptyState('No Search Console data yet', 'No organic data in the last 28 days.');
    }
    return `
      <div class="int-metrics">
        ${metricCell(fmtLiveMetric(sc.totalClicks, sc.connected), 'Clicks · 28d')}
        ${metricCell(fmtLiveMetric(sc.totalImpressions, sc.connected), 'Impressions · 28d')}
        ${metricCell(sc.totalImpressions ? fmtPct((sc.totalClicks || 0) / sc.totalImpressions) : '—', 'Avg CTR')}
      </div>
      <div class="int-section">
        <div class="chart-title">Clicks by query</div>
        ${hbars(queries.map((q) => ({ label: q.query, value: q.clicks || 0 })), 'purple')}
      </div>
      <div class="int-section">
        <div class="chart-title">Impressions by query</div>
        ${vbars(queries.map((q) => ({ label: q.query, short: q.query.split(' ')[0], value: q.impressions || 0 })), 'navy')}
      </div>
      ${low ? `<div class="callout">
        <div class="callout-label">Opportunity · low CTR page</div>
        <div class="callout-path" title="${escapeHtml(low.page)}">${escapeHtml(low.page)}</div>
        <div class="callout-meta">${fmtPct(low.ctr)} CTR on ${fmtNum(low.impressions)} impressions — test a clearer title &amp; meta.</div>
      </div>` : ''}`;
  }

  if (key === 'zoho') {
    const z = sig.zoho || {};
    const leads = z.newLeads7d ?? 0;
    const sources = z.leadSources || (z.topSources || []).map((s) => ({ source: s, count: 0 }));
    const statuses = z.leadsByStatus || [];
    if (!z.connected) return emptyState('Zoho CRM not connected', 'Configure Zoho OAuth on the server to load CRM data.');
    if (!leads && !sources.length && !statuses.length) {
      return emptyState('No Zoho activity yet', 'Consult leads will appear here as they are created.');
    }
    return `
      <div class="int-metrics">
        ${metricCell(fmtNum(leads), 'Leads · 7d')}
        ${metricCell(fmtNum(zohoStatusCount(z, 'New Leads') ?? 0), 'New Leads · status')}
        ${metricCell(fmtNum(zohoStatusCount(z, 'Consult Done') ?? 0), 'Consult Done · status')}
      </div>
      ${sources.length ? `<div class="int-section">
        <div class="chart-title">Top lead sources</div>
        ${hbars(sources.map((s) => ({ label: s.source, value: s.count })), 'gold')}
      </div>` : ''}
      ${statuses.length ? `<div class="int-section">
        <div class="chart-title">Leads by status</div>
        ${hbars(statuses.map((r) => ({ label: r.status, value: r.count })), 'teal')}
      </div>` : ''}`;
  }

  if (key === 'openai') {
    const drafts = state.items.filter((i) => i.payload && i.payload.generatedBy === 'openai');
    const byType = {};
    drafts.forEach((d) => { byType[d.type] = (byType[d.type] || 0) + 1; });
    const rows = Object.keys(byType).map((t) => ({ label: (TYPES[t] && TYPES[t].label) || t, value: byType[t] }));
    return `
      <div class="int-metrics">
        ${metricCell(fmtNum(drafts.length), 'AI drafts generated')}
        ${metricCell(fmtNum(state.items.filter((i) => i.status === 'pending').length), 'Pending review')}
      </div>
      ${rows.length ? `<div class="int-section">
        <div class="chart-title">AI drafts by type</div>
        ${hbars(rows, 'teal')}
      </div>` : '<div class="int-section">No AI drafts in the queue yet — run an agent cycle to generate some.</div>'}`;
  }

  if (key === 'googleAds' || key === 'metaAds') {
    const ads = sig.ads || {};
    const g = ads.google, m = ads.meta;
    const d = key === 'googleAds' ? g : m;
    if (!d) return emptyState('Paid media not connected', 'Google Ads and Meta are read-only stubs in v1 — no spend is tracked yet.');
    if (key === 'googleAds') {
      return `
        <div class="int-metrics">
          ${metricCell(fmtMoney(g.spend), 'Spend')}
          ${metricCell(fmtNum(g.clicks), 'Clicks')}
          ${metricCell(fmtNum(g.leads), 'Leads')}
          ${metricCell(fmtMoney(g.cpl, true), 'Cost / lead')}
        </div>
        <div class="int-section">
          <div class="chart-title">Funnel</div>
          ${hbars([
            { label: 'Clicks', value: g.clicks || 0 },
            { label: 'Leads', value: g.leads || 0 },
          ], 'navy')}
        </div>`;
    }
    return `
      <div class="int-metrics">
        ${metricCell(fmtMoney(m.spend), 'Spend')}
        ${metricCell(fmtNum(m.leads), 'Leads')}
        ${metricCell(fmtNum(m.booked), 'Booked')}
        ${metricCell(escapeHtml(m.quality || '—'), 'Lead quality')}
      </div>
      <div class="int-section">
        <div class="chart-title">Funnel</div>
        ${hbars([
          { label: 'Leads', value: m.leads || 0 },
          { label: 'Booked', value: m.booked || 0 },
        ], 'gold')}
      </div>`;
  }

  return emptyState('No detail available', 'This source has no data to show yet.');
}

function openIntegrationDrawer(key) {
  const meta = INTEGRATIONS.find((i) => i.key === key);
  if (!meta) return;
  const ints = (state.health && state.health.integrations) || {};
  const st = STATUS[ints[key]] || STATUS.not_configured;
  const drawer = el('drawer');
  drawer.classList.remove('newsletter-wide');
  el('drawerTitle').innerHTML =
    `<span class="type-tag">Integration</span>
     <span class="int-detail-badge tone-${st.tone}"><span class="dot ${st.tone}"></span>${st.label}</span>`;
  el('drawerHeading').textContent = meta.full;
  el('drawerBody').innerHTML =
    `<p class="int-desc">${escapeHtml(meta.desc || '')}</p>${integrationDetailHtml(key)}`;
  el('drawerFoot').hidden = true;
  drawer.classList.add('open');
  el('drawerScrim').classList.add('open');
}

function openDrawer(item) {
  const t = TYPES[item.type] || { label: item.type };
  const risk = item.compliance && item.compliance.riskLevel;
  const drawer = el('drawer');
  drawer.classList.toggle('newsletter-wide', item.type === 'newsletter_draft');
  el('drawerTitle').innerHTML =
    `<span class="type-tag">${t.label}</span><span class="risk ${riskClass(risk)}">${risk || 'low'} risk</span>`;
  el('drawerHeading').textContent = item.title;
  el('drawerBody').innerHTML = detailHtml(item);
  if (item.type === 'newsletter_draft') wireNewsletterDrawer(item);

  const foot = el('drawerFoot');
  const st = item.status;
  if (st === 'pending' || st === 'revision_requested') {
    foot.innerHTML = `
      <button class="btn ghost" data-action="reject">Reject</button>
      <button class="btn" data-action="approve">Approve</button>`;
    foot.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', async () => { closeDrawer(); await onAction(item.id, b.dataset.action); }));
    foot.hidden = false;
  } else if (st === 'approved' && WORKFLOW_TYPES.has(item.type)) {
    foot.innerHTML = `<button class="btn ghost" data-action="reject">Reject</button>`;
    foot.querySelector('button').addEventListener('click', async () => {
      closeDrawer();
      await onAction(item.id, 'reject');
    });
    foot.hidden = false;
  } else if (st === 'rejected') {
    foot.innerHTML = `<button class="btn ghost" data-action="delete">Delete permanently</button>`;
    foot.querySelector('button').addEventListener('click', async () => {
      closeDrawer();
      await onAction(item.id, 'delete');
    });
    foot.hidden = false;
  } else {
    foot.hidden = true;
  }
  el('drawer').classList.add('open');
  el('drawerScrim').classList.add('open');
}

function closeDrawer() {
  el('drawer').classList.remove('open', 'newsletter-wide');
  el('drawerScrim').classList.remove('open');
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

async function onAction(id, action) {
  try {
    if (action === 'view') {
      const item = state.items.find((i) => i.id === id);
      if (item) openDrawer(item);
      return;
    }
    if (action === 'download-html') {
      const item = state.items.find((i) => i.id === id);
      if (item) downloadNewsletterHtml(item);
      return;
    }
    if (action === 'delete') {
      const item = state.items.find((i) => i.id === id);
      const label = item ? item.title : 'this draft';
      if (!window.confirm(`Delete "${label}" permanently?\n\nThis cannot be undone.`)) return;
      await api(`/approvals/${id}`, { method: 'DELETE' });
      toast('Draft deleted', 'ok');
      await refresh();
      return;
    }
    if (action === 'revision') {
      const note = window.prompt('What should be revised? (optional note for marketing)');
      if (note === null) return;
      await api(`/approvals/${id}/revision`, { method: 'POST', body: JSON.stringify({ note: note || '' }) });
      toast('Sent back for revision');
    } else if (action === 'assign-seo') {
      await api(`/approvals/${id}/assign`, { method: 'POST', body: JSON.stringify({ assignee: 'SEO team' }) });
      toast('Assigned to SEO team');
    } else if (action === 'assign-marketing') {
      await api(`/approvals/${id}/assign`, { method: 'POST', body: JSON.stringify({ assignee: 'Marketing' }) });
      toast('Assigned to Marketing');
    } else if (action === 'approve' || action === 'reject') {
      const item = state.items.find((i) => i.id === id);
      let payload = {};
      if (action === 'approve' && item && item.type === 'blog_draft') {
        const author = window.prompt('Author name for publish', item.payload?.author || 'Dr. Rajesh Khanna');
        if (author === null) return;
        payload.author = author.trim() || 'Dr. Rajesh Khanna';
      }
      const result = await api(`/approvals/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (action === 'approve') {
        if (item && item.type === 'blog_draft' && result.publish) {
          const pub = result.publish;
          if (pub.ok && pub.published && pub.published.published) {
            toast('Approved — live on khannainstitute.com/blog/latest/', 'ok');
          } else if (pub.skipped) {
            toast(`Approved — publish skipped (${pub.reason})`, '');
          } else {
            toast(`Approved — publish failed: ${pub.error || 'check server logs'}`, 'bad');
          }
        } else {
          toast('Approved', 'ok');
        }
      } else {
        toast('Rejected', '');
      }
    }
    await refresh();
  } catch (err) {
    toast('Something went wrong: ' + err.message, 'bad');
  }
}

function blogItems() {
  return state.items.filter((i) => i.type === 'blog_draft');
}

function seoItems() {
  return state.items.filter((i) => i.type === 'seo_report');
}

function emailItems() {
  return state.items.filter((i) => i.type === 'newsletter_draft');
}

function renderStatsRow(cards) {
  return `<div class="stats-row">${cards.map((c) => `
    <div class="stat-card"><div class="n">${escapeHtml(String(c.n))}</div><div class="l">${escapeHtml(c.l)}</div></div>
  `).join('')}</div>`;
}

function renderBlogWorkspace() {
  if (!state.loaded) return skeletonApprovals();
  if (state.blogSubview === 'published') return renderPublished();

  const blogs = blogItems();
  const counts = countByStatus(blogs);
  const items = blogs.filter((i) => i.status === state.approvalsTab);

  const stats = renderStatsRow([
    { n: counts.pending, l: 'Pending review' },
    { n: counts.approved, l: 'Approved' },
    { n: blogs.length, l: 'Total drafts' },
    { n: state.publishedBlogs.length, l: 'Published on site' },
  ]);

  return `${stats}
    <section class="card span-all approvals-card">
      <div class="card-head">
        <div class="seg">${approvalTabButtons(counts)}
        </div>
      </div>
      <div class="card-body">
        ${items.length ? `<div class="approval-list">${items.map(approvalCard).join('')}</div>`
          : emptyState('No blog drafts', 'Click ✦ Generate blog to create a post from Search Console + GA4 data.')}
      </div>
    </section>`;
}

function renderEmailWorkspace() {
  if (!state.loaded) return skeletonApprovals();
  const emails = emailItems();
  const counts = countByStatus(emails);
  const items = emails.filter((i) => i.status === state.approvalsTab);

  const stats = renderStatsRow([
    { n: counts.pending, l: 'Pending review' },
    { n: counts.approved, l: 'Approved' },
    { n: emails.length, l: 'Total emails' },
    { n: emails.filter((i) => (i.payload || {}).kind === 'reminder').length, l: 'Reminders' },
  ]);

  return `${stats}
    <section class="card span-all approvals-card">
      <div class="card-head">
        <div class="seg">${approvalTabButtons(counts)}
        </div>
      </div>
      <div class="card-body">
        ${items.length ? `<div class="approval-list">${items.map(approvalCard).join('')}</div>`
          : emptyState('No email drafts', 'Click ✦ Generate email to create a newsletter or seminar reminder.')}
      </div>
    </section>`;
}

function renderCrmWorkspace() {
  if (!state.loaded) return skeletonOverview();
  const s = state.analyticsSummary;
  if (!s) {
    return `<section class="card span-all"><div class="card-body">${
      emptyState('CRM data loading…', 'Lead metrics are fetched live from Zoho CRM when you open this tab.')
    }</div></section>`;
  }
  const z = s.zoho || {};
  const connected = (s.sources || {}).zoho === 'connected';
  const leads = z.newLeads7d ?? 0;
  const topSource = (z.topSources && z.topSources[0]) || '—';
  const pipelineNew = zohoStatusCount(z, 'New Leads');
  const consultDone = zohoStatusCount(z, 'Consult Done');

  return `
    ${renderStatsRow([
      { n: fmtLiveMetric(leads, connected), l: 'Leads · 7d' },
      { n: pipelineNew != null ? fmtNum(pipelineNew) : '—', l: 'New Leads · status' },
      { n: consultDone != null ? fmtNum(consultDone) : '—', l: 'Consult Done · status' },
      { n: escapeHtml(topSource), l: 'Top lead source' },
    ])}
    <section class="card span-all">
      <div class="card-head">
        <div>
          <h2>Zoho CRM</h2>
          <div class="muted-note">Live read-only · last 7 days · each lead = consult booking · no patient names</div>
        </div>
        ${connected ? '<a class="btn ghost sm" href="https://crm.zoho.com/" target="_blank" rel="noopener noreferrer">Open Zoho CRM ↗</a>' : ''}
      </div>
      <div class="card-body">
        <div class="card-grid">
          ${zohoCard()}
          ${zohoStatusCard()}
        </div>
      </div>
    </section>`;
}

function renderSeoAnalytics() {
  if (!state.loaded) return '';
  const s = state.analyticsSummary;
  if (!s) {
    return `<section class="card span-all"><div class="card-body">${
      emptyState('Analytics loading…', 'Data is fetched live from GA4 and Search Console when you open this tab.')
    }</div></section>`;
  }
  const t = s.totals || {};
  const sources = s.sources || {};
  return `
    <section class="card span-all">
      <div class="card-head"><h2>Traffic &amp; engagement</h2><span class="muted-note">Live GA4 + Search Console · last ${s.days || 28} days</span></div>
      <div class="card-body">
        ${renderStatsRow([
          { n: fmtLiveMetric(t.sessions, sources.ga4 === 'connected'), l: 'Sessions · 28d (GA4)' },
          { n: fmtLiveMetric(t.users, sources.ga4 === 'connected'), l: 'Users · 28d (GA4)' },
          { n: fmtLiveMetric(t.organicClicks, sources.searchConsole === 'connected'), l: 'Organic clicks · 28d (GSC)' },
          { n: fmtLiveMetric(t.consultIntents, sources.ga4 === 'connected'), l: 'Consult events · 28d (GA4)' },
        ])}
        <div class="card-grid" style="margin-top:14px">
          ${ga4Card()}
          ${searchCard()}
        </div>
      </div>
    </section>`;
}

function renderSeoWorkspace() {
  if (!state.loaded) return skeletonOverview();
  const reports = seoItems();
  const counts = countByStatus(reports);
  const items = reports.filter((i) => i.status === state.approvalsTab);

  return `
    ${renderSeoAnalytics()}
    ${renderStatsRow([
      { n: counts.pending, l: 'Reports pending' },
      { n: counts.approved, l: 'Approved' },
      { n: counts.rejected, l: 'Rejected' },
      { n: reports.length, l: 'Total reports' },
    ])}
    <section class="card span-all approvals-card">
      <div class="card-head">
        <div class="seg">${approvalTabButtons(counts)}
        </div>
      </div>
      <div class="card-body">
        ${items.length ? `<div class="approval-list">${items.map(approvalCard).join('')}</div>`
          : emptyState('No SEO reports', 'Click ✦ Generate SEO report to create one from live data.')}
      </div>
    </section>`;
}

function applyChannelChrome() {
  const blogBtn = el('generateBlogBtn');
  const seoBtn = el('generateSeoBtn');
  const emailBtn = el('generateEmailBtn');
  const subnav = el('blogSubnav');
  if (blogBtn) blogBtn.classList.toggle('hidden', state.channel !== 'blog' || state.blogSubview === 'published');
  if (seoBtn) seoBtn.classList.toggle('hidden', state.channel !== 'seo');
  if (emailBtn) emailBtn.classList.toggle('hidden', state.channel !== 'email');
  if (subnav) subnav.classList.toggle('hidden', state.channel !== 'blog');
  document.querySelectorAll('#channelTabs [data-channel]').forEach((b) => {
    b.classList.toggle('active', b.dataset.channel === state.channel && b.dataset.active === 'true');
  });
  document.querySelectorAll('#blogSubnav [data-blog-sub]').forEach((b) => {
    b.classList.toggle('active', b.dataset.blogSub === state.blogSubview);
  });
}

function openGenModal() {
  el('genScrim').classList.remove('hidden');
  el('genModal').classList.remove('hidden');
}

function closeGenModal() {
  el('genScrim').classList.add('hidden');
  el('genModal').classList.add('hidden');
  el('genSuggestions').classList.add('hidden');
}

function openEmailModal() {
  el('emailScrim').classList.remove('hidden');
  el('emailModal').classList.remove('hidden');
}

function closeEmailModal() {
  el('emailScrim').classList.add('hidden');
  el('emailModal').classList.add('hidden');
  el('emailSuggestions').classList.add('hidden');
}

async function loadEmailOptions() {
  try {
    const opts = await api('/newsletter/options');
    const blogSel = el('emailBlog');
    blogSel.innerHTML = '<option value="">None — write from topic / analytics</option>' +
      (opts.sourceBlogs || []).map((b) =>
        `<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)}</option>`).join('');
    const hint = el('emailSeminarHint');
    if (opts.seminar) {
      hint.textContent = `${opts.seminar.dateLine} · ${opts.seminar.timeLine} · ${opts.seminar.location}`;
    } else {
      hint.textContent = 'Could not load seminar page — section will use last known template.';
    }
  } catch (_) {
    el('emailSeminarHint').textContent = 'Seminar details load when you generate.';
  }
}

async function suggestEmailTopics() {
  const btn = el('emailSuggest');
  btn.disabled = true;
  try {
    const { topics } = await api('/newsletter/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: el('emailKind').value }),
    });
    const box = el('emailSuggestions');
    box.innerHTML = (topics || []).map((t, i) => `
      <button type="button" class="suggestion-btn" data-idx="${i}">
        <strong>${escapeHtml(t.topic)}</strong><br><span class="muted-note">${escapeHtml(t.angle || '')}</span>
      </button>`).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.suggestion-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const t = topics[Number(b.dataset.idx)];
        el('emailTopic').value = t.topic;
        box.classList.add('hidden');
      });
    });
  } catch (err) {
    toast('Suggest failed: ' + err.message, 'bad');
  } finally {
    btn.disabled = false;
  }
}

async function submitEmailGenerate(e) {
  e.preventDefault();
  const btn = el('emailSubmit');
  btn.disabled = true;
  state.generating = true;
  try {
    const { item } = await api('/newsletter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: el('emailKind').value,
        topic: el('emailTopic').value.trim(),
        includeSeminar: el('emailSeminar').checked,
        blogId: el('emailBlog').value || undefined,
      }),
    });
    closeEmailModal();
    state.channel = 'email';
    state.approvalsTab = 'pending';
    await refresh();
    if (item) openDrawer(item);
    toast(el('emailKind').value === 'reminder' ? 'Reminder email generated' : 'Newsletter generated', 'ok');
  } catch (err) {
    toast('Generate failed: ' + err.message, 'bad');
  } finally {
    state.generating = false;
    btn.disabled = false;
  }
}

async function loadBlogOptions() {
  try {
    const opts = await api('/blog/options');
    const sel = el('genCity');
    sel.innerHTML = '<option value="">National (no city)</option>' +
      (opts.cities || []).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    el('genWords').value = opts.defaultWords || 700;
    el('gscHint').textContent = opts.capabilities.searchConsole ? '· connected' : '· not configured';
    el('gaHint').textContent = opts.capabilities.analytics ? '· connected' : '· not configured';
  } catch (_) {}
}

async function suggestTopics() {
  const btn = el('genSuggest');
  btn.disabled = true;
  try {
    const { topics } = await api('/blog/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: el('genCity').value,
        useSearchConsole: el('genGsc').checked,
        useAnalytics: el('genGa').checked,
      }),
    });
    const box = el('genSuggestions');
    box.innerHTML = (topics || []).map((t, i) => `
      <button type="button" class="suggestion-btn" data-idx="${i}">
        <strong>${escapeHtml(t.topic)}</strong><br><span class="muted-note">${escapeHtml(t.angle || '')}</span>
      </button>`).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.suggestion-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const t = topics[Number(b.dataset.idx)];
        el('genTopic').value = t.topic;
        box.classList.add('hidden');
      });
    });
  } catch (err) {
    toast('Suggest failed: ' + err.message, 'bad');
  } finally {
    btn.disabled = false;
  }
}

async function submitBlogGenerate(e) {
  e.preventDefault();
  const btn = el('genSubmit');
  btn.disabled = true;
  state.generating = true;
  try {
    const { item } = await api('/blog/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: el('genCity').value,
        topic: el('genTopic').value.trim(),
        wordCount: Number(el('genWords').value) || 700,
        useSearchConsole: el('genGsc').checked,
        useAnalytics: el('genGa').checked,
      }),
    });
    closeGenModal();
    state.channel = 'blog';
    state.blogSubview = 'drafts';
    state.approvalsTab = 'pending';
    await refresh();
    if (item) openDrawer(item);
    toast('Blog draft generated', 'ok');
  } catch (err) {
    toast('Generate failed: ' + err.message, 'bad');
  } finally {
    state.generating = false;
    btn.disabled = false;
  }
}

async function generateSeoReport() {
  const btn = el('generateSeoBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    const { item } = await api('/seo/generate', { method: 'POST' });
    state.channel = 'seo';
    state.approvalsTab = 'pending';
    await refresh();
    if (item) openDrawer(item);
    toast('SEO report generated', 'ok');
  } catch (err) {
    toast('SEO report failed: ' + err.message, 'bad');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

/* ------------------------------------------------------------------ *
 * Render dispatch + data
 * ------------------------------------------------------------------ */

function setChannel(channel) {
  if (channel !== 'blog' && channel !== 'seo' && channel !== 'email' && channel !== 'crm') return;
  closePublishedEditor();
  state.channel = channel;
  if (channel === 'blog') state.approvalsTab = 'pending';
  if (channel === 'seo') state.approvalsTab = 'pending';
  if (channel === 'email') state.approvalsTab = 'pending';
  location.hash = channel === 'blog' && state.blogSubview === 'published' ? '#blog-published' : `#${channel}`;
  applyChannelChrome();
  render();
}

function setBlogSubview(sub) {
  state.blogSubview = sub;
  location.hash = sub === 'published' ? '#blog-published' : '#blog';
  applyChannelChrome();
  render();
}

function render() {
  applyChannelChrome();
  const root = el('view');
  try {
    if (state.channel === 'blog') root.innerHTML = renderBlogWorkspace();
    else if (state.channel === 'email') root.innerHTML = renderEmailWorkspace();
    else if (state.channel === 'crm') root.innerHTML = renderCrmWorkspace();
    else root.innerHTML = renderSeoWorkspace();
    renderHeaderPills();
    wireView();
  } catch (err) {
    console.error(err);
    root.innerHTML = emptyState('Dashboard error', err.message || 'Something went wrong — try refreshing.');
  }
}

function wireView() {
  // Approvals tab + filter + per-card actions
  el('view').querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { state.approvalsTab = b.dataset.tab; state.typeFilter = 'all'; render(); }));
  el('view').querySelectorAll('[data-type]').forEach((b) =>
    b.addEventListener('click', () => { state.typeFilter = b.dataset.type; render(); }));

  el('view').querySelectorAll('.approval').forEach((card) => {
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.action === 'more') {
          const menu = card.querySelector('.more-menu');
          document.querySelectorAll('.more-menu').forEach((m) => { if (m !== menu) m.hidden = true; });
          menu.hidden = !menu.hidden;
          return;
        }
        onAction(card.dataset.id, btn.dataset.action);
      });
    });
  });

  el('view').querySelectorAll('[data-pub-slug]').forEach((card) => {
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const slug = card.dataset.pubSlug;
        const item = (state.publishedBlogs || []).find((x) => x.slug === slug);
        if (!item) return;
        if (btn.dataset.action === 'open-published') {
          window.open(item.url, '_blank');
          return;
        }
        if (btn.dataset.action === 'edit-published') {
          openPublishedEditor(item);
          return;
        }
        if (btn.dataset.action === 'delete-published') {
          const ok = window.confirm(`Remove published blog "${item.title}"?`);
          if (!ok) return;
          try {
            await api(`/published-blogs?slug=${encodeURIComponent(item.slug)}`, { method: 'DELETE' });
            toast('Published blog removed', 'ok');
            await refresh();
          } catch (err) {
            toast('Remove failed: ' + err.message, 'bad');
          }
        }
      });
    });
  });

  // Clickable integration cells → detail drawer
  el('view').querySelectorAll('.int-cell[data-int]').forEach((cell) => {
    cell.addEventListener('click', () => openIntegrationDrawer(cell.dataset.int));
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIntegrationDrawer(cell.dataset.int); }
    });
  });

  const printBtn = el('printBriefBtn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());
}

// Close any open "More" menu when clicking elsewhere.
document.addEventListener('click', (e) => {
  if (!e.target.closest('.more')) {
    document.querySelectorAll('.more-menu').forEach((m) => { m.hidden = true; });
  }
});

async function loadHealth() {
  try { state.health = await api('/health'); } catch (_) { state.health = null; }
  renderHeaderPills();
}

async function refresh() {
  try {
    const [health, stats, approvals, published, analytics] = await Promise.allSettled([
      api('/health'), api('/stats'), api('/approvals'), api('/published-blogs'), api('/analytics/summary'),
    ]);
    if (health.status === 'fulfilled') state.health = health.value;
    if (stats.status === 'fulfilled') state.stats = stats.value.stats;
    if (approvals.status === 'fulfilled') state.items = approvals.value.items || [];
    if (published.status === 'fulfilled') {
      state.publishedBlogs = sortPublishedBlogsNewestFirst(published.value.items || []);
    }
    if (analytics.status === 'fulfilled') {
      state.analyticsSummary = analytics.value.summary;
      if (state.health && analytics.value.summary?.sources) {
        state.health.integrations = {
          ...state.health.integrations,
          ...analytics.value.summary.sources,
        };
      }
    }
  } finally {
    state.loaded = true;
    render();
    renderHeaderPills();
  }
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function init() {
  document.querySelectorAll('#channelTabs [data-channel]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.active !== 'true') {
        toast('That module is on the roadmap — coming soon.');
        return;
      }
      setChannel(b.dataset.channel);
    });
  });
  document.querySelectorAll('#blogSubnav [data-blog-sub]').forEach((b) => {
    b.addEventListener('click', () => setBlogSubview(b.dataset.blogSub));
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (h === 'blog-published') { state.channel = 'blog'; state.blogSubview = 'published'; render(); }
    else if (h === 'seo') { state.channel = 'seo'; render(); }
    else if (h === 'email') { state.channel = 'email'; render(); }
    else if (h === 'crm') { state.channel = 'crm'; render(); }
    else if (h === 'blog') { state.channel = 'blog'; state.blogSubview = 'drafts'; render(); }
  });
  const initial = location.hash.replace('#', '');
  if (initial === 'blog-published') { state.channel = 'blog'; state.blogSubview = 'published'; }
  else if (initial === 'seo') state.channel = 'seo';
  else if (initial === 'email') state.channel = 'email';
  else if (initial === 'crm') state.channel = 'crm';
  else { state.channel = 'blog'; state.blogSubview = 'drafts'; }

  el('generateBlogBtn').addEventListener('click', () => { loadBlogOptions(); openGenModal(); });
  el('generateSeoBtn').addEventListener('click', generateSeoReport);
  el('generateEmailBtn').addEventListener('click', () => { loadEmailOptions(); openEmailModal(); });
  el('emailClose').addEventListener('click', closeEmailModal);
  el('emailCancel').addEventListener('click', closeEmailModal);
  el('emailScrim').addEventListener('click', closeEmailModal);
  el('emailSuggest').addEventListener('click', suggestEmailTopics);
  el('emailForm').addEventListener('submit', submitEmailGenerate);
  el('genClose').addEventListener('click', closeGenModal);
  el('genCancel').addEventListener('click', closeGenModal);
  el('genScrim').addEventListener('click', closeGenModal);
  el('genSuggest').addEventListener('click', suggestTopics);
  el('genForm').addEventListener('submit', submitBlogGenerate);

  el('drawerClose').addEventListener('click', closeDrawer);
  el('drawerScrim').addEventListener('click', closeDrawer);
  el('pubEditorClose').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePublishedEditor();
  });
  el('pubEditorCancel').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePublishedEditor();
  });
  el('pubEditorScrim').addEventListener('click', closePublishedEditor);
  el('pubEditorSave').addEventListener('click', (e) => {
    e.preventDefault();
    savePublishedEditor();
  });
  el('pubEditor').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closePublishedEditor();
    }
  });

  render();          // shows skeletons
  loadHealth();      // quick header pills
  refresh().catch((err) => toast('Failed to load: ' + err.message, 'bad'));
}

document.addEventListener('DOMContentLoaded', init);
