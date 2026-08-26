#!/bin/bash

# Update Strapi Configuration for Production Domain

set -e

echo "=========================================="
echo "Updating Strapi Configuration"
echo "=========================================="
echo ""

STRAPI_DIR=~/kvi-home/strapi-cms
NEW_URL="https://cms.khannainstitute.com"

cd $STRAPI_DIR

# Backup current config
echo "Creating backup..."
cp config/server.ts config/server.ts.backup
cp .env .env.backup

# Update server.ts
echo "Updating config/server.ts..."
cat > config/server.ts << 'SERVERCONF'
export default ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  app: {
    keys: env.array("APP_KEYS"),
  },
  url: env("SERVER_URL", "https://cms.khannainstitute.com"),
  proxy: true,
  admin: {
    path: env("ADMIN_PATH", "/admin"),
  },
});
SERVERCONF

# Update .env with new URL
echo "Updating .env..."
sed -i.bak '/SERVER_URL=/d' .env
echo "" >> .env
echo "# Production URL" >> .env
echo "SERVER_URL=https://cms.khannainstitute.com" >> .env

# Update admin URL in .env
sed -i.bak '/STRAPI_ADMIN_CLIENT_URL=/d' .env
echo "STRAPI_ADMIN_CLIENT_URL=https://cms.khannainstitute.com" >> .env

echo ""
echo "✓ Configuration updated"
echo ""
echo "Restarting Strapi..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

pm2 restart strapi-cms
pm2 save

echo ""
echo "✓ Strapi restarted with new configuration"
echo ""
echo "New URLs:"
echo "  Admin Panel: https://cms.khannainstitute.com/admin"
echo "  API: https://cms.khannainstitute.com/api"

