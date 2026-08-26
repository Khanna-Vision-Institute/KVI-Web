#!/bin/bash

# Strapi Production Setup with SSL
# This script sets up Nginx, SSL, and secures Strapi

set -e  # Exit on error

echo "=========================================="
echo "Strapi Production Setup with SSL"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="cms.khannainstitute.com"
EMAIL="your-email@example.com"  # Change this!
STRAPI_PORT=1337

echo -e "${YELLOW}Step 1: Installing Nginx...${NC}"
sudo yum install -y nginx

echo -e "${YELLOW}Step 2: Installing Certbot for SSL...${NC}"
sudo yum install -y certbot python3-certbot-nginx

echo -e "${YELLOW}Step 3: Configuring Nginx for Strapi...${NC}"

# Create Nginx configuration
sudo tee /etc/nginx/conf.d/strapi.conf > /dev/null <<'NGINXCONF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name cms.khannainstitute.com;
    
    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - Strapi CMS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cms.khannainstitute.com;
    
    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/cms.khannainstitute.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/cms.khannainstitute.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Max upload size (for images/media)
    client_max_body_size 50M;
    
    # Proxy to Strapi
    location / {
        proxy_pass http://localhost:1337;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
NGINXCONF

echo -e "${GREEN}✓ Nginx configuration created${NC}"

# Create directory for certbot validation
sudo mkdir -p /var/www/certbot

# Test Nginx configuration
echo -e "${YELLOW}Step 4: Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration error${NC}"
    exit 1
fi

# Start and enable Nginx
echo -e "${YELLOW}Step 5: Starting Nginx...${NC}"
sudo systemctl start nginx
sudo systemctl enable nginx
echo -e "${GREEN}✓ Nginx started${NC}"

echo ""
echo -e "${YELLOW}=========================================="
echo "Next Steps:"
echo -e "==========================================${NC}"
echo ""
echo "1. Make sure DNS is configured:"
echo "   A record: cms -> 52.207.211.13"
echo ""
echo "2. Test DNS resolution:"
echo "   ping cms.khannainstitute.com"
echo ""
echo "3. Get SSL certificate:"
echo "   sudo certbot --nginx -d cms.khannainstitute.com --email YOUR_EMAIL"
echo ""
echo "4. Test Strapi access:"
echo "   https://cms.khannainstitute.com"
echo ""
echo -e "${GREEN}Script completed!${NC}"

