"""Record the demo video, following the narration timeline.

Usage: python director.py [site URL] [stop after N seconds, for test takes]

Three pages, one take: the landing page, /live running real Whisper in the
browser on a lecture fed through Chromium's fake microphone (with the
network cut halfway), and /demo replaying a recorded desktop session in
Hindi. Frames come from Chrome's screencast with capture timestamps and are
appended to one file, so assemble.py can rebuild exact timing.
"""
import base64
import json
import math
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://sahaay-offline.vercel.app").rstrip("/")
UNTIL = float(sys.argv[2]) if len(sys.argv) > 2 else None
HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
REPO = HERE.parent
TL = json.loads((WORK / "timeline.json").read_text())
WAV = REPO / "testaudio" / "lecture_long.wav"
BIN = open(WORK / "frames.bin", "wb")   # one open file: many small writes get stalled by antivirus

W, H, DPR = 1600, 900, 1.2
manifest, events, errors = [], [], []
state = {"last": -1}
REPLAY_S = 121.944   # length of web/session.hi.json


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True, args=[
            "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--hide-scrollbars",
            "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
            f"--use-file-for-fake-audio-capture={WAV}",
            "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=DPR, color_scheme="dark")
        ctx.add_init_script(path=str(HERE / "overlay.js"))
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)[:200]))

        # Warm up: fetch and compile Whisper once, off camera, so the take
        # shows captions rather than a download bar.
        pg.goto(SITE + "/live/")
        pg.wait_for_selector("#toggle:not([disabled])", timeout=60000)
        pg.click("#toggle")
        pg.wait_for_selector("#captions li", timeout=240000)
        pg.click("#toggle")
        pg.wait_for_timeout(1500)

        pg.goto(SITE + "/")
        pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        pg.evaluate("__title(true); __reveal()")
        pg.mouse.move(W * 0.62, H * 0.40)
        pg.wait_for_timeout(2000)

        cdp = {"s": None}

        def on_frame(ev, s):
            ts = ev["metadata"]["timestamp"]
            try:
                s.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
            except Exception:
                return
            slot = int(ts * 30)
            if slot == state["last"]:
                return
            state["last"] = slot
            data = base64.b64decode(ev["data"])
            manifest.append((ts, BIN.tell(), len(data)))
            BIN.write(data)

        def screencast():
            if cdp["s"]:
                try:
                    cdp["s"].send("Page.stopScreencast")
                    cdp["s"].detach()
                except Exception:
                    pass
            s = ctx.new_cdp_session(pg)
            s.on("Page.screencastFrame", lambda ev: on_frame(ev, s))
            s.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": int(W * DPR),
                                            "maxHeight": int(H * DPR), "everyNthFrame": 1})
            cdp["s"] = s

        screencast()
        pg.wait_for_timeout(600)
        t0 = time.time()

        def now():
            return time.time() - t0

        def wait_until(t):
            while True:
                left = t - now()
                if left <= 0:
                    return
                pg.wait_for_timeout(min(left * 1000, 40))

        def log(kind, **extra):
            events.append({"t": round(now(), 3), "kind": kind, **extra})

        def move(x, y, steps=None):
            if steps is None:
                cur = state.get("mouse", (x, y))
                steps = int(min(45, max(12, math.dist(cur, (x, y)) / 22)))
            pg.mouse.move(x, y, steps=steps)
            state["mouse"] = (x, y)

        def hover(sel, fx=0.5, fy=0.5):
            pt = pg.evaluate("([s, fx, fy]) => __box(s, fx, fy)", [sel, fx, fy])
            if pt:
                move(pt["x"], pt["y"])

        def hover_js(expr):
            pt = pg.evaluate(expr)
            if pt:
                move(pt["x"], pt["y"])

        def click(sel):
            hover(sel)
            pg.wait_for_timeout(120)
            log("click")
            pg.click(sel)

        def ripple(x, y):
            move(x, y)
            log("click")
            pg.mouse.down()
            pg.mouse.up()

        def glide(target, off=90, ms=1400):
            log("glide", ms=ms)
            pg.evaluate("([t, o, m]) => __glide(t, o, m)", [target, off, ms])

        def goto(path, before=None):
            """Cut to another page behind the black cover."""
            pg.evaluate("__cover()")
            pg.wait_for_timeout(560)
            ctx.set_offline(False)
            pg.goto(SITE + path, wait_until="domcontentloaded")
            pg.wait_for_timeout(250)
            screencast()
            if before:
                before()
            pg.evaluate("__reveal()")
            log("cut", path=path)

        lines = TL["items"]

        def A(k, f):
            return f if k < 0 else lines[k]["start"] + f * lines[k]["dur"]

        def cut_at(k):
            return lines[k]["start"] - 1.25

        # The replay has to reach its notes as the narration mentions them.
        # Measured: the replay's clock starts ~2.8 s after the cut (page load, then
        # replay.js polls until Start is enabled).
        demo_load = cut_at(7) + 2.8
        speed = REPLAY_S / max(8.0, A(9, 0.02) - demo_load)
        speed = round(speed, 2)

        def eigen_box():
            return ("(() => { const t = [...document.querySelectorAll('.cap-tr')].filter(e => !e.hidden && "
                    "/eigen|determinant|diagonal/i.test(e.textContent)); const el = t[t.length - 1]; if (!el) return null; "
                    "const r = el.getBoundingClientRect(); return {x: r.left + Math.min(r.width * 0.5, 260), y: r.top + r.height / 2}; })()")

        shots = [
            # Title card, then the landing page.
            (A(-1, 3.2), lambda: (log("title_out"), pg.evaluate("__title(false)"))),
            (A(0, 0.02), lambda: move(W * 0.70, H * 0.32, 50)),
            (A(0, 0.30), lambda: move(W * 0.82, H * 0.55, 45)),
            (A(0, 0.55), lambda: ripple(W * 0.80, H * 0.52)),
            (A(0, 0.72), lambda: move(W * 0.60, H * 0.70, 45)),
            (A(0, 0.90), lambda: hover(".btn-primary", 0.5, 0.5)),
            (A(1, 0.00), lambda: glide("The problem", 110, 1500)),
            (A(1, 0.40), lambda: hover("#problem .sec-body p", 0.3, 0.3)),
            (A(1, 0.75), lambda: hover("#problem .sec-body p em", 0.5, 0.5)),
            (A(2, 0.20), lambda: hover("#problem .sec-body p:nth-of-type(2)", 0.4, 0.4)),
            (A(2, 0.70), lambda: ripple(W * 0.80, H * 0.62)),
            # Live, in the browser.
            (cut_at(3), lambda: goto("/live/")),
            (A(3, 0.15), lambda: hover("#device", 0.5, 0.5)),
            (A(3, 0.60), lambda: click("#toggle")),
            (A(4, 0.30), lambda: hover(".captions", 0.3, 0.12)),
            (A(4, 0.75), lambda: hover(".side .glossary", 0.35, 0.10)),
            (A(5, 0.25), lambda: (ctx.set_offline(True), pg.evaluate("__offline()"), log("offline"))),
            (A(6, 0.20), lambda: hover_js("(() => { const c = [...document.querySelectorAll('.cap')].pop(); if (!c) return null; const r = c.getBoundingClientRect(); return {x: r.left + 240, y: r.top + r.height / 2}; })()")),
            (A(6, 0.70), lambda: hover("#rtf", 0.5, 0.5)),
            # The desktop app, replaying a recorded Hindi session.
            (cut_at(7), lambda: goto(f"/demo/?play=1&speed={speed}")),
            (A(7, 0.35), lambda: hover("#device", 0.5, 0.5)),
            (A(7, 0.75), lambda: hover("#language", 0.5, 0.5)),
            (A(8, 0.15), lambda: hover(".captions", 0.3, 0.2)),
            (A(8, 0.42), lambda: hover_js(eigen_box())),
            (A(8, 0.80), lambda: hover(".side .glossary", 0.35, 0.10)),
            (A(9, 0.45), lambda: hover("#notes-body h2", 0.3, 0.5)),
            # Back to the evidence.
            (cut_at(10), lambda: goto("/", lambda: pg.evaluate("__glide('Why this needs an NPU', 70, 1)"))),
            (A(10, 0.30), lambda: hover("#npu tbody tr:first-child td:last-child", 0.5, 0.5)),
            (A(10, 0.72), lambda: hover("tr.bad td:last-child", 0.5, 0.5)),
            (A(11, 0.35), lambda: hover("tr.bad td:nth-child(2)", 0.5, 0.5)),
            (A(12, 0.00), lambda: glide("Measured on Snapdragon silicon", 70, 1500)),
            (A(12, 0.45), lambda: hover("tr.good td:nth-child(2)", 0.5, 0.5)),
            (A(12, 0.66), lambda: hover("tr.good td:nth-child(4)", 0.5, 0.5)),
            (A(12, 0.86), lambda: hover("tr.good a", 0.5, 0.5)),
            (A(13, 0.00), lambda: glide("Run it yourself", 90, 1600)),
            (A(13, 0.25), lambda: hover("#run pre", 0.3, 0.5)),
            (A(13, 0.70), lambda: glide("Does it survive a whole lecture?", 90, 1300)),
            (A(13, 0.85), lambda: hover(".stat:nth-child(4)", 0.5, 0.5)),
            (A(14, 0.00), lambda: glide("What is not proven yet", 90, 1500)),
            (A(14, 0.40), lambda: hover(".gaps li:first-child strong", 0.4, 0.5)),
            (A(15, 0.00), lambda: glide("footer", 300, 1300)),
            (A(15, 0.45), lambda: hover(".credit a", 0.5, 0.5)),
            (A(15, 1.0) + 0.3, lambda: (log("end_card"), pg.evaluate("__end()"))),
        ]
        stop = UNTIL or TL["total"]
        for t, fn in shots:
            if t > stop:
                break
            wait_until(t)
            try:
                fn()
            except Exception as e:  # a missed shot must not abort the take
                errors.append(f"shot at {t:.1f}s: {str(e)[:160]}")
        wait_until(stop + 0.3)
        try:
            cdp["s"].send("Page.stopScreencast")
        except Exception:
            pass
        pg.wait_for_timeout(300)
        b.close()

    BIN.close()
    (WORK / "manifest.json").write_text(json.dumps({"t0": t0, "total": stop, "frames": manifest,
                                                    "events": events, "replay_speed": speed}))
    ts = [m[0] - t0 for m in manifest if m[0] >= t0]
    gaps = sorted(bb - a for a, bb in zip(ts, ts[1:], strict=False))
    print(f"{len(manifest)} frames, {len(ts) / stop:.1f} fps average, p95 gap {gaps[int(len(gaps) * .95)] * 1000:.0f} ms, "
          f"max gap {gaps[-1] * 1000:.0f} ms, replay speed {speed}x")
    print("events:", [(e["kind"], e["t"]) for e in events if e["kind"] in ("cut", "offline", "end_card")])
    print("page errors:", errors or "none")


main()
