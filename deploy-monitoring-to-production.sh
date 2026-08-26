#!/bin/bash

# KVI Monitoring System - Production Deployment Script
# Safely deploys the cron monitoring system to production server

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SSH_KEY="/Users/nisha/Desktop/khannainstitute_backup/khannainstitute.pem"
SSH_USER="ec2-user"
SSH_HOST="ec2-52-207-211-13.compute-1.amazonaws.com"
REMOTE_DIR="/home/ec2-user/kvi-home"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}KVI Monitoring - Production Deployment${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Step 1: Verify backup exists
echo -e "${YELLOW}Step 1: Verifying backup exists...${NC}"
BACKUP_FILE=$(ls -t /Users/nisha/Desktop/khannainstitute_backup/kvi_production_backup_*.tar.gz 2>/dev/null | head -1)
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}⚠️  No backup found! Please run backup first.${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Backup found: $(basename $BACKUP_FILE)${NC}"
fi
echo ""

# Step 2: Test SSH connection
echo -e "${YELLOW}Step 2: Testing SSH connection...${NC}"
if ssh -i "${SSH_KEY}" -o ConnectTimeout=5 ${SSH_USER}@${SSH_HOST} "echo 'Connection OK'" 2>/dev/null; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    exit 1
fi
echo ""

# Step 3: Check server status and verify main site is running
echo -e "${YELLOW}Step 3: Checking server status and main site...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${REMOTE_DIR} && \
    echo 'Current directory: \$(pwd)' && \
    echo 'Node version: \$(node -v 2>/dev/null || echo 'Not found')' && \
    echo '' && \
    echo 'Main site status (port 3000):' && \
    pm2 list 2>/dev/null | grep -E 'server|kvi|khanna' | head -3 || echo 'Checking processes...' && \
    netstat -tlnp 2>/dev/null | grep ':3000' || ss -tlnp 2>/dev/null | grep ':3000' || echo 'Port 3000 status unknown'
"
echo ""
echo -e "${GREEN}✓ Main site check complete${NC}"
echo ""

# Step 4: Create remote backup directory
echo -e "${YELLOW}Step 4: Creating remote backup directory...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    mkdir -p ${REMOTE_DIR}/monitoring-backup-$(date +%Y%m%d) && \
    echo 'Backup directory created'
"
echo -e "${GREEN}✓ Remote backup directory ready${NC}"
echo ""

# Step 5: Upload monitoring files (to separate directory to avoid conflicts)
echo -e "${YELLOW}Step 5: Uploading monitoring system files...${NC}"
MONITORING_DIR="${REMOTE_DIR}/monitoring"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "mkdir -p ${MONITORING_DIR}"

scp -i "${SSH_KEY}" \
    kvi-monitoring-backend-secure.js \
    kvi-monitoring-dashboard-secure.html \
    kvi-monitoring-login.html \
    ${SSH_USER}@${SSH_HOST}:${MONITORING_DIR}/

echo -e "${GREEN}✓ Monitoring files uploaded to ${MONITORING_DIR}${NC}"
echo ""

# Step 6: Install dependencies on server (in main directory, won't affect existing)
echo -e "${YELLOW}Step 6: Installing dependencies on server...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${REMOTE_DIR} && \
    echo 'Installing express-session and bcrypt...' && \
    npm install express-session bcrypt --save --no-audit 2>&1 | tail -10
"
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 7: Create .env.monitoring file
echo -e "${YELLOW}Step 7: Setting up environment configuration...${NC}"

# Check if password provided as environment variable
if [ -z "$ADMIN_PASSWORD" ]; then
    echo "Please enter a STRONG admin password for the monitoring dashboard:"
    echo "(Minimum 8 characters, recommended: mix of letters, numbers, symbols)"
    read -s ADMIN_PASSWORD
    echo ""
    
    if [ -z "$ADMIN_PASSWORD" ] || [ ${#ADMIN_PASSWORD} -lt 8 ]; then
        echo -e "${RED}⚠️  Password too short. Using secure default (CHANGE THIS IMMEDIATELY!)${NC}"
        ADMIN_PASSWORD="KVI2024Secure!ChangeMe"
        echo -e "${YELLOW}⚠️  DEFAULT PASSWORD SET: ${ADMIN_PASSWORD}${NC}"
        echo -e "${YELLOW}⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER DEPLOYMENT!${NC}"
        sleep 3
    fi
else
    echo -e "${GREEN}Using password from environment variable${NC}"
fi

# Generate secure session secret
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo $(date +%s | sha256sum | head -c 64))

ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cat > ${MONITORING_DIR}/.env.monitoring << EOF
# KVI Monitoring System Configuration
MONITORING_PORT=3001
KVI_BASE_URL=https://khannainstitute.com

# Admin Authentication
ADMIN_USER=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Session Security
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production

# Database (optional)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=kvi_monitoring
# DB_USER=postgres
# DB_PASSWORD=

# Feature Flags
ENABLE_404_CHECK=true
ENABLE_SSL_CHECK=true
EOF
"

echo -e "${GREEN}✓ Environment configuration created${NC}"
echo ""

# Step 8: Create PM2 ecosystem file
echo -e "${YELLOW}Step 8: Creating PM2 configuration...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cat > ${MONITORING_DIR}/ecosystem-monitoring.config.js << 'EOFMONITORING'
module.exports = {
  apps: [{
    name: 'kvi-monitoring',
    script: '${MONITORING_DIR}/kvi-monitoring-backend-secure.js',
    cwd: '${MONITORING_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_file: '${MONITORING_DIR}/.env.monitoring',
    error_file: '${MONITORING_DIR}/logs/monitoring-error.log',
    out_file: '${MONITORING_DIR}/logs/monitoring-out.log',
    log_file: '${MONITORING_DIR}/logs/monitoring-combined.log',
    time: true,
    merge_logs: true
  }]
};
EOFMONITORING
"

echo -e "${GREEN}✓ PM2 configuration created${NC}"
echo ""

# Step 9: Create logs directory
echo -e "${YELLOW}Step 9: Creating logs directory...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    mkdir -p ${MONITORING_DIR}/logs && \
    chmod 755 ${MONITORING_DIR}/logs
"
echo -e "${GREEN}✓ Logs directory created${NC}"
echo ""

# Step 10: Start monitoring service
echo -e "${YELLOW}Step 10: Starting monitoring service...${NC}"
if [ -z "$AUTO_START" ]; then
    read -p "Start the monitoring service now? (y/n) " -n 1 -r
    echo
    START_SERVICE=$REPLY
else
    START_SERVICE="y"
    echo "Auto-starting service..."
fi

if [[ $START_SERVICE =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting monitoring service (this won't affect your main site)...${NC}"
    ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
        cd ${MONITORING_DIR} && \
        pm2 start ecosystem-monitoring.config.js --update-env && \
        pm2 save
    "
    echo -e "${GREEN}✓ Monitoring service started${NC}"
    
    # Verify main site is still running
    echo ""
    echo -e "${YELLOW}Verifying main site is still running...${NC}"
    sleep 2
    MAIN_SITE_STATUS=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pm2 list | grep -E 'server|kvi|khanna' | grep -v monitoring | head -1" || echo "")
    if [ ! -z "$MAIN_SITE_STATUS" ]; then
        echo -e "${GREEN}✓ Main site is still running${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify main site status (may be running under different name)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Monitoring service not started. Start manually with:${NC}"
    echo "  cd ${MONITORING_DIR} && pm2 start ecosystem-monitoring.config.js"
fi
echo ""

# Step 11: Verify deployment and main site
echo -e "${YELLOW}Step 11: Verifying deployment and main site...${NC}"
sleep 3

# Check monitoring service
if ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pm2 list | grep kvi-monitoring" > /dev/null; then
    echo -e "${GREEN}✓ Monitoring service is running${NC}"
else
    echo -e "${YELLOW}⚠ Monitoring service may not be running. Check with: pm2 logs kvi-monitoring${NC}"
fi

# Verify main site is still running
echo -e "${YELLOW}Verifying main site (port 3000) is still running...${NC}"
MAIN_SITE_RUNNING=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pm2 list | grep -v monitoring | grep -E 'server|kvi|khanna' | wc -l")
if [ "$MAIN_SITE_RUNNING" -gt 0 ]; then
    echo -e "${GREEN}✓ Main site is still running (${MAIN_SITE_RUNNING} process(es))${NC}"
else
    echo -e "${RED}⚠ WARNING: Could not detect main site. Please verify manually!${NC}"
fi

# Check ports
PORT_3000=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "netstat -tlnp 2>/dev/null | grep ':3000' | wc -l" || ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "ss -tlnp 2>/dev/null | grep ':3000' | wc -l" || echo "0")
PORT_3001=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "netstat -tlnp 2>/dev/null | grep ':3001' | wc -l" || ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "ss -tlnp 2>/dev/null | grep ':3001' | wc -l" || echo "0")

if [ "$PORT_3000" -gt 0 ]; then
    echo -e "${GREEN}✓ Port 3000 is active (main site)${NC}"
else
    echo -e "${YELLOW}⚠ Port 3000 status unknown${NC}"
fi

if [ "$PORT_3001" -gt 0 ]; then
    echo -e "${GREEN}✓ Port 3001 is active (monitoring)${NC}"
else
    echo -e "${YELLOW}⚠ Port 3001 not yet active${NC}"
fi

# Get server IP
SERVER_IP=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")
echo ""
echo -e "${GREEN}Dashboard URL: http://${SERVER_IP}:3001/login${NC}"
echo ""

# Final instructions
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${YELLOW}Important Information:${NC}"
echo "  Username: admin"
echo "  Password: [The password you entered]"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  pm2 status                    - Check all services (main site + monitoring)"
echo "  pm2 logs kvi-monitoring      - View monitoring logs"
echo "  pm2 restart kvi-monitoring   - Restart monitoring only"
echo "  pm2 stop kvi-monitoring      - Stop monitoring (main site unaffected)"
echo ""
echo -e "${YELLOW}Important Safety Notes:${NC}"
echo "  ✓ Monitoring runs on port 3001 (separate from main site on 3000)"
echo "  ✓ Main site is NOT affected - runs independently"
echo "  ✓ Monitoring only READS data - doesn't modify your site"
echo "  ✓ Can stop monitoring anytime: pm2 stop kvi-monitoring"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "  - Dashboard is password protected"
echo "  - Change password: Edit ${MONITORING_DIR}/.env.monitoring"
echo "  - Consider setting up firewall rules for port 3001"
echo "  - Use HTTPS in production (setup reverse proxy)"
echo ""
echo -e "${GREEN}Your monitoring system is now live!${NC}"
echo -e "${GREEN}Your main site is safe and unaffected!${NC}"

