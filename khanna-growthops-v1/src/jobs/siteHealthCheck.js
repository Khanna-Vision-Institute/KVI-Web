/**
 * Site health cron — probe public URLs for 404 / 5xx (incl. 502) errors.
 * Results are stored in GrowthOps data store for the Site Health dashboard tab.
 */
const config = require('../config');
const store = require('../storage/store');

const DEFAULT_PATHS = [
  '/',
  '/contact/schedule-consultation/',
  '/contact/forms/',
  '/HeritageFamily',
  '/procedures/laser-vision/smile-laser/',
  '/procedures/laser-vision/lasik/',
  '/procedures/lens-solutions/pie/',
  '/procedures/lens-solutions/evo-icl/',
  '/patients/results/testimonials/',
  '/pricing-financing/special-offers/',
  '/seminar-rsvp.html',
];

function classifyStatus(status, networkError) {
  if (networkError) return 'down';
  if (status === 404) return '404';
  if (status === 502 || status === 503 || status === 504) return '502';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  return 'ok';
}

async function probeUrl(url, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'KhannaGrowthOps-SiteHealth/1.0',
        Accept: 'text/html,application/json,*/*',
      },
    });
    // Drain body so sockets close cleanly; we only care about status.
    try {
      await res.arrayBuffer();
    } catch (_) {
      /* ignore */
    }
    const status = res.status;
    const kind = classifyStatus(status, false);
    return {
      url,
      status,
      kind,
      ok: kind === 'ok',
      ms: Date.now() - started,
    };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'timeout' : err.message || String(err);
    return {
      url,
      status: 0,
      kind: 'down',
      ok: false,
      ms: Date.now() - started,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildUrls() {
  const base = String(config.siteHealth.baseUrl || 'https://khannainstitute.com').replace(/\/$/, '');
  const paths = config.siteHealth.paths.length ? config.siteHealth.paths : DEFAULT_PATHS;
  return paths.map((p) => {
    if (/^https?:\/\//i.test(p)) return p;
    return `${base}${p.startsWith('/') ? p : `/${p}`}`;
  });
}

/**
 * @param {{ source?: string }} opts
 */
async function runSiteHealthCheck(opts = {}) {
  const source = opts.source || 'manual';
  const urls = buildUrls();
  const timeoutMs = config.siteHealth.timeoutMs;
  const concurrency = Math.max(1, Math.min(10, config.siteHealth.concurrency));

  const checks = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((url) => probeUrl(url, timeoutMs)));
    checks.push(...results);
  }

  const errors404 = checks.filter((c) => c.kind === '404');
  const errors502 = checks.filter((c) => c.kind === '502' || c.kind === '5xx' || c.kind === 'down');
  const other4xx = checks.filter((c) => c.kind === '4xx');
  const okCount = checks.filter((c) => c.ok).length;
  const hasCritical = errors404.length > 0 || errors502.length > 0;

  const summary = {
    at: new Date().toISOString(),
    source,
    baseUrl: config.siteHealth.baseUrl,
    checked: checks.length,
    ok: okCount,
    errors404: errors404.length,
    errors502: errors502.length,
    other4xx: other4xx.length,
    healthy: !hasCritical,
    durationMs: checks.reduce((m, c) => Math.max(m, c.ms || 0), 0),
    issues: [...errors502, ...errors404, ...other4xx].map((c) => ({
      url: c.url,
      status: c.status,
      kind: c.kind,
      error: c.error || null,
      ms: c.ms,
    })),
    checks,
  };

  store.saveSiteHealthRun(summary);
  store.addJobRun({
    id: store.uid('site_health'),
    job: 'site_health_check',
    at: summary.at,
    source,
    ok: summary.healthy,
    checked: summary.checked,
    errors404: summary.errors404,
    errors502: summary.errors502,
  });

  if (hasCritical) {
    console.warn(
      `[growthops] site-health ALERT source=${source} 404=${summary.errors404} 502/5xx/down=${summary.errors502}`,
      summary.issues.slice(0, 10)
    );
    await maybeNotifyWebhook(summary);
  } else {
    console.log(
      `[growthops] site-health OK source=${source} checked=${summary.checked} ok=${summary.ok}`
    );
  }

  return summary;
}

async function maybeNotifyWebhook(summary) {
  const hook = config.siteHealth.webhookUrl;
  if (!hook) return;
  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Khanna site health: ${summary.errors404}×404, ${summary.errors502}×502/5xx/down`,
        summary,
      }),
    });
  } catch (err) {
    console.warn('[growthops] site-health webhook failed:', err.message || err);
  }
}

module.exports = {
  runSiteHealthCheck,
  DEFAULT_PATHS,
};
