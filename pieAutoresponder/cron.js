const cron = require('node-cron');
const { processDuePieJobs } = require('./enroll');

let started = false;

function startPieAutoresponderCron() {
  if (started) return;
  if (process.env.PIE_AUTORESPONDER_ENABLED === 'false') {
    console.log('[pie-autoresponder] cron disabled (PIE_AUTORESPONDER_ENABLED=false)');
    return;
  }

  started = true;
  cron.schedule('* * * * *', () => {
    processDuePieJobs().catch((err) => {
      console.error('[pie-autoresponder] cron error:', err.message);
    });
  });

  console.log('[pie-autoresponder] cron started (every minute)');
}

module.exports = { startPieAutoresponderCron };
