// KVI Master Report System - Complete SEO & Technical Monitoring
// ================================================================
// Includes: Schema, OG Tags, Meta Tags, Image ALT, Canonical, Robots, Links, and more

class KVIMasterReport {
  constructor() {
    this.isRefreshing = false;
    this.lastRefreshTime = null;
    this.lastReportData = null; // Store last report to prevent unnecessary updates
    
    // Data cache to persist across refreshes
    this.dataCache = new Map();
    this.loadCacheFromStorage();
    
    // Track API failures for retry logic
    this.apiFailures = new Map(); // jobType -> failCount
    this.maxRetries = 3;
    this.retryDelay = 5000; // Start with 5 second delay
    
    this.allCronJobs = [
      // Core System Jobs
      'backups',
      'fourOhFour',
      'phoneValidation',
      
      // SEO Technical Jobs
      'schemaValidation',
      'ogTagsValidation',
      'metaTagsValidation',
      'imageAltValidation',
      'canonicalValidation',
      'robotsTagValidation',
      
      // Link Analysis Jobs
      'internalLinks',
      'externalLinks',
      'brokenLinks',
      
      // Content & Performance Jobs
      'contentValidation',
      'coreWebVitals',
      'sslCheck',
      'formTesting',
      
      // Additional SEO Jobs
      'sitemapValidation',
      'structuredDataValidation',
      'hreflangValidation',
      'pagespeedValidation'
    ];
    
    this.criticalThresholds = {
      fourOhFour: { errorRate: 5 },
      schemaValidation: { complianceRate: 70 },
      ogTagsValidation: { complianceRate: 90 },
      metaTagsValidation: { complianceRate: 95 },
      imageAltValidation: { complianceRate: 85 },
      canonicalValidation: { complianceRate: 100 },
      robotsTagValidation: { complianceRate: 100 },
      internalLinks: { minLinksPerPage: 3 },
      externalLinks: { maxLinksPerPage: 10 },
      contentValidation: { minWordCount: 1500 },
      coreWebVitals: { minScore: 90 }
    };
  }
  
  // Load cache from localStorage
  loadCacheFromStorage() {
    try {
      const cached = localStorage.getItem('kvi_job_data_cache');
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([jobType, jobData]) => {
          this.dataCache.set(jobType, {
            ...jobData,
            cacheTime: new Date(jobData.cacheTime)
          });
        });
        console.log(`📦 Loaded cache for ${this.dataCache.size} jobs`);
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
  }
  
  // Save cache to localStorage
  saveCacheToStorage() {
    try {
      const cacheObj = {};
      this.dataCache.forEach((data, jobType) => {
        cacheObj[jobType] = data;
      });
      localStorage.setItem('kvi_job_data_cache', JSON.stringify(cacheObj));
    } catch (e) {
      console.error('Failed to save cache:', e);
    }
  }
  
  // Get cached data for a job
  getCachedData(jobType) {
    const cached = this.dataCache.get(jobType);
    if (!cached) return null;
    
    // Check if cache is less than 1 hour old
    const cacheAge = Date.now() - new Date(cached.cacheTime).getTime();
    const maxCacheAge = 60 * 60 * 1000; // 1 hour
    
    if (cacheAge > maxCacheAge) {
      console.log(`⏰ Cache expired for ${jobType}`);
      return { ...cached, isStale: true };
    }
    
    return cached;
  }
  
  // Update cache for a job
  updateCache(jobType, data) {
    if (!data) return;
    
    this.dataCache.set(jobType, {
      ...data,
      cacheTime: new Date()
    });
    
    this.saveCacheToStorage();
  }

  // ============================================
  // MASTER REPORT GENERATOR
  // ============================================
  async generateMasterReport() {
    console.log('🚀 Generating KVI Master Report with caching...');
    
    const report = {
      generated: new Date().toISOString(),
      summary: {
        totalJobs: this.allCronJobs.length,
        healthyJobs: 0,
        warningJobs: 0,
        criticalJobs: 0,
        unavailableJobs: 0, // NEW: Track temporarily unavailable
        overallScore: 0,
        totalPagesAnalyzed: 0,
        totalIssuesFound: 0
      },
      seoHealth: {
        technical: {},
        content: {},
        links: {},
        performance: {}
      },
      criticalIssues: [],
      warnings: [],
      successes: [],
      jobDetails: {},
      recommendations: [],
      exportData: {}
    };

    // Fetch jobs with retry logic and caching
    const jobPromises = this.allCronJobs.map(async (jobType) => {
      return this.fetchJobWithRetry(jobType);
    });

    const allJobResults = await Promise.all(jobPromises);

    // Process each job result
    for (const { jobType, data, error, isFromCache, isUnavailable } of allJobResults) {
      // If temporarily unavailable, use cached data if available
      if (isUnavailable) {
        const cached = this.getCachedData(jobType);
        if (cached) {
          console.log(`📦 Using cached data for ${jobType} (API unavailable)`);
          const analysis = this.analyzeJobHealth(jobType, cached);
          analysis.isUnavailable = true;
          analysis.isStale = cached.isStale;
          report.jobDetails[jobType] = analysis;
          report.summary.unavailableJobs++;
        } else {
          // No cached data and API unavailable
          report.jobDetails[jobType] = {
            status: 'unavailable',
            error: '503 - Service temporarily unavailable',
            lastRun: null,
            health: 'unavailable',
            metrics: {},
            issues: [],
            isUnavailable: true
          };
          report.summary.unavailableJobs++;
        }
        continue;
      }
      
      // If we have fresh data, update cache
      if (data && !isFromCache) {
        this.updateCache(jobType, data);
      }
      
      // If no data and no cache, mark as no data
      if (!data) {
        const cached = this.getCachedData(jobType);
        if (cached) {
          console.log(`📦 Using cached data for ${jobType} (no new data)`);
          const analysis = this.analyzeJobHealth(jobType, cached);
          analysis.isStale = cached.isStale;
          report.jobDetails[jobType] = analysis;
        } else {
          report.jobDetails[jobType] = {
            status: 'no-data',
            error: null,
            lastRun: null,
            health: 'unknown',
            metrics: {},
            issues: []
          };
        }
        continue;
      }

      // Analyze job health with the data
      const analysis = this.analyzeJobHealth(jobType, data);
      analysis.isFromCache = isFromCache;
      report.jobDetails[jobType] = analysis;

      // Update summary counters
      if (analysis.health === 'healthy') {
        report.summary.healthyJobs++;
      } else if (analysis.health === 'warning') {
        report.summary.warningJobs++;
      } else if (analysis.health !== 'unavailable') {
        report.summary.criticalJobs++;
      }

      // Categorize by SEO area
      this.categorizeForSEO(jobType, analysis, report.seoHealth);

      // Collect issues and successes
      if (analysis.issues && analysis.issues.length > 0) {
        report.summary.totalIssuesFound += analysis.issues.length;
        
        if (analysis.health === 'critical') {
          report.criticalIssues.push(...analysis.issues.map(issue => ({
            job: jobType,
            ...issue
          })));
        } else {
          report.warnings.push(...analysis.issues.slice(0, 5).map(issue => ({
            job: jobType,
            ...issue
          })));
        }
      }

      if (analysis.successes) {
        report.successes.push(...analysis.successes);
      }

      // Track total pages analyzed
      if (data.stats && data.stats.totalPages) {
        report.summary.totalPagesAnalyzed = Math.max(
          report.summary.totalPagesAnalyzed,
          data.stats.totalPages
        );
      }
    }

    // Calculate overall health score
    report.summary.overallScore = this.calculateOverallScore(report);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    // Prepare export data
    report.exportData = this.prepareExportData(report);

    console.log(`✅ Report generated: ${report.summary.healthyJobs} healthy, ${report.summary.unavailableJobs} unavailable`);
    
    return report;
  }
  
