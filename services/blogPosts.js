const axios = require('axios');

const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';

function pickDate(post) {
  return post.Date || post.publishedAt || post.createdAt || null;
}

async function getAllBlogPosts() {
  try {
    let allBlogs = [];
    let page = 1;
    let pageCount = 1;
    const pageSize = 100; // Max allowed by Strapi
    
    // Fetch all pages
    do {
      const url = `${STRAPI_API_URL}/api/blog-posts?pagination[page]=${page}&pagination[pageSize]=${pageSize}&sort=publishedAt:desc`;
      const resp = await axios.get(url);
      const items = (resp.data && resp.data.data) ? resp.data.data : [];
      const pagination = resp.data.meta?.pagination;
      
      if (!items || !Array.isArray(items)) {
        break;
      }
      
      allBlogs = allBlogs.concat(items);
      
      if (pagination) {
        pageCount = pagination.pageCount || 1;
        page++;
      } else {
        break;
      }
    } while (page <= pageCount);
    
    console.log(`Fetched ${allBlogs.length} blog posts from Strapi (across ${pageCount} page(s))`);
    
    // Sort by date
    allBlogs.sort((a, b) => {
      const da = new Date(pickDate(a) || 0).getTime();
      const db = new Date(pickDate(b) || 0).getTime();
      return db - da;
    });
    
    return allBlogs;
  } catch (e) {
    console.error('Error fetching blog posts:', e.message);
    return [];
  }
}

async function getBlogPostBySlug(slug) {
  try {
    const url = `${STRAPI_API_URL}/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[limit]=1`;
    const resp = await axios.get(url);
    const items = (resp.data && resp.data.data) ? resp.data.data : [];
    return items.length ? items[0] : null;
  } catch (e) {
    console.error('Error fetching blog post by slug:', slug, e.message);
    return null;
  }
}

module.exports = { getAllBlogPosts, getBlogPostBySlug, pickDate };
