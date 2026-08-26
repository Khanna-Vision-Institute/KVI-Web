const cron = require('node-cron');

let started = false;

function isPieEnabled() {
  return String(process.env.PIE_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';
}

function isSmileEnabled() {
  return String(process.env.SMILE_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';
}

function isPterygiumEnabled() {
  return String(process.env.PTERYGIUM_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';
}

function isAnyNurtureEnabled() {
  return isPieEnabled() || isSmileEnabled() || isPterygiumEnabled();
}

function startNurtureAutoresponderCron() {
  if (started) return;
  if (!isAnyNurtureEnabled()) return;

  started = true;
  const expr =
    process.env.NURTURE_AUTORESPONDER_CRON ||
    process.env.PIE_AUTORESPONDER_CRON ||
    '*/5 * * * *';

  if (!cron.validate(expr)) {
    console.error('[nurture-autoresponder] Invalid cron expression:', expr);
    return;
  }

  cron.schedule(expr, () => {
    const tasks = [];
    if (isPieEnabled()) {
      tasks.push(
        require('../pieAutoresponder/enroll')
          .processDuePieJobs()
          .catch((err) => console.error('[pie-autoresponder] cron:', err.message || err))
      );
    }
    if (isSmileEnabled()) {
      tasks.push(
        require('../smileAutoresponder/enroll')
          .processDueSmileJobs()
          .catch((err) => console.error('[smile-autoresponder] cron:', err.message || err))
      );
    }
    if (isPterygiumEnabled()) {
      tasks.push(
        require('../pterygiumAutoresponder/enroll')
          .processDuePterygiumJobs()
          .catch((err) => console.error('[pterygium-autoresponder] cron:', err.message || err))
      );
    }
    return Promise.all(tasks);
  });

  console.log('[nurture-autoresponder] Cron running:', expr, {
    pie: isPieEnabled(),
    smile: isSmileEnabled(),
    pterygium: isPterygiumEnabled()
  });
}

module.exports = {
  startNurtureAutoresponderCron,
  isAnyNurtureEnabled,
  isSmileEnabled,
  isPterygiumEnabled
};
