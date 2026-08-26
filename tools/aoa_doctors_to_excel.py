"""
Export AOA "Find a Doctor" results to Excel (or CSV).

Setup (once) — Homebrew Python blocks global pip (PEP 668). Use a venv in this folder:

  cd .../tools    # folder containing this script
  python3 -m venv .venv
  source .venv/bin/activate
  python3 -m pip install playwright pandas openpyxl

Browsers (Playwright):
  One-time in your venv:

    python3 -m playwright install firefox webkit chromium

  On **macOS**, the script **tries Firefox → WebKit → Chromium** (Chromium-first used to segfault on
  some machines before Python could fall back). Pin a single engine with ``export AOA_PW_BROWSER=firefox``.
  Use Google Chrome’s copy only if you insist: ``export AOA_PW_BROWSER=chrome``.

If ``playwright install`` fails with ENOSPC (“no space left on device”), free disk space first.

**Python version:** Prefer **Python 3.11 or 3.12**. On **Python 3.13**, Playwright sometimes **segfaults** the
instant the driver starts (before you see “Launching …”). Fix: recreate the venv with 3.12, e.g.

  brew install python@3.12
  cd .../tools && rm -rf .venv
  /opt/homebrew/bin/python3.12 -m venv .venv && source .venv/bin/activate
  pip install -U playwright pandas openpyxl && python -m playwright install firefox webkit chromium

Smoke-check Playwright alone:

  python3 aoa_playwright_smoke_test.py

Usage (after `source .venv/bin/activate`):

  python3 aoa_doctors_to_excel.py

Or without activating: `.venv/bin/python aoa_doctors_to_excel.py`

If `python3` is not found, install Python from https://www.python.org/downloads/
  or run: brew install python

Notes:
  - Be polite: small delays between pages. Heavy automation may be blocked.
  - Check aoa.org terms of use for your use case (especially marketing lists).
  - **Segfault on macOS** (zsh prints `segmentation fault`) happens **inside Playwright / the browser binary** —
    Python cannot catch it.
    Typical fixes **in order**:
      1) ``pip install -U playwright`` then ``python3 -m playwright install firefox webkit chromium``
      2) On **macOS**, the script defaults to **Firefox → WebKit → Chromium** so a bad Chromium build
         is not hit first. Pin with ``export AOA_PW_BROWSER=firefox`` if you want to skip others.
      3) Run **headed**: ``export AOA_PW_HEADED=1`` (sometimes avoids GPU/headless crashes).
      4) Prefer a **Python 3.12** venv if 3.13 still misbehaves with native wheels.
  - **Expanding radius:** each office ZIP is searched at 5 → 10 → 25 → 50 Miles (AOA’s **smallest
    option is usually 5 mi — there is no true 2 mi dropdown** on the public site). Rows are tagged
    with ``search_anchor_label`` / ``search_radius_miles``.
  - **Deduping:** merges all runs, then for the same doctor prefers **Westlake (91361)** search center
    **over Beverly Hills (90212)** so Conejo-area ODs aren’t “stolen” into the BH column; **then**
    prefers the **smallest radius** among ties. A second file keeps only rows anchored on 91361.
"""

from __future__ import annotations

import faulthandler
import os
import re
import sys
import time
from pathlib import Path

faulthandler.enable(all_threads=True)

import pandas as pd
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

AOA_URL = "https://www.aoa.org/healthy-eyes/find-a-doctor"

# Add 50-mile sweeps from many other ZIP centers (very long runtime). Turn on only when you need the
# full county scaffold — day-to-day lead gen should rely on expanding radii around the khanna ZIPs below.
COVER_LA_AND_VENTURA_COUNTIES = False

DISTANCE_WIDE = "50 Miles"

# Ordered smallest → largest — must match strings in the AOA distance <select>.
OFFICE_EXPAND_RADII: list[str] = ["5 Miles", "10 Miles", "25 Miles", "50 Miles"]

