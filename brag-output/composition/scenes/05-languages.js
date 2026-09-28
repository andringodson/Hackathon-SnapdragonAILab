/* 05 22 languages. The same recorded line in all 22 translations, with "eigenvalues" pinned still. */
(() => {
  const { E, P, inout, clamp, lerp, el, S, words, hash } = R;
  const T0 = 46;
  const D = window.DATA;
  const N = D.langs.length;                 // 22
  const CX = 900;                           // where the anchor term sits
  const CY = 560;
  const DRUM_R = 390, DRUM_STEP = 0.42;     // cylinder radius (px) and angle per line (rad)
  // The reel steps on the eighth notes, then slows to land.
  const STEPS = [];
  for (let k = 1; k <= 18; k++) STEPS.push(1.4 + 0.25 * (k - 1));
  STEPS.push(6.0, 6.5, 7.15);
  const LAND = STEPS[STEPS.length - 1];
  const WALL = 8.3, COLLAPSE = 14.3;
  let COLS = [470, 1330];
  const ROW0 = 268, ROW = 62;
  let WALL_S = 0.44;

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function html(text, terms) {
    return text.split(/(\s+)/).map((tok) => {
      const bare = tok.replace(/[.,।۔!?]+$/u, "");
      const cls = bare === "eigenvalues" ? "pt anchor" : terms.includes(bare) || /^eigen/.test(bare) ? "pt" : "";
      return cls ? `<span class="${cls}">${esc(bare)}</span>${esc(tok.slice(bare.length))}` : esc(tok);
    }).join("");
  }

  R.scene({
    id: "langs", start: T0, dur: 16, pre: 2.1, post: 0.3,
    build(root, sc) {
      sc.persp = el("div", "lg-persp", root);
      sc.column = el("div", "lg-column", sc.persp);
      sc.lines = D.langs.map((L, k) => {
        const d = el("div", "lg-line", sc.persp, html(L.text, L.terms));
        d.dir = L.rtl ? "rtl" : "ltr";
        d.lang = L.code;
        const a = d.querySelector(".anchor");
        const r = d.getBoundingClientRect(), ar = a.getBoundingClientRect();
        d._ax = ar.left - r.left + ar.width / 2;
        d._ay = ar.top - r.top + ar.height / 2;
        d._ah = ar.height;
        d.style.transformOrigin = `${d._ax}px ${d._ay}px`;
        d._terms = [...d.querySelectorAll(".pt")];
        d._k = k;
        d._left = d._ax; d._right = r.width - d._ax;
        return d;
      });
      // No single anchor fits all 22 at this size (Urdu runs 1,064 px left of the term, Tamil 1,390 px right),
      // so the reel lands on a line that fits whole and the long ones pass in the fast part of the spin.
      sc.column.style.left = `${CX - 100}px`;
      // Wall: two columns of eleven, anchored on the term. Right-to-left lines run leftwards from it, so they
      // go in the left column with the lines that run least far right; the scale is the largest that leaves a gap.
      const rtl = sc.lines.filter((d) => d.dir === "rtl");
      const ltr = sc.lines.filter((d) => d.dir !== "rtl").sort((a, b) => a._right - b._right);
      const byK = (a, b) => a._k - b._k;
      const col0 = [...rtl, ...ltr.slice(0, 11 - rtl.length)].sort(byK), col1 = ltr.slice(11 - rtl.length).sort(byK);
      col0.forEach((d, i) => { d._col = 0; d._row = i; });
      col1.forEach((d, i) => { d._col = 1; d._row = i; });
      const ext = (c, side) => Math.max(...c.map((d) => d[side]));
      WALL_S = Math.min(0.46, (1780 - 60) / (ext(col0, "_left") + ext(col0, "_right") + ext(col1, "_left") + ext(col1, "_right")));
      COLS = [70 + ext(col0, "_left") * WALL_S, 1850 - ext(col1, "_right") * WALL_S];
      sc.gap = (COLS[1] - ext(col1, "_left") * WALL_S) - (COLS[0] + ext(col0, "_right") * WALL_S);
      sc.dot = el("div", "lg-dot", root);
      // English source, aligned on the same word.
      sc.en = el("div", "lg-en", root, `<b class="mono">EN</b> ${html(D.english, ["eigenvalues", "eigenvectors"])}`);
      const ea = sc.en.querySelector(".anchor");
      const er = sc.en.getBoundingClientRect(), ear = ea.getBoundingClientRect();
      sc.en.style.left = `${CX - (ear.left - er.left + ear.width / 2)}px`;

      sc.title = el("div", "lg-title", root);
      sc.titleW = words(sc.title, "Same line. **22** Indian languages.");
      sc.title2 = el("div", "lg-title", root);
      sc.title2W = words(sc.title2, "The technical terms **never change.**");

      sc.label = el("div", "lg-label", root, `<div class="native"></div><div class="eng mono"></div>`);
      sc.native = sc.label.querySelector(".native");
      sc.eng = sc.label.querySelector(".eng");
      sc.count = el("div", "lg-count mono", root);

      // Sound and light.
      R.cue(T0 - 2.0, "whoosh", { dir: 0, up: true });
      STEPS.forEach((s, k) => R.cue(T0 + s, "tick", { k, reel: true, last: k === STEPS.length - 1 }));
      R.cue(T0 + LAND, "land", { soft: true });
      R.cue(T0 + WALL, "whoosh", { dir: 0, long: true });
      R.cue(T0 + WALL + 1.6, "shimmer");
      R.cue(T0 + COLLAPSE, "suck");
      R.cue(T0 + 15.75, "pop", { hi: true });
      R.ripple(T0 + LAND, CX, CY, 0.7, 900);
      R.ripple(T0 + 15.75, CX, CY, 1, 1200);
      R.flash(T0 + 15.75, 0.25, "#4db8ff", 0.35);
      R.light(T0 - 1.5, 960, 540, 500, 0.5);
      R.light(T0 + 1.0, CX, CY, 360, 0.7);
      R.light(T0 + 7.5, CX, CY, 420, 0.9);
      R.light(T0 + 9.0, 960, 560, 900, 0.5);
      R.light(T0 + 14.0, 960, 560, 900, 0.5);
      R.light(T0 + 15.6, CX, CY, 200, 1);
    },

    pos(t) {
      let k = 0;
      for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i]) k = i + 1;
      if (k === 0) return 0;
      const last = k === STEPS.length;
      const d = last ? 0.5 : k > 18 ? 0.35 : 0.2;
      return k - 1 + (last ? E.outBackSoft : E.outBack)(clamp((t - STEPS[k - 1]) / d));
    },

    render(t, T) {
      const sc = this;
      const app = R.scenes.find((s) => s.id === "app");
      const pos = this.pos(t);
      const drumIn = P(t, 0.5, 0.8, E.outCubic);          // the neighbours fade in once the Hindi line has landed
      const collapse = (k) => P(t, COLLAPSE + (k % 11) * 0.03 + (k >= 11 ? 0.1 : 0), 0.7, E.inExpo);

      sc.lines.forEach((d, k) => {
        // Drum state.
        const th = (k - pos) * DRUM_STEP;
        const vis = Math.abs(th) < 1.3;
        let X = CX, Y = CY + Math.sin(th) * DRUM_R, Z = (Math.cos(th) - 1) * DRUM_R;
        let s = 1, rx = (-th * 180) / Math.PI, o = vis ? Math.pow(Math.max(0, Math.cos(th)), 4) : 0, blur = Math.abs(th) * 3;
        if (k !== 0) o *= drumIn;
        // Pre-roll: the Hindi line flies in from the app window.
        if (k === 0 && t < 0.2) {
          const span = app && app.focus && app.focus[0];
          if (span && t < 0) {
            const r = span.getBoundingClientRect();
            const p = P(t, -1.9, 1.9, E.inOutExpo);
            X = lerp(r.left + r.width / 2, CX, p);
            Y = lerp(r.top + r.height / 2, CY, p);
            Z = 0; rx = 0; blur = 0;
            s = lerp(r.height / d._ah, 1, p);
            o = t < -1.9 ? 0 : 1;
          }
        }
        // Wall state.
        const w = P(t, WALL + (k % 11) * 0.045 + d._col * 0.12, 1.0, E.inOutExpo);
        if (w > 0) {
          const WX = COLS[d._col], WY = ROW0 + d._row * ROW;
          X = lerp(X, WX, w); Y = lerp(Y, WY, w); Z = lerp(Z, 0, w); rx = lerp(rx, 0, w);
          s = lerp(s, WALL_S, w); o = lerp(o, 1, w); blur = lerp(blur, 0, w);
          // A slow drift so the wall breathes.
          const drift = P(t, WALL + 1, 6, E.inOutSine);
          Y += -10 * drift;
        }
        // Collapse to a point.
        const c = collapse(k);
        if (c > 0) { X = lerp(X, CX, c); Y = lerp(Y, CY, c); s *= 1 - c; o *= 1 - c * 0.6; blur += c * 6; }
        S(d, { x: X - d._ax, y: Y - d._ay, z: Z, rx, s, o, blur });
        // Terms: the anchor glows in the reel; in the wall a light runs down both columns.
        const sweep = Math.exp(-Math.pow((t - (WALL + 1.6 + d._row * 0.09 + d._col * 0.45)) / 0.28, 2));
        const glow = (k === Math.round(pos) && t < WALL ? 1 : 0) * 0.6 + sweep;
        d._terms.forEach((sp) => { sp.style.textShadow = `0 0 ${(18 + 40 * glow).toFixed(1)}px rgba(77,184,255,${(0.35 + 0.6 * Math.min(1, glow)).toFixed(3)})`; });
      });

      // Everything converges into one point of light, which pops.
      const dg = P(t, COLLAPSE + 0.55, 0.5, E.outBack), pop = P(t, 15.75, 0.35, E.outCubic);
      S(sc.dot, { x: CX - 14, y: CY - 14, s: dg * (1 + 5 * pop), o: dg * (1 - pop) });

      // The pinned column of light behind the anchor.
      const col = P(t, 0.9, 0.8, E.outCubic) * (1 - P(t, WALL - 0.2, 0.6, E.inCubic));
      S(sc.column, { o: col * 0.9, sy: 0.3 + 0.7 * col });

      // English source, above the reel.
      const en = P(t, 0.8, 0.7, E.outExpo) * (1 - P(t, WALL - 0.3, 0.4, E.inCubic));
      S(sc.en, { o: en * 0.9, y: (1 - en) * -20 });

      // Titles.
      const ttl = (ws, a, b) => ws.forEach((w, i) => {
        const p = P(t, a + i * 0.05, 0.6, E.outExpo), q = P(t, b + i * 0.02, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 34 - q * 24, blur: (1 - p) * 8 + q * 6 });
      });
      ttl(sc.titleW, 0.5, WALL - 0.4);
      ttl(sc.title2W, WALL + 0.9, COLLAPSE - 0.3);

      // Language label and counter, rolling with each step.
      const idx = Math.min(N - 1, Math.round(pos));
      const L = D.langs[idx];
      if (sc._idx !== idx) { sc.native.textContent = L.native; sc.eng.textContent = L.english; sc.native.lang = L.code; sc._idx = idx; }
      const lab = P(t, 0.9, 0.6, E.outExpo) * (1 - P(t, WALL - 0.3, 0.35, E.inCubic));
      const roll = Math.abs(pos - idx) * 2;                 // 0 settled, 1 mid-step
      S(sc.label, { o: lab * (1 - 0.7 * roll), y: (pos - idx) * -30 });
      sc.count.innerHTML = `${String(idx + 1).padStart(2, "0")}<span> / 22</span>`;
      S(sc.count, { o: lab });
    },
  });
})();
