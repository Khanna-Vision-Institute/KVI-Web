## Apex vanity URLs like `/HeritageFamily` returning 404

Your public site **`khannainstitute.com`** is often handled by **WordPress / nginx** so **bare single-segment paths never reach Express**. Paths under **`/Doctorportal/...`** are usually proxied to Node — prefer **`/Doctorportal/network/HeritageFamily`** when apex routing is flaky.

---

### nginx: proxy apex hub + JSON to Node (`HeritageFamily` example)

No **`Authorization`** header is required from Express: **`/HeritageFamily`** serves **`referral-directory.html`**, which asks for **`HERITAGE_CODE`** in JavaScript inside that file (`GET /api/referral-directory/HeritageFamily` JSON is unrelated).

Add **inside** your `server { ... }` for khannainstitute.com *before* the generic WordPress `location /` block:

```nginx
location = /HeritageFamily {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location = /api/referral-directory/HeritageFamily {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Use your real upstream (`127.0.0.1:3000` → whatever `pm2` listens on). Add one `location = /SlugName { ... }` (and matching API path) per hub slug. Avoid a wide-open catch‑all proxy for **every** single‑segment URL.

### Optional — nginx `auth_basic` only if you want a server-side password

You can layer **`auth_basic`** on **`/HeritageFamily`** **and/or** the API path independently of the app — the Express app **does not** implement duplicate Basic auth for Heritage anymore.

### Cloudflare / edge cache

If you change **`referral-directory.html`** or `Cache-Control`, purge **`/HeritageFamily`**, **`/Doctorportal/network/HeritageFamily`**, and **`/api/referral-directory/HeritageFamily`** when troubleshooting stale layouts or JSON.

### Verify Node routing (SSH on EC2; use your real port)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/HeritageFamily
curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/api/referral-directory/HeritageFamily?limit=1"
```

Expect **`200`** when the hub exists in **`data/referral-offices.json`** and **`referral-directory.html`** is deployed.

### Legacy check (worksheet slug, not directory listing)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/Doctorportal/link/HeritageFamily
```

```bash
curl -sS "http://127.0.0.1:3000/api/referral-office/HeritageFamily" | head
```

Expect JSON **`"ok":true`** when that vanity exists in the manifest.

### Option — Cloudflare Worker / Transform Rule

Rewrite **`/HeritageFamily` → `/Doctorportal/network/HeritageFamily`** or proxy straight to Node if your origin is split.
