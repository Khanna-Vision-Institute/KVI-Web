const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Is LASIK the Right Solution for Nearsightedness? Let's Find Out</h1>

<p>If you have trouble seeing distant objects clearly — road signs, faces across the street, or a classroom board — you're likely <strong>nearsighted (myopic)</strong>. Nearsightedness is one of the most common vision problems, affecting millions of people around the world.</p>

<p>Many patients ask, "Can LASIK really fix my nearsightedness permanently?"<br />The short answer is <strong>yes — for most people, LASIK is an excellent solution</strong>. But as with any medical procedure, it's important to understand how it works, who qualifies, and what results you can realistically expect.</p>

<p>Let's go step by step.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+2+lasik+for+nearsightedness+patient+smilingeye+surgeon+performing+lasik+procedure.webp" alt="LASIK Procedure for Nearsightedness" class="blog-image">
</div>

<h2>1. Understanding Nearsightedness (Myopia)</h2>

<p>Nearsightedness happens when the eyeball is slightly longer than normal, or when the cornea (the clear front surface of your eye) is too curved. Because of this, light rays focus <strong>in front of</strong> the retina instead of <strong>on</strong> it.</p>

<p>The result?</p>

<p>You can see nearby objects clearly, but distant objects look blurry or fuzzy.</p>

<p>Myopia usually starts during childhood and may worsen through teenage years, then stabilize in adulthood. Glasses or contact lenses can correct the blur, but they don't fix the underlying cause. That's where <strong>LASIK</strong> comes in.</p>

<h2>2. What Exactly Does LASIK Do?</h2>

<p><strong>LASIK (Laser-Assisted In Situ Keratomileusis)</strong> reshapes the cornea using a precision laser. The reshaping helps light focus properly on the retina, restoring clear vision.</p>

<p>Here's how it works at <strong>Khanna Vision Institute</strong>:</p>

<h3>Personalized Mapping</h3>
<p>Advanced scanners create a detailed 3D map of your eye.</p>

<h3>Creating a Flap</h3>
<p>A laser gently creates a thin flap on the cornea's surface.</p>

<h3>Laser Reshaping</h3>
<p>Another laser reshapes the cornea in seconds — no pain, no stitches.</p>

<h3>Flap Repositioning</h3>
<p>The flap is set back in place naturally, allowing quick healing.</p>

<p>The entire procedure takes about 10–15 minutes per eye, and most patients notice clearer vision within a day.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+2+lasik+for+nearsightedness+patient+smilingeye+surgeon+performing+lasik+procedure+1.webp" alt="LASIK Surgery at Khanna Vision Institute" class="blog-image">
</div>

<h2>3. Who Is a Good Candidate for LASIK?</h2>

<p>Not everyone with nearsightedness automatically qualifies for LASIK. The best candidates usually have:</p>

<ul>
    <li>Stable vision for at least one year</li>
    <li>Healthy corneas of sufficient thickness</li>
    <li>No severe dry eye or other active eye diseases</li>
    <li>Realistic expectations about outcomes</li>
</ul>

<p>People with very high myopia or thin corneas might be better suited for alternative procedures like <strong>SMILE</strong> or <strong>EVO ICL</strong>.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Rajesh Khanna performs detailed diagnostic tests before recommending the right treatment for your eyes. This ensures both <strong>safety</strong> and <strong>long-term clarity</strong>.</p>

<h2>4. How Effective Is LASIK for Nearsightedness?</h2>

<p>For mild to moderate myopia, LASIK delivers exceptional results.<br />Most patients achieve <strong>20/20 vision or better</strong> and no longer need glasses or contacts for distance tasks.</p>

<p>Studies show LASIK success rates consistently above <strong>96–98%</strong>, especially when performed with modern laser technology.</p>

<p>The improvement is permanent, although small vision changes can still happen naturally over time as part of aging. Regular eye check-ups keep your vision in top condition.</p>

<h2>5. Benefits Beyond Clear Vision</h2>

<p>LASIK offers more than convenience — it can improve your lifestyle in multiple ways:</p>

<ul>
    <li>Freedom from glasses during sports or travel</li>
    <li>Sharper night vision with modern laser platforms</li>
    <li>Quick recovery — many people return to work within 24 hours</li>
    <li>Long-term savings on eyewear and contact lenses</li>
</ul>

<p>Patients at <strong>Khanna Vision Institute</strong> often say LASIK gave them "a new sense of independence" and confidence in daily life.</p>

<h2>6. Is LASIK Safe?</h2>

<p>When performed by an experienced surgeon using FDA-approved technology, LASIK is extremely safe.<br />At <strong>Khanna Vision Institute</strong>, every procedure is guided by precision laser systems and handled personally by <strong>Dr. Khanna</strong>, who has performed thousands of successful vision correction surgeries.</p>

<p>The center follows strict safety protocols, including:</p>

<ul>
    <li>Blade-free (all-laser) techniques</li>
    <li>Customized wavefront analysis for accuracy</li>
    <li>Advanced post-surgery care and follow-up</li>
</ul>

<p>Complications are rare and usually minor, such as temporary dryness or light sensitivity, both of which resolve naturally.</p>

<h2>7. What If LASIK Isn't Right for You?</h2>

<p>If your corneas are too thin, or if you have a high prescription, there are still excellent options:</p>

<ul>
    <li><strong>SMILE (Small Incision Lenticule Extraction):</strong> Minimally invasive, faster healing.</li>
    <li><strong>EVO ICL (Implantable Collamer Lens):</strong> Works like a permanent contact lens inside the eye.</li>
    <li><strong>PRK:</strong> Surface laser procedure ideal for certain corneal types.</li>
</ul>

<p>At Khanna Vision Institute, patients receive <strong>personalized recommendations</strong> — not one-size-fits-all advice.</p>

<h2>8. What to Expect After LASIK</h2>

<p>Most patients notice clearer vision immediately after surgery, with full results in a few days.<br />Mild dryness or sensitivity is normal at first, but eye drops help with comfort.</p>

<p>You can usually resume light activities the next day and drive once your vision stabilizes. Dr. Khanna's team provides clear after-care instructions and regular follow-ups to ensure smooth healing.</p>

<p>LASIK is one of the most trusted solutions for nearsightedness. It's quick, safe, and life-changing for people tired of glasses and contacts.</p>

<p>If you're considering LASIK, the best first step is a consultation at <strong>Khanna Vision Institute</strong>. Dr. Rajesh Khanna will carefully assess your eyes, explain your options, and design a plan that matches your needs and lifestyle.</p>

<p>Clear vision is more than just seeing better — it's living better.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Is LASIK the Right Solution for Nearsightedness? Let's Find Out",
      slug: "2024/02/is-lasik-the-right-solution-for-nearsightedness",
      content: blogContent,
      metaDescription: "Wondering if LASIK can fix your nearsightedness? Learn how LASIK works, who qualifies, and what results to expect from Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Discover if LASIK is the right solution for your nearsightedness. Learn about the procedure, candidacy requirements, effectiveness, and safety from Khanna Vision Institute.",
      keywords: "LASIK for nearsightedness, LASIK surgery, myopia treatment, laser eye surgery, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+2+lasik+for+nearsightedness+patient+smilingeye+surgeon+performing+lasik+procedure.webp",
      publishedAt: new Date('2024-02-15'),
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

