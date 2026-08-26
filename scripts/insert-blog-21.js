const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>3 Innovative Eye Surgeries That Fix Astigmatism and Enhance Vision</h1>

<p>Astigmatism is one of the most common vision problems, affecting millions of people worldwide. It occurs when the cornea or lens has an irregular shape, causing blurred or distorted vision at all distances. For some, glasses or contact lenses help temporarily, but they do not solve the root cause. Fortunately, modern ophthalmology offers several surgical options that can permanently correct astigmatism and provide clear, natural vision. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> specializes in advanced eye surgeries that safely and effectively treat astigmatism while improving overall visual quality. Here are three innovative procedures that are transforming how patients see.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+21+astigmatism+laser+surgery+tech+patient+after+astigmatism+correction.webp" alt="Astigmatism Laser Surgery" class="blog-image">
</div>

<h2>1. LASIK for Astigmatism</h2>

<p><strong>LASIK (Laser-Assisted In Situ Keratomileusis)</strong> remains one of the most trusted and effective procedures for correcting astigmatism. During LASIK, a precision laser reshapes the cornea to make it more symmetrical. This allows light to focus properly on the retina, resulting in clear, sharp vision.</p>

<p>The procedure typically takes less than 15 minutes for both eyes and is virtually painless. Recovery is fast — most patients experience noticeable improvement within 24 hours.</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna uses advanced wavefront-guided and topography-guided LASIK systems. These technologies map the cornea in microscopic detail, allowing for personalized corrections that address even subtle imperfections. The result is enhanced visual clarity, improved contrast sensitivity, and long-term stability.</p>

<p>LASIK is ideal for patients with mild to moderate astigmatism who have healthy corneas and stable prescriptions. It not only corrects astigmatism but can also address nearsightedness and farsightedness in a single treatment.</p>

<h2>2. SMILE Laser Eye Surgery</h2>

<p><strong>SMILE (Small Incision Lenticule Extraction)</strong> is the latest generation in laser vision correction and an excellent option for patients with astigmatism. Unlike LASIK, SMILE does not require the creation of a corneal flap. Instead, a femtosecond laser creates a thin, lens-shaped piece of tissue called a lenticule inside the cornea. This lenticule is then removed through a tiny incision, reshaping the cornea and correcting the refractive error.</p>

<p>Because SMILE involves a smaller incision — about 2 to 3 millimeters compared to LASIK's 20 millimeters — it preserves more of the eye's natural strength and results in faster healing. It also reduces the risk of dry eye, making it a great choice for people with existing dryness or active lifestyles.</p>

<p>SMILE is FDA-approved for the correction of myopia and astigmatism and has become increasingly popular among patients who prefer a minimally invasive option. Dr. Khanna performs SMILE using the <strong>ZEISS VisuMax laser system</strong>, which offers unparalleled precision and comfort. Most patients return to normal activities within a day or two, with clear vision that continues to refine over the following weeks.</p>

<h2>3. Toric Intraocular Lens (IOL) Implants</h2>

<p>For patients who have astigmatism along with presbyopia or cataracts, <strong>Toric Intraocular Lens (IOL) implants</strong> offer a powerful, long-term solution. During cataract or lens replacement surgery, the cloudy or aging natural lens is removed and replaced with a custom toric lens that corrects both vision and astigmatism.</p>

<p>These advanced lenses are designed with specific curvature patterns to neutralize corneal irregularities. Once implanted, they stay securely in place and do not require maintenance or replacement. Toric lenses not only restore clarity but also reduce or eliminate the need for glasses for distance vision.</p>

<p>Dr. Khanna uses advanced pre-surgery imaging and intraoperative guidance to align each lens precisely within the eye. This ensures maximum accuracy and stable visual results. Toric IOLs can be combined with <strong>Presbyopic Implants in Eye (PIE)</strong> or <strong>Multifocal IOLs</strong> for patients who want to see clearly at all distances — near, intermediate, and far.</p>

<h2>Choosing the Right Surgery</h2>

<p>Every patient's eyes are unique, which is why selecting the right procedure begins with a comprehensive eye exam. During your consultation at <strong>Khanna Vision Institute</strong>, Dr. Khanna will evaluate your corneal shape, prescription, eye health, and lifestyle needs to recommend the most effective treatment.</p>

<p>You may be a good candidate for:</p>

<ul>
    <li><strong>LASIK</strong>, if you have mild to moderate astigmatism and healthy corneas</li>
    <li><strong>SMILE</strong>, if you want a flap-free procedure with minimal dryness</li>
    <li><strong>Toric IOLs</strong>, if you have cataracts or presbyopia along with astigmatism</li>
</ul>

<h2>Life After Surgery</h2>

<p>Patients who undergo astigmatism correction surgery often describe the results as life-changing. Vision becomes clear and stable without the need for glasses or contact lenses. Colors appear brighter, nighttime glare is reduced, and daily activities like driving or reading become more comfortable.</p>

<p>The recovery process is typically quick, with most patients returning to work or normal activities within a day or two. Regular follow-ups ensure the eyes heal properly and the results remain consistent.</p>

<h2>The Khanna Vision Institute Difference</h2>

<p><strong>Dr. Rajesh Khanna</strong> is a board-certified ophthalmologist with extensive experience in laser and lens-based vision correction. His practice combines advanced diagnostic imaging, modern laser technology, and a personalized approach to ensure every patient achieves optimal results.</p>

<p>At <strong>Khanna Vision Institute</strong>, you receive:</p>

<ul>
    <li>Detailed, one-on-one consultations</li>
    <li>State-of-the-art laser and surgical equipment</li>
    <li>Proven procedures tailored to your unique eye health</li>
    <li>Transparent care focused on safety and long-term satisfaction</li>
</ul>

<h2>Final Thoughts</h2>

<p>Astigmatism no longer has to limit how you see or live. With innovative procedures like LASIK, SMILE, and Toric IOL implants, you can enjoy lasting visual freedom and improved quality of life.</p>

<p>If you're ready to explore which option is right for you, schedule a consultation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong>. In just one visit, you can take the first step toward sharper, more natural vision — and a clearer future.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "3 Innovative Eye Surgeries That Fix Astigmatism and Enhance Vision",
      slug: "2020/08/3-innovative-eye-surgeries-fix-astigmatism-enhance-vision",
      content: blogContent,
      metaDescription: "Discover three advanced surgeries for astigmatism correction — LASIK, SMILE, and Toric IOL implants. Learn how Dr. Rajesh Khanna at Khanna Vision Institute can help you achieve clearer vision.",
      excerpt: "Learn about three innovative eye surgeries that can permanently correct astigmatism: LASIK, SMILE, and Toric IOL implants. Discover which procedure is right for you.",
      keywords: "astigmatism surgery, LASIK for astigmatism, SMILE eye surgery, toric lens implants, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+21+astigmatism+laser+surgery+tech+patient+after+astigmatism+correction.webp",
      publishedAt: new Date('2020-08-15'),
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