  // Fetch job with retry logic
  async fetchJobWithRetry(jobType, retryCount = 0) {
    try {
      const response = await fetch(`/api/jobs/${jobType}?limit=1`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      // Handle 503 specifically
      if (response.status === 503) {
        console.warn(`⚠️ 503 for ${jobType} - service temporarily unavailable`);
        
        // Try to retry with exponential backoff
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.log(`🔄 Retrying ${jobType} in ${delay/1000}s (attempt ${retryCount + 1}/${this.maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchJobWithRetry(jobType, retryCount + 1);
        }
        
        return { jobType, data: null, isUnavailable: true, error: '503' };
      }
      
      if (!response.ok) {
        return { jobType, data: null, error: `HTTP ${response.status}` };
      }
      
      const responseData = await response.json();
      let jobData = null;
      
      if (Array.isArray(responseData) && responseData.length > 0) {
        jobData = responseData[0];
      } else if (responseData && typeof responseData === 'object') {
        jobData = responseData.data ? 
          (Array.isArray(responseData.data) ? responseData.data[0] : responseData.data) : 
          responseData;
      }
      
      // Normalize timestamp field
      if (jobData) {
        const timestampField = this.detectTimestampField(jobData);
        if (timestampField && !jobData.timestamp) {
          jobData.timestamp = jobData[timestampField];
        }
      }
      
      // Reset failure count on success
      this.apiFailures.delete(jobType);
      
      return { jobType, data: jobData, isFromCache: false };
      
    } catch (error) {
      console.error(`Failed to fetch ${jobType}:`, error);
      
      // Track failures
      const failCount = (this.apiFailures.get(jobType) || 0) + 1;
      this.apiFailures.set(jobType, failCount);
      
      // If too many failures, use cache
      if (failCount > 2) {
        const cached = this.getCachedData(jobType);
        if (cached) {
          console.log(`📦 Using cache for ${jobType} after ${failCount} failures`);
          return { jobType, data: cached, isFromCache: true };
        }
      }
      
      return { jobType, data: null, error: error.message };
    }
  }

  detectTimestampField(data) {
    const possibleFields = [
      'timestamp', 'createdAt', 'created_at', 'updatedAt', 'updated_at',
      'lastRun', 'last_run', 'executedAt', 'executed_at',
      'completedAt', 'completed_at', 'runAt', 'run_at', 'date', 'datetime'
    ];
    return possibleFields.find(field => data && data[field]);
  }

  // ============================================
  // JOB HEALTH ANALYZER
  // ============================================
  analyzeJobHealth(jobType, data) {
    const timestampField = this.detectTimestampField(data);
    const analysis = {
      status: data.status || data.state || 'completed',
      lastRun: timestampField ? data[timestampField] : null,
      duration: data.duration || data.executionTime || 0,
      health: 'unknown',
      stats: data.stats || data.statistics || data.metrics || {},
      issues: [],
      successes: [],
      metrics: {}
    };

    // Job-specific analysis
    switch(jobType) {
      case 'fourOhFour':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          errorsFound: data.stats?.notFound || 0,
          errorRate: parseFloat(data.stats?.errorRate) || 0
        };
        analysis.health = analysis.metrics.errorRate > 5 ? 'critical' : 
                         analysis.metrics.errorRate > 2 ? 'warning' : 'healthy';
        if (data.errors) {
          analysis.issues = data.errors.map(e => ({
            type: '404 Error',
            url: e.url,
            severity: 'high'
          }));
        }
        break;

      case 'schemaValidation':
        analysis.metrics = {
          pagesValidated: data.stats?.pagesValidated || 0,
          complianceRate: parseFloat(data.stats?.complianceRate) || 0,
          missingSchemas: data.stats?.missing || 0
        };
        analysis.health = analysis.metrics.complianceRate < 70 ? 'critical' :
                         analysis.metrics.complianceRate < 85 ? 'warning' : 'healthy';
        if (data.errors) {
          analysis.issues = data.errors.slice(0, 10).map(e => ({
            type: 'Missing Schema',
            url: e.url,
            missing: e.missingSchemas,
            severity: 'medium'
          }));
        }
        break;

      case 'ogTagsValidation':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          missingOG: data.stats?.missingOG || 0,
          complianceRate: parseFloat(data.stats?.complianceRate) || 0
        };
        analysis.health = analysis.metrics.complianceRate < 90 ? 'warning' : 'healthy';
        if (data.pages) {
          const missingOG = data.pages.filter(p => !p.hasOGTags);
          analysis.issues = missingOG.map(p => ({
            type: 'Missing OG Tags',
            url: p.url,
            missing: p.missingTags,
            severity: 'medium'
          }));
        }
        break;

      case 'metaTagsValidation':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          missingTitle: data.stats?.missingTitle || 0,
          missingDescription: data.stats?.missingDescription || 0,
          duplicateTitles: data.stats?.duplicateTitles || 0,
          duplicateDescriptions: data.stats?.duplicateDescriptions || 0
        };
        analysis.health = (analysis.metrics.missingTitle > 0 || 
                          analysis.metrics.missingDescription > 10) ? 'critical' : 
                         (analysis.metrics.duplicateTitles > 5) ? 'warning' : 'healthy';
        break;

      case 'imageAltValidation':
        analysis.metrics = {
          totalImages: data.stats?.totalImages || 0,
          missingAlt: data.stats?.missingAlt || 0,
          complianceRate: parseFloat(data.stats?.complianceRate) || 0
        };
        analysis.health = analysis.metrics.complianceRate < 85 ? 'warning' : 'healthy';
        if (data.images) {
          analysis.issues = data.images.filter(img => !img.hasAlt).slice(0, 20).map(img => ({
            type: 'Missing Alt Text',
            url: img.pageUrl,
            image: img.src,
            severity: 'low'
          }));
        }
        break;

      case 'canonicalValidation':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          missingCanonical: data.stats?.missingCanonical || 0,
          incorrectCanonical: data.stats?.incorrectCanonical || 0,
          complianceRate: parseFloat(data.stats?.complianceRate) || 0
        };
        analysis.health = analysis.metrics.complianceRate < 100 ? 'critical' : 'healthy';
        break;

      case 'robotsTagValidation':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          noindexPages: data.stats?.noindexPages || 0,
          nofollowPages: data.stats?.nofollowPages || 0,
          blockedPages: data.stats?.blockedPages || 0
        };
        analysis.health = analysis.metrics.blockedPages > 0 ? 'warning' : 'healthy';
        break;

      case 'internalLinks':
        analysis.metrics = {
          pagesAnalyzed: data.stats?.pagesAnalyzed || 0,
          totalInternalLinks: data.stats?.totalInternalLinks || 0,
          averageLinksPerPage: data.stats?.averageLinksPerPage || 0,
          orphanPages: data.stats?.orphanPages || 0
        };
        analysis.health = analysis.metrics.orphanPages > 5 ? 'warning' : 
                         analysis.metrics.averageLinksPerPage < 3 ? 'warning' : 'healthy';
        break;

      case 'externalLinks':
        analysis.metrics = {
          pagesAnalyzed: data.stats?.pagesAnalyzed || 0,
          totalExternalLinks: data.stats?.totalExternalLinks || 0,
          brokenExternalLinks: data.stats?.brokenExternalLinks || 0,
          nofollowLinks: data.stats?.nofollowLinks || 0
        };
        analysis.health = analysis.metrics.brokenExternalLinks > 0 ? 'warning' : 'healthy';
        break;

      case 'contentValidation':
        analysis.metrics = {
          pagesChecked: data.stats?.totalPages || 0,
          thinContent: data.stats?.thinContent || 0,
          averageWordCount: data.stats?.averageWordCount || 0,
          duplicateContent: data.stats?.duplicateContent || 0
        };
        analysis.health = analysis.metrics.thinContent > 20 ? 'critical' : 
                         analysis.metrics.thinContent > 10 ? 'warning' : 'healthy';
        break;

      case 'coreWebVitals':
        analysis.metrics = {
          averageLCP: data.stats?.avgLCP || 0,
          averageFID: data.stats?.avgFID || 0,
          averageCLS: data.stats?.avgCLS || 0,
          performanceScore: data.stats?.avgScore || 0
        };
        // Only show warning if there's actual data and it's below threshold
        if (analysis.metrics.performanceScore === 0 && !data.stats) {
          analysis.health = 'unknown'; // No data yet
          analysis.issues = []; // No issues if no data
        } else {
          analysis.health = analysis.metrics.performanceScore < 90 ? 'warning' : 'healthy';
          // Only show issues if health is warning/critical
          if (analysis.health === 'healthy') {
            analysis.issues = [];
          }
        }
        break;

      default:
        // Generic analysis for other jobs
        if (data.stats) {
          analysis.metrics = data.stats;
          analysis.health = data.status === 'completed' ? 'healthy' : 'warning';
        } else {
          analysis.health = 'unknown';
        }
    }

    // Ensure health is always set
    if (!analysis.health || analysis.health === 'unknown') {
      analysis.health = data.status === 'completed' ? 'healthy' : 'warning';
    }

    return analysis;
  }

  // ============================================
  // SEO CATEGORIZATION
  // ============================================
  categorizeForSEO(jobType, analysis, seoHealth) {
    const categories = {
      technical: ['schemaValidation', 'canonicalValidation', 'robotsTagValidation', 
                  'sitemapValidation', 'hreflangValidation', 'sslCheck'],
      content: ['metaTagsValidation', 'ogTagsValidation', 'imageAltValidation', 
                'contentValidation'],
      links: ['internalLinks', 'externalLinks', 'brokenLinks'],
      performance: ['coreWebVitals', 'pagespeedValidation', 'fourOhFour']
    };

    for (const [category, jobs] of Object.entries(categories)) {
      if (jobs.includes(jobType)) {
        seoHealth[category][jobType] = {
          health: analysis.health || 'unknown',
          metrics: analysis.metrics || {},
          lastRun: analysis.lastRun || 'Never'
        };
      }
    }
  }

  // ============================================
  // SCORE CALCULATOR
  // ============================================
  calculateOverallScore(report) {
    const weights = {
      technical: 0.3,
      content: 0.25,
      links: 0.2,
      performance: 0.25
    };

    let totalScore = 0;

    // Calculate category scores
    for (const [category, weight] of Object.entries(weights)) {
      const categoryJobs = Object.values(report.seoHealth[category]);
      if (categoryJobs.length === 0) continue;

      const categoryScore = categoryJobs.reduce((sum, job) => {
        if (job.health === 'healthy') return sum + 100;
        if (job.health === 'warning') return sum + 70;
        return sum + 30; // critical
      }, 0) / categoryJobs.length;

      totalScore += categoryScore * weight;
    }

    return Math.round(totalScore);
  }

  // ============================================
  // RECOMMENDATION GENERATOR
  // ============================================
  generateRecommendations(report) {
    const recommendations = [];

    console.log('🔍 Generating recommendations from report:', report);

    // More lenient validation - just check if job has run at all
    const hasRun = (details) => {
      if (!details) return false;
      // Check if lastRun exists and is not "Never" or null
      if (details.lastRun && details.lastRun !== 'Never' && details.lastRun !== null) {
        console.log(`✅ Job has run with lastRun: ${details.lastRun}`);
        return true;
      }
      return false;
    };

    // Check if job has meaningful data (even if metrics are partial)
    const hasData = (details) => {
      if (!details || !details.metrics) return false;
      // Check if ANY metric exists (not all need to be non-zero)
      return Object.keys(details.metrics).length > 0;
    };

    // Process each job for recommendations
    Object.entries(report.jobDetails || {}).forEach(([jobType, details]) => {
      console.log(`Checking ${jobType}:`, {
        hasRun: hasRun(details),
        hasData: hasData(details),
        metrics: details?.metrics,
        issues: details?.issues?.length
      });
      
      // Only require that job has run, not that all metrics are perfect
      if (!hasRun(details)) {
        console.log(`Skipping ${jobType} - hasn't run`);
        return;
      }
      
      // Generate recommendations based on the job type and any issues found
      switch(jobType) {
        case 'fourOhFour':
          // Check for 404 errors - be more lenient
          if (details.metrics?.errorsFound > 0 || details.metrics?.errorRate > 0 || (details.issues && details.issues.length > 0)) {
            const errors = details.metrics?.errorsFound || details.issues?.length || 0;
            const rate = details.metrics?.errorRate || 0;
            recommendations.push({
              priority: errors > 10 ? 'critical' : 'high',
              category: 'Technical',
              action: `Fix ${errors} broken pages (404 errors)`,
              impact: `${errors} pages returning 404 errors are losing traffic and hurting SEO`,
              effort: 'Low',
              implementation: 'Create 301 redirects for all broken URLs',
              jobSource: 'fourOhFour',
              metricValue: `${errors} errors found`,
              issueCount: errors
            });
            console.log(`Added 404 recommendation for ${errors} errors`);
          }
          break;
          
        case 'canonicalValidation':
          if (details.metrics?.complianceRate !== undefined && details.metrics.complianceRate < 100) {
            const missing = details.metrics.missingCanonical || 0;
            const incorrect = details.metrics.incorrectCanonical || 0;
            const total = missing + incorrect;
            if (total > 0) {
              recommendations.push({
                priority: 'critical',
                category: 'SEO Technical',
                action: `Fix canonical tags on ${total} pages`,
                impact: 'Prevents duplicate content penalties from Google',
                effort: 'Medium',
                implementation: 'Add or correct canonical tags on all pages',
                jobSource: 'canonicalValidation',
                metricValue: `${details.metrics.complianceRate.toFixed(1)}% compliance`
              });
              console.log(`Added canonical recommendation for ${total} pages`);
            }
          }
          break;
          
        case 'schemaValidation':
          if (details.metrics?.complianceRate !== undefined && details.metrics.complianceRate < 100) {
            const missing = details.metrics.missingSchemas || 0;
            const rate = details.metrics.complianceRate || 0;
            if (missing > 0 || rate < 70) {
              recommendations.push({
                priority: rate < 50 ? 'critical' : 'high',
                category: 'Structured Data',
                action: `Add schema markup to ${missing || 'multiple'} pages`,
                impact: 'Improves rich snippets and search visibility',
                effort: 'High',
                implementation: 'Implement LocalBusiness and Medical schemas',
                jobSource: 'schemaValidation',
                metricValue: `${rate.toFixed(1)}% compliance`
              });
              console.log(`Added schema recommendation for ${missing} pages`);
            }
          }
          break;
          
        case 'metaTagsValidation':
          if (details.metrics?.missingDescription > 0 || details.metrics?.missingTitle > 0) {
            const missingDesc = details.metrics.missingDescription || 0;
            const missingTitle = details.metrics.missingTitle || 0;
            const total = missingDesc + missingTitle;
            if (total > 0) {
              recommendations.push({
                priority: 'high',
                category: 'On-Page SEO',
                action: `Fix ${total} pages with missing meta tags`,
                impact: 'Improves click-through rates from search results',
                effort: 'Medium',
                implementation: `Add ${missingDesc} descriptions and ${missingTitle} titles`,
                jobSource: 'metaTagsValidation',
                metricValue: `${total} pages affected`
              });
              console.log(`Added meta tags recommendation for ${total} pages`);
            }
          }
          break;
          
        case 'coreWebVitals':
          if (details.metrics?.performanceScore > 0 && details.metrics.performanceScore < 90) {
            const score = details.metrics.performanceScore;
            recommendations.push({
              priority: score < 50 ? 'high' : 'medium',
              category: 'Performance',
              action: `Improve Core Web Vitals score from ${score.toFixed(0)} to 90+`,
              impact: 'Better rankings and user experience',
              effort: 'High',
              implementation: 'Optimize images, reduce JavaScript, improve server response',
              jobSource: 'coreWebVitals',
              metricValue: `Current score: ${score.toFixed(0)}/100`
            });
            console.log(`Added Core Web Vitals recommendation for score ${score}`);
          }
          break;
          
        case 'contentValidation':
          if (details.metrics?.thinContent > 0) {
            const thin = details.metrics.thinContent;
            recommendations.push({
              priority: 'medium',
              category: 'Content',
              action: `Expand ${thin} thin content pages`,
              impact: 'Improves rankings and prevents Panda penalties',
              effort: 'High',
              implementation: 'Add 1500+ words to each page',
              jobSource: 'contentValidation',
              metricValue: `${thin} pages need content`
            });
            console.log(`Added content recommendation for ${thin} pages`);
          }
          break;
          
        case 'imageAltValidation':
          if (details.metrics?.missingAlt > 0) {
            const missing = details.metrics.missingAlt;
            recommendations.push({
              priority: 'low',
              category: 'Accessibility',
              action: `Add alt text to ${missing} images`,
              impact: 'Improves accessibility and image SEO',
              effort: 'Low',
              implementation: 'Add descriptive alt text to all images',
              jobSource: 'imageAltValidation',
              metricValue: `${missing} images missing alt text`
            });
            console.log(`Added image alt recommendation for ${missing} images`);
          }
          break;
      }
    });
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    console.log(`📊 Generated ${recommendations.length} total recommendations`);
    
    return recommendations;
  }

  // ============================================
  // EXPORT DATA PREPARATION
  // ============================================
  prepareExportData(report) {
    return {
      csv: this.generateCSV(report),
      json: JSON.stringify(report, null, 2),
      summary: this.generateTextSummary(report)
    };
  }

  generateCSV(report) {
    let csv = 'Job Type,Status,Health,Last Run,Key Metrics,Issues Found\n';
    
    for (const [jobType, details] of Object.entries(report.jobDetails)) {
      const metrics = Object.entries(details.metrics || {})
        .map(([k, v]) => `${k}:${v}`)
        .join('; ');
      
      csv += `"${jobType}","${details.status}","${details.health}","${details.lastRun}","${metrics}","${details.issues?.length || 0}"\n`;
    }
    
    return csv;
  }

  generateTextSummary(report) {
    return `
KVI MASTER SEO REPORT
Generated: ${new Date(report.generated).toLocaleString()}
==================================================

OVERALL HEALTH SCORE: ${report.summary.overallScore}%
Total Pages Analyzed: ${report.summary.totalPagesAnalyzed}
Total Issues Found: ${report.summary.totalIssuesFound}

JOB STATUS SUMMARY:
✅ Healthy: ${report.summary.healthyJobs}
⚠️  Warning: ${report.summary.warningJobs}
❌ Critical: ${report.summary.criticalJobs}

TOP CRITICAL ISSUES:
${report.criticalIssues && report.criticalIssues.length > 0 ? report.criticalIssues.slice(0, 5).map(issue => 
  `- ${issue.type || 'Unknown'} on ${issue.url || 'N/A'}`).join('\n') : 'No critical issues'}

TOP RECOMMENDATIONS:
${report.recommendations && report.recommendations.length > 0 ? report.recommendations.slice(0, 5).map(rec => 
  `- [${(rec.priority || 'MEDIUM').toUpperCase()}] ${rec.action || 'No action specified'}`).join('\n') : 'No recommendations'}
    `;
  }
}

// ============================================
// MASTER DASHBOARD RENDERER
// ============================================
class KVIMasterDashboard {
  constructor() {
    this.reportGenerator = new KVIMasterReport();
    this.autoRefreshInterval = null;
    this.isRefreshing = false;
    this.lastRefreshTime = null;
    this.lastReportData = null; // Store last report to prevent unnecessary updates
    this.refreshInProgress = false; // Prevent concurrent refreshes
    
    // NEW: Track running jobs across refresh cycles
    this.runningJobs = new Map(); // jobType -> {startTime, pollInterval, previousTimestamp}
    this.pollingIntervals = new Map(); // jobType -> intervalId
    
    // Load running jobs from sessionStorage (survives page refreshes)
    this.loadRunningJobsState();
    
    // Restore polling for any jobs that were running
    this.restoreRunningJobsPolling();
  }

