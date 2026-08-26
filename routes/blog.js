const express = require('express');
const router = express.Router();
const path = require('path');
const { getBlogBySlug, getAllBlogs } = require('../services/mongodb');

// Static missing blogs that need to be added to the listing
const staticBlogs = [
  { slug: "2023/02/can-lasik-fix-presbyopia-sure-here-are-5-facts", title: "Can LASIK Fix Presbyopia? Sure — Here Are 5 Facts You Should Know", publishedAt: "2023-02-01", author: "Dr. Rajesh Khanna" },
  { slug: "2024/02/is-lasik-the-right-solution-for-nearsightedness", title: "Is LASIK the Right Solution for Nearsightedness?", publishedAt: "2024-02-01", author: "Dr. Rajesh Khanna" },
  { slug: "2022/07/smile-laser-eye-surgery", title: "SMILE Laser Eye Surgery", publishedAt: "2022-07-01", author: "Dr. Rajesh Khanna" },
  { slug: "2021/07/magnificent-six-leading-advantages-of-lasik-eye-surgery", title: "Magnificent Six Leading Advantages of LASIK Eye Surgery", publishedAt: "2021-07-01", author: "Dr. Rajesh Khanna" },
  { slug: "2021/06/independence-day-lasik-special", title: "Independence Day LASIK Special", publishedAt: "2021-06-01", author: "Dr. Rajesh Khanna" },
  { slug: "2023/05/the-evolution-and-benefits-of-the-ic-8-small-aperture-intraocular-lens", title: "The Evolution and Benefits of the IC-8 Small Aperture Intraocular Lens", publishedAt: "2023-05-01", author: "Dr. Rajesh Khanna" },
  { slug: "2024/04/the-latest-fda-approved-vision-correction-smile", title: "The Latest FDA Approved Vision Correction: SMILE", publishedAt: "2024-04-01", author: "Dr. Rajesh Khanna" },
  { slug: "2023/04/clear-vision-better-rides-lasik-advantages-for-snowboarders", title: "Clear Vision, Better Rides: LASIK Advantages for Snowboarders", publishedAt: "2023-04-01", author: "Dr. Rajesh Khanna" },
  { slug: "2022/06/bakersfield-presbyopia-treatment-for-a-hairstylist", title: "Bakersfield Presbyopia Treatment for a Hairstylist", publishedAt: "2022-06-01", author: "Dr. Rajesh Khanna" },
  { slug: "2024/04/see-the-world-differently-with-smile", title: "See the World Differently with SMILE", publishedAt: "2024-04-01", author: "Dr. Rajesh Khanna" },
  { slug: "2023/01/how-to-put-in-eye-drops-or-ointment", title: "How to Put in Eye Drops or Ointment", publishedAt: "2023-01-01", author: "Dr. Rajesh Khanna" },
  { slug: "2021/07/breakthrough-amblyopia-lazy-eye-treatment-for-adults", title: "Breakthrough Amblyopia Lazy Eye Treatment for Adults", publishedAt: "2021-07-01", author: "Dr. Rajesh Khanna" },
  { slug: "2023/05/studies-show-lasik-better-than-contact-lens", title: "Studies Show LASIK Better Than Contact Lens", publishedAt: "2023-05-01", author: "Dr. Rajesh Khanna" },
  { slug: "2023/06/ophthalmology-understanding-treating-medical-conditions-of-the-human-eye", title: "Ophthalmology: Understanding & Treating Medical Conditions of the Human Eye", publishedAt: "2023-06-01", author: "Dr. Rajesh Khanna" },
  { slug: "2024/02/evo-icl-vs-lasik-pros-and-cons-of-each-procedure", title: "EVO ICL vs LASIK: Pros and Cons of Each Procedure", publishedAt: "2024-02-01", author: "Dr. Rajesh Khanna" },
  { slug: "2020/11/in-7-minutes-get-young-again-new-eyes-with-pie", title: "In 7 Minutes Get Young Again: New Eyes with PIE", publishedAt: "2020-11-01", author: "Dr. Rajesh Khanna" },
  { slug: "2020/08/3-innovative-eye-surgeries-fix-astigmatism-enhance-vision", title: "3 Innovative Eye Surgeries: Fix Astigmatism & Enhance Vision", publishedAt: "2020-08-01", author: "Dr. Rajesh Khanna" },
  { slug: "2024/10/guide-to-common-eye-surgeries-for-seniors", title: "Guide to Common Eye Surgeries for Seniors", publishedAt: "2024-10-01", author: "Dr. Rajesh Khanna" }
];

// Procedure guides hub (must be before /:year/:month/:slug)
router.get(['/procedure-guides', '/procedure-guides/'], (req, res, next) => {
  res.render('blog/procedure-guides.html', (err, html) => {
    if (err) return next(err);
    res.send(html);
  });
});

// Blog listing page
router.get('/latest', async (req, res, next) => {
  try {
    const blogs = await getAllBlogs();
    
    // Add static blogs to the list
    const allBlogs = [...blogs, ...staticBlogs];
    
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
    
    res.render('blog-listing.html', { blogs: uniqueBlogs });
  } catch (error) {
    console.error('Blog listing route error:', error);
    next(error);
  }
});

// Match blog URLs like /2023/02/can-lasik-fix-presbyopia-sure-here-are-5-facts
router.get('/:year/:month/:slug', async (req, res, next) => {
  try {
    const { year, month, slug } = req.params;
    const fullSlug = `${year}/${month}/${slug}`;
    
    const blog = await getBlogBySlug(fullSlug);
    
    if (!blog) {
      return res.status(404).render('404.html', (err, html) => {
        if (err) return next();
        res.status(404).send(html);
      });
    }

    res.render('blog-layout.html', { blog });
  } catch (error) {
    console.error('Blog route error:', error);
    next(error);
  }
});

module.exports = router;
