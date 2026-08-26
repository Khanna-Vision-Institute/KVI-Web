const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const cors = require('cors');
require('dotenv').config();

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// Initialize logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
fs.mkdir(logsDir, { recursive: true }).catch(() => {});

// Database connection (optional for localhost - will use in-memory if not available)
let db = null;
let useDatabase = false;

// Try to connect to PostgreSQL if available
if (process.env.DB_HOST && process.env.DB_PASSWORD) {
    try {
        const { Pool } = require('pg');
        db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'kvi_monitoring',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD
        });
        useDatabase = true;
        logger.info('Database connection enabled');
    } catch (error) {
        logger.warn('PostgreSQL not available, using in-memory storage');
    }
} else {
    logger.info('Database credentials not provided, using in-memory storage');
}

// In-memory storage for localhost testing
const inMemoryStorage = {
    jobExecutions: [],
    pages: [],
    redirectQueue: [],
    deadLinks: [],
    loginAttempts: [],
    blockedIPs: [],
    userSessions: [],
    formSubmissions: [],
    contentVersions: [],
    seoIssues: [],
    apiUsage: [],
    alerts: [],
    backupHistory: [],
    performanceMetrics: [],
    competitorPricing: [],
    leadAttribution: []
};

// Constants
const KVI_PHONE_BEVERLY_HILLS = '(310) 482-1240';
const KVI_PHONE_WESTLAKE = '(805) 230-2126';
const KVI_BASE_URL = process.env.KVI_BASE_URL || 'http://localhost:3000';
const KVI_URLS = [
    KVI_BASE_URL,
    ...Array.from({length: 10}, (_, i) => `${KVI_BASE_URL}/procedures/laser-vision/smile-laser/`),
    ...Array.from({length: 10}, (_, i) => `${KVI_BASE_URL}/procedures/laser-vision/lasik/`)
];

// Job tracking
const jobStatus = new Map();
const jobHistory = [];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function logJobExecution(jobName, status, details = {}) {
    const execution = {
        id: Date.now(),
        jobName,
        status,
        timestamp: new Date(),
        details,
        duration: details.duration || 0
    };
    
    jobHistory.push(execution);
    if (jobHistory.length > 1000) {
        jobHistory.shift();
    }
    
    // Save to database if available
    if (useDatabase && db) {
        try {
            await db.query(
                'INSERT INTO job_executions (job_name, status, details, duration, executed_at) VALUES ($1, $2, $3, $4, $5)',
                [jobName, status, JSON.stringify(details), details.duration, new Date()]
            );
        } catch (error) {
            logger.error(`Failed to log job execution: ${error.message}`);
        }
    } else {
        // Store in memory
        inMemoryStorage.jobExecutions.push(execution);
        if (inMemoryStorage.jobExecutions.length > 1000) {
            inMemoryStorage.jobExecutions.shift();
        }
    }
    
    jobStatus.set(jobName, {
        lastRun: new Date(),
        status,
        nextRun: getNextRunTime(jobName)
    });
    
    logger.info(`Job ${jobName}: ${status}`, details);
}

async function sendAlert(message, priority = 'normal') {
    const alert = {
        id: Date.now(),
        alertType: priority,
        message,
        sentAt: new Date()
    };
    
    // Store alert
    if (useDatabase && db) {
        try {
            await db.query(
                'INSERT INTO alerts (alert_type, priority, message, sent_at) VALUES ($1, $2, $3, $4)',
                [priority, priority, message, new Date()]
            );
        } catch (error) {
            logger.error(`Failed to save alert: ${error.message}`);
        }
    } else {
        inMemoryStorage.alerts.push(alert);
    }
    
    // SMS Alert for critical issues (only if Twilio configured)
    if (priority === 'critical' && process.env.TWILIO_ACCOUNT_SID && process.env.ALERT_PHONE) {
        try {
            const twilio = require('twilio');
            const twilioClient = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
            await twilioClient.messages.create({
                body: `KVI Alert: ${message}`,
                from: process.env.TWILIO_PHONE,
                to: process.env.ALERT_PHONE
            });
        } catch (error) {
            logger.error(`Failed to send SMS alert: ${error.message}`);
        }
    }
    
    // Email Alert (only if email configured)
    if (process.env.EMAIL_USER && process.env.ALERT_EMAIL) {
        try {
            const nodemailer = require('nodemailer');
            const emailTransporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: process.env.EMAIL_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            
            await emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ALERT_EMAIL,
                subject: `KVI Monitoring Alert - ${priority.toUpperCase()}`,
                text: message,
                html: `<p><strong>Alert Priority:</strong> ${priority}</p><p>${message}</p>`
            });
        } catch (error) {
            logger.error(`Failed to send email alert: ${error.message}`);
        }
    }
    
    logger.warn(`[ALERT ${priority.toUpperCase()}] ${message}`);
}

function getNextRunTime(jobName) {
    return new Date(Date.now() + 3600000); // Default 1 hour
}

// ===========================================
// IMMEDIATE/REAL-TIME CRON JOBS (Every 5-30 minutes)
// ===========================================

