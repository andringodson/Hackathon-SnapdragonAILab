/* The reel's engine.

   Every frame is a pure function of time: R.seek(T) sets every element's
   style from T alone, with no clocks, no CSS transitions and no randomness
   that is not seeded. So a frame can be rendered in any order, by any number
   of browsers at once, and always comes out the same.

   Scenes register with R.scene({id, start, dur, pre, post, build, render}).
   render(t, T) gets scene-local time t (negative in the pre-roll) and the
   global T. Sound cues are registered with R.cue(); render.py reads them
   back out so score.py puts every whoosh and hit on the frame it belongs to. */

(() => {
  "use strict";

  const W = 1920, H = 1080;
  const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const E = {
    lin: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outBackSoft: (t) => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  };
  /** Eased progress of a move that starts at `a` and lasts `d` seconds. */
  const P = (t, a, d, e = E.outExpo) => e(clamp((t - a) / d));
  /** 0 → 1 → 0: in over [a, a+din], hold, out over [b, b+dout]. */
  const inout = (t, a, din, b, dout, ein = E.outExpo, eout = E.inCubic) =>
    t < b ? P(t, a, din, ein) : 1 - P(t, b, dout, eout);

  // Seeded randomness: mulberry32, and a stateless hash for per-frame noise.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(a, b = 0, c = 0) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /** Smooth 1-D value noise in [-1, 1]. */
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
  }

  // ---- DOM helpers ----
  function el(tag, cls, parent, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /** Style from numbers. Only what is passed is touched. */
  function S(n, o) {
    const st = n.style;
    if ("x" in o || "y" in o || "z" in o || "s" in o || "sx" in o || "sy" in o || "r" in o || "rx" in o || "ry" in o || "skx" in o) {
      let tr = "";
      if (o.x || o.y || o.z) tr += `translate3d(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px,${(o.z || 0).toFixed(2)}px) `;
      if (o.rx) tr += `rotateX(${o.rx.toFixed(3)}deg) `;
      if (o.ry) tr += `rotateY(${o.ry.toFixed(3)}deg) `;
      if (o.r) tr += `rotate(${o.r.toFixed(3)}deg) `;
      if (o.skx) tr += `skewX(${o.skx.toFixed(3)}deg) `;
      if (o.s !== undefined && o.s !== 1) tr += `scale(${o.s.toFixed(4)}) `;
      if (o.sx !== undefined || o.sy !== undefined) tr += `scale(${(o.sx ?? 1).toFixed(4)},${(o.sy ?? 1).toFixed(4)}) `;
      st.transform = tr || "none";
    }
    if ("o" in o) {
      const v = clamp(o.o);
      st.opacity = v.toFixed(3);
      st.visibility = v < 0.002 ? "hidden" : "";
    }
    if ("blur" in o) st.filter = o.blur > 0.15 ? `blur(${o.blur.toFixed(2)}px)` : "none";
    if ("clip" in o) st.clipPath = o.clip;
    if ("w" in o) st.width = `${o.w.toFixed(2)}px`;
    if ("h" in o) st.height = `${o.h.toFixed(2)}px`;
    if ("color" in o) st.color = o.color;
    if ("bg" in o) st.background = o.bg;
  }
  const show = (n, on) => { n.style.display = on ? "" : "none"; };

  /** Split text into word spans. `**term**` marks a highlighted term. */
  function words(parent, text, cls = "w") {
    const out = [];
    const parts = text.split(/(\*\*[^*]+\*\*|\s+)/).filter((p) => p !== "");
    for (const p of parts) {
      if (/^\s+$/.test(p)) { parent.appendChild(document.createTextNode(" ")); continue; }
      const term = p.startsWith("**");
      const s = el("span", cls + (term ? " term" : ""), parent);
      s.textContent = term ? p.slice(2, -2) : p;
      out.push(s);
    }
    return out;
  }
  /** Split into character spans (Latin only: Indic clusters must stay whole). */
  function chars(parent, text, cls = "c") {
    const out = [];
    for (const ch of Array.from(text)) {
      if (ch === " ") { parent.appendChild(document.createTextNode(" ")); continue; }
      const s = el("span", cls, parent);
      s.textContent = ch;
      out.push(s);
    }
    return out;
  }

  const GLYPHS = Array.from("01234567890λπΣΔ∫√∞≈∂θ" + "कखगघचजटडतथदधनपफबभमयरलवशसह");
  const LATIN = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\");
  /** Decode effect: the text resolves left to right out of changing glyphs. */
  function scramble(text, p, T, seed = 1, set = LATIN) {
    const a = Array.from(text);
    const n = a.length;
    const shown = Math.floor(p * (n + 4));
    const frame = Math.floor(T * 30);
    return a.map((ch, i) => {
      if (ch === " " || i < shown - 4) return ch;
      if (i >= shown) return i < shown + 6 && p > 0 ? set[Math.floor(hash(i, frame, seed) * set.length)] : " ";
      return set[Math.floor(hash(i, frame, seed) * set.length)];
    }).join("");
  }

  /** Every character replaced by a changing glyph. */
  function glyphs(text, T, seed = 1, set = GLYPHS, rate = 24) {
    const f = Math.floor(T * rate);
    return Array.from(text).map((ch, i) => (ch === " " ? ch : set[Math.floor(hash(i, f, seed) * set.length)])).join("");
  }
  /** Words inside clipping masks, so they can rise into and out of an invisible baseline. */
  function maskWords(parent, text, cls = "w") {
    const out = [];
    const parts = text.split(/(\*\*[^*]+\*\*|\s+)/).filter((p) => p !== "");
    for (const p of parts) {
      if (/^\s+$/.test(p)) { parent.appendChild(document.createTextNode(" ")); continue; }
      const term = p.startsWith("**");
      const m = el("span", "mk", parent);
      const s = el("span", cls + (term ? " term" : ""), m);
      s.textContent = term ? p.slice(2, -2) : p;
      out.push(s);
    }
    return out;
  }

  // ---- the reel ----
  const R = {
    W, H, BPM, BEAT, BAR, FPS: 60, DUR: 120,
    E, P, inout, clamp, lerp, mix, rng, hash, noise1, el, svg, S, show, words, chars, scramble, glyphs, maskWords, GLYPHS, LATIN,
    scenes: [],
    cues: [],
    ripples: [],
    flashes: [],
    glitches: [],
    shakes: [],
    lights: [],
    ready: false,
    T: 0,
  };
  window.R = R;

  R.scene = (def) => { R.scenes.push(Object.assign({ pre: 0, post: 0 }, def)); };
  /** A sound cue at global time T. score.py reads these. */
  R.cue = (T, type, opts = {}) => { R.cues.push(Object.assign({ t: +T.toFixed(4), type }, opts)); };
  /** A ring of light across the matrix field. */
  R.ripple = (T, x, y, strength = 1, speed = 900) => R.ripples.push({ T, x, y, strength, speed });
  R.flash = (T, dur = 0.35, color = "#ffffff", peak = 0.9) => R.flashes.push({ T, dur, color, peak });
  R.glitch = (T, dur = 0.3, amt = 1) => R.glitches.push({ T, dur, amt });
  R.shake = (T, dur = 0.5, amt = 14) => R.shakes.push({ T, dur, amt });
  /** Where the matrix field is lit: keyframes of {T, x, y, r, k} (k = strength). */
  R.light = (T, x, y, r = 260, k = 1) => R.lights.push({ T, x, y, r, k });

  // Beat pulse (0..1) that decays after each kick, for things that breathe with the music.
  R.kick = (T, from = 20, to = 120, decay = 7) => {
    if (T < from || T > to) return 0;
    const ph = (T - from) % BEAT;
    return Math.exp(-ph * decay);
  };

  function lightAt(T) {
    const L = R.lights;
    if (!L.length) return { x: W / 2, y: H / 2, r: 0, k: 0 };
    if (T <= L[0].T) return L[0];
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      if (T <= b.T) {
        const u = E.inOutCubic((T - a.T) / Math.max(1e-6, b.T - a.T));
        return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), r: lerp(a.r, b.r, u), k: lerp(a.k, b.k, u) };
      }
    }
    return L[L.length - 1];
  }

  // ---- background: the product's matrix field, as a function of time ----
  const BG = { CELL: 26, FONT: 15, BASE: 0.07, HOT: 0.62, COLOR: "#4db8ff" };
  function buildBg(stage) {
    const c = el("canvas", "bg", stage);
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const cols = Math.ceil(W / BG.CELL), rows = Math.ceil(H / BG.CELL);
    const atlas = document.createElement("canvas");
    const s = BG.CELL;
    atlas.width = s * GLYPHS.length; atlas.height = s;
    const a = atlas.getContext("2d");
    a.fillStyle = BG.COLOR;
    a.font = `${BG.FONT}px "Cascadia Code", Consolas, "Nirmala UI", monospace`;
    a.textAlign = "center"; a.textBaseline = "middle";
    GLYPHS.forEach((g, i) => a.fillText(g, i * s + s / 2, s / 2));
    // Rain: each drop is a column, a speed and a phase; its head is at (T*speed + phase) mod span.
    const drops = [];
    const r = rng(7);
    for (let k = 0; k < 34; k++) drops.push({ col: Math.floor(r() * cols), speed: 5 + r() * 9, phase: r() * 60, span: rows + 18 });
    BG.canvas = c; BG.ctx = ctx; BG.cols = cols; BG.rows = rows; BG.atlas = atlas; BG.drops = drops;
  }
  R.bgLevel = () => 1;       // scenes can dim the whole field (0..1)
  R.bgTint = () => null;     // or tint it, e.g. red during the problem
  function drawBg(T) {
    const { ctx, cols, rows, atlas, CELL } = BG;
    const level = R.bgLevel(T);
    ctx.clearRect(0, 0, W, H);
    if (level <= 0.001) return;
    const heat = new Float32Array(cols * rows);
    // Rain trails.
    for (const d of BG.drops) {
      const head = ((T * d.speed + d.phase) % d.span) - 9;
      for (let k = 0; k < 14; k++) {
        const row = Math.floor(head) - k;
        if (row < 0 || row >= rows) continue;
        const v = 0.42 * Math.pow(0.8, k + (head - Math.floor(head)));
        const i = row * cols + d.col;
        if (v > heat[i]) heat[i] = v;
      }
    }
    // The light that follows the action.
    const L = lightAt(T);
    if (L.k > 0.01) {
      const rr = L.r;
      const c0 = Math.max(0, Math.floor((L.x - rr) / CELL)), c1 = Math.min(cols - 1, Math.floor((L.x + rr) / CELL));
      const r0 = Math.max(0, Math.floor((L.y - rr) / CELL)), r1 = Math.min(rows - 1, Math.floor((L.y + rr) / CELL));
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
        const dx = x * CELL + CELL / 2 - L.x, dy = y * CELL + CELL / 2 - L.y;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < rr) { const f = 1 - dd / rr; const i = y * cols + x; heat[i] = Math.max(heat[i], f * f * 0.55 * L.k); }
      }
    }
    // Ripples.
    for (const rp of R.ripples) {
      const age = T - rp.T;
      if (age < 0 || age > 2.4) continue;
      const rad = age * rp.speed;
      const life = Math.max(0, 1 - age / 2.4) * rp.strength;
      const band = CELL * 1.6;
      const c0 = Math.max(0, Math.floor((rp.x - rad - band) / CELL)), c1 = Math.min(cols - 1, Math.floor((rp.x + rad + band) / CELL));
      const r0 = Math.max(0, Math.floor((rp.y - rad - band) / CELL)), r1 = Math.min(rows - 1, Math.floor((rp.y + rad + band) / CELL));
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
        const dx = x * CELL + CELL / 2 - rp.x, dy = y * CELL + CELL / 2 - rp.y;
        const b = Math.abs(Math.sqrt(dx * dx + dy * dy) - rad);
        if (b < band) { const i = y * cols + x; heat[i] = Math.max(heat[i], (1 - b / band) * life * 0.95); }
      }
    }
    // Glyphs flicker slowly; hot cells change faster.
    const slow = Math.floor(T * 1.5), fast = Math.floor(T * 12);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const h = heat[i];
      const flick = hash(i, 99) < 0.12 ? 0.5 + 0.5 * Math.sin(T * (1 + hash(i, 5) * 3) + i) : 1;
      const alpha = (BG.BASE * (0.55 + 0.45 * flick) + h * BG.HOT) * level;
      if (alpha < 0.01) continue;
      const g = Math.floor(hash(i, h > 0.15 ? fast : slow + Math.floor(hash(i, 3) * 7)) * GLYPHS.length);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(atlas, g * CELL, 0, CELL, CELL, x * CELL, y * CELL, CELL, CELL);
    }
    ctx.globalAlpha = 1;
    const tint = R.bgTint(T);
    if (tint) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // ---- the showreel HUD ----
  const CHAPTERS = [];
  R.chapter = (T, n, name) => CHAPTERS.push({ T, n, name });
  const HUD = {};
  function buildHud(stage) {
    const h = el("div", "hud", stage);
    HUD.root = h;
    HUD.marks = ["tl", "tr", "bl", "br"].map((k) => el("i", "mark " + k, h));
    HUD.chap = el("div", "hud-chap", h);
    HUD.chapNum = el("b", "", HUD.chap);
    HUD.chapName = el("span", "", HUD.chap);
    HUD.right = el("div", "hud-right", h, "BUILD &amp; PRESENT 2026");
    HUD.tc = el("div", "hud-tc", h);
    HUD.bar = el("div", "hud-bar", h);
    HUD.fill = el("i", "hud-fill", HUD.bar);
    HUD.ticks = [];
  }
  function drawHud(T) {
    if (!HUD.ticks.length && CHAPTERS.length) {
      for (const c of CHAPTERS) { const k = el("i", "hud-tick", HUD.bar); k.style.left = `${(c.T / R.DUR) * 100}%`; HUD.ticks.push(k); }
    }
    const vis = R.hudLevel(T);
    S(HUD.root, { o: vis });
    if (vis <= 0.001) return;
    let cur = null;
    for (const c of CHAPTERS) if (T >= c.T - 0.001) cur = c;
    if (cur) {
      const p = clamp((T - cur.T) / 0.6);
      HUD.chapNum.textContent = String(cur.n).padStart(2, "0") + " / " + String(CHAPTERS.length).padStart(2, "0");
      HUD.chapName.textContent = scramble(cur.name.toUpperCase(), p, T, cur.n);
    }
    const f = Math.round(T * R.FPS);
    const fr = f % R.FPS, s = Math.floor(f / R.FPS);
    HUD.tc.textContent = `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(fr).padStart(2, "0")}`;
    S(HUD.fill, { sx: clamp(T / R.DUR) });
  }
  R.hudLevel = () => 1;

  // ---- global layers: flash, glitch, shake, vignette ----
  function buildFx(stage) {
    R.flashEl = el("div", "flash", stage);
    R.vignette = el("div", "vignette", stage);
    // Glitch: an SVG filter that tears the frame into horizontal slices and splits the colour channels.
    const s = svg("svg", { width: 0, height: 0, style: "position:absolute" }, document.body);
    const f = svg("filter", { id: "glitch", x: "-5%", y: "0", width: "110%", height: "100%", "color-interpolation-filters": "sRGB" }, s);
    R.gTurb = svg("feTurbulence", { type: "fractalNoise", baseFrequency: "0.00001 0.035", numOctaves: "1", seed: "1", result: "n" }, f);
    const ct = svg("feComponentTransfer", { in: "n", result: "steps" }, f);
    svg("feFuncR", { type: "discrete", tableValues: "0.5 0.5 0.1 0.5 0.9 0.5 0.5 0.3 0.5 0.75" }, ct);
    svg("feFuncG", { type: "discrete", tableValues: "0.5" }, ct);
    R.gDisp = svg("feDisplacementMap", { in: "SourceGraphic", in2: "steps", scale: "0", xChannelSelector: "R", yChannelSelector: "G", result: "d" }, f);
    svg("feColorMatrix", { in: "d", type: "matrix", values: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", result: "r" }, f);
    R.gOffR = svg("feOffset", { in: "r", dx: "0", dy: "0", result: "ro" }, f);
    svg("feColorMatrix", { in: "d", type: "matrix", values: "0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0", result: "gb" }, f);
    R.gOffGB = svg("feOffset", { in: "gb", dx: "0", dy: "0", result: "gbo" }, f);
    svg("feBlend", { in: "ro", in2: "gbo", mode: "screen" }, f);
  }
  function drawFx(T) {
    // Flash
    let fa = 0, fc = "#fff";
    for (const f of R.flashes) {
      const age = T - f.T;
      if (age < 0 || age > f.dur) continue;
      const v = f.peak * Math.pow(1 - age / f.dur, 2.2);
      if (v > fa) { fa = v; fc = f.color; }
    }
    S(R.flashEl, { o: fa, bg: fc });
    // Glitch
    let g = 0;
    for (const q of R.glitches) {
      const age = T - q.T;
      if (age < 0 || age > q.dur) continue;
      const env = Math.sin(Math.PI * (age / q.dur)) ** 0.6;
      g = Math.max(g, env * q.amt * (0.55 + 0.45 * hash(Math.floor(T * 60), 17)));
    }
    if (g > 0.01) {
      const fr = Math.floor(T * 60);
      R.gTurb.setAttribute("seed", String(1 + (fr % 97)));
      R.gTurb.setAttribute("baseFrequency", `0.00001 ${(0.012 + hash(fr, 3) * 0.05).toFixed(4)}`);
      R.gDisp.setAttribute("scale", (g * 160).toFixed(1));
      const off = (g * 14 * (hash(fr, 9) > 0.5 ? 1 : -1)).toFixed(1);
      R.gOffR.setAttribute("dx", off);
      R.gOffGB.setAttribute("dx", String(-off));
      R.frame.style.filter = "url(#glitch)";
    } else {
      R.frame.style.filter = "none";
    }
    // Shake
    let sx = 0, sy = 0;
    for (const k of R.shakes) {
      const age = T - k.T;
      if (age < 0 || age > k.dur) continue;
      const a = k.amt * Math.pow(1 - age / k.dur, 2);
      sx += noise1(age * 38, 11) * a;
      sy += noise1(age * 38, 23) * a;
    }
    R.frame.style.transform = sx || sy ? `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)` : "none";
  }

  R.init = async () => {
    const stage = document.getElementById("stage");
    R.stage = stage;
    R.frame = el("div", "frame", stage);          // everything that shakes and glitches
    buildBg(R.frame);
    R.world = el("div", "world", R.frame);
    for (const sc of R.scenes) {
      sc.root = el("section", "scene", R.world);
      sc.root.id = "s-" + sc.id;
    }
    buildFx(stage);
    buildHud(stage);
    await document.fonts.ready;
    // Build after fonts, so scenes can measure text.
    for (const sc of R.scenes) await sc.build(sc.root, sc);
    R.lights.sort((a, b) => a.T - b.T);
    R.cues.sort((a, b) => a.t - b.t);
    await document.fonts.ready;
    R.ready = true;
  };

  R.seek = (T) => {
    R.T = T;
    drawBg(T);
    for (const sc of R.scenes) {
      const on = T >= sc.start - sc.pre && T < sc.start + sc.dur + sc.post;
      if (on !== sc._on) { show(sc.root, on); sc._on = on; }
      if (on) sc.render(T - sc.start, T);
    }
    drawFx(T);
    drawHud(T);
  };

  /** Preview in a normal browser: play in real time, with the score if it exists. */
  R.play = (from = 0) => {
    const audio = new Audio("../work/score.wav");
    audio.currentTime = from;
    audio.play().catch(() => {});
    const t0 = performance.now() - from * 1000;
    const loop = () => {
      const T = (performance.now() - t0) / 1000;
      if (T > R.DUR) return;
      R.seek(T);
      requestAnimationFrame(loop);
    };
    loop();
  };
})();
