#!/bin/bash

# Secure MongoDB for HIPAA Compliance
# This script enables authentication and encryption

echo "================================================"
echo "Securing MongoDB for HIPAA Compliance"
echo "================================================"

# Note: Run these commands on your EC2 instance

cat << 'EOF'

Step 1: Connect to your EC2 server
-----------------------------------
ssh -i ~/Desktop/khannainstitute_backup/khannainstitute.pem ec2-user@52.207.211.13


Step 2: Create MongoDB admin user
----------------------------------
mongosh

use admin

db.createUser({
  user: "admin",
  pwd: "CHANGE_THIS_PASSWORD",  // Generate strong password!
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

exit


Step 3: Create database-specific user
--------------------------------------
mongosh

use blog  // Your blog database

db.createUser({
  user: "bloguser",
  pwd: "CHANGE_THIS_PASSWORD",  // Different strong password!
  roles: [ { role: "readWrite", db: "blog" } ]
})

exit


Step 4: Enable authentication
------------------------------
sudo vi /etc/mongod.conf

# Add these lines:
security:
  authorization: enabled

# Save and exit (:wq)


Step 5: Restart MongoDB
------------------------
sudo systemctl restart mongod
sudo systemctl status mongod


Step 6: Update your application
--------------------------------
# Update MongoDB connection string in your app:

OLD: mongodb://localhost:27017/blog
NEW: mongodb://bloguser:PASSWORD@localhost:27017/blog


Step 7: Test connection
-----------------------
mongosh "mongodb://bloguser:PASSWORD@localhost:27017/blog"

# Should connect successfully
# Then update your Express server's MongoDB connection string


✅ MongoDB is now secured!

EOF

echo ""
echo "Copy these commands and run them on your EC2 server"
echo ""

