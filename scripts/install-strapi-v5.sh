#!/bin/bash

# Strapi v5 Installation Script
# This script installs Strapi v5 with MongoDB configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Strapi CMS v5 Installation ===${NC}\n"

# Configuration
PROJECT_DIR="/home/ec2-user/kvi-home"
STRAPI_DIR="${PROJECT_DIR}/strapi-cms"
MONGODB_USER="admin"
MONGODB_PASS="@dmKh@nna@2520"
MONGODB_AUTH_DB="admin"
MONGODB_DB="strapi"

# Check if we're in the right directory
if [ ! -d "${PROJECT_DIR}" ]; then
    echo -e "${RED}Error: Project directory ${PROJECT_DIR} not found!${NC}"
    echo -e "${YELLOW}Please check the correct directory path.${NC}"
    exit 1
fi

cd "${PROJECT_DIR}"

# Check if Strapi already exists
if [ -d "${STRAPI_DIR}" ]; then
    echo -e "${YELLOW}Strapi directory already exists at ${STRAPI_DIR}${NC}"
    read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing existing Strapi installation...${NC}"
        rm -rf "${STRAPI_DIR}"
    else
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
fi

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. Current version: $(node -v)${NC}"
    exit 1
elif [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠ Warning: Node.js 20+ recommended for Strapi v5${NC}"
    echo -e "${YELLOW}  Current version: $(node -v)${NC}"
    echo -e "${YELLOW}  Installing Strapi v4 instead (supports Node 18)${NC}"
    STRAPI_VERSION="4.25.0"
else
    echo -e "${GREEN}✓ Node.js version OK: $(node -v)${NC}"
    STRAPI_VERSION="latest"
fi

# Check available space
echo -e "${YELLOW}Checking available disk space...${NC}"
AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 1 ]; then
    echo -e "${RED}⚠ WARNING: Less than 1 GB available!${NC}"
    echo -e "${RED}  Installation may fail. Consider increasing storage first.${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install Strapi
echo -e "${YELLOW}Installing Strapi...${NC}"
echo -e "${BLUE}This may take several minutes...${NC}"

# For Strapi v4, use the old syntax. For v5, use new approach
if [ "$STRAPI_VERSION" != "latest" ]; then
    # Install Strapi v4 with MongoDB flags
    npx create-strapi-app@${STRAPI_VERSION} strapi-cms \
      --quickstart \
      --dbclient=mongodb \
      --dbhost=localhost \
      --dbport=27017 \
      --dbname="${MONGODB_DB}" \
      --dbusername="${MONGODB_USER}" \
      --dbpassword="${MONGODB_PASS}" \
      --dbauth="${MONGODB_AUTH_DB}" \
      --no-run
else
    # For Strapi v5, install with SQLite first, then configure MongoDB
    echo -e "${YELLOW}Installing Strapi v5 with SQLite (will configure MongoDB after)...${NC}"
    npx create-strapi-app@latest strapi-cms \
      --quickstart \
      --no-run
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Strapi installation failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Strapi installed successfully!${NC}"

# Navigate to Strapi directory
cd "${STRAPI_DIR}"

# Install MongoDB connector if needed (for v5)
if [ "$STRAPI_VERSION" == "latest" ]; then
    echo -e "${YELLOW}Installing MongoDB connector...${NC}"
    npm install @strapi/connector-mongodb
fi

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

DATABASE_HOST=localhost
DATABASE_PORT=27017
DATABASE_NAME=${MONGODB_DB}
DATABASE_USERNAME=${MONGODB_USER}
DATABASE_PASSWORD=${MONGODB_PASS}
DATABASE_AUTH=${MONGODB_AUTH_DB}
EOF

echo -e "${GREEN}✓ .env file created${NC}"

# Update database config
echo -e "${YELLOW}Updating database configuration...${NC}"

# Check Strapi version to use correct config format
if [ "$STRAPI_VERSION" == "latest" ]; then
    # Strapi v5 format
    cat > config/database.js << 'EOF'
module.exports = ({ env }) => ({
  connection: {
    client: 'mongo',
    connection: {
      connectionString: env('DATABASE_URI') || `mongodb://${env('DATABASE_USERNAME')}:${encodeURIComponent(env('DATABASE_PASSWORD'))}@${env('DATABASE_HOST')}:${env.int('DATABASE_PORT', 27017)}/${env('DATABASE_NAME')}?authSource=${env('DATABASE_AUTH')}`,
    },
  },
});
EOF
else
    # Strapi v4 format
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
      authenticationDatabase: env('DATABASE_AUTH', 'admin'),
    },
  },
});
EOF
fi

echo -e "${GREEN}✓ Database configuration updated${NC}"

# Update server config
echo -e "${YELLOW}Updating server configuration...${NC}"
cat > config/server.js << 'EOF'
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
EOF

echo -e "${GREEN}✓ Server configuration updated${NC}"

# Build Strapi
echo -e "${YELLOW}Building Strapi admin panel...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Strapi built successfully!${NC}"

# Summary
echo -e "\n${GREEN}=== Installation Complete ===${NC}"
echo -e "${GREEN}Strapi has been installed at: ${STRAPI_DIR}${NC}"
echo -e "${GREEN}Version: ${STRAPI_VERSION}${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Start Strapi: cd ${STRAPI_DIR} && npm start"
echo -e "2. Visit: http://your-server-ip:1337/admin"
echo -e "3. Create your first admin user"
echo -e "4. Configure content types"
echo -e "\n${YELLOW}To run Strapi in production with PM2:${NC}"
echo -e "  cd ${STRAPI_DIR}"
echo -e "  pm2 start npm --name strapi-cms -- start"
echo -e "  pm2 save"