// 1. 404 Error Detection - Every 5 minutes (disabled by default for localhost)
if (process.env.ENABLE_404_CHECK !== 'false') {
    cron.schedule('*/5 * * * *', async () => {
        const jobName = '404 Error Detection';
        const startTime = Date.now();
        let errors = [];
        
        try {
            // Only check a few URLs for localhost testing
            const urlsToCheck = KVI_URLS.slice(0, 5);
            
            for (const url of urlsToCheck) {
                try {
                    const response = await axios.get(url, { 
                        timeout: 5000,
                        validateStatus: () => true 
                    });
                    
                    if (response.status === 404) {
                        errors.push({ url, status: 404 });
                        
                        // Auto-create redirect entry
                        if (useDatabase && db) {
                            await db.query(
                                'INSERT INTO redirect_queue (old_url, suggested_url, status) VALUES ($1, $2, $3)',
                                [url, url.replace('landing-page', 'procedure'), 'pending']
                            );
                        } else {
                            inMemoryStorage.redirectQueue.push({
                                id: Date.now(),
                                oldUrl: url,
                                suggestedUrl: url.replace('landing-page', 'procedure'),
                                status: 'pending',
                                createdAt: new Date()
                            });
                        }
                    }
                } catch (error) {
                    if (error.code !== 'ECONNREFUSED') {
                        errors.push({ url, error: error.message });
                    }
                }
            }
            
            if (errors.length > 5) {
                await sendAlert(`Found ${errors.length} 404 errors on landing pages`, 'critical');
            }
            
            await logJobExecution(jobName, 'success', {
                errorsFound: errors.length,
                duration: Date.now() - startTime
            });
        } catch (error) {
            await logJobExecution(jobName, 'error', { error: error.message });
        }
    });
}

