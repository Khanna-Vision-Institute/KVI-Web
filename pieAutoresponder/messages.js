/**
 * Stage 1 copy from PIE_5Stage_Autoresponder_Complete (1).html
 */

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

Dr. Khanna (50,000+ procedures, author of "The Miracle of Pi in Eye") pioneered PIE surgery - it's like cataract surgery BUT better.

FREE Consultation: Call (310) 482-1240 or reply YES!

📍 Beverly Hills & Westlake Village`,

  day1: `[Name], meet the surgeon behind PIE! 📚

Dr. Rajesh Khanna:
✅ 34+ years in vision correction
✅ 50,000+ successful procedures
✅ Author of "The Miracle of Pi in Eye"
✅ Beverly Hills' trusted eye surgeon
✅ Featured in Beverly Hills Times

Watch: khannainstitute.com/pie-video

Ready? Call (310) 482-1240`,

  day2: `[Name], imagine your life AFTER PIE: 🌟

📖 Reading menus without squinting
📱 Checking texts without searching for glasses
🏌️ Golf scorecard - crystal clear
💻 Computer AND distance - no more switching
✈️ Travel without packing 3 pairs of glasses

PIE patients say: "I feel 20 years younger!"

Book FREE consult: (310) 482-1240`,

  day3: `[Name], why patients choose PIE over other options:

❌ Reading glasses - Lost, scratched, embarrassing
❌ Progressives - Headaches, limited vision zones
❌ Contacts - Dry eyes, infections, daily hassle
❌ LASIK - Doesn't fix reading vision after 45

✅ PIE - ONE procedure, ALL distances, PREVENTS cataracts!

"Why didn't I do this sooner?" - Every PIE patient

Schedule: (310) 482-1240`,

  day10: `[Name], real PIE patient stories:

⭐⭐⭐⭐⭐ "At 58, I feel 30 again. No more patting my pockets for readers!" - Michael T.

⭐⭐⭐⭐⭐ "As a surgeon myself, I trusted only Dr. Khanna. Best decision ever." - Dr. Sarah M.

⭐⭐⭐⭐⭐ "Golf, tennis, computer work - ALL crystal clear!" - Robert K.

Join 50,000+ happy patients!

FREE consult: (310) 482-1240`,

  day14: `[Name], just checking in one last time! 👓

The average person reaches for reading glasses 15x/day. That's 5,475 times per year.

PIE changes that to ZERO.

Still thinking? Let's chat! Dr. Khanna answers all questions personally during your FREE consultation.

(310) 482-1240 - We're here when you're ready!`
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
• Compare to: 20+ years of progressive lenses ($200-600/year = $4,000-$12,000)

🏆 WHY DR. KHANNA?
• Author of "The Miracle of Pi in Eye"
• 50,000+ procedures performed
• 34+ years experience
• Beverly Hills's premier vision specialist
• Featured expert for celebrity patients

📅 YOUR NEXT STEP:
FREE consultation includes:
✓ Comprehensive eye exam ($400 value)
✓ Advanced diagnostic testing
✓ Personal meeting with Dr. Khanna
✓ Custom treatment plan
✓ Financing options review

Schedule now: (310) 482-1240 or reply to this email

To clearer vision,
The Khanna Vision Team

P.S. Ask about our "Refer a Friend" program - earn $500 for each friend who has PIE!`;

const DAY7_CALL_SCRIPT =
  'Hi [Name], this is [Agent] from Dr. Khanna\'s office following up. I wanted to let you know that Dr. Khanna has limited availability this month, and I\'d hate for you to miss out on our current promotion. If you book your consultation this week and proceed with PIE, you\'ll save $500 per eye. Are you still interested in getting rid of those reading glasses for good?';

const DAY0_CALL_SCRIPT_SECTIONS = {
  opening:
    "Hi [Name], this is [Agent] from Dr. Khanna's office at Khanna Vision Institute. I see you're interested in vision correction - specifically getting rid of those reading glasses! I'd love to help you explore if PIE is right for you. May I ask a few quick questions?",
  q1: "What's your current age? → 45+ = PIE candidate. Under 45 = recommend SMILE/LASIK/EVO ICL",
  q2: 'What bothers you most - distance vision, reading up close, or both? → Reading/Both = PIE ideal',
  q3: 'Have you been told you have early cataracts? → Yes = PIE prevents cataracts!',
  q4: 'Are you tired of constantly reaching for readers at restaurants, checking your phone, reading labels?',
  recommendation: `Based on what you've shared, you sound like an EXCELLENT candidate for PIE. Dr. Khanna literally wrote the book on this. PIE is the ONLY procedure that prevents cataracts, see clearly at ALL distances, 5-10 minute painless procedure, most patients drive and work the NEXT DAY. Dr. Khanna has 34+ years and 50,000+ procedures.`,
  booking:
    "Let me check Dr. Khanna's schedule... I have Tuesday at 10 AM or Thursday at 2 PM. Which works better?",
  hesitant:
    "The consultation is completely FREE - a $400 value - and there's absolutely no obligation. You'll get a comprehensive eye exam and Dr. Khanna personally answers all your questions."
};

const OBJECTION_MATRIX = [
  {
    objection: "I'm too old for eye surgery",
    response:
      "Actually, you're NEVER too old for PIE! Dr. Khanna has successfully performed PIE on patients in their 90s. Age is just a number - what matters is your eye health, and that's exactly what we'll evaluate at your free consultation."
  },
  {
    objection: "My vision isn't that bad yet",
    response:
      "That's actually the BEST time to consider PIE! The procedure works best before cataracts develop. Plus, PIE is the only procedure that PREVENTS cataracts - so you're essentially getting ahead of the curve."
  },
  {
    objection: '$5,000-$8,000 is too expensive',
    response:
      "I understand. But consider this: progressive lenses cost $300-600 per year, contacts even more. Over 20 years, that's $6,000-$12,000+ PLUS the daily hassle. PIE is a one-time investment for lifetime results. We also offer 0% APR financing starting at $199/month."
  },
  {
    objection: "I've heard about halos and glare",
    response:
      'Great question! Modern presbyopic implants have advanced significantly. Dr. Khanna personally selects from 5 different implant types to match YOUR specific lifestyle. Most patients adapt within 2-4 weeks.'
  },
  {
    objection: 'Why not just wait for cataracts?',
    response:
      'Because PIE is SO much more than cataract surgery! Standard cataract surgery gives you ONE focal point - you\'ll still need glasses. PIE gives you clear vision at ALL distances AND prevents cataracts.'
  },
  {
    objection: "I'm scared of eye surgery",
    response:
      "That's completely normal! The procedure takes just 5-10 minutes, you're awake with numbing drops (no pain), and most patients say 'That's it?' afterward. Dr. Khanna's 50,000+ successful procedures speak to his safety record."
  }
];

function smsBody(key, fullName) {
  const name = firstNameFrom(fullName);
  return interpolate(STAGE1_SMS[key], { name });
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
  OBJECTION_MATRIX,
  STAGE1_SMS
};
