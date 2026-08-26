const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_USER = process.env.MONGODB_USER || 'bloguser';
const MONGODB_PASS = process.env.MONGODB_PASS || '@dmKh@nna@2520';
const MONGODB_DB = process.env.MONGODB_DB || 'blog';

const blogContent = `
<h1>How to Put In Eye Drops or Ointment</h1>

<p>Using eye drops or ointment correctly is one of the simplest yet most important parts of maintaining healthy eyes or healing after an eye procedure. Whether prescribed after LASIK, cataract surgery, or for conditions like dry eyes or allergies, the way you apply medication affects how well it works. At <strong>Khanna Vision Institute</strong>, <strong>Dr. Rajesh Khanna</strong> and his team often guide patients on the correct technique for using drops and ointments safely and effectively at home. This guide explains the proper steps, hygiene tips, and common mistakes to avoid.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+13+how+to+put+in+eye+drops+step+by+step+patient+using+eye+ointment.webp" alt="How to Put In Eye Drops Step by Step" class="blog-image">
</div>

<h2>1. Preparing to Apply Eye Drops</h2>

<p>Start by washing your hands thoroughly with soap and water. Avoid using sanitizers or scented soaps right before touching your eyes, as these may irritate them. Shake the bottle if the label instructs you to. Always check the label to confirm you are using the correct drop or ointment, especially if you have more than one type prescribed. If the drops were stored in a refrigerator, you can hold the bottle in your hand for a minute to bring it closer to body temperature for comfort.</p>

<h2>2. Positioning Yourself</h2>

<p>Find a comfortable position. You can either sit in front of a mirror or lie back in a chair. Tilt your head slightly upward and look at the ceiling. Gently pull down your lower eyelid to create a small pocket between your lid and your eye. This pocket is where the drop should go.</p>

<h2>3. Applying Eye Drops</h2>

<p>Hold the bottle with the tip facing downward, about one inch above your eye. Be careful not to touch your eye, eyelashes, or skin with the tip, as that can contaminate the bottle. Squeeze one drop into the pocket created by your lower eyelid. If more than one drop falls in, do not worry—most eyes can only hold one drop at a time, and any extra will roll out. After applying, gently close your eye and press your fingertip against the inner corner (near the nose) for about 30 seconds. This helps the medicine stay in your eye longer and prevents it from draining too quickly.</p>

<h2>4. Applying Eye Ointment</h2>

<p>Eye ointments are slightly different. Start by washing your hands and gently pulling down your lower eyelid. Squeeze a small line of ointment—about half an inch—into the pocket without touching the eye or lashes with the tube. Blink slowly to spread the ointment evenly. Your vision may blur temporarily, which is normal. For this reason, it is best to apply ointment right before bedtime unless your doctor gives other instructions.</p>

<div class="blog-image-container">
    <img src="https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+13+how+to+put+in+eye+drops+step+by+step+patient+using+eye+ointment1.webp" alt="Patient Using Eye Ointment" class="blog-image">
</div>

<h2>5. If You Use More Than One Eye Drop</h2>

<p>If you have multiple prescribed drops, wait at least five minutes between each one to allow the first drop to absorb properly. If you are using both drops and ointment, always use the drops first, wait a few minutes, and then apply the ointment. This ensures each medication works effectively.</p>

<h2>6. Hygiene and Storage Tips</h2>

<p>Always keep the bottle tip clean and avoid letting it touch any surface. Replace the cap tightly after each use. Do not share your eye drops with others, even if they have similar symptoms. Store your drops or ointment as instructed—some need refrigeration, while others should be kept at room temperature. Check the expiration date regularly, and discard any bottle that looks cloudy, discolored, or past its expiry date.</p>

<h2>7. Common Mistakes to Avoid</h2>

<p>Many patients accidentally reduce the effectiveness of their medication by making small but avoidable mistakes. Avoid these:</p>

<ul>
    <li>Touching the dropper tip to your eye or fingers</li>
    <li>Using expired or contaminated drops</li>
    <li>Applying too many drops at once</li>
    <li>Forgetting to wash hands before use</li>
    <li>Skipping doses or using drops at irregular intervals</li>
</ul>

<p>At <strong>Khanna Vision Institute</strong>, we emphasize consistency. Using your prescribed drops exactly as directed helps prevent infection, control inflammation, and promote faster healing.</p>

<h2>8. When to Contact Your Doctor</h2>

<p>If you experience persistent redness, pain, swelling, or blurred vision after using your drops, contact your ophthalmologist immediately. These symptoms could indicate irritation or an allergic reaction. Do not stop using the medication without consulting your doctor, as this could interfere with healing or treatment results.</p>

<p><strong>Dr. Rajesh Khanna</strong> and his team are always available to answer questions about medication usage, recovery instructions, or any concerns you may have following an eye procedure.</p>

<p>Properly applying eye drops or ointment may seem simple, but doing it correctly is essential for the health and comfort of your eyes. A few minutes of care can make a big difference in how well your eyes heal and how effective your treatment is.</p>

<p>If you have recently undergone eye surgery or been prescribed new medication, and you're unsure about the application method, reach out to <strong>Khanna Vision Institute</strong>. <strong>Dr. Rajesh Khanna</strong> and his team will guide you step by step, ensuring your treatment is as effective and comfortable as possible.</p>
`;

async function insertBlog() {
  const uri = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASS)}@localhost:27017/${MONGODB_DB}?authSource=${MONGODB_DB}`;
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const posts = db.collection('posts');

    const blogPost = {
      title: "How to Put In Eye Drops or Ointment",
      slug: "2023/01/how-to-put-in-eye-drops-or-ointment",
      content: blogContent,
      metaDescription: "Learn the correct way to apply eye drops or ointment safely and effectively. Expert guidance from Dr. Rajesh Khanna at Khanna Vision Institute.",
      excerpt: "Master the proper technique for applying eye drops and ointments. Learn step-by-step instructions, hygiene tips, and common mistakes to avoid for effective eye care.",
      keywords: "how to apply eye drops, eye ointment use, post-LASIK care, eye medication instructions, Khanna Vision Institute, Dr. Rajesh Khanna",
      author: "Dr. Rajesh Khanna",
      featuredImage: "https://khanna-media-bucket.s3.us-east-1.amazonaws.com/blogs/Blog+13+how+to+put+in+eye+drops+step+by+step+patient+using+eye+ointment.webp",
      publishedAt: new Date('2023-01-15'),
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

