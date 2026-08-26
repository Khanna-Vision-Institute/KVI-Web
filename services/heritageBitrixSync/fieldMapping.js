/**
 * Bitrix24 Doctor Office (SPA entityTypeId 1038) → Heritage master-row mapping.
 * Field codes confirmed via crm.item.fields for entityTypeId=1038.
 */

function envField(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function envInt(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize Bitrix address UF values like "Whittier, CA 90601|;|982". */
function cleanBitrixAddress(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const primary = s.split('|;|')[0].trim();
  return primary || s;
}

function pick(record, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function bitrixHeritageFieldMap() {
  return {
    practice: envField('BITRIX_HERITAGE_FIELD_PRACTICE', 'title'),
    doctorNames: envField('BITRIX_HERITAGE_FIELD_DOCTOR_NAMES', 'ufCrm8_1786344267153'),
    phone: envField('BITRIX_HERITAGE_FIELD_PHONE', 'ufCrm8_1786344315335'),
    email: envField('BITRIX_HERITAGE_FIELD_EMAIL', 'ufCrm8_1786344562548'),
    specialty: envField('BITRIX_HERITAGE_FIELD_SPECIALTY', 'ufCrm8_1786344581285'),
    address: envField('BITRIX_HERITAGE_FIELD_ADDRESS', 'ufCrm8_1786344617459'),
    city: envField('BITRIX_HERITAGE_FIELD_CITY', 'ufCrm8_1786344334735'),
    state: envField('BITRIX_HERITAGE_FIELD_STATE', 'ufCrm8_1786344362910'),
    zip: envField('BITRIX_HERITAGE_FIELD_ZIP', 'ufCrm8_1786344373681'),
    doctorCount: envField('BITRIX_HERITAGE_FIELD_DOCTOR_COUNT', 'ufCrm8_1786344906892'),
  };
}

/**
 * Parse "Dr. A; Dr. B" doctor names from a Bitrix Doctor Office item.
 * @param {Record<string, unknown>} item
 */
function parseBitrixDoctorNames(item) {
  const f = bitrixHeritageFieldMap();
  const raw = pick(item, [f.doctorNames]);
  if (!raw) return [];
  return raw
    .split(/[;\n]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Expand one Bitrix Doctor Office item into one master row per doctor
 * (same shape Zoho heritage sync feeds into rebuildManifestFromRows).
 * @param {Record<string, unknown>} item
 * @returns {Record<string, unknown>[]}
 */
function bitrixItemToMasterRows(item) {
  const f = bitrixHeritageFieldMap();
  const id = pick(item, ['id', 'ID']);
  const practice = pick(item, [f.practice, 'title', 'Title']) || '';
  const phone = pick(item, [f.phone]);
  const email = pick(item, [f.email]);
  const specialty = pick(item, [f.specialty]);
  const addressRaw = pick(item, [f.address]);
  const address = cleanBitrixAddress(addressRaw);
  const city = pick(item, [f.city]);
  const state = pick(item, [f.state]);
  const zip = pick(item, [f.zip]);

  let doctors = parseBitrixDoctorNames(item);
  if (!doctors.length) {
    // Fallback: practice-only card still needs a doctor slot for the directory
    doctors = [practice];
  }

  return doctors.map((doctor, idx) => {
    /** @type {Record<string, unknown>} */
    const row = {
      id: id ? `bitrix:${id}:${idx}` : undefined,
      zoho_id: id ? `bitrix:${id}:${idx}` : undefined,
      bitrix_id: id || undefined,
      'Practice Name': practice,
      'Doctor Name': doctor,
      Phone: phone,
      Email: email,
      Cred: specialty,
      Address: address,
      City: city,
      State: state,
      ZIP: zip,
    };
    return row;
  });
}

function heritageBitrixSyncConfig() {
  const webhookUrl = envField('BITRIX_WEBHOOK_URL', '');
  return {
    enabled: String(process.env.HERITAGE_BITRIX_SYNC_ENABLED || '').trim().toLowerCase() === 'true',
    webhookUrl: webhookUrl.replace(/\/?$/, '/'),
    entityTypeId: envInt('HERITAGE_BITRIX_ENTITY_TYPE_ID', 1038),
    // Default every 6 hours — same cadence as Zoho heritage sync
    cron: envField('HERITAGE_BITRIX_SYNC_CRON', '0 */6 * * *'),
    secret: envField('HERITAGE_BITRIX_SYNC_SECRET', ''),
    directoryHubs: envField('HERITAGE_BITRIX_DIRECTORY_HUBS', 'HeritageFamily')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    pageSize: envInt('HERITAGE_BITRIX_PAGE_SIZE', 50),
  };
}

module.exports = {
  envField,
  bitrixHeritageFieldMap,
  cleanBitrixAddress,
  parseBitrixDoctorNames,
  bitrixItemToMasterRows,
  heritageBitrixSyncConfig,
};
