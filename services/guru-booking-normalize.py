"""Normalize voice/chat booking fields before POST to KVI booking API."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, Optional


def normalize_location(location: Any) -> str:
    t = str(location or "").strip().lower()
    if not t:
        return ""
    if "beverly" in t:
        return "Beverly Hills"
    if "westlake" in t:
        return "Westlake Village"
    if t in ("online", "virtual"):
        return "Online"
    return str(location).strip()


def normalize_date_to_iso(date_val: Any) -> Optional[str]:
    raw = str(date_val or "").strip()
    if not raw:
        return None
    raw = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", raw, flags=re.IGNORECASE)

    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    mdy = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if mdy:
        mm, dd, yy = int(mdy.group(1)), int(mdy.group(2)), int(mdy.group(3))
        try:
            datetime(yy, mm, dd)
            return f"{yy:04d}-{mm:02d}-{dd:02d}"
        except ValueError:
            return None

    for fmt in (
        "%B %d, %Y",
        "%b %d, %Y",
        "%B %d %Y",
        "%b %d %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def normalize_booking_payload(data: Dict[str, Any], *, page_url: Optional[str] = None) -> Dict[str, Any]:
    out = dict(data or {})
    if out.get("location"):
        out["location"] = normalize_location(out["location"])
    iso = normalize_date_to_iso(out.get("date"))
    if iso:
        out["date"] = iso
    if page_url and not out.get("pageUrl"):
        out["pageUrl"] = page_url
    if out.get("phone"):
        out["phone"] = str(out["phone"]).strip()
    if out.get("email"):
        out["email"] = str(out["email"]).strip()
    if out.get("fullName"):
        out["fullName"] = str(out["fullName"]).strip()
    return out
