const axios = require('axios');
const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';

// Helper function to fetch page from Strapi by slug
async function fetchPageFromStrapi(slug) {
  try {
    console.log('Fetching from Strapi, slug:', slug);
    const response = await axios.get(`${STRAPI_API_URL}/api/pages?filters[slug][$eq]=${encodeURIComponent(slug)}`);
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching from Strapi:', error.message);
    return null;
  }
}

// Helper function to fetch all blogs from Strapi
async function fetchBlogsFromStrapi() {
  try {
    console.log('Fetching all blogs from Strapi');
    const response = await axios.get(`${STRAPI_API_URL}/api/pages?filters[category][$eq]=blog&sort=publishedDate:desc`);
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching blogs from Strapi:', error.message);
    return [];
  }
}

module.exports = { fetchPageFromStrapi, fetchBlogsFromStrapi };
