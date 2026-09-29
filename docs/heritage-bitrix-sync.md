# Heritage Family — Bitrix24 Doctor Office sync

Same public directory as before (`/HeritageFamily`). **No website UI changes** (no stages on the page). Data source switches from Zoho Accounts to Bitrix **Doctor Office** (SPA `entityTypeId=1038`).

## What stays the same

- Page HTML / tabs / layout
- `data/referral-offices.json` shape
- MD physicians still merged from `data/heritage-mdvip-physicians.json`
- Directory hubs still tagged `HeritageFamily`

## What changes

| Before (Zoho) | After (Bitrix) |
|---------------|----------------|
| Accounts “Doctor Office” + Contacts | CRM type **1038** Doctor Office items |
| Cron every 6h | Cron every 6h (`HERITAGE_BITRIX_SYNC_CRON`) |
| Optional Zoho webhook | Optional `POST /api/internal/heritage-bitrix-sync/webhook` |

## Field map (confirmed from Bitrix API)

| Website / master row | Bitrix field |
|----------------------|--------------|
| Practice name | `title` |
| Doctor name(s) | `ufCrm8_1786344267153` (semicolon-separated) |
| Phone | `ufCrm8_1786344315335` |
| Office email | `ufCrm8_1786344562548` |
| Specialty → credentials | `ufCrm8_1786344581285` |
| Address | `ufCrm8_1786344617459` |
| City / State / Zip | billing UF fields |

Stages are **not** shown on the site and are **not** used as a sync filter (all Doctor Office items sync).

## Server `.env`

```env
BITRIX_WEBHOOK_URL=https://b24-bofpau.bitrix24.in/rest/10/YOUR_TOKEN/
HERITAGE_BITRIX_SYNC_ENABLED=true
HERITAGE_BITRIX_ENTITY_TYPE_ID=1038
HERITAGE_BITRIX_SYNC_CRON=0 */6 * * *
HERITAGE_BITRIX_SYNC_SECRET=choose-a-long-random-secret
HERITAGE_BITRIX_DIRECTORY_HUBS=HeritageFamily

# Turn Zoho heritage sync off after cutover
HERITAGE_ZOHO_SYNC_ENABLED=false
```

Restart PM2 after editing `.env`.

## Manual test

```bash
cd "/path/to/kvi home"
npm run sync:heritage-bitrix:probe
npm run sync:heritage-bitrix
```

```bash
curl -sS -X POST \
  -H "Authorization: Bearer YOUR_HERITAGE_BITRIX_SYNC_SECRET" \
  https://khannainstitute.com/api/internal/heritage-bitrix-sync/run

curl -sS -H "Authorization: Bearer YOUR_HERITAGE_BITRIX_SYNC_SECRET" \
  https://khannainstitute.com/api/internal/heritage-bitrix-sync/status
```

Verify:

```bash
curl -sS "https://khannainstitute.com/api/referral-directory/HeritageFamily?limit=3" | head
```

## Security

Do not commit the Bitrix webhook token. If it was shared in chat, rotate it in Bitrix24 and update `BITRIX_WEBHOOK_URL`.
