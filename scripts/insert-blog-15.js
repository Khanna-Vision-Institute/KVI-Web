const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Breakthrough Amblyopia (Lazy Eye) Treatment for Adults</h1>

<p>For years, many adults believed that amblyopia, commonly known as lazy eye, could only be treated in childhood. Traditional medical thinking once suggested that after a certain age, the brain's visual system could no longer adapt. However, advances in eye care and neuroscience have changed that belief. Today, adults with amblyopia have new hope through modern treatment options that can significantly improve vision and depth perception. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> combines cutting-edge technology and personalized care to help adults overcome the challenges of lazy eye and experience clearer, more balanced vision.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+15+amblyopia+treatment+for+adults+lazy+eye+therapy+session.webp" alt="Amblyopia Treatment for Adults" class="blog-image">
</div>

<h2>Understanding Amblyopia</h2>

<p>Amblyopia is a condition in which one eye does not develop normal visual acuity, even when corrective lenses are used. It occurs because the brain favors one eye over the other, suppressing signals from the weaker eye. Over time, this imbalance leads to poor coordination and reduced clarity in the affected eye. The most common causes of amblyopia include:</p>

<ul>
    <li>Unequal refractive errors (one eye being more nearsighted or farsighted than the other)</li>
    <li>Strabismus (eye misalignment)</li>
    <li>Visual deprivation caused by conditions like cataracts during childhood</li>
</ul>

<p>While amblyopia usually starts in early childhood, it can persist into adulthood if not treated. The good news is that new therapies have shown the adult brain retains more visual plasticity than previously thought, meaning improvement is possible even later in life.</p>

<h2>Symptoms and Daily Impact</h2>

<p>Adults with amblyopia may experience:</p>

<ul>
    <li>Blurry or reduced vision in one eye</li>
    <li>Poor depth perception</li>
    <li>Eye strain, especially during reading or computer work</li>
    <li>Difficulty judging distances</li>
    <li>Problems with hand-eye coordination</li>
</ul>

<p>These symptoms can affect work performance, driving safety, and overall confidence. Many adults do not realize how much their vision imbalance limits them until they seek treatment.</p>

<h2>Modern Treatments for Adult Amblyopia</h2>

<p>Traditional eye patching therapy, where the stronger eye is covered to stimulate the weaker one, was primarily designed for children. While this approach can still help some adults, modern treatments are far more effective and comfortable.</p>

<h3>Vision Therapy</h3>
<p>Vision therapy involves customized exercises that train the eyes and brain to work together more efficiently. This includes focusing, tracking, and coordination exercises performed both in-office and at home. Over time, these activities strengthen the neural pathways responsible for vision in the weaker eye.</p>

<h3>Digital Amblyopia Training</h3>
<p>New digital platforms use virtual reality or computer-based games to stimulate both eyes simultaneously. These interactive exercises retrain the brain to use input from the weaker eye, promoting binocular (two-eyed) vision.</p>

<h3>Corrective Lenses and Laser Vision Correction</h3>
<p>In some adults, amblyopia is linked to unequal refractive errors between the eyes. Procedures like <strong>LASIK</strong> or <strong>SMILE</strong> can help balance vision, allowing both eyes to focus more equally. Correcting this imbalance helps the brain process input from both eyes instead of suppressing one.</p>

<h3>Pharmacologic and Neurological Treatments</h3>
<p>Recent studies show that certain medications and non-invasive brain stimulation techniques may enhance visual learning and speed up progress when combined with vision therapy. These advanced treatments are carefully supervised to ensure safety and effectiveness.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+15+amblyopia+treatment+for+adults+lazy+eye+therapy+session1.webp" alt="Lazy Eye Therapy Session" class="blog-image">
</div>

<h2>The Role of Technology and Expertise</h2>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna uses advanced diagnostic tools to measure eye coordination, focus strength, and visual potential. Each treatment plan is designed to fit the patient's specific needs and visual goals. By combining clinical precision with modern training methods, patients can experience measurable improvements in clarity, balance, and depth perception.</p>

<p>Dr. Khanna's background in refractive and medical ophthalmology allows him to approach amblyopia treatment from both a neurological and optical perspective. This dual focus ensures comprehensive care that goes beyond simply correcting vision — it retrains the visual system to function naturally and efficiently.</p>

<h2>Success in Adults</h2>

<p>Many adults who undergo modern amblyopia treatment notice improvement in both vision and confidence. Depth perception becomes sharper, reading becomes more comfortable, and everyday tasks such as driving or sports feel easier. While each case is unique, progress is often visible within weeks to months of consistent therapy.</p>

<p>Unlike older methods, today's amblyopia treatments are designed to work with adult brain function rather than against it. By encouraging both eyes to communicate with the brain simultaneously, these techniques help restore more natural vision patterns.</p>

<h2>When to Seek Treatment</h2>

<p>If you have one eye that always seems weaker or if you have struggled with depth perception for years, a comprehensive eye exam is the first step. Early detection and personalized treatment planning can significantly increase the chances of improvement.</p>

<p>Even adults who have been told in the past that nothing can be done often find that new technology offers realistic solutions today. The team at <strong>Khanna Vision Institute</strong> evaluates each patient with a detailed exam and explains the best available options for visual rehabilitation.</p>

<h2>Why Choose Khanna Vision Institute</h2>

<p><strong>Dr. Rajesh Khanna</strong> brings decades of experience in vision correction and ocular health to every patient. His approach focuses on identifying the root cause of visual imbalance and designing a plan that restores clarity and comfort. The institute combines advanced diagnostic technology, scientifically backed therapy methods, and compassionate care to ensure the best possible outcomes for adults with amblyopia.</p>

<p>Amblyopia is no longer a lifelong limitation. Thanks to modern technology and advanced vision therapy, adults can finally overcome the visual challenges once thought permanent. If you have been living with lazy eye and wish to improve your vision and quality of life, now is the time to explore new treatment options.</p>

<p>Schedule a comprehensive consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong> to learn how today's breakthrough amblyopia treatments can help you see more clearly and confidently at any age.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Breakthrough Amblyopia (Lazy Eye) Treatment for Adults",
      slug: "2021/07/breakthrough-amblyopia-lazy-eye-treatment-for-adults",
      content: blogContent,
      metaDescription: "Discover modern treatments for adult amblyopia (lazy eye) at Khanna Vision Institute. Learn how Dr. Rajesh Khanna helps adults improve vision with advanced, science-based care.",
      excerpt: "Learn about breakthrough treatments for adult amblyopia (lazy eye). Discover how modern vision therapy and advanced technology can help adults improve their vision and quality of life.",
      keywords: "amblyopia treatment for adults, lazy eye in adults, vision therapy California, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+15+amblyopia+treatment+for+adults+lazy+eye+therapy+session.webp",
      publishedAt: new Date('2021-07-15'),
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use upsert to insert or update
    const { _id, ...updateData } = blogPost;
    const result = await posts.updateOne(
      { slug: blogPost.slug },
      { $set: updateData },
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) {
      console.log('Blog post inserted with ID:', result.upsertedId);
    } else {
      console.log('Blog post updated successfully!');
    }
  } catch (error) {
    console.error('Error inserting blog:', error);
  } finally {
    await client.close();
  }
}

insertBlog();

