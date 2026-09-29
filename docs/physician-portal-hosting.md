# Physician portal on khannainstitute.com

Production URLs mirror the GitHub Pages site but use short paths:

| Live URL | Serves |
|----------|--------|
| `https://khannainstitute.com/Doctorportal/` | Physician hub (`for-physicians.html`) |
| `https://khannainstitute.com/Referral/` | Referral worksheet (`refer-a-patient.html`) |
| `https://khannainstitute.com/HeritageFamily` | **Partner directory hub** (`referral-directory.html`). **`/HeritageFamily`** shows a **simple in-page code** (edit **`HERITAGE_CODE`** in that file). **No server `.env` / no username.** The JSON API **`GET /api/referral-directory/HeritageFamily`** is public unless you block it at nginx. **Requires nginx/edge to proxy apex paths** — WP often **404**; see **`docs/nginx-referral-apex-404.md`**. |
| `https://khannainstitute.com/Doctorportal/network/HeritageFamily` | Same page — same **`HERITAGE_CODE`** for this hub. |
| `https://khannainstitute.com/Doctorportal/link/century-city-optometry-dr-adrian-garcia` | Personalized **`refer-a-patient.html`** keyed by **`slug`** (or any worksheet vanity in **`aliases`** / **`offices[].slug`**) |
| `https://khannainstitute.com/Doctorportal/refer-a-patient?ref=century-city-optometry-dr-adrian-garcia` | Same worksheet, via **`ref`** query |
| `https://khannainstitute.com/Doctorportal/book-consultation.html` | Online scheduler |

#### Heritage directory — in-page code (no server login)

- In **`public/physician-portal/referral-directory.html`**, set **`HERITAGE_CODE`** in the `<script>` block (visible in View Source — casual lock only).
- **`sessionStorage`** key **`kvi_heritage_ok`** skips the prompt for **that browser tab** after a correct code.
- The API **`GET /api/referral-directory/HeritageFamily`** is **not** protected by Express; nginx rules are optional.

Files live in **`public/physician-portal/`** on the Node host. Paths like `/kvi-physician-portal/...` redirect to **`/Doctorportal/...`**.

### Personalized referral worksheets (no login)

- **Data**: Node loads **`data/referral-offices.json`** next to **`server.js`** (or **`KVI_REFERRAL_OFFICES_JSON=/abs/path`** in `.env`). See **`data/referral-offices.sample.json`** for shape.
- **Directory hubs**: **`directoryPages`** defines marketing hubs (e.g. **`HeritageFamily`**) that render **`referral-directory.html`** (partner table with **`/Doctorportal/refer-a-patient?ref=<slug>`** worksheet links plus copyable HTTPS URLs via the JSON API). A hub key **must not** also appear under **`aliases`**, otherwise **`/<hub>` will keep resolving to one physician worksheet** instead of the directory.
- **`directory_hubs` (optional)**: on each **`offices[]`** row add **`"directory_hubs": ["HeritageFamily", "SomeOtherHub"]`** to restrict that provider to named hubs only. **Omit field** → office is listed **on every hub** (good when the manifest is dedicated to one network). **`[]`** → nowhere.
- **Aliases**: **`aliases`** maps worksheet vanity URLs → canonical **`slug`** for one office row. Matching is **case-insensitive**.
- **API**: **`GET /api/referral-office/:key`** returns **one** office JSON; **`GET /api/referral-directory/:hubKey`** returns hub meta + searchable office summaries — the worksheet page does **not** download the full manifest.
- **Vanity URLs**: Express serves **`refer-a-patient.html`** for **`/<key>`** **only when the request reaches Node**. Many hosts send apex paths (e.g. **`/HeritageFamily`**) to WordPress → **site 404** until nginx proxies that path (whitelist) or your edge rewrites — see **`docs/nginx-referral-apex-404.md`**. The **`/Doctorportal/link/:key`** route avoids that limitation when `/Doctorportal/*` already proxies cleanly.

To rebuild the manifest from a large **`doctors.json`** export on your machine:

```bash
node scripts/build-referral-offices-manifest.js \
  --input="$HOME/Downloads/doctors.json" \
  --out="data/referral-offices.json" \
  --aliases="data/referral-aliases.local.json"

npm install   # once
npm run build:referral-offices -- --input="$HOME/Downloads/doctors.json"
```

(**`npm run build:referral-offices`** is a convenience wrapper; append **`--`** and script flags as shown.)

Hosting the raw JSON on GitHub/CDN works too: sync the generated file into **`data/referral-offices.json`** on deploy, or vendor it into **`KVI_REFERRAL_OFFICES_JSON`**.

