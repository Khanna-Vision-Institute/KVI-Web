const {
  DAY0_CALL_SCRIPT_SECTIONS,
  DAY7_CALL_SCRIPT,
  formatDay0CallScript,
  firstNameFrom,
  PIE_CALL_AGENT_NAME
} = require('./messages');

const OBJECTION_MATRIX = [
  [
    "I'm too old for eye surgery",
    "Actually, you're NEVER too old for PIE! Dr. Khanna has successfully performed PIE on patients in their 90s."
  ],
  [
    "My vision isn't that bad yet",
    "That's actually the BEST time to consider PIE! The procedure works best before cataracts develop. Plus, PIE is the only procedure that PREVENTS cataracts."
  ],
  [
    '$5,000-$8,000 is too expensive',
    'Compare to 20 years of glasses; we offer 0% APR financing starting at $199/month.'
  ],
  [
    "I've heard about halos and glare",
    'Dr. Khanna personally selects from 5 different implant types to match YOUR lifestyle.'
  ],
  [
    'Why not just wait for cataracts?',
    'PIE gives clear vision at ALL distances AND prevents cataracts — standard cataract surgery still needs glasses.'
  ],
  [
    "I'm scared of eye surgery",
    "The procedure takes 5-10 minutes, you're awake with numbing drops, and most patients say 'That's it?' afterward."
  ]
];

function buildPieStage1SystemPrompt(lead = {}) {
  const name = firstNameFrom(lead.fullName);
  const script = formatDay0CallScript(lead.fullName);
  const objections = OBJECTION_MATRIX.map(([o, r]) => `If "${o}" → ${r}`).join('\n');

  return `You are ${PIE_CALL_AGENT_NAME}, a warm patient coordinator at Khanna Vision Institute on an outbound phone call about PIE (Presbyopic Implant in Eye). Follow this script closely. Stage: lead_to_consultation.

Lead: ${name}, age ${lead.age || 'unknown'}, preferred location ${lead.location || 'Beverly Hills or Westlake Village'}, consult ${lead.date || ''} ${lead.time || ''}.

${script}

OBJECTION HANDLING:
${objections}

Rules:
- Introduce yourself as ${PIE_CALL_AGENT_NAME} from Dr. Khanna's office.
- Goal: book a FREE consultation.
- Primary callback number: (805) 230-2126. Westlake Village: (805) 230-2126. Beverly Hills: (310) 482-1240.
- If they want to stop calls/texts, apologize and confirm opt-out.`;
}

function buildPieDay7SystemPrompt(lead = {}) {
  const name = firstNameFrom(lead.fullName);
  return `You are ${PIE_CALL_AGENT_NAME} from Dr. Khanna's office at Khanna Vision Institute.

${DAY7_CALL_SCRIPT.replace(/\[Name\]/g, name).replace(/\[Agent\]/g, PIE_CALL_AGENT_NAME)}

Offer $500 savings per eye if they book consultation this week. Phone: (805) 230-2126.`;
}

module.exports = {
  buildPieStage1SystemPrompt,
  buildPieDay7SystemPrompt
};
