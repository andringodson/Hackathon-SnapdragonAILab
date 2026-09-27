"""Score and sound design for the video, mixed under the narration.

Everything is synthesised here, so the music is original and free to publish:
  - an ambient score: a slow D-minor progression on warm detuned pads, soft sub-bass, occasional bell shimmers and a long
    reverb; it swells on the title and end cards and dips automatically whenever the voice speaks
  - whooshes that follow each scroll (panned in the direction of travel), soft ticks on clicks, chimes on the cards
  - under the /live scene, the lecture that is actually being fed to the page's microphone, ducked under the voice
Reads work/narration.wav, work/timeline.json and work/manifest.json (events logged by director.py); writes work/final_audio.wav.
"""
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, istft, sosfilt, stft

HERE = Path(__file__).resolve().parent / "work"
LECTURE = Path(__file__).resolve().parent.parent / "testaudio" / "lecture_long.wav"
SR = 48000
rng = np.random.default_rng(26)

TL = json.loads((HERE / "timeline.json").read_text())
EVENTS = json.loads((HERE / "manifest.json").read_text()).get("events", [])
TOTAL = TL["total"]
N = int(TOTAL * SR)
t_all = np.arange(N) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def db(x):
    return 10 ** (x / 20)


# ---------- score ----------
# (bass, [pad notes]) in MIDI. i - VI - III - VII in D minor: Dm9, Bbmaj9, Fmaj7, Csus2.
CHORDS = [(38, [50, 57, 64, 65, 72]), (34, [53, 57, 60, 62, 69]), (41, [48, 55, 57, 64, 67]), (36, [55, 60, 62, 67, 74])]
BAR = 8.0            # seconds per chord
FADE_IN, FADE_OUT = 2.6, 3.4


def voice(freq, n, detune_cents):
    """A soft pad tone: fundamental plus a little 2nd and 3rd harmonic, slightly detuned."""
    f = freq * 2 ** (detune_cents / 1200)
    ph = 2 * np.pi * f * np.arange(n) / SR + rng.uniform(0, 2 * np.pi)
    return np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)


def score():
    L = np.zeros(N)
    R = np.zeros(N)
    t = 0.0
    i = 0
    while t < TOTAL:
        bass, notes = CHORDS[i % len(CHORDS)]
        start = int(max(0, t - FADE_IN / 2) * SR)
        length = int((BAR + FADE_IN / 2 + FADE_OUT) * SR)
        end = min(N, start + length)
        n = end - start
        if n <= 0:
            break
        x = np.arange(n) / SR
        env = np.minimum(1, x / FADE_IN) * np.clip((length / SR - x) / FADE_OUT, 0, 1)
        env = env ** 1.6
        for j, m in enumerate(notes):
            g = 0.16 / (1 + 0.15 * j)
            L[start:end] += g * env * voice(hz(m), n, -5 + 2 * j)
            R[start:end] += g * env * voice(hz(m), n, 5 - 2 * j)
        sub = 0.22 * env * np.sin(2 * np.pi * hz(bass) * x)
        L[start:end] += sub
        R[start:end] += sub
        # A bell shimmer on some bars, picked from the chord an octave up.
        if i % 2 == 1 or i == 0:
            for k in range(2):
                bt = t + 1.5 + k * 2.6 + rng.uniform(-0.3, 0.3)
                b = bell(hz(rng.choice(notes) + 12), 3.5, 0.05)
                pan = rng.uniform(0.25, 0.75)
                place(L, R, b, bt, pan)
        t += BAR
        i += 1
    # Slow breathing movement and a gentle low-pass keep the bed soft.
    lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.07 * t_all)
    sos = butter(2, 5200, "lowpass", fs=SR, output="sos")
    L, R = sosfilt(sos, L * lfo), sosfilt(sos, R * lfo)
    return reverb(L, R, 3.2, 0.42)


def bell(freq, dur, gain):
    """FM bell: bright attack, long soft decay."""
    n = int(dur * SR)
    x = np.arange(n) / SR
    mod = 2.2 * np.exp(-x * 2.5) * np.sin(2 * np.pi * freq * 3.5 * x)
    return gain * np.exp(-x * 1.6) * np.sin(2 * np.pi * freq * x + mod) * np.minimum(1, x / 0.004)


def place(L, R, sig, at, pan=0.5):
    s = int(at * SR)
    if s >= N or s < 0:
        return
    e = min(N, s + len(sig))
    L[s:e] += sig[: e - s] * np.cos(pan * np.pi / 2)
    R[s:e] += sig[: e - s] * np.sin(pan * np.pi / 2)


