"""Does /live translate every language properly? Run the page's own translation worker on all 22.

scripts/check_languages.py judges the desktop translator. The browser build
has its own path - transformers.js, the q8 model, terms.js, and since 28 Sep
2026 word-by-word streaming - so it gets its own check. This opens the real
page with the deployment's headers, starts the real
web/static/translate-worker.js in it, and sends each language the same
lecture sentences, one at a time and then three at once (a small backlog,
which must come back whole). For every language it checks:

  - the line is in the language's script (80% of its non-Latin letters)
  - every protected technical term comes back exactly as it went in
  - no placeholder (Qx0z) leaks, in the finished line or any partial one
  - no degenerate repetition (a word four times running)
  - the streamed words arrive, and how soon

    python scripts/check_live_languages.py --model-dir ../models/nllb_q8
    python scripts/check_live_languages.py --langs hi,ur,lus

--model-dir serves a local copy of Xenova/nllb-200-distilled-600M (the
config, tokenizer and onnx/*_quantized.onnx files) from the page's own
origin, so a run takes minutes instead of a 900 MB download.
"""

from __future__ import annotations

import argparse
import http.server
import json
import re
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_live import SCRIPT_RANGES, WEB_DIR, free_port, vercel_headers  # noqa: E402

SENTENCES = [
    "Today we will start with eigenvalues and eigenvectors.",
    "A matrix is a linear transformation.",
    "Once we have a full set of eigenvectors, we can diagonalize the matrix.",
    "The determinant is a single number that tells you whether the matrix squashes space flat.",
]
MODEL_PATH = "/hf/Xenova/nllb-200-distilled-600M/"


def serve(model_dir: Path | None):
    rules = vercel_headers()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(WEB_DIR), **k)

        def log_message(self, *a, **k):  # noqa: ARG002
            pass

        def translate_path(self, path):
            clean = path.split("?", 1)[0]
            if model_dir and clean.startswith(MODEL_PATH):
                return str(model_dir / clean[len(MODEL_PATH):])
            return super().translate_path(path)

        def do_GET(self):  # noqa: N802
            if model_dir and self.path.split("?", 1)[0] == "/static/translate-worker.js":
                js = (WEB_DIR / "static" / "translate-worker.js").read_text(encoding="utf-8")
                hook = "env.allowLocalModels = false;"
                js = js.replace(hook, hook + ' env.remoteHost = self.location.origin + "/hf/";'
                                ' env.remotePathTemplate = "{model}/";', 1)
                body = js.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

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
    return httpd, f"http://127.0.0.1:{port}"


# Runs in the page: one worker, every language, every sentence; singly, then three queued at once.
RUN = """
async ({ langs, sentences, threads }) => {
  const worker = new Worker("/static/translate-worker.js", { type: "module" });
  const waiters = new Map(), partials = new Map(), firsts = new Map();
  let ready, failed;
  const readyP = new Promise((res, rej) => { ready = res; failed = rej; });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "ready") ready(m);
    else if (m.type === "error") failed(new Error(m.message));
    else if (m.type === "partial") {
      if (!firsts.has(m.id)) firsts.set(m.id, performance.now());
      (partials.get(m.id) || partials.set(m.id, []).get(m.id)).push(m.text);
    } else if (m.type === "translation" && waiters.has(m.id)) waiters.get(m.id)(m);
  };
  worker.postMessage({ type: "load", threads });
  const t0 = performance.now();
  await readyP;
  const load_s = (performance.now() - t0) / 1000;
  const ask = (id, text, lang) => new Promise((res) => {
    const sent = performance.now();
    waiters.set(id, (m) => res({ id, text, out: m.text, terms: m.terms,
      full_s: (performance.now() - sent) / 1000,
      first_s: firsts.has(id) ? (firsts.get(id) - sent) / 1000 : null,
      partials: partials.get(id) || [] }));
    worker.postMessage({ type: "translate", id, text, code: lang.code, nllb: lang.nllb });
  });
  const results = {};
  let id = 0;
  for (const lang of langs) {
    const single = [];
    for (const s of sentences) single.push(await ask(++id, s, lang));
    // Three at once: the second and third wait behind the first.
    const queued = await Promise.all(sentences.slice(0, 3).map((s) => ask(++id, s, lang)));
    results[lang.code] = { single, queued };
  }
  worker.terminate();
  return { load_s, results };
}
"""


