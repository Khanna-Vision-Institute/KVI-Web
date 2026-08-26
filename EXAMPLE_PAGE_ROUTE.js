// EXAMPLE: How to integrate Strapi pages into your Express routes
// This shows you how to modify your existing routes to fetch from Strapi

const { getPageBySlug } = require('./services/pages');

// ============================================
// EXAMPLE 1: Simple page route
// ============================================
// Replace this in your server.js:

// OLD CODE (serving static HTML):
app.get('/procedures/laser-vision/smile-laser/', (req, res) => {
  renderView('procedures/laser-vision/smile-page-complete.html', res, next);
});

// NEW CODE (fetching from Strapi):
app.get('/procedures/laser-vision/smile-laser/', async (req, res, next) => {
  try {
    // Try to get page from Strapi
    const pageData = await getPageBySlug('test-smile-laser-eye-surgery');
    
    if (pageData) {
      // Page exists in Strapi - render with Strapi data
      res.render('procedures/laser-vision/smile-page-complete.html', {
        pageData: pageData,
        // You can pass additional data too
        metaTitle: pageData.metaTitle,
        metaDescription: pageData.metaDescription
      });
    } else {
      // Page not in Strapi yet - serve static file as fallback
      renderView('procedures/laser-vision/smile-page-complete.html', res, next);
    }
  } catch (error) {
    console.error('Error loading page:', error);
    // Fallback to static file on error
    renderView('procedures/laser-vision/smile-page-complete.html', res, next);
  }
});


// ============================================
// EXAMPLE 2: Using the route mapping
// ============================================
// You can update your routeMap to be dynamic:

const { getPageBySlug } = require('./services/pages');

// Mapping of URL paths to Strapi slugs
const strapiPageSlugs = {
  '/procedures/laser-vision/smile-laser/': 'smile-laser-eye-surgery',
  '/procedures/laser-vision/lasik/': 'lasik-eye-surgery',
  '/procedures/lens-solutions/pie/': 'pie-presbyopic-lens-exchange',
  // Add more as you migrate them
};

// Then in your route handler:
Object.entries(routeMap).forEach(([url, filePath]) => {
  app.get(url, async (req, res, next) => {
    try {
      // Check if this route has a Strapi page
      const strapiSlug = strapiPageSlugs[url];
      
      if (strapiSlug) {
        const pageData = await getPageBySlug(strapiSlug);
        
        if (pageData) {
          // Render with Strapi data
          return res.render(filePath, { pageData });
        }
      }
      
      // Fallback to static file
      renderView(filePath, res, next);
    } catch (error) {
      console.error('Error:', error);
      renderView(filePath, res, next);
    }
  });
});


// ============================================
// EXAMPLE 3: Template usage
// ============================================
// In your HTML/EJS template file, use the pageData:

/*
<!-- procedures/laser-vision/smile-page-complete.html -->

<% if (typeof pageData !== 'undefined' && pageData) { %>
  <!-- Strapi-managed content -->
  
  <section class="hero">
    <% if (pageData.heroImage) { %>
      <img src="<%= pageData.heroImage %>" alt="<%= pageData.heroImageAlt %>">
    <% } %>
    <h1><%= pageData.title %></h1>
  </section>
  
  <section class="main-content">
    <%- pageData.content %>
  </section>
  
  <% if (pageData.sidebarContent) { %>
    <aside class="sidebar">
      <%- pageData.sidebarContent %>
    </aside>
  <% } %>
  
  <% if (pageData.cta.heading) { %>
    <section class="cta">
      <h2><%= pageData.cta.heading %></h2>
      <p><%= pageData.cta.description %></p>
      <a href="<%= pageData.cta.buttonLink %>" class="button">
        <%= pageData.cta.buttonText %>
      </a>
    </section>
  <% } %>
  
<% } else { %>
  <!-- Fallback: Static HTML content -->
  <section class="hero">
    <h1>SMILE Laser Eye Surgery</h1>
    <!-- Your existing static HTML -->
  </section>
<% } %>
*/


// ============================================
// EXAMPLE 4: Dynamic meta tags
// ============================================
// In your <head> section:

/*
<head>
  <% if (typeof pageData !== 'undefined' && pageData) { %>
    <title><%= pageData.metaTitle %></title>
    <meta name="description" content="<%= pageData.metaDescription %>">
  <% } else { %>
    <title>SMILE Laser Eye Surgery | Khanna Vision Institute</title>
    <meta name="description" content="Learn about SMILE laser eye surgery...">
  <% } %>
</head>
*/


// ============================================
// DEPLOYMENT INSTRUCTIONS
// ============================================

/*
To deploy and test:

1. Copy services/pages.js to server:
   scp -i key.pem services/pages.js ec2-user@server:/home/ec2-user/kvi-home/services/

2. Update server.js with one test route (like EXAMPLE 1 above)

3. Restart server:
   ssh -i key.pem ec2-user@server "cd kvi-home && pm2 restart kvi-home"

4. Test the route:
   Visit: https://khannainstitute.com/procedures/laser-vision/smile-laser/
   
5. If it works, gradually add more routes!
*/

