const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Understanding Upper Blepharoplasty: What You Need to Know</h1>

<p>As we age, the skin around our eyes often begins to loosen and sag. For many people, this creates a tired or heavy look, even when they feel alert and rested. In some cases, drooping upper eyelids can even affect vision.</p>

<p>The good news is that a simple outpatient procedure called <strong>upper blepharoplasty</strong> can correct this. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> specializes in performing this delicate eyelid surgery with precision, helping patients achieve a refreshed and youthful appearance while also improving functional vision.</p>

<p>This article explains what upper blepharoplasty is, who can benefit from it, and what to expect before, during, and after the procedure.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+6+upper+blepharoplasty+before+after+eyelid+surgery+diagram.webp" alt="Upper Blepharoplasty Before and After" class="blog-image">
</div>

<h2>1. What Is Upper Blepharoplasty</h2>

<p><strong>Upper blepharoplasty</strong> is a surgical procedure that removes excess skin, muscle, and sometimes fat from the upper eyelids. Over time, gravity, sun exposure, and natural aging cause the skin around the eyes to stretch and lose elasticity. This leads to folds or hooding that can make eyes appear smaller and heavier.</p>

<p>By removing the excess tissue, the procedure restores a smoother, firmer contour to the eyelid area. The result is a more awake, youthful, and balanced appearance.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna takes care to create a natural look, avoiding an overdone or "pulled" appearance. The goal is to help you look like yourself — only more refreshed.</p>

<h2>2. Who Can Benefit from Upper Blepharoplasty</h2>

<p>Upper blepharoplasty can be both a <strong>cosmetic and functional</strong> procedure.</p>

<p>You may be a good candidate if you:</p>

<ul>
    <li>Notice sagging or droopy skin on your upper eyelids</li>
    <li>Feel that your eyes look tired or aged even when you are well-rested</li>
    <li>Experience difficulty applying makeup due to loose upper eyelid skin</li>
    <li>Have upper eyelid droop that interferes with vision</li>
    <li>Are generally healthy and have realistic expectations about the results</li>
</ul>

<p>During your consultation, Dr. Khanna performs a detailed eye and facial evaluation to determine if this surgery is right for you.</p>

<h2>3. Functional Benefits of Upper Blepharoplasty</h2>

<p>While many people choose upper blepharoplasty for cosmetic reasons, the procedure can also provide important <strong>functional benefits</strong>.</p>

<p>When upper eyelid skin hangs low, it can block part of your field of vision — especially your peripheral or upper vision. Patients often notice improvement in everyday tasks like reading, driving, and computer work once the excess skin is removed.</p>

<p>In these cases, blepharoplasty may even be considered <strong>medically necessary</strong>, and insurance coverage may apply.</p>

<h2>4. The Procedure: Step-by-Step</h2>

<p>At <strong>Khanna Vision Institute</strong>, upper blepharoplasty is usually performed under local anesthesia with mild sedation, making it comfortable and safe for most patients.</p>

<ol>
    <li><strong>Preparation</strong>: Your upper eyelid area is cleansed and marked to guide precise tissue removal.</li>
    <li><strong>Anesthesia</strong>: Local anesthetic is applied to ensure a pain-free experience.</li>
    <li><strong>Incision</strong>: A small incision is made in the natural crease of the eyelid to minimize visible scarring.</li>
    <li><strong>Tissue Removal</strong>: Dr. Khanna carefully removes excess skin, muscle, and fat as needed.</li>
    <li><strong>Closure</strong>: The incision is closed with fine sutures, which are usually removed within a week.</li>
</ol>

<p>The entire procedure typically takes about one hour, and patients return home the same day.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+6+upper+blepharoplasty+before+after+eyelid+surgery+diagram1.webp" alt="Upper Blepharoplasty Eyelid Surgery Diagram" class="blog-image">
</div>

<h2>5. Recovery and Results</h2>

<p>Recovery from upper blepharoplasty is generally smooth and quick. Most patients experience mild swelling or bruising for a few days, which gradually fades within one to two weeks.</p>

<p>To promote healing, Dr. Khanna provides detailed post-surgery instructions, which include:</p>

<ul>
    <li>Applying cold compresses to reduce swelling</li>
    <li>Using prescribed ointments or drops as directed</li>
    <li>Avoiding heavy exercise and direct sunlight for the first week</li>
</ul>

<p>Most people feel comfortable returning to work and normal activities within seven to ten days.</p>

<p>Results become noticeable as the swelling resolves — revealing smoother, more youthful eyelids. The tiny incision lines are hidden in the natural crease, fading almost completely over time.</p>

<h2>6. Long-Term Benefits</h2>

<p>The effects of upper blepharoplasty can last for many years. While aging continues naturally, the eyes typically retain their improved contour and openness.</p>

<p>In addition to cosmetic enhancement, many patients also notice easier eyelid movement and less eye fatigue throughout the day.</p>

<p>By combining upper blepharoplasty with other rejuvenation treatments such as lower eyelid surgery or non-surgical skin tightening, patients can achieve a more comprehensive and balanced improvement.</p>

<h2>7. Safety and Expertise Matter</h2>

<p>Upper blepharoplasty is a delicate procedure that requires both surgical skill and an artistic eye. Dr. Rajesh Khanna combines years of ophthalmic surgical experience with a focus on aesthetics, ensuring every patient receives results that are safe, natural, and personalized.</p>

<p>At <strong>Khanna Vision Institute</strong>, the focus is always on safety, transparency, and comfort. Advanced imaging and planning tools are used to design each surgery with precision.</p>

<p>Every step — from consultation to recovery — is closely monitored to provide the highest quality care.</p>

<h2>8. Why Choose Khanna Vision Institute</h2>

<p>Patients trust <strong>Khanna Vision Institute</strong> because of:</p>

<ul>
    <li>Dr. Khanna's deep expertise in both eye surgery and facial aesthetics</li>
    <li>A modern, comfortable environment with state-of-the-art technology</li>
    <li>A personalized approach that values natural-looking outcomes</li>
    <li>Clear communication about every stage of treatment</li>
</ul>

<p>The institute's philosophy is centered on improving vision, confidence, and overall quality of life.</p>

<p>Upper blepharoplasty is a safe, effective, and lasting way to restore youthful, natural-looking eyelids. Whether your goal is to enhance appearance, improve vision, or both, the results can be transformative.</p>

<p>If droopy eyelids are affecting how you look or see, schedule a consultation at <strong>Khanna Vision Institute</strong>. <strong>Dr. Rajesh Khanna</strong> will carefully evaluate your eyes and recommend the most appropriate treatment plan for your needs.</p>

<p>Rejuvenating your eyes is not just about appearance — it is about feeling more awake, confident, and comfortable every day.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Understanding Upper Blepharoplasty: What You Need to Know",
      slug: "2025/07/understanding-upper-blepharoplasty",
      content: blogContent,
      metaDescription: "Learn everything about upper blepharoplasty — a simple, safe eyelid surgery that restores youthful eyes and improves vision. Expert care by Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Discover how upper blepharoplasty can restore youthful, natural-looking eyelids and improve vision. Learn about the procedure, recovery, and benefits from Dr. Rajesh Khanna.",
      keywords: "upper blepharoplasty, eyelid surgery, droopy eyelids treatment, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+6+upper+blepharoplasty+before+after+eyelid+surgery+diagram.webp",
      publishedAt: new Date('2025-07-15'),
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

