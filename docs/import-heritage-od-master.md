# Heritage referral directory — OD master import

`/HeritageFamily` loads **`data/referral-offices.json`** via Express (`GET /api/referral-directory/HeritageFamily`). The accordion list is backed by every office row in that manifest (excluding rows with restrictive `directory_hubs` tagging).

When you export a new Khanna OD master workbook as JSON (`Khanna_Vision_OD_Info_0526_Master_List.json`-style rows), regenerate the manifest like this:

Imported offices **do not** set `directory_hubs` unless you patch them afterward — behavior matches legacy rows without hub tagging (they list on **all** hubs defined in `directoryPages`).

```bash
cd "/path/to/kvi-home"

node scripts/import-od-master-to-referral-offices.js \
  --master="/absolute/path/to/Khanna_Vision_OD_Info_0526_Master_List.json" \
  --out="/path/to/kvi-home/data/referral-offices.json"
```

Or with npm (pass args after `--`):

```bash
npm run import:od-master -- \
  --master="/absolute/path/to/Khanna_Vision_OD_Info_0526_Master_List.json"
```

Defaults:

- `--out` resolves to `./data/referral-offices.json` from the repo root.
- Existing `directoryPages` and `aliases` in `--out` are preserved; **`offices` is fully rebuilt** from the master file (worksheet vanities / slug URLs will change accordingly).

Optional filter (only `"Lead Status" === Active`):

```bash
npm run import:od-master -- \
  --master="/path/to/export.json" \
  --leadStatus=Active
```

After updating the JSON:

1. Restart the Node process (`pm2 restart …` — whatever wraps `server.js` in production).
2. Hard-refresh the Heritage directory page to avoid cached `/api/` responses behind a proxy/CDN where applicable.
