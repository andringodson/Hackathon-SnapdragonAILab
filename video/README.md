# Demo video

A narrated, captioned three-minute walkthrough recorded from the live site:
the landing page, `/live` transcribing a lecture in the browser with the
network cut halfway through, `/demo` replaying a recorded desktop session in
Hindi, and the evidence for the NPU argument.

Every claim in the narration is either shown happening on screen or is a
number published on the site with its source. The browser build keeps up on
the recording laptop (RTF 0.3-0.8, one model), so the script says so and puts
the "falls behind" argument where the measurement is: two models on one CPU.

| Step | File | What it does |
|---|---|---|
| 1 | `narration.py` | The script as spoken lines, with pause and emphasis markup. |
| 2 | `tts.py` | Neural voice-over (`edge-tts`), timeline, loudness-normalised voice track. |
| 3 | `overlay.js` | Injected while recording: title and end cards, black cover for cuts, a cursor, the "network disconnected" tag. |
| 4 | `director.py` | Drives Edge through the shot list, anchored to narration lines; feeds `testaudio/lecture_long.wav` to the fake microphone and cuts the network with Playwright. |
| 5 | `sound.py` | Synthesised score and effects, plus the lecture audio under the `/live` scene. |
| 6 | `assemble.py` | Exact frame timing from capture timestamps, captions burned in, H.264 + AAC. |

```bash
pip install edge-tts playwright numpy scipy
cd video && mkdir -p work && cd work && cp ../narration.py .
python ../tts.py en-US-AndrewMultilingualNeural -3%
cd .. && python director.py          # ~5 minutes, uses the live site
python sound.py && python assemble.py Sahaay_demo.mp4
```

Outputs go to `video/work/`, which is not committed. The finished video is
attached to the repository's releases.
