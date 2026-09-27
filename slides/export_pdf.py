"""Export the deck to a PDF, one 1920x1080 page per slide.

    python slides/make_deck.py        # regenerate the slides first
    python slides/export_pdf.py [out.pdf]

The slide files are written for the Slides artifact, which serves uploaded
images from its own store (/_blob/...) and draws <x-icon> itself. Neither
exists in a plain browser, so this maps the one screenshot to its source in
docs/img and draws the three icons as inline SVG. Speaker notes are left out.
Needs Playwright with Chromium (or Edge) and a network connection for the
Google Fonts the deck uses.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else REPO / "Sahaay_deck.pdf"

# The one uploaded image, and where it came from (see SHOT in make_deck.py).
BLOBS = {"/_blob/11543e39bc1ea83d551ba0b2df340614": REPO / "docs" / "img" / "demo.png"}

_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="{style}">{body}</svg>'
ICONS = {
    "Chat": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "Globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    "Cloud": '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
}


def for_print(html: str) -> str:
    for blob, path in BLOBS.items():
        html = html.replace(blob, path.resolve().as_uri())

    def icon(m: re.Match) -> str:
        name, style = m.group(1), m.group(2)
        if name not in ICONS:
            raise SystemExit(f"no print version of <x-icon name={name!r}>; add it to ICONS")
        return _ICON.format(style=style, body=ICONS[name])

    return re.sub(r'<x-icon name="([^"]+)" style="([^"]*)"></x-icon>', icon, html)


def main() -> int:
    deck = json.loads((ROOT / "project" / "deck.json").read_text(encoding="utf-8"))
    fonts = sorted({face["href"] for face in deck["faces"].values() if "href" in face})
    pages = "".join(
        f'<div class="pg">{for_print((ROOT / "project" / "slides" / f"{sid}.html").read_text(encoding="utf-8"))}</div>'
        for sid in deck["order"]
    )
    links = "".join(f'<link rel="stylesheet" href="{h}">' for h in fonts)
    html = f"""<!doctype html><html><head><meta charset="utf-8">{links}
<style>
@page {{ size: 1920px 1080px; margin: 0 }}
html, body {{ margin: 0; padding: 0; background: #000 }}
.pg {{ width: 1920px; height: 1080px; position: relative; overflow: hidden; break-after: page }}
.pg > section {{ position: absolute; inset: 0; box-sizing: border-box }}
.pg section * {{ box-sizing: border-box }}
.pg aside {{ display: none !important }}
.pg p, .pg h1, .pg h2, .pg h3, .pg ul, .pg ol {{ margin: 0 }}
</style></head><body>{pages}</body></html>"""
    tmp = ROOT / "_print.html"
    tmp.write_text(html, encoding="utf-8")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1920, "height": 1080})
            page.goto(tmp.as_uri())
            page.wait_for_load_state("networkidle")
            page.evaluate("document.fonts.ready")
            broken = page.evaluate("[...document.images].filter(i => !i.naturalWidth).map(i => i.alt)")
            if broken:
                raise SystemExit(f"images failed to load: {broken}")
            page.pdf(path=str(OUT), width="1920px", height="1080px", print_background=True,
                     margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)
    print(f"wrote {OUT} ({len(deck['order'])} slides)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
