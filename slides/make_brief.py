"""The brief project description the submission form asks for, as a two-page A4 PDF.

    python slides/make_brief.py [out.pdf]

Every number is one the README and docs/ already cite, with its source named
in the text. Rendered by Playwright (Edge or Chromium), no network needed.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "Sahaay_brief.pdf"
SITE = "https://sahaay-offline.vercel.app"
REPO = "https://github.com/andringodson/Hackathon-SnapdragonAILab"
FILM = REPO + "/releases/tag/submission-v2"
LOGO = (ROOT / "web" / "static" / "logo.svg").read_text(encoding="utf-8")

HTML = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sahaay - project description</title>
<style>
  @page {{ size: A4; margin: 16mm 17mm 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font: 10.3pt/1.5 "Segoe UI", Calibri, Arial, sans-serif; color: #16202b; margin: 0; }}
  h1 {{ font: 700 25pt/1.1 Arial, sans-serif; margin: 0; letter-spacing: -0.01em; }}
  h2 {{ font: 700 12.5pt/1.25 Arial, sans-serif; margin: 15pt 0 5pt; color: #0b6fc7; }}
  p {{ margin: 0 0 6pt; }}
  a {{ color: #0b6fc7; text-decoration: none; }}
  .top {{ display: flex; gap: 12pt; align-items: center; }}
  .top svg {{ width: 42pt; height: 42pt; flex: none; }}
  .tag {{ font-size: 11.5pt; color: #5b6775; margin-top: 2pt; }}
  .eyebrow {{ font: 700 7.5pt Arial, sans-serif; letter-spacing: 0.18em; color: #0b6fc7; margin-bottom: 8pt; }}
  .lede {{ font-size: 11.5pt; margin: 12pt 0 8pt; }}
  .links {{ display: grid; grid-template-columns: auto 1fr; gap: 2pt 10pt; font-size: 9.6pt; background: #f1f5fa;
           border-radius: 6pt; padding: 8pt 11pt; margin: 8pt 0 2pt; }}
  .links b {{ color: #5b6775; font-weight: 600; }}
  .quote {{ background: #f1f5fa; border-radius: 6pt; padding: 8pt 12pt; font-size: 11.5pt; margin: 4pt 0 7pt; }}
  .quote b {{ color: #0b6fc7; }}
  ul {{ margin: 0 0 6pt; padding-left: 14pt; }}
  li {{ margin-bottom: 3pt; }}
  table {{ break-inside: avoid; border-collapse: collapse; width: 100%; font-size: 9.6pt; margin: 4pt 0 6pt; }}
  th {{ text-align: left; font: 700 7.6pt Arial, sans-serif; letter-spacing: 0.08em; color: #5b6775; background: #eaeff5; padding: 5pt 7pt; }}
  td {{ padding: 5pt 7pt; border-bottom: 0.6pt solid #dce2ea; }}
  td.n {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .good {{ color: #00875a; font-weight: 600; }} .bad {{ color: #c2412d; font-weight: 600; }}
  .two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; }}
  .note {{ font-size: 8.8pt; color: #5b6775; }}
  .break {{ break-before: page; }}
  .foot {{ margin-top: 14pt; font-size: 8.6pt; color: #5b6775; border-top: 0.6pt solid #dce2ea; padding-top: 6pt; }}
</style></head><body>

<div class="eyebrow">SNAPDRAGON® AI LAB BUILD &amp; PRESENT CHALLENGE 2026 · PROJECT DESCRIPTION</div>
<div class="top">{LOGO}<div><h1>Sahaay: the lecture understands you, offline</h1>
<div class="tag">सहाय (“help”) · live lecture captions, Indian-language translation and a jargon glossary, on the device</div></div></div>

<p class="lede">Sahaay listens to any lecture playing on a laptop - a Zoom call, a YouTube video, a professor in
the room - and does three things live: it <b>captions</b> the speech, <b>translates</b> each line into one of
<b>22 Indian languages</b> with the technical terms kept intact, and <b>explains the jargon</b> as it is spoken.
Whisper transcribes, NLLB-200 translates and Llama 3.2 explains, all on the device, with the speech model on the
Snapdragon Hexagon NPU. No audio, no text and no account ever leaves the machine.</p>

<div class="links">
  <b>Try it (no install)</b><a href="{SITE}/live/">{SITE[8:]}/live</a>
  <b>Demo video (2:00)</b><a href="{FILM}">github.com/andringodson/Hackathon-SnapdragonAILab/releases/tag/submission-v2</a>
  <b>Recorded session</b><a href="{SITE}/demo/?play=1">{SITE[8:]}/demo</a>
  <b>Source</b><a href="{REPO}">github.com/andringodson/Hackathon-SnapdragonAILab</a>
</div>

<h2>The problem</h2>
<p>An engineering lecture in India is rarely in one language:</p>
<div class="quote">“Matrix A ka <b>determinant</b> zero hoga, tabhi non-trivial <b>solution</b> milega.”</div>
<p>A student following that in their second language has two problems at once: parse a Hindi sentence, and hold on
to the English technical terms - the exact terms that appear in the textbook and the exam. Cloud captioning handles
code-mixing badly, costs money per minute, and needs connectivity that a lecture hall, a hostel or a rural college
often does not have. A student who is deaf or hard of hearing cannot wait for a slow round-trip mid-sentence.</p>

<h2>What it does</h2>
<ul>
  <li><b>Captions</b> whatever is playing (WASAPI loopback, no virtual cable) and the microphone; Silero VAD splits at pauses so captions break where sentences do.</li>
  <li><b>Translates</b> each line into any of 22 Indian languages with NLLB-200, protecting technical terms first, so “eigenvalues” stays “eigenvalues” in every script - checked for all 22.</li>
  <li><b>Explains jargon</b> in a sidebar as it is spoken, and writes notes, a glossary and a five-question self-test when the lecture ends.</li>
  <li><b>Works offline</b>: there is no network call in the audio path, and a test proves it by running a full session with every outbound socket blocked.</li>
</ul>

<div class="break"></div>
<h2 style="margin-top:0">Why it needs the Snapdragon NPU - measured, not asserted</h2>
<p>Sahaay runs two models continuously for a whole lecture. On a CPU they compete for the same cores, and the
captions are what lose (Whisper Small, real recorded speech, <span class="note">docs/CONCURRENCY.md</span>):</p>
<table>
  <tr><th>ON A LAPTOP CPU</th><th style="text-align:right">WHISPER LATENCY, MEAN</th><th style="text-align:right">REAL-TIME FACTOR</th></tr>
  <tr><td>Glossary model idle</td><td class="n">3,276 ms</td><td class="n good">0.41 - keeps up</td></tr>
  <tr><td>Glossary model running</td><td class="n">12,400 ms</td><td class="n bad">1.55 - falls behind</td></tr>
</table>
<p>Above a real-time factor of 1.0, transcription is slower than the speech arriving, so the captions fall further
behind every minute. On a Snapdragon PC the Whisper encoder runs on the Hexagon NPU instead, on silicon of its own.
Measured on Qualcomm AI Hub (<span class="note">docs/AIHUB.md; the job pages need a Qualcomm ID sign-in</span>):</p>
<table>
  <tr><th>WHISPER ENCODER (TINY.EN), ONE 30 S WINDOW</th><th style="text-align:right">ON-DEVICE</th><th style="text-align:right">LAYERS ON NPU</th><th style="text-align:right">AI HUB JOB</th></tr>
  <tr><td>Snapdragon X2 Elite CRD</td><td class="n good">13.47 ms</td><td class="n">129 / 129</td><td class="n">jglyo70e5</td></tr>
  <tr><td>Snapdragon X Elite CRD</td><td class="n good">27.56 ms</td><td class="n">129 / 129</td><td class="n">j5m0o4zyg</td></tr>
  <tr><td>Snapdragon X Plus 8-Core CRD</td><td class="n good">26.76 ms</td><td class="n">129 / 129</td><td class="n">jpxl3m7jp</td></tr>
</table>

<h2>Built to be checked</h2>
<div class="two"><div>
<ul>
  <li><b>Two commands</b>: <code>install.ps1</code>, then <code>run.bat</code>. Every stage degrades rather than failing, and <code>--mock</code> runs the whole pipeline with nothing downloaded.</li>
  <li><b>400+ tests</b> in CI on Windows x86, Windows ARM64 and Linux, on every push.</li>
  <li><b>Accessible</b>: resizable captions, live regions, reduced motion, full keyboard control. Binds to 127.0.0.1; no telemetry, no account, audio never written to disk.</li>
</ul></div><div>
<ul>
  <li><b>Runs in the browser too</b> (<a href="{SITE}/live/">/live</a>): Whisper and NLLB-200 on the visitor's own CPU, audio never leaving the tab. Translations stream word by word: on a 12-core laptop the first words show about 1.4 s after the caption.</li>
  <li><b>Every number has a source</b> in the repository, and the site links each one to it.</li>
</ul></div></div>

<h2>What is not proven yet - stated rather than left to find</h2>
<ul>
  <li>The full three-model pipeline has not run on a physical Snapdragon PC; individual graphs have, on Qualcomm's device farm, at 129/129 layers.</li>
  <li>Word error rate is measured against synthesised speech: a floor, not a field result. Real speakers are next.</li>
  <li>The NPU column of the concurrency table is empty until the benchmark runs on Snapdragon hardware - one command, <code>scripts/concurrency.py --write</code>.</li>
</ul>

<h2>Tech stack</h2>
<p>Python, ONNX Runtime (QNN execution provider for the Hexagon NPU), Qualcomm AI Hub, Whisper Small, NLLB-200 distilled
600M, Llama 3.2, Silero VAD, FastAPI and WebSockets; transformers.js with WebGPU and WebAssembly for the browser build;
vanilla HTML, CSS and JavaScript for the interface.</p>

<div class="foot">Sahaay - a Hackathon Project by AndrinGodson · <a href="{REPO}">github.com/andringodson/Hackathon-SnapdragonAILab</a> · MIT licence</div>
</body></html>"""


def main() -> int:
    html = ROOT / "slides" / "_brief.html"
    html.write_text(HTML, encoding="utf-8")
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(channel="msedge")
        except Exception:  # noqa: BLE001
            browser = pw.chromium.launch()
        page = browser.new_page()
        page.goto(html.as_uri(), wait_until="load")
        page.pdf(path=str(OUT), format="A4", print_background=True, prefer_css_page_size=True)
        browser.close()
    html.unlink()
    print(OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
