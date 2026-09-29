# Heritage Family — automatic Zoho CRM sync

When enabled, the server keeps **`/HeritageFamily`** in sync with your Zoho CRM **Doctor Office** list. Add or update a practice/doctor in Zoho → on the cron schedule (default **every 6 hours**) or **immediately via webhook** the public directory updates — no manual JSON export.

## Your Zoho setup (from CRM)

| What you see in Zoho | Technical name |
|----------------------|----------------|
| **Doctor Office** (left menu) | **`Accounts`** module (renamed in UI) |
| Kanban view in your screenshot | Custom view id **`732354300000087515`** |
| Practice cards (e.g. Wallis Family Eyecare Optometry) | **`Account_Name`** on each Account |
| Individual ODs | **Contacts** linked to each Account |

The sync pulls every Account in that Doctor Office view, then expands linked **Contacts** into one Heritage row per doctor (OD tab). **MD/DO physicians are kept separately** — they come from `data/heritage-mdvip-physicians.json` and are re-merged after every Zoho sync (they are not stored in Zoho Doctor Office).

## One-time server setup

Add to production `.env` (next to `server.js`):

```env
HERITAGE_ZOHO_SYNC_ENABLED=true
ZOHO_HERITAGE_CRM_MODULE=Accounts
# ZOHO_HERITAGE_CRM_VIEW_ID=   # optional — leave blank if Zoho returns invalid cvid
ZOHO_HERITAGE_EXPAND_CONTACTS=true
ZOHO_HERITAGE_SYNC_CRON=0 */6 * * *
ZOHO_HERITAGE_SYNC_SECRET=your-long-random-secret
```

`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` must already work. OAuth scope must include **Accounts** and **Contacts** read access (`ZohoCRM.modules.ALL` is fine).

Restart PM2 once after editing `.env`.

## How it works

1. Cron (default every **6 hours**) fetches Accounts from the Doctor Office view.
2. For each Account, linked **Contacts** become directory rows (practice + doctor name).
3. **`data/referral-offices.json`** is rewritten; the server reloads it **without** `pm2 restart`.
4. Optional Zoho **workflow webhook** on Account create/edit triggers sync immediately.

Worksheet URLs are preserved when a row matches by Zoho id or practice + doctor name.

## Zoho workflow webhook (instant updates)

1. Zoho CRM → **Settings → Automation → Workflow Rules**
2. Module = **Doctor Office** (Accounts)
3. When = **Create** or **Edit**
4. Action = **Webhook** → **POST**
5. URL:

   `https://khannainstitute.com/api/internal/heritage-zoho-sync/webhook`

6. Header: `Authorization: Bearer YOUR_ZOHO_HERITAGE_SYNC_SECRET`

Repeat for **Contacts** if doctor details are edited on the contact record (not only the Account).

## Probe / manual test

```bash
cd "/path/to/kvi home"
npm run sync:heritage-zoho -- --probe
npm run sync:heritage-zoho
```

```bash
# Starts sync in background (returns in ~1s — avoids gateway 504 timeouts)
curl -sS -X POST \
  -H "Authorization: Bearer YOUR_ZOHO_HERITAGE_SYNC_SECRET" \
  https://khannainstitute.com/api/internal/heritage-zoho-sync/run

# Poll until syncInFlight is false and lastOk is true
curl -sS -H "Authorization: Bearer YOUR_ZOHO_HERITAGE_SYNC_SECRET" \
  https://khannainstitute.com/api/internal/heritage-zoho-sync/status
```

Verify live row count:

```bash
curl -sS "https://khannainstitute.com/api/referral-directory/HeritageFamily" | jq '.offices | length'
```

## Field mapping (Accounts)

Defaults (override with `ZOHO_HERITAGE_FIELD_*` in `.env` if needed):

| Heritage field | Zoho Accounts field |
|----------------|---------------------|
| Practice | `Account_Name` |
| Doctors (semicolon list) | `Doctor_Names` — e.g. `Dr. A; Dr. B; Dr. C` → 3 Heritage rows |
| Phone | `Phone` |
| Website | `Website` |
| Address | `Billing_Street` + `Billing_City` + `Billing_Code` |
| Doctor (if no Contact) | `Account_Name` fallback |

Contacts use `Full_Name`, `Phone`, `Email`, and optional `Cred` / `Title`.

## Cron frequency (CPU / disk)

Default **`0 */6 * * *`** = sync **4 times per day** (low CPU impact).

| `.env` value | Schedule |
|--------------|----------|
| `0 */6 * * *` | Every 6 hours **(default)** |
| `0 3 * * *` | Once daily at 3:00 AM server time |
| `0 6,18 * * *` | Twice daily (6 AM and 6 PM) |

**Disk:** sync only **overwrites** `data/referral-offices.json` (~one JSON file). It does **not** create backups or grow disk usage over time.

For urgent Zoho edits, use the **workflow webhook** instead of a faster cron.

## Notes

- `directoryPages.HeritageFamily` and `aliases` are never overwritten.
- Set `ZOHO_HERITAGE_LEAD_STATUS=Active` only if you use that field to exclude records.
- If nginx caches the API, allow ~2 minutes after large updates.
