/**
 * Safe entry point: never throws during require(). Autoresponder is OFF unless
 * PIE_AUTORESPONDER_ENABLED=true in .env (after Twilio/VAPI are configured).
 */

function isPieAutoresponderEnabled() {
  return String(process.env.PIE_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';
}

function loadEnrollModule() {
  // eslint-disable-next-line global-require
  return require('./enroll');
}

/**
 * Fire-and-forget after a successful PIE booking. Never rejects to caller.
 * @param {object} lead
 */
function schedulePieAutoresponderForLead(lead) {
  if (!isPieAutoresponderEnabled()) {
    return;
  }

  setImmediate(() => {
    (async () => {
      try {
        const { enrollPieStage1Autoresponder } = loadEnrollModule();
        const result = await enrollPieStage1Autoresponder(lead);
        if (result.skipped) {
          console.log(
            `[pie-autoresponder] enroll skipped: ${result.reason} email=${lead.email || ''}`
          );
        } else {
          console.log(
            `[pie-autoresponder] enroll ok: id=${result.enrollmentId} jobs=${result.jobs} email=${lead.email || ''}`
          );
        }
      } catch (err) {
        console.error(
          '[pie-autoresponder] enroll failed (booking already succeeded):',
          err.message || err
        );
      }
    })();
  });
}

function startCronIfEnabled() {
  const pieOn = isPieAutoresponderEnabled();
  const smileOn =
    String(process.env.SMILE_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';
  const pteryOn =
    String(process.env.PTERYGIUM_AUTORESPONDER_ENABLED || '').trim().toLowerCase() === 'true';

  if (!pieOn && !smileOn && !pteryOn) {
    console.log(
      '[nurture-autoresponder] Off — enable PIE_AUTORESPONDER_ENABLED, SMILE_AUTORESPONDER_ENABLED, and/or PTERYGIUM_AUTORESPONDER_ENABLED.'
    );
    return;
  }

  try {
    require('../nurtureAutoresponder/cron').startNurtureAutoresponderCron();
  } catch (err) {
    console.error('[nurture-autoresponder] Cron did not start:', err.message || err);
  }
}

module.exports = {
  isPieAutoresponderEnabled,
  schedulePieAutoresponderForLead,
  startCronIfEnabled
};
