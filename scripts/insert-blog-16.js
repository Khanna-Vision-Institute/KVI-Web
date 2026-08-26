const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>How Upper Eyelid Surgery Can Improve Your Vision</h1>

<p>For many people, drooping upper eyelids are often seen as a cosmetic concern — a sign of aging or fatigue. But in many cases, sagging eyelid skin is more than just an appearance issue. When the eyelids hang too low, they can block part of your field of vision and make daily activities like reading, driving, or watching television more difficult. This is where <strong>upper eyelid surgery</strong>, also known as <strong>upper blepharoplasty</strong>, can make a real difference not only in appearance but also in visual function. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> performs upper eyelid surgery with precision and care, helping patients achieve clearer vision and a more refreshed, natural look.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+16+upper+eyelid+surgery+vision+improvement+eyelid+lift+patient+smiling.webp" alt="Upper Eyelid Surgery Vision Improvement" class="blog-image">
</div>

<h2>Understanding the Problem</h2>

<p>As we age, the skin around the eyes gradually loses its elasticity. The muscles that support the eyelids also weaken, causing excess skin and fat to accumulate above the eyes. This can lead to a heavy, droopy appearance known as dermatochalasis. In more advanced cases, the sagging skin can droop over the eyelashes, creating a "hooded" effect that partially obstructs your vision. The condition often makes it harder to see objects above or to the sides, especially when driving or reading. In some patients, the eyelids feel physically heavy, leading to eye strain or fatigue by the end of the day.</p>

<h2>What Is Upper Eyelid Surgery</h2>

<p>Upper eyelid surgery, or blepharoplasty, is a procedure that removes excess skin, muscle, and sometimes fat from the upper eyelids. It is typically done under local anesthesia with mild sedation and takes about an hour to complete. Dr. Khanna makes a small incision in the natural crease of the eyelid, allowing the scar to remain virtually invisible once healed. The goal is to restore a smoother, more open eyelid contour while maintaining a natural appearance. The procedure is outpatient, meaning patients can go home the same day, and recovery usually takes about a week.</p>

<h2>How It Improves Vision</h2>

<p>For patients whose upper eyelids block their vision, blepharoplasty can significantly improve their field of sight. By removing the extra skin and tightening the underlying muscles, the upper eyelids are lifted to their proper position, allowing more light to reach the eye and expanding the visual range. Many patients notice that they can see better when looking up or to the sides almost immediately after healing. The surgery can also relieve physical discomfort caused by drooping eyelids, such as forehead tension from constantly raising the brows to see clearly.</p>

<p>Improved vision is not just a medical benefit — it enhances confidence and quality of life. Activities that once felt tiring, like reading or driving at night, become easier and more comfortable. Patients also often report that their eyes feel less heavy and strained after surgery.</p>

<h2>Cosmetic and Functional Benefits</h2>

<p>While upper eyelid surgery offers a clear medical advantage for those with vision obstruction, it also rejuvenates the appearance. The eyes look more open, alert, and youthful, without appearing overdone or artificial. This natural refresh can make a big difference in how others perceive you, restoring both vision and self-confidence. At <strong>Khanna Vision Institute</strong>, Dr. Khanna focuses on achieving balance — enhancing the aesthetics of the eyes while preserving natural facial harmony.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+16+upper+eyelid+surgery+vision+improvement+eyelid+lift+patient+smiling1.webp" alt="Eyelid Lift Patient Smiling" class="blog-image">
</div>

<h2>Who Is a Candidate</h2>

<p>You may be a good candidate for upper eyelid surgery if you notice:</p>

<ul>
    <li>Drooping skin that interferes with your upper or side vision</li>
    <li>A tired or heavy-eyed appearance</li>
    <li>Eye strain or headaches from raising your eyebrows to see</li>
    <li>Difficulty applying makeup due to excess eyelid skin</li>
    <li>Good general health with realistic expectations</li>
</ul>

<p>Dr. Khanna performs a detailed evaluation, which includes visual field testing to document whether the drooping skin is affecting your sight. If the obstruction is significant, the procedure may even be partially covered by insurance as a functional rather than purely cosmetic surgery.</p>

<h2>Recovery and Results</h2>

<p>After upper eyelid surgery, patients typically experience mild swelling and bruising for a few days. Cold compresses, prescribed eye drops, and proper rest help with recovery. Most people can return to work and light activities within a week. Sutures are removed in five to seven days, and the incision line fades naturally into the eyelid crease over time. The results are long-lasting, often maintaining a refreshed appearance and improved vision for many years.</p>

<p>At <strong>Khanna Vision Institute</strong>, each patient receives personalized post-surgery care instructions to ensure proper healing and optimal results. Regular follow-ups are scheduled to monitor progress and maintain eye health.</p>

<h2>The Khanna Vision Institute Approach</h2>

<p><strong>Dr. Rajesh Khanna</strong> is known for combining medical precision with aesthetic sensitivity. His expertise as an ophthalmologist ensures that every upper eyelid surgery not only enhances appearance but also maximizes visual improvement. With years of experience in both functional and cosmetic eye surgery, Dr. Khanna's approach focuses on safety, symmetry, and natural results. The procedure is performed in a comfortable outpatient setting using advanced surgical techniques and modern anesthesia for maximum patient comfort.</p>

<p>Upper eyelid surgery is more than just a cosmetic enhancement. For many, it restores both vision and vitality. By removing excess skin and lifting the eyelids to their natural position, the procedure allows you to see more clearly and feel more confident in your appearance.</p>

<p>If you are experiencing droopy eyelids or vision obstruction, a consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong> can help you determine whether upper blepharoplasty is right for you. With the right care, you can achieve clearer sight, a younger appearance, and renewed comfort in your everyday life.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "How Upper Eyelid Surgery Can Improve Your Vision",
      slug: "2025/07/how-upper-eyelid-surgery-can-improve-your-vision",
      content: blogContent,
      metaDescription: "Learn how upper eyelid surgery can restore clear vision and rejuvenate your appearance. Expert blepharoplasty care by Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Discover how upper eyelid surgery (blepharoplasty) can improve both your vision and appearance. Learn about the functional and cosmetic benefits from Dr. Rajesh Khanna.",
      keywords: "upper eyelid surgery, blepharoplasty, droopy eyelid vision problems, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+16+upper+eyelid+surgery+vision+improvement+eyelid+lift+patient+smiling.webp",
      publishedAt: new Date('2025-07-20'),
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

