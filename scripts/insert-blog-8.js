const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>The Latest FDA-Approved Vision Correction: SMILE</h1>

<p>For decades, people who wanted to see clearly without glasses or contact lenses turned to LASIK. But as technology advanced, a new option emerged — one that is even gentler, faster, and less invasive. It's called <strong>SMILE</strong>, short for <strong>Small Incision Lenticule Extraction</strong>, and it represents one of the most important FDA-approved advancements in laser vision correction.</p>

<p>At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> offers SMILE as a safe and precise solution for patients who want permanent vision correction with minimal downtime. In this article, we'll explore what SMILE is, how it works, and why it's quickly becoming the procedure of choice for many people.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+8+fda+approved+smile+eye+surgery+doctor+discussing+smile+technology.webp" alt="FDA Approved SMILE Eye Surgery" class="blog-image">
</div>

<h2>1. What Is SMILE Vision Correction</h2>

<p>SMILE is a laser eye surgery that corrects <strong>nearsightedness (myopia)</strong> and <strong>astigmatism</strong> through a very small incision — typically about 2 to 3 millimeters wide. Unlike LASIK, which requires creating a flap in the cornea, SMILE reshapes the cornea internally through this small opening.</p>

<p>The procedure uses an advanced <strong>femtosecond laser</strong> to create a thin, disc-shaped piece of tissue (called a lenticule) inside the cornea. The surgeon then removes this lenticule through the tiny incision, allowing the cornea to adopt a new shape that focuses light correctly on the retina.</p>

<p>The result is clear, natural vision without the need for glasses or contact lenses.</p>

<h2>2. FDA Approval and Clinical Confidence</h2>

<p>The <strong>U.S. Food and Drug Administration (FDA)</strong> approved SMILE for correcting nearsightedness in 2016 and for astigmatism in 2018 after years of clinical trials and research. These approvals confirmed its safety, accuracy, and effectiveness as a mainstream vision correction option.</p>

<p>Today, millions of procedures have been performed globally, and the results consistently show excellent visual outcomes and patient satisfaction.</p>

<p>At <strong>Khanna Vision Institute</strong>, SMILE is performed using the <strong>ZEISS VisuMax laser system</strong>, which is known for its precision, speed, and gentleness.</p>

<h2>3. How SMILE Differs from LASIK</h2>

<p>Both LASIK and SMILE are advanced laser vision correction procedures, but they differ in how they reshape the cornea.</p>

<table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
    <thead>
        <tr style="background: #f8f9fa;">
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>Feature</strong></th>
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>SMILE</strong></th>
            <th style="padding: 15px; text-align: left; border: 1px solid #e0e0e0;"><strong>LASIK</strong></th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Type of Laser</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Femtosecond laser only</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Femtosecond and excimer lasers</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Incision Size</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">About 2–3 mm</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">About 20 mm</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Corneal Flap</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">None</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Yes</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Dry Eye Risk</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Lower</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Slightly higher</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Healing Time</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">1–2 days</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">2–3 days</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Ideal for</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Active lifestyle, moderate to high myopia</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Broad range of refractive errors</td>
        </tr>
    </tbody>
</table>

<p>In short, SMILE offers all the benefits of LASIK but with a smaller incision, less dryness, and greater corneal stability.</p>

<h2>4. Step-by-Step: How SMILE Works</h2>

<p>At <strong>Khanna Vision Institute</strong>, the SMILE procedure is simple and comfortable:</p>

<ol>
    <li><strong>Preparation:</strong> Eye drops are used to numb the eye.</li>
    <li><strong>Laser Creation:</strong> The femtosecond laser creates the lenticule inside the cornea and a tiny incision on its surface.</li>
    <li><strong>Lenticule Removal:</strong> Dr. Khanna gently removes the lenticule through the small opening, reshaping the cornea.</li>
    <li><strong>Healing:</strong> Because there's no flap, the cornea heals naturally and quickly without stitches.</li>
</ol>

