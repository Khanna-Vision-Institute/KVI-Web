const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>SMILE Laser Eye Surgery — A Modern Way to Clear Vision</h1>

<p>If you've ever thought about laser vision correction but wanted something gentle and fast, you'll be glad to know about <strong>SMILE</strong> — one of the latest and most advanced procedures for clear vision.</p>

<p>SMILE stands for <strong>Small Incision Lenticule Extraction</strong>. It's a modern alternative to LASIK that corrects <strong>nearsightedness</strong> and <strong>astigmatism</strong> through a tiny laser incision — with no flap and minimal discomfort.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Rajesh Khanna offers this innovative treatment for patients who want laser vision correction with faster healing and greater comfort. Let's understand how SMILE works, its benefits, and whether it could be right for you.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+3+smile+laser+eye+surgery+procedure+advanced+smile+laser+eye+technology.webp" alt="SMILE Laser Eye Surgery Procedure" class="blog-image">
</div>

<h2>1. What Exactly Is SMILE Eye Surgery?</h2>

<p><strong>SMILE</strong> is a minimally invasive laser procedure that reshapes your cornea to correct vision — just like LASIK, but in a different way.</p>

<p>Instead of creating a flap on the surface of the cornea, the laser makes a <strong>tiny, lens-shaped piece of tissue (called a lenticule)</strong> inside the cornea. Then, this lenticule is gently removed through a small incision (only about 2–3 mm).</p>

<p>This process changes the curvature of your cornea, allowing light to focus properly on your retina — giving you clearer vision without glasses or contact lenses.</p>

<h2>2. How SMILE Differs from LASIK</h2>

<p>While both <strong>SMILE</strong> and <strong>LASIK</strong> aim to improve your vision, there are key differences:</p>

<table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
    <thead>
        <tr style="background: #f8f9fa;">
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>Feature</strong></th>
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>LASIK</strong></th>
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>SMILE</strong></th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Incision Size</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">~20 mm (creates a flap)</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">~2–3 mm (tiny opening)</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Flap Creation</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Yes</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">No flap needed</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Healing Time</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Fast</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Faster (less dry eye)</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Discomfort</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Minimal</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Even less</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Ideal for</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Mild to moderate myopia</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Moderate to high myopia and astigmatism</td>
        </tr>
    </tbody>
</table>

<p>In short, <strong>SMILE offers all the clarity of LASIK, but with even less surface disturbance</strong> — which means your cornea stays stronger and your eyes feel more comfortable afterward.</p>

<h2>3. Step-by-Step: What Happens During SMILE Surgery</h2>

<p>At <strong>Khanna Vision Institute</strong>, the SMILE process is quick, comfortable, and precise:</p>

<h3>Numbing the Eye</h3>
<p>A few anesthetic eye drops are used. No injections, no pain.</p>

<h3>Laser Creation</h3>
<p>Using a femtosecond laser, Dr. Khanna creates the lenticule and the small incision inside your cornea — in less than 30 seconds.</p>

<h3>Lenticule Removal</h3>
<p>The lenticule is gently removed through the tiny opening, reshaping your cornea instantly.</p>

<h3>Healing Begins</h3>
<p>No stitches, no bandage — your eye begins healing naturally right away.</p>

<p>The entire procedure takes <strong>under 15 minutes per eye</strong>, and most patients notice clearer vision within 24 hours.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+3+smile+laser+eye+surgery+procedure+advanced+smile+laser+eye+technology1.webp" alt="Advanced SMILE Laser Eye Technology" class="blog-image">
</div>

<h2>4. Benefits of SMILE Laser Eye Surgery</h2>

<p>SMILE has become one of the most popular laser vision correction options worldwide — and for good reasons.</p>

<h3>Flap-Free Safety</h3>
<p>Because SMILE doesn't create a corneal flap, the surface nerves remain largely intact. This reduces dry eye symptoms and preserves the natural strength of the cornea.</p>

<h3>Quick Recovery</h3>
<p>Most people return to normal activities within a day or two. Vision improves almost immediately and stabilizes within a week.</p>

<h3>Comfort and Stability</h3>
<p>The small incision means less tissue disturbance, fewer chances of complications, and greater long-term stability.</p>

