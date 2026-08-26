/**
 * Zoho CRM field API names for the Heritage / OD master list module.
 * Override in .env if your org uses different API names (Setup → Module → Fields → API Name).
 */

function envField(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v).trim().toLowerCase() === 'true';
}

/** @param {Record<string, unknown>} record @param {string[]} keys */
function pickZohoValue(record, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function heritageFieldMap() {
  return {
    // Zoho "Doctor Office" = Accounts module (UI label). Account_Name is the practice/clinic card title.
    practice: envField('ZOHO_HERITAGE_FIELD_PRACTICE', 'Account_Name'),
    doctor: envField('ZOHO_HERITAGE_FIELD_DOCTOR', 'Doctor_Name'),
    // Semicolon-separated ODs on Doctor Office (Accounts), e.g. "Dr. A; Dr. B; Dr. C"
    doctorNames: envField('ZOHO_HERITAGE_FIELD_DOCTOR_NAMES', 'Doctor_Names'),
    contactName: envField('ZOHO_HERITAGE_FIELD_CONTACT_NAME', 'Full_Name'),
    phone: envField('ZOHO_HERITAGE_FIELD_PHONE', 'Phone'),
    cred: envField('ZOHO_HERITAGE_FIELD_CRED', 'Cred'),
    email: envField('ZOHO_HERITAGE_FIELD_EMAIL', 'Email'),
    website: envField('ZOHO_HERITAGE_FIELD_WEBSITE', 'Website'),
    address: envField('ZOHO_HERITAGE_FIELD_ADDRESS', 'Billing_Street'),
    city: envField('ZOHO_HERITAGE_FIELD_CITY', 'Billing_City'),
    state: envField('ZOHO_HERITAGE_FIELD_STATE', 'Billing_State'),
    zip: envField('ZOHO_HERITAGE_FIELD_ZIP', 'Billing_Code'),
    leadStatus: envField('ZOHO_HERITAGE_FIELD_LEAD_STATUS', 'Lead_Status'),
    directoryHub: envField('ZOHO_HERITAGE_FIELD_DIRECTORY_HUB', 'Directory_Hub'),
  };
}

/**
 * Normalize a Zoho CRM record into master-row shape used by referral-offices manifest builder.
 * @param {Record<string, unknown>} record
 */
function zohoRecordToMasterRow(record) {
  const f = heritageFieldMap();
  const id = pickZohoValue(record, ['id', 'Id']);

  /** @type {Record<string, unknown>} */
  const row = {
    id: id || undefined,
    zoho_id: id || undefined,
    'Practice Name': pickZohoValue(record, [f.practice, 'Practice_Name', 'Account_Name']),
    'Doctor Name': pickZohoValue(record, [f.doctor, 'Doctor_Name', 'Full_Name']),
    Phone: pickZohoValue(record, [f.phone, 'Phone']),
    Cred: pickZohoValue(record, [f.cred, 'Cred', 'Credentials']),
    Email: pickZohoValue(record, [f.email, 'Email']),
    Website: pickZohoValue(record, [f.website, 'Website']),
    Address: pickZohoValue(record, [f.address, 'Address', 'Billing_Street']),
    City: pickZohoValue(record, [f.city, 'City', 'Billing_City']),
    ZIP: pickZohoValue(record, [f.zip, 'ZIP', 'Billing_Code', 'Zip_Code']),
    'Lead Status': pickZohoValue(record, [f.leadStatus, 'Lead_Status']),
    Directory_Hub: pickZohoValue(record, [f.directoryHub, 'Directory_Hub']),
  };

  return row;
}

function isAccountsModule(moduleName) {
  return String(moduleName || '').trim().toLowerCase() === 'accounts';
}

function heritageSyncConfig() {
  return {
    enabled: String(process.env.HERITAGE_ZOHO_SYNC_ENABLED || '').trim().toLowerCase() === 'true',
    // Doctor Office in Zoho UI = Accounts API module
    module: envField('ZOHO_HERITAGE_CRM_MODULE', 'Accounts'),
    // Optional Zoho custom view id — omit if API returns invalid cvid (URL view id ≠ API cvid).
    customViewId: envField('ZOHO_HERITAGE_CRM_VIEW_ID', ''),
    leadStatusFilter: envField('ZOHO_HERITAGE_LEAD_STATUS', ''),
    // Default: every 6 hours (light on CPU). Override in .env — e.g. "0 3 * * *" for once daily.
    cron: envField('ZOHO_HERITAGE_SYNC_CRON', '0 */6 * * *'),
    secret: envField('ZOHO_HERITAGE_SYNC_SECRET', ''),
    directoryHubs: envField('ZOHO_HERITAGE_DIRECTORY_HUBS', 'HeritageFamily')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    expandAccountContacts: envBool('ZOHO_HERITAGE_EXPAND_CONTACTS', true),
    relatedContactsModule: envField('ZOHO_HERITAGE_RELATED_CONTACTS_MODULE', 'Contacts'),
  };
}

module.exports = {
  heritageFieldMap,
  pickZohoValue,
  zohoRecordToMasterRow,
  isAccountsModule,
  heritageSyncConfig,
};
