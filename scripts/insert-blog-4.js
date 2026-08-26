const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>The Best Candidates for SMILE Eye Surgery — Are You One of Them?</h1>

<p>If you've ever imagined waking up and seeing clearly without reaching for your glasses or contact lenses, <strong>SMILE Eye Surgery</strong> might sound like the perfect solution.</p>

<p>SMILE — which stands for <strong>Small Incision Lenticule Extraction</strong> — is one of the most advanced and minimally invasive laser vision correction options available today. It's quick, flap-free, and offers fast recovery with long-lasting results.</p>

<p>But is <strong>SMILE</strong> the right procedure for <em>you</em>?</p>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Rajesh Khanna evaluates each patient carefully to determine if SMILE is the best match for their eyes and lifestyle. In this article, we'll explore what makes someone an ideal candidate for SMILE and how it differs from other vision correction procedures.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+4+smile+eye+surgery+candidate+consultation+athlete+smiling+after+smile+eye+surgery+1.webp" alt="SMILE Eye Surgery Candidate Consultation" class="blog-image">
</div>

<h2>1. What Is SMILE Eye Surgery? (A Quick Refresher)</h2>

<p>SMILE is a <strong>next-generation laser eye surgery</strong> that corrects nearsightedness (myopia) and astigmatism using a <strong>tiny laser incision</strong>, instead of creating a large flap like in LASIK.</p>

<p>A femtosecond laser creates a small, disc-shaped piece of tissue (called a lenticule) inside the cornea. This lenticule is then gently removed through a small opening — about the width of a pen tip.</p>

<p>This reshaping allows light to focus correctly on your retina, restoring clear vision.</p>

<p><strong>The result?</strong></p>

<p>Sharper vision, minimal discomfort, and quick healing — all achieved with a smaller incision and no flap.</p>

<h2>2. SMILE vs. LASIK — What's the Difference?</h2>

<p>While both SMILE and LASIK are laser-based procedures, they have key differences:</p>

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
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Incision Size</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Tiny (2–3 mm)</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Larger (20 mm flap)</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Flap Creation</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">No flap</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Creates a corneal flap</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Corneal Strength</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Better preserved</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Slightly reduced</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Dry Eye Risk</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Lower</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Slightly higher</td>
        </tr>
        <tr>
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Recovery Time</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Fast</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Fast</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Ideal for</strong></td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Active lifestyle, moderate to high myopia</td>
            <td style="padding: 15px; border: 1px solid #e0e0e0;">Broad vision correction needs</td>
        </tr>
    </tbody>
</table>

<p>For many people — especially those who play sports or have dry eyes — <strong>SMILE offers a safer and gentler option</strong>.</p>

<h2>3. Who Is an Ideal Candidate for SMILE Eye Surgery?</h2>

<p>At <strong>Khanna Vision Institute</strong>, Dr. Khanna uses advanced diagnostic tools to determine candidacy. But in general, you may be a great candidate for SMILE if:</p>

<h3>You Are 18 Years or Older</h3>
<p>Your eyes should be fully developed before laser vision correction.</p>

<h3>You Have Stable Vision</h3>
<p>Your prescription should not have changed significantly (more than ±0.5 diopters) for at least one year.</p>

<h3>You Are Nearsighted or Have Astigmatism</h3>
<p>SMILE is FDA-approved to correct up to:</p>

<ul>
    <li><strong>-10.00 diopters of myopia (nearsightedness)</strong></li>
    <li><strong>-3.00 diopters of astigmatism</strong></li>
</ul>

<p>If you have farsightedness (hyperopia), LASIK or EVO ICL may be better options.</p>

<h3>You Have Healthy Eyes</h3>
<p>Conditions like cataracts, glaucoma, keratoconus, or corneal scarring can affect eligibility.</p>

<h3>You Want a Flap-Free Procedure</h3>
<p>If you prefer a laser correction without the flap creation used in LASIK, SMILE is ideal.</p>

<h3>You Have an Active Lifestyle</h3>
<p>Athletes, military personnel, and people who do outdoor or contact sports benefit from SMILE's added corneal strength and low risk of flap complications.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+4+smile+eye+surgery+candidate+consultation+athlete+smiling+after+smile+eye+surgery2.webp" alt="Athlete Smiling After SMILE Eye Surgery" class="blog-image">
</div>

<h2>4. Who Might Not Be a Good Candidate for SMILE?</h2>

<p>Even though SMILE is safe for most adults, it's not right for everyone. You may not be an ideal candidate if:</p>

