#!/usr/bin/env bash
# Deploy GSC fix: /book-consultation/ → /contact/schedule-consultation/
# (301 redirect, sitemap, internal links, keep canonical on schedule page)
#
# Usage:
#   cd "/Users/nisha/Downloads/kvi home"
#   KEY=~/Desktop/khannainstitute.pem \
#   HOST=ec2-user@ec2-3-84-141-231.compute-1.amazonaws.com \
#   ./scripts/deploy-book-consultation-canonical-fix.sh

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

# Sanity checks
if ! grep -q "'/book-consultation/': '/contact/schedule-consultation/'" "$ROOT/server.js"; then
  echo "ERROR: server.js missing 301 permanentRedirect for /book-consultation/"
  exit 1
fi
if grep -E "\['/book-consultation/'," "$ROOT/server.js"; then
  echo "ERROR: /book-consultation/ still listed in sitemap static pages"
  exit 1
fi
if ! grep -q 'href="https://khannainstitute.com/contact/schedule-consultation/"' "$ROOT/khanna-booking.html"; then
  echo "ERROR: khanna-booking.html missing canonical for schedule-consultation"
  exit 1
fi
if ! grep -q 'href="/contact/schedule-consultation/" class="nav-cta-button"' "$ROOT/partials/header.ejs"; then
  echo "ERROR: header CTA still not pointing at schedule-consultation"
  exit 1
fi

echo "==> Local GSC booking-canonical checks OK"

FILES=(
  "server.js"
  "legacy-wordpress-redirects.js"
  "khanna-booking.html"
  "404.html"
  "blog-layout.html"
  "coming-soon.html"
  "partials/header.ejs"
  "partials/footer.ejs"
  "partials/booking-widget.ejs"
  "partials/lasik-page-content.ejs"
  "partials/procedure-costs-page-content.ejs"
  "partials/pterygium-surgery-page-content.ejs"
  "blog/procedure-guides.html"
  "pricing-financing/special-offers.html"
  "about/dr-khanna/media.html"
  "about/why-choose-us/gallery.html"
  "about/why-choose-us/success-stories.html"
  "patients/your-journey/first-visit-guide.html"
  "patients/results/reviews.html"
  "patients/results/testimonials.html"
  "patients/resources/All You Ever wanted to Know About financing.html"
  "procedures/lens-solutions/pie-rle-service-page.html"
  "services/pages.js"
  "services/pterygiumAutoresponder/messages.js"
)

echo "==> Uploading to $HOST:$REMOTE_BASE"
for f in "${FILES[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "SKIP missing: $f"
    continue
  fi
  remote_dir=$(dirname "$f")
  if [[ "$remote_dir" == "." ]]; then
    scp -i "$KEY" "$ROOT/$f" "$HOST:$REMOTE_BASE/"
  else
    ssh -i "$KEY" -o ConnectTimeout=20 "$HOST" "mkdir -p \"$REMOTE_BASE/$remote_dir\""
    scp -i "$KEY" "$ROOT/$f" "$HOST:$REMOTE_BASE/$f"
  fi
  echo "  uploaded $f"
done

ssh -i "$KEY" "$HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_BASE"
pm2 restart kvi-home --update-env
PORT=3000
if [[ -f .env ]]; then
  p=\$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [[ -n "\$p" ]] && PORT="\$p"
fi
echo ""
echo "=== Verify 301 /book-consultation/ ==="
curl -sSI --max-time 8 "http://127.0.0.1:\${PORT}/book-consultation/" | tr -d '\r' | grep -Ei 'HTTP/|Location:' | head -5
echo ""
echo "=== Verify sitemap omits /book-consultation/ ==="
curl -sS --max-time 8 "http://127.0.0.1:\${PORT}/sitemap.xml" | grep -c 'book-consultation' || echo "0 book-consultation URLs in sitemap (good if 0 for patient path)"
curl -sS --max-time 8 "http://127.0.0.1:\${PORT}/sitemap.xml" | grep 'schedule-consultation' | head -2
echo ""
echo "=== Verify canonical on schedule page ==="
curl -sS --max-time 8 "http://127.0.0.1:\${PORT}/contact/schedule-consultation/" | grep -i 'rel=\"canonical\"' | head -2
REMOTE

echo ""
echo "Done. Validate in GSC:"
echo "  1) https://khannainstitute.com/book-consultation/ → 301 → /contact/schedule-consultation/"
echo "  2) sitemap has schedule URL only"
echo "  3) Request indexing for https://khannainstitute.com/contact/schedule-consultation/"