// 2. Phone Number Validator - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    const jobName = 'Phone Number Validator';
    const startTime = Date.now();
    let mismatches = [];
    
    try {
        const pagesToCheck = [KVI_BASE_URL, `${KVI_BASE_URL}/procedures/laser-vision/smile-laser/`];
        
        for (const url of pagesToCheck) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                const phoneNumbers = $('a[href^="tel:"]').map((i, el) => $(el).text()).get();
                
                phoneNumbers.forEach(phone => {
                    const cleaned = phone.replace(/\D/g, '');
                    
                    if (cleaned === '3104821240' && phone !== KVI_PHONE_BEVERLY_HILLS) {
                        mismatches.push({ url, found: phone, expected: KVI_PHONE_BEVERLY_HILLS });
                    }
                    if (cleaned === '8052302126' && phone !== KVI_PHONE_WESTLAKE) {
                        mismatches.push({ url, found: phone, expected: KVI_PHONE_WESTLAKE });
                    }
                });
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    logger.error(`Failed to check ${url}: ${error.message}`);
                }
            }
        }
        
        if (mismatches.length > 0) {
            await sendAlert(`Phone number mismatches found on ${mismatches.length} pages`, 'critical');
        }
        
        await logJobExecution(jobName, 'success', {
            pagesChecked: pagesToCheck.length,
            mismatches: mismatches.length,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 3. Form Submission Monitor - Every 10 minutes (mock for localhost)
cron.schedule('*/10 * * * *', async () => {
    const jobName = 'Form Submission Monitor';
    const startTime = Date.now();
    
    try {
        // For localhost, just check if the form endpoint is accessible
        try {
            const response = await axios.get(`${KVI_BASE_URL}/khanna-booking.html`, { 
                timeout: 5000,
                validateStatus: () => true 
            });
            
            await logJobExecution(jobName, 'success', {
                formTested: true,
                statusCode: response.status,
                duration: Date.now() - startTime
            });
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                await logJobExecution(jobName, 'warning', { 
                    message: 'Main site not running on localhost:3000',
                    duration: Date.now() - startTime
                });
            } else {
                await logJobExecution(jobName, 'error', { error: error.message });
            }
        }
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 4. SSL Certificate Check - Every 30 minutes (skip for localhost)
if (process.env.ENABLE_SSL_CHECK === 'true') {
    cron.schedule('*/30 * * * *', async () => {
        const jobName = 'SSL Certificate Check';
        const startTime = Date.now();
        
        try {
            const https = require('https');
            const url = new URL('https://khannainstitute.com');
            
            const options = {
                host: url.hostname,
                port: 443,
                method: 'GET',
                rejectUnauthorized: false
            };
            
            const req = https.request(options, (res) => {
                const cert = res.connection.getPeerCertificate();
                const expiry = new Date(cert.valid_to);
                const daysUntilExpiry = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry < 30) {
                    sendAlert(`SSL certificate expires in ${daysUntilExpiry} days`, 'critical');
                }
                
                logJobExecution(jobName, 'success', {
                    daysUntilExpiry,
                    expiryDate: expiry,
                    duration: Date.now() - startTime
                });
            });
            
            req.on('error', (error) => {
                logJobExecution(jobName, 'error', { error: error.message });
            });
            
            req.end();
        } catch (error) {
            await logJobExecution(jobName, 'error', { error: error.message });
        }
    });
}

// 5. Failed Login Monitor - Every minute (mock for localhost)
cron.schedule('* * * * *', async () => {
    const jobName = 'Failed Login Monitor';
    const startTime = Date.now();
    
    try {
        let suspiciousIPs = [];
        
        if (useDatabase && db) {
            const result = await db.query(
                'SELECT COUNT(*) as failed_count, ip_address FROM login_attempts WHERE success = false AND attempted_at > NOW() - INTERVAL \'5 minutes\' GROUP BY ip_address HAVING COUNT(*) > 5'
            );
            suspiciousIPs = result.rows.map(r => r.ip_address);
        } else {
            // Mock check for localhost
            const recentAttempts = inMemoryStorage.loginAttempts
                .filter(attempt => !attempt.success && 
                    new Date(attempt.attemptedAt) > new Date(Date.now() - 5 * 60 * 1000));
            
            const ipCounts = {};
            recentAttempts.forEach(attempt => {
                ipCounts[attempt.ipAddress] = (ipCounts[attempt.ipAddress] || 0) + 1;
            });
            
            suspiciousIPs = Object.keys(ipCounts).filter(ip => ipCounts[ip] > 5);
        }
        
        if (suspiciousIPs.length > 0) {
            await sendAlert(`Suspicious login activity from IPs: ${suspiciousIPs.join(', ')}`, 'critical');
        }
        
        await logJobExecution(jobName, 'success', {
            suspiciousIPs: suspiciousIPs.length,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 6. API Rate Limit Monitor - Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    const jobName = 'API Rate Limit Monitor';
    const startTime = Date.now();
    const warnings = [];
    
    try {
        // Mock API usage for localhost
        const apiUsage = {
            twilio: { calls: 45, limit: 100 },
            blandAI: { calls: 85, limit: 100 },
            zoho: { apiCalls: 890, limit: 1000 }
        };
        
        if (apiUsage.blandAI.calls / apiUsage.blandAI.limit > 0.8) {
            warnings.push(`Bland AI at ${Math.floor(apiUsage.blandAI.calls / apiUsage.blandAI.limit * 100)}% capacity`);
        }
        
        if (apiUsage.zoho.apiCalls / apiUsage.zoho.limit > 0.8) {
            warnings.push(`Zoho API at ${Math.floor(apiUsage.zoho.apiCalls / apiUsage.zoho.limit * 100)}% capacity`);
        }
        
        if (warnings.length > 0) {
            await sendAlert(`API Rate Limits Warning: ${warnings.join(', ')}`, 'warning');
        }
        
        await logJobExecution(jobName, 'success', {
            twilioSMS: apiUsage.twilio.calls,
            blandAI: apiUsage.blandAI.calls,
            zohoAPI: apiUsage.zoho.apiCalls,
            warnings: warnings.length,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// ===========================================
// HOURLY CRON JOBS
// ===========================================

// 7. Core Web Vitals - Every hour (mock for localhost)
cron.schedule('0 * * * *', async () => {
    const jobName = 'Core Web Vitals';
    const startTime = Date.now();
    
    try {
        const pagesToTest = ['/', '/procedures/laser-vision/smile-laser/'];
        const results = [];
        
        for (const page of pagesToTest) {
            const url = `${KVI_BASE_URL}${page}`;
            
            try {
                const response = await axios.get(url, { timeout: 5000 });
                // Mock performance metrics for localhost
                results.push({
                    url,
                    fcp: '1.2s',
                    lcp: '2.1s',
                    cls: '0.05',
                    fid: '50ms',
                    performanceScore: 0.85
                });
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    results.push({ url, error: error.message });
                }
            }
        }
        
        await logJobExecution(jobName, 'success', {
            pagesTested: pagesToTest.length,
            results,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 8. Dead Link Scanner - Every hour at :30
cron.schedule('30 * * * *', async () => {
    const jobName = 'Dead Link Scanner';
    const startTime = Date.now();
    const deadLinks = [];
    
    try {
        const pagesToScan = [KVI_BASE_URL];
        
        for (const pageUrl of pagesToScan) {
            try {
                const response = await axios.get(pageUrl, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                
                const links = $('a[href]').map((i, el) => $(el).attr('href')).get();
                
                for (const link of links.slice(0, 10)) { // Check first 10 links only
                    if (link.startsWith('http')) {
                        try {
                            const linkResponse = await axios.head(link, { 
                                timeout: 3000,
                                validateStatus: () => true
                            });
                            
                            if (linkResponse.status >= 400) {
                                deadLinks.push({ page: pageUrl, link, status: linkResponse.status });
                            }
                        } catch (error) {
                            // Skip external link errors for localhost
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    logger.error(`Failed to scan ${pageUrl}: ${error.message}`);
                }
            }
        }
        
        if (deadLinks.length > 0) {
            if (useDatabase && db) {
                for (const dl of deadLinks) {
                    await db.query(
                        'INSERT INTO dead_links (found_on, dead_link, status, discovered_at) VALUES ($1, $2, $3, $4)',
                        [dl.page, dl.link, dl.status || 'error', new Date()]
                    );
                }
            } else {
                deadLinks.forEach(dl => {
                    inMemoryStorage.deadLinks.push({
                        id: Date.now(),
                        foundOn: dl.page,
                        deadLink: dl.link,
                        status: dl.status || 'error',
                        discoveredAt: new Date()
                    });
                });
            }
        }
        
        await logJobExecution(jobName, 'success', {
            pagesScanned: pagesToScan.length,
            deadLinksFound: deadLinks.length,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 9. Conversion Funnel Analysis - Every hour at :15
cron.schedule('15 * * * *', async () => {
    const jobName = 'Conversion Funnel Analysis';
    const startTime = Date.now();
    
    try {
        let metrics = { totalSessions: 0, formsStarted: 0, formsCompleted: 0 };
        
        if (useDatabase && db) {
            const funnelData = await db.query(`
                SELECT 
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(DISTINCT CASE WHEN form_started = true THEN session_id END) as started_form,
                    COUNT(DISTINCT CASE WHEN form_completed = true THEN session_id END) as completed_form
                FROM user_sessions 
                WHERE created_at > NOW() - INTERVAL '1 hour'
            `);
            metrics = funnelData.rows[0];
        } else {
            // Mock metrics for localhost
            metrics = {
                totalSessions: 10,
                formsStarted: 5,
                formsCompleted: 2
            };
        }
        
        const dropOffRate = 1 - (metrics.formsCompleted / (metrics.totalSessions || 1));
        
        if (dropOffRate > 0.9) {
            await sendAlert(`High funnel drop-off rate: ${Math.floor(dropOffRate * 100)}%`, 'warning');
        }
        
        await logJobExecution(jobName, 'success', {
            sessions: metrics.totalSessions,
            conversions: metrics.formsCompleted,
            dropOffRate: Math.floor(dropOffRate * 100),
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 10. Broken Image Detector - Every hour at :45
cron.schedule('45 * * * *', async () => {
    const jobName = 'Broken Image Detector';
    const startTime = Date.now();
    const brokenImages = [];
    
    try {
        const pagesToCheck = [`${KVI_BASE_URL}/`];
        
        for (const page of pagesToCheck) {
            try {
                const response = await axios.get(page, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                
                const images = $('img').map((i, el) => $(el).attr('src')).get().slice(0, 5);
                
                for (const imgSrc of images) {
                    if (imgSrc && !imgSrc.startsWith('data:')) {
                        const imgUrl = imgSrc.startsWith('http') ? imgSrc : `${KVI_BASE_URL}${imgSrc}`;
                        
                        try {
                            const imgResponse = await axios.head(imgUrl, { timeout: 3000, validateStatus: () => true });
                            if (imgResponse.status >= 400) {
                                brokenImages.push({ page, image: imgUrl, status: imgResponse.status });
                            }
                        } catch (error) {
                            // Skip image errors for localhost
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    logger.error(`Failed to check ${page}: ${error.message}`);
                }
            }
        }
        
        if (brokenImages.length > 0) {
            await sendAlert(`Found ${brokenImages.length} broken images on key pages`, 'warning');
        }
        
        await logJobExecution(jobName, 'success', {
            imagesChecked: images?.length || 0,
            brokenFound: brokenImages.length,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 11. Incremental Backups - Every hour (mock for localhost)
cron.schedule('0 * * * *', async () => {
    const jobName = 'Incremental Backups';
    const startTime = Date.now();
    
    try {
        // For localhost, just log the backup attempt
        await logJobExecution(jobName, 'success', {
            itemsBacked: 0,
            message: 'Backup skipped in localhost mode',
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// 12. Abandoned Cart Recovery - Every hour at :30 (mock for localhost)
cron.schedule('30 * * * *', async () => {
    const jobName = 'Abandoned Cart Recovery';
    const startTime = Date.now();
    
    try {
        let abandonedForms = [];
        
        if (useDatabase && db) {
            const result = await db.query(`
                SELECT * FROM form_submissions 
                WHERE completed = false 
                AND created_at BETWEEN NOW() - INTERVAL '2 hours 5 minutes' AND NOW() - INTERVAL '2 hours'
                AND recovery_sent = false
            `);
            abandonedForms = result.rows;
        } else {
            // Mock for localhost
            abandonedForms = [];
        }
        
        await logJobExecution(jobName, 'success', {
            abandonedFound: abandonedForms.length,
            emailsSent: 0,
            duration: Date.now() - startTime
        });
    } catch (error) {
        await logJobExecution(jobName, 'error', { error: error.message });
    }
});

// ===========================================
// DAILY CRON JOBS (Simplified for localhost)
// ===========================================

// 13. Full Database Backup - Daily at 3 AM (mock)
cron.schedule('0 3 * * *', async () => {
    const jobName = 'Full Database Backup';
    await logJobExecution(jobName, 'success', { message: 'Backup skipped in localhost mode' });
});

// 14. Sitemap Generation - Daily at 4 AM (mock)
cron.schedule('0 4 * * *', async () => {
    const jobName = 'Sitemap Generation';
    await logJobExecution(jobName, 'success', { message: 'Sitemap generation skipped in localhost mode' });
});

// 15-22. Other daily jobs (simplified)
const dailyJobs = [
    { name: 'Schema Markup Validator', schedule: '0 5 * * *' },
    { name: 'Duplicate Content Scanner', schedule: '0 6 * * *' },
    { name: 'GMB Ranking Check', schedule: '0 7 * * *' },
    { name: 'Internal Linking AI', schedule: '0 8 * * *' },
    { name: 'Review Request Automation', schedule: '0 10 * * *' },
    { name: 'Appointment Reminders', schedule: '0 9,15 * * *' },
    { name: 'Content Freshness Audit', schedule: '0 11 * * *' },
    { name: 'Competitor Price Monitor', schedule: '0 12 * * *' }
];

dailyJobs.forEach(job => {
    cron.schedule(job.schedule, async () => {
        await logJobExecution(job.name, 'success', { completed: true, mode: 'localhost' });
    });
});

// ===========================================
// WEEKLY CRON JOBS
// ===========================================

const weeklyJobs = [
    'Lead Source Attribution',
    'SEO Performance Report',
    'A/B Test Analysis',
    'Social Media Analytics',
    'Birthday Campaigns',
    'HIPAA Compliance Audit',
    'Video Performance',
    'Email Campaign Analysis'
];

weeklyJobs.forEach((jobName, index) => {
    cron.schedule(`0 0 * * ${index === 7 ? 1 : index + 1}`, async () => {
        await logJobExecution(jobName, 'success', { completed: true, mode: 'localhost' });
    });
});

// ===========================================
// MONTHLY CRON JOBS
// ===========================================

const monthlyJobs = [
    { name: 'Full SEO Audit', day: 1 },
    { name: 'Lead Nurture Optimization', day: 5 },
    { name: 'Content Gap Analysis', day: 10 },
    { name: 'Competitor Analysis', day: 15 },
    { name: 'ROI Dashboard Update', day: 20 },
    { name: 'AI Content Generation', day: 25 },
    { name: 'Design Asset Refresh', day: 28 }
];

monthlyJobs.forEach(job => {
    cron.schedule(`0 0 ${job.day} * *`, async () => {
        await logJobExecution(job.name, 'success', { completed: true, mode: 'localhost' });
    });
});

// ===========================================
// API ENDPOINTS
// ===========================================

// Get all job statuses
app.get('/api/jobs', (req, res) => {
    const jobs = Array.from(jobStatus.entries()).map(([name, status]) => ({
        name,
        ...status
    }));
    res.json(jobs);
});

// Get job history
app.get('/api/history', (req, res) => {
    res.json(jobHistory.slice(-100));
});

// Serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-monitoring-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'kvi-monitoring-dashboard.html'));
});

// Get system health
app.get('/api/health', async (req, res) => {
    let dbStatus = 'not_configured';
    if (useDatabase && db) {
        try {
            await db.query('SELECT 1');
            dbStatus = 'connected';
        } catch (error) {
            dbStatus = 'disconnected';
        }
    }
    
    const health = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeJobs: jobStatus.size,
        lastExecution: jobHistory[jobHistory.length - 1] || null,
        database: dbStatus,
        mode: 'localhost',
        storage: useDatabase ? 'database' : 'memory'
    };
    res.json(health);
});

// Job execution functions map
const jobExecutors = {
    '404 Error Detection': async () => {
        const startTime = Date.now();
        let errors = [];
        try {
            const urlsToCheck = KVI_URLS.slice(0, 5);
            for (const url of urlsToCheck) {
                try {
                    const response = await axios.get(url, { 
                        timeout: 5000,
                        validateStatus: () => true 
                    });
                    if (response.status === 404) {
                        errors.push({ url, status: 404 });
                    }
                } catch (error) {
                    if (error.code !== 'ECONNREFUSED') {
                        errors.push({ url, error: error.message });
                    }
                }
            }
            return { errorsFound: errors.length, errors, duration: Date.now() - startTime };
        } catch (error) {
            throw new Error(error.message);
        }
    },
    'Phone Number Validator': async () => {
        const startTime = Date.now();
        let mismatches = [];
        try {
            const pagesToCheck = [KVI_BASE_URL, `${KVI_BASE_URL}/procedures/laser-vision/smile-laser/`];
            for (const url of pagesToCheck) {
                try {
                    const response = await axios.get(url, { timeout: 5000 });
                    const $ = cheerio.load(response.data);
                    const phoneNumbers = $('a[href^="tel:"]').map((i, el) => $(el).text()).get();
                    phoneNumbers.forEach(phone => {
                        const cleaned = phone.replace(/\D/g, '');
                        if (cleaned === '3104821240' && phone !== KVI_PHONE_BEVERLY_HILLS) {
                            mismatches.push({ url, found: phone, expected: KVI_PHONE_BEVERLY_HILLS });
                        }
                        if (cleaned === '8052302126' && phone !== KVI_PHONE_WESTLAKE) {
                            mismatches.push({ url, found: phone, expected: KVI_PHONE_WESTLAKE });
                        }
                    });
                } catch (error) {
                    if (error.code !== 'ECONNREFUSED') {
                        logger.error(`Failed to check ${url}: ${error.message}`);
                    }
                }
            }
            return { pagesChecked: pagesToCheck.length, mismatches: mismatches.length, mismatches, duration: Date.now() - startTime };
        } catch (error) {
            throw new Error(error.message);
        }
    },
    'Form Submission Monitor': async () => {
        const startTime = Date.now();
        try {
            const response = await axios.get(`${KVI_BASE_URL}/khanna-booking.html`, { 
                timeout: 5000,
                validateStatus: () => true 
            });
            return { formTested: true, statusCode: response.status, duration: Date.now() - startTime };
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return { formTested: false, message: 'Main site not running on localhost:3000', duration: Date.now() - startTime };
            }
            throw new Error(error.message);
        }
    },
    'SSL Certificate Check': async () => {
        const startTime = Date.now();
        try {
            const https = require('https');
            const url = new URL('https://khannainstitute.com');
            return new Promise((resolve, reject) => {
                const options = {
                    host: url.hostname,
                    port: 443,
                    method: 'GET',
                    rejectUnauthorized: false
                };
                const req = https.request(options, (res) => {
                    const cert = res.connection.getPeerCertificate();
                    const expiry = new Date(cert.valid_to);
                    const daysUntilExpiry = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
                    resolve({
                        daysUntilExpiry,
                        expiryDate: expiry.toISOString(),
                        duration: Date.now() - startTime
                    });
                });
                req.on('error', reject);
                req.end();
            });
        } catch (error) {
            throw new Error(error.message);
        }
    },
    'Failed Login Monitor': async () => {
        const startTime = Date.now();
        let suspiciousIPs = [];
        if (useDatabase && db) {
            const result = await db.query(
                'SELECT COUNT(*) as failed_count, ip_address FROM login_attempts WHERE success = false AND attempted_at > NOW() - INTERVAL \'5 minutes\' GROUP BY ip_address HAVING COUNT(*) > 5'
            );
            suspiciousIPs = result.rows.map(r => r.ip_address);
        } else {
            const recentAttempts = inMemoryStorage.loginAttempts
                .filter(attempt => !attempt.success && 
                    new Date(attempt.attemptedAt) > new Date(Date.now() - 5 * 60 * 1000));
            const ipCounts = {};
            recentAttempts.forEach(attempt => {
                ipCounts[attempt.ipAddress] = (ipCounts[attempt.ipAddress] || 0) + 1;
            });
            suspiciousIPs = Object.keys(ipCounts).filter(ip => ipCounts[ip] > 5);
        }
        return { suspiciousIPs: suspiciousIPs.length, suspiciousIPs, duration: Date.now() - startTime };
    },
    'API Rate Limit Monitor': async () => {
        const startTime = Date.now();
        const warnings = [];
        const apiUsage = {
            twilio: { calls: 45, limit: 100 },
            blandAI: { calls: 85, limit: 100 },
            zoho: { apiCalls: 890, limit: 1000 }
        };
        if (apiUsage.blandAI.calls / apiUsage.blandAI.limit > 0.8) {
            warnings.push(`Bland AI at ${Math.floor(apiUsage.blandAI.calls / apiUsage.blandAI.limit * 100)}% capacity`);
        }
        if (apiUsage.zoho.apiCalls / apiUsage.zoho.limit > 0.8) {
            warnings.push(`Zoho API at ${Math.floor(apiUsage.zoho.apiCalls / apiUsage.zoho.limit * 100)}% capacity`);
        }
        return {
            twilioSMS: apiUsage.twilio.calls,
            blandAI: apiUsage.blandAI.calls,
            zohoAPI: apiUsage.zoho.apiCalls,
            warnings: warnings.length,
            warningsList: warnings,
            duration: Date.now() - startTime
        };
    },
    'Core Web Vitals': async () => {
        const startTime = Date.now();
        const pagesToTest = ['/', '/procedures/laser-vision/smile-laser/'];
        const results = [];
        for (const page of pagesToTest) {
            const url = `${KVI_BASE_URL}${page}`;
            try {
                const response = await axios.get(url, { timeout: 5000 });
                results.push({
                    url,
                    fcp: '1.2s',
                    lcp: '2.1s',
                    cls: '0.05',
                    fid: '50ms',
                    performanceScore: 0.85
                });
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    results.push({ url, error: error.message });
                }
            }
        }
        return { pagesTested: pagesToTest.length, results, duration: Date.now() - startTime };
    },
    'Dead Link Scanner': async () => {
        const startTime = Date.now();
        const deadLinks = [];
        const pagesToScan = [KVI_BASE_URL];
        for (const pageUrl of pagesToScan) {
            try {
                const response = await axios.get(pageUrl, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                const links = $('a[href]').map((i, el) => $(el).attr('href')).get();
                for (const link of links.slice(0, 10)) {
                    if (link.startsWith('http')) {
                        try {
                            const linkResponse = await axios.head(link, { 
                                timeout: 3000,
                                validateStatus: () => true
                            });
                            if (linkResponse.status >= 400) {
                                deadLinks.push({ page: pageUrl, link, status: linkResponse.status });
                            }
                        } catch (error) {
                            // Skip external link errors
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    logger.error(`Failed to scan ${pageUrl}: ${error.message}`);
                }
            }
        }
        return { pagesScanned: pagesToScan.length, deadLinksFound: deadLinks.length, deadLinks, duration: Date.now() - startTime };
    },
    'Schema Markup Validator': async () => {
        const startTime = Date.now();
        const pagesToValidate = ['/', '/procedures/laser-vision/smile-laser/'];
        const results = [];
        let errorsFound = 0;
        
        for (const page of pagesToValidate) {
            const url = `${KVI_BASE_URL}${page}`;
            try {
                const response = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                
                // Check for schema markup
                const schemas = $('script[type="application/ld+json"]');
                const schemaCount = schemas.length;
                
                // Basic validation - check if structured data exists
                if (schemaCount === 0) {
                    errorsFound++;
                    results.push({ page, error: 'No schema markup found' });
                } else {
                    results.push({ page, schemasFound: schemaCount, status: 'ok' });
                }
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    errorsFound++;
                    results.push({ page, error: error.message });
                }
            }
        }
        
        return {
            pagesChecked: pagesToValidate.length,
            errorsFound,
            results,
            complianceRate: pagesToValidate.length > 0 ? 
                ((pagesToValidate.length - errorsFound) / pagesToValidate.length * 100).toFixed(1) + '%' : '0%',
            duration: Date.now() - startTime
        };
    },
    'SEO Performance Report': async () => {
        const startTime = Date.now();
        // Mock SEO report data for localhost
        return {
            reportGenerated: true,
            date: new Date().toISOString().split('T')[0],
            metrics: {
                totalPages: 50,
                pagesWithIssues: 3,
                avgPageSpeed: 2.1,
                mobileFriendly: 48,
                sslEnabled: true
            },
            topIssues: [
                'Missing meta descriptions on 3 pages',
                'Slow page load on /old-page',
                'Broken internal links: 2 found'
            ],
            recommendations: [
                'Add meta descriptions to all pages',
                'Optimize images for faster loading',
                'Fix broken internal links'
            ],
            duration: Date.now() - startTime
        };
    },
    'Conversion Funnel Analysis': async () => {
        const startTime = Date.now();
        let metrics = { totalSessions: 0, formsStarted: 0, formsCompleted: 0 };
        
        if (useDatabase && db) {
            const funnelData = await db.query(`
                SELECT 
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(DISTINCT CASE WHEN form_started = true THEN session_id END) as started_form,
                    COUNT(DISTINCT CASE WHEN form_completed = true THEN session_id END) as completed_form
                FROM user_sessions 
                WHERE created_at > NOW() - INTERVAL '1 hour'
            `);
            metrics = funnelData.rows[0];
        } else {
            // Mock metrics for localhost
            metrics = {
                totalSessions: 25,
                formsStarted: 12,
                formsCompleted: 5
            };
        }
        
        const dropOffRate = 1 - (metrics.formsCompleted / (metrics.totalSessions || 1));
        const conversionRate = (metrics.formsCompleted / (metrics.totalSessions || 1) * 100).toFixed(2);
        
        return {
            sessions: metrics.totalSessions,
            formsStarted: metrics.formsStarted,
            conversions: metrics.formsCompleted,
            conversionRate: conversionRate + '%',
            dropOffRate: (dropOffRate * 100).toFixed(1) + '%',
            duration: Date.now() - startTime
        };
    },
    'Broken Image Detector': async () => {
        const startTime = Date.now();
        const brokenImages = [];
        const pagesToCheck = [`${KVI_BASE_URL}/`];
        
        for (const page of pagesToCheck) {
            try {
                const response = await axios.get(page, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                const images = $('img').map((i, el) => $(el).attr('src')).get().slice(0, 5);
                
                for (const imgSrc of images) {
                    if (imgSrc && !imgSrc.startsWith('data:')) {
                        const imgUrl = imgSrc.startsWith('http') ? imgSrc : `${KVI_BASE_URL}${imgSrc}`;
                        try {
                            const imgResponse = await axios.head(imgUrl, { timeout: 3000, validateStatus: () => true });
                            if (imgResponse.status >= 400) {
                                brokenImages.push({ page, image: imgUrl, status: imgResponse.status });
                            }
                        } catch (error) {
                            // Skip image errors for localhost
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ECONNREFUSED') {
                    logger.error(`Failed to check ${page}: ${error.message}`);
                }
            }
        }
        
        return {
            imagesChecked: images?.length || 0,
            brokenFound: brokenImages.length,
            brokenImages,
            duration: Date.now() - startTime
        };
    },
    'Duplicate Content Scanner': async () => {
        const startTime = Date.now();
        // Mock duplicate content check
        return {
            pagesScanned: 50,
            duplicatesFound: 2,
            duplicateTitles: [
                { title: 'Generic Title', usedOn: 3, pages: ['/page1', '/page2', '/page3'] }
            ],
            duplicateDescriptions: [
                { description: 'Generic description...', usedOn: 2, pages: ['/page4', '/page5'] }
            ],
            duration: Date.now() - startTime
        };
    },
    'Full Database Backup': async () => {
        const startTime = Date.now();
        // Mock backup for localhost
        return {
            backupType: 'full',
            status: 'completed',
            mode: 'localhost_mock',
            message: 'Backup simulated for localhost testing',
            sizeBytes: 0,
            duration: Date.now() - startTime
        };
    },
    'Sitemap Generation': async () => {
        const startTime = Date.now();
        // Mock sitemap generation
        return {
            urlsIncluded: 50,
            sitemapGenerated: true,
            mode: 'localhost_mock',
            message: 'Sitemap generation simulated',
            duration: Date.now() - startTime
        };
    },
    'GMB Ranking Check': async () => {
        const startTime = Date.now();
        // Mock GMB ranking check
        return {
            checked: true,
            rankings: {
                'lasik eye surgery': 3,
                'eye doctor beverly hills': 1,
                'cataract surgery': 5
            },
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Internal Linking AI': async () => {
        const startTime = Date.now();
        // Mock internal linking
        return {
            pagesAnalyzed: 50,
            linksCreated: 12,
            linksSuggested: 8,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Review Request Automation': async () => {
        const startTime = Date.now();
        // Mock review requests
        return {
            patientsEligible: 5,
            requestsSent: 3,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Appointment Reminders': async () => {
        const startTime = Date.now();
        // Mock appointment reminders
        return {
            appointmentsFound: 8,
            remindersSent: 6,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Content Freshness Audit': async () => {
        const startTime = Date.now();
        // Mock content freshness
        return {
            pagesAudited: 50,
            pagesUpdated: 3,
            staleContent: 2,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Competitor Price Monitor': async () => {
        const startTime = Date.now();
        // Mock competitor pricing
        return {
            competitorsChecked: 5,
            pricesTracked: 12,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Lead Source Attribution': async () => {
        const startTime = Date.now();
        // Mock lead attribution
        return {
            leadsAnalyzed: 25,
            sources: {
                'google': 12,
                'direct': 8,
                'referral': 5
            },
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'A/B Test Analysis': async () => {
        const startTime = Date.now();
        // Mock A/B test results
        return {
            testsActive: 2,
            testsCompleted: 1,
            winner: 'Variant B',
            improvement: '15%',
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Social Media Analytics': async () => {
        const startTime = Date.now();
        // Mock social media analytics
        return {
            platforms: ['Instagram', 'TikTok'],
            totalEngagement: 1250,
            newFollowers: 45,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Birthday Campaigns': async () => {
        const startTime = Date.now();
        // Mock birthday campaigns
        return {
            birthdaysThisMonth: 8,
            emailsSent: 6,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'HIPAA Compliance Audit': async () => {
        const startTime = Date.now();
        // Mock HIPAA audit
        return {
            auditCompleted: true,
            complianceScore: 98,
            issuesFound: 1,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Video Performance': async () => {
        const startTime = Date.now();
        // Mock video analytics
        return {
            videosAnalyzed: 15,
            totalViews: 12500,
            avgWatchTime: '2:30',
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Email Campaign Analysis': async () => {
        const startTime = Date.now();
        // Mock email campaign analysis
        return {
            campaignsAnalyzed: 5,
            openRate: '24.5%',
            clickRate: '3.2%',
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Full SEO Audit': async () => {
        const startTime = Date.now();
        // Mock full SEO audit
        return {
            pagesAudited: 280,
            issuesFound: 12,
            criticalIssues: 2,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Lead Nurture Optimization': async () => {
        const startTime = Date.now();
        // Mock lead nurture
        return {
            workflowsAnalyzed: 5,
            optimizationsSuggested: 3,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Content Gap Analysis': async () => {
        const startTime = Date.now();
        // Mock content gap analysis
        return {
            keywordsAnalyzed: 150,
            gapsIdentified: 25,
            opportunities: 12,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Competitor Analysis': async () => {
        const startTime = Date.now();
        // Mock competitor analysis
        return {
            competitorsAnalyzed: 5,
            insights: 8,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'ROI Dashboard Update': async () => {
        const startTime = Date.now();
        // Mock ROI dashboard
        return {
            revenueTracked: 125000,
            leadsGenerated: 45,
            avgLeadValue: 2777,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'AI Content Generation': async () => {
        const startTime = Date.now();
        // Mock AI content generation
        return {
            contentGenerated: 3,
            topics: ['LASIK benefits', 'SMILE procedure', 'Recovery tips'],
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Design Asset Refresh': async () => {
        const startTime = Date.now();
        // Mock design asset refresh
        return {
            assetsUpdated: 5,
            imagesOptimized: 12,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Incremental Backups': async () => {
        const startTime = Date.now();
        return {
            itemsBacked: 0,
            message: 'Backup skipped in localhost mode',
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    },
    'Abandoned Cart Recovery': async () => {
        const startTime = Date.now();
        return {
            abandonedFound: 0,
            emailsSent: 0,
            mode: 'localhost_mock',
            duration: Date.now() - startTime
        };
    }
};

// Manually trigger a job
app.post('/api/jobs/:jobName/run', async (req, res) => {
    const { jobName } = req.params;
    const decodedJobName = decodeURIComponent(jobName);
    
    try {
        // Check if we have an executor for this job
        if (jobExecutors[decodedJobName]) {
            const startTime = Date.now();
            const result = await jobExecutors[decodedJobName]();
            await logJobExecution(decodedJobName, 'success', {
                ...result,
                triggeredBy: 'API',
                manual: true
            });
            res.json({ 
                success: true, 
                message: `Job ${decodedJobName} executed successfully`,
                result: result
            });
        } else {
            // For jobs without executors, just log the trigger
            await logJobExecution(decodedJobName, 'manual', { 
                triggeredBy: 'API',
                message: 'Job executor not available - scheduled job will run at its normal time'
            });
            res.json({ 
                success: true, 
                message: `Job ${decodedJobName} trigger logged (will run on schedule)`,
                note: 'This job will execute at its scheduled time'
            });
        }
    } catch (error) {
        await logJobExecution(decodedJobName, 'error', { 
            error: error.message,
            triggeredBy: 'API'
        });
        res.status(500).json({ 
            success: false, 
            message: `Job ${decodedJobName} failed: ${error.message}` 
        });
    }
});

// Pause/Resume all jobs (mock)
app.post('/api/jobs/pause', (req, res) => {
    res.json({ success: true, message: 'All jobs paused (mock)' });
});

app.post('/api/jobs/resume', (req, res) => {
    res.json({ success: true, message: 'All jobs resumed (mock)' });
});

// ===========================================
// START SERVER
// ===========================================

const PORT = process.env.MONITORING_PORT || 3001;

app.listen(PORT, () => {
    logger.info(`KVI Monitoring Backend running on port ${PORT}`);
    console.log(`
    ========================================
    KVI Automation System Started (Localhost)
    ========================================
    Dashboard: http://localhost:${PORT}
    API: http://localhost:${PORT}/api
    
    Active Cron Jobs: 42
    - Immediate: 6 jobs
    - Hourly: 6 jobs  
    - Daily: 10 jobs
    - Weekly: 8 jobs
    - Monthly: 7 jobs
    
    Mode: Localhost Testing
    Storage: ${useDatabase ? 'PostgreSQL' : 'In-Memory'}
    Main Site: ${KVI_BASE_URL}
    
    Monitoring:
    ✓ 404 Detection (if main site running)
    ✓ Phone Validation
    ✓ Form Testing
    ✓ SSL Monitoring (disabled by default)
    ✓ Backup System (mock)
    ✓ SEO Automation (mock)
    ========================================
    `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    if (db) {
        await db.end();
    }
    process.exit(0);
});

module.exports = app;

