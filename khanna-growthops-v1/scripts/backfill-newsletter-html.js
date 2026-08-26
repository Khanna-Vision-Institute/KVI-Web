#!/usr/bin/env node
'use strict';

const store = require('../src/storage/store');
const { ensureNewsletterHtml } = require('../src/agents/newsletterHtml');

const items = store.listApprovals().filter((i) => i.type === 'newsletter_draft');
let updated = 0;

for (const item of items) {
  if (item.payload && item.payload.htmlDocument && process.argv[2] !== '--force') continue;
  const payload = ensureNewsletterHtml(
    process.argv[2] === '--force'
      ? { ...(item.payload || {}), htmlDocument: null }
      : (item.payload || {})
  );
  store.updateApprovalPayload(item.id, { htmlDocument: payload.htmlDocument });
  updated += 1;
  console.log(`[backfill] ${item.id} — ${payload.htmlDocument.length} chars`);
}

console.log(`[backfill] done — ${updated} of ${items.length} newsletter drafts updated`);
