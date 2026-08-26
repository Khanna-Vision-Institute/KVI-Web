const { heritageFieldMap, pickZohoValue } = require('./fieldMapping');

/**
 * Zoho "Doctor Office" = Accounts. Doctor names often live in custom field Doctor_Names
 * (semicolon-separated), not as linked Contacts.
 */

function contactDisplayName(contact, f) {
  const fromField = pickZohoValue(contact, [f.contactName, 'Full_Name', 'Contact_Name']);
  if (fromField) return fromField;

  const first = pickZohoValue(contact, ['First_Name', 'first_name']);
  const last = pickZohoValue(contact, ['Last_Name', 'last_name']);
  return [first, last].filter(Boolean).join(' ').trim();
}

function formatAccountAddress(account, f) {
  const street = pickZohoValue(account, [f.address, 'Billing_Street', 'Shipping_Street', 'Address']);
  const city = pickZohoValue(account, [f.city, 'Billing_City', 'Shipping_City', 'City']);
  const state = pickZohoValue(account, [f.state, 'Billing_State', 'Shipping_State', 'State']);
  const zip = pickZohoValue(account, [f.zip, 'Billing_Code', 'Shipping_Code', 'ZIP', 'Zip_Code']);

  if (street && /\b\d{5}(-\d{4})?\b/.test(street)) return street;

  const tail = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if (street && tail) return `${street}, ${tail}`;
  return street || tail;
}

function doctorNameSlugKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Parse Zoho "Doctor Names" — "Dr. A; Dr. B" or newline-separated.
 * @param {Record<string, unknown>} account
 */
function parseAccountDoctorNames(account) {
  const f = heritageFieldMap();
  const raw = pickZohoValue(account, [
    f.doctorNames,
    'Doctor_Names',
    'Doctor_names',
    'Doctors_Names',
    f.doctor,
    'Doctor_Name',
  ]);
  if (!raw) return [];

  return raw
    .split(/[;\n]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} account
 * @param {Record<string, unknown>} [contact]
 * @param {{ doctorName?: string }} [opts]
 */
function accountContactToMasterRow(account, contact, opts = {}) {
  const f = heritageFieldMap();
  const accountId = pickZohoValue(account, ['id', 'Id']);
  const practice =
    pickZohoValue(account, [f.practice, 'Account_Name', 'Practice_Name', 'Name']) || '';

  const isContactRow = contact && typeof contact === 'object';
  const contactId = isContactRow ? pickZohoValue(contact, ['id', 'Id']) : '';

  let doctor = String(opts.doctorName || '').trim();
  if (!doctor && isContactRow) {
    doctor = contactDisplayName(contact, f);
  }
  if (!doctor) {
    doctor =
      pickZohoValue(account, [f.doctor, 'Doctor_Name', 'Primary_Contact', 'Contact_Name']) || '';
  }
  if (!doctor) {
    doctor = practice;
  }

  const phone =
    (isContactRow && pickZohoValue(contact, [f.phone, 'Phone', 'Mobile'])) ||
    pickZohoValue(account, [f.phone, 'Phone', 'Account_Phone']);

  const email =
    (isContactRow && pickZohoValue(contact, [f.email, 'Email'])) ||
    pickZohoValue(account, [f.email, 'Email']);

  const website = pickZohoValue(account, [f.website, 'Website']);
  const cred =
    (isContactRow && pickZohoValue(contact, [f.cred, 'Cred', 'Credentials', 'Title'])) ||
    pickZohoValue(account, [f.cred, 'Cred', 'Credentials']);

  const addressLine = formatAccountAddress(account, f);

  let zohoId = contactId || accountId;
  if (!contactId && accountId && opts.doctorName && doctor !== practice) {
    zohoId = `${accountId}:${doctorNameSlugKey(doctor)}`;
  }

  /** @type {Record<string, unknown>} */
  const row = {
    id: zohoId || undefined,
    zoho_id: zohoId || undefined,
    zoho_account_id: accountId || undefined,
    zoho_contact_id: contactId || undefined,
    'Practice Name': practice,
    'Doctor Name': doctor,
    Phone: phone,
    Cred: cred,
    Email: email,
    Website: website,
    Address: addressLine,
    City: pickZohoValue(account, [f.city, 'Billing_City', 'City']),
    ZIP: pickZohoValue(account, [f.zip, 'Billing_Code', 'Zip_Code']),
    'Lead Status': pickZohoValue(account, [f.leadStatus, 'Lead_Status', 'Account_Status']),
    Directory_Hub: pickZohoValue(account, [f.directoryHub, 'Directory_Hub']),
  };

  return row;
}

/**
 * @param {Record<string, unknown>} account
 * @param {Record<string, unknown>[]} contacts
 */
function rowsForAccount(account, contacts) {
  const doctorNames = parseAccountDoctorNames(account);

  // Prefer Zoho "Doctor Names" when it lists more ODs than linked Contacts (common in Doctor Office).
  if (doctorNames.length > 0 && doctorNames.length >= contacts.length) {
    return doctorNames.map((doctorName) => accountContactToMasterRow(account, null, { doctorName }));
  }

  if (contacts.length) {
    return contacts.map((contact) => accountContactToMasterRow(account, contact));
  }

  if (doctorNames.length) {
    return doctorNames.map((doctorName) => accountContactToMasterRow(account, null, { doctorName }));
  }

  return [accountContactToMasterRow(account)];
}

/**
 * @param {number} concurrency
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 * @template {unknown} T
 * @template {unknown} R
 */
async function mapWithConcurrency(concurrency, items, worker) {
  const limit = Math.max(1, Math.min(20, concurrency));
  /** @type {R[]} */
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await worker(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/**
 * @param {Record<string, unknown>[]} accounts
 * @param {(accountId: string) => Promise<Record<string, unknown>[]>} fetchContacts
 * @param {{ concurrency?: number }} [opts]
 */
async function expandAccountsToMasterRows(accounts, fetchContacts, opts = {}) {
  const concurrency = Number(opts.concurrency) || Number(process.env.ZOHO_HERITAGE_CONTACT_FETCH_CONCURRENCY) || 8;

  const validAccounts = accounts.filter((account) => account && typeof account === 'object');
  const expanded = await mapWithConcurrency(concurrency, validAccounts, async (account) => {
    const accountId = pickZohoValue(account, ['id', 'Id']);
    if (!accountId) return [];

    let contacts = [];
    try {
      contacts = await fetchContacts(accountId);
    } catch (err) {
      console.warn('[heritage-zoho-sync] Contacts fetch failed for account', accountId, err.message || err);
    }

    return rowsForAccount(account, contacts);
  });

  return expanded.flat();
}

module.exports = {
  expandAccountsToMasterRows,
  accountContactToMasterRow,
  parseAccountDoctorNames,
  rowsForAccount,
};
