#!/bin/bash

# Full Backup Script - Files + MongoDB
# This script runs both file and MongoDB backups

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== KVI Home Full Backup ===${NC}\n"

# Run file backup
echo -e "${YELLOW}Step 1: Backing up files...${NC}"
bash "${SCRIPT_DIR}/backup-files.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}File backup failed! Aborting...${NC}"
    exit 1
fi

echo -e "\n"

# Run MongoDB backup
echo -e "${YELLOW}Step 2: Backing up MongoDB...${NC}"
bash "${SCRIPT_DIR}/backup-mongodb.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}MongoDB backup failed!${NC}"
    echo -e "${YELLOW}File backup was successful, but MongoDB backup failed.${NC}"
    exit 1
fi

echo -e "\n${GREEN}=== Backup Summary ===${NC}"
echo -e "${GREEN}✓ All backups completed successfully!${NC}"
echo -e "${YELLOW}Backup location: /tmp/kvi-backups/${NC}"
echo -e "\n${BLUE}To download backups to your local machine:${NC}"
echo -e "  scp -i ~/Desktop/khannainstitute_backup/khannainstitute.pem \\"
echo -e "    ec2-user@ec2-3-84-21-237.compute-1.amazonaws.com:/tmp/kvi-backups/* \\"
echo -e "    ~/Desktop/kvi-backups/"

