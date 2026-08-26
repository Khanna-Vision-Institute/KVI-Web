const axios = require('axios');

// Use localhost for server-to-server communication
const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';

/**
 * Get a single page by slug from Strapi
 * @param {string} slug - The page slug
 * @returns {Promise<Object|null>} Page data or null if not found
 */
async function getPageBySlug(slug) {
  try {
    const response = await axios.get(
      `${STRAPI_URL}/api/pages?filters[slug][$eq]=${slug}&populate=*`,
      {
        timeout: 5000, // 5 second timeout
      }
    );
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      return transformPageData(response.data.data[0]);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching page from Strapi:', error.message);
    return null;
  }
}

/**
 * Get all pages by category
 * @param {string} category - The page category (procedure, about, patient, etc.)
 * @returns {Promise<Array>} Array of pages
 */
async function getPagesByCategory(category) {
  try {
    const response = await axios.get(
      `${STRAPI_URL}/api/pages?filters[category][$eq]=${category}&filters[published][$eq]=true&populate=*`,
      {
        timeout: 5000,
      }
    );
    
    if (response.data && response.data.data) {
      return response.data.data.map(transformPageData);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching pages by category:', error.message);
    return [];
  }
}

/**
 * Get all published pages
 * @returns {Promise<Array>} Array of all published pages
 */
async function getAllPages() {
  try {
    const response = await axios.get(
      `${STRAPI_URL}/api/pages?filters[published][$eq]=true&populate=*`,
      {
        timeout: 5000,
      }
    );
    
    if (response.data && response.data.data) {
      return response.data.data.map(transformPageData);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching all pages:', error.message);
    return [];
  }
}

/**
 * Transform Strapi page data to a format compatible with templates
 * @param {Object} strapiPage - Raw Strapi page data
 * @returns {Object} Transformed page data
 */
function transformPageData(strapiPage) {
  // Strapi v4 nests fields under `attributes`; v5 often returns a flat document.
  const src =
    strapiPage &&
    strapiPage.attributes &&
    typeof strapiPage.attributes === 'object'
      ? strapiPage.attributes
      : strapiPage;

  return {
    id: strapiPage.id,
    documentId: strapiPage.documentId,
    pageName: src.pageName,
    slug: src.slug,
    category: src.category,
    title: src.title,
    metaTitle: src.metaTitle || src.title,
    metaDescription: src.metaDescription || '',
    content: src.Content || src.content || '',
    sidebarContent: src.sidebarContent || '',

    // Hero image
    heroImage: src.heroImage?.url || null,
    heroImageAlt: src.heroImage?.alternativeText || src.title,

    // Featured image
    featuredImage: src.featuredImage?.url || null,
    featuredImageAlt: src.featuredImage?.alternativeText || src.title,

    // CTA section
    cta: {
      heading: src.ctaHeading || null,
      description: src.ctaDescription || null,
      buttonText: src.ctaButtonText || 'Book Consultation',
      buttonLink: src.ctaButtonLink || '/contact/schedule-consultation/'
    },

    // Metadata
    published: src.published,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    publishedAt: src.publishedAt,

    source: 'strapi'
  };
}

/**
 * Check if a page exists in Strapi
 * @param {string} slug - The page slug
 * @returns {Promise<boolean>} True if page exists
 */
async function pageExists(slug) {
  const page = await getPageBySlug(slug);
  return page !== null;
}

module.exports = {
  getPageBySlug,
  getPagesByCategory,
  getAllPages,
  pageExists
};

