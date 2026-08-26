"""
Minimal Playwright health check. If *this* crashes with "segmentation fault", the full scraper will too.

  source .venv/bin/activate
  python3 -m playwright install firefox webkit chromium
  python3 aoa_playwright_smoke_test.py

Working output ends with: ok: firefox launch headless

On Python 3.13 + macOS, use a 3.12 venv instead.
"""

from __future__ import annotations

import os
import sys

import faulthandler

faulthandler.enable(all_threads=True)


def main() -> None:
    maj, min = sys.version_info.major, sys.version_info.minor
    print(f"Python {maj}.{min} on {sys.platform!r}", flush=True)
    if sys.platform == "darwin":
        os.environ.setdefault("OBJC_DISABLE_INITIALIZE_FORK_SAFETY", "YES")

    from playwright.sync_api import sync_playwright

    headless = os.environ.get("AOA_PW_HEADED", "").strip().lower() not in {"1", "true", "yes"}
    print("Opening Playwright driver …", flush=True)
    with sync_playwright() as p:
        print("Launching Firefox (bundled) …", flush=True)
        browser = p.firefox.launch(headless=headless)
        try:
            page = browser.new_page()
            page.goto("about:blank", timeout=30_000)
            print("ok: firefox launch", "headless" if headless else "headed", flush=True)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
