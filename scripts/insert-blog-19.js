const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>EVO ICL vs LASIK: Pros and Cons of Each Procedure</h1>

<p>When it comes to permanent vision correction, <strong>LASIK</strong> has long been the most popular choice. But in recent years, another advanced procedure called <strong>EVO ICL (Implantable Collamer Lens)</strong> has gained attention for its safety, precision, and versatility. Both options can provide clear, natural vision without glasses or contact lenses, but they work in very different ways. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> helps patients understand the differences between LASIK and EVO ICL so they can make the best choice for their eyes, lifestyle, and long-term visual health.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+19+evo+icl+vs+lasik+comparison+eye+surgeon+explaining+icl+vs+lasik.webp" alt="EVO ICL vs LASIK Comparison" class="blog-image">
</div>

<h2>Understanding LASIK</h2>

<p><strong>LASIK (Laser-Assisted In Situ Keratomileusis)</strong> is a laser eye surgery that reshapes the cornea — the front surface of the eye — to correct how light focuses on the retina. It is ideal for patients with mild to moderate <strong>nearsightedness</strong>, <strong>farsightedness</strong>, or <strong>astigmatism</strong>.</p>

<p>During LASIK, a thin flap is created on the cornea's surface using a femtosecond laser. Another laser then reshapes the underlying corneal tissue to correct the refractive error. The flap is repositioned, and the cornea heals naturally without stitches. The procedure takes less than 15 minutes, and most patients experience clear vision within 24 hours.</p>

<h2>Understanding EVO ICL</h2>

<p><strong>EVO ICL (Implantable Collamer Lens)</strong> is a lens-based vision correction procedure. Instead of reshaping the cornea, it involves implanting a biocompatible, flexible lens inside the eye, between the iris and the natural lens. This lens works with the eye's natural focusing system to provide sharp, clear vision.</p>

<p>Unlike LASIK, the EVO ICL procedure does not remove or alter corneal tissue. It is reversible and can be adjusted or removed later if necessary. The surgery typically takes about 20 to 30 minutes per eye, and vision improvement is immediate or noticeable within a day.</p>

<h2>Key Differences Between EVO ICL and LASIK</h2>

<p>While both procedures correct refractive errors, they differ in technique, recovery, and suitability.</p>

<h3>Eye Structure and Eligibility</h3>
<p>LASIK requires a certain corneal thickness because tissue is removed during reshaping. Patients with thin corneas, irregular corneal surfaces, or chronic dryness may not be suitable candidates. EVO ICL, on the other hand, does not depend on corneal thickness, making it a better option for patients with thin or delicate corneas.</p>

<h3>Reversibility</h3>
<p>LASIK is a permanent reshaping of the cornea and cannot be reversed. EVO ICL is reversible and removable. The lens can be replaced or upgraded if vision needs change over time, such as with age or other eye conditions.</p>

<h3>Range of Correction</h3>
<p>LASIK is ideal for mild to moderate refractive errors, typically up to -8.00 diopters of myopia. EVO ICL can correct much higher prescriptions — even up to -20.00 diopters of nearsightedness — making it suitable for people who are not LASIK candidates due to very high prescriptions.</p>

<h3>Dry Eye Considerations</h3>
<p>Because LASIK involves cutting corneal nerves, temporary dryness can occur after surgery. EVO ICL avoids this issue since it does not affect the corneal surface, making it a better choice for patients with existing dry eye symptoms.</p>

<h3>Recovery and Healing</h3>
<p>Both procedures offer quick recovery times. LASIK patients often resume normal activities within 24 to 48 hours. EVO ICL recovery is similarly fast, but vision can continue to improve for several days as the eye adjusts to the new lens.</p>

<h3>Safety and Long-Term Health</h3>
<p>Both procedures are FDA-approved and have excellent safety records. EVO ICL has the added benefit of being reversible and preserving the corneal structure. LASIK has decades of proven success, with high patient satisfaction rates and long-term stability. The right choice depends on individual eye anatomy and long-term visual goals.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+19+evo+icl+vs+lasik+comparison+eye+surgeon+explaining+icl+vs+lasik1.webp" alt="Eye Surgeon Explaining ICL vs LASIK" class="blog-image">
</div>

