# Sahaay: the showreel

A two-minute motion-graphics demo for the Snapdragon AI Lab Build & Present
Challenge 2026 submission. Landscape 1920×1080, 60 fps, original score, and a
voiceover (see the end).

## The rubric

**What is it?** A laptop app that captions a lecture live, translates every
line into one of 22 Indian languages with the technical terms kept intact,
and explains the jargon as it is spoken, entirely on the device.

**Who is it for?** A student following an engineering lecture in a language
that is not their first, often code-mixed ("Matrix A ka determinant zero
hoga"), often somewhere the network is poor.

**What sets it apart?** It runs offline, on the laptop, and it protects the
terms: "eigenvalues" stays "eigenvalues" in all 22 scripts, so the caption
still matches the textbook and the exam.

**Most impressive claim.** Measured, not asserted: on a CPU the glossary
model pushes Whisper Small from RTF 0.41 to 1.55 (the captions fall behind);
on the Hexagon NPU the Whisper encoder (tiny.en, full 30 s window) runs in
13.47 ms with 129 of 129 layers on the NPU, Qualcomm AI Hub job jglyo70e5.

**Visual hook.** The code-mixed sentence itself, building word by word out of
a voice waveform, with the English terms lit in the product's blue.

**Real UI to show.** The desktop app replaying its real Hindi session
(web/session.hi.json): captions, translation, jargon panel, with the product's
own stylesheet, palette and logo. Then the same line from all 22 real
recordings.

**Tone.** Freeform: "a motion designer's showreel". Nearest preset:
cinematic pacing with polished restraint in the holds. Big type, hard cuts on
the beat, long settled holds for anything that has to be read.

**Share caption.** Sahaay captions a lecture live, translates it into 22
Indian languages and explains the jargon, all on the laptop with the network
switched off.

## Angle

One sentence, followed all the way through the product. The lecturer's
code-mixed line opens the film; the app captions it, translates it, keeps
its terms; the same line lands in 22 scripts with "eigenvalues" pinned still
while every language around it changes; the network is cut and it keeps
going; then the measurement that makes it a Snapdragon application.

## Visual identity (from the source)

- OLED black `#000`, text `#ececec`, dim `#8b919a`, lines `#1d2025` / `#2c3139`
- Accent `#4db8ff`, NPU `#00d68f`, glitch `#ff3b6b`, warning `#ffb020`
- Segoe UI Variable Display for type (the product's font), Cascadia Mono for
  labels and numbers, Nirmala UI for the Indic scripts
- The logo: three sound bars becoming two lines of text. It is the motion
  motif: bars become the logo, the logo's lines become the caption list
- The matrix field of dim glyphs (digits, maths, Devanagari) from
  `sahaay/ui/matrix.js`, with a light that follows the action and ripples on hits
- A showreel HUD: chapter index top-left, running timecode bottom-right,
  crop marks in the corners

## Storyboard (120 BPM, one bar = 2 s)

| # | Time | Scene | On screen | Motion / transition | Sound |
|---|---|---|---|---|---|
| 1 | 0–10 | Hook | "Matrix A ka **determinant** zero hoga, / tabhi **non-trivial solution** milega." Then "Half of it is Hindi. The terms are English." Then "Now follow it in your second language." | A blue line draws out, becomes a voice waveform; words rise out of it one by one; Hindi dims, terms stay lit; the sentence shatters into glyphs that fall into the matrix | Tanpura drone in D, soft plucks, a tick per word |
| 2 | 10–20 | The problem | "Cloud captioning struggles with the mix." / "It bills by the minute." / "And it needs a network the hall doesn't have." | A dotted cloud scrambles the words; a meter ticks; Wi-Fi arcs drop out one by one with a red glitch | Pulse enters, filtered; glitch bursts; riser into bar 11 |
| 3 | 20–30 | Reveal | Logo, "Sahaay · सहाय · help". "Live captions. 22 Indian languages. A jargon glossary." / "On the laptop, with the network switched off." | Three bars slam up like an equaliser, bounce on the beat, settle into the logo; its two lines draw; wordmark wipes out from behind; matrix wakes in a ripple | Impact, the drop: full groove |
| 4 | 30–46 | On screen | The real app: captions from the Hindi session, translation beneath, jargon panel filling. Callouts: "01 Captions: Whisper, on the device", "02 Translation: NLLB-200, terms protected", "03 Jargon: explained as it's spoken". Push-in: "eigenvalues stays eigenvalues." | The logo's lines extend into the caption list (match cut); the window swings in in 3D; captions type in; leader-line callouts draw; camera pushes to the term, box draws around it | Groove; UI ticks under each caption; soft whoosh on camera moves |
| 5 | 46–62 | 22 languages | The same line in 22 scripts, "eigenvalues" pinned still while the languages spin past it. "Same line. 22 Indian languages." Pull back to a wall of all 22: "The technical terms never change." | Slot-reel with the anchor word locked; decelerate and land; camera pulls back to the wall, every term glowing; the wall collapses to a point | Arpeggio and shimmer layer; a tick per language |
| 6 | 62–72 | Offline | A laptop running the app, a network switch. "Network off. Captions keep coming." / "No audio, no text, no account leaves the machine." | A cursor flips the switch; the frame glitches; captions keep arriving; packets try to leave and bounce off the laptop's boundary | The music cuts dead on the click, drone only; it comes back as the captions do |
| 7 | 72–96 | The NPU | Real-time chart: Whisper Small alone, RTF 0.41; plus the glossary model, RTF 1.55, past the real-time line. "Two models. One set of cores. The captions lose." Then a chip: the encoder moves to the Hexagon NPU; 129 layer cells light; "13.47 ms"; the three devices | Bars grow against the 1.0 line; the second breaks through it in red and caption cards pile up behind; the encoder block flies across the die; a sweep lights 129 cells; the number counts up | Half-time build; tape-stop when the captions fall behind; rebuilt hit on 13.47 ms |
| 8 | 96–108 | Built to be checked | 400+ tests / Windows x86 · ARM64 · Linux / Offline is a test / One script to install / Runs in your browser too / Notes when the lecture ends | One card per bar, cut on the downbeat, each with its own mini animation | Full groove, hits on each cut |
| 9 | 108–120 | Outro | Logo, "Try it in your browser", sahaay-offline.vercel.app, "Snapdragon AI Lab Build & Present Challenge 2026 · A Hackathon Project by AndrinGodson" | Everything collapses into the logo; the URL types; final hit, fade | Drop out to drone and pad, last impact, reverb tail |

Durations: 10 + 10 + 10 + 16 + 16 + 10 + 24 + 12 + 12 = 120 s.

## Music

Original, synthesised in `composition/score.py`: 120 BPM in D, Kafi thaat
(D Dorian), so the Indian flavour comes from the mode and the instruments
rather than a sample. A tanpura drone (Karplus–Strong strings with a buzzing
bridge, Pa–Sa–Sa–Sa) under the whole film; a plucked sitar-like lead with
slides for the melody; detuned pads on Dm9 – Cadd9 – G6/B – Am7; sub bass,
kick, clap and hats from the drop. Effects are written into the same key and
reverb: whooshes on camera moves, ticks on words and captions, impacts on the
reveal and the 13.47 ms, glitch stutters cut from the music itself, a
tape-stop when the captions fall behind, and a hard cut to the drone when the
network goes off. Sidechained pads and bass, a gentle master bus, about
−14 LUFS.

## Honesty rules for the edit

- Every number is from the repo's docs: README, docs/AIHUB.md, docs/CONCURRENCY.md, docs/TUNING.md.
- The NPU figure is labelled as the Whisper tiny.en encoder on the AI Hub device farm, and the film says the full pipeline has not yet run on a physical Snapdragon PC.
- The app scenes replay the real recorded session and real translations, unedited, including their imperfections.
- No Qualcomm or Snapdragon logos: device names are plain text.

## Voiceover script

Added on request (`/brag --voice`): two synthesised voices, generated with
Kokoro-82M through Hyperframes (`npx hyperframes tts`) by
`composition/voice.py`, which also writes the captions.

- **The lecturer** speaks the opening line in Hindi (`hm_psi`, Hindi
  phonemizer, normal speed: at 1.1x and above, Whisper stopped hearing
  "non-trivial solution" as English). The words appear on screen as he says
  them, and the waveform under them is his voice's own loudness. In the mix he
  is band-limited and put in a hall.
- **The narrator** (`af_heart`) complements the picture rather than reading
  it, and is timed into each scene: the film is cut to its score, so the voice
  fits the picture. Every line ends before the next and before the moment it
  must clear (the network click at 64 s, the crash at 78 s, the 13.47 ms at 90 s).
- The music ducks to 0.15 under each line, the effects to 0.45, and both come
  back between lines, so the drops and hits still land.
- Checked by transcribing with the app's own Whisper: every narrator line word
  for word, alone and over the music.

| Time (s) | Voice | Line |
|---|---|---|
| 0.20–5.67 | Lecturer (hm_psi, Hindi) | Matrix A ka determinant zero hoga, tabhi non-trivial solution milega. |
| 5.85–8.36 | Narrator (af_heart) | A real lecture, in two languages at once. |
| 8.45–10.80 | Narrator (af_heart) | Now imagine it isn't your first language. |
| 10.90–14.12 | Narrator (af_heart) | The usual answer is the cloud. It stumbles on the mix, |
| 14.25–15.81 | Narrator (af_heart) | it runs a meter the whole time, |
| 16.85–18.70 | Narrator (af_heart) | and it assumes the hall has Wi-Fi. |
| 23.25–25.18 | Narrator (af_heart) | This is Sahaay. Hindi, for help. |
| 26.90–29.58 | Narrator (af_heart) | Everything you're about to see runs on one laptop. |
| 30.75–34.00 | Narrator (af_heart) | Whisper writes each sentence down the moment the lecturer pauses. |
| 34.10–36.93 | Narrator (af_heart) | Then it translates the line, and explains the jargon. |
| 37.05–39.68 | Narrator (af_heart) | And the words the exam will use come through untouched. |
| 40.70–44.56 | Narrator (af_heart) | Every caption and translation here is from a real recorded session. |
| 46.90–49.92 | Narrator (af_heart) | Pick any of twenty-two languages, and the line follows. |
| 54.60–57.76 | Narrator (af_heart) | Twenty-two scripts, and every one keeps the textbook's words. |
| 62.25–63.70 | Narrator (af_heart) | Now, switch the network off. |
| 65.30–66.56 | Narrator (af_heart) | It doesn't even notice. |
| 67.60–70.58 | Narrator (af_heart) | Nothing is uploaded, because nothing ever needed to be. |
| 73.35–76.10 | Narrator (af_heart) | On a laptop CPU, Whisper keeps up easily. |
| 76.20–77.95 | Narrator (af_heart) | Then the glossary model starts too. |
| 79.30–82.41 | Narrator (af_heart) | The captions start falling behind, and they never catch up. |
| 84.20–88.73 | Narrator (af_heart) | So the speech encoder moves to the Hexagon NPU, on silicon of its own. |
| 90.25–93.85 | Narrator (af_heart) | Thirteen and a half milliseconds. Every layer, on the NPU. |
| 94.05–95.89 | Narrator (af_heart) | Measured on Qualcomm's device farm. |
| 96.35–99.25 | Narrator (af_heart) | Four hundred tests, on every push, on three platforms. |
| 100.12–102.17 | Narrator (af_heart) | Offline isn't a promise. It's a test. |
| 102.30–103.58 | Narrator (af_heart) | One script installs it. |
| 104.20–105.73 | Narrator (af_heart) | It even runs in your browser. |
| 106.10–108.02 | Narrator (af_heart) | And it writes your notes when the lecture ends. |
| 110.40–112.80 | Narrator (af_heart) | Sahaay. The lecture understands you, offline. |
| 113.50–116.88 | Narrator (af_heart) | Try it in your browser. No install, and nothing uploaded. |
