const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Can LASIK Fix Presbyopia? Sure — Here Are 5 Facts You Should Know</h1>

<p>As we age, reading the newspaper or checking a phone screen often becomes harder. This happens because of a natural eye condition called <strong>presbyopia</strong>, usually starting after age 40. Many people who already had perfect vision suddenly need reading glasses. But what if there was a way to fix it without depending on glasses all the time?</p>

<p>That's where <strong>LASIK</strong> comes in — or more accurately, <strong>customized vision correction treatments</strong> based on LASIK technology. In this article, we'll look at five simple facts that explain how LASIK and advanced techniques at <strong>Khanna Vision Institute</strong> can help people with presbyopia see clearly again.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+1+lasik+presbyopia+treatment+facts+clear+vision+after+lasik+for+presbyopia.webp" alt="LASIK for Presbyopia Treatment" class="blog-image">
</div>

<h2>1. Presbyopia Is a Natural Aging Change — Not a Disease</h2>

<p>Presbyopia happens because the natural lens inside your eye becomes less flexible over time. This loss of flexibility makes it difficult to focus on nearby objects. Everyone experiences it eventually, even if they never needed glasses before.</p>

<p>It's important to know that presbyopia isn't a disease — it's just part of normal aging. The good news is that modern laser vision correction can help reduce or even eliminate the need for reading glasses.</p>

<h2>2. Traditional LASIK Alone Cannot Fully Fix Presbyopia</h2>

<p>Regular LASIK surgery reshapes the cornea to correct distance vision problems like <strong>nearsightedness, farsightedness, or astigmatism</strong>. However, presbyopia involves the <strong>lens inside the eye</strong>, not just the cornea.</p>

<p>That means standard LASIK doesn't directly "cure" presbyopia. But, advanced variations such as <strong>Presby-LASIK</strong>, <strong>Blended Vision LASIK</strong>, or <strong>Monovision LASIK</strong> can provide effective solutions. These procedures are customized for each person's vision, allowing one eye to see better up close and the other to see better far away.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Rajesh Khanna personally evaluates each patient's eye condition to choose the safest and most accurate treatment.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+1+lasik+presbyopia+treatment+facts+clear+vision+after+lasik+for+presbyopia+1.webp" alt="Advanced Presbyopia Treatment Options" class="blog-image">
</div>

<h2>3. Modern Alternatives Offer Better Results for Presbyopia</h2>

<p>While LASIK is a great option for many, other advanced procedures can offer more natural results for presbyopia correction. These include:</p>

<ul>
    <li><strong>PIE (Presbyopic Implant in Eye)</strong> — A newer lens-based technique that can replace the aging lens and restore both near and distance vision.</li>
    <li><strong>IC-8 Small Aperture IOL</strong> — Recently FDA-approved, this lens provides clear vision at all distances by increasing depth of focus.</li>
    <li><strong>KAMRA Inlay or Raindrop Inlay (small aperture inlays)</strong> — These tiny devices are implanted in one eye to improve near vision.</li>
</ul>

<p>Each method has specific advantages, and the right choice depends on your age, eye health, and lifestyle needs.</p>

<h2>4. Experience and Personalization Are Key to Success</h2>

<p>Laser eye surgery is not a one-size-fits-all procedure. The results depend greatly on technology, surgeon skill, and personalized planning.</p>

<p>At <strong>Khanna Vision Institute</strong>, every procedure starts with advanced diagnostic testing — including corneal mapping, wavefront analysis, and lens evaluation. Dr. Khanna then explains every option clearly, helping patients make confident, informed decisions.</p>

<p>This personalized approach ensures long-lasting clarity and safety, aligned with <strong>Google's EEAT principles</strong> — expertise, experience, authoritativeness, and trustworthiness.</p>

<h2>5. LASIK and Presbyopia Treatments Can Help You Stay Active and Independent</h2>

<p>Whether you're working at a computer, reading, or playing sports, good vision brings freedom. Many patients who choose presbyopia-correcting LASIK or lens procedures enjoy life without constantly searching for their reading glasses.</p>

<p>Patients often report improved quality of life — they can drive, read, and enjoy daily activities with less dependence on glasses.</p>

<p>If you're over 40 and frustrated by your reading glasses, it's worth talking to an experienced ophthalmologist. With modern technology, <strong>clear vision at every distance</strong> is now possible.</p>

<p>Presbyopia is a natural part of aging, but you don't have to accept blurred near vision. At <strong>Khanna Vision Institute</strong>, we offer advanced laser and lens-based treatments, including <strong>Presby-LASIK, PIE, and IC-8 IOLs</strong>, to restore youthful vision.</p>

<p>Schedule a consultation with <strong>Dr. Rajesh Khanna</strong> to discover the safest, most effective way to reduce your dependence on glasses — and see life clearly again.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Can LASIK Fix Presbyopia? Sure — Here Are 5 Facts You Should Know",
      slug: "2023/02/can-lasik-fix-presbyopia-sure-here-are-5-facts",
      content: blogContent,
      metaDescription: "Can LASIK fix presbyopia? Learn 5 key facts about modern laser and lens treatments that can restore near vision after 40. Expert insights from Khanna Vision Institute.",
      excerpt: "Discover how LASIK and advanced vision correction techniques can help treat presbyopia. Learn about Presby-LASIK, PIE, IC-8 IOL, and other modern solutions from Khanna Vision Institute.",
      keywords: "LASIK for presbyopia, presbyopia correction, presby-LASIK, IC-8 IOL, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+1+lasik+presbyopia+treatment+facts+clear+vision+after+lasik+for+presbyopia.webp",
      publishedAt: new Date('2023-02-15'),
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