# Westlake is the primary market for this export — must win duplicate rows over Beverly Hills scans.
PRIMARY_DEDUPE_OFFICE_ZIP = "91361"
SECONDARY_DEDUPE_OFFICE_ZIP = "90212"

# Khanna practice ZIPs — **Westlake listed first** so raw pagination hits the Conejo center before BH.
KHANNA_OFFICE_CENTERS: list[dict[str, str]] = [
    {
        "office_id": "wv_village_ctr",
        "anchor_label": "Khanna WV (31824 Village Center Rd F / 91361)",
        "city": "Westlake Village",
        "state": "CA",
        "zip": "91361",
    },
    {
        "office_id": "bh_wilshire",
        "anchor_label": "Khanna BH (9100 Wilshire Ste 265E / 90212)",
        "city": "Beverly Hills",
        "state": "CA",
        "zip": "90212",
    },
]

EXTRA_ANCHOR_SEARCHES_LA_VENTURA: list[dict[str, str]] = [
    {"city": "Lancaster", "state": "CA", "zip": "93534", "distance_label": DISTANCE_WIDE},
    {"city": "Santa Clarita", "state": "CA", "zip": "91350", "distance_label": DISTANCE_WIDE},
    {"city": "Van Nuys", "state": "CA", "zip": "91401", "distance_label": DISTANCE_WIDE},
    {"city": "Glendale", "state": "CA", "zip": "91201", "distance_label": DISTANCE_WIDE},
    {"city": "Pasadena", "state": "CA", "zip": "91101", "distance_label": DISTANCE_WIDE},
    {"city": "Alhambra", "state": "CA", "zip": "91801", "distance_label": DISTANCE_WIDE},
    {"city": "Long Beach", "state": "CA", "zip": "90802", "distance_label": DISTANCE_WIDE},
    {"city": "Torrance", "state": "CA", "zip": "90503", "distance_label": DISTANCE_WIDE},
    {"city": "Inglewood", "state": "CA", "zip": "90301", "distance_label": DISTANCE_WIDE},
    {"city": "Los Angeles", "state": "CA", "zip": "90012", "distance_label": DISTANCE_WIDE},
    {"city": "Santa Monica", "state": "CA", "zip": "90401", "distance_label": DISTANCE_WIDE},
    {"city": "Woodland Hills", "state": "CA", "zip": "91367", "distance_label": DISTANCE_WIDE},
    {"city": "Calabasas", "state": "CA", "zip": "91302", "distance_label": DISTANCE_WIDE},
    {"city": "West Covina", "state": "CA", "zip": "91790", "distance_label": DISTANCE_WIDE},
    {"city": "Pomona", "state": "CA", "zip": "91766", "distance_label": DISTANCE_WIDE},
    {"city": "Norwalk", "state": "CA", "zip": "90650", "distance_label": DISTANCE_WIDE},
    {"city": "Ventura", "state": "CA", "zip": "93001", "distance_label": DISTANCE_WIDE},
    {"city": "Oxnard", "state": "CA", "zip": "93030", "distance_label": DISTANCE_WIDE},
    {"city": "Camarillo", "state": "CA", "zip": "93010", "distance_label": DISTANCE_WIDE},
    {"city": "Simi Valley", "state": "CA", "zip": "93065", "distance_label": DISTANCE_WIDE},
    {"city": "Thousand Oaks", "state": "CA", "zip": "91360", "distance_label": DISTANCE_WIDE},
]


def _search_center_preference_rank(center_zip: object) -> int:
    z = str(center_zip).strip()
    if z == PRIMARY_DEDUPE_OFFICE_ZIP:
        return 0
    if z == SECONDARY_DEDUPE_OFFICE_ZIP:
        return 1
    return 2


def radius_miles_from_label(label: str) -> int | None:
    m = re.match(r"^\s*(\d+)\s*Miles?\s*$", str(label).strip(), flags=re.I)
    return int(m.group(1)) if m else None


