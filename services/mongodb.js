const { MongoClient } = require('mongodb');
const { getAllStrapiBlogs, getStrapiBlogBySlug } = require('./strapi');

let client = null;
let db = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';
const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';

async function connect() {
  if (db) {
    return db;
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