<h2>Benefits of LASIK</h2>

<p>LASIK remains the preferred option for many because it is quick, well-established, and provides long-lasting results. Its advantages include:</p>

<ul>
    <li>Immediate improvement in vision clarity</li>
    <li>Minimal discomfort and fast healing</li>
    <li>No implanted materials in the eye</li>
    <li>Permanent results for most patients</li>
</ul>

<p>For people with healthy corneas and moderate prescriptions, LASIK is often the most efficient and cost-effective choice for visual freedom.</p>

<h2>Benefits of EVO ICL</h2>

<p>EVO ICL offers several unique advantages over LASIK:</p>

<ul>
    <li>Ideal for thin or irregular corneas</li>
    <li>Reversible and removable if needed</li>
    <li>Can correct high prescriptions beyond LASIK limits</li>
    <li>No corneal dryness or structural alteration</li>
    <li>Excellent optical quality with sharp, high-definition vision</li>
</ul>

<p>The lens is made of a biocompatible material called collamer, which contains collagen and works naturally with the eye's environment. This makes it extremely comfortable and stable inside the eye.</p>

<h2>Which One Is Right for You</h2>

<p>The best way to decide between EVO ICL and LASIK is through a comprehensive eye examination. Dr. Khanna evaluates factors such as corneal thickness, prescription strength, pupil size, tear film health, and overall eye anatomy to determine the most suitable option.</p>

<p>You may be a better candidate for <strong>LASIK</strong> if you:</p>

<ul>
    <li>Have a moderate prescription</li>
    <li>Have healthy, thick corneas</li>
    <li>Want a fast, permanent correction with minimal follow-up care</li>
</ul>

<p>You may be a better candidate for <strong>EVO ICL</strong> if you:</p>

<ul>
    <li>Have a high prescription or thin corneas</li>
    <li>Struggle with chronic dry eyes</li>
    <li>Prefer a reversible or lens-based option</li>
    <li>Want a procedure that preserves natural corneal tissue</li>
</ul>

<h2>The Khanna Vision Institute Advantage</h2>

<p><strong>Dr. Rajesh Khanna</strong> is one of California's leading experts in both LASIK and EVO ICL procedures. His institute offers state-of-the-art diagnostic imaging, advanced laser platforms, and a patient-centered approach. Each treatment plan is tailored to individual eye health, ensuring the highest level of precision, safety, and satisfaction.</p>

<p>Patients at <strong>Khanna Vision Institute</strong> appreciate Dr. Khanna's detailed consultations, transparent recommendations, and consistent record of successful outcomes. Whether you choose LASIK or EVO ICL, you can expect exceptional vision correction and personalized care.</p>

<p>Both LASIK and EVO ICL are outstanding procedures that can dramatically improve your quality of life. The right choice depends on your eye health, prescription level, and long-term goals. While LASIK remains the gold standard for many, EVO ICL offers a remarkable alternative for those who want flexibility and enhanced comfort.</p>

<p>To find out which vision correction procedure is best for you, schedule a consultation at <strong>Khanna Vision Institute</strong>. <strong>Dr. Rajesh Khanna</strong> will perform a detailed evaluation and guide you toward the safest and most effective option for your eyes.</p>

<p>Clear vision is life-changing — and with today's technology, you have more choices than ever to achieve it.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "EVO ICL vs LASIK: Pros and Cons of Each Procedure",
      slug: "2024/02/evo-icl-vs-lasik-pros-and-cons-of-each-procedure",
      content: blogContent,
      metaDescription: "Learn the differences between EVO ICL and LASIK, including pros, cons, and eligibility. Expert guidance from Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Compare EVO ICL and LASIK vision correction procedures. Learn about the pros, cons, and differences to help you choose the best option for your eyes.",
      keywords: "EVO ICL vs LASIK, LASIK vs ICL, vision correction procedures, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+19+evo+icl+vs+lasik+comparison+eye+surgeon+explaining+icl+vs+lasik.webp",
      publishedAt: new Date('2024-02-20'),
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

