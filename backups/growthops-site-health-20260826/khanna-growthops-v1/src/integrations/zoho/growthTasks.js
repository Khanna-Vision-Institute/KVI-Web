const config = require('../../config');
const { getZohoAccessToken, apiHost } = require('./auth');

// Phase 6 — OPTIONAL Zoho write-back. DISABLED unless ZOHO_WRITE_ENABLED=true.
// Creates a CRM Task when an item is approved. Never blocks or fails the approval:
// any problem here is logged as a warning and swallowed.

/**
 * Create a Growth Task in Zoho CRM for an approved item.
 * No-op (returns { skipped: true }) unless ZOHO_WRITE_ENABLED=true and Zoho is configured.
 * @param {object} approvalItem the approved approval-queue row
 * @returns {Promise<{ created?: boolean, id?: string, skipped?: boolean, reason?: string }>}
 */
async function createGrowthTask(approvalItem) {
  if (!config.zoho.writeEnabled) {
    return { skipped: true, reason: 'ZOHO_WRITE_ENABLED is false' };
  }
  if (!config.integrationsEnabled.zoho) {
    console.warn('[growthops] Zoho write-back enabled but Zoho credentials are missing — skipping task creation');
    return { skipped: true, reason: 'zoho not configured' };
  }

  try {
    const token = await getZohoAccessToken();
    const subject = `GrowthOps: ${approvalItem.title || approvalItem.type || 'Approved item'}`.slice(0, 250);

    const record = {
      Subject: subject,
      Status: 'Not Started', // CRM task status; "Approved" is captured in Description
      Description:
        `Approved in GrowthOps v1.\n` +
        `Approval ID: ${approvalItem.id}\n` +
        `Type: ${approvalItem.type}\n` +
        `Approval status: Approved\n` +
        (approvalItem.assignee ? `Assignee: ${approvalItem.assignee}\n` : ''),
    };
    if (config.zoho.tasksOwnerId) record.Owner = config.zoho.tasksOwnerId;

    const res = await fetch(`${apiHost(config.zoho.dc)}/crm/v6/Tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [record] }),
    });
    const data = await res.json().catch(() => ({}));
    const row = data && Array.isArray(data.data) && data.data[0];
    if (!res.ok || !row || row.code !== 'SUCCESS') {
      const detail = (row && (row.message || row.code)) || `HTTP ${res.status}`;
      console.warn(`[growthops] Zoho task creation failed (${detail}) — approval still succeeded`);
      return { created: false, reason: detail };
    }
    const id = row.details && row.details.id;
    console.log(`[growthops] Created Zoho Growth Task ${id} for approval ${approvalItem.id}`);
    return { created: true, id };
  } catch (err) {
    console.warn(`[growthops] Zoho task creation error (${err.message}) — approval still succeeded`);
    return { created: false, reason: err.message };
  }
}

module.exports = { createGrowthTask };
