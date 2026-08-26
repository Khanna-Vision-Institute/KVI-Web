#!/bin/bash

# Deploy Featured Image Support to Production Server
# This script updates the backend code to support both Strapi uploads and S3 URLs

echo "================================================"
echo "Deploying Featured Image Update"
echo "================================================"

SERVER="ec2-user@52.207.211.13"
KEY_PATH="$HOME/Desktop/khannainstitute_backup/khannainstitute.pem"
REMOTE_PATH="/home/ec2-user/kvi-home"
LOCAL_FILE="services/strapi.js"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${YELLOW}Step 1: Copying updated strapi.js to server...${NC}"
scp -i "$KEY_PATH" "$LOCAL_FILE" "$SERVER:$REMOTE_PATH/services/"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ File copied successfully${NC}"
else
  echo "❌ Failed to copy file"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Restarting Express server...${NC}"
ssh -i "$KEY_PATH" "$SERVER" << 'ENDSSH'
  cd ~/kvi-home
  echo "Restarting kvi-home with PM2..."
  pm2 restart kvi-home
  
  echo ""
  echo "Waiting 3 seconds for server to start..."
  sleep 3
  
  echo ""
  echo "Checking PM2 status..."
  pm2 status kvi-home
  
  echo ""
  echo "Checking recent logs..."
  pm2 logs kvi-home --lines 10 --nostream
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Server restarted successfully${NC}"
else
  echo "❌ Failed to restart server"
  exit 1
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "What was updated:"
echo "  ✅ services/strapi.js - Now supports both Strapi uploads and S3 URLs"
echo ""
echo "Next steps:"
echo "  1. Go to Strapi Content-Type Builder"
echo "  2. Add 'featuredImage' Media field (single image)"
echo "  3. Add 'featuredImageUrl' Text field (for S3 URLs)"
echo "  4. Save and rebuild"
echo "  5. Test with a blog post"
echo ""
echo "Documentation: See STRAPI_FEATURED_IMAGE_GUIDE.md"
echo ""

