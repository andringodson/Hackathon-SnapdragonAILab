/* 04 On screen. The desktop app, rebuilt from its own stylesheet, replaying its real Hindi session. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, hash, noise1 } = R;
  const T0 = 30;
  const D = window.DATA;
  const WX = 110, WY = 150, WW = 1340, WH = 830;
  // Which captions, and when they land (scene time). Timings are compressed; the footers are the real ones.
  const SHOW = [{ i: 1, a: 1.5 }, { i: 3, a: 10.6 }, { i: 8, a: 11.9 }];
  const GLOSS = [{ k: 0, a: 4.2 }, { k: 1, a: 4.55 }];
  const PUSH_IN = 5.7, PUSH_OUT = 9.75, FALL = 13.9;

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const fmt = (s) => { s = Math.floor(s); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  /** The translation, with the protected terms wrapped so the camera can find them. */
  function trHTML(text, terms) {
    return text.split(/(\s+)/).map((tok) => {
      const bare = tok.replace(/[.,।!?]+$/u, "");
      return terms.includes(bare) ? `<span class="pt">${esc(bare)}</span>${esc(tok.slice(bare.length))}` : esc(tok);
    }).join("");
  }
  const LOGO_SVG = '<svg class="logo" viewBox="0 0 64 64"><rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#050607" stroke="#23272d" stroke-width="3"/><g fill="none" stroke-linecap="round" stroke-width="4.5"><path d="M16 27v10" stroke="#ececec"/><path d="M24 19v26" stroke="#4db8ff"/><path d="M32 24v16" stroke="#ececec"/><path d="M41 26h9" stroke="#ececec" stroke-opacity=".6"/><path d="M41 38h5" stroke="#ececec" stroke-opacity=".6"/></g></svg>';

  R.scene({
    id: "app", start: T0, dur: 16, pre: 0.1, post: 0.2,
    build(root, sc) {
      // The blue from the logo dive, splitting open.
      sc.splitA = el("div", "ap-split a", root);
      sc.splitB = el("div", "ap-split b", root);

      sc.cam = el("div", "ap-cam", root);
      const w = el("div", "ap-win", sc.cam);
      sc.win = w;
      w.style.left = `${WX}px`; w.style.top = `${WY}px`; w.style.width = `${WW}px`; w.style.height = `${WH}px`;
      w.innerHTML = `
        <header class="bar">
          <div class="brand">${LOGO_SVG}<div><h1>Sahaay</h1><p class="tag">Offline lecture companion</p></div></div>
          <div class="bar-right">
            <div class="level"><span class="level-fill"></span></div>
            <div class="select">हिन्दी (Hindi)<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 4l4 4 4-4" stroke="#ececec" stroke-width="1.6" fill="none"/></svg></div>
            <div class="btn stop">Stop</div>
          </div>
        </header>
        <main>
          <section class="live">
            <div class="live-head"><h2>Live captions</h2>
              <div class="live-meta"><span class="pill good rtf">RTF —</span><span class="pill count">0 lines</span><span class="btn-icon">A−</span><span class="btn-icon">A+</span></div>
            </div>
            <div class="cap-view"><ol class="captions"></ol></div>
          </section>
          <aside class="side">
            <div class="side-head"><h2>Jargon</h2><span class="pill gcount">0</span></div>
            <p class="side-hint">Technical terms explained in your language, as they are spoken.</p>
            <ul class="glossary"></ul>
          </aside>
        </main>`;
      sc.level = w.querySelector(".level-fill");
      sc.rtf = w.querySelector(".rtf");
      sc.count = w.querySelector(".count");
      sc.gcount = w.querySelector(".gcount");
      sc.list = w.querySelector(".captions");
      sc.view = w.querySelector(".cap-view");
      sc.gl = w.querySelector(".glossary");

      sc.cards = SHOW.map(({ i, a }) => {
        const c = D.captions.find((x) => x.index === i);
        const li = el("li", "cap", sc.list);
        const src = el("p", "cap-src", li);
        const ws = R.words(src, c.text);
        const tr = el("p", "cap-tr", li, trHTML(c.tr, c.terms));
        const foot = el("div", "cap-foot", li, `${fmt(c.start_s)} · ${c.latency_ms} ms · RTF ${c.rtf.toFixed(2)} · en`);
        return { c, li, src, ws, tr, foot, a, fin: a + ws.length * 0.075 + 0.25, trAt: a + ws.length * 0.075 + 0.75 };
      });
      sc.gloss = GLOSS.map(({ k, a }) => {
        const g = D.gloss[k];
        const li = el("li", "gloss", sc.gl, `<div class="gloss-term">${esc(g.term)}</div><p class="gloss-def">${esc(g.explanation)}</p><div class="gloss-meta">${esc(g.backend)} · ${g.latency_ms} ms</div>`);
        return { li, a };
      });

      // Protected terms in the first card, for the push-in.
      const c1 = sc.cards[0];
      sc.focus = c1.tr.querySelectorAll(".pt");
      sc.srcTerms = c1.ws.filter((s) => /^eigen/.test(s.textContent));

      // Callouts and the overlay they draw into.
      sc.ov = svg("svg", { class: "ap-ov", width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, root);
      const CALL = [
        ["01", "Captions", "Whisper, on the device", 2.0, () => c1.src],
        ["02", "Translation", "NLLB-200, with the technical terms protected", 3.1, () => c1.tr],
        ["03", "Jargon", "Explained as it is spoken", 4.6, () => sc.gloss[0].li],
      ];
      sc.calls = CALL.map(([n, title, sub, a, target], k) => {
        const d = el("div", "ap-call", root, `<b class="mono">${n}</b><div class="t">${title}</div><div class="s">${sub}</div>`);
        d.style.top = `${300 + k * 190}px`;
        const path = svg("path", { fill: "none", stroke: "#4db8ff", "stroke-width": 1.6, "stroke-opacity": 0.8, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }, sc.ov);
        const dot = svg("circle", { r: 6, fill: "#4db8ff" }, sc.ov);
        const ring = svg("circle", { r: 6, fill: "none", stroke: "#4db8ff", "stroke-width": 1.5 }, sc.ov);
        return { d, path, dot, ring, a, target, k };
      });
      // Paired highlights: each term in the Hindi line, and the same word in the English line above it.
      sc.boxes = [];
      sc.focus.forEach((span, n) => {
        const srcW = sc.srcTerms.find((w) => w.textContent.replace(/[.,]/g, "") === span.textContent);
        const a = PUSH_IN + 0.75 + n * 0.5;
        sc.boxes.push({ span, a, tr: true, r: svg("rect", { rx: 8, fill: "rgba(77,184,255,0.16)", stroke: "#4db8ff", "stroke-width": 2 }, sc.ov) });
        if (srcW) sc.boxes.push({ span: srcW, a: a + 0.18, tr: false, r: svg("rect", { rx: 8, fill: "none", stroke: "rgba(77,184,255,0.65)", "stroke-width": 1.5, "stroke-dasharray": "5 5" }, sc.ov) });
      });
      sc.lower = el("div", "ap-lower", root, `<span class="term">eigenvalues</span> stays <span class="term">eigenvalues</span>.`);
      sc.side = el("div", "ap-side", root);
      sc.sideW = R.words(sc.side, "Captions land as the lecturer pauses.");
      sc.replay = el("div", "ap-replay mono", root, "Replay of a real recorded session · Hindi · sped up");

      // Scroll positions after each card lands.
      const view = sc.view.clientHeight;
      sc.scroll = sc.cards.map((cd) => Math.max(0, cd.li.offsetTop + cd.li.offsetHeight + 14 - view));

      // Sound and light.
      R.cue(T0, "split");
      R.cue(T0 + 0.15, "whoosh", { dir: 1, soft: true });
      sc.cards.forEach((cd) => {
        cd.ws.forEach((_, j) => R.cue(T0 + cd.a + j * 0.075, "type", { k: j }));
        R.cue(T0 + cd.trAt, "pop", { hi: true });
      });
      sc.gloss.forEach((g) => R.cue(T0 + g.a, "pop"));
      sc.calls.forEach((c) => R.cue(T0 + c.a, "blip", { k: c.k }));
      R.cue(T0 + PUSH_IN, "whoosh", { dir: 1, up: true });
      R.cue(T0 + PUSH_IN + 0.95, "lock");
      R.cue(T0 + PUSH_OUT, "whoosh", { dir: -1 });
      R.cue(T0 + FALL, "whoosh", { dir: 0, long: true });
      R.light(T0 + 0.5, 700, 500, 700, 0.35);
      R.light(T0 + 1.6, 520, 340, 420, 0.55);
      R.light(T0 + 4.4, 1300, 420, 420, 0.5);
      R.light(T0 + 6.6, 960, 470, 700, 0.6);
      R.light(T0 + 10.8, 700, 600, 600, 0.45);
      R.light(T0 + 14.6, 960, 540, 600, 0.5);
    },

    render(t, T) {
      const sc = this;
      // The blue split, top half up and bottom half down.
      const sp = P(t, 0, 0.62, E.inOutExpo);
      S(sc.splitA, { y: -560 * sp, o: t < 0.7 ? 1 : 0 });
      S(sc.splitB, { y: 560 * sp, o: t < 0.7 ? 1 : 0 });

      // Window: swings in, tilted; flattens for the push-in; falls away at the end.
      const fly = P(t, 0.05, 1.4, E.outExpo);
      const k = P(t, PUSH_IN, 1.0, E.inOutExpo) * (1 - P(t, PUSH_OUT, 0.9, E.inOutExpo));
      const fall = P(t, FALL, 1.5, E.inCubic);
      const ry = lerp(-34, -7, fly) * (1 - k) + 16 * fall;
      const rx = lerp(14, 3, fly) * (1 - k) + 22 * fall;
      S(sc.win, { z: lerp(-700, 0, fly) - 900 * fall, ry, rx, o: Math.min(1, fly * 2.5) * (1 - fall), blur: fall * 8 });

      // Camera push towards the protected term. Measure with the camera at rest, then apply.
      sc.cam.style.transform = "none";
      const fr = sc.focus[0].getBoundingClientRect();
      const px = fr.left + fr.width / 2, py = fr.top + fr.height / 2;
      const s = 1 + 1.25 * k;
      const cx = lerp(px, 960, k), cy = lerp(py, 450, k);
      sc.cam.style.transform = `translate(${(cx - s * px).toFixed(2)}px, ${(cy - s * py).toFixed(2)}px) scale(${s.toFixed(4)})`;

      // Header life: the input meter moves while the lecturer speaks.
      const speaking = t > 1.0 && t < 13.8;
      sc.level.style.width = `${speaking ? (18 + 62 * Math.abs(noise1(T * 7, 4)) * (0.6 + 0.4 * Math.abs(noise1(T * 2, 8)))).toFixed(1) : 4}%`;

      // Captions.
      let landed = 0;
      sc.cards.forEach((cd, n) => {
        const on = t >= cd.a;
        if (on) landed = n + 1;
        const p = P(t, cd.a, 0.45, E.outCubic);
        S(cd.li, { o: p, y: (1 - p) * 14 });
        cd.ws.forEach((w, j) => {
          const q = P(t, cd.a + j * 0.075, 0.3, E.outCubic);
          S(w, { o: q * (t < cd.fin ? 0.55 : 1), y: (1 - q) * 6 });
        });
        const tp = P(t, cd.trAt, 0.5, E.outCubic);
        const handedOff = n === 0 && t >= FALL + 0.1;
        S(cd.tr, { o: handedOff ? 0 : tp, y: (1 - tp) * 10 });
        S(cd.foot, { o: P(t, cd.fin, 0.4) });
      });
      sc.cards.forEach((cd, n) => cd.li.classList.toggle("latest", n === landed - 1));
      if (landed) {
        const c = sc.cards[landed - 1].c;
        sc.rtf.textContent = `RTF ${c.rtf.toFixed(2)}`;
        sc.count.textContent = `${landed} lines`;
      }
      // Scroll so the newest card is in view.
      let scr = 0;
      sc.cards.forEach((cd, n) => { if (t >= cd.a) scr = lerp(n ? sc.scroll[n - 1] : 0, sc.scroll[n], P(t, cd.a, 0.6, E.outExpo)); });
      sc.list.style.transform = `translateY(${-scr}px)`;

      let gl = 0;
      sc.gloss.forEach((g) => {
        const p = P(t, g.a, 0.45, E.outCubic);
        if (t >= g.a) gl++;
        S(g.li, { o: p, x: (1 - p) * 16 });
      });
      sc.gcount.textContent = String(gl);

      // Callouts and their leader lines.
      const callsOut = P(t, PUSH_IN - 0.2, 0.35, E.inCubic);
      sc.calls.forEach((c) => {
        const p = P(t, c.a, 0.7, E.outExpo);
        S(c.d, { o: p * (1 - callsOut), x: (1 - p) * 40 });
        const on = t > c.a && callsOut < 1;
        if (!on) { c.path.setAttribute("d", ""); S(c.dot, { o: 0 }); S(c.ring, { o: 0 }); return; }
        const r = c.target().getBoundingClientRect();
        const tx = Math.min(r.right + 18, 1440), ty = r.top + r.height / 2;
        const cr = c.d.getBoundingClientRect();
        const sx = cr.left - 22, sy = cr.top + 26;
        const mx = Math.max(tx + 40, sx - 60);
        c.path.setAttribute("d", `M ${sx} ${sy} H ${mx} L ${tx} ${ty}`);
        c.path.setAttribute("stroke-dashoffset", (1 - P(t, c.a + 0.05, 0.6, E.outCubic)).toFixed(3));
        c.path.setAttribute("opacity", (1 - callsOut).toFixed(3));
        const dp = P(t, c.a + 0.5, 0.3, E.outBack);
        c.dot.setAttribute("cx", tx); c.dot.setAttribute("cy", ty);
        S(c.dot, { o: dp * (1 - callsOut) });
        c.dot.setAttribute("r", Math.max(0, 5 * dp).toFixed(2));
        const rp = ((t - c.a - 0.5) % 1.2) / 1.2;
        c.ring.setAttribute("cx", tx); c.ring.setAttribute("cy", ty);
        c.ring.setAttribute("r", (6 + 22 * rp).toFixed(2));
        S(c.ring, { o: t > c.a + 0.5 ? (1 - rp) * (1 - callsOut) : 0 });
      });

      // Paired highlights snap onto each term, Hindi first, then the English word it came from.
      const bOn = k > 0.6 && t < PUSH_OUT + 0.4;
      sc.boxes.forEach((b) => {
        const p = P(t, b.a, 0.5, E.outBack) * (1 - P(t, PUSH_OUT - 0.15, 0.3, E.inCubic));
        if (!b.tr) b.span.classList.toggle("lit", bOn && p > 0.3);
        if (!bOn || p <= 0.001) { b.r.setAttribute("opacity", 0); return; }
        const r = b.span.getBoundingClientRect();
        const px = 8 + (1 - p) * 26, py = 2 + (1 - p) * 16;
        b.r.setAttribute("x", (r.left - px).toFixed(1)); b.r.setAttribute("y", (r.top - py + 4).toFixed(1));
        b.r.setAttribute("width", (r.width + 2 * px).toFixed(1)); b.r.setAttribute("height", (r.height + 2 * py - 8).toFixed(1));
        b.r.setAttribute("opacity", Math.min(1, p).toFixed(3));
      });
      const lw = P(t, PUSH_IN + 1.1, 0.6, E.outExpo) * (1 - P(t, PUSH_OUT - 0.2, 0.3, E.inCubic));
      S(sc.lower, { o: lw, y: (1 - lw) * 30 });

      // Right-hand line while the next captions land.
      sc.sideW.forEach((w, i) => {
        const p = P(t, 10.5 + i * 0.05, 0.6, E.outExpo);
        const q = P(t, FALL - 0.3 + i * 0.02, 0.3, E.inCubic);
        S(w, { o: Math.min(1, p * 1.5) * (1 - q), y: (1 - p) * 30 - q * 20, blur: (1 - p) * 6 });
      });
      S(sc.replay, { o: 0.75 * P(t, 1.2, 0.6) * (1 - callsOut * (1 - P(t, PUSH_OUT + 0.3, 0.5))) * (1 - P(t, FALL - 0.3, 0.3)) });
    },
  });
})();
