/* 01 The line. A lecturer's code-mixed sentence rises out of their voice.

   With the voiceover (voice.js, from voice.py) the lecturer really says it:
   each word appears as he says it, and the waveform is his voice's own
   loudness. Without it, the words build on a fixed beat. */
(() => {
  const { E, P, inout, clamp, lerp, el, S, words, scramble, hash, noise1, GLYPHS } = R;

  const WAVE_N = 88, WAVE_W = 1400, WAVE_H = 260;
  const V = window.VOICE || null;
  const SPEECH_END = V ? V.hookEnd : 2.2;
  const DIM = V ? SPEECH_END + 0.12 : 4.9;               // Hindi dims, terms stay lit
  const SUB1 = V ? [6.0, 8.1] : [5.0, 7.9];
  const SUB2 = V ? [8.2, 10.02] : [8.0, 10.02];

  R.scene({
    id: "hook", start: 0, dur: 10, post: 0.6,
    build(root, sc) {
      const box = el("div", "hook-sentence", root);
      const l1 = el("div", "line", box), l2 = el("div", "line", box);
      sc.box = box;
      sc.words = [
        ...words(l1, "**Matrix** A ka **determinant** zero hoga,"),
        ...words(l2, "tabhi **non-trivial** **solution** milega."),
      ];
      sc.words.forEach((w, i) => {
        w._t = V ? V.hook[i] : 0.35 + i * 0.19;
        w._term = w.classList.contains("term");
        w._text = w.textContent;
        if (w._term) w._ul = el("i", "ul", w);
        const r = w.getBoundingClientRect();
        w._cx = r.left + r.width / 2; w._cy = r.top + r.height / 2;
        // Syllable bumps for the waveform: roughly one per three letters.
        w._syl = Math.max(1, Math.round(w._text.length / 3));
        if (!V) R.cue(w._t, "tick", { k: i, term: w._term });   // with a voice, he is the sound
      });

      sc.wave = el("canvas", "hook-wave", root);
      sc.wave.width = WAVE_W; sc.wave.height = WAVE_H;
      sc.ctx = sc.wave.getContext("2d");

      sc.sub1 = el("div", "hook-sub", root);
      sc.sub1w = words(sc.sub1, V ? "Hindi sentence. **English terms.**" : "Half of it is Hindi. The terms are **English.**");
      sc.sub2 = el("div", "hook-sub", root);
      sc.sub2w = words(sc.sub2, "Now follow it in your **second language.**");

      // The field lights up under each word as it is spoken.
      R.light(0, 960, 730, 160, 0);
      sc.words.forEach((w) => R.light(w._t + 0.05, w._cx, w._cy, 300, 0.75));
      R.light(SPEECH_END + 0.5, 960, 440, 560, 0.3);
      R.light(9.4, 960, 440, 560, 0.35);
      R.light(9.9, 960, 520, 820, 0.9);
      R.ripple(9.62, 960, 440, 0.9, 1100);
      R.cue(9.55, "shatter");
      R.cue(DIM, "swell");
      R.glitch(9.98, 0.3, 0.9);
    },

    /** Speech energy at time τ, and how much of it comes from an English term. */
    energy(sc, tau) {
      if (V) {
        const k = Math.floor((tau - V.hookStart) * 100);
        const e = k >= 0 && k < V.hookEnv.length ? V.hookEnv[k] : 0;
        let w = null;
        for (const x of sc.words) if (tau >= x._t) w = x;
        return [e, w && w._term ? 1 : 0];
      }
      let e = 0, term = 0;
      for (const w of sc.words) {
        for (let j = 0; j < w._syl; j++) {
          const c = w._t + 0.05 + j * 0.075;
          const d = (tau - c) / 0.06;
          if (d < -4 || d > 4) continue;
          const v = Math.exp(-d * d) * (0.75 + 0.25 * hash(j, w._t * 100));
          e += v;
          if (w._term) term += v;
        }
      }
      return [Math.min(1.2, e), e > 0.001 ? term / e : 0];
    },

    render(t, T) {
      const sc = this;
      // Camera: a slow push for the whole scene.
      S(sc.box, { s: 1 + 0.035 * E.inOutSine(clamp(t / 10)), y: -8 * clamp(t / 10) });

      // Words rise out of the voice; later the Hindi dims and the terms stay lit.
      const dim = P(t, DIM, 0.7, E.inOutCubic);
      sc.words.forEach((w, i) => {
        const shat = 9.5 + hash(i, 4) * 0.28;
        if (t < shat) {
          const p = P(t, w._t, 0.6, E.outExpo);
          const o = P(t, w._t, 0.22, E.outCubic);
          const lift = w._term ? -6 * dim : 0;
          const glow = w._term ? Math.exp(-Math.max(0, t - w._t) * 3) : 0;
          S(w, { y: (1 - p) * 54 + lift, s: 0.92 + 0.08 * p, o: o * (w._term ? 1 : 1 - 0.76 * dim), blur: (1 - p) * 12 });
          if (w._term) {
            w.style.textShadow = `0 0 ${(28 + 40 * glow).toFixed(1)}px rgba(77,184,255,${(0.35 + 0.5 * glow).toFixed(3)})`;
            S(w._ul, { sx: P(t, DIM + 0.15 + i * 0.05, 0.7, E.outExpo) });
          }
          if (w.firstChild.nodeValue !== w._text) w.firstChild.nodeValue = w._text;
        } else {
          // Shatter: the letters turn to glyphs and fall into the field.
          const dt = t - shat;
          const vx = (hash(i, 7) - 0.5) * 520, vy = -220 - hash(i, 8) * 260;
          S(w, { x: vx * dt, y: vy * dt + 0.5 * 2600 * dt * dt, r: (hash(i, 9) - 0.5) * 260 * dt, o: 1 - dt / 0.75, blur: dt * 7 });
          w.firstChild.nodeValue = R.glyphs(w._text, T, i + 3);
          w.style.color = "#4db8ff";
          if (w._ul) S(w._ul, { o: 1 - dt / 0.15 });
        }
      });

      // The waveform: symmetric, spreading out from the centre like a voice in a room.
      const ctx = sc.ctx;
      ctx.clearRect(0, 0, WAVE_W, WAVE_H);
      const wo = V ? inout(t, 0, 0.3, SPEECH_END - 0.05, 0.45, E.outCubic, E.inCubic) : inout(t, 0, 0.3, 4.3, 0.7, E.outCubic, E.inCubic);
      S(sc.wave, { o: wo });
      if (wo > 0.001) {
        const reveal = P(t, 0.0, 0.9, E.outCubic);
        const pitch = WAVE_W / WAVE_N, bw = 7;
        for (let j = 0; j < WAVE_N; j++) {
          const off = Math.abs(j - (WAVE_N - 1) / 2) / (WAVE_N / 2);
          if (off > reveal) continue;
          const tau = t - off * 0.55;
          const [e, term] = this.energy(sc, tau);
          const n = 0.55 + 0.45 * Math.abs(noise1(j * 0.9 + tau * 9, 3));
          const idle = V ? 3 : 3 + 2.5 * (1 + Math.sin(tau * 5 + j * 0.5)) * clamp((t - 2.2) / 0.6) * (1 - clamp((t - 4) / 0.4));
          const h = Math.max(4, idle + e * 200 * n * (1 - off * 0.55));
          const x = j * pitch + (pitch - bw) / 2;
          const c = term > 0.4 ? `rgba(77,184,255,${0.55 + 0.45 * e})` : `rgba(236,236,236,${0.25 + 0.5 * Math.min(1, e)})`;
          ctx.fillStyle = c;
          const y = (WAVE_H - h) / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, bw, h, bw / 2);
          ctx.fill();
        }
      }

      // Sublines.
      const sub = (ws, a, b, T0) => ws.forEach((w, i) => {
        const p = P(t, a + i * 0.04, 0.55, E.outExpo);
        const q = P(t, b + i * 0.02, 0.32, E.inCubic);
        S(w, { y: (1 - p) * 30 - q * 22, o: Math.min(p * 1.4, 1) * (1 - q), blur: (1 - p) * 8 + q * 5 });
      });
      sub(sc.sub1w, SUB1[0], SUB1[1]);
      sub(sc.sub2w, SUB2[0], SUB2[1]);
    },
  });
})();