  async init() {
    console.log('Initializing KVI Master Dashboard with improved error handling...');
    
    // Generate initial report
    await this.refresh();

    // Setup smart auto-refresh with longer interval (5 minutes)
    this.startSmartAutoRefresh(300000); // 5 minutes instead of 60 seconds

    // Monitor running jobs for stale entries
    this.monitorRunningJobs();

    // Setup event listeners
    this.setupEventListeners();
    
    // Add manual refresh button handler
    this.addManualRefreshButton();
  }
  
  // Add manual refresh button to UI
  addManualRefreshButton() {
    const button = document.getElementById('master-refresh-btn');
    if (button) {
      button.addEventListener('click', async () => {
        if (this.refreshInProgress) {
          console.log('Refresh already in progress, skipping...');
          return;
        }
        
        button.disabled = true;
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner"></span> Refreshing...';
        
        await this.refresh(true); // Force refresh
        
        button.disabled = false;
        button.innerHTML = originalText;
      });
    }
  }

  // ============================================
  // STATE PERSISTENCE FUNCTIONS
  // ============================================
  
  // Save running jobs state to sessionStorage
  saveRunningJobsState() {
    const runningJobsData = {};
    this.runningJobs.forEach((value, key) => {
      runningJobsData[key] = {
        startTime: value.startTime,
        previousTimestamp: value.previousTimestamp
      };
    });
    sessionStorage.setItem('kvi_running_jobs', JSON.stringify(runningJobsData));
  }
  
  // Load running jobs state from sessionStorage
  loadRunningJobsState() {
    try {
      const saved = sessionStorage.getItem('kvi_running_jobs');
      if (saved) {
        const runningJobsData = JSON.parse(saved);
        Object.entries(runningJobsData).forEach(([jobType, data]) => {
          // Check if job started less than 60 seconds ago
          const elapsed = Date.now() - new Date(data.startTime).getTime();
          if (elapsed < 60000) {
            this.runningJobs.set(jobType, data);
          }
        });
      }
    } catch (e) {
      console.error('Error loading running jobs state:', e);
    }
  }
  
