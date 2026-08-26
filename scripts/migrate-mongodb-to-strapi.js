#!/usr/bin/env node

/**
 * MongoDB to Strapi Migration Script
 * 
 * This script migrates all blog posts from MongoDB to Strapi CMS
 * 
 * Usage:
 *   node scripts/migrate-mongodb-to-strapi.js
 * 
 * What it does:
 *   1. Connects to MongoDB
 *   2. Fetches all blog posts
 *   3. Transforms data to Strapi format
 *   4. Creates posts in Strapi via API
 *   5. Preserves: title, content, date, author, slug, excerpt, tags, featuredImage
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';
const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASS = process.env.MONGODB_PASS;

const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN; // You'll need to create this

// Color output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Transform MongoDB blog post to Strapi format
 */
function transformToStrapi(mongoPost) {
  // Extract slug without year/month prefix
  let cleanSlug = mongoPost.slug || '';
  // Remove /YYYY/MM/ prefix if exists
  cleanSlug = cleanSlug.replace(/^\d{4}\/\d{2}\//, '');
  
  const data = {
    Title: mongoPost.title,
    Content: mongoPost.content,
    Date: mongoPost.publishedAt || mongoPost.date || mongoPost.createdAt,
    Author: mongoPost.author || 'Dr. Rajesh Khanna',
    slug: cleanSlug,
    Excerpt: mongoPost.excerpt || mongoPost.metaDescription || '',
    Tags: mongoPost.tags || mongoPost.keywords || '',
    publishedAt: mongoPost.publishedAt || mongoPost.date || new Date()
  };
  
  // Only add featuredImageUrl if the post has a featured image
  // Strapi may not have this field yet, so we'll handle it gracefully
  if (mongoPost.featuredImage) {
    data.FeaturedImageUrl = mongoPost.featuredImage; // Try capitalized version
  }
  
  return data;
}

/**
 * Create blog post in Strapi
 */
async function createStrapiPost(postData, token) {
  try {
    const response = await axios.post(
      `${STRAPI_URL}/api/blog-posts`,
      { data: postData },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Main migration function
 */
async function migrateToStrapi() {
  log('\n================================================', 'blue');
  log('MongoDB to Strapi Migration Tool', 'blue');
  log('================================================\n', 'blue');

  // Check for API token
  if (!STRAPI_API_TOKEN) {
    log('❌ ERROR: STRAPI_API_TOKEN not set in .env file\n', 'red');
    log('To create an API token:', 'yellow');
    log('1. Go to Strapi Admin → Settings → API Tokens', 'yellow');
    log('2. Click "Create new API Token"', 'yellow');
    log('3. Name: "Migration Script"', 'yellow');
    log('4. Token type: Full access', 'yellow');
    log('5. Copy the token and add to .env:', 'yellow');
    log('   STRAPI_API_TOKEN=your_token_here\n', 'yellow');
    process.exit(1);
  }

  // Build MongoDB connection string
  let uri;
  if (MONGODB_USER && MONGODB_PASS) {
    uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  } else {
    uri = `${MONGODB_URI}/${MONGODB_DB}`;
  }

  const client = new MongoClient(uri);

  try {
    // Connect to MongoDB
    log('Step 1: Connecting to MongoDB...', 'blue');
    await client.connect();
    log('✅ Connected to MongoDB\n', 'green');

    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    // Fetch all published posts
    log('Step 2: Fetching blog posts from MongoDB...', 'blue');
    const mongoPosts = await posts.find({
      status: 'published'
    }).toArray();

    log(`✅ Found ${mongoPosts.length} published posts\n`, 'green');

    if (mongoPosts.length === 0) {
      log('No posts to migrate. Exiting.', 'yellow');
      return;
    }

    // Migrate each post
    log('Step 3: Migrating posts to Strapi...\n', 'blue');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < mongoPosts.length; i++) {
      const post = mongoPosts[i];
      const postNum = `[${i + 1}/${mongoPosts.length}]`;
      
      log(`${postNum} Migrating: "${post.title}"`, 'blue');
      
      // Transform data
      const strapiData = transformToStrapi(post);
      
      // Create in Strapi
      const result = await createStrapiPost(strapiData, STRAPI_API_TOKEN);
      
      if (result.success) {
        log(`${postNum} ✅ Success`, 'green');
        successCount++;
      } else {
        log(`${postNum} ❌ Failed: ${result.error}`, 'red');
        errorCount++;
        errors.push({
          title: post.title,
          error: result.error
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    log('\n================================================', 'blue');
    log('Migration Complete!', 'blue');
    log('================================================\n', 'blue');
    log(`✅ Successfully migrated: ${successCount} posts`, 'green');
    if (errorCount > 0) {
      log(`❌ Failed: ${errorCount} posts\n`, 'red');
      log('Failed posts:', 'red');
      errors.forEach(err => {
        log(`  - ${err.title}: ${err.error}`, 'red');
      });
    }
    
    log('\nNext steps:', 'yellow');
    log('1. Check migrated posts in Strapi admin', 'yellow');
    log('2. Verify data looks correct', 'yellow');
    log('3. Test on website: https://khannainstitute.com/blog/latest/', 'yellow');
    log('4. If all looks good, you can keep MongoDB as backup', 'yellow');
    log('5. Or modify server to use only Strapi\n', 'yellow');

  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
    log('Disconnected from MongoDB\n', 'blue');
  }
}

// Run migration
if (require.main === module) {
  migrateToStrapi().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { migrateToStrapi, transformToStrapi };

