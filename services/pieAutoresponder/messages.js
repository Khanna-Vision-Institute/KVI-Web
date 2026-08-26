function firstNameFrom(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'there';
}

function interpolate(template, vars) {
  return String(template).replace(/\[Name\]/g, vars.name || 'there');
}

const STAGE1_SMS = {
  day0: `[Name], thanks for reaching out to Khanna Vision! 👓

Ready to say goodbye to reading glasses FOREVER?

Dr. Khanna (25,000+ procedures, author of "The Miracle of Pi in Eye") pioneered PIE surgery - it's like cataract surgery BUT better.

FREE Consultation: Call (805) 230-2126 or reply YES!

📍 Beverly Hills & Westlake Village`,

  day1: `[Name], meet the surgeon behind PIE! 📚

Dr. Rajesh Khanna:
✅ 30+ years in vision correction
✅ 25,000+ successful procedures
✅ Author of "The Miracle of Pi in Eye"
✅ Beverly Hills' trusted eye surgeon
✅ Featured in Beverly Hills Times

Watch: khannainstitute.com/pie-video

Ready? Call (805) 230-2126`,

  day2: `[Name], imagine your life AFTER PIE: 🌟

📖 Reading menus without squinting
📱 Checking texts without searching for glasses
🏌️ Golf scorecard - crystal clear
💻 Computer AND distance - no more switching
✈️ Travel without packing 3 pairs of glasses

PIE patients say: "I feel 20 years younger!"

Book FREE consult: (805) 230-2126`,

  day3: `[Name], why patients choose PIE over other options:

❌ Reading glasses - Lost, scratched, embarrassing
❌ Progressives - Headaches, limited vision zones
❌ Contacts - Dry eyes, infections, daily hassle
❌ LASIK - Doesn't fix reading vision after 45

✅ PIE - ONE procedure, ALL distances, PREVENTS cataracts!

"Why didn't I do this sooner?" - Every PIE patient

Schedule: (805) 230-2126`,

  day10: `[Name], real PIE patient stories:

⭐⭐⭐⭐⭐ "At 58, I feel 30 again. No more patting my pockets for readers!" - Michael T.

⭐⭐⭐⭐⭐ "As a surgeon myself, I trusted only Dr. Khanna. Best decision ever." - Dr. Sarah M.

⭐⭐⭐⭐⭐ "Golf, tennis, computer work - ALL crystal clear!" - Robert K.

Join 25,000+ happy patients!

FREE consult: (805) 230-2126`,

  day14: `[Name], just checking in one last time! 👓

The average person reaches for reading glasses 15x/day. That's 5,475 times per year.

PIE changes that to ZERO.

Still thinking? Let's chat! Dr. Khanna answers all questions personally during your FREE consultation.

(805) 230-2126 - We're here when you're ready!`
};

const DAY5_EMAIL_SUBJECT = '[Name], Your Complete Guide to Life Without Reading Glasses';

const DAY5_EMAIL_BODY = `Hi [Name],

I noticed you're exploring vision correction options. Let me share some eye-opening facts about PIE that might surprise you:

🔬 WHAT IS PIE?
PIE (Presbyopic Implant in Eye) replaces your aging, inflexible natural lens with an advanced presbyopic implant. Unlike LASIK which only reshapes the cornea, PIE addresses the ROOT CAUSE of age-related vision loss.

⏱️ THE PROCEDURE:
• 5-10 minutes per eye
• Completely painless (you're awake!)
• Walk in, walk out same day
• Return to work within 24 hours

💡 WHY PIE IS UNIQUE:
1. PREVENTS CATARACTS - The only procedure that eliminates future cataract risk
2. ALL DISTANCES - Near, intermediate, AND far vision
3. PERMANENT - Won't change or fade over time
4. REVERSIBLE - Implants can be exchanged if needed

💰 INVESTMENT:
$5,000-$8,000 per eye
• 0% APR financing from $199/month
• HSA/FSA accepted

🏆 WHY DR. KHANNA?
• Author of "The Miracle of Pi in Eye"
• 25,000+ procedures performed
• 30+ years experience

📅 YOUR NEXT STEP:
FREE consultation — call (805) 230-2126 or reply to this email.

To clearer vision,
The Khanna Vision Team`;

