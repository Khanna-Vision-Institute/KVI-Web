const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>In 7 Minutes Get Young Again: New Eyes with PIE</h1>

<p>Aging is a natural process, but that doesn't mean you have to accept its effects on your vision. Many people begin to notice changes in their eyesight in their 40s or 50s — reading becomes harder, night vision declines, and glasses seem to multiply in every corner of the house. These are common signs of <strong>presbyopia</strong>, the age-related loss of near vision. The good news is that you can now restore youthful sight in just a few minutes with a breakthrough procedure called <strong>PIE (Presbyopic Implant in Eye)</strong>. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> offers this advanced treatment to help patients see clearly at all distances — without glasses or contact lenses — and feel young again through naturally restored vision.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+20+presbyopic+implant+in+eye+procedure+pie+surgery+before+after+results.webp" alt="Presbyopic Implant in Eye Procedure" class="blog-image">
</div>

<h2>What Is PIE</h2>

<p><strong>PIE</strong>, short for <strong>Presbyopic Implant in Eye</strong>, is a state-of-the-art lens replacement procedure that corrects presbyopia and other age-related vision problems such as cataracts, nearsightedness, and farsightedness. Instead of reshaping the cornea, as in LASIK or SMILE, PIE replaces the aging natural lens with a new, clear, and flexible artificial lens known as an intraocular lens (IOL).</p>

<p>This new lens restores your ability to focus at multiple distances — near, intermediate, and far — giving you complete visual freedom. The PIE procedure is precise, minimally invasive, and typically completed in about seven minutes per eye. Most patients notice clearer vision almost immediately after surgery.</p>

<h2>Why Eyes Age and How PIE Helps</h2>

<p>As the human lens ages, it loses flexibility and becomes cloudy. This limits the eye's ability to adjust focus between near and far objects. Glasses or bifocals may help temporarily, but they do not stop the underlying issue. The PIE procedure directly addresses the cause of presbyopia by replacing the stiff natural lens with an advanced, dynamic lens that mimics the eye's youthful flexibility.</p>

<p>The result is crisp, bright, and natural vision — whether you are reading a text message, driving, or enjoying a sunset. Patients often describe PIE as "turning back the clock" for their eyes because it restores both clarity and adaptability.</p>

<h2>The 7-Minute Procedure</h2>

<p>The PIE procedure is quick, safe, and comfortable. It is performed under local anesthesia, and you remain awake but relaxed during the process. Here's what to expect:</p>

<ol>
    <li><strong>Preparation</strong> — Numbing eye drops are applied to ensure comfort.</li>
    <li><strong>Lens Removal</strong> — A small opening is made in the cornea using advanced laser or micro-incision technology. The old lens is gently removed.</li>
    <li><strong>Lens Implantation</strong> — The new presbyopic lens is inserted through the same small incision, where it unfolds and positions itself naturally.</li>
    <li><strong>Completion</strong> — The incision seals itself without stitches, and you can return home shortly after.</li>
</ol>

<p>The entire process typically takes less than seven minutes per eye. Most patients notice improvement within hours, with vision stabilizing over the next few days.</p>

<h2>Benefits of PIE</h2>

<p>PIE offers several life-changing benefits that go beyond simple vision correction:</p>

<ul>
    <li><strong>Clear vision at all distances</strong> — near, intermediate, and far</li>
    <li><strong>Freedom from reading glasses or bifocals</strong></li>
    <li><strong>No more cataracts</strong> — since the natural lens is replaced, cataracts can never form again</li>
    <li><strong>Quick recovery and minimal downtime</strong></li>
    <li><strong>Natural, youthful vision quality</strong></li>
    <li><strong>Long-lasting results</strong> that do not fade with time</li>
</ul>

<p>Many patients who choose PIE say they not only see better but feel younger and more confident in their daily lives.</p>

<h2>PIE vs Other Procedures</h2>

<p>PIE differs from procedures like <strong>LASIK</strong>, <strong>SMILE</strong>, or <strong>EVO ICL</strong> because it focuses on replacing the lens rather than reshaping the cornea. LASIK and SMILE are ideal for younger patients with healthy, flexible lenses. However, for those over 45 experiencing presbyopia or early cataract changes, PIE offers a permanent, lens-based solution.</p>

<p>Compared to cataract surgery, PIE uses advanced intraocular lenses specifically designed to restore multi-distance vision and prevent future clouding. It combines the benefits of cataract removal and refractive correction in one elegant step.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+20+presbyopic+implant+in+eye+procedure+pie+surgery+before+after+results1.webp" alt="PIE Surgery Before and After Results" class="blog-image">
</div>

<h2>The Advanced Lens Technology</h2>

<p>Dr. Khanna offers several types of premium presbyopic lenses, including:</p>

<ul>
    <li><strong>Multifocal Lenses</strong> for near and far vision</li>
    <li><strong>Extended Depth of Focus (EDOF) Lenses</strong> for smoother transitions between distances</li>
    <li><strong>Small Aperture Lenses (IC-8)</strong> for enhanced focus and reduced glare</li>
</ul>

<p>Each lens is selected based on your individual eye anatomy, lifestyle, and vision needs. Dr. Khanna's expertise ensures that every patient receives the most advanced and customized solution available.</p>

<h2>Why Choose Khanna Vision Institute</h2>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist and one of California's most trusted experts in lens-based vision correction. He has performed thousands of successful procedures using the latest technology and is recognized for his precision, patient education, and personalized care.</p>

<p>At <strong>Khanna Vision Institute</strong>, patients benefit from:</p>

<ul>
    <li>Advanced diagnostic imaging and laser systems</li>
    <li>Safe, minimally invasive surgical techniques</li>
    <li>Personalized lens selection for optimal results</li>
    <li>A comfortable outpatient environment and quick recovery process</li>
</ul>

<p>From consultation to post-surgery follow-up, every step is designed to ensure safety, comfort, and life-changing results.</p>

<h2>Recovery and Results</h2>

<p>Recovery after PIE is typically smooth and rapid. Most patients can resume normal activities within 24 to 48 hours. Mild dryness or light sensitivity may occur briefly, but these effects resolve as the eyes heal. Vision continues to sharpen over the following days, providing consistent clarity at all distances.</p>

<p>Dr. Khanna and his team provide detailed aftercare instructions and schedule follow-up appointments to monitor progress. Because the new lens does not age or cloud, the results are stable and long-lasting.</p>

<p>The <strong>Presbyopic Implant in Eye (PIE)</strong> procedure is one of the most effective ways to restore youthful vision and eliminate dependence on glasses. In just seven minutes, you can regain clear, natural eyesight and enjoy the confidence that comes with seeing the world sharply again.</p>

<p>If you're ready to reverse the effects of aging eyes, schedule a consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong>. Discover how PIE can help you get young again — not just in how you see, but in how you live.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "In 7 Minutes Get Young Again: New Eyes with PIE",
      slug: "2020/11/in-7-minutes-get-young-again-new-eyes-with-pie",
      content: blogContent,
      metaDescription: "Restore youthful vision in minutes with PIE (Presbyopic Implant in Eye). Learn how Dr. Rajesh Khanna at Khanna Vision Institute helps patients see clearly at all distances.",
      excerpt: "Discover how PIE (Presbyopic Implant in Eye) can restore youthful vision in just 7 minutes. Learn about this breakthrough procedure that helps you see clearly at all distances without glasses.",
      keywords: "Presbyopic Implant in Eye, PIE surgery, presbyopia treatment, lens replacement, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+20+presbyopic+implant+in+eye+procedure+pie+surgery+before+after+results.webp",
      publishedAt: new Date('2020-11-15'),
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

