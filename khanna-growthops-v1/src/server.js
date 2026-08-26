const path = require('path');
const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const healthRoutes = require('./routes/health');
const approvalRoutes = require('./routes/approvals');
const siteHealthRoutes = require('./routes/siteHealth');
const { runDailyGrowthBrief } = require('./jobs/dailyGrowthBrief');
const { runSiteHealthCheck } = require('./jobs/siteHealthCheck');

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.use(express.json());

function requireBasicAuth(req, res, next) {
  if (!config.requireAuth) return next();
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Khanna GrowthOps"');
    return res.status(401).send('Authentication required');
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
  if (user !== config.adminUser || pass !== config.adminPassword) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Khanna GrowthOps"');
    return res.status(401).send('Invalid credentials');
  }
  return next();
}

app.use(requireBasicAuth);

app.use('/api', healthRoutes);
app.use('/api', approvalRoutes);
app.use('/api', siteHealthRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Optional: run daily brief at 8am on weekdays while laptop is on
if (process.env.GROWTHOPS_CRON === 'true') {
  cron.schedule('0 8 * * 1-5', () => {
    runDailyGrowthBrief({ source: 'cron' }).catch((err) => {
      console.error('[growthops] cron failed:', err.message);
    });
  });
}

// Site health 404/502 checker — manual by default (dashboard or POST /api/site-health/run).
// Set SITE_HEALTH_CHECK_ENABLED=true only if you want automatic cron probes.
if (config.siteHealth.enabled) {
  if (!cron.validate(config.siteHealth.cron)) {
    console.error('[growthops] Invalid SITE_HEALTH_CHECK_CRON:', config.siteHealth.cron);
  } else {
    cron.schedule(config.siteHealth.cron, () => {
      runSiteHealthCheck({ source: 'cron' }).catch((err) => {
        console.error('[growthops] site-health cron failed:', err.message || err);
      });
    });
    console.log(
      `[growthops] Site health cron: ${config.siteHealth.cron} → ${config.siteHealth.baseUrl}`
    );
  }
} else {
  console.log('[growthops] Site health: manual only (cron off)');
}

// Drafts are created only via dashboard Generate buttons — no bootstrap auto-generation.

app.listen(config.port, () => {
  console.log('');
  console.log('  Khanna GrowthOps v1');
  console.log(`  Dashboard: http://localhost:${config.port}`);
  console.log(`  Sample data: ${config.mockMode}`);
  console.log(`  Auth enabled: ${config.requireAuth}`);
  console.log(`  Site health: ${config.siteHealth.enabled ? 'on' : 'off'}`);
  console.log('');
});
