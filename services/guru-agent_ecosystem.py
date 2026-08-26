"""
KVI multi-agent routing (v3-style): Brandi triage → specialist agents.
Used by /vapi/webhook when KVI_MULTI_AGENT is enabled.

Session is in-memory per call id (same as booking_sessions pattern).
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

AGENT_IDS = frozenset(
    {"brandi", "guru", "max", "lucy", "rose", "kate", "sage", "buffet", "barbie", "jill"}
)

BRANDI_WELCOME = (
    "Hi! I'm Brandi with Khanna Vision Institute — welcome. "
    "What vision question can I help you with today?"
)

JILL_HUMAN_MSG = (
    "I'll get you to a real person on our team. "
    "For the fastest help, call Khanna Vision Institute at (805) 230-2126 "
    "or text (818) 857-1735. If you were told to reach Jill, mention that and the front desk will route you."
)

JILL_MINOR_MSG = (
    "Thanks for sharing that. For patients under 18, we take extra care with vision-correction planning. "
    "Please have a parent or guardian call us at (805) 230-2126 so we can guide you appropriately."
)


def init_eco_session() -> Dict[str, Any]:
    return {
        "phase": "brandi",        # brandi | specialist
        "active_agent": "brandi",
        "age": None,
        "name": None,
        "brandi_phase": "open",   # open | done
        "brandi_prompts": 0,
    }


_NAME_SKIP = {
    'hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'please',
    'book', 'want', 'need', 'help', 'appointment', 'schedule', 'consultation',
    'info', 'information', 'an', 'a', 'the', 'i', 'me', 'my', 'we', 'our',
    'smile', 'lasik', 'cost', 'price', 'financing', 'finance', 'surgery',
}


def _extract_brandi_name(msg: str) -> Optional[str]:
    m = re.search(
        r"(?:my name is|i'?m called|call me|this is|i am|i'?m)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)",
        msg, re.IGNORECASE
    )
    if m:
        candidate = m.group(1).strip()
        words = candidate.lower().split()
        if not any(w in _NAME_SKIP for w in words):
            return candidate.title()

    words = msg.strip().split()
    if 1 <= len(words) <= 2 and all(re.match(r'^[A-Za-z]+$', w) for w in words):
        if not any(w.lower() in _NAME_SKIP for w in words):
            return msg.strip().title()

    return None


def extract_age_quick(text: str) -> Optional[int]:
    if not text or not isinstance(text, str):
        return None
    pats = [
        r"(?:i'?m|i am|age|aged)\s+(\d{1,3})\s*(?:years?|y\/o|yo)?",
        r"\b(?:age|aged)\s*[:\s]\s*(\d{1,3})\b",
        r"\b(\d{1,3})\s*(?:years?\s*old)\b",
        r"^(\d{1,3})$",
    ]
    for pat in pats:
        m = re.search(pat, text.strip(), re.IGNORECASE)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 110:
                return n
    return None


def specialist_override(message: str) -> Optional[str]:
    t = (message or "").lower()
    provider = (
        "i'm dr", "i am dr", "i'm doctor", "i am doctor",
        "i'm an optometrist", "i am an optometrist",
        "i'm an ophthalmologist", "i am an ophthalmologist",
        "i'm a doctor", "i am a doctor",
        "refer my patient", "referring my patient", "referring a patient",
        "patient referral", "referral from", "send my patient", "sending my patient",
        "co-management", "comanagement", "co manage", "co-manage", "for a referral",
        "lasik evaluation", "smile evaluation", "icl evaluation", "surgical evaluation",
        "pre-op referral", "pre op referral",
    )
    cornea = (
        "keratoconus", "cornea", "corneal", "cross-linking", "crosslinking", " cxl", "ctak",
        "told i wasn't a candidate", "told i'm not a candidate", "told no", "not a candidate",
        "too thin", "ectasia", "irregular astigmatism", "thin cornea", "dry eyes",
        "pterygium", "chalazion",
    )
    concierge = (
        "post-op", "post op", "postop", "after my surgery", "after surgery",
        "had surgery", "had lasik", "had smile", "had icl",
        "follow up", "follow-up", "followup", "recovery question", "recovering from",
        "my recovery", "concierge", "healing", "halos", "blurry after",
        "vision after surgery", "drop schedule", "eye drops after",
    )
    finance = (
        "finance", "financing", "monthly payment", "alphaeon", "alphaon",
        "carecredit", "care credit", "loan", "afford", "payment plan",
        "how much", "cost", "price", "pricing", "what does it cost",
        "how much is", "how much does", "fsa", "hsa",
        "insurance cover", "does insurance", "will my insurance", "out of pocket",
    )
    if any(p in t for p in provider):
        return "barbie"
    if any(p in t for p in cornea):
        return "kate"
    if any(p in t for p in concierge):
        return "sage"
    if any(p in t for p in finance):
        return "buffet"
    return None


def topic_agent(message: str) -> Optional[str]:
    """Route by procedure/topic before age is known."""
    ov = specialist_override(message)
    if ov:
        return ov
    t = (message or "").lower()
    if any(k in t for k in ("smile", "evo icl", "evo-icl", "implantable lens", " phakic", " icl")):
        return "guru"
    if any(k in t for k in ("lasik", "superlasik", "super lasik", "prk", "asa ")):
        return "max"
    if any(k in t for k in ("pie", "presbyop", "reading glasses", "cataract", "presbyopic")):
        return "rose"
    if any(k in t for k in ("dry eye", "screen fatigue", "contacts", "glasses", "blurry")):
        return "lucy"
    return None


def _is_substantive(msg: str) -> bool:
    if topic_agent(msg):
        return True
    t = (msg or "").lower()
    needles = (
        "vision", "procedure", "surgery", "candidate", "consult", "consultation",
        "appointment", "book", "schedule", "recovery", "doctor", "khanna", "institute",
        "eye", "laser", "implant", "night vision", "downtime",
    )
    return any(n in t for n in needles)


def demographic_agent(age: int) -> str:
    if age < 18:
        return "jill"
    if 18 <= age <= 28:
        return "guru"
    if 29 <= age <= 43:
        return "max"
    if 44 <= age <= 59:
        return "lucy"
    return "rose"


def _wants_human(message: str) -> bool:
    t = (message or "").lower()
    needles = (
        "real person", "human being", "speak to a person", "talk to a person",
        "talk to someone real", "get me a human", "live agent", "actual person",
    )
    return any(n in t for n in needles)


def _is_age_only(msg: str) -> bool:
    return bool(re.match(r"^\s*\d{1,3}\s*$", msg))


def _pick_agent(sess: Dict[str, Any], msg: str) -> str:
    topic = topic_agent(msg)
    if topic:
        return topic
    age = sess.get("age")
    if isinstance(age, int):
        return demographic_agent(age)
    return "brandi"


def _route_to_specialist(sess: Dict[str, Any], agent: str) -> Tuple[Optional[str], str]:
    sess["phase"] = "specialist"
    sess["active_agent"] = agent
    sess["brandi_phase"] = "done"
    return (None, agent)


def _route_by_age(sess: Dict, age: int, msg: str) -> Tuple[Optional[str], str]:
    sess["age"] = age
    if age < 18:
        sess["phase"] = "specialist"
        sess["active_agent"] = "jill"
        sess["brandi_phase"] = "done"
        return (JILL_MINOR_MSG, "jill")
    agent = demographic_agent(age)
    sess["active_agent"] = agent
    sess["phase"] = "specialist"
    sess["brandi_phase"] = "done"
    patient_name = sess.get("name", "")
    greeting = f"Great, {patient_name}! " if patient_name else "Great! "
    if _is_age_only(msg):
        reply = (
            f"{greeting}I'm connecting you with {agent_display_name(agent)}, "
            f"who specializes in vision options for your age group. "
            f"What would you like to know?"
        )
        return (reply, agent)
    return (None, agent)


def eco_turn(sess: Dict[str, Any], message: str) -> Tuple[Optional[str], str]:
    """
    Returns (early_reply_text_or_none, agent_id_for_llm).
    When early_reply is not None, webhook should return it without RAG/LLM.
    """
    msg = (message or "").strip()

    if _wants_human(msg):
        return (JILL_HUMAN_MSG, "jill")

    ov = specialist_override(msg)
    if ov:
        return _route_to_specialist(sess, ov)

    if sess.get("phase") == "specialist":
        agent = sess.get("active_agent") or "brandi"
        if agent not in AGENT_IDS:
            agent = "brandi"
        return (None, agent)

    brandi_phase = sess.get("brandi_phase", "open")
    age_hit = extract_age_quick(msg)
    if age_hit is not None:
        sess["age"] = age_hit

    name = _extract_brandi_name(msg)
    if name:
        sess["name"] = name

    if topic_agent(msg) or _is_substantive(msg):
        agent = _pick_agent(sess, msg)
        if age_hit is not None and not topic_agent(msg):
            return _route_by_age(sess, age_hit, msg)
        return _route_to_specialist(sess, agent)

    if age_hit is not None:
        return _route_by_age(sess, age_hit, msg)

    if name:
        sess["brandi_phase"] = "open"
        return (
            f"Nice to meet you, {name}! What vision question can I help with today?",
            "brandi",
        )

    prompts = int(sess.get("brandi_prompts") or 0)
    if prompts == 0:
        sess["brandi_prompts"] = 1
        sess["brandi_phase"] = "open"
        return (BRANDI_WELCOME, "brandi")

    sess["brandi_phase"] = "open"
    sess["phase"] = "specialist"
    sess["active_agent"] = "brandi"
    return (None, "brandi")


def agent_display_name(agent_id: str) -> str:
    names = {
        "brandi": "Brandi",
        "guru": "Guru",
        "max": "Max",
        "lucy": "Lucy",
        "rose": "Rose",
        "kate": "Kate",
        "sage": "Sage",
        "buffet": "Buffett",
        "barbie": "Barbie",
        "jill": "Jill",
    }
    return names.get(agent_id, agent_id.title())