<ul>
    <li>Your <strong>corneas are too thin</strong></li>
    <li>You have <strong>severe dry eyes</strong> or <strong>eye infections</strong></li>
    <li>You're <strong>pregnant or breastfeeding</strong> (temporary vision changes)</li>
    <li>You have <strong>autoimmune conditions</strong> affecting healing</li>
    <li>You have <strong>extreme prescriptions</strong> beyond SMILE's approved range</li>
</ul>

<p>In such cases, <strong>Dr. Khanna</strong> may suggest alternatives like <strong>EVO ICL</strong>, <strong>PRK</strong>, or <strong>Presby-LASIK</strong>, based on your vision goals and eye health.</p>

<h2>5. What Are the Benefits of Choosing SMILE Eye Surgery?</h2>

<p>Patients choose SMILE for its comfort, precision, and rapid recovery. Some of its major benefits include:</p>

<h3>No Flap, Less Dryness</h3>
<p>Since SMILE doesn't involve cutting a corneal flap, it leaves most surface nerves untouched — reducing dry eye symptoms.</p>

<h3>Fast and Gentle Recovery</h3>
<p>Most people return to work and normal activities in 1–2 days.</p>

<h3>Excellent Visual Outcomes</h3>
<p>Clinical studies show <strong>over 98% of SMILE patients achieve 20/25 vision or better</strong>.</p>

<h3>Long-Term Corneal Stability</h3>
<p>SMILE preserves more of the eye's natural structure, maintaining strength even years later.</p>

<h3>Less Risk of Dislodgment</h3>
<p>No flap means fewer risks for people with active or outdoor lifestyles.</p>

<h2>6. A Real Example — How SMILE Helped Jessica Schmidt</h2>

<p>Professional softball player <strong>Jessica Schmidt</strong> wanted to improve her performance on the field but struggled with glasses. After consulting with <strong>Dr. Khanna</strong>, she was found to be a perfect candidate for <strong>SMILE</strong>.</p>

<p>Just days after her procedure, Jessica reported sharper vision, better reaction time, and new confidence — all without worrying about contacts during games.</p>

<p>Her experience shows how SMILE not only improves vision but can also <strong>enhance everyday life and performance</strong>.</p>

<h2>7. The Khanna Vision Institute Advantage</h2>

<p>At <strong>Khanna Vision Institute</strong>, every SMILE procedure is guided by advanced diagnostic imaging, top-tier ZEISS VisuMax laser technology, and years of surgical experience.</p>

<p>What sets Dr. Khanna apart:</p>

<ul>
    <li>Over <strong>two decades of refractive surgery experience</strong></li>
    <li>Personalized care and precise screening</li>
    <li>Transparent consultation — every option clearly explained</li>
    <li>Post-surgery monitoring for long-term safety</li>
</ul>

<p>The institute's mission is simple: <strong>to deliver safe, comfortable, and life-changing vision correction tailored to each patient</strong>.</p>

<h2>8. What Happens During Your Consultation?</h2>

<p>Your SMILE evaluation includes:</p>

<ul>
    <li>Vision measurement and prescription stability check</li>
    <li>Corneal topography and thickness mapping</li>
    <li>Tear film and eye health assessment</li>
    <li>Personalized vision plan discussion</li>
</ul>

<p>If you qualify for SMILE, Dr. Khanna will guide you through the entire process — from preparation to post-operative care — so you know exactly what to expect.</p>

<p>SMILE laser eye surgery is one of the most advanced and comfortable ways to correct vision today. If you're nearsighted, have astigmatism, or lead an active lifestyle, SMILE could be your path to clear, confident vision.</p>

<p>The best way to find out is through a detailed evaluation with <strong>Dr. Rajesh Khanna</strong> at <strong>Khanna Vision Institute</strong>.<br />With personalized care and world-class technology, you can trust your eyes are in expert hands.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "The Best Candidates for SMILE Eye Surgery — Are You One of Them?",
      slug: "2024/09/the-best-candidates-for-smile-eye-surgery-are-you-one-of-them-and-how-smile-laser-eye-surgery-boosted-professional-softball-career-of-jessica-schmidt",
      content: blogContent,
      metaDescription: "Wondering if you're a candidate for SMILE laser eye surgery? Learn who qualifies, what the benefits are, and how Dr. Rajesh Khanna at Khanna Vision Institute helps patients see clearly — flap-free.",
      excerpt: "Discover if you're an ideal candidate for SMILE eye surgery. Learn about candidacy requirements, benefits, and how this flap-free procedure can transform your vision and lifestyle.",
      keywords: "SMILE eye surgery, SMILE laser vision correction, best candidates for SMILE, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+4+smile+eye+surgery+candidate+consultation+athlete+smiling+after+smile+eye+surgery+1.webp",
      publishedAt: new Date('2024-09-15'),
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

