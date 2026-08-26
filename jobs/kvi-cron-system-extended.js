const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// ============================================
// ADDITIONAL CRON JOBS FOR KVI
// ============================================

// Base URL configuration - use environment variable or default to production
const BASE_URL = process.env.BASE_URL || 'https://khannainstitute.com';
const IS_PRODUCTION = BASE_URL.includes('khannainstitute.com');

// CRON JOB 4: SSL Certificate Monitoring
const checkSSLCertificate = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    certificates: [],
    warnings: []
  };

  try {
    const domains = [
      'khannainstitute.com',
      'www.khannainstitute.com',
      'api.khannainstitute.com'
    ];

    for (const domain of domains) {
      try {
        await new Promise((resolve, reject) => {
          const options = {
            host: domain,
            port: 443,
            method: 'GET',
            rejectUnauthorized: false
          };

          const req = https.request(options, (res) => {
            try {
              const cert = res.socket.getPeerCertificate();
              
              if (!cert || !cert.valid_to) {
                result.certificates.push({
                  domain,
                  status: 'error',
                  error: 'Certificate information not available'
                });
                resolve();
                return;
              }

              const expiryDate = new Date(cert.valid_to);
              const daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

              result.certificates.push({
                domain,
                issuer: cert.issuer?.O || 'Unknown',
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                daysUntilExpiry,
                status: daysUntilExpiry > 30 ? 'valid' : 'expiring_soon'
              });

              if (daysUntilExpiry <= 30) {
                result.warnings.push({
                  domain,
                  message: `SSL certificate expiring in ${daysUntilExpiry} days`,
                  severity: daysUntilExpiry <= 7 ? 'critical' : 'warning'
                });
              }

              resolve();
            } catch (certError) {
              result.certificates.push({
                domain,
                status: 'error',
                error: certError.message
              });
              resolve();
            }
          });

          req.on('error', (error) => {
            result.certificates.push({
              domain,
              status: 'error',
              error: error.message
            });
            resolve(); // Don't reject, just log the error
          });

          req.setTimeout(10000, () => {
            req.destroy();
            result.certificates.push({
              domain,
              status: 'error',
              error: 'Request timeout'
            });
            resolve();
          });

          req.end();
        });
      } catch (error) {
        result.certificates.push({
          domain,
          status: 'error',
          error: error.message
        });
      }
    }

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// CRON JOB 5: Form Testing & CRM Integration Check
const testFormSubmissions = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    forms: [],
    crmIntegration: {}
  };

  // Skip form testing in development unless explicitly enabled
  if (!IS_PRODUCTION && !process.env.ENABLE_FORM_TESTING) {
    result.status = 'skipped';
    result.message = 'Form testing skipped in development mode';
    return result;
  }

  try {
    // Test forms on key pages - adjust URLs based on environment
    const formsToTest = [
      {
        url: `${BASE_URL}/api/booking/submit`,
        formId: 'booking-form',
        testData: {
          fullName: 'Test User KVI Monitor',
          email: 'test@kvimonitor.local',
          phone: '555-TEST-001',
          age: '30',
          location: 'Beverly Hills',
          date: '2024-12-31',
          time: '10:00 AM'
        }
      },
      {
        url: `${BASE_URL}/api/booking/online-consult`,
        formId: 'online-consult-form',
        testData: {
          firstName: 'Test',
          lastName: 'Monitor',
          email: 'test-consult@kvimonitor.local',
          phone: '555-TEST-002',
          dob: '1990-01-01',
          age: '34',
          reason: 'Automated test - please ignore'
        }
      }
    ];

    for (const form of formsToTest) {
      try {
        // Submit test form
        const response = await axios.post(form.url, form.testData, {
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Submission': 'true' // Flag for your backend to handle differently
          },
          timeout: 10000,
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });

        // Check if submission was successful
        const success = response.status === 200 || response.status === 201;

        // Verify Zoho CRM integration (optional, only if token is available)
        let crmCheck = { found: false, skipped: true };
        if (process.env.ZOHO_TOKEN) {
          crmCheck = await checkZohoCRM(form.testData.email);
        }

        result.forms.push({
          url: form.url,
          formId: form.formId,
          submissionStatus: success ? 'success' : 'failed',
          statusCode: response.status,
          crmStatus: crmCheck.skipped ? 'skipped' : (crmCheck.found ? 'synced' : 'not_found'),
          responseTime: response.headers['x-response-time'] || 'N/A'
        });

      } catch (error) {
        result.forms.push({
          url: form.url,
          formId: form.formId,
          submissionStatus: 'error',
          error: error.message,
          statusCode: error.response?.status || 'N/A'
        });
      }
    }

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// CRON JOB 6: Schema Markup Validation
const validateSchemaMarkup = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    pages: [],
    stats: {}
  };

  try {
    // Pages that must have proper schema
    const criticalPages = [
      { url: '/', requiredSchema: ['Organization', 'LocalBusiness', 'MedicalBusiness'] },
      { url: '/procedures/lens-solutions/pie/', requiredSchema: ['MedicalProcedure', 'Product'] },
      { url: '/procedures/laser-vision/smile-laser/', requiredSchema: ['MedicalProcedure', 'Product'] },
      { url: '/about/dr-khanna/biography/', requiredSchema: ['Person', 'Physician'] },
      { url: '/about/locations/beverly-hills/', requiredSchema: ['LocalBusiness', 'Place'] },
      { url: '/about/locations/westlake-village/', requiredSchema: ['LocalBusiness', 'Place'] }
    ];

    let validCount = 0;
    let invalidCount = 0;
    let missingCount = 0;

    for (const page of criticalPages) {
      try {
        const response = await axios.get(`${BASE_URL}${page.url}`, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (response.status !== 200) {
          result.pages.push({
            url: page.url,
            error: `HTTP ${response.status}`,
            valid: false
          });
          invalidCount++;
          continue;
        }

        const $ = cheerio.load(response.data);
        
        // Find all schema markup
        const schemas = [];
        $('script[type="application/ld+json"]').each((i, elem) => {
          try {
            const schemaText = $(elem).html();
            if (!schemaText) return;
            
            const schema = JSON.parse(schemaText);
            schemas.push(schema);
          } catch (e) {
            // Invalid JSON in schema
            invalidCount++;
          }
        });

        // Extract schema types - handle both single strings and arrays
        const foundTypes = [];
        schemas.forEach(schema => {
          if (Array.isArray(schema['@type'])) {
            foundTypes.push(...schema['@type']);
          } else if (schema['@type']) {
            foundTypes.push(schema['@type']);
          }
          // Handle nested schemas
          if (schema['@graph'] && Array.isArray(schema['@graph'])) {
            schema['@graph'].forEach(item => {
              if (Array.isArray(item['@type'])) {
                foundTypes.push(...item['@type']);
              } else if (item['@type']) {
                foundTypes.push(item['@type']);
              }
            });
          }
        });

        const missingSchemas = page.requiredSchema.filter(
          required => !foundTypes.includes(required)
        );

        result.pages.push({
          url: page.url,
          foundSchemas: foundTypes,
          missingSchemas,
          valid: missingSchemas.length === 0,
          schemaCount: schemas.length
        });

        if (missingSchemas.length === 0) {
          validCount++;
        } else {
          missingCount++;
        }

      } catch (error) {
        result.pages.push({
          url: page.url,
          error: error.message,
          valid: false
        });
        invalidCount++;
      }
    }

    result.stats = {
      totalChecked: criticalPages.length,
      valid: validCount,
      invalid: invalidCount,
      missing: missingCount,
      complianceRate: criticalPages.length > 0 
        ? ((validCount / criticalPages.length) * 100).toFixed(2) + '%'
        : '0%'
    };

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// CRON JOB 7: Internal Link Health & Context Wheel
const checkInternalLinking = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    linkHealth: {},
    contextWheels: [],
    recommendations: []
  };

  try {
    // Map of related procedures for context wheel
    const procedureRelationships = {
      'procedures/lens-solutions/pie/': ['lasik', 'prk', 'smile-laser', 'cataract-surgery'],
      'procedures/laser-vision/smile-laser/': ['lasik', 'prk', 'evo-icl', 'pie'],
      'procedures/laser-vision/lasik/': ['smile-laser', 'prk', 'evo-icl', 'cxl-keratoconus'],
      'procedures/lens-solutions/evo-icl/': ['smile-laser', 'lasik', 'pie']
    };

    // Check each procedure page
    for (const [procedure, relatedProcedures] of Object.entries(procedureRelationships)) {
      const pageUrl = `${BASE_URL}/${procedure}`;
      
      try {
        const response = await axios.get(pageUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (response.status !== 200) {
          result.contextWheels.push({
            page: procedure,
            error: `HTTP ${response.status}`
          });
          continue;
        }

        const $ = cheerio.load(response.data);
        
        // Find all internal links
        const internalLinks = [];
        $('a[href^="/"], a[href*="khannainstitute.com"]').each((i, elem) => {
          const href = $(elem).attr('href');
          const text = $(elem).text().trim();
          if (href && text) {
            internalLinks.push({ href, text });
          }
        });

        // Check for related procedure links (context wheel)
        const missingRelatedLinks = [];
        for (const related of relatedProcedures) {
          const hasLink = internalLinks.some(link => 
            link.href.includes(related)
          );
          if (!hasLink) {
            missingRelatedLinks.push(related);
          }
        }

        result.contextWheels.push({
          page: procedure,
          totalInternalLinks: internalLinks.length,
          relatedProcedureLinks: relatedProcedures.length - missingRelatedLinks.length,
          missingRelatedLinks,
          contextWheelComplete: missingRelatedLinks.length === 0
        });

        // Generate recommendations
        if (missingRelatedLinks.length > 0) {
          result.recommendations.push({
            page: procedure,
            action: 'add_related_links',
            links: missingRelatedLinks,
            priority: 'high'
          });
        }

      } catch (error) {
        result.contextWheels.push({
          page: procedure,
          error: error.message
        });
      }
    }

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// CRON JOB 8: Content Freshness & Word Count Validation
const validateContent = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    pages: [],
    stats: {}
  };

  try {
    // Get list of key pages to check
    const pagesToCheck = [
      '/',
      '/procedures/lens-solutions/pie/',
      '/procedures/laser-vision/smile-laser/',
      '/procedures/laser-vision/lasik/',
      '/procedures/lens-solutions/evo-icl/',
      '/about/dr-khanna/biography/',
      '/about/locations/beverly-hills/',
      '/about/locations/westlake-village/',
      '/contact/schedule-consultation/',
      '/blog/procedure-guides/'
    ];

    let tooShortCount = 0;
    let outdatedCount = 0;
    let goodCount = 0;

    for (const page of pagesToCheck) {
      try {
        const response = await axios.get(`${BASE_URL}${page}`, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (response.status !== 200) {
          result.pages.push({
            url: page,
            error: `HTTP ${response.status}`
          });
          continue;
        }

        const $ = cheerio.load(response.data);
        
        // Remove scripts and styles
        $('script, style, nav, header, footer').remove();
        
        // Get main content
        const mainContent = $('main, article, .content, #content, body').text();
        const wordCount = mainContent.split(/\s+/).filter(word => word.length > 0).length;
        
        // Check last modified date
        const lastModified = $('meta[property="article:modified_time"]').attr('content') ||
                            $('meta[name="last-modified"]').attr('content') ||
                            $('meta[property="og:updated_time"]').attr('content');
        
        const daysSinceModified = lastModified ? 
          Math.floor((new Date() - new Date(lastModified)) / (1000 * 60 * 60 * 24)) : null;
        
        const isTooShort = wordCount < 1500;
        const isOutdated = daysSinceModified && daysSinceModified > 180; // 6 months
        
        if (isTooShort) tooShortCount++;
        if (isOutdated) outdatedCount++;
        if (!isTooShort && !isOutdated) goodCount++;
        
        result.pages.push({
          url: page,
          wordCount,
          isTooShort,
          daysSinceModified,
          isOutdated,
          status: isTooShort || isOutdated ? 'needs_attention' : 'good'
        });
        
      } catch (error) {
        result.pages.push({
          url: page,
          error: error.message
        });
      }
    }

    result.stats = {
      totalChecked: result.pages.filter(p => !p.error).length,
      tooShort: tooShortCount,
      outdated: outdatedCount,
      good: goodCount,
      complianceRate: result.pages.filter(p => !p.error).length > 0
        ? ((goodCount / result.pages.filter(p => !p.error).length) * 100).toFixed(2) + '%'
        : '0%'
    };

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// CRON JOB 9: Core Web Vitals Monitoring
const checkCoreWebVitals = async () => {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    status: 'started',
    vitals: [],
    averages: {}
  };

  try {
    const pagesToCheck = [
      '/',
      '/procedures/lens-solutions/pie/',
      '/procedures/laser-vision/smile-laser/',
      '/about/locations/beverly-hills/',
      '/contact/schedule-consultation/'
    ];

    const API_KEY = process.env.PAGESPEED_API_KEY;
    
    if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
      result.status = 'skipped';
      result.message = 'PageSpeed API key not configured';
      return result;
    }
    
    for (const page of pagesToCheck) {
      const url = `${BASE_URL}${page}`;
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${API_KEY}&strategy=mobile`;
      
      try {
        const response = await axios.get(apiUrl, { timeout: 30000 });
        
        if (!response.data?.lighthouseResult) {
          result.vitals.push({
            url: page,
            error: 'Invalid API response'
          });
          continue;
        }

        const metrics = response.data.lighthouseResult.audits;
        const performanceScore = response.data.lighthouseResult.categories?.performance?.score || 0;
        
        result.vitals.push({
          url: page,
          lcp: metrics['largest-contentful-paint']?.numericValue || 0,
          fid: metrics['max-potential-fid']?.numericValue || 0,
          cls: metrics['cumulative-layout-shift']?.numericValue || 0,
          score: performanceScore * 100,
          status: performanceScore >= 0.9 ? 'good' : 'needs_improvement'
        });
        
      } catch (error) {
        result.vitals.push({
          url: page,
          error: error.message
        });
      }
    }

    // Calculate averages
    const validVitals = result.vitals.filter(v => !v.error);
    if (validVitals.length > 0) {
      result.averages = {
        avgLCP: (validVitals.reduce((sum, v) => sum + (v.lcp || 0), 0) / validVitals.length).toFixed(0),
        avgFID: (validVitals.reduce((sum, v) => sum + (v.fid || 0), 0) / validVitals.length).toFixed(0),
        avgCLS: (validVitals.reduce((sum, v) => sum + (v.cls || 0), 0) / validVitals.length).toFixed(3),
        avgScore: (validVitals.reduce((sum, v) => sum + (v.score || 0), 0) / validVitals.length).toFixed(1)
      };
    }

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
};

// Helper function to check Zoho CRM
async function checkZohoCRM(email) {
  if (!process.env.ZOHO_TOKEN) {
    return { found: false, skipped: true };
  }

  try {
    const zohoResponse = await axios.get(
      `https://www.zohoapis.com/crm/v2/Leads/search?email=${email}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_TOKEN}`
        },
        timeout: 10000
      }
    );
    return { found: zohoResponse.data?.data && zohoResponse.data.data.length > 0 };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

// Export all additional cron jobs
module.exports = {
  checkSSLCertificate,
  testFormSubmissions,
  validateSchemaMarkup,
  checkInternalLinking,
  validateContent,
  checkCoreWebVitals
};

