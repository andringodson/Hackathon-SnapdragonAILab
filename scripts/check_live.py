"""Does the browser build actually transcribe? Drive it with a fake microphone.

web/live/ runs Whisper in the visitor's browser. Nothing in the test suite
can tell you whether that works: the suite checks files, and this depends on
a CDN fetch, a WASM compile, a WebGPU probe, microphone permission and the
page's own content-security policy. Every one of those fails silently into
"press Start and nothing happens".

So this launches Chromium with its fake capture device fed from a real WAV,
presses Start, and waits for a caption to appear. Chromium plays the file
into getUserMedia as though someone were speaking it.

    python scripts/check_live.py
    python scripts/check_live.py --base https://sahaay-offline.vercel.app

The --base run is the one that matters. The content-security policy only
exists on the deployment, and a policy that blocks the runtime produces a
page that loads perfectly and never captions - which is exactly how the CSP
caught out scripts/shoot_web.py once already.

The first run downloads the model, so allow a few minutes.
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import json
import re
import socket
import threading
import wave
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = REPO_ROOT / "web"
DEFAULT_WAV = REPO_ROOT / "testaudio" / "lecture_long.wav"


def free_port() -> int:
    with contextlib.closing(socket.socket()) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def vercel_headers() -> list[tuple[re.Pattern, list[tuple[str, str]]]]:
    """The response headers vercel.json declares, as (path pattern, headers).

    The content-security policy and the cross-origin isolation headers only
    exist on the deployment, and both change what a page can do: the first
    decides whether the runtime may load at all, the second whether WASM
    gets threads. A local server that omits them tests a different page.
    """
    cfg = json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))
    rules = []
    for rule in cfg.get("headers", []):
        pattern = re.compile("^" + rule["source"] + "$")
        rules.append((pattern, [(h["key"], h["value"]) for h in rule.get("headers", [])]))
    return rules


@contextlib.contextmanager
def serve(directory: Path, production_headers: bool = True):
    """Serve web/ locally, sending the same headers Vercel would."""
    rules = vercel_headers() if production_headers else []

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(directory), **k)

        def log_message(self, *a, **k):  # noqa: ARG002
            # Assigning log_message on a functools.partial - what this used
            # to do - sets an attribute nobody reads, which is why every run
            # printed a request log. A subclass actually overrides it.
            pass

        def end_headers(self):
            path = self.path.split("?", 1)[0]
            for pattern, headers in rules:
                if pattern.match(path):
                    for key, value in headers:
                        self.send_header(key, value)
            super().end_headers()

    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()


# The script each NLLB code names, as Unicode ranges - enough to tell Odia
# output from Bengali, or Urdu from nothing at all.
SCRIPT_RANGES = {
    "Deva": [(0x0900, 0x097F)], "Beng": [(0x0980, 0x09FF)], "Guru": [(0x0A00, 0x0A7F)],
    "Gujr": [(0x0A80, 0x0AFF)], "Orya": [(0x0B00, 0x0B7F)], "Taml": [(0x0B80, 0x0BFF)],
    "Telu": [(0x0C00, 0x0C7F)], "Knda": [(0x0C80, 0x0CFF)], "Mlym": [(0x0D00, 0x0D7F)],
    "Arab": [(0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)],
}


def check_translation(page, codes: list[str], timeout: int, problems: list[str]) -> tuple[list[str], dict]:  # noqa: ANN001
    """Pick each language in turn, mid-session, and wait for translations in its script.

    One page, one model download: after the first language the model is in
    memory and switching is what a visitor would do.
    """
    offered = json.loads((WEB_DIR / "static" / "languages.json").read_text(encoding="utf-8"))
    langs = {lang["code"]: lang for lang in offered}
    shown: list[str] = []
    for n, code in enumerate(codes):
        if code not in langs:
            problems.append(f"{code} is not an offered language ({', '.join(langs)})")
            continue
        script = langs[code]["nllb"].split("_")[1]
        page.select_option("#language", code)
        # The first language waits for the download and needs two lines: the
        # one on screen when it was picked and one that arrived afterwards.
        # The line's lang attribute says which language produced it.
        need = 2 if n == 0 else 1
        try:
            page.wait_for_function(
                f"() => document.querySelectorAll('.cap-tr[lang=\"{code}\"]').length >= {need}",
                timeout=(max(timeout, 900) if n == 0 else 120) * 1000,
            )
        except Exception as exc:  # noqa: BLE001
            problems.append(f"no {code} translations appeared: {str(exc).splitlines()[0]}")
            continue
        texts = [t.strip() for t in page.locator(f'.cap-tr[lang="{code}"]').all_inner_texts() if t.strip()]
        shown.extend(f"[{code}] {t}" for t in texts[:2])
        ranges = SCRIPT_RANGES.get(script)
        for text in texts:
            if "not installed" in text:
                problems.append("a translation line says the model is not installed")
                break
            # Technical terms are kept in English on purpose; judge the rest.
            letters = [c for c in text if c.isalpha() and not c.isascii()]
            if ranges and letters:
                share = sum(any(lo <= ord(c) <= hi for lo, hi in ranges) for c in letters) / len(letters)
                if share < 0.8:
                    problems.append(f"{code} translation is not in {script} script ({share:.0%}): {text[:60]}")
                    break
            elif ranges:
                problems.append(f"{code} translation has no {script} letters at all: {text[:60]}")
                break
    if shown and page.locator(".cap-tr[dir='auto']").count() == 0:
        problems.append("translation lines have no dir=auto; right-to-left scripts would render backwards")
    metrics = page.evaluate(
        "() => { const m = window.sahaayLive; const t = m.translations.map(x => x.ms).sort((a, b) => a - b);"
        " const ready = m.translations.length ? m.translations[0].at : Infinity;"
        " const rtf = (xs) => xs.length ? +(xs.reduce((a, c) => a + c.latency_ms / 1000 / c.audio_s, 0) / xs.length).toFixed(2) : null;"
        " return { translations: t.length, median_ms: t[Math.floor(t.length / 2)] || null,"
        " dropped: m.translationsDropped, threads: m.translatorThreads,"
        " whisper_rtf_before: rtf(m.captions.filter(c => c.at < ready)),"
        " whisper_rtf_while_translating: rtf(m.captions.filter(c => c.at >= ready)) }; }"
    )
    return shown, metrics


def check_wav(path: Path) -> None:
    """Chromium's fake device wants 16-bit PCM or it feeds silence."""
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2:
            raise SystemExit(f"{path.name} is not 16-bit PCM; Chromium would play silence")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", help="check a deployment instead of the local web/")
    ap.add_argument("--wav", type=Path, default=DEFAULT_WAV, help="audio to speak into the page")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--timeout", type=int, default=300, help="seconds to wait for a caption")
    ap.add_argument("--translate", metavar="CODE",
                    help="after the first caption, pick these languages in turn (e.g. hi,ur,or) and check "
                         "translations arrive in its script; downloads the ~900 MB model once")
    args = ap.parse_args()

    if not args.wav.exists():
        raise SystemExit(f"no such audio: {args.wav}\n  python scripts/make_lecture_audio.py")
    check_wav(args.wav)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed:\n  pip install playwright\n  playwright install chromium")
        return 1

    problems: list[str] = []
    source = contextlib.nullcontext(args.base.rstrip("/")) if args.base else serve(WEB_DIR)

    with source as base, sync_playwright() as pw:
        print(f"  checking {base}/live/")
        print(f"  speaking {args.wav.name} into the page\n")

        browser = pw.chromium.launch(
            headless=not args.headed,
            args=[
                "--use-fake-ui-for-media-stream",      # grant the mic without a prompt
                "--use-fake-device-for-media-stream",
                f"--use-file-for-fake-audio-capture={args.wav}",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        console: list[str] = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

        page.goto(f"{base}/live/", wait_until="networkidle")
        page.wait_for_selector("#toggle:not([disabled])", timeout=30_000)
        page.click("#toggle")

        try:
            # Generous: the first press fetches the model over the network.
            page.wait_for_selector("#captions li", timeout=args.timeout * 1000)
            page.wait_for_selector(
                "#captions li:nth-child(2)", timeout=max(60, args.timeout // 2) * 1000
            )
        except Exception as exc:  # noqa: BLE001
            problems.append(f"no captions appeared: {exc}")

        translations: list[str] = []
        tr_metrics: dict = {}
        if args.translate and not problems:
            translations, tr_metrics = check_translation(page, args.translate.split(","), args.timeout, problems)

        captions = page.locator("#captions li").all_inner_texts()
        badge = page.inner_text("#device-label")
        glossary = page.locator("#glossary li").count()
        status_line = page.inner_text("#live-status") if page.locator("#live-status").count() else ""

        browser.close()

    print(f"  backend    {badge}")
    print(f"  status     {status_line.strip() or '-'}")
    print(f"  captions   {len(captions)}")
    for line in captions[:4]:
        print(f"    {line.splitlines()[0][:90]}")
    print(f"  glossary   {glossary}")
    if args.translate:
        print(f"  translated {args.translate}")
        for line in translations:
            print(f"    {line[:90]}")
        if tr_metrics:
            print(f"  timing     {tr_metrics}")

    # A CSP violation reads as an ordinary console error, and it is the one
    # failure that only ever shows up on the deployment.
    blocked = [c for c in console if "Content Security Policy" in c or "Refused to" in c]
    if blocked:
        problems.append("content-security-policy blocked something:")
        problems.extend(f"    {c}" for c in blocked[:4])
    if not captions:
        problems.append("no captions at all - inference never produced text")

    if problems:
        print("\nFAILED")
        for p in problems:
            print(f"  - {p}")
        return 1

    print("\n  OK - Whisper ran in the browser and captioned real audio"
          + (f", translated into {args.translate}" if args.translate else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
