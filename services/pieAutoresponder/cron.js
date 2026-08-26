const cron = require('node-cron');
const { startNurtureAutoresponderCron } = require('../nurtureAutoresponder/cron');

/** @deprecated use nurtureAutoresponder/cron */
function startPieAutoresponderCron() {
  startNurtureAutoresponderCron();
}

module.exports = { startPieAutoresponderCron };
