/**
 * Legacy daily job hook — disabled by default.
 * Blog, SEO, and email drafts are created only via dashboard Generate buttons
 * (POST /api/blog/generate, /api/seo/generate, /api/newsletter/generate).
 */
async function runDailyGrowthBrief(opts = {}) {
  console.log(
    `[growthops] runDailyGrowthBrief skipped (source=${opts.source || 'unknown'}) — use dashboard Generate buttons`
  );
  return { skipped: true, reason: 'manual_generation_only' };
}

module.exports = { runDailyGrowthBrief };
