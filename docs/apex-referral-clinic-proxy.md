# Apex worksheet URLs (`/` + clinic slug)

The Express app (`server.js`) already serves the referral worksheet HTML for paths like `/beachside-optometry-inc` **when traffic reaches Node**.

Production uses WordPress at the apex host. Requests like `GET /beachside-optometry-inc` are handled by nginx/Apache **before** they hit Node, so WordPress returns **404**. `/Doctorportal/...` paths work because nginx routes that prefix to Node.

## Fix (infra)

Tell nginx (or equivalent) to forward **only registered clinic worksheet slugs** to Node:

1. On the deployment machine, generate snippet(s):

   ```bash
   cd "/home/ec2-user/kvi-home/kvi home"
   node scripts/print-referral-clinic-nginx-snippet.js --upstream=http://127.0.0.1:3000 >> /etc/nginx/snippets/kvi-referral-clinics.conf
   ```

   Review the file, then **`include`** it **inside** the `server { }` block for `khannainstitute.com`, **above** WordPress/`try_files`/PHP fallback.

2. `nginx -t && systemctl reload nginx` (exact commands vary by distro).

Adjust `--upstream` to wherever `pm2`/Node listens locally.

## Important

Do **not** proxy every `/[a-z0-9\\-]+$` blindly—WordPress and marketing use many single‑segment URLs. Always use the **generated whitelist** (or regenerate after manifest changes).

## App behavior (`?ref=…` deep links)

If someone opens `/Doctorportal/refer-a-patient?ref=<per-doctor-office-slug>`, the worksheet now asks the **`/api/referral-office`** response for **`practiceClinicKey`**. When present, it re-fetches **`/api/referral-clinic/<practiceClinicKey>`** so the **Doctor name** dropdown lists **all doctors at that clinic**, with the **`ref` doctor pre-selected**.

This does **not** change the visible URL fragment to `/beachside-optometry-inc` until nginx proxies apex URLs; avoiding `history.replaceState` until infra is ready prevents “works until refresh” bookmarks.