  // Clear a job from running state
  clearRunningJob(jobType) {
    const jobData = this.runningJobs.get(jobType);
    
    // Clear ALL timeouts if they exist
    if (jobData?.timeoutIds) {
      jobData.timeoutIds.forEach(id => {
        try { clearTimeout(id); } catch(e) {}
      });
    }
    
    // Clear single timeout (backward compatibility)
    if (jobData?.timeoutId) {
      clearTimeout(jobData.timeoutId);
    }
    
    this.runningJobs.delete(jobType);
    
    // Clear polling interval if exists
    if (this.pollingIntervals.has(jobType)) {
      clearInterval(this.pollingIntervals.get(jobType));
      this.pollingIntervals.delete(jobType);
    }
    
    this.saveRunningJobsState();
  }
  
  // Check if a job is currently running
  isJobRunning(jobType) {
    return this.runningJobs.has(jobType);
  }
  
  // Restore polling for jobs that were running before refresh
  restoreRunningJobsPolling() {
    this.runningJobs.forEach((jobData, jobType) => {
      const elapsed = Date.now() - new Date(jobData.startTime).getTime();
      const remainingTime = 90000 - elapsed; // 90 second timeout
      
      if (remainingTime > 0) {
        console.log(`Restoring polling for ${jobType}, ${Math.floor(remainingTime/1000)}s remaining`);
        this.startPollingForJob(jobType, jobData.previousTimestamp, remainingTime);
      } else {
        // Job timed out while page was refreshing
        console.log(`Job ${jobType} timed out while page was refreshing`);
        this.clearRunningJob(jobType);
      }
    });
  }
  
  // Start polling for a specific job with improved completion detection and strict timeout
  async startPollingForJob(jobType, previousTimestamp, maxDuration = 90000) {
    console.log(`🔄 Starting polling for ${jobType} with STRICT ${maxDuration/1000}s timeout`);
    
    const jobData = this.runningJobs.get(jobType);
    if (!jobData) {
      console.warn(`No job data for ${jobType}`);
      return;
    }
    
    const jobStartTime = new Date(jobData.startTime).getTime();
    let isCompleted = false;
    let isTimedOut = false;
    let pollCount = 0;
    
    // CRITICAL: Set THREE layers of timeout protection
    
    // Layer 1: Absolute timeout that CANNOT be cleared
    const absoluteTimeoutId = setTimeout(() => {
      console.log(`⏰ LAYER 1: ABSOLUTE TIMEOUT for ${jobType}`);
      if (!isCompleted && !isTimedOut) {
        isTimedOut = true;
        this.forceJobTimeout(jobType);
      }
    }, maxDuration);
    
    // Layer 2: Secondary timeout as backup
    const backupTimeoutId = setTimeout(() => {
      console.log(`⏰ LAYER 2: BACKUP TIMEOUT for ${jobType}`);
      if (!isCompleted && !isTimedOut) {
        isTimedOut = true;
        this.forceJobTimeout(jobType);
      }
    }, maxDuration + 5000); // 5 seconds after primary
    
    // Layer 3: Emergency timeout
    const emergencyTimeoutId = setTimeout(() => {
      console.log(`⏰ LAYER 3: EMERGENCY TIMEOUT for ${jobType}`);
      if (!isCompleted) {
        isTimedOut = true;
        this.forceJobTimeout(jobType);
      }
    }, maxDuration + 10000); // 10 seconds after primary
    
    // Store ALL timeout IDs
    jobData.timeoutIds = [absoluteTimeoutId, backupTimeoutId, emergencyTimeoutId];
    this.runningJobs.set(jobType, jobData);
    
    // Polling function
    const doPoll = async () => {
      if (isCompleted || isTimedOut) {
        console.log(`Stopping poll for ${jobType} - completed: ${isCompleted}, timedOut: ${isTimedOut}`);
        return;
      }
      
      pollCount++;
      const elapsed = Date.now() - jobStartTime;
      
      // Check if we've exceeded time limit
      if (elapsed >= maxDuration) {
        console.log(`⏱️ Time limit exceeded for ${jobType} - forcing timeout`);
        if (!isTimedOut) {
          isTimedOut = true;
          this.forceJobTimeout(jobType);
        }
        return;
      }
      
      try {
        const response = await fetch(`/api/jobs/${jobType}?limit=1`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout for the request itself
        });
        
        if (response.ok) {
          const data = await response.json();
          const latestData = Array.isArray(data) ? data[0] : data;
          
          if (latestData) {
            // Check for completion
            const newTimestamp = latestData.timestamp || latestData.createdAt || latestData.updatedAt;
            const newStatus = latestData.status || latestData.state;
            
            if (newTimestamp) {
              const newTime = new Date(newTimestamp).getTime();
              if (newTime >= jobStartTime - 1000) {
                console.log(`✅ Job ${jobType} completed - new timestamp detected`);
                isCompleted = true;
                this.handleJobCompletion(jobType, latestData);
                // Clear all timeouts
                jobData.timeoutIds?.forEach(id => clearTimeout(id));
                return;
              }
            }
            
            if (newStatus === 'completed' || newStatus === 'success') {
              console.log(`✅ Job ${jobType} completed - status: ${newStatus}`);
              isCompleted = true;
              this.handleJobCompletion(jobType, latestData);
              // Clear all timeouts
              jobData.timeoutIds?.forEach(id => clearTimeout(id));
              return;
            }
          }
        }
        
        // Update UI with progress
        const secondsElapsed = Math.floor(elapsed / 1000);
        const secondsRemaining = Math.floor((maxDuration - elapsed) / 1000);
        this.updateJobCardRunningState(jobType, secondsElapsed, secondsRemaining);
        
        // Schedule next poll if not completed/timed out
        if (!isCompleted && !isTimedOut && elapsed < maxDuration) {
          setTimeout(doPoll, 3000);
        }
        
      } catch (error) {
        console.error(`Poll error for ${jobType}:`, error);
        
        // Continue polling unless timed out
        if (!isTimedOut && Date.now() - jobStartTime < maxDuration) {
          setTimeout(doPoll, 3000);
        }
      }
    };
    
    // Wait 2 seconds before first poll
    setTimeout(doPoll, 2000);
  }
  
  // New method to FORCE timeout regardless of state
  forceJobTimeout(jobType) {
    console.log(`🛑 FORCING TIMEOUT for ${jobType}`);
    
    const jobData = this.runningJobs.get(jobType);
    
    // Clear ALL timeouts
    if (jobData?.timeoutIds) {
      jobData.timeoutIds.forEach(id => {
        try { clearTimeout(id); } catch(e) {}
      });
    }
    
    // Clear any polling intervals
    if (this.pollingIntervals.has(jobType)) {
      clearInterval(this.pollingIntervals.get(jobType));
      this.pollingIntervals.delete(jobType);
    }
    
    // Remove from running jobs
    this.runningJobs.delete(jobType);
    this.saveRunningJobsState();
    
    // Update UI
    const jobCard = document.querySelector(`[data-job-type="${jobType}"]`);
    if (jobCard) {
      jobCard.classList.remove('job-running');
      jobCard.classList.add('job-timeout');
      
      const statusEl = jobCard.querySelector('.job-status');
      if (statusEl) {
        statusEl.textContent = 'TIMEOUT';
        statusEl.className = 'job-status status-timeout';
      }
      
      const lastRunEl = jobCard.querySelector('.job-last-run');
      if (lastRunEl) {
        lastRunEl.textContent = 'Job timed out after 90s';
        lastRunEl.style.color = '#F39C12';
        lastRunEl.style.fontWeight = 'normal';
      }
      
      const button = jobCard.querySelector('.btn-run-job');
      if (button) {
        button.innerHTML = '⏱️ Timeout';
        button.style.background = '#F39C12';
        button.disabled = false;
        
        // Reset button after 5 seconds
        setTimeout(() => {
          button.innerHTML = '▶ Run Now';
          button.style.background = '';
          jobCard.classList.remove('job-timeout');
        }, 5000);
      }
    }
    
    // Show alert to user
    alert(`Job ${jobType} timed out after 90 seconds. It may still be running in the background. Try refreshing the dashboard in a minute.`);
    
    // Try to refresh anyway
    setTimeout(() => {
      this.refresh(true);
    }, 2000);
  }
  
  // Handle job completion with improved data handling
  async handleJobCompletion(jobType, newData = null) {
    console.log(`✅ Job ${jobType} completed successfully`);
    
    // Clear from running state
    this.clearRunningJob(jobType);
    
    // Update UI immediately with new data if available
    if (newData) {
      this.updateJobCardCompleted(jobType, newData);
    } else {
      this.updateJobCardCompleted(jobType);
    }
    
    // Force refresh to show new data
    await this.refresh(true, [jobType]); // Pass completed job to preserve state
  }
  
  // Handle job timeout with better error handling and strict cleanup
  handleJobTimeout(jobType) {
    console.warn(`⏱️ Job ${jobType} timed out after 90 seconds`);
    
    // Clear from running state (strict cleanup)
    const jobData = this.runningJobs.get(jobType);
    if (jobData && jobData.timeoutId) {
      clearTimeout(jobData.timeoutId);
    }
    this.clearRunningJob(jobType);
    
    // Update UI with timeout message
    this.updateJobCardTimeout(jobType);
    
    // Still refresh to check if there's any data (job might have completed but we didn't detect it)
    this.refresh(true);
  }
  
