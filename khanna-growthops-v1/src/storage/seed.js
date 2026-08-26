#!/usr/bin/env node
const { replaceAll } = require('./store');

async function main() {
  replaceAll({ approvals: [], briefs: [], jobRuns: [], meta: { seededAt: new Date().toISOString() } });
  console.log('[growthops] Store cleared — use dashboard Generate buttons to create drafts.');
  console.log('[growthops] Open http://localhost:8080');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
