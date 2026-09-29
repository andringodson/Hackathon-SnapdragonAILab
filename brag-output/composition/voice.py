"""The film's voices: a lecturer for the opening line, a narrator for the rest.

Every line is generated with Kokoro through Hyperframes (`npx hyperframes tts`),
the /brag voice path, then measured: a line must finish before the next one
starts and before the moment it has to clear (the network click at 64 s, the
crash at 78 s). The film is cut to its score, so the voice fits the picture,
not the other way round. Writes:

    work/vo/NN.wav     one clip per line
    work/vo.json       where each clip goes, and how long it is (score.py mixes it)
    voice.js           when the lecturer says each word, for the opening scene
    ../captions.vtt    the words, for the player's caption track
    ../captions.srt    the same, for the MP4's subtitle track

Needs HYPERFRAMES_PYTHON pointing at a Python with kokoro-onnx and soundfile.

    python voice.py            generate what is missing, check, write captions
    python voice.py --redo 7   regenerate line 7
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
WORK = OUT / "work"
VO = WORK / "vo"
NARRATOR = "af_heart"
LECTURER = "hm_psi"

# (start s, must end by s, voice, speed, text to speak, caption text)
# "Sahai" is spelled for the phonemizer: it says सहाय; "Sahaay" is read "Sa-hay".
LINES = [
    (0.20, 5.8, LECTURER, 1.0,
     "मैट्रिक्स ए का डिटरमिनेंट ज़ीरो होगा, तभी नॉन-ट्रिवियल सॉल्यूशन मिलेगा।",
     "[Lecturer] Matrix A ka determinant zero hoga, tabhi non-trivial solution milega."),
    (5.85, 8.37, NARRATOR, 1.05, "A real lecture, in two languages at once.",
     "A real lecture, in two languages at once."),
    (8.45, 10.8, NARRATOR, 1.05, "Now imagine it isn't your first language.",
     "Now imagine it isn't your first language."),
    (10.9, 14.17, NARRATOR, 1.05, "The usual answer is the cloud. It stumbles on the mix,",
     "The usual answer is the cloud. It stumbles on the mix,"),
    (14.25, 16.6, NARRATOR, 1.05, "it runs a meter the whole time,", "it runs a meter the whole time,"),
    (16.85, 19.3, NARRATOR, 1.05, "and it assumes the hall has Wi-Fi.", "and it assumes the hall has Wi-Fi."),
    (23.25, 26.6, NARRATOR, 1.0, "This is Sahai. Hindi, for help.", "This is Sahaay. Hindi, for help."),
    (26.9, 29.7, NARRATOR, 1.05, "Everything you're about to see runs on one laptop.",
     "Everything you're about to see runs on one laptop."),
    (30.75, 34.0, NARRATOR, 1.08, "Whisper writes each sentence down the moment the lecturer pauses.",
     "Whisper writes each sentence down the moment the lecturer pauses."),
    (34.1, 36.95, NARRATOR, 1.08, "Then it translates the line, and explains the jargon.",
     "Then it translates the line, and explains the jargon."),
    (37.05, 39.8, NARRATOR, 1.05, "And the words the exam will use come through untouched.",
     "And the words the exam will use come through untouched."),
    (40.7, 45.2, NARRATOR, 1.05, "Every caption and translation here is from a real recorded session.",
     "Every caption and translation here is from a real recorded session."),
    (46.9, 50.2, NARRATOR, 1.05, "Pick any of twenty-two languages, and the line follows.",
     "Pick any of twenty-two languages, and the line follows."),
    (54.6, 58.6, NARRATOR, 1.05, "Twenty-two scripts, and every one keeps the textbook's words.",
     "Twenty-two scripts, and every one keeps the textbook's words."),
    (62.25, 63.95, NARRATOR, 1.1, "Now, switch the network off.", "Now, switch the network off."),
    (65.3, 67.2, NARRATOR, 1.05, "It doesn't even notice.", "It doesn't even notice."),
    (67.6, 71.0, NARRATOR, 1.05, "Nothing is uploaded, because nothing ever needed to be.",
     "Nothing is uploaded, because nothing ever needed to be."),
    (73.35, 76.1, NARRATOR, 1.05, "On a laptop CPU, Whisper keeps up easily.",
     "On a laptop CPU, Whisper keeps up easily."),
    (76.2, 78.0, NARRATOR, 1.12, "Then the glossary model starts too.", "Then the glossary model starts too."),
    (79.3, 82.6, NARRATOR, 1.05, "The captions start falling behind, and they never catch up.",
     "The captions start falling behind, and they never catch up."),
    (84.2, 89.9, NARRATOR, 1.05, "So the speech encoder moves to the Hexagon N P U, on silicon of its own.",
     "So the speech encoder moves to the Hexagon NPU, on silicon of its own."),
    (90.25, 93.9, NARRATOR, 1.05, "Thirteen and a half milliseconds. Every layer, on the N P U.",
     "Thirteen and a half milliseconds. Every layer, on the NPU."),
    (94.05, 96.1, NARRATOR, 1.12, "Measured on Qualcomm's device farm.", "Measured on Qualcomm's device farm."),
    (96.35, 99.9, NARRATOR, 1.1, "Four hundred tests, on every push, on three platforms.",
     "Four hundred tests, on every push, on three platforms."),
    (100.12, 102.2, NARRATOR, 1.1, "Offline isn't a promise. It's a test.", "Offline isn't a promise. It's a test."),
    (102.3, 104.0, NARRATOR, 1.1, "One script installs it.", "One script installs it."),
    (104.2, 106.0, NARRATOR, 1.1, "It even runs in your browser.", "It even runs in your browser."),
    (106.1, 108.4, NARRATOR, 1.1, "And it writes your notes when the lecture ends.",
     "And it writes your notes when the lecture ends."),
    (110.4, 113.2, NARRATOR, 1.0, "Sahai. The lecture understands you, offline.",
     "Sahaay. The lecture understands you, offline."),
    (113.5, 117.2, NARRATOR, 1.0, "Try it in your browser. No install, and nothing uploaded.",
     "Try it in your browser. No install, and nothing uploaded."),
]


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def speak(n: int, voice: str, speed: float, text: str) -> Path:
    path = VO / f"{n:02d}.wav"
    # The text goes in a UTF-8 file: on Windows npx is a batch file, and a
    # Devanagari argument through cmd.exe is at the mercy of the code page.
    script = VO / f"{n:02d}.txt"
    script.write_text(text, encoding="utf-8")
    cmd = [shutil.which("npx") or "npx", "-y", "hyperframes", "tts", str(script),
           "--voice", voice, "--speed", str(speed), "-o", str(path)]
    if voice.startswith("h"):
        cmd += ["--lang", "hi"]
    raw = VO / f"{n:02d}.raw.wav"
    cmd[cmd.index("-o") + 1] = str(raw)
    subprocess.run(cmd, check=True, capture_output=True)
    # Kokoro pads both ends with silence; keep 40 ms either side of the voice.
    trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,"
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", trim, str(path)], check=True)
    raw.unlink()
    return path


# The lecturer's words and their spoken syllables, for timing the opening:
# two clauses either side of the comma, each word as long as its syllables.
HOOK = [[("Matrix", 2), ("A", 1), ("ka", 1), ("determinant", 4), ("zero", 2), ("hoga,", 2)],
        [("tabhi", 2), ("non-trivial", 4), ("solution", 3), ("milega.", 3)]]


def hook_times(path: Path, offset: float) -> list[float]:
    """When each word of the lecturer's line starts, from the clip itself.

    Finds the pause at the comma (the longest quiet stretch in the middle of
    the clip), then spreads each clause's words over its voiced span by
    syllable count. Good to a syllable or so, which is what the eye needs.
    """
    import wave

    import numpy as np

    with wave.open(str(path)) as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(rate * 0.01)
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    rms = np.convolve(rms, np.ones(5) / 5, mode="same")
    quiet = rms < rms.max() * 0.06
    n = len(rms)
    best, run, start = (0, 0), 0, 0
    for i in range(int(n * 0.3), int(n * 0.75)):
        if quiet[i]:
            if run == 0:
                start = i
            run += 1
            if run > best[1]:
                best = (start, run)
        else:
            run = 0
    loud = np.nonzero(~quiet)[0]
    voiced = [(loud[0], best[0]), (best[0] + best[1], loud[-1])]
    times = []
    for (a, b), words in zip(voiced, HOOK, strict=True):
        total = sum(sy for _, sy in words)
        acc = 0
        for _, sy in words:
            # Text leads the voice by a hair: read and heard land together.
            times.append(round(offset + (a + (b - a) * acc / total) * 0.01 - 0.06, 3))
            acc += sy
    return times


def envelope(path: Path) -> list[float]:
    """Loudness every 10 ms, 0..1, lightly smoothed: what the opening's waveform shows."""
    import wave

    import numpy as np

    with wave.open(str(path)) as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(rate * 0.01)
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    rms = np.convolve(rms, np.ones(3) / 3, mode="same")
    return list(np.clip(rms / (np.percentile(rms, 97) + 1e-9), 0, 1.15))


