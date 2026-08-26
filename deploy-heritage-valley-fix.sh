#!/usr/bin/env bash
# Fix: remove combined "Aaron Luekenga, Emily Farlow, Daryl Lipsun" dropdown entry
# Deploys updated data/referral-offices.json → EC2 → pm2 restart

set -euo pipefail

KEY="${KEY:-$HOME/Desktop/khannainstitute.pem}"
EC2="ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com"
SRC="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: PEM key not found: $KEY"
  exit 1
fi
chmod 400 "$KEY"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30)

echo "==> Discovering remote paths on EC2..."
REMOTE_DIRS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && REMOTE_DIRS+=("$line")
done < <(
  ssh "${SSH_OPTS[@]}" "$EC2" bash -s <<'DISC'
for d in "$HOME/kvi-home/kvi home" "$HOME/kvi-home"; do
  [[ -f "$d/server.js" ]] && echo "${d/#$HOME\//}"
done
DISC
)

if [[ ${#REMOTE_DIRS[@]} -eq 0 ]]; then
  echo "ERROR: server.js not found under ~/kvi-home on EC2"
  exit 1
fi
echo "  Found: ${REMOTE_DIRS[*]}"

echo "==> Copying referral-offices.json..."
for RDIR in "${REMOTE_DIRS[@]}"; do
  ssh "${SSH_OPTS[@]}" "$EC2" "mkdir -p ~/${RDIR}/data"
  scp "${SSH_OPTS[@]}" \
    "${SRC}/data/referral-offices.json" \
    "${EC2}:~/${RDIR}/data/referral-offices.json"
  echo "  ✓ ~/${RDIR}/data/referral-offices.json"
done

echo "==> Restarting pm2..."
ssh "${SSH_OPTS[@]}" "$EC2" "pm2 restart kvi-home --update-env && pm2 status kvi-home"

echo ""
echo "==> Verifying live API..."
sleep 4
curl -s "https://khannainstitute.com/api/referral-clinic/heritage-valley-eye-care" \
  | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('Physicians now:');
(d.clinic&&d.clinic.physicians||[]).forEach(p=>console.log(' •',p.doctorName));
" 2>/dev/null || echo "(curl verification skipped — check the page manually)"

echo ""
echo "Done. Visit: https://khannainstitute.com/heritage-valley-eye-care"
echo "Expected dropdown: Aaron Luekenga | Daryl Lipsun | Emily Farlow (3 separate options)"
