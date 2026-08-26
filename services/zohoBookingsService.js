/**
 * Zoho Bookings — create appointments when site forms submit (CRM + email unchanged).
 *
 * Enable: ZOHO_BOOKINGS_ENABLED=true
 * OAuth: add scope zohobookings.data.CREATE (and READ for setup script) to your Zoho refresh token.
 *
 * Map services/staff: ZOHO_BOOKINGS_SERVICE_MAP (JSON) — see scripts/zoho-bookings-list-ids.js
 */
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');
const zohoService = require('./zohoService');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BOOKINGS_BASE = '/bookings/v1/json';
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function truthyEnv(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function parseServiceMap() {
  const raw = String(process.env.ZOHO_BOOKINGS_SERVICE_MAP || '').trim();
  if (!raw) return { sources: {}, locations: {} };
  try {
    const parsed = JSON.parse(raw);
    return {
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
      locations: parsed.locations && typeof parsed.locations === 'object' ? parsed.locations : {}
    };
  } catch (err) {
    console.error('[zoho-bookings] Invalid ZOHO_BOOKINGS_SERVICE_MAP JSON:', err.message);
    return { sources: {}, locations: {} };
  }
}

/** @param {string} inputDate MM/DD/YYYY or YYYY-MM-DD */
function parseDateToIso(inputDate) {
  const raw = String(inputDate || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!mdY) return null;
  const mm = Number(mdY[1]);
  const dd = Number(mdY[2]);
  const yy = Number(mdY[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const test = new Date(Date.UTC(yy, mm - 1, dd));
  if (test.getUTCFullYear() !== yy || test.getUTCMonth() !== mm - 1 || test.getUTCDate() !== dd) {
    return null;
  }
  return (
    String(yy).padStart(4, '0') +
    '-' +
    String(mm).padStart(2, '0') +
    '-' +
    String(dd).padStart(2, '0')
  );
}

/** Doctor portal half-day preferences → representative slot for Zoho */
const HALF_DAY_TIME_ALIASES = {
  'morning (8 am – 12 pm)': '9:00 AM',
  'morning (8 am - 12 pm)': '9:00 AM',
  'afternoon (12 pm – 4 pm)': '1:00 PM',
  'afternoon (12 pm - 4 pm)': '1:00 PM',
  'late afternoon (4 pm – 6 pm)': '4:00 PM',
  'late afternoon (4 pm - 6 pm)': '4:00 PM'
};

function normalizeTimeLabel(timeLabel) {
  const time = String(timeLabel || '').trim();
  if (!time) return '';
  const key = time.toLowerCase().replace(/\s+/g, ' ');
  return HALF_DAY_TIME_ALIASES[key] || time;
}

/** Site slot label → Zoho from_time (dd-MMM-yyyy HH:mm:ss) */
function formatZohoFromTime(dateIso, timeLabel) {
  const iso = parseDateToIso(dateIso);
  const time = normalizeTimeLabel(timeLabel);
  if (!iso || !time) return null;

  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const [yy, mm, dd] = iso.split('-').map(Number);
  const monthLabel = MONTH_LABELS[mm - 1];
  if (!monthLabel) return null;

  const dayStr = String(dd).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');
  return `${dayStr}-${monthLabel}-${yy} ${hourStr}:${minute}:00`;
}

function normalizeLocationKey(location) {
  const loc = String(location || '').trim();
  if (!loc || loc.toLowerCase() === 'either') return 'default';
  return loc;
}

const KNOWN_CLINIC_LOCATIONS = ['Beverly Hills', 'Westlake Village'];
const DEFAULT_INTAKE_TIME = '9:00 AM';

/** Next weekday (Mon–Fri) in ZOHO_BOOKINGS_TIMEZONE as YYYY-MM-DD */
function getNextBusinessDayIso() {
  const tz = String(process.env.ZOHO_BOOKINGS_TIMEZONE || 'America/Los_Angeles').trim();
  const now = new Date();
  for (let add = 0; add < 14; add += 1) {
    const d = new Date(now.getTime() + add * 86400000);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }).formatToParts(d);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day && weekday !== 'Sat' && weekday !== 'Sun') {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

/** @param {string[]} preferredLocations */
function pickReferralLocation(preferredLocations) {
  const list = Array.isArray(preferredLocations) ? preferredLocations : [];
  for (const known of KNOWN_CLINIC_LOCATIONS) {
    if (list.some((l) => String(l).trim() === known)) return known;
  }
  if (list.length) return String(list[0]).trim();
  return 'default';
}

/**
 * Resolve date/time for Zoho Bookings (optional placeholder for referral intakes).
 * @returns {{ dateIso: string, timeLabel: string, placeholder: boolean } | null}
 */
function resolveIntakeSlot({ date, time, allowPlaceholder = false }) {
  const dateIso = parseDateToIso(date);
  const rawTime = String(time || '').trim();
  const noPreference = !rawTime || /^no preference$/i.test(rawTime);
  const normalizedTime = noPreference ? '' : normalizeTimeLabel(rawTime);

  if (dateIso && normalizedTime) {
    if (formatZohoFromTime(dateIso, normalizedTime)) {
      return { dateIso, timeLabel: normalizedTime, placeholder: false };
    }
  }

  if (dateIso && (noPreference || !normalizedTime)) {
    if (formatZohoFromTime(dateIso, DEFAULT_INTAKE_TIME)) {
      return { dateIso, timeLabel: DEFAULT_INTAKE_TIME, placeholder: true };
    }
  }

  if (allowPlaceholder) {
    const next = getNextBusinessDayIso();
    if (next && formatZohoFromTime(next, DEFAULT_INTAKE_TIME)) {
      return { dateIso: next, timeLabel: DEFAULT_INTAKE_TIME, placeholder: true };
    }
  }

  return null;
}

function resolveSourceKey(pageUrl) {
  const p = String(pageUrl || '').trim();
  if (!p) return 'main';
  if (p.includes('smile-book-consultation')) return 'smile';
  if (p.includes('Doctorportal/book-consultation') || p.includes('/Doctorportal/')) return 'doctor-portal';
  if (p.startsWith('Chat Widget')) return 'widget';
  if (p === 'Voice/Phone (Guru AI)') return 'widget';
  return 'main';
}

function pickIds(entry, fallbackServiceId, fallbackStaffId) {
  if (!entry || typeof entry !== 'object') {
    return {
      serviceId: fallbackServiceId || '',
      staffId: fallbackStaffId || ''
    };
  }
  return {
    serviceId: String(entry.service_id || entry.serviceId || fallbackServiceId || '').trim(),
    staffId: String(entry.staff_id || entry.staffId || fallbackStaffId || '').trim()
  };
}

function resolveBookingTarget({ source, location }) {
  const map = parseServiceMap();
  const defaultServiceId = String(process.env.ZOHO_BOOKINGS_DEFAULT_SERVICE_ID || '').trim();
  const defaultStaffId = String(process.env.ZOHO_BOOKINGS_DEFAULT_STAFF_ID || '').trim();

  const locKey = normalizeLocationKey(location);
  const locEntry = map.locations[locKey] || map.locations.default;
  const srcEntry = map.sources[source] || map.sources.main;

  const fromLocation = pickIds(locEntry, defaultServiceId, defaultStaffId);
  if (fromLocation.serviceId) return { ...fromLocation, source, location: locKey };

  const fromSource = pickIds(srcEntry, defaultServiceId, defaultStaffId);
  return { ...fromSource, source, location: locKey };
}

class ZohoBookingsService {
  isEnabled() {
    return truthyEnv('ZOHO_BOOKINGS_ENABLED');
  }

  bookingsApiUrl(fragment) {
    const apiDomain = (zohoService.apiDomain || process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(
      /\/$/,
      ''
    );
    return `${apiDomain}${BOOKINGS_BASE}${fragment}`;
  }

  async getAccessToken() {
    return zohoService.getAccessToken();
  }

  /**
   * Create a Zoho Bookings appointment (non-throwing for route handlers).
   * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, booking?: object, error?: string }>}
   */
  async syncConsultBooking(opts = {}) {
    if (!this.isEnabled()) {
      return { ok: false, skipped: true, reason: 'disabled' };
    }

    const {
      fullName,
      email,
      phone,
      location,
      date,
      time,
      notes,
      additionalFields,
      pageUrl,
      source: sourceOverride,
      allowPlaceholderIntake = false
    } = opts;

    const slot = resolveIntakeSlot({
      date,
      time,
      allowPlaceholder: allowPlaceholderIntake
    });
    if (!slot) {
      return { ok: false, skipped: true, reason: 'missing_or_invalid_datetime' };
    }

    const fromTime = formatZohoFromTime(slot.dateIso, slot.timeLabel);
    if (!fromTime) {
      return { ok: false, skipped: true, reason: 'missing_or_invalid_datetime' };
    }

    const source = sourceOverride || resolveSourceKey(pageUrl);
    const { serviceId, staffId } = resolveBookingTarget({ source, location });

    if (!serviceId) {
      console.warn('[zoho-bookings] No service_id mapped for source=%s location=%s', source, location);
      return { ok: false, skipped: true, reason: 'no_service_mapping' };
    }

    const customerName = String(fullName || '').trim() || 'Guest';
    const customerEmail = String(email || '').trim();
    if (!customerEmail) {
      return { ok: false, skipped: true, reason: 'missing_email' };
    }

    const customerDetails = {
      name: customerName,
      email: customerEmail,
      phone_number: String(phone || '').trim() || undefined
    };
    if (!customerDetails.phone_number) delete customerDetails.phone_number;

    const timezone = String(process.env.ZOHO_BOOKINGS_TIMEZONE || 'America/Los_Angeles').trim();
    const form = new URLSearchParams();
    form.set('service_id', serviceId);
    if (staffId) form.set('staff_id', staffId);
    form.set('from_time', fromTime);
    form.set('timezone', timezone);
    form.set('customer_details', JSON.stringify(customerDetails));

    const noteLines = [];
    noteLines.push(
      `Clinic time (Pacific): ${slot.dateIso} ${slot.timeLabel} — timezone sent to Zoho: ${timezone}`
    );
    if (notes) noteLines.push(String(notes).trim());
    if (pageUrl) noteLines.push(`Submitted from: ${pageUrl}`);
    if (location) noteLines.push(`Location: ${location}`);
    if (slot.placeholder) {
      noteLines.push(
        'Placeholder intake slot (9:00 AM) — confirm actual appointment date/time with patient.'
      );
      if (time && String(time).trim()) {
        noteLines.push(`Preferred window requested: ${String(time).trim()}`);
      }
    } else if (time && normalizeTimeLabel(time) !== String(time).trim()) {
      noteLines.push(`Preferred window: ${String(time).trim()}`);
    }
    noteLines.push(`KVI source: ${source}`);
    if (noteLines.length) form.set('notes', noteLines.join('\n'));

    const extra =
      additionalFields && typeof additionalFields === 'object' ? additionalFields : {};
    if (Object.keys(extra).length) form.set('additional_fields', JSON.stringify(extra));

    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.post(this.bookingsApiUrl('/appointment'), form.toString(), {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        validateStatus: () => true,
        timeout: 30000
      });

      const body = response.data || {};
      const status = body.response && body.response.status;
      const returnvalue = body.response && body.response.returnvalue;

      if (response.status >= 400 || status !== 'success') {
        const errMsg =
          (body.response && body.response.message) ||
          (body.message) ||
          JSON.stringify(body).slice(0, 500);
        console.error('[zoho-bookings] API error:', response.status, errMsg);
        return { ok: false, error: errMsg };
      }

      console.log(
        '[zoho-bookings] Appointment created:',
        returnvalue && returnvalue.booking_id ? returnvalue.booking_id : 'ok'
      );
      return { ok: true, booking: returnvalue || body };
    } catch (err) {
      const msg = err.response?.data
        ? JSON.stringify(err.response.data).slice(0, 500)
        : err.message || String(err);
      console.error('[zoho-bookings] Request failed:', msg);
      return { ok: false, error: msg };
    }
  }

  /** dd-MMM-yyyy for availableslots API */
  formatZohoSelectedDate(dateIso) {
    const iso = parseDateToIso(dateIso);
    if (!iso) return null;
    const [yy, mm, dd] = iso.split('-').map(Number);
    const monthLabel = MONTH_LABELS[mm - 1];
    if (!monthLabel) return null;
    return `${String(dd).padStart(2, '0')}-${monthLabel}-${yy}`;
  }

  /** Zoho slot label "10:00" or "10:00 AM" → site time label for from_time */
  normalizeSlotToTimeLabel(slot) {
    const s = String(slot || '').trim();
    if (!s) return '';
    if (/AM|PM/i.test(s)) return normalizeTimeLabel(s);
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return normalizeTimeLabel(s);
    let hour = parseInt(m[1], 10);
    const minute = m[2];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
  }

  /** Referral worksheet inline scheduler — prefer embed service id from env */
  resolveReferralScheduleTarget(location) {
    const referralServiceId = String(
      process.env.ZOHO_BOOKINGS_REFERRAL_SCHEDULE_SERVICE_ID || '4942730000000051385'
    ).trim();
    const referralStaffOverride = String(
      process.env.ZOHO_BOOKINGS_REFERRAL_SCHEDULE_STAFF_ID || ''
    ).trim();
    const mapped = resolveBookingTarget({ source: 'doctor-portal', location });
    return {
      serviceId: referralServiceId || mapped.serviceId,
      staffId: referralStaffOverride || mapped.staffId
    };
  }

  /**
   * @returns {Promise<{ ok: boolean, slots?: string[], timezone?: string, error?: string, reason?: string }>}
   */
  async fetchAvailableSlots({ serviceId, staffId, dateIso }) {
    if (!this.isEnabled()) {
      return { ok: false, reason: 'disabled' };
    }
    const selectedDate = this.formatZohoSelectedDate(dateIso);
    if (!serviceId || !staffId || !selectedDate) {
      return { ok: false, reason: 'invalid_params' };
    }

    try {
      const accessToken = await this.getAccessToken();
      const q = new URLSearchParams({
        service_id: serviceId,
        staff_id: staffId,
        selected_date: selectedDate
      });
      const response = await axios.get(`${this.bookingsApiUrl('/availableslots')}?${q.toString()}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        validateStatus: () => true,
        timeout: 30000
      });

      const body = response.data || {};
      const status = body.response && body.response.status;
      const returnvalue = body.response && body.response.returnvalue;

      if (response.status >= 400 || status !== 'success') {
        const errMsg =
          (body.response && body.response.message) ||
          body.message ||
          JSON.stringify(body).slice(0, 500);
        return { ok: false, error: errMsg };
      }

      const data = returnvalue && returnvalue.data;
      const slots = Array.isArray(data) ? data.map((s) => String(s).trim()).filter(Boolean) : [];
      return {
        ok: true,
        slots,
        timezone: returnvalue && returnvalue.time_zone ? String(returnvalue.time_zone) : ''
      };
    } catch (err) {
      const msg = err.response?.data
        ? JSON.stringify(err.response.data).slice(0, 500)
        : err.message || String(err);
      return { ok: false, error: msg };
    }
  }

  /** CLI / setup: list workspaces */
  async fetchWorkspaces() {
    const accessToken = await this.getAccessToken();
    const response = await axios.get(this.bookingsApiUrl('/workspaces'), {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      validateStatus: () => true
    });
    return response.data;
  }

  /** CLI / setup: list services for workspace_id */
  async fetchServices(workspaceId) {
    const accessToken = await this.getAccessToken();
    const url = `${this.bookingsApiUrl('/services')}?workspace_id=${encodeURIComponent(workspaceId)}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      validateStatus: () => true
    });
    return response.data;
  }
}

const zohoBookingsService = new ZohoBookingsService();
zohoBookingsService.pickReferralLocation = pickReferralLocation;
zohoBookingsService.resolveIntakeSlot = resolveIntakeSlot;

module.exports = zohoBookingsService;
module.exports.parseDateToIso = parseDateToIso;
module.exports.formatZohoFromTime = formatZohoFromTime;
module.exports.resolveSourceKey = resolveSourceKey;
module.exports.pickReferralLocation = pickReferralLocation;
module.exports.resolveIntakeSlot = resolveIntakeSlot;
