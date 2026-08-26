const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Magnificent Six: Leading Advantages of LASIK Eye Surgery</h1>

<p>For millions of people worldwide, wearing glasses or contact lenses every day can be frustrating. Whether it is fogged-up lenses, misplaced glasses, or dry contact lenses, the idea of seeing clearly without them sounds liberating. That is exactly what <strong>LASIK eye surgery</strong> offers — quick, safe, and long-lasting vision correction.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Rajesh Khanna has helped thousands of patients achieve clear vision through LASIK. If you are wondering what makes this procedure so popular, here are the six leading advantages that make LASIK one of the most trusted eye surgeries today.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+5+lasik+surgery+advantages+chart+happy+patient+after+lasik+surgery.webp" alt="Happy Patient After LASIK Surgery" class="blog-image">
</div>

<h2>1. Fast and Painless Procedure</h2>

<p>One of the biggest reasons people choose LASIK is its simplicity. The entire process usually takes about 15 minutes for both eyes. Numbing eye drops are used, so there is no pain during the surgery.</p>

<p>Using a precision laser, Dr. Khanna reshapes the cornea so light can focus correctly on the retina. The reshaping corrects common refractive errors such as <strong>nearsightedness, farsightedness, and astigmatism</strong>.</p>

<p>Most patients notice clearer vision within a few hours and can return to normal routines the very next day.</p>

<h2>2. Long-Lasting Results</h2>

<p>LASIK permanently changes the shape of your cornea, meaning the improvement is durable. Once your vision stabilizes after the procedure, it typically stays consistent for years.</p>

<p>While natural aging changes like presbyopia (difficulty focusing up close) can still occur later in life, LASIK reduces or removes the need for glasses for most daily tasks.</p>

<p>At <strong>Khanna Vision Institute</strong>, advanced laser mapping ensures each patient receives a fully customized treatment, improving long-term stability and results.</p>

<h2>3. Quick Recovery and Minimal Downtime</h2>

<p>Unlike other surgeries, LASIK offers a remarkably short recovery time. Most people can drive, work, and even exercise within a day or two.</p>

<p>Mild dryness or light sensitivity may occur for a short period, but these symptoms resolve naturally as the eyes heal. Dr. Khanna and his team provide detailed aftercare guidance and follow-up visits to ensure smooth recovery.</p>

<p>Because LASIK is minimally invasive, there are no stitches or bandages, and your vision typically continues to improve over the first few days.</p>

<h2>4. Freedom from Glasses and Contact Lenses</h2>

<p>This is the benefit that excites most patients. After LASIK, you can wake up and see clearly without reaching for your glasses or inserting contact lenses.</p>

<p>This convenience makes daily activities easier — from driving to swimming or playing sports. For many, the procedure is also a long-term financial relief since they no longer need to spend money on lenses, frames, or cleaning solutions.</p>

<p>Patients often describe LASIK as "life-changing," because it allows them to enjoy life spontaneously and without limitations.</p>

<h2>5. High Precision and Safety</h2>

<p>Modern LASIK is performed using advanced, computer-guided lasers that deliver micrometer-level accuracy. At <strong>Khanna Vision Institute</strong>, Dr. Khanna uses blade-free, all-laser LASIK technology to ensure every treatment is safe, accurate, and personalized.</p>

<p>The safety record of LASIK is exceptional. Complications are rare, and serious issues are extremely uncommon when performed by an experienced surgeon. Over 95% of patients achieve 20/20 vision or better after surgery.</p>

<p>Dr. Khanna's expertise and commitment to precision make LASIK a reliable and comfortable option for qualified candidates.</p>

<h2>6. Proven Technology and Global Trust</h2>

<p>LASIK has been performed for more than 25 years and continues to be one of the most researched and successful eye procedures in the world. Millions of patients have benefited from it, with consistently high satisfaction rates.</p>

<p>The technology has evolved over the years, from mechanical instruments to wavefront-guided and femtosecond laser platforms, making it even safer and more predictable.</p>

<p>At <strong>Khanna Vision Institute</strong>, every LASIK procedure combines the latest technology with personalized diagnostics, ensuring that each patient receives care tailored to their unique eye structure.</p>

<h2>Who Can Benefit the Most from LASIK?</h2>

<p>You might be a good candidate for LASIK if you:</p>

<ul>
    <li>Are over 18 years old</li>
    <li>Have a stable eye prescription for at least a year</li>
    <li>Have healthy eyes and adequate corneal thickness</li>
    <li>Do not have active eye diseases such as glaucoma or cataract</li>
</ul>

<p>During your consultation, Dr. Khanna performs detailed corneal scans and eye measurements to confirm whether LASIK or another procedure like <strong>SMILE</strong> or <strong>EVO ICL</strong> is best for you.</p>

<h2>Why Choose Khanna Vision Institute for LASIK</h2>

<p>Choosing the right surgeon and clinic is just as important as choosing the procedure itself.</p>

<p><strong>Dr. Rajesh Khanna</strong>, a board-certified ophthalmologist, is one of California's leading experts in refractive and cataract surgery. With decades of experience and a focus on safety, he offers personalized, transparent guidance to every patient.</p>

<p>The institute uses advanced diagnostic equipment, wavefront technology, and blade-free lasers for the most precise and comfortable outcomes possible.</p>

<p>Every LASIK procedure at Khanna Vision Institute is more than just a surgery — it is a customized experience designed for your long-term vision health.</p>

<p>LASIK remains one of the most effective, fast, and life-changing procedures in modern ophthalmology. Its benefits go far beyond clear vision — it brings freedom, confidence, and comfort in daily life.</p>

<p>If you are tired of depending on glasses or contacts, LASIK might be the solution you have been looking for. Schedule a consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong> to see if you are a good candidate and start your journey toward clear, natural vision.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Magnificent Six: Leading Advantages of LASIK Eye Surgery",
      slug: "2021/07/magnificent-six-leading-advantages-of-lasik-eye-surgery",
      content: blogContent,
      metaDescription: "Discover the six leading advantages of LASIK eye surgery, from quick recovery to lasting results. Learn why patients trust Dr. Rajesh Khanna and Khanna Vision Institute for laser vision correction.",
      excerpt: "Explore the six leading advantages of LASIK eye surgery, from fast recovery to long-lasting results. Learn why millions trust this procedure for clear, natural vision.",
      keywords: "LASIK eye surgery, benefits of LASIK, laser vision correction, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+5+lasik+surgery+advantages+chart+happy+patient+after+lasik+surgery.webp",
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

