#!/bin/bash

# Simple deployment: Replace old dashboard with Master Report
# Keeps all existing cron jobs, just changes the dashboard

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SSH_KEY="/Users/nisha/Desktop/khannainstitute_backup/khannainstitute.pem"
SSH_USER="ec2-user"
SSH_HOST="ec2-52-207-211-13.compute-1.amazonaws.com"
MONITORING_DIR="/home/ec2-user/kvi-home/monitoring"
BACKUP_DIR="/home/ec2-user/kvi-home/monitoring/backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Master Report${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Backup
echo -e "${YELLOW}Step 1: Creating backup...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    mkdir -p ${BACKUP_DIR} && \
    cp ${MONITORING_DIR}/kvi-monitoring-backend-secure.js ${BACKUP_DIR}/ && \
    cp ${MONITORING_DIR}/kvi-monitoring-dashboard-secure.html ${BACKUP_DIR}/ 2>/dev/null || true && \
    echo 'Backup created at ${BACKUP_DIR}'
"
echo -e "${GREEN}✓ Backup complete${NC}"
echo ""

# Step 2: Upload master report files
echo -e "${YELLOW}Step 2: Uploading master report files...${NC}"
scp -i "${SSH_KEY}" \
    kvi-master-report.html \
    kvi-master-report.css \
    kvi-master-report.js \
    ${SSH_USER}@${SSH_HOST}:${MONITORING_DIR}/

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 3: Modify existing backend to serve master report
echo -e "${YELLOW}Step 3: Updating backend to serve master report...${NC}"

# Create a patch script that will modify the backend
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} << 'ENDPATCH'
cd /home/ec2-user/kvi-home/monitoring

# Backup the original
cp kvi-monitoring-backend-secure.js kvi-monitoring-backend-secure.js.backup

# Replace dashboard route to serve master report
sed -i "s|res.sendFile(path.join(__dirname, 'kvi-monitoring-dashboard-secure.html'));|res.sendFile(path.join(__dirname, 'kvi-master-report.html'));|g" kvi-monitoring-backend-secure.js

# Add master report static file routes before the dashboard route
# Find the line with app.get('/dashboard' and add routes before it
python3 << 'PYTHONSCRIPT'
import re

with open('kvi-monitoring-backend-secure.js', 'r') as f:
    content = f.read()

# Add static file routes before dashboard route
static_routes = '''
// Serve master report static files
app.get('/kvi-master-report.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'kvi-master-report.css'));
});

app.get('/kvi-master-report.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'kvi-master-report.js'));
});

// Master report routes
app.get('/master-report', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'kvi-master-report.html'));
});

app.get('/master.html', requireAuth, (req, res) => {
  res.redirect('/master-report');
});

'''

# Find the dashboard route and insert before it
pattern = r"(app\.get\('/dashboard', requireAuth,)"
replacement = static_routes + r"\1"

content = re.sub(pattern, replacement, content)

# Also update root route to redirect to master report
content = re.sub(
    r"app\.get\('/', requireAuth,.*?res\.sendFile\(path\.join\(__dirname, 'kvi-monitoring-dashboard-secure\.html'\)\);",
    "app.get('/', requireAuth, (req, res) => {\n  res.redirect('/master-report');\n});",
    content
)

with open('kvi-monitoring-backend-secure.js', 'w') as f:
    f.write(content)

print("Backend updated successfully")
PYTHONSCRIPT

echo "Backend modification complete"
ENDPATCH

echo -e "${GREEN}✓ Backend updated${NC}"
echo ""

# Step 4: Add master report API endpoints
echo -e "${YELLOW}Step 4: Adding master report API endpoints...${NC}"

ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} << 'ENDAPI'
cd /home/ec2-user/kvi-home/monitoring

# Add API endpoints for master report
# Find where API routes are and add master report endpoints
python3 << 'PYTHONAPI'
import re

with open('kvi-monitoring-backend-secure.js', 'r') as f:
    content = f.read()

