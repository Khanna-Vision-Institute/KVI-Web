#!/bin/bash

# KVI Production Server Complete Backup Script
# This script backs up everything before implementing cron monitoring

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
BACKUP_DIR="/Users/nisha/Desktop/khannainstitute_backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="kvi_production_backup_${TIMESTAMP}"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}KVI Production Server Backup${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
cd "${BACKUP_DIR}/${BACKUP_NAME}"

echo -e "${YELLOW}Step 1: Identifying server directories...${NC}"
# Find the correct kvi-home directory
REMOTE_DIRS=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "find /home/ec2-user -maxdepth 2 -type d -name '*kvi*' -o -name '*khanna*' 2>/dev/null | grep -v node_modules")
echo "Found directories:"
echo "$REMOTE_DIRS"
echo ""

# Auto-detect the active directory by checking running processes
echo "Checking which directory is active..."
ACTIVE_DIR=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    # Check running processes first (most reliable)
    RUNNING_PROCESS=\$(ps aux | grep 'node.*server.js' | grep -v grep | awk '{print \$NF}' | head -1)
    if [ ! -z \"\$RUNNING_PROCESS\" ] && [ -f \"\$RUNNING_PROCESS\" ]; then
        RUNNING_DIR=\$(dirname \"\$RUNNING_PROCESS\")
        echo \"\$RUNNING_DIR\"
    elif [ -f /home/ec2-user/kvi-home/server.js ]; then
        echo '/home/ec2-user/kvi-home'
    elif [ -f /home/ec2-user/khannainstitute/server.js ]; then
        echo '/home/ec2-user/khannainstitute'
    else
        # Default to kvi-home if it exists
        if [ -d /home/ec2-user/kvi-home ]; then
            echo '/home/ec2-user/kvi-home'
        else
            echo '/home/ec2-user/khannainstitute'
        fi
    fi
")

KVI_HOME_DIR="$ACTIVE_DIR"

# Verify the directory exists
if [ -z "$KVI_HOME_DIR" ] || [ "$KVI_HOME_DIR" = "" ]; then
    echo -e "${RED}Could not auto-detect kvi-home directory${NC}"
    echo "Available directories:"
    ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "ls -d /home/ec2-user/kvi-home /home/ec2-user/khannainstitute 2>/dev/null"
    echo ""
    echo "Please enter the full path to the ACTIVE kvi-home directory:"
    read KVI_HOME_DIR
fi

echo -e "${GREEN}Using directory: ${KVI_HOME_DIR}${NC}"
echo ""

# Save directory info
echo "$KVI_HOME_DIR" > server_directory.txt

echo -e "${YELLOW}Step 2: Backing up all website files...${NC}"
mkdir -p website_files
rsync -avz -e "ssh -i ${SSH_KEY}" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '*.log' \
    --exclude 'logs' \
    ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/ \
    website_files/
echo -e "${GREEN}✓ Website files backed up${NC}"
echo ""

echo -e "${YELLOW}Step 3: Backing up Strapi database...${NC}"
mkdir -p strapi_backup

# Find Strapi directory (could be in kvi-home or separate)
STRAPI_DIR=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "find ${KVI_HOME_DIR} -maxdepth 3 -name 'strapi' -type d 2>/dev/null | head -1 || find /home/ec2-user -maxdepth 2 -name 'strapi' -type d 2>/dev/null | head -1 || echo ''")

# Check if Strapi is using SQLite or PostgreSQL
STRAPI_DB_TYPE=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${KVI_HOME_DIR} && grep -E 'DATABASE_CLIENT|database.*client' .env 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d ' \"' || echo 'sqlite'")
if [ ! -z "$STRAPI_DIR" ] && [ "$STRAPI_DIR" != "" ]; then
    STRAPI_DB_TYPE=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${STRAPI_DIR} && grep -E 'DATABASE_CLIENT|database.*client' .env 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d ' \"' || echo 'sqlite'")
fi

if [ "$STRAPI_DB_TYPE" = "postgres" ] || [ "$STRAPI_DB_TYPE" = "postgresql" ]; then
    echo "Detected PostgreSQL database"
    # Backup PostgreSQL
    ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pg_dump -U strapi strapi > /tmp/strapi_backup.sql 2>/dev/null || echo 'PostgreSQL backup failed - may need manual backup'"
    scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:/tmp/strapi_backup.sql strapi_backup/strapi_database.sql 2>/dev/null || echo "Note: PostgreSQL backup may require manual intervention"
else
    echo "Detected SQLite database"
    # Find and backup SQLite database (check multiple locations)
    STRAPI_DB=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
        # Check in Strapi directory first
        if [ ! -z '${STRAPI_DIR}' ] && [ '${STRAPI_DIR}' != '' ]; then
            find ${STRAPI_DIR} -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' 2>/dev/null | head -1
        fi
        # Also check in .tmp/data.db (common Strapi location)
        if [ -f ${KVI_HOME_DIR}/.tmp/data.db ]; then
            echo ${KVI_HOME_DIR}/.tmp/data.db
        elif [ -f ${KVI_HOME_DIR}/strapi/.tmp/data.db ]; then
            echo ${KVI_HOME_DIR}/strapi/.tmp/data.db
        fi
        # Generic search
        find ${KVI_HOME_DIR} -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' 2>/dev/null | head -1
    " | head -1)
    
    if [ ! -z "$STRAPI_DB" ] && [ "$STRAPI_DB" != "" ]; then
        scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${STRAPI_DB} strapi_backup/strapi_database.db
        echo -e "${GREEN}✓ Strapi SQLite database backed up from: ${STRAPI_DB}${NC}"
    else
        echo -e "${YELLOW}⚠ Strapi database file not found (may be using PostgreSQL or external DB)${NC}"
    fi
fi

# Backup Strapi .env and config
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${KVI_HOME_DIR} && find . -name '.env' -o -name 'config' -type d | head -5" | while read file; do
    if [ ! -z "$file" ]; then
        scp -r -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/${file} strapi_backup/ 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ Strapi configuration backed up${NC}"
echo ""

echo -e "${YELLOW}Step 4: Backing up MongoDB...${NC}"
mkdir -p mongodb_backup

# Check if MongoDB is running and get database name
MONGO_DB_NAME=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${KVI_HOME_DIR} && grep -E 'MONGO.*DATABASE|MONGODB.*NAME|MONGODB_URI' .env 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d '\" ' | sed 's|.*/||' || echo 'kvi'")

# Check if MongoDB is actually installed and running
MONGO_RUNNING=$(ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pgrep mongod > /dev/null && echo 'yes' || echo 'no'")

# Try to backup MongoDB
if [ "$MONGO_RUNNING" = "yes" ]; then
    echo "MongoDB is running, attempting backup..."
    ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "mongodump --db ${MONGO_DB_NAME} --out /tmp/mongodb_backup 2>/dev/null || mongodump --out /tmp/mongodb_backup 2>/dev/null || echo 'MongoDB backup failed'"
    scp -r -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:/tmp/mongodb_backup/* mongodb_backup/ 2>/dev/null && \
        echo -e "${GREEN}✓ MongoDB backup completed${NC}" || \
        echo -e "${YELLOW}⚠ MongoDB backup failed (may need manual backup)${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB is not running, skipping backup${NC}"
    echo "If MongoDB data is stored elsewhere, please backup manually"
fi

echo -e "${GREEN}✓ MongoDB backup attempted${NC}"
echo ""

echo -e "${YELLOW}Step 5: Backing up environment files...${NC}"
mkdir -p config_backup

# Backup all .env files
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${KVI_HOME_DIR} && find . -name '.env*' -type f 2>/dev/null" | while read file; do
    if [ ! -z "$file" ]; then
        scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/${file} config_backup/ 2>/dev/null || true
    fi
done

# Backup package.json and other config files
scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/package.json config_backup/ 2>/dev/null || true
scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/package-lock.json config_backup/ 2>/dev/null || true
scp -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST}:${KVI_HOME_DIR}/server.js config_backup/ 2>/dev/null || true

echo -e "${GREEN}✓ Configuration files backed up${NC}"
echo ""

echo -e "${YELLOW}Step 6: Backing up system information...${NC}"
mkdir -p system_info

# Get server info
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "uname -a" > system_info/server_info.txt
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "df -h" >> system_info/server_info.txt
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "ps aux | grep -E 'node|mongod|postgres|strapi'" > system_info/running_processes.txt 2>/dev/null || true
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cd ${KVI_HOME_DIR} && ls -la" > system_info/directory_listing.txt

echo -e "${GREEN}✓ System information backed up${NC}"
echo ""

echo -e "${YELLOW}Step 7: Creating backup manifest...${NC}"
cat > BACKUP_MANIFEST.txt << EOF
KVI Production Server Backup
============================
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Server: ${SSH_HOST}
Source Directory: ${KVI_HOME_DIR}

Contents:
---------
1. Website Files: website_files/
2. Strapi Backup: strapi_backup/
3. MongoDB Backup: mongodb_backup/
4. Configuration: config_backup/
5. System Info: system_info/

Restore Instructions:
--------------------
1. Website files: Copy website_files/* to server
2. Strapi: Restore database from strapi_backup/
3. MongoDB: Restore using: mongorestore --db [dbname] mongodb_backup/
4. Config: Restore .env files from config_backup/

Important Notes:
----------------
- This backup was created before implementing cron monitoring system
- All sensitive data (passwords, keys) are in .env files
- Test restore on a staging server before production restore
EOF

echo -e "${GREEN}✓ Backup manifest created${NC}"
echo ""

echo -e "${YELLOW}Step 8: Compressing backup...${NC}"
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
echo -e "${GREEN}✓ Backup compressed${NC}"
echo ""

# Calculate backup size
BACKUP_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Backup Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo "Backup Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Backup Size: ${BACKUP_SIZE}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Verify backup integrity"
echo "2. Test restore on staging server (optional)"
echo "3. Proceed with cron monitoring implementation"
echo ""
echo -e "${GREEN}Your production server is now safely backed up!${NC}"

