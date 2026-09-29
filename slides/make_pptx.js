/* The pitch deck as an editable PowerPoint, for forms that ask for a .pptx.

   Same eleven slides, words and speaker notes as the HTML deck
   (slides/make_deck.py) and its PDF (slides/export_pdf.py): the real-time
   factor comparison is a native chart and the device-farm results a native
   table, so both can be edited in PowerPoint. Fonts are Arial and Calibri,
   which every PowerPoint has.

     npm install pptxgenjs react react-dom react-icons sharp
     node slides/make_pptx.js [out.pptx]
*/
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const { FiMessageSquare, FiGlobe, FiCloudOff } = require("react-icons/fi");

const REPO = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(REPO, "Sahaay_deck.pptx"));
const SITE = "https://sahaay-offline.vercel.app";
const REPO_URL = "https://github.com/andringodson/Hackathon-SnapdragonAILab";

// Palette: the product's, one blue doing most of the work.
const C = {
  darkBg: "0A0F16", darkCard: "121A24", darkLine: "243140",
  onD: "E8EDF2", onDDim: "93A0AE", accD: "4DB8FF",
  lightBg: "F4F6F9", card: "FFFFFF", lineL: "DCE2EA",
  onL: "16202B", onLDim: "5B6775", accL: "0B6FC7",
  warn: "E09A2C", warnL: "A45F00", red: "E5533D",
  greenL: "00875A", greenD: "3DDC97", tint: "E4F0FB",
};
const HEAD = "Arial";
const BODY = "Calibri";
const W = 13.333;
const M = 0.6;                         // side margin

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Andrin Godson";
pres.title = "Sahaay - Snapdragon AI Lab Build & Present Challenge 2026";

