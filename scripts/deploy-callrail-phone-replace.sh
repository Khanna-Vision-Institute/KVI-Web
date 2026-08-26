#!/usr/bin/env bash
# Deploy CallRail removal + replace tracking number with (310) 677-0760
#
# Uploads:
#   partials/header.ejs, partials/footer.ejs, index.html,
#   services/vapiWebAgents.js, header.ejs (root duplicate if present)
# Also patches any remaining 997-4490 / callrail on the server (e.g. physicians pages).
#
# Usage:
#   cd "/Users/nisha/Downloads/kvi home"
#   KEY=~/Desktop/khannainstitute.pem \
#   HOST=ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com \
#   ./scripts/deploy-callrail-phone-replace.sh

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
HOST="${HOST:-ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_BASE="/home/ec2-user/kvi-home/kvi home"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: Key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"

if ! grep -q '(310) 677-0760' "$ROOT/partials/header.ejs"; then
  echo "ERROR: header.ejs missing new phone"
  exit 1
fi
if ! grep -q '(310) 677-0760' "$ROOT/partials/footer.ejs"; then
  echo "ERROR: footer.ejs missing new phone"
  exit 1
fi
if grep -q 'cdn.callrail.com' "$ROOT/partials/footer.ejs"; then
  echo "ERROR: footer.ejs still has CallRail swap.js"
  exit 1
fi
if grep -q 'cdn.callrail.com' "$ROOT/index.html"; then
  echo "ERROR: index.html still has CallRail dns-prefetch"
  exit 1
fi

echo "==> Local CallRail/phone checks OK"

scp -i "$KEY" \
  "$ROOT/partials/header.ejs" \
  "$ROOT/partials/footer.ejs" \
  "$HOST:$REMOTE_BASE/partials/"

scp -i "$KEY" \
  "$ROOT/index.html" \
  "$HOST:$REMOTE_BASE/"

scp -i "$KEY" \
  "$ROOT/services/vapiWebAgents.js" \
  "$HOST:$REMOTE_BASE/services/"

if [[ -f "$ROOT/header.ejs" ]]; then
  scp -i "$KEY" "$ROOT/header.ejs" "$HOST:$REMOTE_BASE/"
fi

ssh -i "$KEY" -o ConnectTimeout=20 "$HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_BASE"

# Patch any leftover CallRail number / scripts outside node_modules
python3 - <<'PY'
from pathlib import Path
import re
root = Path('.')
skip = {'node_modules', '.git', 'backups'}
changed = []
for p in root.rglob('*'):
    if not p.is_file():
        continue
    if p.suffix.lower() not in {'.html', '.ejs', '.js', '.css'}:
        continue
    try:
        rel = p.as_posix()
    except Exception:
        continue
    if any(part in skip for part in p.parts):
        continue
    try:
        text = p.read_text(encoding='utf-8')
    except Exception:
        continue
    if '997-4490' not in text and 'callrail' not in text.lower():
        continue
    new = text
    new = new.replace('(310) 997-4490', '(310) 677-0760')
    new = new.replace('310-997-4490', '310-677-0760')
    new = new.replace('3109974490', '3106770760')
    new = re.sub(r'\n?<script[^>]*cdn\.callrail\.com[^>]*>\s*</script>\s*', '\n', new, flags=re.I)
    new = re.sub(r'\n?\s*<link[^>]*cdn\.callrail\.com[^>]*>\s*', '\n', new, flags=re.I)
    # Keep intentional "NEVER use outdated CallRail" notes if we accidentally flipped them
    new = new.replace('NEVER use (310) 677-0760 — outdated CallRail tracking number',
                      'NEVER use (310) 997-4490 — outdated CallRail tracking number')
    if new != text:
        p.write_text(new, encoding='utf-8')
        changed.append(rel)
print('Server patched:', len(changed))
for c in changed:
    print(' ', c)
PY

pm2 restart kvi-home --update-env

PORT=3000
if [[ -f .env ]]; then
  p=\$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [[ -n "\$p" ]] && PORT="\$p"
fi

echo ""
echo "=== Verify header/footer phone + no CallRail ==="
html=\$(curl -sS --max-time 10 "http://127.0.0.1:\${PORT}/")
echo "\$html" | grep -o '(310) 677-0760' | head -3 || echo "MISSING new phone"
echo "\$html" | grep -c 'cdn.callrail.com' || true
echo "callrail script count above should be 0"
REMOTE

echo ""
echo "Done. Hard-refresh https://khannainstitute.com/"
echo "Header + footer should show (310) 677-0760 with no CallRail swap."