def script_share(text: str, script: str) -> float | None:
    ranges = SCRIPT_RANGES.get(script)
    letters = [c for c in text if c.isalpha() and not c.isascii()]
    if not ranges or not letters:
        return None
    return sum(any(lo <= ord(c) <= hi for lo, hi in ranges) for c in letters) / len(letters)


def judge(lang: dict, r: dict) -> list[str]:
    """Problems with one translation, if any."""
    script = lang["nllb"].split("_")[1]
    out, problems = r["out"], []
    if not out.strip():
        return ["empty"]
    if script == "Latn":
        if out.strip().lower() == r["text"].strip().lower():
            problems.append("returned the English unchanged")
    else:
        share = script_share(out, script)
        if share is None:
            problems.append(f"no {script} letters")
        elif share < 0.8:
            problems.append(f"{share:.0%} {script}")
    for term in r["terms"]:
        if term not in out:
            problems.append(f"lost '{term}'")
    for text in [out, *r["partials"]]:
        if re.search(r"Qx\d", text, re.I):
            problems.append(f"placeholder leaked: {text[:50]}")
            break
    if re.search(r"(\b\S+\b)(?:\s+\1\b){3,}", out):
        problems.append("repeats itself")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model-dir", type=Path, help="local copy of Xenova/nllb-200-distilled-600M (q8 files)")
    ap.add_argument("--langs", help="comma-separated codes; default all 22")
    ap.add_argument("--threads", type=int, default=6)
    ap.add_argument("--channel", default="msedge", help="browser channel ('' for Playwright's Chromium)")
    ap.add_argument("--json", type=Path, help="write the full results here")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    langs = json.loads((WEB_DIR / "static" / "languages.json").read_text(encoding="utf-8"))
    if args.langs:
        want = args.langs.split(",")
        langs = [lang for lang in langs if lang["code"] in want]
    httpd, base = serve(args.model_dir.resolve() if args.model_dir else None)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel=args.channel or None)
            page = browser.new_page()
            page.goto(base + "/live/", wait_until="load")
            t0 = time.time()
            data = page.evaluate(RUN, {"langs": langs, "sentences": SENTENCES, "threads": args.threads})
            browser.close()
    finally:
        httpd.shutdown()

    failures = 0
    print(f"\n  model ready in {data['load_s']:.1f} s; {len(langs)} languages x {len(SENTENCES)} sentences, "
          f"then 3 queued at once, in {time.time() - t0:.0f} s\n")
    print(f"  {'lang':<5} {'first words':>12} {'finished':>9}  {'3 queued':>8}  result")
    for lang in langs:
        res = data["results"][lang["code"]]
        single, queued = res["single"], res["queued"]
        problems = []
        for r in single + queued:
            problems += [f"{p} (\"{r['text'][:28]}…\")" for p in judge(lang, r)]
        if not any(r["partials"] for r in single):
            problems.append("no words were streamed")
        # Queued captions must match what the same sentence gave on its own.
        for q, s in zip(queued, single[: len(queued)], strict=True):
            if q["out"] != s["out"]:
                problems.append(f"differs when queued (\"{q['text'][:28]}…\")")
        firsts = sorted(r["first_s"] for r in single if r["first_s"] is not None)
        fulls = sorted(r["full_s"] for r in single)
        first = f"{firsts[len(firsts) // 2]:.2f} s" if firsts else "-"
        full = f"{fulls[len(fulls) // 2]:.2f} s"
        bt = f"{max(r['full_s'] for r in queued):.1f} s"
        status = "ok" if not problems else "FAIL: " + "; ".join(problems[:3])
        failures += bool(problems)
        print(f"  {lang['code']:<5} {first:>12} {full:>9}  {bt:>8}  {status}")
        print(f"        {single[0]['out'][:110]}")
    if args.json:
        args.json.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n  {'OK' if not failures else f'{failures} language(s) FAILED'}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
