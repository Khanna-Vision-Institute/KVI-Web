const axios = require('axios');

// Strapi API configuration
// Use localhost for server-to-server communication (same machine, faster, no SSL overhead)
// External users access via https://cms.khannainstitute.com through Nginx
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_URL = `${STRAPI_URL}/api`;
const VERBOSE_BLOG_LOGS = String(process.env.VERBOSE_BLOG_LOGS || '').toLowerCase() === 'true';

/**
 * Fetch all blog posts from Strapi (handles pagination)
 */
async function getAllStrapiBlogs() {
  try {
    let allBlogs = [];
    let page = 1;
    let pageCount = 1;
    const pageSize = 100; // Request larger page size to minimize requests
    
    // Fetch all pages of blog posts
    do {
      const response = await axios.get(`${STRAPI_API_URL}/blog-posts?populate=*&pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      const strapiBlogs = response.data.data;
      const pagination = response.data.meta?.pagination;
      
      if (!strapiBlogs || !Array.isArray(strapiBlogs)) {
        console.log('No Strapi blogs found or invalid response');
        break;
      }
      
      // Add blogs from this page to the collection
      allBlogs = allBlogs.concat(strapiBlogs);
      
      // Update pagination info
      if (pagination) {
        pageCount = pagination.pageCount || 1;
        page++;
      } else {
        // No pagination info, assume we got everything
        break;
      }
      
    } while (page <= pageCount);
    
    if (VERBOSE_BLOG_LOGS) {
      console.log(`Fetched ${allBlogs.length} blogs from Strapi API (across ${pageCount} page(s))`);
    }
    
    // Transform Strapi data to match MongoDB format
    const transformedBlogs = allBlogs.map(blog => transformStrapiBlog(blog));
    
    // Optional debug logging (kept behind env flag to avoid production log growth).
    if (VERBOSE_BLOG_LOGS && transformedBlogs.length > 0) {
      const titlesPreview = transformedBlogs.slice(0, 10).map(b => b.title).join(', ');
      const moreCount = transformedBlogs.length > 10 ? ` ... and ${transformedBlogs.length - 10} more` : '';
      console.log(`Strapi blog titles (sample): ${titlesPreview}${moreCount}`);
    }
    
    return transformedBlogs;
  } catch (error) {
    console.error('Error fetching Strapi blogs:', error.message);
    if (error.response) {
      console.error('Strapi API response status:', error.response.status);
      console.error('Strapi API response data:', error.response.data);
    }
    return []; // Return empty array on error to not break the site
  }
}

/**
 * Fetch a single blog post by slug from Strapi
 */
async function getStrapiBlogBySlug(slug) {
  try {
    // Get all blogs and filter client-side
    const allBlogs = await getAllStrapiBlogs();
    
    // Find blog by matching full slug (year/month/slug-name)
    const blog = allBlogs.find(b => b.slug === slug);
    
    return blog || null;
  } catch (error) {
    console.error('Error fetching Strapi blog by slug:', error.message);
    return null;
  }
}

/**
 * Transform Strapi blog data to match MongoDB format
 */
function transformStrapiBlog(strapiBlog) {
  // Strapi v5 uses direct properties, not attributes
  const data = strapiBlog;
  
  // Handle both capitalized and lowercase field names
  const title = data.Title || data.title || 'Untitled';
  const content = data.Content || data.content || '';
  const date = data.Date || data.date || data.publishedAt;
  const author = data.Author || data.author || 'Dr. Rajesh Khanna';
  const tags = data.Tags || data.tags || '';
  const excerpt = data.Excerpt || data.excerpt || '';
  const slug = data.slug || data.Slug || generateSlug(title);
  
  // Convert Content array to HTML string if needed
  let contentHtml = '';
  if (Array.isArray(content)) {
    // Strapi rich text format - convert to HTML
    contentHtml = content.map(block => {
      if (block.type === 'paragraph') {
        const text = block.children.map(child => child.text).join('');
        return `<p>${text}</p>`;
      }
      return '';
    }).join('\n');
  } else {
    contentHtml = content;
  }
  
  // Extract date parts for URL structure (year/month/slug)
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  
  // Create full slug with date path
  const fullSlug = `${year}/${month}/${slug}`;
  
  // Get featured image from either Media field or direct URL field
  let featuredImageUrl = null;
  
  // Option 1: Check for direct URL field (for S3 images)
  if (data.featuredImageUrl || data.FeaturedImageUrl) {
    featuredImageUrl = data.featuredImageUrl || data.FeaturedImageUrl;
  }
  // Option 2: Check for uploaded media in Strapi
  else if (data.featuredImage?.data?.attributes?.url) {
    // Strapi v5 media format
    featuredImageUrl = data.featuredImage.data.attributes.url;
    // Add full URL if it's a relative path
    if (featuredImageUrl && !featuredImageUrl.startsWith('http')) {
      featuredImageUrl = `${STRAPI_URL}${featuredImageUrl}`;
    }
  }
  
  return {
    _id: `strapi-${strapiBlog.id}`,
    documentId: data.documentId || strapiBlog.documentId || null,
    strapiEntityId: data.documentId || strapiBlog.documentId || strapiBlog.id,
    title: title,
    content: contentHtml,
    excerpt: excerpt || extractExcerpt(contentHtml),
    slug: fullSlug,
    author: author,
    tags: tags,
    date: date,
    publishedAt: data.publishedAt,
    status: 'published',
    featuredImage: featuredImageUrl,
    source: 'strapi' // Mark as coming from Strapi
  };
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract excerpt from content (first 160 characters)
 */
function extractExcerpt(content) {
  if (!content) return '';
  
  // Remove HTML tags
  const plainText = content.replace(/<[^>]*>/g, '');
  
  // Get first 160 characters
  return plainText.substring(0, 160) + (plainText.length > 160 ? '...' : '');
}

function strapiWriteHeaders() {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error('STRAPI_API_TOKEN not configured on website server');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .replace(/^\//, '')
    .replace(/^\d{4}\/\d{2}\//, '');
}

async function getStrapiBlogByCleanSlug(cleanSlug) {
  const slug = normalizeSlug(cleanSlug);
  if (!slug) return null;
  const url = `${STRAPI_API_URL}/blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`;
  const response = await axios.get(url, { headers: strapiWriteHeaders(), timeout: 15000 });
  const rows = response.data?.data;
  if (Array.isArray(rows) && rows.length > 0) return rows[0];

  // Fallback: scan loaded blogs when filter misses due to slug casing/format drift.
  const all = await getAllStrapiBlogs();
  return (
    all.find((b) => normalizeSlug(b.slug) === slug) ||
    all.find((b) => String(b.slug || '').endsWith(`/${slug}`)) ||
    null
  );
}

function strapiEntityId(row) {
  if (!row) return null;
  return row.documentId || row.strapiEntityId || row.id || null;
}

async function fetchRawStrapiByEntityId(entityId) {
  const response = await axios.get(`${STRAPI_API_URL}/blog-posts/${entityId}`, {
    headers: strapiWriteHeaders(),
    timeout: 15000,
  });
  return response.data?.data || null;
}

/**
 * Create a published blog post in Strapi (used by GrowthOps approval flow).
 */
async function createStrapiBlogPost({
  title,
  html,
  markdown,
  excerpt,
  author,
  publishedAt,
  slug,
  tags,
}) {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) {
    throw new Error('STRAPI_API_TOKEN not configured on website server');
  }
  if (!title || !(html || markdown)) {
    throw new Error('title and html/markdown are required');
  }

  const contentHtml = html || String(markdown || '');
  const cleanSlug = (slug || generateSlug(title)).replace(/^\d{4}\/\d{2}\//, '');
  const when = publishedAt ? new Date(publishedAt) : new Date();
  if (Number.isNaN(when.getTime())) {
    throw new Error('invalid publishedAt');
  }

  const postData = {
    Title: String(title).trim(),
    Content: contentHtml,
    Date: when.toISOString(),
    Author: author || 'Dr. Rajesh Khanna',
    slug: cleanSlug,
    Excerpt: excerpt || extractExcerpt(contentHtml),
    Tags: tags || 'SEO,GrowthOps',
    publishedAt: when.toISOString(),
  };

  const response = await axios.post(
    `${STRAPI_API_URL}/blog-posts`,
    { data: postData },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const fullSlug = `${year}/${month}/${cleanSlug}`;

  return {
    strapiId: response.data?.data?.id || null,
    slug: fullSlug,
    url: `https://khannainstitute.com/${fullSlug}`,
    listingUrl: 'https://khannainstitute.com/blog/latest/',
  };
}

async function listPublishedStrapiBlogs() {
  return getAllStrapiBlogs();
}

async function updateStrapiBlogBySlug({
  slug,
  entityId,
  title,
  html,
  markdown,
  excerpt,
  author,
  tags,
  publishedAt,
}) {
  const cleanSlug = normalizeSlug(slug);
  let existing = null;
  if (entityId) {
    existing = await fetchRawStrapiByEntityId(entityId);
  } else {
    existing = await getStrapiBlogByCleanSlug(cleanSlug);
  }
  if (!existing) throw new Error(`blog_not_found:${cleanSlug}`);

  const hasNewContent = html != null || markdown != null;
  const contentHtml = hasNewContent
    ? html != null && html !== ''
      ? String(html)
      : String(markdown || '')
    : String(existing.Content || existing.content || '');

  const existingDateRaw = existing.Date || existing.date || existing.publishedAt;
  const when =
    publishedAt != null && publishedAt !== ''
      ? new Date(publishedAt)
      : existingDateRaw
        ? new Date(existingDateRaw)
        : new Date();
  if (Number.isNaN(when.getTime())) throw new Error('invalid publishedAt');

  const data = {
    Title: String(
      title != null && title !== ''
        ? title
        : existing.Title || existing.title || ''
    ).trim(),
    Content: contentHtml,
    Date: when.toISOString(),
    Author: String(
      author != null && author !== ''
        ? author
        : existing.Author || existing.author || 'Dr. Rajesh Khanna'
    ),
    slug: cleanSlug,
    Excerpt:
      excerpt != null && excerpt !== ''
        ? String(excerpt).trim()
        : extractExcerpt(contentHtml || existing.Excerpt || existing.excerpt || ''),
    Tags: String(tags || existing.Tags || existing.tags || 'SEO,GrowthOps'),
    publishedAt: when.toISOString(),
  };

  const targetId = strapiEntityId(existing);
  if (!targetId) throw new Error(`blog_entity_missing:${cleanSlug}`);

  const response = await axios.put(
    `${STRAPI_API_URL}/blog-posts/${targetId}`,
    { data },
    { headers: strapiWriteHeaders(), timeout: 15000 }
  );

  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, '0');
  return {
    strapiId: targetId,
    slug: `${year}/${month}/${cleanSlug}`,
    url: `https://khannainstitute.com/${year}/${month}/${cleanSlug}`,
    listingUrl: 'https://khannainstitute.com/blog/latest/',
    raw: response.data?.data || null,
  };
}

async function deleteStrapiBlogBySlug(slug, entityId) {
  const cleanSlug = normalizeSlug(slug);
  let existing = null;
  if (entityId) {
    existing = { id: entityId, documentId: entityId };
  } else {
    existing = await getStrapiBlogByCleanSlug(cleanSlug);
  }
  if (!existing) throw new Error(`blog_not_found:${cleanSlug}`);
  const targetId = strapiEntityId(existing);
  if (!targetId) throw new Error(`blog_entity_missing:${cleanSlug}`);
  await axios.delete(`${STRAPI_API_URL}/blog-posts/${targetId}`, {
    headers: strapiWriteHeaders(),
    timeout: 15000,
  });
  return { strapiId: targetId, slug: cleanSlug };
}

module.exports = {
  getAllStrapiBlogs,
  getStrapiBlogBySlug,
  listPublishedStrapiBlogs,
  updateStrapiBlogBySlug,
  deleteStrapiBlogBySlug,
  createStrapiBlogPost,
  generateSlug,
  extractExcerpt,
  STRAPI_URL,
};