def reverb(L, R, seconds, wet):
    n = int(seconds * SR)
    x = np.arange(n) / SR
    decay = np.exp(-x * 6.9 / seconds)
    irL = rng.standard_normal(n) * decay
    irR = rng.standard_normal(n) * decay
    irL[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    irR[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    irL /= np.sqrt(np.sum(irL ** 2))
    irR /= np.sqrt(np.sum(irR ** 2))
    wL = fftconvolve(L, irL)[:N]
    wR = fftconvolve(R, irR)[:N]
    return (1 - wet) * L + wet * wL, (1 - wet) * R + wet * wR


# ---------- sound effects ----------
def whoosh(dur, gain):
    """Band-limited air that rises and falls, like a camera move."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    f, tt, Z = stft(noise, fs=SR, nperseg=1024)
    pos = np.linspace(0, 1, Z.shape[1])
    centre = 350 * (2600 / 350) ** np.sin(np.pi * pos) ** 1.2      # sweep up then back down (log scale)
    shape = np.exp(-0.5 * (np.log(f[:, None] + 1) - np.log(centre[None, :])) ** 2 / 0.55 ** 2)
    _, y = istft(Z * shape, fs=SR, nperseg=1024)
    y = y[:n]
    env = np.sin(np.pi * np.linspace(0, 1, len(y))) ** 1.8
    y = y * env
    return gain * y / (np.max(np.abs(y)) + 1e-9)


def tick(gain):
    n = int(0.06 * SR)
    x = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 2300 * x) + 0.5 * np.sin(2 * np.pi * 3450 * x)) * np.exp(-x * 90)
    y += 0.3 * rng.standard_normal(n) * np.exp(-x * 400)
    return gain * y / np.max(np.abs(y))


def effects():
    L = np.zeros(N)
    R = np.zeros(N)
    direction = 1
    for ev in EVENTS:
        t = ev["t"]
        if ev["kind"] == "glide":
            d = ev.get("ms", 1500) / 1000
            w = whoosh(d * 0.9 + 0.35, db(-27))
            s = int(max(0, t - 0.05) * SR)
            e = min(N, s + len(w))
            pan = np.linspace(0.5 - 0.3 * direction, 0.5 + 0.3 * direction, e - s)
            L[s:e] += w[: e - s] * np.cos(pan * np.pi / 2)
            R[s:e] += w[: e - s] * np.sin(pan * np.pi / 2)
            direction = -direction
        elif ev["kind"] == "click":
            place(L, R, tick(db(-24)), t + 0.02, 0.55)
        elif ev["kind"] == "title_out":
            w = whoosh(1.4, db(-30))
            place(L, R, w, t - 0.1, 0.5)
    # Chimes: the title card at the start and the end card.
    end_t = next((e["t"] for e in EVENTS if e["kind"] == "end_card"), TOTAL - 5.8)
    for at in (0.9, end_t + 0.3):
        for k, m in enumerate((74, 81, 86)):
            place(L, R, bell(hz(m), 4.0, db(-21 - 2 * k)), at + 0.16 * k, 0.35 + 0.15 * k)
    return reverb(L, R, 1.8, 0.25)


# ---------- mix ----------
def voice_envelope(voice):
    """Smoothed speech level (0-1) at 100 Hz, used to duck the music under the narration."""
    hop = SR // 100
    frames = np.abs(voice[: len(voice) // hop * hop]).reshape(-1, hop).max(axis=1)
    on = (frames > db(-38)).astype(float)
    env = np.zeros_like(on)
    for i in range(1, len(on)):
        a = 0.35 if on[i] > env[i - 1] else 0.018        # fast attack, slow release
        env[i] = env[i - 1] + a * (on[i] - env[i - 1])
    return np.interp(np.arange(N) / hop, np.arange(len(env)), env, right=0)


def main():
    sr, narr = wavfile.read(HERE / "narration.wav")
    assert sr == SR
    narr = narr.astype(np.float64) / 32768.0
    if narr.ndim == 1:
        narr = np.stack([narr, narr], axis=1)
    narr = np.pad(narr, ((0, max(0, N - len(narr))), (0, 0)))[:N]

    mL, mR = score()
    peak = max(np.max(np.abs(mL)), np.max(np.abs(mR)))
    mL, mR = mL / peak, mR / peak
    env = voice_envelope(narr.mean(axis=1))
    # Music sits at -17 dB on the cards, dips to -27 dB under the voice, and fades in and out at the edges.
    level_db = -17 - 10 * env
    edge = np.minimum(1, t_all / 1.2) * np.clip((TOTAL - t_all) / 2.5, 0, 1)
    g = db(level_db) * edge
    sL, sR = effects()

    L = narr[:, 0] + mL * g + sL
    R = narr[:, 1] + mR * g + sR

    # The lecture the /live page is transcribing, from the moment Start is
    # pressed until the cut away, so the viewer hears what is being captioned.
    cuts = [e for e in EVENTS if e["kind"] == "cut"]
    live = next((c for c in cuts if c.get("path") == "/live/"), None)
    if live:
        start = next((e["t"] for e in EVENTS if e["kind"] == "click" and e["t"] > live["t"]), None)
        stop = next((c["t"] for c in cuts if c["t"] > live["t"]), TOTAL) - 0.6
        if start is not None and stop > start:
            from math import gcd

            from scipy.signal import resample_poly
            lsr, lec = wavfile.read(LECTURE)
            lec = lec.astype(np.float64) / 32768.0
            if lec.ndim > 1:
                lec = lec.mean(axis=1)
            k = gcd(SR, lsr)
            lec = resample_poly(lec, SR // k, lsr // k)
            lec /= max(1e-9, np.max(np.abs(lec)))
            s0, s1 = int(start * SR), min(N, int(stop * SR))
            seg = lec[: s1 - s0]
            s1 = s0 + len(seg)
            fade = np.minimum(1, np.arange(len(seg)) / (0.3 * SR)) * np.clip((len(seg) - np.arange(len(seg))) / (0.6 * SR), 0, 1)
            gl = db(-15 - 11 * env[s0:s1]) * fade
            L[s0:s1] += seg * gl
            R[s0:s1] += seg * gl
    out = np.stack([L, R], axis=1)
    peak = np.max(np.abs(out))
    if peak > db(-1.5):
        out *= db(-1.5) / peak
    wavfile.write(HERE / "final_audio.wav", SR, (out * 32767).astype(np.int16))
    print(f"final_audio.wav: {TOTAL:.1f}s, music bed -17/-27 dB, {sum(e['kind'] == 'glide' for e in EVENTS)} whooshes, "
          f"{sum(e['kind'] == 'click' for e in EVENTS)} ticks, peak {20 * np.log10(np.max(np.abs(out))):.1f} dBFS")


main()