These links **personalize UX only** — they are **not** authentication. Anyone who knows the vanity URL sees the prefilled banner and hidden referrer fields submitted with the form.

### Troubleshooting `/HeritageFamily`

If `https://khannainstitute.com/HeritageFamily` renders the **Physician Referral Worksheet** (`refer-a-patient.html`) instead of the partner directory (`referral-directory.html`), Express is behaving as if **`HeritageFamily` is worksheet vanity**:

1. **Remove** **`HeritageFamily`** from **`aliases`** in **`data/referral-offices.json`** on the server and keep **`directoryPages.HeritageFamily`** defined.
2. **Deploy `public/physician-portal/referral-directory.html`** next to **`refer-a-patient.html`** and restart **`pm2`** (`PHYSICIAN_PORTAL_DIRECTORY_HTML_READY`).
3. **Deploy matching `server.js`** so apex `/:hub` evaluates `hasDirectoryKey` **before** `hasOfficeKey`.
4. **Add doctors** — the directory draws from **`offices[]`** (optionally gated by **`directory_hubs`**). One row ⇒ one listing.

## Public portal (login disabled — current default)

- Hub, referral worksheet, and scheduler load **without** Cognito overlays or **`/me`** calls.
- `for-physicians.html`, `refer-a-patient.html`, and `book-consultation.html` **do not include** `portal-auth.js` snippets.
- `npm run sync:physician-portal` **does not re-inject** auth markup unless **`PORTAL_AUTH_INJECT=true`**.
- **`public/physician-portal/auth/`** (`sign-in.html`, `portal-auth.js`, etc.) stays in repo for optional future use — not linked from the main flows.

Optional legacy Cognito gated mode is documented in **Physician Cognito + `/me` (legacy)** below.

From this repo (`kvi home`):

```bash
npm install
npm run sync:physician-portal
```

Commit **`public/physician-portal/**`** if you want the assets in git; otherwise run sync on the EC2 checkout after pulls.

Restart the process:

```bash
pm2 restart kvi-home
```

## SCP (alternate)

Your EC2 checkout may live at **`/home/ec2-user/kvi-home/`** (no nested `"kvi home"` folder). Copy **`server.js`** and **`public/physician-portal/`** **into that repo root**:

```bash
scp -i ~/Desktop/khannainstitute.pem \
  "/Users/nisha/Downloads/kvi home/server.js" \
  ec2-user@YOUR_HOST.compute-1.amazonaws.com:~/kvi-home/server.js

scp -r -i ~/Desktop/khannainstitute.pem \
  "/Users/nisha/Downloads/kvi home/public/physician-portal/" \
  ec2-user@YOUR_HOST.compute-1.amazonaws.com:~/kvi-home/public/physician-portal/

scp -i ~/Desktop/khannainstitute.pem \
  "/Users/nisha/Downloads/kvi home/data/referral-offices.json" \
  ec2-user@YOUR_HOST.compute-1.amazonaws.com:~/kvi-home/data/referral-offices.json

ssh -i ~/Desktop/khannainstitute.pem ec2-user@YOUR_HOST.compute-1.amazonaws.com "pm2 restart kvi-home"
```

Older notes used a **`kvi-home/kvi home/`** nested path — use whichever matches **`ls ~/kvi-home/server.js`** on the server.

### After deploy — confirm `config.js` is not stale

`/Doctorportal/*` uses a long **`max-age` Cache-Control** by default (see **`server.js`**). **`/Doctorportal/auth/*`** sends **`must-revalidate` / short cache** for auth bundles so **`apiBaseUrl: '/api/physician-portal'`** arrives quickly — **pull latest `server.js`**, redeploy **`public/physician-portal/`**, restart PM2.

On your laptop, visit **`https://khannainstitute.com/Doctorportal/auth/config.js`** and verify you see **`apiBaseUrl: '/api/physician-portal'`** (not **`execute-api…`**).

In DevTools → Network → failing **`me`** row → **Request URL**:

- ✅ **`https://khannainstitute.com/api/physician-portal/me`** — same-origin; **`.env`** + JWT/nginx issues only if **401**.
- ❌ **`https://…..execute-api…/prod/me`** — browser still has **old `config.js`** (wrong SCP path, CDN/Cloudflare cache, or outdated file on disk). Fix deploy + purge CDN if needed.

## Physician Cognito + `/me` (legacy / optional gated mode)

Auth and per-doctor profile stay **off EC2 disks**.