<p>The entire process takes less than 15 minutes for both eyes. Most patients notice clearer vision within a day.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+8+fda+approved+smile+eye+surgery+doctor+discussing+smile+technology1.webp" alt="Doctor Discussing SMILE Technology" class="blog-image">
</div>

<h2>5. Who Is a Good Candidate for SMILE</h2>

<p>You may be a good candidate for SMILE if you:</p>

<ul>
    <li>Are 18 years or older</li>
    <li>Have a stable prescription for at least one year</li>
    <li>Have mild to moderate nearsightedness (up to -10.00 diopters)</li>
    <li>Have astigmatism (up to -3.00 diopters)</li>
    <li>Want a flap-free procedure with fast recovery</li>
</ul>

<p>People with thin corneas or dry eyes who are not suitable for LASIK may also benefit from SMILE.</p>

<p>Dr. Khanna performs detailed diagnostic tests to confirm eligibility and ensure the best results for every patient.</p>

<h2>6. Benefits of SMILE Vision Correction</h2>

<p>SMILE provides several advantages that make it one of the most advanced and comfortable forms of laser eye surgery available today.</p>

<h3>Flap-Free and Minimally Invasive</h3>
<p>No corneal flap means less risk of complications and a faster, more stable recovery.</p>

<h3>Reduced Dryness and Discomfort</h3>
<p>Since fewer nerves are affected, dry eye symptoms after SMILE are minimal.</p>

<h3>Quick Recovery and Immediate Results</h3>
<p>Most patients can return to normal activities within a day or two, with vision improving rapidly.</p>

<h3>Long-Term Stability</h3>
<p>The cornea retains more of its natural strength and shape, reducing the risk of future vision changes.</p>

<h3>Great for Active Lifestyles</h3>
<p>SMILE is ideal for athletes, military personnel, and people who participate in high-movement activities.</p>

<h2>7. Safety and Success Rates</h2>

<p>SMILE has one of the highest safety profiles among all vision correction surgeries. Clinical studies show:</p>

<ul>
    <li>Over 98 percent of patients achieve 20/25 vision or better</li>
    <li>Minimal risk of complications</li>
    <li>Excellent long-term vision stability</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, each SMILE procedure is customized using corneal topography and wavefront analysis, ensuring precise and predictable results.</p>

<h2>8. Why Choose Khanna Vision Institute for SMILE</h2>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist with extensive experience in refractive surgery. His expertise, combined with the institute's state-of-the-art technology, provides patients with safe, personalized care.</p>

<p>Khanna Vision Institute stands out for:</p>

<ul>
    <li>Advanced ZEISS VisuMax laser system</li>
    <li>Personalized evaluations and honest recommendations</li>
    <li>Focus on long-term eye health and comfort</li>
    <li>Transparent communication and patient education</li>
</ul>

<p>Every procedure is guided by Dr. Khanna's commitment to precision, safety, and natural vision outcomes.</p>

<p>The <strong>SMILE laser vision correction</strong> procedure is one of the most advanced and patient-friendly options available today. With FDA approval, proven safety, and outstanding visual outcomes, it represents the next step in refractive surgery technology.</p>

<p>If you want clearer, more natural vision without glasses or contact lenses, schedule a consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong>. Together, you can explore whether SMILE is the right choice for your eyes and lifestyle.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "The Latest FDA-Approved Vision Correction: SMILE",
      slug: "2024/04/the-latest-fda-approved-vision-correction-smile",
      content: blogContent,
      metaDescription: "Learn about SMILE, the latest FDA-approved vision correction procedure. Discover how Dr. Rajesh Khanna at Khanna Vision Institute helps patients achieve clear, comfortable vision with advanced laser technology.",
      excerpt: "Discover SMILE, the latest FDA-approved vision correction procedure. Learn how this advanced laser eye surgery offers clear, comfortable vision with minimal downtime and excellent results.",
      keywords: "SMILE vision correction, FDA approved eye surgery, SMILE laser eye surgery, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+8+fda+approved+smile+eye+surgery+doctor+discussing+smile+technology.webp",
      publishedAt: new Date('2024-04-15'),
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