// ---------- helpers ----------
const t = (slide, text, opts) => slide.addText(text, Object.assign({ isTextBox: true, fontFace: BODY, margin: 0, valign: "top" }, opts));
function eyebrow(slide, text, color, y = 0.6) {
  t(slide, text, { x: M, y, w: 11, h: 0.3, fontFace: HEAD, fontSize: 11, bold: true, color, charSpacing: 3 });
}
function title(slide, text, color, y = 0.98, size = 34, h = 0.8) {
  t(slide, text, { x: M, y, w: W - 2 * M, h, fontFace: HEAD, fontSize: size, bold: true, color });
}
function footer(slide, text, color, link) {
  t(slide, link ? [{ text, options: { hyperlink: { url: link } } }] : text,
    { x: M, y: 6.92, w: W - 2 * M, h: 0.3, fontSize: 10.5, color });
}
function card(slide, x, y, w, h, dark, lineColor) {
  const opts = {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: dark ? C.darkCard : C.card },
    line: { color: lineColor || (dark ? C.darkLine : C.lineL), width: 0.75 },
  };
  if (!dark) opts.shadow = { type: "outer", color: "8A96A6", opacity: 0.18, blur: 8, offset: 2, angle: 90 };
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, opts);
}
async function iconPng(Icon, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { size: px, color: "#" + color, strokeWidth: 1.8 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function glowBackground(cx, cy) {
  // A radial glow on near-black, as the HTML deck's bookend slides have.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="0.75">
      <stop offset="0" stop-color="#16456d"/><stop offset="0.45" stop-color="#0c2138"/><stop offset="1" stop-color="#0a0f16"/>
    </radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function main() {
  // ---------- 1 cover ----------
  let s = pres.addSlide();
  s.background = { data: await glowBackground(0.1, 0.05) };
  eyebrow(s, "SNAPDRAGON® AI LAB BUILD & PRESENT CHALLENGE 2026", C.accD, 1.1);
  t(s, "Sahaay", { x: M, y: 1.55, w: 8, h: 1.3, fontFace: HEAD, fontSize: 80, bold: true, color: C.onD });
  t(s, "The lecture understands you — offline", { x: M, y: 2.95, w: 9, h: 0.6, fontSize: 30, color: C.onD });
  t(s, "Live captions, Indian-language translation and a jargon glossary, running entirely on a Snapdragon-powered PC with the network switched off.",
    { x: M, y: 3.75, w: 7.6, h: 0.8, fontSize: 17, color: C.onDDim });
  // The logo's idea as a waveform: sound on the left becoming text.
  for (let i = 0; i < 64; i++) {
    const hgt = 0.08 + 0.55 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37));
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: M + i * 0.118, y: 5.3 - hgt / 2, w: 0.055, h: hgt, rectRadius: 0.027,
      fill: { color: i % 9 === 4 ? C.onD : C.accD, transparency: i % 9 === 4 ? 10 : 25 }, line: { type: "none" },
    });
  }
  t(s, [
    { text: "sahaay-offline.vercel.app", options: { hyperlink: { url: SITE } } },
    { text: "  ·  " },
    { text: "github.com/andringodson/Hackathon-SnapdragonAILab", options: { hyperlink: { url: REPO_URL } } },
  ], { x: M, y: 6.92, w: 11, h: 0.3, fontSize: 11, color: C.onDDim });
  s.addNotes("Open with the name and one sentence, not the tech stack. Leave the URL on screen: a judge who wants to check a number can, mid-talk.");

  // ---------- 2 problem ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "THE PROBLEM", C.accL);
  title(s, "An engineering lecture in India is rarely in one language", C.onL, 0.98, 34, 1.2);
  card(s, M, 2.45, W - 2 * M, 1.15, false);
  t(s, [
    { text: "“Matrix A ka " }, { text: "determinant", options: { bold: true, color: C.accL } },
    { text: " zero hoga, tabhi non-trivial " }, { text: "solution", options: { bold: true, color: C.accL } },
    { text: " milega.”" },
  ], { x: M + 0.4, y: 2.45, w: W - 2 * M - 0.8, h: 1.15, fontSize: 26, color: C.onL, valign: "middle" });
  t(s, "A student following that in their second language has two problems at once: parse a Hindi sentence, and hold on to the English technical terms — the exact terms that appear in the textbook and the exam.",
    { x: M, y: 4.05, w: 5.8, h: 1.6, fontSize: 17, color: C.onLDim });
  t(s, "Cloud captioning handles code-mixing badly, costs money per minute, and needs connectivity a lecture hall, a hostel or a rural college often does not have.",
    { x: 6.95, y: 4.05, w: 5.8, h: 1.6, fontSize: 17, color: C.onLDim });
  footer(s, "The problem", C.onLDim);
  s.addNotes("Read the sentence aloud. It does the work: everyone in the room recognises it instantly.");

  // ---------- 3 who ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "WHO THIS IS FOR", C.accL);
  title(s, "Three people, one product", C.onL);
  const who = [
    [FiMessageSquare, "Deaf and hard of hearing", "A cloud round-trip is too slow to follow a sentence in progress."],
    [FiGlobe, "Studying in a second language", "The lecture is in English; the thinking is in Hindi, Tamil, Bengali."],
    [FiCloudOff, "No usable connectivity", "A hall, a hostel, a bus. Bandwidth is not a given."],
  ];
  const cw = (W - 2 * M - 2 * 0.35) / 3;
  for (let i = 0; i < 3; i++) {
    const [Icon, h, b] = who[i];
    const x = M + i * (cw + 0.35);
    card(s, x, 2.0, cw, 3.1, false);
    s.addShape(pres.shapes.OVAL, { x: x + 0.4, y: 2.4, w: 0.8, h: 0.8, fill: { color: C.tint }, line: { type: "none" } });
    s.addImage({ data: await iconPng(Icon, C.accL), x: x + 0.58, y: 2.58, w: 0.44, h: 0.44 });
    t(s, h, { x: x + 0.4, y: 3.45, w: cw - 0.8, h: 0.8, fontFace: HEAD, fontSize: 19, bold: true, color: C.onL });
    t(s, b, { x: x + 0.4, y: 4.3, w: cw - 0.8, h: 0.7, fontSize: 16, color: C.onLDim });
  }
  t(s, "Three needs, and often one student, in the same lecture hall.", { x: M, y: 5.55, w: W - 2 * M, h: 0.5, fontSize: 18, color: C.onL });
  footer(s, "Who this is for", C.onLDim);
  s.addNotes("Do not linger. One breath per card, then the last line slowly.");

  // ---------- 4 demo ----------
  s = pres.addSlide();
  s.background = { color: C.darkBg };
  eyebrow(s, "DEMO", C.accD, 1.25);
  t(s, "A lecture plays. The captions keep up.", { x: M, y: 1.65, w: 4.4, h: 1.5, fontFace: HEAD, fontSize: 32, bold: true, color: C.onD });
  t(s, "Hindi captions with the English technical terms left intact, and the jargon explaining itself in the sidebar as it is spoken.",
    { x: M, y: 3.35, w: 4.3, h: 1.4, fontSize: 17, color: C.onDDim });
  t(s, "Then I turn the Wi-Fi off, and nothing changes.", { x: M, y: 4.85, w: 4.3, h: 0.8, fontSize: 19, color: C.accD });
  s.addImage({ path: path.join(REPO, "docs", "img", "demo.png"), x: 5.35, y: 1.25, w: 7.38, h: 4.61,
    altText: "The Sahaay app mid-lecture: English captions, each translated into Hindi with technical terms kept in English, and a jargon panel." });
  s.addShape(pres.shapes.RECTANGLE, { x: 5.35, y: 1.25, w: 7.38, h: 4.61, fill: { type: "none" }, line: { color: C.darkLine, width: 1 } });
  footer(s, "Live demo · fallback replay at sahaay-offline.vercel.app/demo", C.onDDim, SITE + "/demo/");
  s.addNotes("Turn the Wi-Fi off on camera. It is the strongest fifteen seconds you have - do not cut it, and do not explain it first. Two fallbacks if the machine misbehaves: sahaay-offline.vercel.app/live runs Whisper in the browser on any laptop in the room, and /demo replays a recorded session in the same interface.");

  // ---------- 5 npu ----------
  s = pres.addSlide();
  s.background = { color: C.darkBg };
  eyebrow(s, "WHY THIS NEEDS AN NPU", C.accD);
  title(s, "Turn the glossary on, and a CPU stops keeping up", C.onD);
  card(s, M, 1.85, 7.9, 3.75, true);
  s.addChart(pres.charts.BAR, [
    // A horizontal bar chart draws its last series on top: running first, so idle reads first.
    { name: "Glossary running", labels: ["Whisper Small on a CPU"], values: [1.55] },
    { name: "Glossary idle", labels: ["Whisper Small on a CPU"], values: [0.41] },
  ], {
    x: M + 0.2, y: 1.95, w: 7.5, h: 3.55, barDir: "bar", barGapWidthPct: 45,
    chartColors: [C.red, C.accD],
    showTitle: true, title: "Real-time factor (above 1.0, the captions fall behind)", titleColor: C.onD, titleFontSize: 13, titleFontFace: BODY,
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.onD, dataLabelFontSize: 14, dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 2, valAxisMajorUnit: 0.5, valAxisLabelColor: C.onDDim, valAxisLabelFormatCode: "0.0",
    valGridLine: { color: C.darkLine, size: 0.75 }, catAxisHidden: true, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendColor: C.onD, legendFontSize: 12,
  });
  t(s, "0.41", { x: 8.95, y: 1.95, w: 3.8, h: 0.9, fontFace: HEAD, fontSize: 54, bold: true, color: C.accD });
  t(s, "glossary idle · 3,276 ms per caption · keeps up", { x: 8.95, y: 2.85, w: 3.8, h: 0.5, fontSize: 14, color: C.onDDim });
  t(s, "1.55", { x: 8.95, y: 3.65, w: 3.8, h: 0.9, fontFace: HEAD, fontSize: 54, bold: true, color: C.red });
  t(s, "glossary running · 12,400 ms per caption · falls behind", { x: 8.95, y: 4.55, w: 3.8, h: 0.6, fontSize: 14, color: C.onDDim });
  t(s, "Below 1.0, transcription finishes faster than speech arrives. Above it, every minute of lecture takes more than a minute to caption — so the captions fall behind and never catch up.",
    { x: M, y: 5.85, w: W - 2 * M, h: 0.8, fontSize: 16, color: C.onD });
  footer(s, "CPU, Whisper Small, real recorded speech · docs/CONCURRENCY.md", C.onDDim);
  s.addNotes("This is the one slide that has to land. Point at the red bar and say it plainly: on a CPU, turning the glossary on pushes the captions past real time. If asked \"why not a smaller model?\" - because the glossary IS the feature, and a smaller model writes worse explanations. The NPU is how you keep both.");

  // ---------- 6 architecture ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "ARCHITECTURE", C.accL);
  title(s, "How it fits together", C.onL);
  const stages = [
    ["CPU", "Loopback capture", "Whatever is playing. No virtual cable, no driver."],
    ["CPU", "Silero VAD", "Splits on pauses, so captions break where sentences do."],
    ["NPU", "Whisper Small", "Transcription and per-segment language detection."],
    ["NPU TARGET", "NLLB-200", "22 Indian languages, technical terms protected."],
    ["NPU TARGET", "Llama 3.2", "Glossary live; notes and a self-test at the end."],
  ];
  const tag = { "CPU": ["E6EAF0", C.onLDim], "NPU": ["DDF3E8", C.greenL], "NPU TARGET": ["FCEFD8", C.warnL] };
  const gap = 0.3, sw = (W - 2 * M - 4 * gap) / 5;
  for (let i = 0; i < 5; i++) {
    const [k, h, b] = stages[i];
    const x = M + i * (sw + gap);
    card(s, x, 1.95, sw, 2.75, false);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: 2.2, w: sw - 0.5, h: 0.34, rectRadius: 0.06, fill: { color: tag[k][0] }, line: { type: "none" } });
    t(s, k, { x: x + 0.35, y: 2.2, w: sw - 0.7, h: 0.34, fontFace: HEAD, fontSize: 10.5, bold: true, color: tag[k][1], valign: "middle", charSpacing: 1 });
    t(s, h, { x: x + 0.25, y: 2.75, w: sw - 0.5, h: 0.75, fontFace: HEAD, fontSize: 17, bold: true, color: C.onL });
    t(s, b, { x: x + 0.25, y: 3.5, w: sw - 0.5, h: 1.1, fontSize: 14, color: C.onLDim });
    if (i < 4) t(s, "›", { x: x + sw + 0.02, y: 3.05, w: gap - 0.04, h: 0.5, fontSize: 24, color: C.onLDim, align: "center" });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.05, w: W - 2 * M, h: 1.35, rectRadius: 0.08, fill: { color: C.tint }, line: { type: "none" } });
  t(s, [
    { text: "Three threads, and both queues drop the " }, { text: "oldest", options: { italic: true } }, { text: " item under pressure" },
  ], { x: M + 0.4, y: 5.25, w: W - 2 * M - 0.8, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: C.onL });
  t(s, "Because a caption four minutes late is worse than no caption at all. Staying near the live edge is the whole job.",
    { x: M + 0.4, y: 5.75, w: W - 2 * M - 0.8, h: 0.5, fontSize: 16, color: C.onLDim });
  footer(s, "Architecture · docs/ARCHITECTURE.md", C.onLDim);
  s.addNotes("Do not narrate all five boxes. Point at them once, then spend the time on the queue policy - it is the design decision that shows you thought about a live captioner rather than a batch transcriber.");

  // ---------- 7 proof ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "PROOF IT IS ON THE NPU", C.accL);
  title(s, "Measured on Qualcomm’s own device farm", C.onL);
  const hdr = (text, align = "left") => ({ text, options: { bold: true, color: C.onLDim, fontSize: 11, fontFace: HEAD, align, fill: { color: "EAEFF5" } } });
  const cell = (text, o = {}) => ({ text, options: Object.assign({ fontSize: 16, color: C.onL }, o) });
  s.addTable([
    [hdr("WHISPER ENCODER (tiny.en)"), hdr("ON-DEVICE", "right"), hdr("LAYERS ON NPU", "right"), hdr("AI HUB JOB", "right")],
    [cell("Snapdragon X2 Elite CRD", { bold: true }), cell("13.47 ms", { bold: true, color: C.greenL, align: "right" }), cell("129 / 129", { color: C.greenL, align: "right" }), cell("jglyo70e5", { color: C.onLDim, align: "right", fontFace: "Consolas" })],
    [cell("Snapdragon X Elite CRD"), cell("27.56 ms", { color: C.greenL, align: "right" }), cell("129 / 129", { color: C.greenL, align: "right" }), cell("j5m0o4zyg", { color: C.onLDim, align: "right", fontFace: "Consolas" })],
    [cell("Snapdragon X Plus 8-Core CRD"), cell("26.76 ms", { color: C.greenL, align: "right" }), cell("129 / 129", { color: C.greenL, align: "right" }), cell("jpxl3m7jp", { color: C.onLDim, align: "right", fontFace: "Consolas" })],
  ], { x: M, y: 1.9, w: W - 2 * M, colW: [5.3, 2.2, 2.3, 2.333], rowH: [0.42, 0.5, 0.5, 0.5], fontFace: BODY, valign: "middle",
       border: { type: "solid", color: C.lineL, pt: 0.75 }, fill: { color: "FFFFFF" }, margin: [0, 0.15, 0, 0.15] });
  const proofCards = [
    ["129 of 129 layers", C.greenL, "Not “targeted the NPU”. Qualcomm’s own profiler reports zero CPU fallback for the whole graph."],
    ["The tool says “no”", C.accL, "On x86, --device prints “Hexagon NPU active: no”. A tool that only ever reports success is not evidence."],
  ];
  for (let i = 0; i < 2; i++) {
    const x = M + i * ((W - 2 * M) / 2 + 0.15);
    const w = (W - 2 * M) / 2 - 0.15;
    card(s, x, 4.3, w, 1.95, false);
    t(s, proofCards[i][0], { x: x + 0.4, y: 4.55, w: w - 0.8, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: proofCards[i][1] });
    t(s, proofCards[i][2], { x: x + 0.4, y: 5.1, w: w - 0.8, h: 1.0, fontSize: 16, color: C.onLDim });
  }
  footer(s, "Job IDs on Qualcomm AI Hub (the job pages need a Qualcomm ID sign-in) · docs/AIHUB.md", C.onLDim);
  s.addNotes("Have one job open in a tab, signed in with your Qualcomm ID - the pages are not public - and docs/AIHUB.md beside it with the job IDs visible. The credibility beat is the second card: show --device reporting \"no\" on the laptop you are presenting from.");

  // ---------- 8 honesty ----------
  s = pres.addSlide();
  s.background = { color: C.darkBg };
  eyebrow(s, "ENGINEERING HONESTY", C.warn);
  title(s, "Two things I got wrong", C.onD);
  card(s, M, 1.85, W - 2 * M, 2.55, true);
  t(s, "The benchmark measured the wrong model", { x: M + 0.4, y: 2.05, w: W - 2 * M - 0.8, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: C.warn });
  t(s, [
    { text: "The published figure was RTF 0.043; the product, alone on a CPU, runs at 0.41. The model id is " },
    { text: "auto", options: { bold: true } },
    { text: ", so what got benchmarked was whichever weights happened to be on the machine — Whisper Tiny, not the Small the product ships. Neither the model nor the signal was recorded, so nobody could check it." },
  ], { x: M + 0.4, y: 2.55, w: W - 2 * M - 0.8, h: 1.0, fontSize: 15.5, color: C.onD });
  t(s, "Both harnesses now print the model and the signal beside every number. Correcting it reversed the previous slide — for the worse, and in the NPU’s favour.",
    { x: M + 0.4, y: 3.6, w: W - 2 * M - 0.8, h: 0.65, fontSize: 14, color: C.onDDim });
  card(s, M, 4.6, W - 2 * M, 2.05, true);
  t(s, "Term protection was wired up but never seeded", { x: M + 0.4, y: 4.8, w: W - 2 * M - 0.8, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: C.warn });
  t(s, "Telugu translated “eigenvalues” into “self values” — the exact failure the feature exists to prevent. Only real weights against speech with known ground truth caught it.",
    { x: M + 0.4, y: 5.3, w: W - 2 * M - 0.8, h: 0.7, fontSize: 15.5, color: C.onD });
  t(s, "A feature that exists in the code is not a feature that works.", { x: M + 0.4, y: 6.05, w: W - 2 * M - 0.8, h: 0.4, fontSize: 14, color: C.onDDim });
  footer(s, "Engineering honesty", C.onDDim);
  s.addNotes("This slide is worth more than another feature. Every judge on a Qualcomm panel has shipped a wrong benchmark. Mention the QNN trap too if there is time: pip install onnxruntime-qnn is not sufficient - without an explicit register_execution_provider_library call the app silently runs on CPU on the Snapdragon device itself.");

  // ---------- 9 deployment ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "DEPLOYMENT AND ACCESSIBILITY", C.accL);
  title(s, "Two commands — and one deliberate refusal", C.onL);
  t(s, [
    { text: "install.ps1", options: { bold: true, color: C.onL } }, { text: ", then " }, { text: "run.bat", options: { bold: true, color: C.onL } },
    { text: ". No Node, no build step, no Docker. Every stage degrades rather than failing, and " },
    { text: "--mock", options: { bold: true, color: C.onL } }, { text: " runs the whole pipeline with nothing downloaded.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "400+ tests", options: { bold: true, color: C.onL } },
    { text: ", green on Windows x86, Windows ARM64 and Linux — with no weights and no audio device.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "Resizable captions, live regions, reduced motion, full keyboard control. Binds to 127.0.0.1. No telemetry, no account, audio never written to disk." },
  ], { x: M, y: 1.95, w: 5.9, h: 4.4, fontSize: 16, color: C.onLDim, paraSpaceAfter: 2 });
  card(s, 6.95, 1.9, W - M - 6.95, 4.5, false, C.accL);
  t(s, "Nothing is hosted. Try it anyway.", { x: 7.35, y: 2.2, w: W - M - 7.75, h: 0.5, fontFace: HEAD, fontSize: 21, bold: true, color: C.accL });
  t(s, [
    { text: "The site runs Whisper in " }, { text: "your", options: { italic: true } },
    { text: " browser — static files, your own CPU, audio that never leaves the tab. The same claim the desktop app makes, on hardware you already have." },
  ], { x: 7.35, y: 2.85, w: W - M - 7.75, h: 1.4, fontSize: 16, color: C.onL });
  t(s, "Watch the RTF badge while it runs: about 0.5 with one model. Slide five is what a second model on the same cores does to it.",
    { x: 7.35, y: 4.3, w: W - M - 7.75, h: 1.0, fontSize: 15, color: C.onLDim });
  t(s, [{ text: "sahaay-offline.vercel.app/live", options: { hyperlink: { url: SITE + "/live/" } } }],
    { x: 7.35, y: 5.55, w: W - M - 7.75, h: 0.4, fontSize: 16, bold: true, color: C.accL });
  footer(s, "Deployment and accessibility · docs/WEB.md", C.onLDim);
  s.addNotes("The right-hand card is the best invitation in the deck: tell them to open it on their phone now. The captions keep up with one model; slide five is what happens when the glossary model joins on the same cores. The pipeline still is not hosted - no NPU, no system audio - and saying that out loud pre-empts the obvious question.");

  // ---------- 10 next ----------
  s = pres.addSlide();
  s.background = { color: C.lightBg };
  eyebrow(s, "WHAT IS NEXT", C.warnL);
  title(s, "What is not proven yet", C.onL);
  const gaps = [
    ["The full pipeline has never run on physical Snapdragon hardware", "Individual graphs have, on Qualcomm’s device farm, at 129/129 layers. The suite runs on ARM64 Windows in CI — same instruction set, Microsoft silicon, no Hexagon. That proves the install path, not the NPU."],
    ["Word error rate is measured against synthesised speech", "No accent, no room, no crosstalk, no disfluency. The published figure is a floor, and the report says so. Real speakers are next."],
    ["The NPU column of the concurrency table is empty", "Slide five is the CPU half of the comparison. The half that closes the argument needs a Snapdragon PC and one command."],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.85 + i * 1.62;
    card(s, M, y, W - 2 * M, 1.42, false);
    s.addShape(pres.shapes.OVAL, { x: M + 0.35, y: y + 0.36, w: 0.6, h: 0.6, fill: { color: "FCEFD8" }, line: { type: "none" } });
    t(s, String(i + 1), { x: M + 0.35, y: y + 0.36, w: 0.6, h: 0.6, fontFace: HEAD, fontSize: 18, bold: true, color: C.warnL, align: "center", valign: "middle" });
    t(s, gaps[i][0], { x: M + 1.25, y: y + 0.2, w: W - 2 * M - 1.6, h: 0.42, fontFace: HEAD, fontSize: 17, bold: true, color: C.onL });
    t(s, gaps[i][1], { x: M + 1.25, y: y + 0.65, w: W - 2 * M - 1.6, h: 0.7, fontSize: 14.5, color: C.onLDim });
  }
  footer(s, "Stated here rather than left for a judge to find", C.onLDim);
  s.addNotes("Say these before anyone asks. Volunteering the gaps is what makes the measured claims believable - and it turns the obvious hostile question into a conversation you started.");

  // ---------- 11 close ----------
  s = pres.addSlide();
  s.background = { data: await glowBackground(0.75, 1.0) };
  eyebrow(s, "IF YOU REMEMBER ONE SENTENCE", C.accD, 1.6);
  t(s, [
    { text: "On a CPU, turning on the glossary makes the captions stop keeping up with the lecturer. That is why this is a " },
    { text: "Snapdragon", options: { color: C.accD } }, { text: " application." },
  ], { x: M, y: 2.1, w: 10.8, h: 2.6, fontFace: HEAD, fontSize: 38, bold: true, color: C.onD });
  t(s, "Everything else — the accuracy table, the term protection, the degradation ladder — supports that sentence.",
    { x: M, y: 4.95, w: 9.5, h: 0.8, fontSize: 18, color: C.onDDim });
  t(s, [
    { text: "sahaay-offline.vercel.app", options: { hyperlink: { url: SITE } } }, { text: "  ·  " },
    { text: "github.com/andringodson/Hackathon-SnapdragonAILab", options: { hyperlink: { url: REPO_URL } } }, { text: "  ·  MIT" },
  ], { x: M, y: 6.92, w: 11, h: 0.3, fontSize: 11, color: C.onDDim });
  s.addNotes("Land the sentence, then stop talking. Let the silence do the closing.");

  await pres.writeFile({ fileName: OUT });
  console.log(OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
