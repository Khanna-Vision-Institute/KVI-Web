#!/bin/bash

# MongoDB Backup Script
# This script creates a backup of all MongoDB databases

set -e

# Configuration
BACKUP_DIR="/tmp/kvi-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
MONGODB_USER="admin"
MONGODB_PASS="@dmKh@nna@2520"
MONGODB_AUTH_DB="admin"
BACKUP_NAME="mongodb-backup-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting MongoDB backup process...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if mongodump is available
if ! command -v mongodump &> /dev/null; then
    echo -e "${RED}Error: mongodump not found!${NC}"
    echo -e "${YELLOW}Please install MongoDB tools.${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}Creating MongoDB backup...${NC}"
mongodump \
    --username="${MONGODB_USER}" \
    --password="${MONGODB_PASS}" \
    --authenticationDatabase="${MONGODB_AUTH_DB}" \
    --out="${BACKUP_DIR}/${BACKUP_NAME}"

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Compress the backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
    
    # Remove uncompressed directory
    rm -rf "${BACKUP_DIR}/${BACKUP_NAME}"
    
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ MongoDB backup created successfully!${NC}"
    echo -e "${GREEN}  Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz${NC}"
    echo -e "${GREEN}  Size: ${BACKUP_SIZE}${NC}"
    
    # Also create a copy with a simple name for easy access
    cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "${BACKUP_DIR}/mongodb-latest-backup.tar.gz"
    echo -e "${GREEN}  Latest backup copy: ${BACKUP_DIR}/mongodb-latest-backup.tar.gz${NC}"
else
    echo -e "${RED}✗ MongoDB backup failed!${NC}"
    exit 1
fi

echo -e "${GREEN}MongoDB backup process completed!${NC}"

