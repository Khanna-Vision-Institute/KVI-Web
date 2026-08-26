#!/bin/bash

# Deploy Master Report to Production
# This script replaces the old monitoring dashboard with the new Master Report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SSH_KEY="/Users/nisha/Desktop/khannainstitute_backup/khannainstitute.pem"
SSH_USER="ec2-user"
SSH_HOST="ec2-52-207-211-13.compute-1.amazonaws.com"
MONITORING_DIR="/home/ec2-user/kvi-home/monitoring"
BACKUP_DIR="/home/ec2-user/kvi-home/monitoring/backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Master Report to Production${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Create backup
echo -e "${YELLOW}Step 1: Creating backup of current monitoring system...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    mkdir -p ${BACKUP_DIR} && \
    cp -r ${MONITORING_DIR}/* ${BACKUP_DIR}/ 2>/dev/null || true && \
    echo 'Backup created at ${BACKUP_DIR}'
"
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Step 2: Upload master report files
echo -e "${YELLOW}Step 2: Uploading master report files...${NC}"
scp -i "${SSH_KEY}" \
    kvi-master-report.html \
    kvi-master-report.css \
    kvi-master-report.js \
    ${SSH_USER}@${SSH_HOST}:${MONITORING_DIR}/

echo -e "${GREEN}✓ Master report files uploaded${NC}"
echo ""

# Step 3: Create new integrated backend
echo -e "${YELLOW}Step 3: Creating integrated backend with master report...${NC}"

# Read the current monitoring backend to understand its structure
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cat > ${MONITORING_DIR}/kvi-master-report-backend.js << 'EOFBACKEND'
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const winston = require('winston');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.monitoring') });

// Production security packages (optional)
let helmet = null;
let rateLimit = null;
try {
    helmet = require('helmet');
} catch (e) {
    console.log('helmet not installed');
}
try {
    rateLimit = require('express-rate-limit');
} catch (e) {
    console.log('express-rate-limit not installed');
}

// Initialize Express
const app = express();
app.use(express.json());

// Security headers
if (helmet) {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: [\"'self'\"],
                styleSrc: [\"'self'\", \"'unsafe-inline'\"],
                scriptSrc: [\"'self'\", \"'unsafe-inline'\", \"'unsafe-hashes'\"],
                scriptSrcAttr: [\"'unsafe-inline'\"],
                imgSrc: [\"'self'\", \"data:\", \"https:\"],
            },
        },
    }));
} else {
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
}

// CORS
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        callback(null, true);
    },
    credentials: true
}));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    name: 'kvi-monitoring-session',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: path.join(__dirname, 'logs', 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(__dirname, 'logs', 'combined.log') })
    ]
});

// Store job results (compatible with master report)
const jobResults = {
    backups: [],
    fourOhFour: [],
    phoneValidation: [],
    sslCheck: [],
    formTesting: [],
    schemaValidation: [],
    internalLinking: [],
    internalLinks: [],
    externalLinks: [],
    brokenLinks: [],
    contentValidation: [],
    coreWebVitals: [],
    ogTagsValidation: [],
    metaTagsValidation: [],
    imageAltValidation: [],
    canonicalValidation: [],
    robotsTagValidation: [],
    sitemapValidation: [],
    structuredDataValidation: [],
    hreflangValidation: [],
    pagespeedValidation: []
};

// Import existing cron jobs from old backend (if available)
let existingCronJobs = null;
try {
    // Try to load the old backend's job executors
    const oldBackend = require('./kvi-monitoring-backend-secure.js');
    if (oldBackend && oldBackend.jobExecutors) {
        existingCronJobs = oldBackend.jobExecutors;
    }
} catch (e) {
    console.log('Old backend not available, will use extended cron jobs');
}

// Import extended cron jobs
let extendedCronJobs = null;
try {
    extendedCronJobs = require('../jobs/kvi-cron-system-extended');
    console.log('[CRON] Extended cron jobs loaded');
} catch (error) {
    console.log('[CRON] Extended cron jobs not available');
}

// Schedule cron jobs (same as before)
if (extendedCronJobs) {
    // SSL check daily at 2am
    cron.schedule('0 2 * * *', async () => {
        try {
            const result = await extendedCronJobs.checkSSLCertificate();
            jobResults.sslCheck.unshift(result);
            if (jobResults.sslCheck.length > 50) jobResults.sslCheck.pop();
        } catch (error) {
            logger.error('SSL check error: ' + error.message);
        }
    });

    // Form testing every 4 hours
    cron.schedule('0 */4 * * *', async () => {
        try {
            const result = await extendedCronJobs.testFormSubmissions();
            jobResults.formTesting.unshift(result);
            if (jobResults.formTesting.length > 50) jobResults.formTesting.pop();
        } catch (error) {
            logger.error('Form testing error: ' + error.message);
        }
    });

    // Schema validation daily at 3am
    cron.schedule('0 3 * * *', async () => {
        try {
            const result = await extendedCronJobs.validateSchemaMarkup();
            jobResults.schemaValidation.unshift(result);
            if (jobResults.schemaValidation.length > 50) jobResults.schemaValidation.pop();
        } catch (error) {
            logger.error('Schema validation error: ' + error.message);
        }
    });

    // Internal linking weekly on Sundays at 4am
    cron.schedule('0 4 * * 0', async () => {
        try {
            const result = await extendedCronJobs.checkInternalLinking();
            jobResults.internalLinking.unshift(result);
            jobResults.internalLinks.unshift(result); // Alias
            if (jobResults.internalLinking.length > 50) jobResults.internalLinking.pop();
            if (jobResults.internalLinks.length > 50) jobResults.internalLinks.pop();
        } catch (error) {
            logger.error('Internal linking error: ' + error.message);
        }
    });

    // Content validation weekly on Mondays at 5am
    cron.schedule('0 5 * * 1', async () => {
        try {
            const result = await extendedCronJobs.validateContent();
            jobResults.contentValidation.unshift(result);
            if (jobResults.contentValidation.length > 50) jobResults.contentValidation.pop();
        } catch (error) {
            logger.error('Content validation error: ' + error.message);
        }
    });

    // Core Web Vitals daily at 6am
    cron.schedule('0 6 * * *', async () => {
        try {
            const result = await extendedCronJobs.checkCoreWebVitals();
            jobResults.coreWebVitals.unshift(result);
            if (jobResults.coreWebVitals.length > 50) jobResults.coreWebVitals.pop();
        } catch (error) {
            logger.error('Core Web Vitals error: ' + error.message);
        }
    });
}

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
};

// Routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-monitoring-login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'KVI2024Secure!ChangeMe';
    
    if (username === adminUser && password === adminPassword) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Serve master report dashboard
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-master-report.html'));
});

app.get('/master-report', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-master-report.html'));
});

app.get('/master.html', requireAuth, (req, res) => {
    res.redirect('/master-report');
});

// Serve static files
app.get('/kvi-master-report.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-master-report.css'));
});

app.get('/kvi-master-report.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-master-report.js'));
});

// API endpoint for master report - get job data
app.get('/api/jobs/:jobType', requireAuth, (req, res) => {
    const { jobType } = req.params;
    const limit = parseInt(req.query.limit) || 1;
    
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
    
    const resultKey = jobTypeMap[jobType] || jobType;
    const results = jobResults[resultKey] || [];
    
    res.json(results.slice(0, limit));
});

// Manual job trigger endpoint
app.post('/api/jobs/:jobType/run', requireAuth, async (req, res) => {
    const { jobType } = req.params;
    
    if (!extendedCronJobs) {
        return res.status(503).json({ error: 'Extended cron jobs not available' });
    }
    
    try {
        const jobMap = {
            'schemaValidation': () => extendedCronJobs.validateSchemaMarkup(),
            'sslCheck': () => extendedCronJobs.checkSSLCertificate(),
            'formTesting': () => extendedCronJobs.testFormSubmissions(),
            'internalLinks': () => extendedCronJobs.checkInternalLinking(),
            'internalLinking': () => extendedCronJobs.checkInternalLinking(),
            'contentValidation': () => extendedCronJobs.validateContent(),
            'coreWebVitals': () => extendedCronJobs.checkCoreWebVitals()
        };
        
        const job = jobMap[jobType];
        if (!job) {
            return res.status(404).json({ error: 'Job type not found' });
        }
        
        const result = await job();
        
        const resultKeyMap = {
            'schemaValidation': 'schemaValidation',
            'sslCheck': 'sslCheck',
            'formTesting': 'formTesting',
            'internalLinks': 'internalLinking',
            'internalLinking': 'internalLinking',
            'contentValidation': 'contentValidation',
            'coreWebVitals': 'coreWebVitals'
        };
        
        const resultKey = resultKeyMap[jobType];
        if (resultKey && jobResults[resultKey]) {
            jobResults[resultKey].unshift(result);
            if (jobResults[resultKey].length > 50) jobResults[resultKey].pop();
        }
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Quick action endpoints
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

// Health check
app.get('/api/status', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        jobs: Object.keys(jobResults).reduce((acc, key) => {
            acc[key] = jobResults[key].length > 0 ? jobResults[key][0] : null;
            return acc;
        }, {})
    });
});

// Start server
const PORT = process.env.MONITORING_PORT || 3002;
app.listen(PORT, () => {
    console.log(\`Master Report Backend running on port \${PORT}\`);
    console.log(\`Access at: http://localhost:\${PORT}\`);
});
EOFBACKEND
"

echo -e "${GREEN}✓ New backend created${NC}"
echo ""

# Step 4: Update PM2 ecosystem config
echo -e "${YELLOW}Step 4: Updating PM2 configuration...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "cat > ${MONITORING_DIR}/ecosystem-monitoring.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'kvi-monitoring',
    script: '${MONITORING_DIR}/kvi-master-report-backend.js',
    cwd: '${MONITORING_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_file: '${MONITORING_DIR}/.env.monitoring',
    error_file: '${MONITORING_DIR}/logs/monitoring-error.log',
    out_file: '${MONITORING_DIR}/logs/monitoring-out.log',
    log_file: '${MONITORING_DIR}/logs/monitoring-combined.log',
    time: true,
    merge_logs: true
  }]
};
EOFPM2
"

echo -e "${GREEN}✓ PM2 configuration updated${NC}"
echo ""

# Step 5: Restart service
echo -e "${YELLOW}Step 5: Restarting kvi-monitoring service...${NC}"
ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "
    cd ${MONITORING_DIR} && \
    pm2 stop kvi-monitoring 2>/dev/null || true && \
    pm2 delete kvi-monitoring 2>/dev/null || true && \
    pm2 start ecosystem-monitoring.config.js --update-env && \
    pm2 save
"

echo -e "${GREEN}✓ Service restarted${NC}"
echo ""

# Step 6: Verify
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
sleep 3

if ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} "pm2 list | grep kvi-monitoring | grep online" > /dev/null; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}⚠ Service may not be running. Check logs: pm2 logs kvi-monitoring${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Access the Master Report at:"
echo -e "  ${YELLOW}http://52.207.211.13:3002/login${NC}"
echo ""
echo -e "Backup location: ${BACKUP_DIR}"
echo ""
echo -e "To view logs: ${YELLOW}pm2 logs kvi-monitoring${NC}"
echo -e "To restart: ${YELLOW}pm2 restart kvi-monitoring${NC}"

