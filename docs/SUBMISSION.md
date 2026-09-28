# Submission kit

Everything the Unstop form for the **Snapdragon AI Lab Build & Present
Challenge 2026** is likely to ask for, ready to paste. Deadline: **30 September
2026, 11:59 PM IST**. One submission, so check it once before pressing submit.

## Files to upload

| What | Where |
|---|---|
| Demo video (2:00, 1080p60, original score) | Release [`submission-v2`](https://github.com/andringodson/Hackathon-SnapdragonAILab/releases/tag/submission-v2): `Sahaay_showreel.mp4` |
| Presentation (11 slides, PDF) | Same release: `Sahaay_deck.pdf` |

The showreel is rebuilt with [`brag-output/`](../brag-output/README.md), the
deck with `python slides/export_pdf.py`. The older narrated walkthrough (2:51,
release `submission-v1`, [`video/`](../video/README.md)) still says the AI Hub
job links are public; they open after signing in with a Qualcomm ID, so
submit the showreel.

## Links

- **Try it (no install):** https://sahaay-offline.vercel.app/live/
- **Recorded desktop session:** https://sahaay-offline.vercel.app/demo/?play=1
- **Project site and evidence:** https://sahaay-offline.vercel.app
- **Source:** https://github.com/andringodson/Hackathon-SnapdragonAILab

> The repository is **private**. If the form asks for a source link, judges
> will get a 404 unless it is made public or they are added as collaborators.
> Every "method and full results" link on the site points into it as well.

## Project title

Sahaay: the lecture understands you, offline

## One-line summary

Live lecture captions, Indian-language translation and a jargon glossary,
running entirely on a Snapdragon PC with the network switched off.

## Short description (about 100 words)

Sahaay listens to any lecture playing on a laptop and shows live captions,
translates them into 22 Indian languages, and explains technical terms as
they are spoken. Everything runs on the device: Whisper for speech, NLLB-200
for translation, Llama 3.2 for the glossary. No audio leaves the machine.
The case for Snapdragon is measured, not asserted: on a CPU, running the
glossary model alongside Whisper pushes the real-time factor from 0.41 to
1.55, so captions fall behind. On Qualcomm's device farm the Whisper encoder
runs in 13.47 ms with all 129 layers on the Hexagon NPU.

## Longer description

**Problem.** Engineering lectures in India are code-mixed: "Matrix A ka
determinant zero hoga, tabhi non-trivial solution milega." A student following
in a second language has to parse the sentence and hold on to English terms
that appear in the textbook and the exam. Cloud captioning handles code-mixing
poorly, costs per minute, and needs connectivity many halls, hostels and
colleges do not have.

**What it does.** Sahaay captures whatever is playing (WASAPI loopback, no
virtual cable), splits speech at pauses with Silero VAD, transcribes with
Whisper, translates with NLLB-200 while protecting technical terms so
"eigenvalue" stays "eigenvalue", and explains jargon in a sidebar with Llama
3.2. When the lecture ends it writes notes: topics, key points and a glossary.

**Why it needs the NPU.** Two compute-bound models on one set of CPU cores
compete, and the captions are what lose: Whisper Small's real-time factor goes
from 0.41 to 1.55 when the glossary runs. Moving the Whisper encoder to the
Hexagon NPU removes the contention. Measured on Qualcomm AI Hub: 13.47 ms on
Snapdragon X2 Elite, 27.56 ms on X Elite, 26.76 ms on X Plus, 129/129 layers
on the NPU each time, and every number has its AI Hub job ID.

**Deployment and accessibility.** `install.ps1` then `run.bat`; every stage
degrades rather than failing, and `--mock` runs with nothing downloaded. 400+
tests run in CI on Windows x86, Windows ARM64 and Linux. Offline is a test,
not a claim: a full session runs with outbound sockets patched to fail.
Resizable captions, live regions, reduced motion, keyboard control; binds to
127.0.0.1 with no telemetry.

**What is not proven yet.** The full three-model pipeline has not run on a
physical Snapdragon PC (individual graphs have, on the device farm), and word
error rate is measured against synthesised speech.

## Tech stack

Python, ONNX Runtime (QNN execution provider for the Hexagon NPU), Qualcomm AI
Hub, Whisper Small, NLLB-200, Llama 3.2 3B, Silero VAD, FastAPI and
WebSockets; transformers.js with WebGPU/WebAssembly for the browser build;
vanilla HTML, CSS and JavaScript for the UI.
