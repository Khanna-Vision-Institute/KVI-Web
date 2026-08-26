function firstNameFrom(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'there';
}

function interpolate(template, vars) {
  return String(template)
    .replace(/\[FIRST NAME\]/gi, vars.name || 'there')
    .replace(/\[Name\]/gi, vars.name || 'there');
}

const BOOK_URL = process.env.PTERYGIUM_URL_BOOK || 'https://khannainstitute.com/contact/schedule-consultation/';
const PHONE_BH = '(310) 482-1240';
const PHONE_WL = '(805) 230-2126';

const SMS = {
  day0: `Hi [FIRST NAME]! 👋 Thanks for reaching out to Khanna Vision about your pterygium.

That growth on your eye? We can remove it AND restore a beautiful, natural-looking eye.

Dr. Khanna uses the gold-standard "glued autograft" technique — NO stitches, lowest recurrence rate (<5%), best cosmetic outcome.

When works for your FREE evaluation?
📅 Book now: ${BOOK_URL}
📞 Or call: ${PHONE_BH}`,

  day1: `[FIRST NAME], quick facts about pterygium:

⚠️ It GROWS over time
⚠️ The bigger it gets, the harder to remove
⚠️ Can cause permanent vision problems
⚠️ Old techniques have 40%+ recurrence

✅ Dr. Khanna's glued autograft: <5% recurrence
✅ No stitches = faster healing
✅ Eye looks completely natural after

Don't wait until it covers your pupil!

FREE evaluation: ${PHONE_BH}`,

  day2: `Tired of people asking "what's wrong with your eye?" 😔

[FIRST NAME], after pterygium removal with Dr. Khanna:

✨ Eye looks completely normal
✨ No more red/pink growth
✨ No visible scarring
✨ Comfortable again — no irritation

Our patients say they feel like themselves again!

📸 See before/after photos at your FREE consult
📞 ${PHONE_BH}`,

  day3: `[FIRST NAME], not all pterygium surgeries are equal!

OLD method (stitches):
❌ Painful, 2+ weeks irritation, higher recurrence

Dr. Khanna's GLUED AUTOGRAFT:
✅ Fibrin glue — biological, no stitches
✅ Your own tissue = perfect match
✅ Healing in days, not weeks
✅ Lowest recurrence worldwide

Book your evaluation: ${PHONE_BH}`,

  day5: `[FIRST NAME], good news about pterygium surgery:

💰 Often COVERED by insurance!
(It's medically necessary when affecting vision or causing symptoms)

✅ We verify your benefits FREE
✅ Financing available if needed
✅ HSA/FSA accepted

Let's check your coverage: ${PHONE_BH}`,

  day7: `[FIRST NAME], real pterygium patients share:

⭐⭐⭐⭐⭐ "Dr. Khanna removed it in 30 minutes. My eye looks perfect now!" - Michael R.

⭐⭐⭐⭐⭐ "As a surfer, I thought this was just part of life. Now my eye is clear and comfortable!" - Jason T.

⭐⭐⭐⭐⭐ "No stitches meant I was back to work in 3 days. Amazing!" - Linda M.

You deserve comfortable, beautiful eyes too!

FREE evaluation: ${PHONE_BH}`,

  day10: `[FIRST NAME], does your pterygium affect golf, water sports, work, or photos?

After Dr. Khanna's glued autograft surgery:
✅ No more squinting or sunglasses indoors
✅ Comfortable in any environment
✅ Confident in photos again
✅ Eye looks completely normal

Life's too short for pterygium problems!

${PHONE_BH} — FREE evaluation`,

  day14: `[FIRST NAME], final thought on your pterygium:

Every month you wait = it grows a little more.

Dr. Khanna has removed thousands of pterygia over 30+ years. His glued autograft technique is the gold standard.

When you're ready, we're here:
📞 ${PHONE_BH}
📅 ${BOOK_URL}

No pressure — just don't want you to look back and wish you'd acted sooner! 💙`
};

function smsBody(dayKey, fullName) {
  const tpl = SMS[dayKey];
  if (!tpl) return '';
  return interpolate(tpl, { name: firstNameFrom(fullName) });
}

function day3Email(fullName) {
  const name = firstNameFrom(fullName);
  const subject = `${name}, Your Complete Guide to Pterygium Removal`;
  const text = `Hi ${name},

Thanks for reaching out about your pterygium. I know that growth on your eye can be frustrating — both how it looks AND how it feels.

THE GOOD NEWS: Modern pterygium surgery can:
• Remove the growth completely
• Restore a natural-looking eye
• Prevent it from coming back (<5% recurrence with glued autograft)
• Get you back to normal in days, not weeks

WHY TECHNIQUE MATTERS:
Dr. Khanna's glued autograft uses your own conjunctival tissue secured with fibrin glue — no stitches, lowest recurrence, best cosmetic outcome.

WHAT TO EXPECT:
Consultation → 30-45 min surgery (awake, numbing drops) → back to work in 3-5 days → natural-looking eye

ABOUT INSURANCE:
Often covered when it causes symptoms, irritation, or affects vision. We verify benefits at no charge.

NEXT STEP — FREE pterygium evaluation:
📞 Beverly Hills: ${PHONE_BH}
📞 Westlake Village: ${PHONE_WL}
📅 Online: ${BOOK_URL}

Locations:
• Beverly Hills: 9100 Wilshire Blvd #265E
• Westlake Village: 31824 Village Center Rd F

Don't wait until it grows larger. The smaller the pterygium, the better the outcome.

The Khanna Vision Team

P.S. Dr. Khanna has performed 25,000+ procedures over 30+ years.`;
  return { subject, text };
}

const DAY5_CALL_SCRIPT = `Hi [Name], this is [Agent] from Khanna Vision Institute, Dr. Rajesh Khanna's office. I'm calling about your pterygium inquiry — how's your eye feeling today?

LISTEN & EMPATHIZE: redness, irritation, vision blur, self-consciousness.

EDUCATE: Glued autograft technique — no stitches, lowest recurrence, eye looks completely natural after.

URGENCY: Pterygium grows over time. The smaller it is when we remove it, the better the outcome.

CLOSE: Free evaluation — [DATE] morning or afternoon?

INSURANCE: Often covered — we'll verify benefits at no charge.

Phone: ${PHONE_BH}`;

const DAY7_CALL_SCRIPT = `Hi [Name], this is [Agent] from Dr. Khanna's office following up on your pterygium inquiry.

We had a patient whose pterygium had grown onto the cornea — earlier treatment would have meant simpler surgery and faster recovery.

How long have you had your pterygium? Have you noticed it changing?

CLOSE: Let's get you evaluated so you know exactly what you're dealing with. FREE evaluation — [DATE]?

Phone: ${PHONE_BH}`;

function formatCallScript(template, fullName) {
  return template.replace(/\[Name\]/g, firstNameFrom(fullName)).replace(/\[Agent\]/g, 'Sarah');
}

module.exports = {
  smsBody,
  day3Email,
  formatDay5CallScript: (n) => formatCallScript(DAY5_CALL_SCRIPT, n),
  formatDay7CallScript: (n) => formatCallScript(DAY7_CALL_SCRIPT, n),
  firstNameFrom
};
