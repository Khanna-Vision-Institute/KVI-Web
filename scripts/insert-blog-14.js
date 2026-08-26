const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Independence Day LASIK Special</h1>

<p>Every year, the Fourth of July reminds us of one of life's greatest privileges — the freedom to live life on our own terms. At <strong>Khanna Vision Institute</strong>, we believe your vision deserves the same kind of freedom. This Independence Day, celebrate your personal independence by saying goodbye to glasses and contact lenses through <strong>LASIK eye surgery</strong>. Clear vision opens new possibilities, and this special season is the perfect time to start your journey toward visual freedom.</p>

<p>Many people rely on glasses or contact lenses for years without realizing how much they limit daily activities. Foggy lenses, misplaced glasses, or dry eyes from contacts can make even simple things frustrating. LASIK offers a fast, safe, and lasting solution to these everyday struggles. Performed by <strong>Dr. Rajesh Khanna</strong>, a board-certified ophthalmologist with decades of experience, LASIK at Khanna Vision Institute is designed to give you clear, natural vision and lasting confidence.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+14+lasik+promo+independence+day+usa+themed+lasik+offer.webp" alt="Independence Day LASIK Special" class="blog-image">
</div>

<h2>Why Choose LASIK This Independence Day</h2>

<p>The spirit of Independence Day is about breaking free — and that includes freeing yourself from the restrictions of corrective lenses. LASIK reshapes your cornea using an advanced laser so light focuses correctly on your retina. The result is sharp, clear vision that lets you enjoy your favorite activities without worrying about glasses or contacts. Whether it's watching fireworks, swimming, driving, or simply reading, you'll notice the difference right away.</p>

<p>Choosing LASIK now means you could spend the rest of your summer enjoying life with clear vision. The procedure takes about 15 minutes for both eyes, is virtually painless, and most patients notice improved sight within 24 hours. Recovery is fast, and you can usually return to normal activities in one or two days.</p>

<h2>Benefits of LASIK</h2>

<p>LASIK offers both convenience and long-term visual stability. Some of its biggest advantages include:</p>

<ul>
    <li>Permanent reduction or elimination of glasses and contacts</li>
    <li>Fast and comfortable recovery</li>
    <li>Proven safety with modern laser systems</li>
    <li>Enhanced performance for sports, travel, and daily life</li>
    <li>Long-term savings from not needing eyewear or contact lenses</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, every LASIK treatment is customized using detailed corneal imaging and wavefront technology to ensure precise, predictable results.</p>

<h2>Advanced Technology and Safety</h2>

<p>Dr. Khanna performs <strong>blade-free, all-laser LASIK</strong>, which means every step of the procedure is done with computer-guided precision. The technology used at Khanna Vision Institute allows for faster healing and greater comfort than older LASIK techniques. The center also follows strict safety protocols, ensuring every patient receives a treatment plan designed around their unique eye structure and lifestyle.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+14+lasik+promo+independence+day+usa+themed+lasik+offer1.webp" alt="USA Themed LASIK Offer" class="blog-image">
</div>

<h2>Personalized Evaluation</h2>

<p>Not everyone's eyes are the same, and not everyone needs the same type of correction. During your LASIK consultation, Dr. Khanna and his team perform a detailed eye examination that includes corneal mapping, pupil measurement, and tear film analysis. These tests determine whether LASIK is the best procedure for you or if another option, such as <strong>SMILE</strong> or <strong>EVO ICL</strong>, would be better suited to your eyes.</p>

<h2>The Freedom You Deserve</h2>

<p>Imagine watching fireworks this Independence Day without squinting through glasses or worrying about contact lenses drying out. Imagine traveling, swimming, and exercising with complete freedom. LASIK gives you that independence — freedom from visual limitations and the comfort of seeing clearly, all the time.</p>

<p>Dr. Khanna has helped thousands of patients across California achieve visual freedom. His expertise, combined with state-of-the-art technology, ensures every LASIK experience at Khanna Vision Institute is safe, comfortable, and life-changing.</p>

<h2>Limited-Time Independence Day Offer</h2>

<p>To celebrate Independence Day, Khanna Vision Institute is offering a <strong>special LASIK consultation promotion</strong> for new patients throughout July. This is the perfect opportunity to find out if LASIK is right for you and to take advantage of seasonal savings on your vision correction procedure.</p>

<p>The consultation includes advanced eye testing, personalized treatment recommendations, and a detailed discussion of your options directly with Dr. Khanna.</p>

<p>Independence Day is about freedom, and LASIK gives you the freedom to live without limits. Free yourself from glasses, contacts, and the inconveniences that come with them. Enjoy a life of clarity, confidence, and independence with laser vision correction by <strong>Dr. Rajesh Khanna</strong>.</p>

<p>This July, take the first step toward a lifetime of clear vision. Schedule your Independence Day LASIK consultation at <strong>Khanna Vision Institute</strong> today and discover how quickly you can achieve visual freedom.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Independence Day LASIK Special",
      slug: "2021/06/independence-day-lasik-special",
      content: blogContent,
      metaDescription: "Celebrate Independence Day with clear vision. Discover Khanna Vision Institute's LASIK special and experience visual freedom with Dr. Rajesh Khanna.",
      excerpt: "Celebrate your independence with LASIK eye surgery. Discover special Independence Day offers and experience the freedom of clear vision with Dr. Rajesh Khanna.",
      keywords: "Independence Day LASIK special, LASIK offers California, laser vision correction, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+14+lasik+promo+independence+day+usa+themed+lasik+offer.webp",
      publishedAt: new Date('2021-06-15'),
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

