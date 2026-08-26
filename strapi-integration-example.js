// Strapi Integration Example for server.js
// This file shows how to integrate Strapi with your existing Express server
// Copy the relevant parts to your server.js file

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ... your existing code ...

// ============================================
// STRAPI INTEGRATION
// ============================================
// Uncomment the following code after Strapi is installed and running

/*
// Proxy Strapi API requests to local Strapi instance
// This allows you to access Strapi API through your main domain
app.use('/strapi/api', createProxyMiddleware({
  target: 'http://localhost:1337',
  changeOrigin: true,
  pathRewrite: {
    '^/strapi/api': '/api', // Remove /strapi prefix, keep /api
  },
  onError: (err, req, res) => {
    console.error('Strapi proxy error:', err.message);
    res.status(503).json({ 
      error: 'Strapi service unavailable',
      message: 'Strapi CMS is not running or not accessible'
    });
  },
}));

// Proxy Strapi admin panel
app.use('/strapi/admin', createProxyMiddleware({
  target: 'http://localhost:1337',
  changeOrigin: true,
  pathRewrite: {
    '^/strapi/admin': '/admin',
  },
}));

// Health check for Strapi
app.get('/strapi/health', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:1337/api', {
      timeout: 2000
    });
    res.json({ 
      status: 'healthy', 
      strapi: 'running',
      version: response.data?.strapi?.version || 'unknown'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      strapi: 'not running',
      error: error.message 
    });
  }
});

// Example: Fetch content from Strapi
app.get('/api/content/:contentType', async (req, res) => {
  try {
    const axios = require('axios');
    const { contentType } = req.params;
    const { populate = '*', filters = {} } = req.query;
    
    const response = await axios.get(`http://localhost:1337/api/${contentType}`, {
      params: {
        populate,
        ...filters
      },
      headers: {
        'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN || ''}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Strapi content:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch content',
      message: error.message 
    });
  }
});
*/

// ... rest of your existing code ...

// Note: To use this integration:
// 1. Install http-proxy-middleware: npm install http-proxy-middleware
// 2. Make sure Strapi is running on port 1337
// 3. Uncomment the code above
// 4. Restart your Express server