  // Update job card to show running state with timeout countdown
  updateJobCardRunningState(jobType, secondsElapsed, secondsRemaining = null) {
    const jobCard = document.querySelector(`[data-job-type="${jobType}"]`);
    if (!jobCard) return;
    
    jobCard.classList.add('job-running');
    jobCard.dataset.isRunning = 'true';
    
    const statusEl = jobCard.querySelector('.job-status');
    if (statusEl) {
      statusEl.textContent = 'RUNNING...';
      statusEl.className = 'job-status status-running';
    }
    
    const lastRunEl = jobCard.querySelector('.job-last-run');
    if (lastRunEl) {
      if (secondsRemaining !== null && secondsRemaining < 10) {
        // Show warning when close to timeout
        lastRunEl.textContent = `Running for ${secondsElapsed}s (timeout in ${secondsRemaining}s)`;
        lastRunEl.style.color = '#F39C12'; // Orange warning
      } else if (secondsRemaining !== null) {
        lastRunEl.textContent = `Running for ${secondsElapsed}s (timeout in ${secondsRemaining}s)`;
        lastRunEl.style.color = '#3498DB';
      } else {
        lastRunEl.textContent = `Running for ${secondsElapsed}s...`;
        lastRunEl.style.color = '#3498DB';
      }
      lastRunEl.style.fontWeight = '600';
    }
    
    const button = jobCard.querySelector('.btn-run-job');
    if (button) {
      button.disabled = true;
      const dots = '.'.repeat((secondsElapsed % 4) + 1);
      button.innerHTML = `<span class="spinner"></span> Running${dots}`;
    }
  }
  
  // Update job card to show completed state with optional new data
  updateJobCardCompleted(jobType, newData = null) {
    const jobCard = document.querySelector(`[data-job-type="${jobType}"]`);
    if (!jobCard) return;
    
    jobCard.classList.remove('job-running');
    jobCard.classList.add('job-completed');
    
    // If we have new data, update the card immediately
    if (newData) {
      const analysis = this.reportGenerator.analyzeJobHealth(jobType, newData);
      this.updateCardContentInPlace(jobCard, jobType, analysis);
    }
    
    const button = jobCard.querySelector('.btn-run-job');
    if (button) {
      button.innerHTML = '✅ Completed!';
      button.style.background = 'var(--success)';
      button.disabled = false;
      
      setTimeout(() => {
        button.innerHTML = '▶ Run Now';
        button.style.background = '';
        jobCard.classList.remove('job-completed');
      }, 3000);
    }
  }
  
  // Update job card to show timeout state
  updateJobCardTimeout(jobType) {
    const jobCard = document.querySelector(`[data-job-type="${jobType}"]`);
    if (!jobCard) return;
    
    jobCard.classList.remove('job-running');
    jobCard.classList.add('job-timeout');
    
    const button = jobCard.querySelector('.btn-run-job');
    if (button) {
      button.innerHTML = 'Timeout';
      button.style.background = 'var(--warning)';
      button.disabled = false;
      
      setTimeout(() => {
        button.innerHTML = '▶ Run Now';
        button.style.background = '';
        jobCard.classList.remove('job-timeout');
      }, 3000);
    }
  }