def build_expanding_office_search_queue() -> list[dict[str, str]]:
    q: list[dict[str, str]] = []
    for o in KHANNA_OFFICE_CENTERS:
        z = str(o["zip"]).strip()
        for dist in OFFICE_EXPAND_RADII:
            q.append(
                {
                    "city": o["city"],
                    "state": o["state"],
                    "zip": z,
                    "distance_label": dist,
                    "search_anchor_label": o["anchor_label"],
                    "search_center_zip": z,
                    "run_kind": "office_expanding_radius",
                }
            )
    return q


def _dedupe_zip_rows(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for e in entries:
        z = str(e["zip"]).strip()
        if z in seen:
            continue
        seen.add(z)
        out.append(dict(e))
    return out


def build_county_anchor_queue(office_zip_blocklist: set[str]) -> list[dict[str, str]]:
    extras: list[dict[str, str]] = []
    for row in EXTRA_ANCHOR_SEARCHES_LA_VENTURA:
        z = str(row["zip"]).strip()
        if z in office_zip_blocklist:
            continue
        extras.append(
            {
                "city": row["city"],
                "state": row["state"],
                "zip": z,
                "distance_label": row.get("distance_label", DISTANCE_WIDE),
                "search_anchor_label": f"County sweep ({row['city']})",
                "search_center_zip": z,
                "run_kind": "county_anchor_50mi",
            }
        )
    return _dedupe_zip_rows(extras)


def build_master_search_plan() -> list[dict[str, str]]:
    office_zip_blocklist = {str(o["zip"]).strip() for o in KHANNA_OFFICE_CENTERS}
    plan = build_expanding_office_search_queue()
    if COVER_LA_AND_VENTURA_COUNTIES:
        plan.extend(build_county_anchor_queue(office_zip_blocklist))
    return plan


SEARCHES = build_master_search_plan()

OUT_XLSX = Path(__file__).resolve().parent / "aoa_doctors_export.xlsx"
OUT_CSV = Path(__file__).resolve().parent / "aoa_doctors_export.csv"
# Same dedupe rules as the master file, filtered to rows whose winning search center is Westlake ZIP.
OUT_WESTLAKE_ANCHOR_XLSX = Path(__file__).resolve().parent / "aoa_doctors_westlake_anchor.xlsx"
OUT_WESTLAKE_ANCHOR_CSV = Path(__file__).resolve().parent / "aoa_doctors_westlake_anchor.csv"

PAGELOAD_WAIT_S = 2.0
BETWEEN_PAGES_S = 1.25
# Cooldown between completely different ZIP searches (after long pagination the site can be slow).
BETWEEN_SEARCHES_S = 15.0


def _between_search_pause_seconds(previous: dict[str, str] | None, current: dict[str, str]) -> float:
    """Shorter waits when iterating another radius against the same center ZIP."""
    if previous is None:
        return 0.0
    prev_zip = str(previous.get("zip", "")).strip()
    curr_zip = str(current.get("zip", "")).strip()
    same_center = prev_zip == curr_zip and prev_zip != ""
    return float(5 if same_center else BETWEEN_SEARCHES_S)


# How long to wait for the “N Doctors of Optometry found” line after clicking Search.
RESULTS_HEADING_TIMEOUT_MS = 180_000
# After clicking pagination “Next”, wait until the table actually changes.
PAGINATION_CHANGE_TIMEOUT_MS = 55_000


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


DOCTORS_FOUND_HEADING_RE = re.compile(
    r"\d+\s+Doctors\s+of\s+Optometry\s+found",
    re.I,
)


def _body_has_doctors_heading(page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
              const t = document.body ? (document.body.innerText || '') : '';
              return /\\d+\\s+Doctors\\s+of\\s+Optometry\\s+found/i.test(t);
            }
            """
        )
    )


def _wait_until_doctors_heading(page, *, timeout_ms: int) -> None:
    """
    The count line is sometimes in the DOM but not considered “visible” by strict Playwright
    checks (overlays, CSS). Poll innerText, then wait for attached element.
    """
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        if _body_has_doctors_heading(page):
            break
        page.wait_for_timeout(350)
    else:
        snippet = page.evaluate(
            "() => (document.body && document.body.innerText) ? document.body.innerText.slice(0, 1600) : ''"
        )
        raise PlaywrightTimeout(
            "Timed out waiting for results heading (doctors count). "
            f"Page text starts with: {snippet[:700]!r}"
        )

    anchor = page.get_by_text(DOCTORS_FOUND_HEADING_RE).first
    ms_left = int(max(1200.0, (deadline - time.time()) * 1000))
    try:
        anchor.wait_for(state="attached", timeout=min(30_000, ms_left))
    except PlaywrightTimeout:
        if not _body_has_doctors_heading(page):
            raise
    page.wait_for_timeout(1200)


def _parse_total_doctors(page) -> int | None:
    """Read '697 Doctors of Optometry found' style heading."""
    loc = page.get_by_text(re.compile(r"(\d+)\s+Doctors of Optometry found", re.I)).first
    try:
        text = loc.inner_text(timeout=5_000)
    except Exception:
        return None
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None


def _results_page_signature(page) -> str | None:
    """Fingerprint of the ordered doctor names on the current results page."""
    blocks = extract_result_blocks(page)
    if not blocks:
        return None
    names: list[str] = []
    for b in blocks:
        line = b.split("\n", 1)[0].strip()
        names.append(line)
    return "||".join(names)


def _wait_for_listing_change(page, previous_sig: str | None, timeout_ms: int = PAGINATION_CHANGE_TIMEOUT_MS) -> bool:
    """After pagination, wait until the visible result set changes."""
    if previous_sig is None:
        page.wait_for_timeout(int(BETWEEN_PAGES_S * 1000))
        return True

    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        cur = _results_page_signature(page)
        if cur and cur != previous_sig:
            return True
        page.wait_for_timeout(200)
    return False


def _pagination_next(page):
    """Locators that might match the pagination 'Next' control."""
    link = page.get_by_role("link", name=re.compile(r"^\s*next\s*$", re.I))
    if link.count():
        return link
    btn = page.get_by_role("button", name=re.compile(r"^\s*next\s*$", re.I))
    if btn.count():
        return btn
    return page.locator("a").filter(has_text=re.compile(r"^\s*Next\s*$", re.I))


def _next_is_actionable(next_group) -> bool:
    try:
        if next_group.count() == 0:
            return False
        el = next_group.first
        if not el.is_visible():
            return False
        aria = (el.get_attribute("aria-disabled") or "").lower()
        if aria == "true":
            return False
        cls = (el.get_attribute("class") or "").lower()
        if "disabled" in cls:
            return False
        tab = (el.get_attribute("tabindex") or "").strip()
        if tab == "-1":
            return False
        return True
    except Exception:
        return False


def extract_result_blocks(page) -> list[str]:
    """
    Heuristic: each listing has a 'DIRECTIONS' link. Walk up the DOM until we
    find a container whose text includes 'Dr.' — matches the screenshot layout.
    """
    return page.evaluate(
        """
        () => {
          const dirs = [...document.querySelectorAll('a')].filter(
            (a) => a.textContent.trim().toUpperCase() === 'DIRECTIONS'
          );
          const seen = new Set();
          const rows = [];
          for (const a of dirs) {
            let el = a.parentElement;
            for (let i = 0; i < 14 && el; i++) {
              const t = el.innerText || '';
              if (/Dr\\./i.test(t) && t.length < 4000) {
                const key = t.slice(0, 200);
                if (!seen.has(key)) {
                  seen.add(key);
                  rows.push(t);
                }
                break;
              }
              el = el.parentElement;
            }
          }
          return rows;
        }
        """
    )


def _for_each_locator(locator, fn) -> bool:
    """Call fn(nth_locator) for each index; return True if fn returned True."""
    n = locator.count()
    for i in range(n):
        if fn(locator.nth(i)):
            return True
    return False


def _first_visible_fill(locator_collection, text: str) -> None:
    def try_fill(loc, *, force: bool) -> bool:
        try:
            loc.scroll_into_view_if_needed(timeout=5_000)
        except Exception:
            pass
        if not force and not loc.is_visible():
            return False
        loc.fill(text, force=force)
        return True

    n = locator_collection.count()
    if _for_each_locator(locator_collection, lambda loc: try_fill(loc, force=False)):
        return

    for i in range(n):
        if try_fill(locator_collection.nth(i), force=True):
            return

    raise RuntimeError(f"Could not fill input ({n} candidate(s))")


def _first_visible_select(
    locator_collection,
    *,
    value: str | None = None,
    label: str | None = None,
) -> None:
    if value is None and label is None:
        raise ValueError("value or label required")

    def try_select(loc, *, force: bool) -> bool:
        try:
            loc.scroll_into_view_if_needed(timeout=5_000)
        except Exception:
            pass
        if not force and not loc.is_visible():
            return False
        if value is not None:
            loc.select_option(value=value, force=force)
        else:
            loc.select_option(label=label, force=force)  # type: ignore[arg-type]
        return True

    n = locator_collection.count()
    if _for_each_locator(locator_collection, lambda loc: try_select(loc, force=False)):
        return

    # Custom-styled forms often keep the real <select> hidden; Playwright can still set it.
    for i in range(n):
        if try_select(locator_collection.nth(i), force=True):
            return

    raise RuntimeError(f"Could not set <select> ({n} candidate(s))")


def _click_first_visible_search(page) -> None:
    btns = page.get_by_role("button", name=re.compile(r"^search$", re.I))

    def try_click(loc, *, force: bool) -> bool:
        try:
            loc.scroll_into_view_if_needed(timeout=5_000)
        except Exception:
            pass
        if not force and not loc.is_visible():
            return False
        loc.click(force=force)
        return True

    n = btns.count()
    if _for_each_locator(btns, lambda loc: try_click(loc, force=False)):
        return

    for i in range(n):
        if try_click(btns.nth(i), force=True):
            return

    raise RuntimeError(f"No Search button ({n} candidate(s))")


def _practice_city_ca_from_address(addr: str) -> str:
    """Best-effort: parse 'Somewhere, CA 9xxxx' from the address line."""
    if not addr:
        return ""
    m = re.search(
        r"([\w\s\-'\.]+)\s*,\s*CA\s*\d{5}(?:-\d{4})?\b",
        addr,
        flags=re.I,
    )
    if m:
        return _normalize_ws(m.group(1))
    return ""


def parse_block(block: str) -> dict[str, str]:
    """Turn one card's inner text into columns (best-effort)."""
    lines = [_normalize_ws(x) for x in str(block).splitlines() if _normalize_ws(x)]
    phone = ""
    for i, line in enumerate(lines):
        m = re.search(r"\(\d{3}\)\s*\d{3}-\d{4}", line)
        if m:
            phone = m.group(0)
            # Address is often the line before the phone line
            addr = lines[i - 1] if i > 0 else ""
            name = lines[0] if lines else ""
            practice = lines[1] if len(lines) > 1 else ""
            pcty = _practice_city_ca_from_address(addr)
            return {
                "doctor_name": name,
                "practice_name": practice,
                "address_line": addr,
                "practice_city_ca": pcty,
                "phone": phone,
                "raw_block": block,
            }
    # Fallback if phone pattern not found
    addr0 = lines[2] if len(lines) > 2 else ""
    return {
        "doctor_name": lines[0] if lines else "",
        "practice_name": lines[1] if len(lines) > 1 else "",
        "address_line": "",
        "practice_city_ca": _practice_city_ca_from_address(addr0),
        "phone": "",
        "raw_block": block,
    }


def run_search(page, spec: dict[str, str]) -> list[dict]:
    """Run one AOA locator search. ``spec`` comes from SEARCHES."""
    city = spec["city"]
    state = spec["state"]
    zip_code = str(spec["zip"]).strip()
    distance_label = spec["distance_label"]
    anchor = (spec.get("search_anchor_label") or "").strip()
    center_zip = str(spec.get("search_center_zip") or zip_code).strip()
    run_kind = (spec.get("run_kind") or "").strip()
    radius_mi = radius_miles_from_label(distance_label)

    tag = f"[{anchor}] " if anchor else ""

    page.goto(AOA_URL, wait_until="domcontentloaded", timeout=120_000)
    try:
        page.wait_for_load_state("load", timeout=45_000)
    except PlaywrightTimeout:
        pass
    page.wait_for_timeout(int(PAGELOAD_WAIT_S * 1000 + 900))

    # Two forms exist (main + refine). Always target the first *visible* controls.
    _first_visible_fill(
        page.locator("input[name='City'], input#City"),
        city,
    )
    _first_visible_select(
        page.locator("select[name='State'], select#State"),
        value=state,
    )
    _first_visible_fill(
        page.locator(
            "input[name='Zip'], input[name='ZIP'], input[name='ZipCode'], "
            "input#Zip, input#ZIP"
        ),
        zip_code,
    )
    _first_visible_select(
        page.locator("select[name='Distance'], select#Distance"),
        label=distance_label,
    )

    _click_first_visible_search(page)

    _wait_until_doctors_heading(page, timeout_ms=RESULTS_HEADING_TIMEOUT_MS)
    page.wait_for_timeout(int(PAGELOAD_WAIT_S * 1000))

    total_expected = _parse_total_doctors(page)
    max_pages_guard = min(
        max((total_expected or 0) // 5 + 80, 120),
        600,
    )

    seen_fingerprints: set[str] = set()
    collected: list[dict] = []
    page_index = 0

    while True:
        blocks = extract_result_blocks(page)
        if not blocks:
            break

        for b in blocks:
            fp = b[:240]
            if fp in seen_fingerprints:
                continue
            seen_fingerprints.add(fp)
            row = parse_block(b)
            row["source_city"] = city
            row["source_zip"] = zip_code
            row["radius"] = distance_label
            row["search_anchor_label"] = anchor
            row["search_center_zip"] = center_zip
            row["search_run_kind"] = run_kind
            row["search_radius_miles"] = radius_mi if radius_mi is not None else ""
            collected.append(row)

        if total_expected is not None and len(collected) >= total_expected:
            break

        sig = _results_page_signature(page)

        next_group = _pagination_next(page)
        if not _next_is_actionable(next_group):
            break

        nxt = next_group.first
        nxt.scroll_into_view_if_needed(timeout=5_000)
        nxt.click()
        page.wait_for_timeout(750)
        page_index += 1
        if page_index > max_pages_guard:
            break

        changed = _wait_for_listing_change(page, sig, timeout_ms=PAGINATION_CHANGE_TIMEOUT_MS)
        if not changed:
            page.wait_for_timeout(2500)
            changed = _wait_for_listing_change(page, sig, timeout_ms=35_000)
        if not changed:
            break

        try:
            page.wait_for_load_state("networkidle", timeout=30_000)
        except PlaywrightTimeout:
            pass

        page.wait_for_timeout(int(BETWEEN_PAGES_S * 1000))

    if total_expected is not None and len(collected) < total_expected:
        print(
            f"Warning: {tag}{city}, {state} {zip_code} @ {distance_label}: collected {len(collected)} rows "
            f"but result header showed {total_expected} — some pages may not have loaded."
        )
    elif total_expected is not None:
        print(
            f"OK: {tag}{city}, {state} {zip_code} @ {distance_label}: {len(collected)} rows "
            f"(header {total_expected})."
        )

    return collected


def _headless_requested() -> bool:
    """Headless unless AOA_PW_HEADED=1 / true / yes."""
    return os.environ.get("AOA_PW_HEADED", "").strip().lower() not in {"1", "true", "yes"}


def _launch_playwright_browser(p):
    """
    Pick a browser stack. Chromium can hard-crash (segfault) on some Macs; Firefox/WebKit avoids that.

    Env:
      AOA_PW_BROWSER=auto|chromium|chrome|firefox|webkit
      AOA_PW_HEADED=1          (windowed; sidesteps some GPU/headless crashes)
    """
    headless = _headless_requested()
    chromium_args = [
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--mute-audio",
    ]

    def launch_chromium_bundled():
        return p.chromium.launch(headless=headless, args=chromium_args)

    def launch_chromium_system_chrome():
        return p.chromium.launch(headless=headless, channel="chrome", args=chromium_args)

    def launch_firefox():
        return p.firefox.launch(headless=headless)

    def launch_webkit():
        return p.webkit.launch(headless=headless)

    pref = os.environ.get("AOA_PW_BROWSER", "auto").strip().lower()

    if pref == "firefox":
        plans = [
            ("Playwright Firefox", launch_firefox),
            ("Playwright Chromium (bundled)", launch_chromium_bundled),
            ("Google Chrome channel", launch_chromium_system_chrome),
        ]
    elif pref == "webkit":
        plans = [
            ("Playwright WebKit", launch_webkit),
            ("Playwright Firefox", launch_firefox),
            ("Playwright Chromium (bundled)", launch_chromium_bundled),
        ]
    elif pref == "chrome":
        plans = [
            ("Google Chrome channel", launch_chromium_system_chrome),
            ("Playwright Chromium (bundled)", launch_chromium_bundled),
            ("Playwright Firefox", launch_firefox),
        ]
    elif pref == "chromium":
        plans = [
            ("Playwright Chromium (bundled)", launch_chromium_bundled),
            ("Google Chrome channel", launch_chromium_system_chrome),
            ("Playwright Firefox", launch_firefox),
        ]
    else:
        if sys.platform == "darwin":
            # Chromium often segfaults on some Apple Silicon / Python combos before Python can catch it.
            # Prefer Firefox/WebKit first on macOS unless the caller pins a browser via AOA_PW_BROWSER.
            plans = [
                ("Playwright Firefox", launch_firefox),
                ("Playwright WebKit", launch_webkit),
                ("Playwright Chromium (bundled)", launch_chromium_bundled),
                ("Google Chrome channel", launch_chromium_system_chrome),
            ]
        else:
            plans = [
                ("Playwright Chromium (bundled)", launch_chromium_bundled),
                ("Google Chrome channel", launch_chromium_system_chrome),
                ("Playwright Firefox", launch_firefox),
                ("Playwright WebKit", launch_webkit),
            ]

    errors: list[str] = []
    for label, fn in plans:
        try:
            print(f"Launching {label} (headless={headless})…")
            browser = fn()
            print(f"OK — using engine {browser.browser_type.name}.")
            return browser
        except Exception as exc:
            msg = f"{label}: {exc!r}"
            print(f"WARN: {msg}")
            errors.append(msg)

    raise RuntimeError(
        "Could not launch any Playwright browser. Run:\n"
        "  python3 -m playwright install chromium firefox webkit\n"
        "Install errors were:\n  - "
        + "\n  - ".join(errors)
    )


def _prepare_playwright_host_process() -> None:
    """Best-effort host tweaks — cannot fix incompatible Python/greenlet/Driver combos."""
    if sys.platform == "darwin":
        os.environ.setdefault("OBJC_DISABLE_INITIALIZE_FORK_SAFETY", "YES")

    maj, min = sys.version_info.major, sys.version_info.minor
    if (maj, min) >= (3, 13):
        print(
            f"WARNING: Interpreter is Python {maj}.{min}. Playwright routinely segfaults here before "
            f"opening any browser.\n"
            "  Fix path: reinstall the venv with Python 3.12 (brew install python@3.12).\n"
            "  Sanity check: python3 aoa_playwright_smoke_test.py\n",
            flush=True,
        )


def main() -> None:
    print(f"Planned AOA runs: {len(SEARCHES)} (OFFICE_EXPAND_RADII={OFFICE_EXPAND_RADII}).")
    print(
        f"(COVER_LA_AND_VENTURA_COUNTIES={COVER_LA_AND_VENTURA_COUNTIES}) "
        f"- county anchors add long 50-mile sweeps from non-Khanna ZIPs."
    )
    _prepare_playwright_host_process()
    if COVER_LA_AND_VENTURA_COUNTIES:
        print(
            "County anchors enabled — expect huge multi-hour totals. Prefer False unless you deliberately "
            "need those extra polygons."
        )

    print("Starting Playwright driver (first launch can crash on buggy Python combos) …", flush=True)

    all_rows: list[dict] = []
    with sync_playwright() as p:
        browser = _launch_playwright_browser(p)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )
        try:
            previous_spec: dict[str, str] | None = None
            for idx, s in enumerate(SEARCHES):
                pause = _between_search_pause_seconds(previous_spec, s)
                if pause > 0:
                    print(f"Cooling down {pause:.0f}s before next locator run…")
                    time.sleep(pause)
                previous_spec = dict(s)

                rows_added: list[dict] | None = None
                last_err: BaseException | None = None

                for attempt in (1, 2):
                    sp = context.new_page()
                    try:
                        rows_added = run_search(sp, s)
                        last_err = None
                        break
                    except PlaywrightTimeout as exc:
                        last_err = exc
                        label = (s.get("search_anchor_label") or s["city"]).strip()
                        print(
                            f"Attempt {attempt} timed out ({label}, {s['state']} "
                            f"{s['zip']} @ {s['distance_label']}). "
                            f"Closing tab and sleeping 35s…"
                        )
                        time.sleep(35)
                    finally:
                        sp.close()

                if last_err is not None:
                    raise last_err

                assert rows_added is not None
                all_rows.extend(rows_added)
        finally:
            browser.close()

    df = pd.DataFrame(all_rows)
    if df.empty:
        print("No rows collected — the page layout may have changed. Try headless=False and page.pause() for debugging.")
        return

    srmi = pd.to_numeric(df.get("search_radius_miles"), errors="coerce")
    df["__tiebreak_radius"] = srmi.fillna(9999)
    df["__anchor_pri"] = df["search_center_zip"].map(_search_center_preference_rank)

    dup_cols = ["doctor_name", "address_line", "phone"]
    # Prefer rows searched from Westlake first, THEN smallest advertised radius — fixes BH “stealing” Conejo docs.
    df = df.sort_values(
        ["__anchor_pri", "__tiebreak_radius"],
        ascending=[True, True],
        kind="mergesort",
    )
    df = df.drop(columns=["__tiebreak_radius", "__anchor_pri"])

    df = df.drop_duplicates(subset=dup_cols, keep="first")

    wv_anchor_mask = df["search_center_zip"].astype(str).str.strip() == PRIMARY_DEDUPE_OFFICE_ZIP
    df_westlake_anchor = df.loc[wv_anchor_mask].copy()

    if "practice_city_ca" in df.columns:
        nonempty = df["practice_city_ca"].fillna("").astype(str).str.strip()
        n_city = nonempty[nonempty != ""].nunique()
        print(f"(For your boss): ~{int(n_city)} distinct practice cities in column practice_city_ca.")

    df.to_excel(OUT_XLSX, index=False)
    df.to_csv(OUT_CSV, index=False)

    df_westlake_anchor.to_excel(OUT_WESTLAKE_ANCHOR_XLSX, index=False)
    df_westlake_anchor.to_csv(OUT_WESTLAKE_ANCHOR_CSV, index=False)

    print(f"Master export: {len(df)} deduped rows →\n  {OUT_XLSX}\n  {OUT_CSV}")
    print(
        f"Westlake-centered (search_center_zip {PRIMARY_DEDUPE_OFFICE_ZIP}) "
        f"after WV-priority dedupe: {len(df_westlake_anchor)} rows →\n"
        f"  {OUT_WESTLAKE_ANCHOR_XLSX}\n  {OUT_WESTLAKE_ANCHOR_CSV}"
    )


if __name__ == "__main__":
    main()