<h3>Great for Active Lifestyles</h3>
<p>For athletes, pilots, or those in physically demanding jobs, SMILE is ideal since there's no flap to dislodge — making it safer during sports or outdoor activities.</p>

<h3>Silent Precision</h3>
<p>The VisuMax laser used in SMILE is quiet and gentle, providing an extremely smooth experience.</p>

<h2>5. Who Is a Good Candidate for SMILE?</h2>

<p>SMILE is a great option if you:</p>

<ul>
    <li>Are <strong>18 years or older</strong></li>
    <li>Have <strong>stable vision for at least one year</strong></li>
    <li>Are <strong>nearsighted</strong> (up to -10.00 D) or have <strong>astigmatism</strong> (up to -3.00 D)</li>
    <li>Have <strong>healthy corneas</strong></li>
    <li>Want a <strong>minimally invasive</strong> alternative to LASIK</li>
</ul>

<p>However, SMILE is not yet FDA-approved for farsightedness, and people with certain corneal conditions (like keratoconus) may need other procedures.</p>

<p>Dr. Khanna performs advanced diagnostic tests before recommending the best vision correction plan for your eyes.</p>

<h2>6. What to Expect After SMILE Surgery</h2>

<p>After the procedure, you might notice slight blurriness or light sensitivity for a few hours, but this fades quickly.</p>

<p>Most patients:</p>

<ul>
    <li>Return to work in 1–2 days</li>
    <li>Notice clearer vision within 24–48 hours</li>
    <li>Experience minimal dryness or irritation</li>
</ul>

<p>Dr. Khanna's team provides detailed aftercare instructions and follow-up visits to monitor healing and ensure long-lasting results.</p>

<h2>7. SMILE vs Other Vision Correction Options</h2>

<p>While SMILE is excellent for many patients, some may still be better suited for other treatments such as:</p>

<ul>
    <li><strong>LASIK</strong> — for broader correction range or combined vision needs</li>
    <li><strong>EVO ICL (Implantable Collamer Lens)</strong> — for very high myopia or thin corneas</li>
    <li><strong>PRK</strong> — for specific corneal surface needs</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, you'll receive honest, personalized guidance — not a one-size-fits-all solution.</p>

<h2>8. Why Choose Khanna Vision Institute for SMILE Surgery</h2>

<p>Choosing an experienced surgeon matters as much as choosing the right technology.</p>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist with decades of experience in refractive and cataract surgery. He was among the early adopters of modern vision correction techniques in California, and his institute is equipped with the <strong>latest ZEISS VisuMax laser system</strong> for SMILE.</p>

<p>At Khanna Vision Institute, the focus is always on:</p>

<ul>
    <li><strong>Safety first</strong></li>
    <li><strong>Advanced technology</strong></li>
    <li><strong>Personalized care and transparency</strong></li>
</ul>

<p>Every patient receives a detailed consultation and long-term care plan to ensure the best possible results.</p>

<p><strong>SMILE laser eye surgery</strong> is a breakthrough in vision correction — gentle, precise, and fast.<br />It offers clear vision with minimal downtime, ideal for people who want to enjoy life without glasses or contacts.</p>

<p>If you're curious about SMILE and want to know if it's right for your eyes, schedule a consultation at <strong>Khanna Vision Institute</strong>. Dr. Rajesh Khanna and his team will guide you through every step toward your clearest, most comfortable vision.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "SMILE Laser Eye Surgery — A Modern Way to Clear Vision",
      slug: "2022/07/smile-laser-eye-surgery",
      content: blogContent,
      metaDescription: "Discover SMILE Laser Eye Surgery — the flap-free, gentle way to correct nearsightedness and astigmatism. Learn how Dr. Rajesh Khanna at Khanna Vision Institute helps patients see clearly with advanced laser technology.",
      excerpt: "Learn about SMILE laser eye surgery, a modern, minimally invasive alternative to LASIK. Discover how this flap-free procedure offers faster healing and greater comfort for vision correction.",
      keywords: "SMILE laser eye surgery, small incision lenticule extraction, LASIK alternative, vision correction, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+3+smile+laser+eye+surgery+procedure+advanced+smile+laser+eye+technology.webp",
      publishedAt: new Date('2022-07-15'),
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

