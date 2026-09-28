"""The reel's score and sound design, synthesised from nothing, so it is original and free to publish.

120 BPM in D, Kafi thaat (D Dorian). A tanpura drone (additive strings with a
moving jawari buzz, Pa-Sa-Sa-Sa) under the whole film; a plucked, sitar-like
lead with slides; detuned pads on Dm9 - Cadd9 - G6/B - Am7; sub bass, kick,
clap and hats from the drop. The effects are pitched into the same key and
sent to the same rooms: the hook's words play notes of the raga, the reel's
ticks climb the scale.

The arrangement follows the picture: the music cuts dead when the network is
switched off (64 s) and comes back as the captions keep coming; it tape-stops
when the second model pushes the captions past real time (78 s); the 13.47 ms
lands on the downbeat that brings the full groove back (90 s).

Reads work/cues.json (from render.py cues), writes work/score.wav at -14 LUFS.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

WORK = Path(__file__).resolve().parent.parent / "work"
SR = 48000
BEAT = 0.5
BAR = 2.0
DUR = 120.0
N = int(DUR * SR)
rng = np.random.default_rng(2026)

CUES = json.loads((WORK / "cues.json").read_text())["cues"]

# D Dorian, and the chord cycle.
SCALE = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86]
CHORDS = [  # (bass root MIDI, pad voicing)
    (38, [50, 57, 60, 64, 65]),   # Dm9
    (36, [48, 55, 62, 64, 67]),   # Cadd9
    (35, [47, 55, 62, 64, 71]),   # G6/B
    (33, [45, 52, 55, 60, 64]),   # Am7
]


def hz(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def db(x):
    return 10 ** (x / 20)


def filt(x, kind, f, order=2):
    if kind == "bp":
        sos = butter(order, [max(20, f[0]), min(SR / 2 - 100, f[1])], "bandpass", fs=SR, output="sos")
    else:
        sos = butter(order, min(SR / 2 - 100, max(20, f)), kind, fs=SR, output="sos")
    return sosfilt(sos, x, axis=-1)


def env_ar(n, a, r_tau, hold=0.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    rel = np.where(t > a + hold, np.exp(-(t - a - hold) / r_tau), 1.0)
    return e * rel


def saw(freq, n, ph0=0.0):
    """Band-limited-ish sawtooth (polyBLEP). freq may be a scalar or per-sample array."""
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / SR, (n,))
    ph = (ph0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N + SR * 4))

    def add(self, sig, t, gain=1.0, pan=0.0):
        s = int(round(t * SR))
        if s >= N:
            return
        sig = np.asarray(sig)
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
        if s < 0:
            sig = sig[:, -s:]
            s = 0
        n = min(sig.shape[1], self.x.shape[1] - s)
        self.x[:, s:s + n] += sig[:, :n] * gain

    @property
    def out(self):
        return self.x[:, :N]


# ---------------- instruments ----------------

def tanpura(f, dur=4.2, seed=0):
    """Additive string with the jawari: a band of harmonics that sweeps upward as the note rings."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    c = 2.5 + 20 * (t / dur) ** 0.55
    for k in range(1, 34):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** 0.85) * (0.18 + 1.3 * np.exp(-((k - c) / 3.5) ** 2)) * np.exp(-t * (0.55 + 0.035 * k))
        y += amp * np.sin(2 * np.pi * fk * t + r.uniform(0, 2 * np.pi))
    return y * np.minimum(1, t / 0.006) * 0.12


