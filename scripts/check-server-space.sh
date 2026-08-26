#!/bin/bash

# Server Space Check Script
# This script checks available disk space and provides recommendations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Server Disk Space Analysis ===${NC}\n"

# Check disk usage
echo -e "${YELLOW}Current disk usage:${NC}"
df -h /

echo -e "\n${YELLOW}Detailed space breakdown:${NC}"
df -h / | tail -1 | awk '{print "Total: " $2 "\nUsed: " $3 "\nAvailable: " $4 "\nUsage: " $5}'

# Get available space in GB
AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
USED_PERCENT=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')

echo -e "\n${BLUE}=== Space Requirements for Strapi ===${NC}"
echo -e "${YELLOW}Strapi Base Installation:${NC}"
echo -e "  - Node modules: ~200-300 MB"
echo -e "  - Strapi core: ~50-100 MB"
echo -e "  - Database (if using SQLite): ~10-50 MB"
echo -e "  - Media/uploads: Variable (depends on usage)"
echo -e "  ${GREEN}Total minimum: ~500 MB${NC}"
echo -e "  ${YELLOW}Recommended: 1-2 GB free space${NC}"

echo -e "\n${BLUE}=== Recommendations ===${NC}"

if [ "$AVAILABLE_SPACE" -lt 1 ]; then
    echo -e "${RED}⚠ WARNING: Less than 1 GB available!${NC}"
    echo -e "${RED}  You should increase your EBS volume before installing Strapi.${NC}"
    echo -e "${YELLOW}  Recommended: Increase to at least 20 GB total${NC}"
elif [ "$AVAILABLE_SPACE" -lt 2 ]; then
    echo -e "${YELLOW}⚠ CAUTION: Less than 2 GB available${NC}"
    echo -e "${YELLOW}  Strapi can be installed, but consider increasing storage for future growth.${NC}"
else
    echo -e "${GREEN}✓ Sufficient space available for Strapi installation${NC}"
fi

if [ "$USED_PERCENT" -gt 80 ]; then
    echo -e "${RED}⚠ WARNING: Disk usage is above 80%${NC}"
    echo -e "${RED}  Consider cleaning up or increasing storage.${NC}"
fi

echo -e "\n${BLUE}=== Top 10 Largest Directories ===${NC}"
du -h --max-depth=1 /home/ec2-user 2>/dev/null | sort -hr | head -10 || echo "Could not analyze directories"

echo -e "\n${GREEN}Space check completed!${NC}"

