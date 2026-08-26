function firstNameFrom(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'there';
}

function interpolate(template, vars) {
  return String(template).replace(/\[Name\]/g, vars.name || 'there');
}

const LINKS = {
  welcome: process.env.SMILE_URL_WELCOME || 'https://khannainstitute.com/smile-book-consultation/',
  explainer: process.env.SMILE_URL_EXPLAINER || 'https://khannainstitute.com/smile-laser-eye-surgery/',
  drKhanna: process.env.SMILE_URL_DR_KHANNA || 'https://khannainstitute.com/about/dr-khanna/biography/',
  testimonials: process.env.SMILE_URL_TESTIMONIALS || 'https://khannainstitute.com/smile-laser-eye-surgery/',
  vsLasik: process.env.SMILE_URL_VS_LASIK || 'https://khannainstitute.com/smile-laser-eye-surgery/',
  financing: process.env.SMILE_URL_FINANCING || 'https://khannainstitute.com/smile-cost/',
  book: process.env.SMILE_URL_BOOK || 'https://khannainstitute.com/smile-book-consultation/'
};

const PHONE = '(805) 230-2126';

const SMS = {
  a: {
    day0: `[Name]! You're looking into SMILE? Smart move.

Here's the deal:
• 30 seconds per eye (not a typo)
• No flap — just a tiny 4mm opening
• Back to your life tomorrow
• From $99/mo financing
• Dr. Khanna literally wrote the book on this

FREE consult — we even have free parking 😊
Westlake Village (no LA traffic!)
Watch: ${LINKS.explainer}
${PHONE}`,

    day1: `[Name], quick math:

Your contacts: ~$50/month
Over 10 years: $6,000+
SMILE: one time, done forever
From $99/mo with 0% APR

Plus you're saving TIME:
→ No morning contact routine
→ No dry eyes after screen marathons
→ No backup glasses "just in case"

Watch real patients: ${LINKS.testimonials}
${PHONE} — Westlake Village`,

    day3: `[Name], SMILE vs LASIK — the real tea:

LASIK = 20mm flap cut into your cornea
SMILE = 4mm keyhole (80% smaller!)

Why it matters:
• 80% less dry eye
• Stronger cornea after
• Better for active lifestyles
• Same 20/20 results

Dr. Khanna does both — he'll tell you which is better for YOU (free consult)

See the difference: ${LINKS.vsLasik}
Ventura County? We're 15 min away.`
  },
  b: {
    day0: `hey [Name] — so you're over contacts/glasses? same tbh

quick facts about SMILE:
→ takes 30 sec per eye (not a typo)
→ no cutting a flap like LASIK
→ dry eye? way less with SMILE
→ back to screens by tmrw

we're in westlake village btw — free parking, no LA traffic, in and out

consult is free, no pressure
interested? ${LINKS.welcome}
or just reply here`,

    day1: `[Name] — random thought

how much time do you spend on contacts every day? 5 min morning, dealing with dry eyes, carrying solution everywhere...

multiply that by like 10 years

SMILE patients wake up seeing 20/20. that's it. no routine.

and yeah it sounds expensive but it's actually cheaper than contacts long-term + we do 0% financing

no pressure but wanted to share: ${LINKS.testimonials}`,

    day3: `ok [Name] so you might be wondering SMILE vs LASIK

the tldr:
LASIK cuts a big flap (20mm)
SMILE is keyhole (4mm)

both work, but SMILE = less dry eye + stronger cornea after

if you're into fitness, sports, or just don't want dry eyes from screens... SMILE is probably the move

dr. khanna does both and he's honest about which is better for each person

explained here: ${LINKS.vsLasik}`
  }
};

function smsBody(variant, dayKey, fullName) {
  const v = variant === 'b' ? 'b' : 'a';
  const tpl = SMS[v][dayKey];
  if (!tpl) return '';
  return interpolate(tpl, { name: firstNameFrom(fullName) });
}

function day5Email(fullName) {
  const name = firstNameFrom(fullName);
  const subject = `${name}, your vision without the daily hassle`;
  const text = `Hey ${name},

Still thinking about ditching glasses/contacts? Here's the full breakdown:

WHAT IS SMILE?
Small Incision Lenticule Extraction — a laser creates a tiny disc inside your cornea and removes it through a 4mm opening. No flap. About 30 seconds per eye.

WHY GEN Z IS CHOOSING SMILE:
• Screen life friendly — 80% less dry eye than LASIK
• Active lifestyle ready — gym, hiking, surfing
• Zero downtime — most people work next day
• One and done — stop paying $50/mo for contacts

THE MONEY PART:
SMILE from $3,600/eye (specials available)
0% APR financing from $99/month
HSA/FSA accepted

WESTLAKE VILLAGE:
Ventura County (Thousand Oaks, Simi, Camarillo, Moorpark, Oxnard) — we're right here. No LA traffic. Free parking.

31824 Village Center Rd #F, Westlake Village, CA 91361

WATCH THESE:
→ Welcome + parking: ${LINKS.welcome}
→ SMILE explained: ${LINKS.explainer}
→ Meet Dr. Khanna: ${LINKS.drKhanna}
→ Real patients: ${LINKS.testimonials}

NEXT STEP:
Free consultation — comprehensive exam + all your questions answered, no pressure.
Book: ${PHONE} or ${LINKS.book}

The Khanna Vision Team

P.S. Dr. Khanna literally wrote the book on SMILE. You're in good hands.`;
  return { subject, text };
}

const DAY7_CALL_SCRIPT = `Hey [Name]! This is [Agent] from Dr. Khanna's office — you were looking into SMILE a few days ago. How's it going? Do you have a sec?

LISTEN for: screen time dry eyes, gym/sports hassle, contact cost, glasses hiding their face.

KEY POINTS:
• 30 seconds per eye, back to screens tomorrow
• 80% less dry eye than LASIK
• From $99/mo financing
• Westlake Village — free parking, no LA traffic (15 min from Ventura County)

CLOSE: "Want to grab a free consult? We have [DATE] open — morning or afternoon better?"

If not ready: "No pressure — can I text you a couple patient videos? ${LINKS.testimonials}"

Phone: ${PHONE}`;

function formatDay7CallScript(fullName) {
  return DAY7_CALL_SCRIPT.replace(/\[Name\]/g, firstNameFrom(fullName)).replace(/\[Agent\]/g, 'Sarah');
}

module.exports = {
  LINKS,
  PHONE,
  smsBody,
  day5Email,
  formatDay7CallScript,
  firstNameFrom
};
