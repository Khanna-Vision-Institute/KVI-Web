const { MongoClient } = require('mongodb');
const { getAllStrapiBlogs, getStrapiBlogBySlug } = require('./strapi');

let client = null;
let db = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';
const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
// No hard-coded fallback password: MONGODB_PASS must come from the environment.
const MONGODB_PASS = process.env.MONGODB_PASS;

async function connect() {
  if (db) {
    return db;
  }

  if (!MONGODB_PASS) {
    throw new Error('MONGODB_PASS is not set; MongoDB (legacy blog posts) unavailable.');
  }

  try {
    // For local MongoDB with authentication
    const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
    
    client = new MongoClient(uri);

    await client.connect();
    db = client.db(MONGODB_DB);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function getMongoPublishedPosts() {
  // Legacy posts only. Missing MONGODB_PASS must not 500 the public blog:
  // Strapi (and the route's static list) still render.
  if (!MONGODB_PASS) {
    console.error('MONGODB_PASS is not set; skipping legacy MongoDB blog posts.');
    return [];
  }
  try {
    const database = await connect();
    const posts = database.collection('posts');
    return await posts.find({ status: 'published' }).sort({ publishedAt: -1 }).toArray();
  } catch (error) {
    console.error('MongoDB blogs unavailable:', error.message);
    return [];
  }
}

async function getBlogBySlug(slug) {
  try {
    // First, try to get from Strapi (newer, editable version)
    const strapiBlog = await getStrapiBlogBySlug(slug);
    
    if (strapiBlog) {
      return strapiBlog;
    }
    
    // If not found in Strapi, check MongoDB (legacy posts). A down or
    // unconfigured database is a miss, not a stack-trace page.
    if (!MONGODB_PASS) {
      console.error('MONGODB_PASS is not set; legacy MongoDB post lookup skipped for', slug);
      return null;
    }
    const database = await connect();
    const posts = database.collection('posts');
    return await posts.findOne({ slug: slug, status: 'published' });
  } catch (error) {
    console.error('Error fetching blog:', error);
    return null;
  }
}

async function getAllBlogs() {
  try {
    // Strapi first (returns [] on failure). Mongo is optional.
    const strapiBlogs = await getAllStrapiBlogs();
    const mongoDBblogs = await getMongoPublishedPosts();
    
    // Merge both sources. Strapi wins on duplicate slugs.
    const allBlogs = [...strapiBlogs, ...mongoDBblogs];
    
    // Remove duplicates by slug (keep the first one)
    const uniqueBlogs = [];
    const seenSlugs = new Set();
    
    for (const blog of allBlogs) {
      if (!seenSlugs.has(blog.slug)) {
        seenSlugs.add(blog.slug);
        uniqueBlogs.push(blog);
      }
    }
    
    // Sort by date (newest first)
    uniqueBlogs.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.date);
      const dateB = new Date(b.publishedAt || b.date);
      return dateB - dateA;
    });
    
    return uniqueBlogs;
  } catch (error) {
    console.error('Error fetching blogs:', error);
    throw error;
  }
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

module.exports = {
  connect,
  getBlogBySlug,
  getAllBlogs,
  close,
};

