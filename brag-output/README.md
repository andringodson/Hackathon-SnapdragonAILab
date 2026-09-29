# The showreel

A two-minute motion-graphics demo of Sahaay for the Snapdragon AI Lab Build &
Present Challenge 2026: 1920×1080, 60 fps, original score, narrated by synthesised
voices (Kokoro text-to-speech), with an English subtitle track.
The rendered film is on the release
[`submission-v2`](https://github.com/andringodson/Hackathon-SnapdragonAILab/releases/tag/submission-v2)
as `Sahaay_showreel.mp4`; it is too large to keep in the repository.

| File | What it is |
|---|---|
| [brag-plan.md](brag-plan.md) | The angle, the storyboard with timings, the music plan, and the honesty rules for the edit |
| [share-copy.txt](share-copy.txt) | Caption to post with the video |
| [brag.jpg](brag.jpg) | Poster frame, also baked in as the video's first frame |
| [composition/](composition/) | The film itself: HTML, CSS and JavaScript, one file per scene |

## How it is made

Every frame is a pure function of time. `composition/engine.js` exposes
`R.seek(T)`, which sets every element from `T` alone, with no clocks, no CSS
transitions and only seeded randomness. `render.py` opens the page in headless
Chromium, seeks each of the 7,200 frames and screenshots it, across several
browsers at once, then encodes with the score.

The product scenes are not mock-ups. `make_data.py` pulls the captions,
translations, timings and glossary entries out of the recorded sessions in
`web/session.*.json`, and the app is rebuilt from the product's own
stylesheet and logo. The line in the 22-language reel is the same English
sentence as each recording translated it.

The score is synthesised by `score.py`, with no samples: 120 BPM in D,
Kafi thaat, with a tanpura drone, a plucked lead, pads, bass and drums. Every
sound effect is placed from the cue list the scenes register, so it lands on
the frame it belongs to.

## The voices

`composition/voice.py` writes the voiceover with Kokoro-82M through
Hyperframes (`npx hyperframes tts`): a lecturer for the opening Hindi line
(`hm_psi`) and a narrator for the rest (`af_heart`). Both are synthesised,
not recorded. Each line is timed into its scene and checked to fit; the
opening's words appear as the lecturer says them, and the waveform under them
is his voice. `score.py` puts the lines on their own bus and ducks the music
under each one. The script, with timings, is at the end of
[brag-plan.md](brag-plan.md). Needs `HYPERFRAMES_PYTHON` pointing at a Python
with `kokoro-onnx` and `soundfile`.

## Rebuild it

Windows, for the fonts the product uses (Segoe UI Variable, Cascadia Mono,
Nirmala UI). Inter and Noto Sans Devanagari for the wordmark are in
`composition/fonts/` (SIL Open Font License). Needs Python with `playwright`
(and its Chromium), `numpy` and `scipy`, and `ffmpeg` on the PATH.

```powershell
cd brag-output\composition
python make_data.py                      # data.js from the recorded sessions
python voice.py                          # voiceover: ..\work\vo\*.wav, voice.js, ..\captions.vtt/.srt
python render.py cues                    # ..\work\cues.json
python score.py                          # ..\work\score.wav, -14 LUFS
python render.py frames --workers 8      # ..\work\frames, about 6 minutes
python render.py encode --poster 25.6    # ..\brag.mp4, with ..\brag.jpg as its first frame
```

`python render.py stills 12.5 47 90` renders single frames for checking, and
opening `composition/index.html?t=47` in a browser shows one frame live
(`?play` plays it in real time, with the score if it has been built).
