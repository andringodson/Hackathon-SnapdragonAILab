"""Render the reel: every frame from the composition in headless Chromium, then encode with the score.

    python render.py stills 1.5 4 9.8          work/stills/t001.500.jpg, ...
    python render.py cues                      work/cues.json (read by score.py)
    python render.py frames [--from 0 --to 120] [--workers 8]
    python render.py encode                    ../brag.mp4, with work/score.wav

Each frame is R.seek(T) followed by a screenshot, so frames can be rendered in
any order by any number of browsers. Workers take contiguous ranges.
"""
import argparse
import base64
import json
import multiprocessing as mp
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
WORK = OUT / "work"
URL = (HERE / "index.html").as_uri() + "?render=1"
FPS = 60
DUR = 120.0
ARGS = ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text",
        "--hide-scrollbars", "--allow-file-access-from-files", "--mute-audio", "--disable-background-timer-throttling"]


def open_page(pw):
    browser = pw.chromium.launch(args=ARGS)
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(URL)
    page.wait_for_function("window.R && window.R.ready", timeout=60000)
    cdp = page.context.new_cdp_session(page)
    return browser, page, cdp, errors


def shoot(page, cdp, T, path, quality=94):
    page.evaluate("T => R.seek(T)", T)
    shot = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": quality, "captureBeyondViewport": False})
    path.write_bytes(base64.b64decode(shot["data"]))


def stills(times):
    d = WORK / "stills"
    d.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser, page, cdp, errors = open_page(pw)
        for T in times:
            p = d / f"t{T:07.3f}.jpg"
            shoot(page, cdp, T, p, 90)
            print(p)
        if errors:
            print("PAGE ERRORS:", *errors, sep="\n  ")
        browser.close()


def cues():
    with sync_playwright() as pw:
        browser, page, cdp, errors = open_page(pw)
        data = page.evaluate("({cues: R.cues, dur: R.DUR, bpm: R.BPM})")
        browser.close()
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "cues.json").write_text(json.dumps(data, indent=1))
    print(f"{len(data['cues'])} cues -> work/cues.json")


def worker(args):
    first, last, wid = args
    d = WORK / "frames"
    t0 = time.time()
    with sync_playwright() as pw:
        browser, page, cdp, errors = open_page(pw)
        for f in range(first, last):
            p = d / f"f{f:06d}.jpg"
            if p.exists() and p.stat().st_size > 0:
                continue
            shoot(page, cdp, f / FPS, p)
        browser.close()
    return wid, last - first, time.time() - t0, errors


def frames(start, end, workers):
    d = WORK / "frames"
    d.mkdir(parents=True, exist_ok=True)
    f0, f1 = int(round(start * FPS)), int(round(end * FPS))
    n = f1 - f0
    step = -(-n // workers)
    jobs = [(f0 + k * step, min(f1, f0 + (k + 1) * step), k) for k in range(workers) if f0 + k * step < f1]
    t0 = time.time()
    with mp.Pool(len(jobs)) as pool:
        for wid, count, secs, errors in pool.imap_unordered(worker, jobs):
            print(f"worker {wid}: {count} frames in {secs:.0f} s ({count / max(secs, 1e-6):.1f} fps)", flush=True)
            if errors:
                print("  PAGE ERRORS:", *errors[:5], sep="\n    ")
    print(f"{n} frames in {time.time() - t0:.0f} s")


def encode(poster=None):
    """Encode frames + score. With a poster time, that settled frame becomes brag.jpg and replaces frame 0,
    so every player's idle thumbnail shows it; replacing rather than adding keeps the duration and sync."""
    frames = WORK / "frames"
    if poster is not None:
        src = frames / f"f{int(round(poster * FPS)):06d}.jpg"
        first = frames / "f000000.jpg"
        keep = WORK / "f000000.orig.jpg"
        if not keep.exists():
            keep.write_bytes(first.read_bytes())
        first.write_bytes(src.read_bytes())
        (OUT / "brag.jpg").write_bytes(src.read_bytes())
        print(f"poster: frame at {poster} s -> brag.jpg and frame 0")
    audio = WORK / "score.wav"
    cmd = ["ffmpeg", "-y", "-v", "error", "-stats", "-framerate", str(FPS), "-i", str(WORK / "frames" / "f%06d.jpg")]
    if audio.exists():
        cmd += ["-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "320k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-x264-params", "keyint=120:min-keyint=60", "-movflags", "+faststart", str(OUT / "brag.mp4")]
    subprocess.run(cmd, check=True)
    print(OUT / "brag.mp4")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["stills", "cues", "frames", "encode"])
    ap.add_argument("times", nargs="*", type=float)
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float, default=DUR)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--poster", type=float, default=None, help="encode: time of the frame to use as the poster")
    a = ap.parse_args()
    if a.mode == "stills":
        stills(a.times)
    elif a.mode == "cues":
        cues()
    elif a.mode == "frames":
        frames(a.start, a.end, a.workers)
    else:
        encode(a.poster)


if __name__ == "__main__":
    sys.exit(main())
