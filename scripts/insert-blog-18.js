const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>Ophthalmology: Understanding and Treating Medical Conditions of the Human Eye</h1>

<p>The human eye is one of the most complex and vital organs of the body, responsible for how we see and experience the world around us. Maintaining healthy vision requires not only good habits but also expert medical care when problems arise. This is where the field of <strong>ophthalmology</strong> plays a crucial role. Ophthalmology is the branch of medicine that focuses on the diagnosis, treatment, and prevention of diseases and disorders related to the eyes. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> and his team provide advanced, compassionate care for patients dealing with a wide range of eye conditions — from common vision issues to complex medical problems.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+18+ophthalmologist+examining+patient+human+eye+anatomy+diagram.webp" alt="Ophthalmologist Examining Patient" class="blog-image">
</div>

<h2>What an Ophthalmologist Does</h2>

<p>An ophthalmologist is a medical doctor who specializes in eye care. Unlike optometrists, who primarily prescribe glasses and contact lenses, ophthalmologists can diagnose and treat eye diseases, perform surgery, and manage ongoing eye health. Their expertise covers every part of the eye, including the cornea, lens, retina, optic nerve, and surrounding tissues. At Khanna Vision Institute, Dr. Khanna combines clinical experience with advanced technology to deliver both medical and surgical solutions that protect and restore vision.</p>

<h2>Common Eye Conditions Treated in Ophthalmology</h2>

<p>Ophthalmologists manage a broad spectrum of conditions that affect people of all ages. Some of the most common include:</p>

<h3>Cataracts</h3>
<p>A condition in which the natural lens of the eye becomes cloudy, leading to blurry or dim vision. Cataract surgery replaces the cloudy lens with a clear artificial one, restoring sharp vision.</p>

<h3>Glaucoma</h3>
<p>A group of eye diseases that damage the optic nerve, often due to high intraocular pressure. If left untreated, glaucoma can cause irreversible vision loss.</p>

<h3>Macular Degeneration</h3>
<p>A condition that affects the central part of the retina, responsible for detailed vision. It is a leading cause of vision loss in adults over 60.</p>

<h3>Diabetic Retinopathy</h3>
<p>A complication of diabetes that damages the blood vessels in the retina. Early detection through regular eye exams can help prevent vision loss.</p>

<h3>Dry Eye Syndrome</h3>
<p>A condition caused by insufficient tear production or poor tear quality, leading to discomfort and blurred vision.</p>

<h3>Refractive Errors</h3>
<p>Problems such as nearsightedness, farsightedness, and astigmatism, which can be corrected through glasses, contact lenses, or advanced procedures like LASIK or SMILE.</p>

<h3>Keratoconus</h3>
<p>A progressive thinning of the cornea that distorts vision. Treatments include corneal cross-linking, specialty contact lenses, or corneal implants.</p>

<p>Each of these conditions requires specialized diagnosis and care. Dr. Khanna and his team use state-of-the-art imaging and laser technology to detect issues early and create personalized treatment plans.</p>

<h2>Advanced Diagnostic Technology</h2>

<p>Modern ophthalmology relies on advanced diagnostic tools to identify problems before they affect vision. At <strong>Khanna Vision Institute</strong>, patients benefit from comprehensive eye exams that include:</p>

<ul>
    <li>Optical Coherence Tomography (OCT) to evaluate retinal and corneal layers</li>
    <li>Visual field testing to detect glaucoma or optic nerve damage</li>
    <li>Corneal topography for assessing surface shape and irregularities</li>
    <li>Digital retinal photography for monitoring long-term changes</li>
</ul>

<p>These tools allow for early detection, accurate diagnosis, and customized treatment for each patient's unique visual needs.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+18+ophthalmologist+examining+patient+human+eye+anatomy+diagram1.webp" alt="Human Eye Anatomy Diagram" class="blog-image">
</div>

<h2>Surgical and Non-Surgical Treatments</h2>

<p>Ophthalmology offers both surgical and non-surgical options depending on the condition. Non-surgical treatments include prescription eye drops, oral medications, and non-invasive laser therapies. Surgical procedures may include:</p>

<ul>
    <li><strong>Cataract surgery</strong> for vision restoration</li>
    <li><strong>LASIK and SMILE</strong> for vision correction</li>
    <li><strong>Corneal cross-linking or transplant</strong> for keratoconus</li>
    <li><strong>Glaucoma micro-surgery (MIGS)</strong> for pressure control</li>
    <li><strong>Eyelid and tear duct surgeries</strong> for functional and cosmetic improvement</li>
</ul>

<p>At Khanna Vision Institute, patient safety and comfort are the top priorities. Each procedure is carefully planned to ensure the best possible outcomes with minimal recovery time.</p>

<h2>Preventive Eye Care</h2>

<p>Prevention is a key part of maintaining healthy eyes. Regular eye exams can detect early signs of disease before symptoms appear. Adults over 40 should schedule comprehensive eye exams every one to two years, especially if they have risk factors such as diabetes, hypertension, or a family history of eye disease.</p>

<p>Dr. Khanna encourages patients to follow healthy lifestyle practices that support long-term eye health, including a balanced diet rich in antioxidants, wearing sunglasses to block UV rays, and avoiding smoking.</p>

<h2>The Role of Ophthalmology in Aging Vision</h2>

<p>As people age, the risk of eye conditions such as cataracts, glaucoma, and presbyopia increases. Ophthalmology provides effective solutions to help seniors maintain independence and a high quality of life. Procedures like cataract surgery or presbyopia-correcting lens implants can restore clarity and reduce dependence on glasses. Dr. Khanna's expertise in both refractive and medical ophthalmology allows him to tailor care for every stage of life.</p>

<h2>Why Choose Khanna Vision Institute</h2>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist with decades of experience in diagnosing and treating a full range of eye conditions. His institute combines cutting-edge technology, patient-centered care, and a deep commitment to improving lives through better vision. Patients choose Khanna Vision Institute for its:</p>

<ul>
    <li>Advanced diagnostic and surgical capabilities</li>
    <li>Expertise in both medical and refractive eye care</li>
    <li>Personalized treatment plans based on individual needs</li>
    <li>Friendly and professional environment focused on long-term eye health</li>
</ul>

<p>From preventive care to complex surgical solutions, Khanna Vision Institute is dedicated to providing exceptional eye care for every patient.</p>

<p>Ophthalmology plays a vital role in preserving sight and improving quality of life. Whether you need routine care, treatment for an eye disease, or advanced vision correction, choosing the right specialist makes all the difference.</p>

<p>At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> offers expert, compassionate care backed by modern technology and years of surgical experience. Schedule a consultation today to learn more about how ophthalmology can help you maintain clear, healthy vision for years to come.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "Ophthalmology: Understanding and Treating Medical Conditions of the Human Eye",
      slug: "2023/06/ophthalmology-understanding-treating-medical-conditions-of-the-human-eye",
      content: blogContent,
      metaDescription: "Learn how ophthalmology helps diagnose and treat medical eye conditions. Expert care and advanced technology with Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Discover the field of ophthalmology and how it helps diagnose and treat eye conditions. Learn about common eye diseases, advanced diagnostics, and expert care from Dr. Rajesh Khanna.",
      keywords: "ophthalmology, eye diseases, eye surgery, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+18+ophthalmologist+examining+patient+human+eye+anatomy+diagram.webp",
      publishedAt: new Date('2023-06-15'),
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

