const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Guide to Common Eye Surgeries for Seniors</h1>

<p>As we age, our eyes naturally change. Reading becomes harder, colors look less vivid, and sometimes vision turns cloudy or distorted. While these changes are common, many can be corrected or even reversed thanks to modern ophthalmic surgery.</p>

<p>At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> specializes in a range of advanced eye procedures designed to restore clarity, improve comfort, and enhance quality of life for seniors.</p>

<p>This guide explains the most common eye surgeries for older adults, what each one treats, and how they can help you see more clearly again.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+10+senior+eye+surgery+consultation+aging+eye+health+exam.webp" alt="Senior Eye Surgery Consultation" class="blog-image">
</div>

<h2>1. Cataract Surgery</h2>

<p><strong>Cataract surgery</strong> is one of the most frequently performed and successful surgeries in the world. Cataracts occur when the natural lens of the eye becomes cloudy, often due to aging. This cloudiness blurs vision, fades colors, and increases glare sensitivity.</p>

<p>During cataract surgery, the cloudy lens is removed and replaced with a clear <strong>intraocular lens (IOL)</strong>. The procedure is quick, safe, and virtually painless. Most patients experience sharper vision within a day or two.</p>

<p>Modern lens options, such as <strong>multifocal</strong>, <strong>toric</strong>, or <strong>IC-8 small aperture lenses</strong>, can even reduce dependence on glasses after surgery.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna uses advanced imaging and laser-assisted techniques for precise outcomes and faster recovery.</p>

<h2>2. Refractive Lens Exchange (RLE)</h2>

<p>Refractive Lens Exchange, or <strong>RLE</strong>, is similar to cataract surgery but performed before a cataract forms. It replaces the natural lens with an artificial one to correct vision problems such as <strong>presbyopia, farsightedness, or nearsightedness</strong>.</p>

<p>RLE is ideal for seniors who want long-term vision correction and may not qualify for LASIK or SMILE due to age or corneal thickness.</p>

<p>Benefits of RLE include:</p>

<ul>
    <li>Clear vision at multiple distances</li>
    <li>Permanent lens replacement</li>
    <li>Elimination of cataract risk in the future</li>
</ul>

<p>Dr. Khanna tailors each lens choice based on lifestyle needs, whether for reading, driving, or computer work.</p>

<h2>3. Glaucoma Surgery</h2>

<p><strong>Glaucoma</strong> is a condition that damages the optic nerve, often due to increased eye pressure. If untreated, it can lead to irreversible vision loss.</p>

<p>When eye drops or medications do not control the pressure, surgical procedures can help. Common glaucoma treatments include:</p>

<ul>
    <li><strong>Laser Trabeculoplasty</strong>: Improves fluid drainage from the eye.</li>
    <li><strong>Minimally Invasive Glaucoma Surgery (MIGS)</strong>: Uses micro-stents to lower pressure with minimal trauma.</li>
    <li><strong>Trabeculectomy or Drainage Implants</strong>: Creates new drainage pathways for severe cases.</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna carefully evaluates the stage of glaucoma and recommends a treatment plan that balances safety, comfort, and vision preservation.</p>

<h2>4. Eyelid Surgery (Blepharoplasty)</h2>

<p>Sagging or drooping eyelids can affect both appearance and vision. <strong>Upper blepharoplasty</strong> is a simple outpatient surgery that removes excess skin and fat from the eyelids, restoring a more youthful, alert look.</p>

<p>For seniors, the benefits extend beyond cosmetics — it can also improve peripheral vision that droopy eyelids sometimes block.</p>

<p>Dr. Khanna performs upper eyelid surgery with precision to ensure natural, balanced results. Most patients return to normal activities within a week.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+10+senior+eye+surgery+consultation+aging+eye+health+exam1.webp" alt="Aging Eye Health Exam" class="blog-image">
</div>

<h2>5. Corneal Surgery</h2>

