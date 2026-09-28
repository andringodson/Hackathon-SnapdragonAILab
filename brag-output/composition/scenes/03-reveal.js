/* 03 Sahaay. The drop: three sound bars slam up like an equaliser and land as the logo. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, maskWords, words, hash } = R;
  const T0 = 20;

  // The logo, from web/static/logo.svg (viewBox 64): bars at x = 16, 24, 32, centred on y = 32.
  const LOGO = 250, K = LOGO / 64;
  const LX = 960 - LOGO / 2, LY = 118;              // logo box top-left on the stage
  const BARS = [
    { x: 16, h: 10, color: "#ececec" },
    { x: 24, h: 26, color: "#4db8ff" },
    { x: 32, h: 16, color: "#ececec" },
  ];
  // Equaliser heights on each beat of the drop, as a fraction of the frame.
  const EQ = [[0.62, 0.9, 0.55], [0.4, 0.72, 0.66], [0.7, 0.58, 0.8], [0.35, 0.86, 0.5]];
  const LAND = 2.55;                                  // when the bars become the logo

  R.scene({
    id: "reveal", start: T0, dur: 10, post: 0.35,
    build(root, sc) {
      sc.cam = el("div", "rv-cam", root);
      sc.bars = BARS.map((b) => { const d = el("div", "rv-bar", sc.cam); d.style.background = b.color; d._b = b; return d; });
      sc.bars[1].classList.add("blue");

      // Logo frame and the two "text" lines, drawn in SVG over the bars.
      const s = svg("svg", { class: "rv-logo", viewBox: "0 0 64 64", width: LOGO, height: LOGO }, sc.cam);
      s.style.left = `${LX}px`; s.style.top = `${LY}px`;
      sc.box = svg("rect", { x: 1.5, y: 1.5, width: 61, height: 61, rx: 16, fill: "#050607", stroke: "#23272d", "stroke-width": 3, pathLength: 100, "stroke-dasharray": "100", "stroke-dashoffset": "100" }, s);
      sc.l1 = svg("path", { d: "M41 26h9", stroke: "#ececec", "stroke-opacity": 0.6, "stroke-width": 4.5, "stroke-linecap": "round", fill: "none", pathLength: 1, "stroke-dasharray": "1", "stroke-dashoffset": "1" }, s);
      sc.l2 = svg("path", { d: "M41 38h5", stroke: "#ececec", "stroke-opacity": 0.6, "stroke-width": 4.5, "stroke-linecap": "round", fill: "none", pathLength: 1, "stroke-dasharray": "1", "stroke-dashoffset": "1" }, s);
      sc.logoSvg = s;
      sc.cam.insertBefore(s, sc.bars[0]);          // frame behind the bars

      // Wordmark lockup, as in docs/img/logo-lockup-dark.svg.
      sc.word = el("div", "rv-word", sc.cam);
      sc.wordCh = R.chars(el("span", "mk", sc.word), "Sahaay");
      sc.tag = el("div", "rv-tag", sc.cam, `<span class="deva">सहाय</span><i>·</i><span class="mono">offline lecture companion</span>`);

      sc.tag1 = el("div", "rv-line", sc.cam);
      sc.tag1w = words(sc.tag1, "Live captions. **22** Indian languages. A jargon glossary.");
      sc.tag2 = el("div", "rv-line", sc.cam);
      sc.tag2w = words(sc.tag2, "On the laptop, with the **network switched off.**");

      // Sound and light.
      R.cue(T0, "impact", { big: true });
      R.flash(T0, 0.5, "#9fd8ff", 0.55);
      R.shake(T0, 0.6, 16);
      R.ripple(T0, 960, 540, 1.2, 1400);
      R.cue(T0 + 2.05, "whoosh", { dir: 0, up: true });
      R.cue(T0 + LAND, "land");
      R.shake(T0 + LAND, 0.35, 7);
      R.ripple(T0 + LAND, 960, LY + LOGO / 2, 1, 1000);
      R.cue(T0 + 2.9, "shimmer");
      R.cue(T0 + 9.35, "zoom");
      R.light(T0, 960, 540, 700, 1);
      R.light(T0 + 2.4, 960, 540, 600, 0.7);
      R.light(T0 + LAND, 960, LY + LOGO / 2, 420, 0.9);
      R.light(T0 + 4, 960, 520, 620, 0.5);
      R.light(T0 + 9.2, 960, 520, 620, 0.5);
      R.light(T0 + 9.9, LX + 24 * K, LY + 32 * K, 900, 1);
    },

    render(t, T) {
      const sc = this;
      const beat = R.BEAT;
      const kick = R.kick(T, T0 + LAND, T0 + 10, 6);

      // Bars: equaliser, then the morph into the logo.
      const m = P(t, 1.95, LAND - 1.95, E.inOutExpo);
      sc.bars.forEach((d, i) => {
        const b = d._b;
        // equaliser state
        const k = clamp(Math.floor(t / beat), 0, EQ.length - 1);
        const dt = t - k * beat;
        const prev = k > 0 ? EQ[k - 1][i] : 0;
        const hit = lerp(prev, EQ[k][i], E.outExpo(clamp(dt / 0.12)));
        const eqH = 1080 * hit * (1 - 0.22 * clamp(dt / beat)) * (t < 0 ? 0 : 1);
        const eqW = 118, eqX = 960 + (i - 1) * 210, eqY = 540;
        // logo state
        const lgH = b.h * K * (1 + (i === 1 ? 0.16 : 0.1) * kick), lgW = 4.5 * K, lgX = LX + b.x * K, lgY = LY + 32 * K;
        const w = lerp(eqW, lgW, m), h = Math.max(w, lerp(eqH, lgH, m));
        const x = lerp(eqX, lgX, m), y = lerp(eqY, lgY, m);
        S(d, { x: x - w / 2, y: y - h / 2, w, h, o: t < 0 ? 0 : 1 });
        d.style.borderRadius = `${(w / 2).toFixed(1)}px`;
      });
      // Frame and lines draw in as the bars land.
      sc.box.setAttribute("stroke-dashoffset", (100 * (1 - P(t, LAND - 0.15, 0.7, E.inOutCubic))).toFixed(2));
      sc.box.setAttribute("fill-opacity", P(t, LAND, 0.5, E.outCubic).toFixed(3));
      sc.l1.setAttribute("stroke-dashoffset", (1 - P(t, LAND + 0.15, 0.45, E.outExpo)).toFixed(3));
      sc.l2.setAttribute("stroke-dashoffset", (1 - P(t, LAND + 0.25, 0.45, E.outExpo)).toFixed(3));
      const land = P(t, LAND - 0.1, 0.5, E.outBack);
      S(sc.logoSvg, { s: 0.9 + 0.1 * land, o: P(t, LAND - 0.2, 0.25) });

      // Wordmark rises letter by letter out of a mask.
      sc.wordCh.forEach((c, i) => {
        const p = P(t, 2.85 + i * 0.045, 0.9, E.outExpo);
        S(c, { y: (1 - p) * 190 });
      });
      const tg = P(t, 3.3, 0.7, E.outExpo);
      S(sc.tag, { o: tg, y: (1 - tg) * 20 });

      const line = (ws, a, b) => ws.forEach((w, i) => {
        const p = P(t, a + i * 0.05, 0.6, E.outExpo);
        const q = P(t, b + i * 0.02, 0.3, E.inCubic);
        S(w, { y: (1 - p) * 34 - q * 20, o: Math.min(1, p * 1.5) * (1 - q), blur: (1 - p) * 8 + q * 6 });
      });
      line(sc.tag1w, 3.75, 6.5);
      line(sc.tag2w, 6.75, 9.3);

      // Out: the camera dives into the blue bar until it fills the frame.
      const dive = P(t, 9.3, 0.7, E.inExpo);
      const fx = LX + 24 * K, fy = LY + 32 * K;
      sc.cam.style.transformOrigin = `${fx}px ${fy}px`;
      S(sc.cam, { s: 1 + dive * 60 });
    },
  });
})();