- **AWS:** `infra/physician-portal-auth/` (SAM) deploys Cognito + HTTP API + `GET /me` Lambda. See `infra/physician-portal-auth/README.md`.
- **Site:** `public/physician-portal/auth/` — copy `config.example.js` → `config.js`, fill Cognito IDs, then deploy that folder with the rest of `public/physician-portal/`.
- **Recommended session check:** set **`apiBaseUrl: '/api/physician-portal'`** in `config.js`. The Express app proxies **`GET /api/physician-portal/me`** to API Gateway **`PHYSICIAN_PORTAL_ME_URL`** (full URL ending in **`/me`**) — same-origin in the browser avoids extensions and flaky cross-origin **`Authorization`** on some setups.
- **Sync:** `npm run sync:physician-portal` with **`PORTAL_AUTH_INJECT=true`** re-appends Cognito snippets; default sync leaves HTML public.

### Production `.env` on the EC2 host (`/me` proxy — only when gating enabled)

After deploy, **`server.js`** must see:

```bash
PHYSICIAN_PORTAL_ME_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/me
```

Then **`pm2 restart`** (or your process manager).

### Locking + personalization (`config.js`)

- **`requirePortalSignIn`** — when `true`, the **hub**, **referral worksheet**, and **booking** pages stay behind Cognito (`/me` verified). **`/Doctorportal/auth/*`** stays public so people can reach the login form.
- **`requireReferralSignIn`** — legacy flag used only when `requirePortalSignIn` is `false`.

### Showing “Welcome, Dr. Garcia!” 

Cognito **ID tokens** expose standard claims when populated on the **user profile**:

- Prefer **`given_name`** + **`family_name`** (editable in Cognito console → Users → user → **Attributes**).
- Optional: set **`profileTitle`** in `config.js` (defaults to **`Dr.`**).

The portal reads names from the **ID token**, stores a small JSON blob in **`sessionStorage`**, and adjusts hero copy client-side.

**URL “slug”**: by default `personalizedUrlHash` adds **`#dr-first-last`** via `history.replaceState` (fragment only — no extra Express routes). Toggle **`personalizedUrlHash: false`** if you do not want a name-derived fragment in the address bar.

> Note: this is browser-only gating — strong protection for submissions still belongs in API verification (recommended next milestone).

### Troubleshooting: “Physician sign-in required” after a successful Cognito login

1. **In DevTools → Network**, confirm the hub calls **`GET /api/physician-portal/me`** (same origin as **`khannainstitute.com`**) when `apiBaseUrl` is **`/api/physician-portal`**. Success is **200** with JSON **`"ok": true`**.  
   If you still see **`401`/`403`**, the token is failing API Gateway JWT validation — check **`PHYSICIAN_PORTAL_ME_URL`** matches your deployed HTTP API (**`/prod/me`**), **`userPoolId`** / **`clientId`** in `config.js` match CloudFormation outputs, and CloudWatch logs for the JWT authorizer.
2. **`503` from `/api/physician-portal/me`** means **`PHYSICIAN_PORTAL_ME_URL`** is missing in the server `.env` — set it and restart Node.
3. **Nginx reverse proxy**: forward auth headers into Node:

```nginx
proxy_set_header Authorization $http_authorization;
proxy_set_header X-KVI-Physician-Bearer $http_x_kvi_physician_bearer;
proxy_pass_header Authorization;
proxy_pass_request_headers on;
```

If **`me`** responds with **`"code":"MISSING_TOKEN"`** from Express, nginx stripped both headers — add the **`X-KVI`** line above.

4. **Use one canonical host** (`https://khannainstitute.com` *or* `https://www.khannainstitute.com`, not both). Cognito tokens are stored in **`sessionStorage`**, which is **not shared** across subdomains — logging in on `www` and opening the hub on the apex (or the reverse) looks like a logged-out user.

5. **401 on `/api/physician-portal/me` with body mentioning missing bearer**: `Authorization` was dropped (extensions like those that inject `requests.js`, or proxies). **`portal-auth.js`** also sends **`X-KVI-Physician-Bearer`** — **`server.js`** rebuilds **`Authorization`** for API Gateway.

6. **`Session storage` after “sign-in” shows no `kvi_physician_*` keys:** Cognito succeeded, **`GET /me`** returned **401** (`kviRejectedBy: upstream_jwt_authorizer`), and **`portal-auth` clears sessionStorage**. Fix JWT alignment (**`PHYSICIAN_PORTAL_ME_URL`** + **`config.js`** pool/client = same SAM outputs). Optionally set **`keepSessionTokensOnMe401: true`** in `config.js` *only while debugging* so tokens stay visible; turn off after AWS is fixed.

7. **401 with API Gateway `{ "message":"Unauthorized" }` etc.**: JWT rejected upstream — **`PHYSICIAN_PORTAL_ME_URL`**, **`userPoolId`** / **`clientId`**, CloudWatch JWT authorizer.