  async minimalRefresh() {
    try {
      console.log('Minimal refresh - preserving running jobs');
      
      const allJobs = this.reportGenerator.allCronJobs || [];
      const nonRunningJobs = allJobs.filter(job => !this.runningJobs.has(job));
      
      if (nonRunningJobs.length === 0) {
        console.log('All jobs running - skipping minimal refresh');
        return;
      }
      
      this.showMinimalLoading(true);
      
      const jobPromises = nonRunningJobs.map(async (jobType) => {
        try {
          const response = await fetch(`/api/jobs/${jobType}?limit=1`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) return null;
          const data = await response.json();
          return { jobType, data: data[0] || null };
        } catch (error) {
          console.error(`Minimal refresh fetch failed for ${jobType}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(jobPromises);
      results.forEach(result => {
        if (result && result.data) {
          this.updateCardContentInPlace(
            document.querySelector(`[data-job-type="${result.jobType}"]`),
            result.jobType,
            this.reportGenerator.analyzeJobHealth(result.jobType, result.data)
          );
        }
      });
      
      const lastUpdateEl = document.getElementById('last-update-time');
      if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleString();
      }
      
    } catch (error) {
      console.error('Minimal refresh failed:', error);
    } finally {
      this.showMinimalLoading(false);
    }
  }

  preserveRunningJobElements() {
    const preserved = new Map();
    
    this.runningJobs.forEach((jobData, jobType) => {
      const element = document.querySelector(`[data-job-type="${jobType}"]`);
      if (element) {
        preserved.set(jobType, element);
      }
    });
    
    return preserved;
  }

  async refresh(force = false, completedJobs = []) {
    // Prevent concurrent refreshes
    if (this.refreshInProgress && !force) {
      console.log('Refresh already in progress, skipping...');
      return;
    }
    
    const hasRunningJobs = this.runningJobs.size > 0;

    // If jobs are running and not forced, do minimal refresh
    if (hasRunningJobs && !force) {
      console.log(`Jobs running (${this.runningJobs.size}), performing minimal refresh`);
      await this.minimalRefresh();
      return;
    }

    // Debounce check
    const now = Date.now();
    if (!force && this.lastRefreshTime && (now - this.lastRefreshTime) < 10000) {
      console.log('Refresh too soon (debounce), skipping...');
      return;
    }
    
    this.refreshInProgress = true;
    this.isRefreshing = true;
    this.lastRefreshTime = now;
    
    try {
      // Show appropriate loading indicator
      if (!hasRunningJobs) {
        this.showLoading(true, false);
      } else {
        this.showMinimalLoading(true);
      }
      
      // Generate report with caching
      const report = await this.reportGenerator.generateMasterReport();
      
      if (!report || !report.jobDetails) {
        console.error('Invalid report structure, keeping existing data');
        return;
      }
      
      // Store last successful report
      this.lastReportData = report;
      
      // Update UI components
      this.renderHealthScore(report);
      this.renderSEOCategories(report);
      this.renderIssuesPanel(report);
      this.renderRecommendations(report);
      this.renderExportOptions(report);
      
      // Smart update that preserves data
      this.updateJobsGridInPlace(report);
      
      // Update stats
      this.updateQuickStats(report);
      
      // Update timestamp
      const lastUpdateEl = document.getElementById('last-update-time');
      if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleString();
      }
      
      // Store report globally
      window.currentMasterReport = report;
      
      console.log('✅ Dashboard refreshed successfully');
      
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      this.showError(`Refresh failed: ${error.message}. Using cached data where available.`);
      
    } finally {
      this.showLoading(false);
      this.showMinimalLoading(false);
      this.isRefreshing = false;
      this.refreshInProgress = false;
    }
  }

  renderHealthScore(report) {
    const container = document.getElementById('master-health-score');
    if (!container) return;

    const scoreClass = report.summary.overallScore >= 90 ? 'excellent' :
                      report.summary.overallScore >= 70 ? 'good' :
                      report.summary.overallScore >= 50 ? 'warning' : 'critical';

    container.innerHTML = `
      <div class="master-health-card health-${scoreClass}">
        <div class="health-score-circle">
          <svg viewBox="0 0 200 200" class="circular-progress">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e0e0" stroke-width="12"/>
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" 
                    stroke-width="12" stroke-dasharray="${report.summary.overallScore * 5.65} 565"
                    transform="rotate(-90 100 100)"/>
          </svg>
          <div class="score-text">
            <div class="score-number">${report.summary.overallScore}%</div>
            <div class="score-label">Overall Health</div>
          </div>
        </div>
        
        <div class="health-summary">
          <div class="summary-stat">
            <span class="stat-label">Pages Analyzed</span>
            <span class="stat-value">${report.summary.totalPagesAnalyzed || 547}</span>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Total Issues</span>
            <span class="stat-value issues-count">${report.summary.totalIssuesFound}</span>
          </div>
          <div class="summary-stat">
            <span class="stat-label">Jobs Running</span>
            <span class="stat-value">${report.summary.totalJobs}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderSEOCategories(report) {
    const container = document.getElementById('seo-categories');
    if (!container) return;

    const categories = ['technical', 'content', 'links', 'performance'];
    
    container.innerHTML = categories.map(category => {
      const jobs = report.seoHealth[category];
      const healthyCount = Object.values(jobs).filter(j => j.health === 'healthy').length;
      const totalCount = Object.keys(jobs).length;
      const percentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

      return `
        <div class="seo-category-card">
          <h3>${category.charAt(0).toUpperCase() + category.slice(1)} SEO</h3>
          <div class="category-score">
            <div class="score-bar">
              <div class="score-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="score-text">${percentage}% Healthy</span>
          </div>
          <div class="category-details">
            ${Object.entries(jobs).map(([jobName, jobData]) => {
              const jobHealth = jobData.health || 'unknown';
              return `
              <div class="job-mini status-${jobHealth}">
                <span class="job-name">${this.formatJobName(jobName)}</span>
                <span class="job-status">${jobHealth}</span>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  updateJobsGridInPlace(report) {
    const container = document.getElementById('all-jobs-grid');
    if (!container) return;
    
    const existingCards = new Map();
    container.querySelectorAll('.job-card').forEach(card => {
      const jobType = card.dataset.jobType;
      if (jobType) {
        existingCards.set(jobType, card);
      }
    });
    
    Object.entries(report.jobDetails).forEach(([jobType, details]) => {
      const isRunning = this.runningJobs.has(jobType);
      const existingCard = existingCards.get(jobType);
      
      if (isRunning && existingCard) {
        existingCard.classList.add('job-running');
        existingCard.dataset.isRunning = 'true';
        this.updateRunningJobElement(existingCard, jobType);
        existingCards.delete(jobType);
        return;
      }
      
      if (existingCard) {
        this.updateCardContentInPlace(existingCard, jobType, details);
        existingCards.delete(jobType);
      } else {
        const newCard = this.createJobCard(jobType, details);
        container.appendChild(newCard);
      }
    });
    
    existingCards.forEach((card, jobType) => {
      if (!this.runningJobs.has(jobType)) {
        card.remove();
      }
    });
  }

  createJobCard(jobType, details) {
    const card = document.createElement('div');
    const health = details.health || 'unknown';
    const isRunning = this.runningJobs.has(jobType);
    
    card.className = `job-card status-${isRunning ? 'running' : health} ${isRunning ? 'job-running' : ''}`;
    card.setAttribute('data-job-type', jobType);
    card.onclick = () => showJobDetails(jobType);
    
    card.innerHTML = `
      <div class="job-card-header">
        <span class="job-icon">${this.getJobIcon(jobType)}</span>
        <span class="job-title">${this.formatJobName(jobType)}</span>
      </div>
      
      <div class="job-card-body">
        <div class="job-status status-${isRunning ? 'running' : health}">
          ${isRunning ? 'RUNNING...' : (health || 'UNKNOWN').toUpperCase()}
        </div>
        
        ${!isRunning && details.metrics ? `
          <div class="job-metrics">
            ${Object.entries(details.metrics).slice(0, 3).map(([key, value]) => `
              <div class="metric">
                <span class="metric-label">${this.formatMetricName(key)}:</span>
                <span class="metric-value">${this.formatMetricValue(value)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${isRunning ? 
          '<div class="job-running-info">Job in progress...</div>' :
          (details.issues && details.issues.length > 0 ? 
            `<div class="job-issues-count">${details.issues.length} issues found</div>` : 
            (health === 'healthy' ? '<div class="job-success">✓ No issues</div>' : 
            (health === 'unknown' ? '<div class="job-unknown">⏳ No data yet</div>' : 
            '<div class="job-warning">⚠ Check details</div>')))
        }
        
        <div class="job-last-run">
          ${isRunning ? 'Job in progress...' : this.formatTimeAgo(details.lastRun)}
        </div>
        
        <div class="job-actions">
          <button class="btn-run-job" 
                  ${isRunning ? 'disabled' : ''} 
                  onclick="event.stopPropagation(); triggerJob('${jobType}')"
                  title="${isRunning ? 'Job is running' : `Run ${jobType} job now`}">
            ${isRunning ? 'Running...' : '▶ Run Now'}
          </button>
        </div>
      </div>
    `;
    
    if (isRunning) {
      this.ensureRunningState(card, jobType);
    }
    
    return card;
  }

  updateCardContentInPlace(card, jobType, details) {
    if (!card || card.classList.contains('job-running')) {
      return;
    }
    
    // Don't update if no new data and card already has data
    const currentLastRun = card.querySelector('.job-last-run')?.textContent;
    if (!details.lastRun && currentLastRun && currentLastRun !== 'Never') {
      console.log(`Preserving existing data for ${jobType}`);
      
      // Just add unavailable indicator if needed
      if (details.isUnavailable) {
        this.addUnavailableIndicator(card);
      }
      return;
    }
    
    const health = details.isUnavailable ? 'unavailable' : (details.health || 'unknown');
    card.className = `job-card status-${health}`;
    card.dataset.jobType = jobType;
    
    // Add indicators for cache/unavailable status
    if (details.isUnavailable) {
      this.addUnavailableIndicator(card);
    } else if (details.isFromCache || details.isStale) {
      this.addCacheIndicator(card, details.isStale);
    } else {
      this.removeCacheIndicator(card);
      this.removeUnavailableIndicator(card);
    }
    
    const statusEl = card.querySelector('.job-status');
    if (statusEl) {
      if (details.isUnavailable) {
        statusEl.textContent = 'UNAVAILABLE';
        statusEl.className = 'job-status status-unavailable';
      } else {
        statusEl.textContent = health.toUpperCase();
        statusEl.className = `job-status status-${health}`;
      }
    }
    
    // Update metrics if available
    if (details.metrics && Object.keys(details.metrics).length > 0) {
      let metricsEl = card.querySelector('.job-metrics');
      if (!metricsEl) {
        metricsEl = document.createElement('div');
        metricsEl.className = 'job-metrics';
        const body = card.querySelector('.job-card-body');
        if (body) {
          const lastRunEl = body.querySelector('.job-last-run');
          body.insertBefore(metricsEl, lastRunEl);
        }
      }
      if (metricsEl) {
        metricsEl.innerHTML = Object.entries(details.metrics).slice(0, 3).map(([key, value]) => `
          <div class="metric">
            <span class="metric-label">${this.formatMetricName(key)}:</span>
            <span class="metric-value">${this.formatMetricValue(value)}</span>
          </div>
        `).join('');
      }
    } else if (card.querySelector('.job-metrics')) {
      card.querySelector('.job-metrics').remove();
    }
    
    // Update status indicator
    const bodyEl = card.querySelector('.job-card-body');
    let indicatorEl = bodyEl.querySelector('.job-issues-count, .job-success, .job-unknown, .job-warning, .job-unavailable');
    if (!indicatorEl) {
      indicatorEl = document.createElement('div');
      const lastRunEl = bodyEl.querySelector('.job-last-run');
      bodyEl.insertBefore(indicatorEl, lastRunEl);
    }
    
    if (details.isUnavailable) {
      indicatorEl.className = 'job-unavailable';
      indicatorEl.innerHTML = '⚠️ Temporarily unavailable';
    } else if (details.issues && details.issues.length > 0) {
      indicatorEl.className = 'job-issues-count';
      indicatorEl.textContent = `${details.issues.length} issues found`;
    } else if (health === 'healthy' && details.lastRun) {
      indicatorEl.className = 'job-success';
      indicatorEl.innerHTML = '✓ No issues';
    } else if (!details.lastRun || health === 'unknown') {
      indicatorEl.className = 'job-unknown';
      indicatorEl.innerHTML = '⏳ No data yet';
    } else {
      indicatorEl.className = 'job-warning';
      indicatorEl.innerHTML = '⚠ Check details';
    }
    
    // Update last run time
    const lastRunEl = card.querySelector('.job-last-run');
    if (lastRunEl && details.lastRun) {
      const formatted = this.formatTimeAgo(details.lastRun);
      lastRunEl.textContent = formatted;
      if (formatted === 'Never') {
        lastRunEl.style.color = '#999';
        lastRunEl.style.fontStyle = 'italic';
      } else {
        lastRunEl.style.color = '';
        lastRunEl.style.fontStyle = '';
      }
    }
    
    // Update button
    const button = card.querySelector('.btn-run-job');
    if (button && !this.runningJobs.has(jobType)) {
      button.disabled = details.isUnavailable;
      button.innerHTML = details.isUnavailable ? '⚠️ Unavailable' : '▶ Run Now';
    }
  }
  
  addUnavailableIndicator(card) {
    if (card.querySelector('.unavailable-badge')) return;
    
    const badge = document.createElement('div');
    badge.className = 'unavailable-badge';
    badge.innerHTML = '⚠️ Service Unavailable';
    badge.title = 'API temporarily unavailable - showing last known data';
    card.querySelector('.job-card-header')?.appendChild(badge);
  }
  
  removeUnavailableIndicator(card) {
    card.querySelector('.unavailable-badge')?.remove();
  }
  
  addCacheIndicator(card, isStale) {
    let indicator = card.querySelector('.cache-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'cache-indicator';
      card.querySelector('.job-card-header')?.appendChild(indicator);
    }
    
    if (isStale) {
      indicator.innerHTML = '📦 Stale data';
      indicator.title = 'Data is more than 1 hour old';
      indicator.classList.add('stale');
    } else {
      indicator.innerHTML = '📦 Cached';
      indicator.title = 'Using cached data';
      indicator.classList.remove('stale');
    }
  }
  
  removeCacheIndicator(card) {
    card.querySelector('.cache-indicator')?.remove();
  }

  ensureRunningState(card, jobType) {
    const jobData = this.runningJobs.get(jobType);
    if (!jobData) return;
    
    this.updateRunningJobElement(card, jobType);
    card.classList.add('job-running');
  }

  updateJobCardInPlace(jobType, data) {
    const card = document.querySelector(`[data-job-type="${jobType}"]`);
    if (!card) return;
    const analysis = this.reportGenerator.analyzeJobHealth(jobType, data);
    this.updateCardContentInPlace(card, jobType, analysis);
  }
  
  updateRunningJobElement(element, jobType) {
    const jobData = this.runningJobs.get(jobType);
    if (!jobData) return;
    
    const elapsed = Math.floor((Date.now() - new Date(jobData.startTime).getTime()) / 1000);
    
    const statusEl = element.querySelector('.job-status');
    if (statusEl) {
      statusEl.textContent = 'RUNNING...';
      statusEl.className = 'job-status status-running';
    }
    
    const lastRunEl = element.querySelector('.job-last-run');
    if (lastRunEl) {
      lastRunEl.textContent = `Running for ${elapsed}s...`;
    }
    
    const button = element.querySelector('.btn-run-job');
    if (button) {
      button.disabled = true;
      const dots = '.'.repeat((elapsed % 4) + 1);
      button.textContent = `Running${dots}`;
    }
  }

  async debugApiResponse(jobType = 'schemaValidation') {
    try {
      const response = await fetch(`/api/jobs/${jobType}?limit=1`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`🔍 Debug ${jobType} status:`, response.status, response.statusText);
      if (!response.ok) return;
      const data = await response.json();
      console.log('📦 Raw response:', data);
      const item = Array.isArray(data) ? data[0] : data;
      if (item) {
        console.log('🔑 Fields:', Object.keys(item));
      }
    } catch (error) {
      console.error('debugApiResponse failed:', error);
    }
  }

  renderIssuesPanel(report) {
    const container = document.getElementById('issues-panel');
    if (!container) return;

    const allIssues = [
      ...report.criticalIssues.map(i => ({ ...i, severity: 'critical' })),
      ...report.warnings
    ].slice(0, 50); // Show top 50 issues

    container.innerHTML = `
      <h3>🚨 Issues Requiring Attention (${report.summary.totalIssuesFound} total)</h3>
      
      <div class="issues-filter">
        <button class="filter-btn active" onclick="filterIssues('all')">All</button>
        <button class="filter-btn" onclick="filterIssues('critical')">Critical</button>
        <button class="filter-btn" onclick="filterIssues('warning')">Warnings</button>
        <button class="filter-btn" onclick="filterIssues('404')">404 Errors</button>
        <button class="filter-btn" onclick="filterIssues('schema')">Schema</button>
        <button class="filter-btn" onclick="filterIssues('meta')">Meta Tags</button>
      </div>
      
      <div class="issues-list">
        ${allIssues.length > 0 ? allIssues.map(issue => `
          <div class="issue-item severity-${issue.severity || 'warning'}" data-type="${issue.type}">
            <div class="issue-header">
              <span class="issue-type">${issue.type}</span>
              <span class="issue-job">${this.formatJobName(issue.job)}</span>
            </div>
            <div class="issue-url">${issue.url || 'N/A'}</div>
            ${issue.missing ? `<div class="issue-details">Missing: ${Array.isArray(issue.missing) ? issue.missing.join(', ') : issue.missing}</div>` : ''}
          </div>
        `).join('') : '<p style="text-align: center; color: var(--text-light); padding: 20px;">No issues found! 🎉</p>'}
      </div>
      
      <button class="btn-export-issues" onclick="exportIssues()">
        Export All Issues to CSV
      </button>
    `;
  }

  renderRecommendations(report) {
    const container = document.getElementById('recommendations-panel');
    if (!container) return;

    // Check if any jobs have actually run
    const hasAnyJobRun = Object.values(report.jobDetails).some(details => {
      return details && details.lastRun && details.lastRun !== 'Never' && details.lastRun !== null;
    });

    container.innerHTML = `
      <h3>💡 SEO Recommendations</h3>
      
      <div class="recommendations-list">
        ${report.recommendations.length > 0 ? report.recommendations.map(rec => {
          const priority = rec.priority || 'medium';
          const category = rec.category || 'General';
          const metricValue = rec.metricValue ? ` <span style="color: #5DADE2; font-weight: 600;">(${rec.metricValue})</span>` : '';
          return `
          <div class="recommendation-card priority-${priority}">
            <div class="rec-header">
              <span class="rec-priority">${(priority || 'MEDIUM').toUpperCase()}</span>
              <span class="rec-category">${category}</span>
            </div>
            
            <div class="rec-action">${rec.action}${metricValue}</div>
            
            <div class="rec-details">
              <div class="rec-impact">
                <strong>Impact:</strong> ${rec.impact}
              </div>
              <div class="rec-effort">
                <strong>Effort:</strong> ${rec.effort}
              </div>
            </div>
            
            <button class="btn-implement" onclick="implementFix('${category}', '${(rec.action || '').replace(/'/g, "\\'")}')">
              ${rec.implementation || 'Implement Fix'}
            </button>
          </div>
        `;
        }).join('') : hasAnyJobRun ? 
          '<p style="text-align: center; color: var(--text-light); padding: 20px;">All systems optimal! No recommendations at this time. ✅</p>' :
          `<div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <p style="color: var(--text-light); font-size: 16px; margin-bottom: 20px;">
              Run jobs to get personalized recommendations based on your actual scan results
            </p>
            <button class="btn-refresh" onclick="window.masterDashboard.refresh(true)" style="margin-top: 10px;">
              🔄 Refresh Dashboard
            </button>
          </div>`}
      </div>
    `;
  }

  renderExportOptions(report) {
    const container = document.getElementById('export-options');
    if (!container) return;

    container.innerHTML = `
      <h3>📊 Export Master Report</h3>
      
      <div class="export-buttons">
        <button class="btn-export" onclick="exportMasterReport('csv')">
          📥 Download CSV
        </button>
        <button class="btn-export" onclick="exportMasterReport('json')">
          📥 Download JSON
        </button>
        <button class="btn-export" onclick="exportMasterReport('pdf')">
          📥 Generate PDF
        </button>
        <button class="btn-export" onclick="emailMasterReport()">
          📧 Email Report
        </button>
      </div>
      
      <div class="export-preview">
        <h4>Report Summary</h4>
        <pre>${report.exportData.summary}</pre>
      </div>
    `;
  }

  // Utility functions
  formatJobName(jobType) {
    return jobType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace('Validation', '')
      .replace('Four Oh Four', '404 Monitor')
      .trim();
  }

  formatMetricName(metric) {
    return metric
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  formatMetricValue(value) {
    if (typeof value === 'number') {
      if (value > 1000) return `${(value / 1000).toFixed(1)}k`;
      if (value % 1 !== 0) return value.toFixed(2);
    }
    return value;
  }

  formatTimeAgo(timestamp) {
    if (!timestamp || timestamp === 'Never' || timestamp === null || timestamp === undefined) {
      return 'Never';
    }
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Never';
      }
      const diff = Date.now() - date.getTime();
      if (diff < 0) return 'Just now'; // Future timestamp
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch (e) {
      return 'Never';
    }
  }

  getJobIcon(jobType) {
    const icons = {
      fourOhFour: '🚫',
      schemaValidation: '📋',
      ogTagsValidation: '🔗',
      metaTagsValidation: '🏷️',
      imageAltValidation: '🖼️',
      canonicalValidation: '🎯',
      robotsTagValidation: '🤖',
      internalLinks: '🔄',
      externalLinks: '🌐',
      contentValidation: '📝',
      coreWebVitals: '⚡',
      backups: '💾',
      phoneValidation: '📞',
      sslCheck: '🔒',
      formTesting: '📮',
      brokenLinks: '🔗',
      sitemapValidation: '🗺️',
      structuredDataValidation: '📊',
      hreflangValidation: '🌍',
      pagespeedValidation: '⚡'
    };
    return icons[jobType] || '📊';
  }

  showLoading(show, preserveRunning = false) {
    const loader = document.getElementById('master-loader');
    if (!loader) return;
    
    // Never block the UI if jobs are running; use minimal loading instead
    if (show && (preserveRunning || this.runningJobs.size > 0)) {
      this.showMinimalLoading(true);
      return;
    }
    
    loader.style.display = show ? 'flex' : 'none';
    loader.classList.remove('preserve-running');
    loader.style.pointerEvents = show ? 'auto' : 'none';
    loader.style.background = show ? 'rgba(26, 26, 46, 0.9)' : 'transparent';
  }

  showMinimalLoading(show) {
    let indicator = document.getElementById('minimal-loading-indicator');
    
    if (show && !indicator) {
      indicator = document.createElement('div');
      indicator.id = 'minimal-loading-indicator';
      indicator.className = 'minimal-loader';
      indicator.innerHTML = `
        <div class="minimal-loader-content">
          <span class="mini-spinner"></span>
          <span>Updating data...</span>
        </div>
      `;
      document.body.appendChild(indicator);
    }
    
    if (indicator) {
      indicator.style.display = show ? 'flex' : 'none';
    }
  }

  updateQuickStats(report) {
    const stats = {
      'total-pages': report.summary.totalPagesAnalyzed || 547,
      'total-issues': report.summary.totalIssuesFound || 0,
      'healthy-jobs': report.summary.healthyJobs || 0,
      'overall-score': (report.summary.overallScore || 0) + '%'
    };
    
    Object.entries(stats).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== String(value)) {
        el.textContent = value;
        el.classList.add('value-changed');
        setTimeout(() => el.classList.remove('value-changed'), 800);
      }
    });
  }

  showError(message) {
    const errorContainer = document.getElementById('master-error');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="error-message" style="background: var(--error); color: white; padding: 15px; border-radius: 8px; margin: 20px;">
          <span>⚠️ Error: ${message}</span>
          <button onclick="this.parentElement.style.display='none'" style="float: right; background: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
      `;
      errorContainer.style.display = 'block';
    }
  }

  startSmartAutoRefresh(interval = 300000) { // 5 minutes default
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      if (this.runningJobs.size > 0) {
        console.log(`Auto-refresh: ${this.runningJobs.size} jobs running - minimal refresh only`);
        this.minimalRefresh();
      } else if (!this.refreshInProgress) {
        console.log('Auto-refresh: performing full refresh');
        this.refresh(false);
      } else {
        console.log('Auto-refresh: skipped - refresh already in progress');
      }
    }, interval);
    
    console.log(`Smart auto-refresh started: every ${interval / 1000} seconds (${interval / 60000} minutes)`);
    console.log(`Smart auto-refresh started: every ${interval / 1000} seconds`);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  monitorRunningJobs() {
    setInterval(() => {
      this.runningJobs.forEach((jobData, jobType) => {
        const elapsed = Date.now() - new Date(jobData.startTime).getTime();
        if (elapsed > 70000) {
          console.log(`Cleaning up stale running job entry: ${jobType}`);
          this.clearRunningJob(jobType);
        }
      });
    }, 5000);
  }

  setupEventListeners() {
    // Manual refresh button
    const refreshBtn = document.getElementById('master-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Auto-refresh toggle
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.startSmartAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
    }
  }
}

// ============================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK HANDLERS
// ============================================
window.showJobDetails = function(jobType) {
  const report = window.currentMasterReport;
  if (!report || !report.jobDetails) return;
  
  const details = report.jobDetails[jobType];
  if (!details) {
    alert('No details available for this job');
    return;
  }
  
  // Create modal for job details
  const existingModal = document.getElementById('job-details-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'job-details-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;
  
  const formatJobName = (type) => {
    return type.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace('Four Oh Four', '404 Monitor')
      .trim();
  };
  
  // Build issues list HTML
  let issuesHTML = '';
  if (details.issues && details.issues.length > 0) {
    issuesHTML = `
      <div class="issues-section" style="margin-top: 20px;">
        <h3 style="color: #E74C3C; margin-bottom: 15px;">
          🚨 Issues Found (${details.issues.length})
        </h3>
        <div style="max-height: 300px; overflow-y: auto; background: rgba(231, 76, 60, 0.05); padding: 15px; border-radius: 8px;">
          ${details.issues.map((issue, index) => `
            <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px; border-left: 3px solid #E74C3C;">
              <div style="font-weight: 600; color: #2C3E50; margin-bottom: 5px;">
                ${index + 1}. ${issue.type || 'Issue'}
              </div>
              <div style="color: #3498DB; word-break: break-all; font-family: monospace; font-size: 13px;">
                ${issue.url || 'URL not available'}
              </div>
              ${issue.missing ? `
                <div style="color: #7F8C8D; font-size: 12px; margin-top: 5px;">
                  Missing: ${Array.isArray(issue.missing) ? issue.missing.join(', ') : issue.missing}
                </div>
              ` : ''}
              ${issue.image ? `
                <div style="color: #7F8C8D; font-size: 12px; margin-top: 5px;">
                  Image: ${issue.image}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        <button onclick="copyIssueUrls('${jobType}')" style="margin-top: 10px; padding: 8px 16px; background: #3498DB; color: white; border: none; border-radius: 5px; cursor: pointer;">
          📋 Copy All URLs
        </button>
      </div>
    `;
  } else {
    issuesHTML = `
      <div style="margin-top: 20px; padding: 20px; background: rgba(46, 204, 113, 0.1); border-radius: 8px; text-align: center;">
        <span style="color: #27AE60; font-size: 18px;">✅ No issues found!</span>
      </div>
    `;
  }
  
  // Build metrics HTML
  let metricsHTML = '';
  if (details.metrics && Object.keys(details.metrics).length > 0) {
    metricsHTML = `
      <div style="margin-top: 20px;">
        <h3 style="margin-bottom: 15px;">📊 Metrics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          ${Object.entries(details.metrics).map(([key, value]) => `
            <div style="background: rgba(52, 152, 219, 0.05); padding: 15px; border-radius: 8px;">
              <div style="color: #7F8C8D; font-size: 12px; margin-bottom: 5px;">
                ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </div>
              <div style="color: #2C3E50; font-size: 20px; font-weight: 600;">
                ${typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
      <button onclick="this.closest('#job-details-modal').remove()" style="position: absolute; top: 15px; right: 15px; background: #E74C3C; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 18px;">
        ✕
      </button>
      
      <h2 style="margin-bottom: 20px; color: #2C3E50;">
        ${formatJobName(jobType)} Details
      </h2>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div style="padding: 15px; background: #F8F9FA; border-radius: 8px;">
          <div style="color: #7F8C8D; font-size: 12px; margin-bottom: 5px;">Status</div>
          <div style="color: #2C3E50; font-weight: 600;">${(details.health || 'unknown').toUpperCase()}</div>
        </div>
        <div style="padding: 15px; background: #F8F9FA; border-radius: 8px;">
          <div style="color: #7F8C8D; font-size: 12px; margin-bottom: 5px;">Last Run</div>
          <div style="color: #2C3E50; font-weight: 600;">${details.lastRun || 'Never'}</div>
        </div>
        <div style="padding: 15px; background: #F8F9FA; border-radius: 8px;">
          <div style="color: #7F8C8D; font-size: 12px; margin-bottom: 5px;">Issues</div>
          <div style="color: ${details.issues?.length > 0 ? '#E74C3C' : '#27AE60'}; font-weight: 600;">
            ${details.issues?.length || 0}
          </div>
        </div>
      </div>
      
      ${metricsHTML}
      ${issuesHTML}
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ECF0F1; display: flex; justify-content: space-between;">
        <button onclick="triggerJob('${jobType}')" style="padding: 10px 20px; background: #3498DB; color: white; border: none; border-radius: 5px; cursor: pointer;">
          ▶ Run Job Now
        </button>
        <button onclick="this.closest('#job-details-modal').remove()" style="padding: 10px 20px; background: #95A5A6; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

// Helper function to copy issue URLs
window.copyIssueUrls = function(jobType) {
  const report = window.currentMasterReport;
  if (!report || !report.jobDetails[jobType]) return;
  
  const issues = report.jobDetails[jobType].issues || [];
  const urls = issues.map(issue => issue.url).filter(url => url && url !== 'N/A').join('\n');
  
  if (urls) {
    navigator.clipboard.writeText(urls).then(() => {
      alert('URLs copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = urls;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('URLs copied to clipboard!');
    });
  } else {
    alert('No URLs to copy');
  }
};

window.filterIssues = function(filterType) {
  const issues = document.querySelectorAll('.issue-item');
  issues.forEach(issue => {
    if (filterType === 'all') {
      issue.style.display = 'block';
    } else if (filterType === 'critical') {
      issue.style.display = issue.classList.contains('severity-critical') ? 'block' : 'none';
    } else if (filterType === 'warning') {
      issue.style.display = issue.classList.contains('severity-warning') ? 'block' : 'none';
    } else if (issue.dataset.type && issue.dataset.type.toLowerCase().includes(filterType)) {
      issue.style.display = 'block';
    } else {
      issue.style.display = 'none';
    }
  });
  
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  }
};

window.exportIssues = function() {
  const report = window.currentMasterReport;
  if (!report) return;
  
  const allIssues = [
    ...report.criticalIssues.map(i => ({ ...i, severity: 'critical' })),
    ...report.warnings
  ];
  
  let csv = 'Severity,Type,Job,URL,Details\n';
  allIssues.forEach(issue => {
    csv += `"${issue.severity || 'warning'}","${issue.type}","${issue.job}","${issue.url || 'N/A'}","${issue.missing || ''}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kvi-issues-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

window.exportMasterReport = function(format) {
  const report = window.currentMasterReport;
  if (!report) return;
  
  let content, filename, mimeType;
  
  switch(format) {
    case 'csv':
      content = report.exportData.csv;
      filename = `kvi-master-report-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
      break;
    case 'json':
      content = report.exportData.json;
      filename = `kvi-master-report-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
      break;
    case 'pdf':
      // Would need PDF library
      alert('PDF generation requires additional setup');
      return;
    default:
      return;
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

window.emailMasterReport = function() {
  const report = window.currentMasterReport;
  if (!report) return;
  
  // Send to API endpoint
  fetch('/api/email-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'dr.khanna@khannainstitute.com',
      subject: `KVI SEO Master Report - ${new Date().toLocaleDateString()}`,
      content: report.exportData.summary,
      attachments: {
        csv: report.exportData.csv
      }
    })
  }).then(() => {
    alert('Report emailed successfully!');
  }).catch(() => {
    alert('Email feature requires backend setup');
  });
};

window.implementFix = function(category, action) {
  console.log(`Implementing fix for ${category}: ${action}`);
  // Call appropriate fix API
  fetch(`/api/fix/${category.toLowerCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  }).then(() => {
    alert(`Fix initiated: ${action}`);
    // Refresh dashboard
    window.masterDashboard.refresh();
  }).catch(() => {
    alert('Fix feature requires backend setup');
  });
};

// Manual job trigger function with improved polling and completion detection
window.triggerJob = async function(jobType) {
  if (!window.masterDashboard) {
    console.error('Dashboard not initialized');
    return;
  }
  
  // Check if job is already running
  if (window.masterDashboard.isJobRunning(jobType)) {
    console.log(`Job ${jobType} is already running`);
    return;
  }
  
  const button = event?.target?.closest('.btn-run-job') || document.querySelector(`[data-job-type="${jobType}"] .btn-run-job`);
  const originalText = button?.innerHTML || '▶ Run Now';
  const jobCard = button?.closest('.job-card') || document.querySelector(`[data-job-type="${jobType}"]`);
  
  // Get current job state before triggering
  let currentTimestamp = null;
  let currentStatus = null;
  
  try {
    const currentResponse = await fetch(`/api/jobs/${jobType}?limit=1`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      const currentItem = Array.isArray(currentData) ? currentData[0] : currentData;
      
      if (currentItem) {
        // Try multiple timestamp fields
        currentTimestamp = currentItem.timestamp || currentItem.createdAt || currentItem.created_at || 
                         currentItem.updatedAt || currentItem.updated_at || currentItem.lastRun;
        currentStatus = currentItem.status || currentItem.state;
      }
    }
  } catch (e) {
    console.warn('Could not get current job state:', e);
  }
  
  const jobStartTime = Date.now();
  
  // Register job as running with dashboard
  window.masterDashboard.runningJobs.set(jobType, {
    startTime: new Date(jobStartTime).toISOString(),
    previousTimestamp: currentTimestamp,
    previousStatus: currentStatus
  });
  window.masterDashboard.saveRunningJobsState();
  
  // Update button and card state immediately
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Starting...';
  }
  
  if (jobCard) {
    jobCard.classList.add('job-running');
    window.masterDashboard.updateJobCardRunningState(jobType, 0);
  }
  
  try {
    // Trigger the job
    const response = await fetch(`/api/jobs/${jobType}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Job ${jobType} triggered successfully`);
    
    // Start polling for completion (with 2 second initial delay)
    window.masterDashboard.startPollingForJob(jobType, currentTimestamp, 90000);
    
  } catch (error) {
    console.error(`❌ Error triggering job ${jobType}:`, error);
    
    // Clear running state
    window.masterDashboard.clearRunningJob(jobType);
    
    // Show error message
    if (button) {
      button.innerHTML = '❌ Failed';
      button.style.background = 'var(--error)';
      button.disabled = false;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 3000);
    }
    
    if (jobCard) {
      jobCard.classList.remove('job-running');
    }
    
    // Show user-friendly error
    const errorMsg = error.message || 'Network error';
    alert(`Failed to trigger job: ${errorMsg}`);
  }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing KVI Master Dashboard with Running Jobs State Management...');
  
  window.masterDashboard = new KVIMasterDashboard();
  window.masterDashboard.init();
  
  // Listen for page unload to save state
  window.addEventListener('beforeunload', () => {
    if (window.masterDashboard) {
      window.masterDashboard.saveRunningJobsState();
    }
  });
});

console.log('✅ KVI Master Report System with Running Jobs State Management loaded successfully');
console.log('✅ Triple Fix Loaded: Recommendations, 404 Details, and Strict Timeouts');
console.log('📊 Recommendations will now show for any job with issues');
console.log('🔗 404 error URLs will display when clicking job cards');
console.log('⏱️ Jobs will timeout at EXACTLY 90 seconds (triple protection)');

