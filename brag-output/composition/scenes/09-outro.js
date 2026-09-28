/* 09 Try it. The bars come back as the logo; the address types itself; credits; one last pulse. */
(() => {
  const { E, P, inout, clamp, lerp, el, svg, S, words, hash } = R;
  const T0 = 108;
  const LOGO = 190, K = LOGO / 64;
  const LX = 960 - LOGO / 2, LY = 150;
  const BARS = [{ x: 16, h: 10, c: "#ececec" }, { x: 24, h: 26, c: "#4db8ff" }, { x: 32, h: 16, c: "#ececec" }];
  const EQ = [[0.3, 0.55, 0.36], [0.5, 0.42, 0.28], [0.24, 0.62, 0.44]];
  const LAND = 1.6, URL_AT = 3.2, CREDITS = 6.0, FINAL = 10.0;
  const URL = "sahaay-offline.vercel.app";

  R.scene({
    id: "outro", start: T0, dur: 12, post: 0,
    build(root, sc) {
      sc.cam = el("div", "ot-cam", root);
      const s = svg("svg", { class: "ot-logo", viewBox: "0 0 64 64", width: LOGO, height: LOGO }, sc.cam);
      s.style.left = `${LX}px`; s.style.top = `${LY}px`;
      sc.box = svg("rect", { x: 1.5, y: 1.5, width: 61, height: 61, rx: 16, fill: "#050607", stroke: "#23272d", "stroke-width": 3, pathLength: 100, "stroke-dasharray": "100", "stroke-dashoffset": "100" }, s);
      sc.l1 = svg("path", { d: "M41 26h9", stroke: "#ececec", "stroke-opacity": 0.6, "stroke-width": 4.5, "stroke-linecap": "round", fill: "none", pathLength: 1, "stroke-dasharray": "1", "stroke-dashoffset": "1" }, s);
      sc.l2 = svg("path", { d: "M41 38h5", stroke: "#ececec", "stroke-opacity": 0.6, "stroke-width": 4.5, "stroke-linecap": "round", fill: "none", pathLength: 1, "stroke-dasharray": "1", "stroke-dashoffset": "1" }, s);
      sc.logo = s;
      sc.bars = BARS.map((b) => { const d = el("div", "rv-bar" + (b.c === "#4db8ff" ? " blue" : ""), sc.cam); d.style.background = b.c; d._b = b; return d; });
      sc.word = el("div", "ot-word", sc.cam);
      sc.wordCh = R.chars(el("span", "mk", sc.word), "Sahaay");
      sc.tag = el("div", "rv-tag ot-tag", sc.cam, `<span class="deva">सहाय</span><i>·</i><span class="mono">offline lecture companion</span>`);
      sc.try = el("div", "ot-try", sc.cam);
      sc.tryW = words(sc.try, "Try it in your browser. **No install.**");
      sc.url = el("div", "ot-url", sc.cam, `<svg viewBox="0 0 16 16" width="22" height="22"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8b919a" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="#8b919a" stroke-width="1.4"/></svg><span class="u mono"></span><span class="caret"></span>`);
      sc.urlText = sc.url.querySelector(".u");
      sc.caret = sc.url.querySelector(".caret");
      sc.cred1 = el("div", "ot-cred1 mono", sc.cam, "Snapdragon AI Lab · Build &amp; Present Challenge 2026");
      sc.cred2 = el("div", "ot-cred2", sc.cam, `A Hackathon Project by <b>AndrinGodson</b>`);

      R.cue(T0, "hit", { soft: true });
      R.cue(T0 + LAND, "land");
      R.ripple(T0 + LAND, 960, LY + LOGO / 2, 1, 1000);
      R.cue(T0 + 1.9, "shimmer");
      for (let k = 0; k < URL.length; k++) R.cue(T0 + URL_AT + 0.35 + k * 0.05, "type", { k, soft: true });
      R.cue(T0 + CREDITS, "blip", { k: 1 });
      R.cue(T0 + FINAL, "final");
      R.ripple(T0 + FINAL, LX + 24 * K, LY + 32 * K, 1.2, 1100);
      R.flash(T0 + FINAL, 0.4, "#4db8ff", 0.25);
      R.light(T0, 960, 540, 600, 0.5);
      R.light(T0 + LAND, 960, LY + LOGO / 2, 420, 0.8);
      R.light(T0 + URL_AT + 0.5, 960, 650, 520, 0.6);
      R.light(T0 + FINAL, LX + 24 * K, LY + 32 * K, 500, 0.9);
      R.light(T0 + 11.6, 960, 540, 200, 0);
    },

    render(t, T) {
      const sc = this;
      const beat = R.BEAT;
      const kick = R.kick(T, T0 + LAND, T0 + FINAL, 6);
      const m = P(t, 1.1, LAND - 1.1, E.inOutExpo);
      const fin = t >= FINAL ? Math.exp(-(t - FINAL) * 3.2) : 0;
      // The end: everything but the blue bar leaves; it pulses once and goes out.
      const end = P(t, FINAL + 0.2, 1.1, E.inOutCubic);
      const out = P(t, 11.1, 0.8, E.inCubic);
      sc.bars.forEach((d, i) => {
        const b = d._b;
        const k = clamp(Math.floor(t / beat), 0, EQ.length - 1);
        const dt = t - k * beat;
        const prev = k > 0 ? EQ[k - 1][i] : 0;
        const eqH = 1080 * lerp(prev, EQ[k][i], E.outExpo(clamp(dt / 0.12))) * (1 - 0.2 * clamp(dt / beat));
        const eqW = 70, eqX = 960 + (i - 1) * 130, eqY = 560;
        const lgH = b.h * K * (1 + (i === 1 ? 0.18 : 0.1) * kick + (i === 1 ? 0.6 : 0.25) * fin);
        const lgW = 4.5 * K, lgX = LX + b.x * K, lgY = LY + 32 * K;
        const w = lerp(eqW, lgW, m), h = Math.max(w, lerp(eqH, lgH, m));
        const x = lerp(eqX, lgX, m), y = lerp(eqY, lgY, m);
        S(d, { x: x - w / 2, y: y - h / 2, w, h, o: i === 1 ? 1 - out : 1 - end });
        d.style.borderRadius = `${(w / 2).toFixed(1)}px`;
      });
      sc.box.setAttribute("stroke-dashoffset", (100 * (1 - P(t, LAND - 0.15, 0.7, E.inOutCubic))).toFixed(2));
      sc.box.setAttribute("fill-opacity", P(t, LAND, 0.5).toFixed(3));
      sc.l1.setAttribute("stroke-dashoffset", (1 - P(t, LAND + 0.15, 0.45, E.outExpo)).toFixed(3));
      sc.l2.setAttribute("stroke-dashoffset", (1 - P(t, LAND + 0.25, 0.45, E.outExpo)).toFixed(3));
      S(sc.logo, { o: P(t, LAND - 0.2, 0.25) * (1 - end), s: 0.9 + 0.1 * P(t, LAND - 0.1, 0.5, E.outBack) });
      S(sc.word, { o: 1 - end });
      S(sc.try, { o: 1 - end });

      sc.wordCh.forEach((c, i) => S(c, { y: (1 - P(t, 1.85 + i * 0.045, 0.9, E.outExpo)) * 160 }));
      const tg = P(t, 2.3, 0.7, E.outExpo);
      S(sc.tag, { o: tg * (1 - end), y: (1 - tg) * 20 });
      sc.tryW.forEach((w, i) => {
        const p = P(t, URL_AT + i * 0.05, 0.6, E.outExpo);
        S(w, { o: Math.min(1, p * 1.5), y: (1 - p) * 28, blur: (1 - p) * 6 });
      });
      const up = P(t, URL_AT + 0.15, 0.6, E.outExpo);
      S(sc.url, { o: up * (1 - end), y: (1 - up) * 24, s: 0.96 + 0.04 * up });
      const n = Math.floor(clamp((t - URL_AT - 0.35) / (URL.length * 0.05)) * URL.length);
      sc.urlText.textContent = URL.slice(0, n);
      S(sc.caret, { o: t < URL_AT + 0.3 || (Math.floor(t * 2.2) % 2 === 0) ? 1 : 0 });
      const cr = P(t, CREDITS, 0.8, E.outExpo);
      S(sc.cred1, { o: cr * 0.9 * (1 - end), y: (1 - cr) * 16 });
      const cr2 = P(t, CREDITS + 0.25, 0.8, E.outExpo);
      S(sc.cred2, { o: cr2 * (1 - end), y: (1 - cr2) * 16 });

    },
  });
})();
