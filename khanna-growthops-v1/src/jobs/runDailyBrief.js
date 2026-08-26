#!/usr/bin/env node
const { runDailyGrowthBrief } = require('./dailyGrowthBrief');

runDailyGrowthBrief({ source: 'cli' })
  .then((r) => {
    console.log('[growthops] Daily cycle complete:', r.run.id, 'approvals:', r.approvals.length);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
