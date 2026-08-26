const fs = require('fs');
const path = require('path');
const config = require('../config');

const STORE_PATH = path.join(config.dataDir, 'store.json');

const EMPTY = {
  approvals: [],
  briefs: [],
  jobRuns: [],
  siteHealthHistory: [],
  meta: { seededAt: null, version: 1 },
};

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return structuredClone(EMPTY);
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
      briefs: Array.isArray(raw.briefs) ? raw.briefs : [],
      jobRuns: Array.isArray(raw.jobRuns) ? raw.jobRuns : [],
      siteHealthHistory: Array.isArray(raw.siteHealthHistory) ? raw.siteHealthHistory : [],
      meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : { version: 1 },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function writeStore(data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function listApprovals({ status } = {}) {
  const store = readStore();
  let rows = store.approvals;
  if (status) rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function upsertApproval(item) {
  const store = readStore();
  const idx = store.approvals.findIndex((r) => r.id === item.id);
  if (idx >= 0) store.approvals[idx] = { ...store.approvals[idx], ...item };
  else store.approvals.unshift(item);
  writeStore(store);
  return item;
}

function updateApprovalStatus(id, status, opts = {}) {
  const store = readStore();
  const row = store.approvals.find((r) => r.id === id);
  if (!row) return null;
  row.status = status;
  row.updatedAt = new Date().toISOString();
  row.updatedBy = typeof opts === 'string' ? opts : opts.actor || 'human';
  if (opts.note !== undefined) row.revisionNote = opts.note;
  writeStore(store);
  return row;
}

function updateApprovalMeta(id, patch) {
  const store = readStore();
  const row = store.approvals.find((r) => r.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  row.updatedAt = new Date().toISOString();
  writeStore(store);
  return row;
}

function updateApprovalPayload(id, payloadPatch) {
  const store = readStore();
  const row = store.approvals.find((r) => r.id === id);
  if (!row) return null;
  row.payload = { ...(row.payload || {}), ...payloadPatch };
  row.updatedAt = new Date().toISOString();
  row.updatedBy = 'human';
  writeStore(store);
  return row;
}

function getApproval(id) {
  return readStore().approvals.find((r) => r.id === id) || null;
}

function deleteApproval(id) {
  const store = readStore();
  const before = store.approvals.length;
  store.approvals = store.approvals.filter((r) => r.id !== id);
  if (store.approvals.length === before) return false;
  writeStore(store);
  return true;
}

function addBrief(brief) {
  const store = readStore();
  store.briefs.unshift(brief);
  store.briefs = store.briefs.slice(0, 30);
  writeStore(store);
  return brief;
}

function latestBrief() {
  const store = readStore();
  return store.briefs[0] || null;
}

function addJobRun(run) {
  const store = readStore();
  store.jobRuns.unshift(run);
  store.jobRuns = store.jobRuns.slice(0, 50);
  writeStore(store);
  return run;
}

function saveSiteHealthRun(summary) {
  const store = readStore();
  // Keep checks in latest only; history stores a lighter copy.
  const light = {
    at: summary.at,
    source: summary.source,
    baseUrl: summary.baseUrl,
    checked: summary.checked,
    ok: summary.ok,
    errors404: summary.errors404,
    errors502: summary.errors502,
    other4xx: summary.other4xx,
    healthy: summary.healthy,
    durationMs: summary.durationMs,
    issues: summary.issues || [],
  };
  store.siteHealthHistory = store.siteHealthHistory || [];
  store.siteHealthHistory.unshift({
    ...light,
    // Full check list only on the newest entry (for dashboard detail).
    checks: summary.checks || [],
  });
  store.siteHealthHistory = store.siteHealthHistory.slice(0, 40).map((row, idx) => {
    if (idx === 0) return row;
    const { checks, ...rest } = row;
    return rest;
  });
  store.meta = { ...(store.meta || {}), lastSiteHealthAt: summary.at, version: 1 };
  writeStore(store);
  return light;
}

function getLatestSiteHealth() {
  const store = readStore();
  return (store.siteHealthHistory && store.siteHealthHistory[0]) || null;
}

function listSiteHealthHistory(limit = 20) {
  const store = readStore();
  return (store.siteHealthHistory || []).slice(0, limit).map((row) => {
    const { checks, ...rest } = row;
    return rest;
  });
}

function dashboardStats() {
  const store = readStore();
  const pending = store.approvals.filter((a) => a.status === 'pending').length;
  const approved = store.approvals.filter((a) => a.status === 'approved').length;
  const revisions = store.approvals.filter((a) => a.status === 'revision_requested').length;
  const byType = {};
  for (const a of store.approvals.filter((x) => x.status === 'pending')) {
    byType[a.type] = (byType[a.type] || 0) + 1;
  }
  const latestHealth = (store.siteHealthHistory && store.siteHealthHistory[0]) || null;
  return {
    pending,
    approved,
    revisions,
    totalBriefs: store.briefs.length,
    lastJobRun: store.jobRuns[0] || null,
    pendingByType: byType,
    siteHealth: latestHealth
      ? {
          healthy: latestHealth.healthy,
          at: latestHealth.at,
          errors404: latestHealth.errors404,
          errors502: latestHealth.errors502,
        }
      : null,
  };
}

function replaceAll(data) {
  writeStore({
    approvals: data.approvals || [],
    briefs: data.briefs || [],
    jobRuns: data.jobRuns || [],
    siteHealthHistory: data.siteHealthHistory || [],
    meta: { ...data.meta, version: 1 },
  });
}

module.exports = {
  uid,
  listApprovals,
  upsertApproval,
  updateApprovalStatus,
  updateApprovalMeta,
  updateApprovalPayload,
  getApproval,
  deleteApproval,
  addBrief,
  latestBrief,
  addJobRun,
  saveSiteHealthRun,
  getLatestSiteHealth,
  listSiteHealthHistory,
  dashboardStats,
  replaceAll,
  readStore,
};
