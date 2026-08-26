const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>See the World Differently with SMILE</h1>

<p>If you have been thinking about laser vision correction but want something simple, safe, and fast, there is now a new way to see clearly — and it is changing how people experience life after vision correction. It is called <strong>SMILE</strong>, short for <strong>Small Incision Lenticule Extraction</strong>.</p>

<p>At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> offers SMILE as one of the most advanced and gentle forms of laser eye surgery. It provides precise correction for <strong>nearsightedness</strong> and <strong>astigmatism</strong>, all through a tiny incision. This breakthrough approach is helping people across California see the world with clarity, comfort, and confidence.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+12+smile+vision+correction+before+after+smile+patient+happy+clear+vision.webp" alt="SMILE Vision Correction Before and After" class="blog-image">
</div>

<h2>1. What Is SMILE</h2>

<p>SMILE is the latest generation of laser vision correction. It uses a <strong>femtosecond laser</strong> to reshape the cornea — the clear, front part of your eye — without creating a large surface flap as in traditional LASIK.</p>

<p>The procedure involves making a very small incision, about 2 to 3 millimeters wide. Inside the cornea, the laser creates a thin lens-shaped piece of tissue, known as a <strong>lenticule</strong>, which is then gently removed. This changes the curvature of the cornea so that light focuses correctly on the retina, restoring clear vision.</p>

<p>Because the incision is so small, the healing process is fast, comfortable, and low risk.</p>

<h2>2. How SMILE Is Different from LASIK</h2>

<p>Both SMILE and LASIK are effective vision correction procedures, but SMILE is even less invasive.</p>

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
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Incision Size</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">About 2–3 mm</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">About 20 mm</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Corneal Flap</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">None</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Required</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Recovery Time</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">1–2 days</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">2–3 days</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Dry Eye Risk</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Lower</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Slightly higher</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Suitable For</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Nearsightedness and astigmatism</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Nearsightedness, farsightedness, astigmatism</td>
        </tr>
    </tbody>
</table>

<p>By eliminating the need for a corneal flap, SMILE preserves the natural strength of the eye and reduces dry eye symptoms. This makes it a great choice for people with active lifestyles or mild dryness issues.</p>

<h2>3. Who Can Benefit from SMILE</h2>

<p>SMILE is designed for adults who want clear vision without glasses or contact lenses. You may be a good candidate if you:</p>

<ul>
    <li>Are at least 18 years old</li>
    <li>Have stable vision for at least one year</li>
    <li>Are nearsighted up to -10.00 diopters</li>
    <li>Have astigmatism up to -3.00 diopters</li>
    <li>Have healthy corneas and no active eye diseases</li>
</ul>

<p>People who are not eligible for LASIK because of corneal thickness or dryness may still qualify for SMILE.</p>

<p>Dr. Khanna uses detailed imaging and diagnostic testing to confirm eligibility and design a fully customized treatment plan.</p>

<h2>4. The SMILE Procedure: Step-by-Step</h2>

<p>At <strong>Khanna Vision Institute</strong>, the SMILE procedure is simple, precise, and comfortable.</p>

<ol>
    <li><strong>Preparation</strong> — Numbing drops are applied to the eyes for comfort.</li>
    <li><strong>Laser Creation</strong> — The femtosecond laser creates the lenticule inside the cornea and a small incision on the surface.</li>
    <li><strong>Lenticule Removal</strong> — Dr. Khanna gently removes the lenticule, allowing the cornea to reshape naturally.</li>
    <li><strong>Healing</strong> — The small incision seals on its own without stitches.</li>
</ol>

<p>The entire process takes about 10 to 15 minutes for both eyes. Most patients notice clearer vision within 24 hours.</p>

<h2>5. Advantages of SMILE</h2>

<h3>Fast Recovery</h3>
<p>Because SMILE uses a smaller incision, healing is quicker and more comfortable. Most patients return to work or normal activities in one to two days.</p>

<h3>Minimal Dryness</h3>
<p>With fewer corneal nerves affected, post-surgery dryness is less common than with traditional LASIK.</p>

<h3>Flap-Free Safety</h3>
<p>There is no corneal flap, reducing risks related to dislodgement or trauma.</p>

<h3>Long-Term Stability</h3>
<p>The structural integrity of the cornea remains stronger, offering stable results for years.</p>

<h3>Great for Active Lifestyles</h3>
<p>SMILE is ideal for athletes, travelers, and those who enjoy outdoor or high-movement activities.</p>

<h2>6. Results and Patient Experience</h2>

<p>Patients who undergo SMILE often describe their vision as crisp and natural. Many achieve 20/20 vision or better within a day or two after the procedure.</p>

<p>The comfort level during and after surgery is high, and there is minimal light sensitivity or discomfort.</p>

<p>At <strong>Khanna Vision Institute</strong>, patients consistently report high satisfaction, appreciating both the clear visual results and the gentle recovery experience.</p>

<h2>7. Safety and Technology</h2>

<p>SMILE is an FDA-approved procedure performed with the <strong>ZEISS VisuMax femtosecond laser</strong>, one of the most advanced laser systems in the world. It allows for ultra-precise incisions and consistent results.</p>

<p>Dr. Khanna combines this technology with his extensive refractive surgery experience to ensure every patient receives the highest standard of care.</p>

<p>Safety protocols, detailed diagnostics, and post-operative monitoring are all part of the comprehensive treatment process at Khanna Vision Institute.</p>

<h2>8. Why Choose Khanna Vision Institute</h2>

<p>Choosing a trusted eye surgeon is crucial for achieving optimal results. <strong>Dr. Rajesh Khanna</strong> has performed thousands of successful refractive and cataract surgeries and is known for his focus on personalized care.</p>

<p>Khanna Vision Institute is equipped with the latest diagnostic and surgical technology, providing a comfortable, patient-centered environment.</p>

<p>Patients choose Dr. Khanna because of his:</p>

<ul>
    <li>Proven expertise in refractive surgery</li>
    <li>Focus on safety and precision</li>
    <li>Honest, personalized guidance</li>
    <li>Commitment to long-term vision health</li>
</ul>

<p>Every SMILE procedure is customized to match the patient's eye structure, vision goals, and lifestyle.</p>

<p>The <strong>SMILE laser vision correction</strong> procedure allows you to see the world differently — with clarity, comfort, and confidence. Its flap-free, minimally invasive design offers faster healing and exceptional visual results for those seeking a modern alternative to LASIK.</p>

<p>If you are ready to experience the freedom of clear vision, schedule a consultation at <strong>Khanna Vision Institute</strong>. <strong>Dr. Rajesh Khanna</strong> will evaluate your eyes and help you determine whether SMILE is the right procedure for you.</p>

<p>See life clearly. See it differently — with SMILE.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "See the World Differently with SMILE",
      slug: "2024/04/see-the-world-differently-with-smile",
      content: blogContent,
      metaDescription: "Experience life with clear vision through SMILE, the advanced flap-free laser eye surgery. Learn how Dr. Rajesh Khanna at Khanna Vision Institute helps patients see the world differently.",
      excerpt: "Discover SMILE, the advanced flap-free laser vision correction procedure. Learn how this gentle, minimally invasive surgery can help you see the world with clarity, comfort, and confidence.",
      keywords: "SMILE laser vision correction, flap-free eye surgery, laser eye surgery California, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+12+smile+vision+correction+before+after+smile+patient+happy+clear+vision.webp",
      publishedAt: new Date('2024-04-20'),
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

