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

async function getBlogBySlug(slug) {
  try {
    // First, try to get from Strapi (newer, editable version)
    const strapiBlog = await getStrapiBlogBySlug(slug);
    
    if (strapiBlog) {
      return strapiBlog;
    }
    
    // If not found in Strapi, check MongoDB (legacy posts)
    const database = await connect();
    const posts = database.collection('posts');
    const mongoDBblog = await posts.findOne({ slug: slug, status: 'published' });
    
    return mongoDBblog;
  } catch (error) {
    console.error('Error fetching blog:', error);
    throw error;
  }
}

async function getAllBlogs() {
  try {
    // Fetch from both MongoDB and Strapi
    const database = await connect();
    const posts = database.collection('posts');
    const mongoDBblogs = await posts.find({ status: 'published' }).sort({ publishedAt: -1 }).toArray();
    
    // Get Strapi blogs
    const strapiBlogs = await getAllStrapiBlogs();
    
    // Merge both sources
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