const DAY7_CALL_SCRIPT =
  "Hi [Name], this is [Agent] from Dr. Khanna's office following up. I wanted to let you know that Dr. Khanna has limited availability this month, and I'd hate for you to miss out on our current promotion. If you book your consultation this week and proceed with PIE, you'll save $500 per eye. Are you still interested in getting rid of those reading glasses for good?";

const PIE_CALL_AGENT_NAME = process.env.PIE_CALL_AGENT_NAME || 'Guru';

const DAY0_CALL_SCRIPT_SECTIONS = {
  opening: `"Hi [Name], this is ${PIE_CALL_AGENT_NAME} from Dr. Khanna's office at Khanna Vision Institute. I see you're interested in vision correction - specifically getting rid of those reading glasses! I'd love to help you explore if PIE is right for you. May I ask a few quick questions?"`,
  q1: `"What's your current age?" → 45+ = PIE candidate. Under 45 = recommend SMILE/LASIK/EVO ICL`,
  q2: `"What bothers you most - distance vision, reading up close, or both?" → Reading/Both = PIE ideal`,
  q3: `"Have you been told you have early cataracts?" → Yes = PIE prevents cataracts!`,
  q4: `"Are you tired of constantly reaching for readers at restaurants, checking your phone, reading labels?" → Builds pain points`,
  recommendation: `"Based on what you've shared, you sound like an EXCELLENT candidate for PIE - Presbyopic Implant in Eye. Dr. Khanna literally wrote the book on this! Here's what makes PIE special: • It's the ONLY procedure that prevents cataracts - you'll never need cataract surgery • See clearly at ALL distances - near, middle, AND far • 5-10 minute procedure, awake the whole time, completely painless • Most patients drive and work the NEXT DAY • Dr. Khanna has 30+ years experience and has done 25,000+ procedures"`,
  booking: `"Let me check Dr. Khanna's schedule... I have Tuesday at 10 AM or Thursday at 2 PM. Many patients prefer morning appointments so they have the rest of the day. Which works better?"`,
  hesitant: `"The consultation is completely FREE - a $400 value - and there's absolutely no obligation. You'll get a comprehensive eye exam using the most advanced diagnostic technology in Southern California, and Dr. Khanna personally answers all your questions. Even if you decide it's not for you, you'll walk away with valuable information about your eye health."`
};

/** Full Day 0 script for VAPI + staff fallback emails */
function formatDay0CallScript(fullName) {
  const name = firstNameFrom(fullName);
  const s = DAY0_CALL_SCRIPT_SECTIONS;
  return `🎯 PIE Initial Call Script

OPENING:
${s.opening.replace(/\[Name\]/g, name)}

QUALIFICATION Q1:
${s.q1}

QUALIFICATION Q2:
${s.q2}

QUALIFICATION Q3:
${s.q3}

QUALIFICATION Q4:
${s.q4}

PIE RECOMMENDATION:
${s.recommendation}

BOOKING CLOSE:
${s.booking}

IF HESITANT:
${s.hesitant}`;
}

function smsBody(key, fullName) {
  return interpolate(STAGE1_SMS[key], { name: firstNameFrom(fullName) });
}

function day5Email(fullName) {
  const name = firstNameFrom(fullName);
  return {
    subject: interpolate(DAY5_EMAIL_SUBJECT, { name }),
    text: interpolate(DAY5_EMAIL_BODY, { name })
  };
}

module.exports = {
  firstNameFrom,
  smsBody,
  day5Email,
  DAY7_CALL_SCRIPT,
  DAY0_CALL_SCRIPT_SECTIONS,
  PIE_CALL_AGENT_NAME,
  formatDay0CallScript
};
