const express = require('express');
const axios = require('axios');
const router = express.Router();

const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';

// Fetch all pages from Strapi (for sitemap or listing)
router.get('/all', async (req, res) => {
  try {
    const response = await axios.get(`${STRAPI_API_URL}/api/pages`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching pages from Strapi:', error.message);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// Fetch a single page by slug
router.get('/:slug(*)', async (req, res) => {
  try {
    const slug = req.params.slug || 'home';
    console.log('Fetching page from Strapi with slug:', slug);
    
    const response = await axios.get(`${STRAPI_API_URL}/api/pages?filters[slug][\$eq]=${slug}`);
    
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      console.log('Page not found in Strapi for slug:', slug);
      return res.status(404).render('404', { slug });
    }
    
    const page = response.data.data[0];
    console.log('Page found:', page.pageName);
    
    // Render page with Strapi data
    res.render('page-template', {
      title: page.pageName || 'Khanna Vision Institute',
      content: page.content || '',
      metaDescription: page.metaDescription || '',
      slug: page.slug,
      pageData: page
    });
    
  } catch (error) {
    console.error('Error fetching page from Strapi:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
