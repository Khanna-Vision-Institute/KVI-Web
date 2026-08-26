#!/bin/bash

# Backup script for KVI Home files
# This script creates a timestamped backup of all project files

set -e

# Configuration
BACKUP_DIR="/tmp/kvi-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="kvi-home-backup-${TIMESTAMP}"
PROJECT_DIR="/home/ec2-user/kvi-home"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting backup process...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if project directory exists
if [ ! -d "${PROJECT_DIR}" ]; then
    echo -e "${RED}Error: Project directory ${PROJECT_DIR} not found!${NC}"
    echo -e "${YELLOW}Please check the correct directory path.${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}Creating backup of ${PROJECT_DIR}...${NC}"
tar -czf "${BACKUP_PATH}.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='backups' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    -C "$(dirname ${PROJECT_DIR})" \
    "$(basename ${PROJECT_DIR})"

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_PATH}.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully!${NC}"
    echo -e "${GREEN}  Location: ${BACKUP_PATH}.tar.gz${NC}"
    echo -e "${GREEN}  Size: ${BACKUP_SIZE}${NC}"
    
    # Also create a copy with a simple name for easy access
    cp "${BACKUP_PATH}.tar.gz" "${BACKUP_DIR}/kvi-home-latest-backup.tar.gz"
    echo -e "${GREEN}  Latest backup copy: ${BACKUP_DIR}/kvi-home-latest-backup.tar.gz${NC}"
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Backup process completed!${NC}"

