#!/bin/bash

# Manual Strapi Installation Script
# Installs Strapi v4 with MongoDB (supports Node 18)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Strapi CMS Installation (Manual) ===${NC}\n"

# Configuration
PROJECT_DIR="/home/ec2-user/kvi-home"
STRAPI_DIR="${PROJECT_DIR}/strapi-cms"
MONGODB_USER="admin"
MONGODB_PASS="@dmKh@nna@2520"
MONGODB_AUTH_DB="admin"
MONGODB_DB="strapi"

cd "${PROJECT_DIR}"

# Check if Strapi already exists
if [ -d "${STRAPI_DIR}" ]; then
    echo -e "${YELLOW}Strapi directory already exists. Removing...${NC}"
    rm -rf "${STRAPI_DIR}"
fi

echo -e "${YELLOW}Creating Strapi directory...${NC}"
mkdir -p "${STRAPI_DIR}"
cd "${STRAPI_DIR}"

echo -e "${YELLOW}Initializing npm project...${NC}"
npm init -y

echo -e "${YELLOW}Installing Strapi v4...${NC}"
npm install strapi@4.25.0 --save

echo -e "${YELLOW}Installing MongoDB connector...${NC}"
npm install strapi-connector-mongodb --save

echo -e "${YELLOW}Creating Strapi structure...${NC}"

# Create basic directory structure
mkdir -p api config components controllers extensions middlewares policies services
mkdir -p src/api src/components src/extensions src/middlewares src/policies src/services

# Generate secure keys
echo -e "${YELLOW}Generating secure keys...${NC}"
APP_KEY1=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
APP_KEY2=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
APP_KEY3=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
APP_KEY4=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
API_TOKEN_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ADMIN_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
TRANSFER_TOKEN_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Create .env file
echo -e "${YELLOW}Creating .env file...${NC}"
cat > .env << EOF
HOST=0.0.0.0
PORT=1337
APP_KEYS=${APP_KEY1},${APP_KEY2},${APP_KEY3},${APP_KEY4}
API_TOKEN_SALT=${API_TOKEN_SALT}
ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
TRANSFER_TOKEN_SALT=${TRANSFER_TOKEN_SALT}
JWT_SECRET=${JWT_SECRET}

DATABASE_CLIENT=mongo
DATABASE_HOST=localhost
DATABASE_PORT=27017
DATABASE_NAME=${MONGODB_DB}
DATABASE_USERNAME=${MONGODB_USER}
DATABASE_PASSWORD=${MONGODB_PASS}
DATABASE_AUTHENTICATION_DATABASE=${MONGODB_AUTH_DB}
EOF

# Create config/database.js
echo -e "${YELLOW}Creating database configuration...${NC}"
mkdir -p config
cat > config/database.js << 'EOF'
module.exports = ({ env }) => ({
  connection: {
    client: 'mongo',
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 27017),
      database: env('DATABASE_NAME', 'strapi'),
      username: env('DATABASE_USERNAME', 'admin'),
      password: env('DATABASE_PASSWORD', ''),
      authenticationDatabase: env('DATABASE_AUTHENTICATION_DATABASE', 'admin'),
    },
  },
});
EOF

# Create config/server.js
echo -e "${YELLOW}Creating server configuration...${NC}"
cat > config/server.js << 'EOF'
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
EOF

# Create package.json scripts
echo -e "${YELLOW}Updating package.json...${NC}"
cat > package.json << 'EOF'
{
  "name": "strapi-cms",
  "private": true,
  "version": "0.1.0",
  "description": "Strapi CMS for KVI",
  "scripts": {
    "develop": "strapi develop",
    "start": "strapi start",
    "build": "strapi build",
    "strapi": "strapi"
  },
  "dependencies": {
    "strapi": "4.25.0",
    "strapi-connector-mongodb": "^4.0.0"
  },
  "author": {
    "name": "KVI"
  },
  "strapi": {
    "uuid": ""
  },
  "engines": {
    "node": ">=18.0.0 <=20.x.x",
    "npm": ">=6.0.0"
  },
  "license": "MIT"
}
EOF

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "${GREEN}✓ Strapi installed successfully!${NC}"

# Summary
echo -e "\n${GREEN}=== Installation Complete ===${NC}"
echo -e "${GREEN}Strapi has been installed at: ${STRAPI_DIR}${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Start Strapi: cd ${STRAPI_DIR} && npm run develop"
echo -e "2. Visit: http://your-server-ip:1337/admin"
echo -e "3. Create your first admin user"
echo -e "4. Configure content types"
echo -e "\n${YELLOW}Note: First run will take longer as it sets up the admin panel${NC}"

