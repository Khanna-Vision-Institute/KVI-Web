/**
 * Maps book-consultation / booking API payloads → Zoho Leads custom fields.
 * API names must match Zoho (Setup → Modules → Leads → field → API Name).
 * Override via .env if your org uses different API names.
 */

function envField(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function parsePreferredDateForZoho(dateStr) {
  const s = String(dateStr || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, '0');
  const dd = m[2].padStart(2, '0');
  return `${m[3]}-${mm}-${dd}`;
}

function isPieBooking({ surgeryExamType, pageUrl }) {
  const proc = String(surgeryExamType || '').trim();
  const url = String(pageUrl || '').toLowerCase();
  return proc === 'PIE' || url.includes('/procedures/lens-solutions/pie');
}

/**
 * @param {{
 *   surgeryExamType?: string,
 *   pageUrl?: string,
 *   date?: string,
 *   time?: string,
 *   smsOptIn?: boolean,
 *   emailOptIn?: boolean
 * }} input
 * @returns {Record<string, string | boolean>}
 */
function buildBookingZohoCustomFields(input = {}) {
  const fields = {};

  const procedureKey = envField('ZOHO_FIELD_PROCEDURE_INTERESTED', 'Procedure_Interested');
  const stageKey = envField('ZOHO_FIELD_AUTORESPONDER_STAGE', 'Autoresponder_Stage');
  const pageUrlKey = envField('ZOHO_FIELD_LEAD_PAGE_URL', 'Lead_Page_URL');
  const smsKey = envField('ZOHO_FIELD_SMS_OPT_IN', 'SMS_Opt_In');
  const emailKey = envField('ZOHO_FIELD_EMAIL_OPT_IN', 'Email_Opt_In');
  const consultBookedKey = envField('ZOHO_FIELD_CONSULT_BOOKED', 'Consult_Booked');

  const procedure = String(input.surgeryExamType || '').trim();
  if (procedure) {
    fields[procedureKey] = procedure;
  }

  const pageUrl = String(input.pageUrl || '').trim();
  if (pageUrl) {
    fields[pageUrlKey] = pageUrl;
  }

  const consultDate = parsePreferredDateForZoho(input.date);
  if (consultDate) {
    fields[consultBookedKey] = consultDate;
  }

  // Form requires SMS consent checkbox — default both opt-ins on successful submit.
  const smsOn = input.smsOptIn !== false;
  const emailOn = input.emailOptIn !== false;
  fields[smsKey] = smsOn;
  fields[emailKey] = emailOn;

  if (isPieBooking(input)) {
    const stage1 = envField('ZOHO_PIE_AUTORESPONDER_STAGE_VALUE', 'Stage 1');
    if (stage1) {
      fields[stageKey] = stage1;
    }
  }

  return fields;
}

function resolveBookingLeadSource({ surgeryExamType, pageUrl }) {
  if (isPieBooking({ surgeryExamType, pageUrl })) {
    return process.env.ZOHO_PIE_LEAD_SOURCE || 'PIE Book Consultation';
  }
  const proc = String(surgeryExamType || '').trim();
  if (proc === 'SMILE') {
    return process.env.ZOHO_SMILE_LEAD_SOURCE || 'SMILE Book Consultation';
  }
  return process.env.ZOHO_BOOKING_LEAD_SOURCE || 'Website Booking';
}

module.exports = {
  buildBookingZohoCustomFields,
  resolveBookingLeadSource,
  isPieBooking,
  parsePreferredDateForZoho
};
