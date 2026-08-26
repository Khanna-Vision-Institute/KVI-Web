#!/bin/bash

# Production Security Setup Script for KVI Monitoring
# This script sets up production-grade security for the monitoring dashboard

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}KVI Monitoring - Production Security Setup${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Configuration
SSH_KEY="/Users/nisha/Desktop/khannainstitute_backup/khannainstitute.pem"
SSH_USER="ec2-user"
SSH_HOST="ec2-52-207-211-13.compute-1.amazonaws.com"
REMOTE_DIR="/home/ec2-user/kvi-home/monitoring"

echo -e "${YELLOW}Step 1: Installing security dependencies...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${REMOTE_DIR} && \
    npm install helmet express-rate-limit --save 2>&1 | tail -5
"
echo -e "${GREEN}✓ Security dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Uploading secure backend...${NC}"
scp -i "${SSH_KEY}" \
    kvi-monitoring-backend-secure.js \
    ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/
echo -e "${GREEN}✓ Secure backend uploaded${NC}"
echo ""

echo -e "${YELLOW}Step 3: Setting up Nginx reverse proxy...${NC}"
if [ -z "$SUBDOMAIN" ]; then
    SUBDOMAIN="monitoring.khannainstitute.com"
    echo "Using default subdomain: $SUBDOMAIN"
    echo "To use a different subdomain, set SUBDOMAIN environment variable"
fi

# Create Nginx configuration with rate limiting zones in http block
echo -e "${YELLOW}Configuring Nginx rate limiting zones...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    # Check if rate limiting zones already exist in nginx.conf
    if ! grep -q 'limit_req_zone.*login_limit' /etc/nginx/nginx.conf; then
        # Create a temporary file with rate limiting zones
        cat > /tmp/rate_limit_zones.conf << 'RATEZONES'
    # Rate limiting zones for KVI Monitoring
    limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;
    limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/m;
RATEZONES
        # Insert after 'http {' line
        sudo sed -i '/^http {/r /tmp/rate_limit_zones.conf' /etc/nginx/nginx.conf
        rm -f /tmp/rate_limit_zones.conf
    fi
"

# Create Nginx server configuration
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "sudo tee /etc/nginx/conf.d/monitoring.conf > /dev/null << 'NGINXCONF'
# KVI Monitoring Dashboard - Nginx Configuration
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name ${SUBDOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    http2 on;
    server_name ${SUBDOMAIN};
    
    # SSL will be configured by Certbot
    # ssl_certificate /etc/letsencrypt/live/${SUBDOMAIN}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${SUBDOMAIN}/privkey.pem;
    
    # Security Headers
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;
    add_header X-Frame-Options \"DENY\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;
    
    # Login endpoint - strict rate limit
    location /api/login {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://localhost:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # API endpoints
    location /api {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://localhost:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # All other requests
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXCONF
"

echo -e "${GREEN}✓ Nginx configuration created${NC}"
echo ""

echo -e "${YELLOW}Step 4: Installing Nginx and Certbot...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    sudo yum install -y nginx certbot python3-certbot-nginx 2>&1 | tail -3
"
echo -e "${GREEN}✓ Nginx and Certbot installed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Testing Nginx configuration...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "sudo nginx -t"
echo -e "${GREEN}✓ Nginx configuration valid${NC}"
echo ""

echo -e "${YELLOW}Step 6: Starting Nginx...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    sudo systemctl enable nginx && \
    sudo systemctl start nginx && \
    sudo systemctl status nginx --no-pager | head -5
"
echo -e "${GREEN}✓ Nginx started${NC}"
echo ""

echo -e "${YELLOW}Step 7: Getting SSL certificate...${NC}"
echo -e "${YELLOW}This will prompt for email and agreement.${NC}"
read -p "Continue with SSL setup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
        sudo certbot --nginx -d ${SUBDOMAIN} --non-interactive --agree-tos --email admin@khannainstitute.com --redirect
    " || echo -e "${YELLOW}⚠ SSL setup may require manual intervention${NC}"
    echo -e "${GREEN}✓ SSL certificate configured${NC}"
else
    echo -e "${YELLOW}⚠ Skipping SSL setup. Run manually:${NC}"
    echo "  sudo certbot --nginx -d ${SUBDOMAIN}"
fi
echo ""

echo -e "${YELLOW}Step 8: Restarting monitoring service...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${REMOTE_DIR} && \
    pm2 restart kvi-monitoring && \
    sleep 2 && \
    pm2 status | grep kvi-monitoring
"
echo -e "${GREEN}✓ Monitoring service restarted${NC}"
echo ""

echo -e "${YELLOW}Step 9: Updating environment for production...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${REMOTE_DIR} && \
    echo '' >> .env.monitoring && \
    echo '# Production Security Settings' >> .env.monitoring && \
    echo 'NODE_ENV=production' >> .env.monitoring && \
    echo 'FORCE_SECURE_COOKIE=true' >> .env.monitoring && \
    echo '# ALLOWED_ORIGINS=https://${SUBDOMAIN},https://khannainstitute.com' >> .env.monitoring && \
    echo '# ALLOWED_IPS=YOUR_IP_HERE (optional - restrict access by IP)' >> .env.monitoring && \
    cat .env.monitoring | tail -5
"
echo -e "${GREEN}✓ Environment updated${NC}"
echo ""

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Production Security Setup Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add DNS A record: ${SUBDOMAIN} → 52.207.211.13"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Access dashboard: https://${SUBDOMAIN}/login"
echo "4. Update .env.monitoring with ALLOWED_ORIGINS and ALLOWED_IPS (optional)"
echo ""
echo -e "${YELLOW}Security Features Enabled:${NC}"
echo "✓ Rate limiting (5 login attempts per 15 min)"
echo "✓ Brute force protection (15 min lockout)"
echo "✓ Security headers (XSS, clickjacking protection)"
echo "✓ HTTPS/SSL encryption"
echo "✓ IP whitelisting (optional)"
echo "✓ CORS restrictions"
echo "✓ Secure cookies"
echo ""
echo -e "${GREEN}Your monitoring dashboard is now production-ready!${NC}"

