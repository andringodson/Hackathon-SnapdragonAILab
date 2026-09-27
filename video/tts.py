"""Synthesise the narration, lay out the timeline and mix the voice track.

Usage: python tts.py [voice] [rate]      e.g. python tts.py en-US-AndrewMultilingualNeural +0%
Writes line??.wav (one per line), timeline.json and narration.wav.

Each line is spoken in as few pieces as possible so the voice keeps its natural intonation and breathing. It is split
only at "||" (a deliberate pause) and before "~" phrases, which are delivered slower and lower for emphasis.
"""
import asyncio
import json
import subprocess
import sys

import edge_tts
from narration import SECTIONS, caption

VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-US-AndrewMultilingualNeural"
RATE = sys.argv[2] if len(sys.argv) > 2 else "+0%"
TITLE, GAP, SECTION_GAP, END = 4.2, 0.5, 1.3, 5.0   # seconds: title card, pause between lines / sections, end card
DRAMATIC, JOIN = 0.5, 0.1                              # pause at "||", and before an emphasis phrase
TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.09,areverse")


def pct(rate, delta):
    return f"{int(rate.rstrip('%')) + delta:+d}%"


def plan(line):
    """Split a line into spoken segments with the pause that precedes each one."""
    result = []
    for ci, chunk in enumerate(line.split("||")):
        pieces = [p.strip() for p in chunk.split("|") if p.strip()]
        groups, cur, emph = [], [], False
        for piece in pieces:
            if piece.startswith("~"):
                if cur:
                    groups.append((" ".join(cur), emph))
                cur, emph = [piece[1:]], True
            else:
                cur.append(piece)
        if cur:
            groups.append((" ".join(cur), emph))
        for gi, (text, e) in enumerate(groups):
            pause = 0.0 if not result else (DRAMATIC if gi == 0 and ci else JOIN)
            result.append({"text": text.replace("~", ""), "emph": e, "pause": pause})
    return result


def run(args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(out.stdout.strip())


async def synthesise():
    items = []
    for si, (title, lines) in enumerate(SECTIONS):
        for line in lines:
            k = len(items)
            parts = []
            for j, seg in enumerate(plan(line)):
                mp3, wav = f"seg{k:02d}_{j}.mp3", f"seg{k:02d}_{j}.wav"
                rate = pct(RATE, -9) if seg["emph"] else RATE
                pitch = "-4Hz" if seg["emph"] else "+0Hz"
                await edge_tts.Communicate(seg["text"], VOICE, rate=rate, pitch=pitch).save(mp3)
                run(["-i", mp3, "-af", TRIM, "-ar", "48000", "-ac", "1", wav])
                if seg["pause"]:
                    parts.append(f"sil:{seg['pause']}")
                parts.append(wav)
            # Join the segments with their pauses into one file per line.
            inputs, labels = [], []
            for p in parts:
                if p.startswith("sil:"):
                    inputs += ["-f", "lavfi", "-t", p[4:], "-i", "anullsrc=r=48000:cl=mono"]
                else:
                    inputs += ["-i", p]
                labels.append(f"[{len(labels)}]")
            out = f"line{k:02d}.wav"
            run([*inputs, "-filter_complex", f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1[a]", "-map", "[a]", out])
            items.append({"section": si, "title": title, "text": caption(line), "file": out, "dur": round(duration(out), 3)})
            print(f"{k:2d} {items[-1]['dur']:5.1f}s  {items[-1]['text'][:70]}")
    return items


def main():
    items = asyncio.run(synthesise())
    t, prev = TITLE, None
    for it in items:
        if prev is not None:
            t += SECTION_GAP if it["section"] != prev else GAP
        it["start"] = round(t, 3)
        t += it["dur"]
        prev = it["section"]
    total = round(t + END, 3)
    json.dump({"items": items, "total": total, "voice": VOICE, "rate": RATE}, open("timeline.json", "w"), indent=1)

    # Place each line at its start time, then normalise loudness for speech.
    args = []
    for it in items:
        args += ["-i", it["file"]]
    delays = ";".join(f"[{n}]adelay={int(it['start'] * 1000)}:all=1[a{n}]" for n, it in enumerate(items))
    mix = "".join(f"[a{n}]" for n in range(len(items))) + f"amix=inputs={len(items)}:normalize=0,apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    run(args + ["-filter_complex", f"{delays};{mix}", "-map", "[out]", "-ar", "48000", "-ac", "2", "narration.wav"])
    print(f"{len(items)} lines, {sum(i['dur'] for i in items):.1f}s of speech, video length {total:.1f}s")


main()