def stamp(t: float, sep: str) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}{sep}{ms % 1000:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--redo", type=int, nargs="*", default=[])
    a = ap.parse_args()
    VO.mkdir(parents=True, exist_ok=True)
    placed, problems = [], []
    for n, (start, limit, voice, speed, text, caption) in enumerate(LINES):
        path = VO / f"{n:02d}.wav"
        if n in a.redo or not path.exists():
            speak(n, voice, speed, text)
        d = duration(path)
        end = start + d
        nxt = LINES[n + 1][0] if n + 1 < len(LINES) else 120.0
        ok = end <= limit + 0.05 and end <= nxt - 0.08
        if not ok:
            problems.append(f"line {n} runs to {end:.2f} s (limit {min(limit, nxt):.2f}): {caption}")
        placed.append({"n": n, "t": start, "dur": round(d, 3), "voice": voice, "file": str(path), "caption": caption})
        print(f"  {n:02d} {start:6.2f}-{end:6.2f}  {'ok ' if ok else 'OVER'} {caption[:70]}")
    (WORK / "vo.json").write_text(json.dumps(placed, indent=1, ensure_ascii=False), encoding="utf-8")
    hook = [float(t) for t in hook_times(VO / "00.wav", LINES[0][0])]
    env = [round(float(v), 3) for v in envelope(VO / "00.wav")]
    (HERE / "voice.js").write_text(
        "// Generated by voice.py: when the lecturer says each word of the opening line,\n"
        "// and how loud his voice is every 10 ms from hookStart (the waveform draws it).\n"
        f"window.VOICE = {{ hook: {json.dumps(hook)}, hookStart: {LINES[0][0]}, "
        f"hookEnd: {round(LINES[0][0] + placed[0]['dur'], 3)}, hookEnv: {json.dumps(env)} }};\n",
        encoding="utf-8")
    print("  hook words at", hook)
    vtt = ["WEBVTT", ""]
    srt = []
    for i, p in enumerate(placed, 1):
        a_, b_ = p["t"], p["t"] + p["dur"]
        vtt += [f"{stamp(a_, '.')} --> {stamp(b_, '.')}", p["caption"], ""]
        srt += [str(i), f"{stamp(a_, ',')} --> {stamp(b_, ',')}", p["caption"], ""]
    (OUT / "captions.vtt").write_text("\n".join(vtt), encoding="utf-8")
    (OUT / "captions.srt").write_text("\n".join(srt), encoding="utf-8")
    if problems:
        print("\n".join(["", "does not fit:"] + problems))
        return 1
    print(f"\n{len(placed)} lines fit; captions written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
