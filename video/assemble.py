"""Turn the captured frames + soundtrack into the MP4, with captions burned in.

Usage: python assemble.py [out.mp4]
Reads work/manifest.json, work/frames.bin, work/timeline.json and
work/final_audio.wav (or narration.wav). Frame timing is rebuilt from the
screencast's own timestamps, so a stalled frame holds rather than drifts.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else WORK / "Sahaay_demo.mp4"
m = json.loads((WORK / "manifest.json").read_text())
TL = json.loads((WORK / "timeline.json").read_text())
t0, total, raw = m["t0"], m["total"], m["frames"]

# ---------- frames ----------
FR = WORK / "frames"
FR.mkdir(exist_ok=True)
for old in FR.glob("*.jpg"):
    old.unlink()
blob = (WORK / "frames.bin").read_bytes()
frames = []
for n, (ts, off, size) in enumerate(raw):
    if ts >= t0 + total:
        break
    name = f"f{n:06d}.jpg"
    frames.append((ts, name))
    if ts >= t0 - 1:
        (FR / name).write_bytes(blob[off:off + size])

before = [f for f in frames if f[0] < t0]
after = [f for f in frames if t0 <= f[0] < t0 + total]
seq = ([(0.0, before[-1][1])] if before else []) + [(ts - t0, name) for ts, name in after]
lines = []
for i, (t, name) in enumerate(seq):
    nxt = seq[i + 1][0] if i + 1 < len(seq) else total
    if nxt <= t:
        continue
    lines += [f"file 'frames/{name}'", f"duration {min(nxt, total) - t:.4f}"]
lines.append(f"file 'frames/{seq[-1][1]}'")
(WORK / "frames.txt").write_text("\n".join(lines) + "\n")

# ---------- captions ----------
# Long lines are split into readable chunks at sentence and clause breaks,
# each on screen for a share of the line's time proportional to its length.


sys.path.insert(0, str(HERE))
from narration import SECTIONS  # noqa: E402

RAW = [line for _, lines in SECTIONS for line in lines]


def chunks(raw, limit=92):
    """Pack the narration's own breath marks ("|", "||") into cues of at most ~limit characters."""
    phrases = [" ".join(p.replace("~", "").split()) for p in raw.replace("||", "|").split("|")]
    phrases = [p for p in phrases if p and p != "Thank you."]
    # Spoken as words, read as digits.
    for spoken, shown in (("zero point four", "0.4"), ("one point five five", "1.55"),
                          ("thirteen and a half milliseconds", "13.5 ms")):
        phrases = [p.replace(spoken, shown) for p in phrases]
    out = []
    for ph in phrases:
        if out and len(out[-1]) + 1 + len(ph) <= limit:
            out[-1] = f"{out[-1]} {ph}"
        else:
            out.append(ph)
    return out


def ts(t):
    h, rem = divmod(max(0.0, t), 3600)
    mi, s = divmod(rem, 60)
    return f"{int(h)}:{int(mi):02d}:{s:05.2f}"


events = []
for it, raw in zip(TL["items"], RAW, strict=True):
    cs = chunks(raw)
    if not cs:
        continue
    weights = [len(c) + 8 for c in cs]
    t = it["start"]
    for c, w in zip(cs, weights, strict=True):
        d = it["dur"] * w / sum(weights)
        events.append(f"Dialogue: 0,{ts(t)},{ts(t + d - 0.02)},Cap,,0,0,0,,{c}")
        t += d

ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Segoe UI Semibold,38,&H00ECECEC,&H00ECECEC,&H26000000,&H26000000,0,0,0,0,100,100,0.2,0,3,14,0,2,260,260,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
(WORK / "captions.ass").write_text(ass, encoding="utf-8")

# ---------- encode ----------
audio = WORK / "final_audio.wav" if (WORK / "final_audio.wav").exists() else WORK / "narration.wav"
cmd = ["ffmpeg", "-y", "-v", "error", "-stats", "-f", "concat", "-safe", "0", "-i", "frames.txt", "-i", str(audio)]
fades = f"fade=t=in:st=0.3:d=0.8,fade=t=out:st={total - 1.4:.2f}:d=1.4"
cmd += ["-vf", f"fps=30,scale=1920:1080:flags=lanczos,subtitles=captions.ass,{fades},format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-t", f"{total:.3f}",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(OUT)]
subprocess.run(cmd, check=True, cwd=WORK)
info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height",
                       "-of", "json", str(OUT)], capture_output=True, text=True).stdout
print(OUT, json.dumps(json.loads(info)))
print(f"{len(events)} caption cues")