# Add jobResults mapping for master report compatibility
# Find the jobResults or inMemoryStorage section and add mapping
job_results_mapping = '''
// Master Report API - Map job results
app.get('/api/jobs/:jobType', requireAuth, (req, res) => {
  const { jobType } = req.params;
  const limit = parseInt(req.query.limit) || 1;
  
  // Map job types to internal storage
  const jobTypeMap = {
    'schemaValidation': 'schemaValidation',
    'sslCheck': 'sslCheck',
    'formTesting': 'formTesting',
    'internalLinks': 'internalLinking',
    'internalLinking': 'internalLinking',
    'contentValidation': 'contentValidation',
    'coreWebVitals': 'coreWebVitals',
    'fourOhFour': 'fourOhFour',
    'ogTagsValidation': 'ogTagsValidation',
    'metaTagsValidation': 'metaTagsValidation',
    'imageAltValidation': 'imageAltValidation',
    'canonicalValidation': 'canonicalValidation',
    'robotsTagValidation': 'robotsTagValidation',
    'externalLinks': 'externalLinks',
    'brokenLinks': 'brokenLinks',
    'sitemapValidation': 'sitemapValidation',
    'structuredDataValidation': 'structuredDataValidation',
    'hreflangValidation': 'hreflangValidation',
    'pagespeedValidation': 'pagespeedValidation'
  };
  
  // Get from jobHistory or inMemoryStorage
  const resultKey = jobTypeMap[jobType] || jobType;
  
  // Find matching job executions from jobHistory
  const matchingJobs = jobHistory
    .filter(job => {
      const jobName = job.jobName || '';
      return jobName.toLowerCase().includes(resultKey.toLowerCase()) || 
             jobName.toLowerCase().includes(jobType.toLowerCase());
    })
    .slice(0, limit)
    .map(job => ({
      status: job.status,
      timestamp: job.timestamp,
      duration: job.duration,
      stats: job.details || {},
      errors: job.details?.errors || [],
      ...job.details
    }));
  
  if (matchingJobs.length > 0) {
    res.json(matchingJobs);
  } else {
    res.json([]);
  }
});

// Quick action endpoints for master report
app.post('/api/run-all-healthy', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/fix/404-redirects', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/fix/generate-schemas', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/fix/add-alt-text', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/fix/canonical-tags', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/fix/expand-content', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

app.post('/api/email-report', requireAuth, (req, res) => {
  res.json({ message: 'Feature coming soon' });
});

'''

# Find a good place to insert (after other API routes, before app.listen)
# Look for app.listen or server start
pattern = r"(app\.listen\(|const PORT =)"
if re.search(pattern, content):
    # Insert before app.listen
    content = re.sub(
        r"(app\.listen\(|const PORT =)",
        job_results_mapping + r"\1",
        content,
        count=1
    )
else:
    # Append at end before module.exports or closing
    content = content.rstrip() + '\n' + job_results_mapping

with open('kvi-monitoring-backend-secure.js', 'w') as f:
    f.write(content)

print("API endpoints added")
PYTHONAPI

echo "API endpoints added"
ENDAPI

echo -e "${GREEN}✓ API endpoints added${NC}"
echo ""

# Step 5: Restart service
echo -e "${YELLOW}Step 5: Restarting service...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${MONITORING_DIR} && \
    pm2 restart kvi-monitoring && \
    pm2 save
"

echo -e "${GREEN}✓ Service restarted${NC}"
echo ""

# Step 6: Verify
echo -e "${YELLOW}Step 6: Verifying...${NC}"
sleep 3

if ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pm2 list | grep kvi-monitoring | grep online" > /dev/null; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}⚠ Check logs: pm2 logs kvi-monitoring${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Access Master Report:"
echo -e "  ${YELLOW}http://52.207.211.13:3002/login${NC}"
echo -e "  ${YELLOW}http://52.207.211.13:3002/master-report${NC}"
echo ""
echo -e "Backup: ${BACKUP_DIR}"
echo -e "Logs: ${YELLOW}pm2 logs kvi-monitoring${NC}"