<p>The cornea, the clear front part of the eye, plays a key role in focusing light. Age-related or genetic conditions such as <strong>Fuchs' dystrophy</strong> or <strong>keratoconus</strong> can damage the cornea and blur vision.</p>

<p>Advanced corneal surgeries include:</p>

<ul>
    <li><strong>Corneal Transplant (Keratoplasty)</strong>: Replaces the damaged cornea with healthy donor tissue.</li>
    <li><strong>DSEK or DMEK</strong>: Partial transplants replacing only affected layers for faster recovery.</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, advanced technology allows minimally invasive techniques that promote faster healing and improved comfort.</p>

<h2>6. Laser Vision Correction for Seniors</h2>

<p>While LASIK and SMILE are often associated with younger patients, many seniors can still benefit from <strong>laser vision correction</strong> depending on their eye health.</p>

<p>For example:</p>

<ul>
    <li><strong>SMILE</strong> offers flap-free correction for those with suitable corneas.</li>
</ul>

<p>Dr. Khanna evaluates each patient individually to determine whether laser correction, lens-based surgery, or a combination of both is best suited for their eyes.</p>

<h2>7. Macular and Retinal Procedures</h2>

<p>Some seniors develop conditions affecting the retina, such as <strong>macular degeneration</strong> or <strong>retinal detachment</strong>. These require specialized surgical care to preserve vision.</p>

<p>While these conditions cannot always be cured, timely treatment can slow progression and protect remaining sight. Dr. Khanna collaborates with leading retinal specialists when needed to ensure comprehensive care.</p>

<h2>8. Choosing the Right Procedure</h2>

<p>The right surgery depends on your specific vision needs, eye health, and lifestyle. During a consultation at <strong>Khanna Vision Institute</strong>, a detailed evaluation is performed, including:</p>

<ul>
    <li>Vision testing and refraction</li>
    <li>Retinal and corneal imaging</li>
    <li>Tear film and lens assessment</li>
    <li>Discussion of goals and expectations</li>
</ul>

<p>Based on these results, Dr. Khanna provides clear, personalized recommendations.</p>

<h2>Why Seniors Trust Khanna Vision Institute</h2>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist with decades of experience in cataract, refractive, and eyelid surgeries. His approach emphasizes both medical safety and visual excellence.</p>

<p>Seniors choose <strong>Khanna Vision Institute</strong> because of:</p>

<ul>
    <li>Advanced diagnostic and surgical technology</li>
    <li>A personalized, transparent approach</li>
    <li>Proven results with minimal downtime</li>
    <li>A focus on long-term visual health and comfort</li>
</ul>

<p>Every patient receives one-on-one care before, during, and after surgery to ensure the best possible experience.</p>

<p>Modern eye surgery offers seniors an incredible opportunity to restore clear, comfortable vision — often better than they have experienced in years.</p>

<p>Whether you are dealing with cataracts, drooping eyelids, glaucoma, or age-related vision loss, <strong>Khanna Vision Institute</strong> provides safe, effective, and tailored solutions.</p>

<p>If you are ready to improve your vision and quality of life, schedule a consultation with <strong>Dr. Rajesh Khanna</strong> today. Clearer vision and renewed confidence may be just one step away.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Guide to Common Eye Surgeries for Seniors",
      slug: "2025/09/guide-to-common-eye-surgeries-for-seniors",
      content: blogContent,
      metaDescription: "Learn about the most common eye surgeries for seniors, including cataract, glaucoma, and eyelid procedures. Expert care and advanced vision correction by Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Discover the most common eye surgeries for seniors, from cataract surgery to glaucoma treatment. Learn how Dr. Rajesh Khanna helps restore clear vision and improve quality of life.",
      keywords: "eye surgery for seniors, cataract surgery, glaucoma treatment, eyelid surgery, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+10+senior+eye+surgery+consultation+aging+eye+health+exam.webp",
      publishedAt: new Date('2025-09-15'),
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