def pluck(f, dur=1.2, bright=1.0, slide_from=None, buzz=1.0, seed=0):
    """Sitar-ish pluck: fast-decaying upper partials, a buzzing formant, and meend (a slide) if asked."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    if slide_from is not None:
        g = np.minimum(1, t / 0.13)
        g = g * g * (3 - 2 * g)
        inst = slide_from * (f / slide_from) ** g
    else:
        inst = f * (1 + 0.012 * np.exp(-t / 0.03))
    phase = 2 * np.pi * np.cumsum(inst) / SR
    y = np.zeros(n)
    c = 7 + 9 * (1 - np.exp(-t * 2.5))
    for k in range(1, 26):
        if f * k > 11000:
            break
        amp = (1 / k ** 1.05) * np.exp(-t * (1.4 + 0.42 * k / bright))
        amp = amp * (1 + buzz * 0.9 * np.exp(-((k - c) / 2.6) ** 2))
        y += amp * np.sin(k * phase + r.uniform(0, 0.4))
    return y * np.minimum(1, t / 0.002) * 0.16


def pad_note(f, dur, cutoff=1800, attack=0.5, release=1.1, detune=(-9, 0, 8)):
    n = int((dur + release * 3) * SR)
    y = np.zeros(n)
    for c in detune:
        y += saw(f * 2 ** (c / 1200), n, rng.uniform())
    y = filt(y, "lowpass", cutoff, 2)
    t = np.arange(n) / SR
    e = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / release), 1)
    return y * e * 0.05


def bass_note(f, dur, drive=1.6):
    n = int((dur + 0.12) * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * f * t)
    grit = filt(saw(f, n), "lowpass", 380, 2)
    y = np.tanh(drive * (sub + 0.35 * grit)) / np.tanh(drive)
    e = np.minimum(1, t / 0.006) * np.where(t > dur, np.exp(-(t - dur) / 0.03), 1)
    return y * e * 0.32


def kick_sample():
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    click = filt(rng.normal(0, 1, n), "highpass", 2500) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.8 * (body + click)) * 0.62


def clap_sample():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    nz = filt(rng.normal(0, 1, n), "bp", (900, 3400))
    e = sum(np.exp(-np.maximum(0, t - d) / 0.012) * (t >= d) for d in (0, 0.011, 0.022)) * 0.4 + np.exp(-np.maximum(0, t - 0.03) / 0.09) * (t >= 0.03)
    return nz * e * 0.22


def hat_sample(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    nz = filt(rng.normal(0, 1, n), "highpass", 7200, 2)
    return nz * np.exp(-t / (0.07 if open_ else 0.014)) * (0.05 if open_ else 0.06)


def tom_sample(f0=110):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = f0 * (0.75 + 0.35 * np.exp(-t / 0.06))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.32)
    y += filt(rng.normal(0, 1, n), "lowpass", 900) * np.exp(-t / 0.03) * 0.3
    return np.tanh(1.5 * y) * 0.5


KICK, CLAP, HAT_C, HAT_O = kick_sample(), clap_sample(), hat_sample(), hat_sample(True)


# ---------------- effects ----------------

def noise(n):
    return rng.normal(0, 1, n)


def whoosh(dur=0.7, up=False, dir_=0, gain=1.0, low=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n)
    lo, hi = filt(x, "bp", (180, 900)), filt(x, "bp", (1500, 7000))
    u = t / dur
    sweep = u if up else 1 - np.abs(2 * u - 1)
    y = lo * (1 - sweep) + hi * sweep * (0.6 if low else 1)
    e = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    y = y * e * 0.12 * gain
    if dir_:
        pan = np.clip(dir_ * (2 * u - 1), -1, 1)
    else:
        pan = np.zeros(n)
    a = (pan + 1) * np.pi / 4
    return np.vstack([y * np.cos(a), y * np.sin(a)]) * np.sqrt(2)


def riser(dur=4.0, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    x = noise(n)
    bands = [filt(x, "bp", (200 * 2 ** (k * 1.2), 200 * 2 ** (k * 1.2 + 1.3))) for k in range(5)]
    pos = u * 4
    y = sum(b * np.clip(1 - np.abs(pos - k), 0, 1) for k, b in enumerate(bands))
    tone = saw(hz(50) * 2 ** (2.2 * u ** 1.6), n) * 0.25
    tone = filt(tone, "lowpass", 3000)
    return (y * 0.9 + tone) * u ** 2.2 * 0.13 * gain


def impact(big=True):
    n = int((3.2 if big else 1.6) * SR)
    t = np.arange(n) / SR
    f = 30 + 55 * np.exp(-t / 0.25)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 if big else 0.45))
    crack = filt(noise(n), "lowpass", 5000) * np.exp(-t / 0.05) * 0.8
    tail = filt(noise(n), "bp", (300, 2500)) * np.exp(-t / (0.9 if big else 0.4)) * 0.12
    return np.tanh(1.4 * (sub * 1.1 + crack + tail)) * (0.75 if big else 0.55)


def blip(f, dur=0.07, glide=1.0, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * glide ** (t / dur)
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
    return y * np.minimum(1, t / 0.002) * np.exp(-t / (dur * 0.35)) * 0.12 * gain


def click(gain=1.0, f=3200):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    y = filt(noise(n), "bp", (f * 0.6, f * 1.6)) * np.exp(-t / 0.0035)
    y += np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.008) * 0.3
    return y * 0.09 * gain


def glitch_burst(dur=0.35):
    n = int(dur * SR)
    x = noise(n)
    hold = np.repeat(x[:: 60], 60)[:n]
    y = np.sign(hold) * (np.abs(hold) > 0.8) * 0.5 + filt(x, "bp", (2000, 6000)) * 0.4
    gate = (np.floor(np.arange(n) / (SR * 0.018)) % 2 == 0).astype(float)
    return y * gate * np.hanning(n) ** 0.3 * 0.12


def shatter():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    y = filt(noise(n), "highpass", 4000) * np.exp(-t / 0.18) * 0.25
    r = np.random.default_rng(5)
    for _ in range(22):
        s = int(r.uniform(0, 0.8) * SR)
        f = hz(r.choice([86, 88, 89, 91, 93, 95, 96, 98]))
        b = blip(f, 0.12, 0.9, 0.5)
        y[s:s + len(b)] += b[: n - s]
    return y


def reverse_swell(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = filt(noise(n), "lowpass", 2500) * (t / dur) ** 3
    y += np.sin(2 * np.pi * hz(50) * t) * (t / dur) ** 4 * 0.5
    return y * 0.16


def power_down():
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = 420 * np.exp(-t / 0.12) + 35
    y = saw(f, n) * np.exp(-t / 0.25)
    return filt(y, "lowpass", 1800) * 0.16


# ---------------- reverb ----------------

def make_ir(rt60, seed, bright=6000):
    n = int(rt60 * 1.2 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    decay = np.exp(-6.9 * t / rt60)
    ir = r.normal(0, 1, (2, n)) * decay
    ir = filt(ir, "lowpass", bright, 1)
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros((2, pre)), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverb(x, ir, wet):
    return np.vstack([fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)]) * wet


# ---------------- arrangement ----------------

def section(b):
    for end, name in [(5, "intro"), (10, "problem"), (15, "drop"), (23, "app"), (31, "langs"), (32, "precut"),
                      (35, "cut"), (36, "return"), (39, "half"), (40, "stop"), (42, "sparse"), (45, "build"),
                      (48, "climax"), (54, "montage"), (60, "outro")]:
        if b < end:
            return name
    return "outro"


GROOVE = {"drop", "app", "langs", "climax", "montage"}

PHRASES = {
    "A": [(0, 69, 1), (1, 72, 0.5), (1.5, 74, 1.5, 72), (3.5, 72, 0.5), (4, 76, 1), (5, 74, 0.5), (5.5, 72, 0.5), (6, 69, 2)],
    "B": [(0, 71, 1), (1, 74, 0.5), (1.5, 76, 1), (2.5, 77, 0.5), (3, 76, 1), (4, 74, 1.5, 76), (5.5, 72, 0.5), (6, 69, 1), (7, 67, 1)],
    "C": [(0, 81, 1.5, 79), (1.5, 79, 0.5), (2, 77, 1), (3, 76, 1), (4, 74, 1), (5, 76, 0.5), (5.5, 77, 0.5), (6, 74, 2)],
    "D": [(0, 74, 1), (1, 72, 1), (2, 69, 2, 67), (4, 72, 1), (5, 71, 0.5), (5.5, 69, 0.5), (6, 67, 1), (7, 69, 1)],
    "I1": [(2, 69, 2), (6, 74, 1, 72), (7, 72, 1)],
    "I2": [(0, 77, 1), (1, 76, 1), (2, 74, 2, 76), (6, 69, 2)],
}
LEAD = {1: "I1", 3: "I2", 11: "A", 13: "B", 27: "A", 29: "B", 45: "C", 47: "A", 49: "B", 51: "C", 53: "D", 55: "D", 57: "I2"}


def main():
    drums, bass, pads, lead, arps, drone, sfx = (Bus() for _ in range(7))
    kicks = []

    # Tanpura: Pa - Sa - Sa - Sa on every beat of every bar.
    strings = [45, 50, 50, 38]
    variants = {(m, v): tanpura(float(hz(m)), 4.2, seed=m * 10 + v) for m in set(strings) for v in range(3)}
    for b in range(60):
        for i, m in enumerate(strings):
            t = b * BAR + i * BEAT
            lvl = 0.75 if section(b) in ("intro", "cut", "sparse", "outro") else 0.45
            drone.add(variants[(m, (b + i) % 3)], t, lvl * (1 if t > 0.2 else 0.5), pan=(-0.35, 0.25, 0.3, -0.2)[i])

    for b in range(60):
        t0 = b * BAR
        sec = section(b)
        root, voicing = CHORDS[b % 4] if sec in GROOVE | {"precut", "build", "outro"} else CHORDS[0]

        # ---- pads ----
        if sec == "intro" and b >= 2:
            for m in CHORDS[0][1]:
                pads.add(pad_note(float(hz(m)), BAR, cutoff=900 + 300 * (b - 2), attack=1.2 if b == 2 else 0.4), t0, 0.9)
        elif sec == "problem":
            for m in CHORDS[0][1]:
                pads.add(pad_note(float(hz(m)), BAR, cutoff=700 + 380 * (b - 5), attack=0.3), t0, 0.9)
        elif sec in GROOVE or sec in ("precut", "build", "outro"):
            cut = {"drop": 2600, "app": 2000, "langs": 2600, "precut": 1500, "build": 1200 + 500 * (b - 42),
                   "climax": 3200, "montage": 3000, "outro": 1800}[sec]
            for m in voicing:
                pads.add(pad_note(float(hz(m)), BAR, cutoff=cut, attack=0.08 if sec != "outro" else 0.5), t0, 1.0)
        elif sec in ("cut", "sparse"):
            for m in (38, 50, 57):
                drone.add(pad_note(float(hz(m)), BAR, cutoff=500, attack=0.6), t0, 0.8)
        elif sec in ("return", "half", "stop"):
            for m in (CHORDS[0][1] if b % 2 == 0 else CHORDS[3][1]):
                pads.add(pad_note(float(hz(m)), BAR, cutoff=900 if sec == "half" else 1300, attack=0.1), t0, 0.9)

        # ---- drums ----
        if sec in GROOVE or sec == "precut":
            last_of_langs = sec == "langs" and b == 30
            for i in range(4):
                t = t0 + i * BEAT
                if not last_of_langs:
                    drums.add(KICK, t, 1.0)
                    kicks.append(t)
                if i in (1, 3) and sec != "precut":
                    drums.add(CLAP, t, 0.8 if sec == "app" else 1.0, pan=0.05)
                drums.add(HAT_O, t + BEAT / 2, 0.8, pan=0.2)
                for j in range(4):
                    drums.add(HAT_C, t + j * BEAT / 4, 0.55 + 0.45 * (j == 2), pan=-0.25)
        elif sec == "problem" and b >= 7:
            for j in range(16):
                drums.add(HAT_C, t0 + j * BEAT / 4, 0.35 + 0.35 * (j % 4 == 2) + 0.1 * (b - 7), pan=-0.2)
        elif sec in ("half", "stop"):
            for t in (t0, t0 + 1.25):
                drums.add(KICK, t, 1.0)
                kicks.append(t)
            drums.add(CLAP, t0 + 1.0, 1.0)
            for j in range(8):
                drums.add(HAT_C, t0 + j * BEAT / 2, 0.6, pan=-0.2)
        elif sec == "sparse":
            for j in range(16):
                drums.add(HAT_C, t0 + j * BEAT / 4, 0.25 + 0.2 * (j % 4 == 0), pan=0.3)
        elif sec == "build":
            for i in range(4):
                drums.add(KICK, t0 + i * BEAT, 0.9)
                kicks.append(t0 + i * BEAT)
                for j in range(4):
                    drums.add(HAT_C, t0 + i * BEAT + j * BEAT / 4, 0.5, pan=-0.2)
        # Snare rolls into 72 and into 90.
        if b in (35, 44):
            k = 0.0
            while k < BAR - 0.02:
                step = BEAT / 2 if k < 0.8 else BEAT / 4 if k < 1.4 else BEAT / 8
                drums.add(CLAP, t0 + k, 0.35 + 0.55 * k / BAR, pan=0.05)
                k += step

        # ---- bass ----
        f = float(hz(root))
        if sec == "problem":
            for j in range(8):
                bass.add(bass_note(float(hz(38)), 0.2, 1.2), t0 + j * BEAT / 2, 0.45 + 0.08 * (b - 5))
        elif sec in GROOVE or sec == "precut":
            pattern = [(0, 0.4, 1), (0.75, 0.2, 2), (1.0, 0.4, 1), (1.5, 0.2, 2), (2.0, 0.4, 1), (2.75, 0.2, 2), (3.0, 0.4, 1), (3.5, 0.3, 1)]
            for beat, d, octv in pattern:
                bass.add(bass_note(f * (2 if octv == 2 else 1), d), t0 + beat * BEAT, 0.9)
        elif sec in ("half", "stop"):
            bass.add(bass_note(float(hz(38 if b % 2 == 0 else 45)), 1.8, 2.2), t0, 1.0)
        elif sec == "sparse":
            bass.add(bass_note(float(hz(38)), 0.9, 1.4), t0, 0.8)
        elif sec == "build":
            for j in range(8):
                bass.add(bass_note(f * (1 + (j % 2)), 0.2), t0 + j * BEAT / 2, 0.8)

        # ---- lead ----
        if b in LEAD:
            for i, note in enumerate(PHRASES[LEAD[b]]):
                beat, m, d = note[:3]
                sl = float(hz(note[3])) if len(note) > 3 else None
                g = 0.55 if sec in ("intro", "outro") else 1.0
                lead.add(pluck(float(hz(m)), d * BEAT + 1.2, 1.0, sl, seed=b * 31 + i), t0 + beat * BEAT, g, pan=0.12)

        # ---- arps ----
        arp_on = (sec == "app" and b >= 19) or sec == "langs" or sec == "build" or sec == "montage" or (sec == "outro" and b < 58)
        if arp_on:
            tones = sorted(voicing)[1:] + [m + 12 for m in sorted(voicing)[1:3]]
            order = [0, 2, 1, 3, 2, 4, 3, 5, 4, 3, 2, 1, 3, 2, 1, 0]
            g = {"app": 0.35, "langs": 0.6, "build": 0.45 + 0.15 * (b - 42), "montage": 0.4, "outro": 0.3}[sec]
            for j in range(16):
                m = tones[order[j] % len(tones)] + 12
                arps.add(pluck(float(hz(m)), 0.5, 0.6, buzz=0.3, seed=j), t0 + j * BEAT / 4, g, pan=-0.4 + 0.8 * (j % 2))

    # The final chord.
    for m in [38, 50, 57, 60, 64, 65, 69, 74]:
        pads.add(pad_note(float(hz(m)), 1.2, cutoff=2400, attack=0.01, release=2.2), 118.0, 1.0)
    bass.add(bass_note(float(hz(38)), 1.4, 1.2), 118.0, 1.0)
    lead.add(pluck(float(hz(74)), 3.0, 1.2, float(hz(72)), seed=9), 118.0, 0.9)

    # ---- sidechain from the kick ----
    t = np.arange(N) / SR
    duck = np.ones(N)
    for k in kicks:
        s = int(k * SR)
        n = min(N - s, int(0.4 * SR))
        if n > 0:
            tt = np.arange(n) / SR
            duck[s:s + n] = np.minimum(duck[s:s + n], 1 - 0.62 * np.exp(-tt / 0.11))
    pads.x[:, :N] *= duck
    bass.x[:, :N] *= 0.35 + 0.65 * duck
    arps.x[:, :N] *= 0.5 + 0.5 * duck

    # ---- sound effects from the cues ----
    fx_cut_mute = []
    hook_notes = [0, 2, 4, 3, 4, 2, 1, 6, 7, 4]
    for c in CUES:
        ty, at = c["type"], c["t"]
        if ty == "tick" and at < 10:
            k = c.get("k", 0)
            m = SCALE[hook_notes[k % len(hook_notes)]] + (12 if c.get("term") else 0)
            sfx.add(pluck(float(hz(m)), 1.4, 1.3 if c.get("term") else 0.7, buzz=1.2 if c.get("term") else 0.4, seed=k), at, 0.9 if c.get("term") else 0.6, pan=-0.3 + 0.06 * k)
        elif ty == "tick" and c.get("reel"):
            k = c.get("k", 0)
            if c.get("last"):
                for i, m in enumerate((74, 81, 86)):
                    sfx.add(pluck(float(hz(m)), 1.6, 1.4, seed=40 + i), at + i * 0.04, 0.5)
            else:
                sfx.add(blip(float(hz(SCALE[k % 8] + 12)), 0.06, 1.0, 0.55), at, 1.0, pan=-0.5 + 0.05 * k)
        elif ty == "type":
            sfx.add(click(0.35 if c.get("soft") else 0.45, 2600 + 400 * (c.get("k", 0) % 5)), at, 1.0, pan=0.1)
        elif ty == "whoosh":
            sfx.add(whoosh(1.1 if c.get("long") else 0.8, c.get("up", False), c.get("dir", 0), 0.6 if c.get("soft") else 1.0), at - 0.35, 1.0)
        elif ty == "riser":
            sfx.add(riser(c.get("dur", 4.0), 0.7 if c.get("short") else 1.0), at, 1.0)
        elif ty == "impact":
            sfx.add(impact(c.get("big", True)), at, 1.0)
        elif ty == "land":
            sfx.add(impact(False), at, 0.55 if c.get("soft") else 0.8)
        elif ty in ("hit", "cut"):
            if ty == "cut" and abs(at - 64.0) < 0.01:
                continue                      # the network cut has its own sound, below
            sfx.add(impact(False), at, 0.5 if ty == "cut" else 0.7 if not c.get("soft") else 0.45)
            sfx.add(filt(noise(int(0.25 * SR)), "highpass", 5000) * np.exp(-np.arange(int(0.25 * SR)) / SR / 0.06) * 0.05, at, 1.0)
        elif ty == "shimmer":
            for i, m in enumerate((74, 81, 86, 88, 93)):
                sfx.add(pluck(float(hz(m)), 2.0, 1.5, buzz=0.2, seed=60 + i), at + i * 0.07, 0.35, pan=-0.4 + 0.2 * i)
        elif ty == "pop":
            sfx.add(blip(float(hz(81 if c.get("hi") else 74)), 0.09, 1.5, 0.8), at, 1.0, pan=0.15)
        elif ty == "blip":
            sfx.add(blip(float(hz(SCALE[3 + c.get("k", 0) % 5] + 12)), 0.07, 1.0, 0.7), at, 1.0, pan=0.3)
        elif ty == "garble":
            g = glitch_burst(0.3)
            sfx.add(g, at, 0.7, pan=0.4)
        elif ty == "coin":
            sfx.add(blip(float(hz(81)), 0.08, 1.0, 0.8), at, 1.0, pan=0.35)
            sfx.add(blip(float(hz(86)), 0.18, 1.0, 0.8), at + 0.07, 1.0, pan=0.35)
        elif ty == "drop":
            sfx.add(blip(float(hz(69)), 0.22, 0.45, 0.8 if not c.get("soft") else 0.5), at, 1.0, pan=0.3)
        elif ty == "glitch":
            sfx.add(glitch_burst(0.4), at, 1.0)
        elif ty == "suck":
            sfx.add(reverse_swell(0.5), at - 0.05, 1.0)
        elif ty == "shatter":
            sfx.add(shatter(), at, 1.0)
        elif ty == "zoom":
            sfx.add(whoosh(1.0, True, 0, 1.0), at - 0.3, 1.0)
            sfx.add(reverse_swell(0.7), at, 0.8)
        elif ty == "split":
            sfx.add(impact(False), at, 0.5)
        elif ty == "lock":
            sfx.add(click(1.3, 2000), at, 1.0)
            sfx.add(click(1.0, 3000), at + 0.06, 1.0)
            sfx.add(blip(float(hz(69)), 0.2, 1.0, 0.6), at + 0.06, 1.0)
        elif ty == "hover":
            sfx.add(blip(float(hz(86)), 0.05, 1.0, 0.35), at, 1.0, pan=0.6)
        elif ty == "click":
            sfx.add(click(2.2, 2400), at, 1.0, pan=0.6)
        elif ty == "crash":
            pass
        elif ty == "bounce":
            sfx.add(blip(float(hz(93)), 0.05, 0.8, 0.35), at, 1.0, pan=float(np.clip((c.get("k", 0) % 7) / 3 - 1, -1, 1)))
        elif ty == "grow":
            d = 1.6 if c.get("long") else 1.0
            n = int(d * SR)
            tt = np.arange(n) / SR
            fr = hz(62) * 2 ** ((2.0 if c.get("long") else 1.0) * (tt / d) ** 2)
            y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * tt / d) * 0.05
            sfx.add(y, at, 1.0)
        elif ty == "build":
            sfx.add(riser(1.4, 0.6), at, 1.0)
        elif ty == "sweep":
            for i in range(16):
                sfx.add(blip(float(hz(SCALE[i % 8] + 12 * (1 + i // 8))), 0.05, 1.0, 0.45), at + 0.2 + i * 0.075, 1.0, pan=-0.6 + 0.08 * i)
        elif ty == "count":
            k = 0.0
            while k < 1.0:
                sfx.add(click(0.5, 3400), at + k, 1.0, pan=0.4)
                k += 0.09 * (1 - 0.6 * k)
        elif ty == "final":
            sfx.add(impact(True), at, 0.9)
            for i, m in enumerate((74, 81, 86, 93)):
                sfx.add(pluck(float(hz(m)), 3.0, 1.2, buzz=0.3, seed=80 + i), at + 0.02 * i, 0.4, pan=-0.3 + 0.2 * i)
        elif ty == "swell":
            pass
    # The two sounds that are more than a cue: the network cut and the crash.
    for c in CUES:
        if c["type"] == "cut" and abs(c["t"] - 64.0) < 0.01:
            sfx.add(power_down(), c["t"], 1.0)
            sfx.add(glitch_burst(0.3), c["t"], 0.9)
            fx_cut_mute.append(c["t"])
        if c["type"] == "crash":
            sfx.add(impact(True), c["t"], 0.85)
            sfx.add(glitch_burst(0.5), c["t"], 1.0)
    # Toms under the outro's three bars.
    for i, tt in enumerate((108.0, 108.5, 109.0)):
        drums.add(tom_sample((98, 110, 131)[i]), tt, 0.9, pan=(-0.3, 0, 0.3)[i])
    # And under the reveal's equaliser: the drop's first beats get an extra hit.
    for i, tt in enumerate((20.5, 21.0, 21.5)):
        drums.add(tom_sample((110, 123, 98)[i]), tt, 0.45)

    # ---- rooms ----
    hall = make_ir(2.6, 1, 5500)
    room = make_ir(1.1, 2, 7000)
    music_dry = drums.out * 1.0 + bass.out * 0.9 + pads.out * 1.0 + lead.out * 0.85 + arps.out * 0.55
    music_send = pads.out * 0.5 + lead.out * 0.6 + arps.out * 0.6 + drums.out * 0.08
    music = music_dry + reverb(music_send, hall, 0.35)
    drone_all = drone.out * 0.8 + reverb(drone.out, hall, 0.4)

    # Section dynamics, in dB: quiet opening, the drop hits, the app section breathes, the climax is the loudest.
    tt = np.arange(N) / SR
    music *= db(np.interp(tt, [0, 9.5, 10.0, 19.4, 19.9, 20.0, 29.8, 30.4, 45.5, 46.0, 61.8, 62.2, 64.0, 70.0, 71.9, 72.0,
                               78.0, 80.0, 83.8, 84.0, 89.9, 90.0, 107.8, 108.0, 117.9, 118.0, 120.0],
                              [-9, -8, -6, -2, -1, 0, 0, -2.5, -2.5, 0, 0, -3, -3, -8, -1, -1,
                               -1, -6, -6, -4, -0.5, 0.5, 0.5, -4, -4, 0, 0]))
    drone_all *= db(np.interp(tt, [0, 63.99, 64.0, 69.9, 70.0, 120.0], [0, 0, -9, -3, 0, 0]))

    # Network off: the music cuts dead at 64 s and is back at 70 s. The drone stays.
    s0, s1 = int(64.0 * SR), int(70.0 * SR)
    fade = int(0.004 * SR)
    music[:, s0:s0 + fade] *= np.linspace(1, 0, fade)
    music[:, s0 + fade:s1] = 0
    music[:, s1:s1 + int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))

    mix = music + drone_all

    # Buffer-roll stutters on the glitches.
    for at, dur in ((18.95, 0.25), (95.6, 0.4)):
        s = int(at * SR)
        n = int(dur * SR)
        out = np.zeros((2, n))
        pos = 0
        seg = int(0.0625 * SR)
        while pos < n:
            seg = max(int(0.012 * SR), int(seg * 0.9))
            m = min(seg, n - pos)
            out[:, pos:pos + m] = mix[:, s:s + m] * np.hanning(m * 2)[m:] ** 0.2
            pos += m
        mix[:, s:s + n] = out

    # Tape stop at 78 s: everything slows to a halt in 0.75 s, then silence until the downbeat at 80.
    t0, D = 78.0, 0.75
    s = int(t0 * SR)
    n = int(D * SR)
    x = np.arange(n) / SR
    src = t0 + D / 2.4 * (1 - (1 - x / D) ** 2.4)
    stopped = np.vstack([np.interp(src, np.arange(mix.shape[1]) / SR, mix[c]) for c in range(2)])
    stopped = filt(stopped, "lowpass", 3000, 1) * (1 - x / D) ** 0.5
    mix[:, s:s + n] = stopped
    e = int(80.0 * SR)
    mix[:, s + n:e] = 0

    # Effects on top, in their own room.
    fxmix = sfx.out + reverb(sfx.out, room, 0.25)
    total = mix * db(-1.0) + fxmix * db(-2.5)

    # Fade the very end.
    tail = int(1.6 * SR)
    total[:, N - tail:] *= np.linspace(1, 0, tail) ** 1.5
    total[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))

    # ---- master: gentle bus compression, then a soft limiter ----
    mono = np.sqrt(np.mean(total ** 2, axis=0))
    win = int(0.05 * SR)
    rms = np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode="same") + 1e-12)
    lvl = 20 * np.log10(rms)
    thr, ratio = -17.0, 1.7
    gr = np.where(lvl > thr, (lvl - thr) * (1 - 1 / ratio), 0.0)
    # smooth the gain: fast attack, slow release
    sm = np.empty_like(gr)
    a, r = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.25 * SR))
    g = 0.0
    step = 64
    for i in range(0, len(gr), step):
        target = gr[i]
        coef = a ** step if target > g else r ** step
        g = target + (g - target) * coef
        sm[i:i + step] = g
    total = total * db(-sm)
    total = filt(total, "highpass", 30, 2)
    peak = np.max(np.abs(total))
    total = np.tanh(total / peak * 1.25) / np.tanh(1.25) * 0.9

    WORK.mkdir(parents=True, exist_ok=True)
    raw = WORK / "score_raw.wav"
    wavfile.write(raw, SR, total.T.astype(np.float32))
    # Loudness: two-pass loudnorm to -14 LUFS, -1.5 dBTP.
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    js = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-v", "error", "-i", str(raw), "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", str(WORK / "score.wav")], check=True)
    print(f"score.wav: input {js['input_i']} LUFS -> -14 LUFS")


if __name__ == "__main__":
    main()
