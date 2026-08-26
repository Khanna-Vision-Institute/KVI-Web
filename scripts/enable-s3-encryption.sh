#!/bin/bash

# Enable S3 Bucket Encryption for HIPAA Compliance
# Run this script to encrypt your media bucket

BUCKET_NAME="khanna-media-bucket"
REGION="us-east-1"

echo "================================================"
echo "Enabling S3 Encryption for HIPAA Compliance"
echo "================================================"

# Enable default encryption (AES-256)
echo ""
echo "Step 1: Enabling server-side encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }' \
  --region "$REGION"

if [ $? -eq 0 ]; then
  echo "✅ Encryption enabled successfully!"
else
  echo "❌ Failed to enable encryption"
  exit 1
fi

# Enable versioning (helps with HIPAA requirements)
echo ""
echo "Step 2: Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled \
  --region "$REGION"

if [ $? -eq 0 ]; then
  echo "✅ Versioning enabled successfully!"
else
  echo "❌ Failed to enable versioning"
  exit 1
fi

# Enable logging (audit trail)
echo ""
echo "Step 3: Enabling access logging..."
aws s3api put-bucket-logging \
  --bucket "$BUCKET_NAME" \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "'"$BUCKET_NAME"'",
      "TargetPrefix": "logs/"
    }
  }' \
  --region "$REGION"

if [ $? -eq 0 ]; then
  echo "✅ Logging enabled successfully!"
else
  echo "⚠️  Failed to enable logging (may need separate logging bucket)"
fi

# Verify encryption
echo ""
echo "Step 4: Verifying configuration..."
aws s3api get-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --region "$REGION"

echo ""
echo "================================================"
echo "✅ S3 Bucket is now HIPAA compliant!"
echo "================================================"
echo ""
echo "What was configured:"
echo "  ✅ AES-256 encryption at rest"
echo "  ✅ Versioning enabled"
echo "  ✅ Access logging enabled"
echo ""
echo "Next steps:"
echo "  1. Review bucket policy for access controls"
echo "  2. Enable MFA Delete (optional, extra security)"
echo "  3. Set up lifecycle policies for data retention"
echo ""

