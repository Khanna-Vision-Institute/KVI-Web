#!/bin/bash

# Automated Encrypted Backups for HIPAA Compliance
# This creates daily encrypted backups to S3

BACKUP_BUCKET="khanna-backups-encrypted"  # Create this bucket
DB_BACKUP_DIR="/home/ec2-user/backups"
DATE=$(date +%Y%m%d_%H%M%S)
ENCRYPTION_PASSWORD="CHANGE_THIS_STRONG_PASSWORD"

echo "================================================"
echo "HIPAA-Compliant Backup Script"
echo "================================================"

# Create backup directory
mkdir -p "$DB_BACKUP_DIR"

# Backup MongoDB
echo ""
echo "Backing up MongoDB..."
mongodump --out "$DB_BACKUP_DIR/mongodb_$DATE"

# Backup SQLite (Strapi)
echo "Backing up Strapi SQLite..."
cp /home/ec2-user/kvi-home/strapi-cms/.tmp/data.db \
   "$DB_BACKUP_DIR/strapi_$DATE.db"

# Backup Strapi uploads
echo "Backing up Strapi uploads..."
tar -czf "$DB_BACKUP_DIR/strapi_uploads_$DATE.tar.gz" \
   /home/ec2-user/kvi-home/strapi-cms/public/uploads/

# Create encrypted archive
echo ""
echo "Creating encrypted archive..."
tar -czf - "$DB_BACKUP_DIR/"*"$DATE"* | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -pass pass:"$ENCRYPTION_PASSWORD" \
  -out "$DB_BACKUP_DIR/backup_$DATE.tar.gz.enc"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$DB_BACKUP_DIR/backup_$DATE.tar.gz.enc" \
  "s3://$BACKUP_BUCKET/backups/backup_$DATE.tar.gz.enc" \
  --server-side-encryption AES256

# Clean up local files (keep encrypted only)
echo "Cleaning up..."
rm -rf "$DB_BACKUP_DIR/mongodb_$DATE"
rm -f "$DB_BACKUP_DIR/strapi_$DATE.db"
rm -f "$DB_BACKUP_DIR/strapi_uploads_$DATE.tar.gz"

# Keep only last 30 days of local backups
find "$DB_BACKUP_DIR" -name "backup_*.tar.gz.enc" -mtime +30 -delete

echo ""
echo "✅ Backup completed successfully!"
echo "Location: s3://$BACKUP_BUCKET/backups/backup_$DATE.tar.gz.enc"
echo ""

# To restore:
cat << 'EOF'

To restore from backup:
-----------------------
1. Download from S3:
   aws s3 cp s3://BUCKET/backups/backup_DATE.tar.gz.enc ./

2. Decrypt:
   openssl enc -aes-256-cbc -d -pbkdf2 \
     -pass pass:"PASSWORD" \
     -in backup_DATE.tar.gz.enc \
     -out backup_DATE.tar.gz

3. Extract:
   tar -xzf backup_DATE.tar.gz

4. Restore MongoDB:
   mongorestore mongodb_DATE/

5. Restore Strapi:
   cp strapi_DATE.db /home/ec2-user/kvi-home/strapi-cms/.tmp/data.db

EOF

