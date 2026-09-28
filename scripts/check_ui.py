"""Click everything on the site, in every language, and report what broke.

    python scripts/check_ui.py                      # the local web/, production headers
    python scripts/check_ui.py --base https://sahaay-offline.vercel.app

check_live.py proves the models run. This proves the interface around them
does: every control a visitor can press, and every language's output.

  landing   nav anchors, both calls to action, the window controls on the
            product shot (zoom, Esc, minimise, close, reopen, double-click),
            every section revealed on scroll, every link's HTTP status
  demo      all 22 recorded languages: captions and translations arrive, in
            the right script and direction; A-/A+, replay speed, Stop, the
            notes sheet, Copy Markdown and Close
  live      the page boots, the language menu offers every language, the
            source picker and Start are there

Console errors and content-security-policy violations fail the page they
happen on. Exit status is the number of failures.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from check_live import SCRIPT_RANGES, serve  # noqa: E402

WEB_DIR = REPO_ROOT / "web"
RTL = {"ur", "ks", "sd"}

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, bool(ok), detail))
    mark = "ok  " if ok else "FAIL"
    print(f"  {mark} {name}" + (f"  - {detail}" if detail else ""), flush=True)
    return bool(ok)


def watch(page, errors: list[str]) -> None:
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)


def http_status(url: str, attempts: int = 3) -> int:
    """Status of a GET, retrying transient answers (5xx, 429, no connection)."""
    code = 0
    for n in range(attempts):
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "sahaay-check-ui"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception:  # noqa: BLE001
            code = 0
        if code and code < 500 and code != 429:
            return code
        time.sleep(1.5 * (n + 1))
    return code


def landing(browser, base: str) -> None:
    print("\nlanding")
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors: list[str] = []
    watch(page, errors)
    page.goto(base + "/", wait_until="load")
    page.wait_for_timeout(1200)

    anchors = page.eval_on_selector_all(".top-links a[href^='#'], .kpi[href^='#']", "els => els.map(e => e.getAttribute('href'))")
    missing = [a for a in anchors if not page.query_selector(a)]
    check("every in-page link has a target", not missing, ", ".join(missing))

    page.click(".top-links a[href='#npu']")
    page.wait_for_timeout(1200)
    top = page.eval_on_selector("#npu", "e => Math.round(e.getBoundingClientRect().top)")
    here = page.eval_on_selector_all(".top-links a.here", "els => els.map(e => e.textContent)")
    check("nav link scrolls to its section", 0 <= top < 200, f"section top at {top}px")
    check("nav marks the section in view", "Why an NPU" in here, ", ".join(here))

    for sel in [".sec"]:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        for _ in range(12):
            page.mouse.wheel(0, -700)
            page.wait_for_timeout(120)
        hidden = page.eval_on_selector_all(sel + ".pre", "els => els.map(e => e.id)")
        check("every section reveals on scroll", not hidden, ", ".join(hidden))

    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.click(".light-zoom")
    page.wait_for_timeout(600)
    r = page.eval_on_selector(".shot-frame", "e => e.getBoundingClientRect().toJSON()")
    centred = abs((r["left"] + r["width"] / 2) - 720) < 4 and r["width"] > 1000
    check("green: zoom fills the screen, centred", centred, f"{r['width']:.0f}px wide at x={r['left']:.0f}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    check("Esc restores the zoom", not page.eval_on_selector(".shot", "e => e.classList.contains('zoomed')"))
    page.dblclick(".shot-title")
    page.wait_for_timeout(600)
    check("double-click on the title bar zooms", page.eval_on_selector(".shot", "e => e.classList.contains('zoomed')"))
    page.click(".shot-backdrop", position={"x": 8, "y": 8})
    page.wait_for_timeout(500)
    check("clicking outside restores", not page.query_selector(".shot-backdrop"))
    page.click(".light-min")
    page.wait_for_timeout(600)
    h = page.eval_on_selector(".shot-frame", "e => e.getBoundingClientRect().height")
    check("yellow: minimise rolls up to the title bar", h < 60, f"{h:.0f}px")
    page.click(".light-min")
    page.wait_for_timeout(600)
    h = page.eval_on_selector(".shot-frame", "e => e.getBoundingClientRect().height")
    check("yellow again: restores", h > 300, f"{h:.0f}px")
    # The reopen button must only exist once the window is closed: a class
    # rule's display once beat its hidden attribute and it showed all along.
    check("the reopen button is hidden while the window is open", not page.is_visible(".shot-reopen"))
    page.click(".light-close")
    page.wait_for_timeout(500)
    check("red: close leaves a way back", page.is_visible(".shot-reopen"))
    page.click(".shot-reopen")
    page.wait_for_timeout(500)
    check("reopen brings the window back", page.is_visible(".shot-frame img"))
    check("and hides the reopen button again", not page.is_visible(".shot-reopen"))
    sizes = page.eval_on_selector_all(".light", "els => els.map(e => Math.min(e.offsetWidth, e.offsetHeight))")
    check("window controls are 24 px targets", sizes and min(sizes) >= 24, f"{sizes}")

    # The film: present, not preloaded, and its poster and file are served.
    film = page.eval_on_selector("#film video", "v => ({preload: v.preload, poster: v.poster, src: v.querySelector('source').src})")
    check("the film does not download with the page", film["preload"] == "none", film["preload"])
    for what in ("poster", "src"):
        code = http_status(film[what])
        check(f"the film's {what} is served", code in (200, 206), f"{code} {film[what]}")
    card = page.get_attribute('meta[property="og:image"]', "content")
    check("the share card is served", http_status(card) == 200, card)

    links = page.eval_on_selector_all("a[href]", "els => [...new Set(els.map(e => e.href))]")
    bad, private, signin = [], [], []
    for url in links:
        if url.startswith(base + "/#") or "#" in url.split("/")[-1][:1]:
            continue
        code = http_status(url)
        if "github.com/andringodson/Hackathon-SnapdragonAILab" in url and code == 404:
            private.append(url)
        elif "workbench.aihub.qualcomm.com/jobs/" in url:
            # AI Hub job pages sit behind a Qualcomm ID sign-in, and the site
            # says so; an anonymous request gets 404, a browser the sign-in.
            signin.append(url)
        elif code >= 400 or code == 0:
            bad.append(f"{code} {url}")
    check(f"every link answers ({len(links)} checked)", not bad, "; ".join(bad[:4]))
    if private:
        print(f"  note {len(private)} GitHub links 404 for visitors while the repository is private")
    if signin:
        print(f"  note {len(signin)} AI Hub job links need a Qualcomm ID sign-in (the page says so)")

    with page.expect_navigation():
        page.click(".cta .btn-primary")
    check("'Try it in your browser' opens /live", page.url.rstrip("/").endswith("/live"))
    page.go_back()
    with page.expect_navigation():
        page.click(".cta .btn:nth-child(2)")
    check("'Watch a recorded session' opens /demo", "/demo/" in page.url)

    blocked = [e for e in errors if "Content Security Policy" in e or "Refused" in e]
    check("landing: no console errors", not errors, "; ".join(errors[:3]))
    check("landing: nothing blocked by the CSP", not blocked)
    page.close()


def demo(browser, base: str) -> None:
    print("\ndemo (every recorded language)")
    sessions = json.loads((WEB_DIR / "sessions.json").read_text(encoding="utf-8"))["sessions"]
    langs = {lang["code"]: lang for lang in json.loads((WEB_DIR / "static" / "languages.json").read_text(encoding="utf-8"))}
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors: list[str] = []
    watch(page, errors)
    for s in sessions:
        code = s["code"]
        page.goto(f"{base}/demo/?lang={code}&play=1&speed=12")
        try:
            page.wait_for_function(
                "c => document.querySelectorAll(`.cap-tr[lang='${c}']`).length >= 2", arg=code, timeout=60000
            )
        except Exception:  # noqa: BLE001
            check(f"{code}: translations appear", False, "none within 60 s at 12x")
            continue
        texts = page.eval_on_selector_all(f".cap-tr[lang='{code}']", "els => els.map(e => [e.textContent, getComputedStyle(e).direction])")
        script = langs[code]["nllb"].split("_")[1]
        ranges = SCRIPT_RANGES.get(script)
        share = 1.0
        if ranges:
            letters = [c for t, _ in texts for c in t if c.isalpha() and not c.isascii()]
            share = sum(any(lo <= ord(c) <= hi for lo, hi in ranges) for c in letters) / max(1, len(letters))
        direction = texts[0][1]
        want = "rtl" if code in RTL else "ltr"
        check(f"{code}: {len(texts)} lines in {script}, {direction}", share >= 0.8 and direction == want,
              f"{share:.0%} in script" if share < 0.8 else ("" if direction == want else f"direction {direction}, want {want}"))

    # The controls, once, on Hindi.
    page.goto(f"{base}/demo/?lang=hi&play=1&speed=12")
    page.wait_for_selector(".cap-tr:not([hidden])", timeout=60000)
    before = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--cap-scale')")
    page.click("#bigger")
    page.click("#bigger")
    after = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--cap-scale')")
    check("A+ makes captions bigger", float(after or 1) > float(before or 1), f"{before} -> {after}")
    page.click("#smaller")
    check("A- makes them smaller", float(page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--cap-scale')") or 1) < float(after or 1))
    check("replay speed control is there", page.is_visible("#replay-speed"))
    try:
        page.wait_for_selector("#notes:not([hidden])", timeout=90000)
        check("the notes sheet opens at the end", True)
        page.context.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
        page.click("#notes-copy")
        page.wait_for_selector("#toast:not([hidden])", timeout=5000)
        check("Copy Markdown confirms", "copied" in page.inner_text("#toast").lower(), page.inner_text("#toast"))
        page.click("#notes-close")
        page.wait_for_timeout(300)
        check("Close hides the notes", page.is_hidden("#notes"))
    except Exception as exc:  # noqa: BLE001
        check("notes sheet", False, str(exc).splitlines()[0])
    page.goto(f"{base}/demo/?lang=hi&play=1&speed=4")
    page.wait_for_selector(".cap", timeout=60000)
    page.click("#toggle")
    n = page.locator(".cap").count()
    page.wait_for_timeout(4000)
    check("Stop halts the replay", page.locator(".cap").count() == n)
    check("demo: no console errors", not errors, "; ".join(errors[:3]))
    page.close()


def live(browser, base: str) -> None:
    print("\nlive")
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors: list[str] = []
    watch(page, errors)
    page.goto(f"{base}/live/")
    page.wait_for_selector("#language option", state="attached", timeout=30000)
    offered = page.eval_on_selector_all("#language option", "els => els.map(e => e.value)")
    langs = [lang["code"] for lang in json.loads((WEB_DIR / "static" / "languages.json").read_text(encoding="utf-8"))]
    check(f"language menu offers English + all {len(langs)}", offered == ["en"] + langs, f"{len(offered)} options")
    check("source picker is there", page.is_visible("#live-source-select"))
    page.wait_for_selector("#toggle:not([disabled])", timeout=120000)
    check("Start becomes ready", True)
    blocked = [e for e in errors if "Content Security Policy" in e or "Refused" in e]
    check("live: nothing blocked by the CSP", not blocked, "; ".join(blocked[:2]))
    page.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", help="check a deployment instead of the local web/")
    ap.add_argument("--only", choices=["landing", "demo", "live"])
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    t0 = time.time()
    source = contextlib.nullcontext(args.base.rstrip("/")) if args.base else serve(WEB_DIR)
    with source as base, sync_playwright() as pw:
        print(f"checking {base}")
        browser = pw.chromium.launch()
        for name, fn in (("landing", landing), ("demo", demo), ("live", live)):
            if args.only in (None, name):
                fn(browser, base)
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed in {time.time() - t0:.0f} s")
    for name, _, detail in failed:
        print(f"  FAIL {name}  {detail}")
    return len(failed)


if __name__ == "__main__":
    raise SystemExit(main())
